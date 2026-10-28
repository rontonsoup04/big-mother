-- beehive audit-readiness agent
-- Watches every requirement in the approved checklist and its evidence, explains each gap, coordinates the
-- follow-up and recalculates readiness as gaps close. It reuses the staff agent's credential workflow for the
-- staff-record requirements and writes to the same activity feed (agent_events, agent = 'audit').
--
-- Requirement status: missing, under_review, compliant. Indicators: overdue, review_due, review_required,
-- awaiting_verification, expiring, task_overdue. An upload never makes a requirement compliant by itself:
-- uploaded evidence is 'pending' until the owner verifies it.
-- Readiness = (compliant x 1 + under review x 0.5 + missing x 0) / approved requirements.

-- ---------------------------------------------------------------------------
-- evidence now carries a verification state and the agent's assessment
-- ---------------------------------------------------------------------------
-- Evidence recorded before this migration was accepted under the old rules, so it starts as verified.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'evidence' and column_name = 'status') then
    alter table public.evidence add column status text not null default 'verified';
    alter table public.evidence alter column status set default 'pending';
  end if;
end $$;
alter table public.evidence add column if not exists verified_by uuid references public.users (id) on delete set null;
alter table public.evidence add column if not exists verified_at timestamptz;
alter table public.evidence add column if not exists review_note text not null default '';
alter table public.evidence add column if not exists file_name text not null default '';
alter table public.evidence add column if not exists file_data text;
alter table public.evidence add column if not exists file_hash text;
alter table public.evidence add column if not exists extracted jsonb not null default '{}';
alter table public.evidence add column if not exists checks jsonb not null default '[]';
alter table public.evidence add column if not exists review_flag text not null default 'clear';
alter table public.evidence add column if not exists source text not null default 'app';
alter table public.evidence add column if not exists details jsonb not null default '{}';
do $$ begin
  alter table public.evidence add constraint evidence_status_check check (status in ('pending', 'verified', 'rejected', 'superseded'));
exception when duplicate_object then null; end $$;
update public.evidence set verified_at = created_at, verified_by = uploaded_by where status = 'verified' and verified_at is null;

alter table public.checklist_items add column if not exists agent_status text;
alter table public.checklist_items add column if not exists agent_priority text;
alter table public.checklist_items add column if not exists last_reviewed_at timestamptz;
alter table public.checklist_items add column if not exists reviewed_by uuid references public.users (id) on delete set null;

-- regulation updates gain an "assessed" step between new and reviewed
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.regulation_updates'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then execute 'alter table public.regulation_updates drop constraint ' || quote_ident(c); end if;
  alter table public.regulation_updates add constraint regulation_updates_status_check check (status in ('new', 'assessed', 'accepted', 'reviewed'));
end $$;
alter table public.regulation_updates add column if not exists assessed_at timestamptz;
alter table public.regulation_updates add column if not exists assessment text not null default '';

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
create table if not exists public.audit_tasks (
  id                    uuid primary key default gen_random_uuid(),
  centre_id             uuid not null references public.centres (id) on delete cascade,
  checklist_item_id     uuid references public.checklist_items (id) on delete cascade,
  kind                  text not null check (kind in ('evidence', 'regulation_review', 'overdue_task', 'owner_action')),
  title                 text not null,
  reason                text not null default '',
  recommended_action    text not null default '',
  priority              text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  state                 text not null default 'waiting' check (state in ('monitoring', 'waiting', 'owner_review', 'resolved')),
  assignee_staff_id     uuid references public.staff (id) on delete set null,   -- null = the owner
  due_date              date,
  next_follow_up        date,
  requests_sent         int not null default 0,
  last_request_at       timestamptz,
  escalated_at          timestamptz,
  evidence_id           uuid references public.evidence (id) on delete set null,
  regulation_update_id  uuid references public.regulation_updates (id) on delete cascade,
  compliance_record_id  uuid references public.compliance_records (id) on delete cascade,
  upload_token          uuid not null default gen_random_uuid(),
  opened_at             timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  resolved_at           timestamptz,
  resolution            text
);
create unique index if not exists audit_tasks_open_evidence on public.audit_tasks (checklist_item_id, kind) where state <> 'resolved' and kind in ('evidence', 'owner_action');
create unique index if not exists audit_tasks_open_reg on public.audit_tasks (regulation_update_id, checklist_item_id) where state <> 'resolved' and kind = 'regulation_review';
create unique index if not exists audit_tasks_open_record on public.audit_tasks (compliance_record_id) where state <> 'resolved' and kind = 'overdue_task';
create unique index if not exists audit_tasks_token on public.audit_tasks (upload_token);
create index if not exists audit_tasks_centre on public.audit_tasks (centre_id, state);

create table if not exists public.regulation_reviews (
  id                    uuid primary key default gen_random_uuid(),
  centre_id             uuid not null references public.centres (id) on delete cascade,
  regulation_update_id  uuid not null references public.regulation_updates (id) on delete cascade,
  checklist_item_id     uuid references public.checklist_items (id) on delete cascade,  -- null: unclear which item
  impact                text not null check (impact in ('likely', 'possible', 'unclear')),
  reason                text not null,
  recommended           text not null,
  decision              text check (decision in ('no_change', 'update_needed', 'not_applicable')),
  note                  text not null default '',
  decided_by            uuid references public.users (id) on delete set null,
  decided_at            timestamptz,
  completed_at          timestamptz,     -- update_needed: when the updated evidence was verified
  created_at            timestamptz not null default now()
);
create unique index if not exists regulation_reviews_unique on public.regulation_reviews (regulation_update_id, coalesce(checklist_item_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.agent_events add column if not exists agent text not null default 'staff';
alter table public.agent_events add column if not exists checklist_item_id uuid references public.checklist_items (id) on delete cascade;
alter table public.agent_events add column if not exists audit_task_id uuid references public.audit_tasks (id) on delete cascade;
alter table public.agent_events add column if not exists regulation_update_id uuid references public.regulation_updates (id) on delete cascade;
alter table public.agent_messages add column if not exists audit_task_id uuid references public.audit_tasks (id) on delete cascade;
alter table public.agent_runs add column if not exists agent text not null default 'staff';

alter table public.audit_tasks enable row level security;
alter table public.regulation_reviews enable row level security;
drop policy if exists "leaders read audit tasks" on public.audit_tasks;
create policy "leaders read audit tasks" on public.audit_tasks for select using (centre_id = public.my_centre_id() and public.is_leader());
drop policy if exists "assignees read audit tasks" on public.audit_tasks;
create policy "assignees read audit tasks" on public.audit_tasks for select
  using (exists (select 1 from public.staff s where s.id = assignee_staff_id and s.user_id = auth.uid()));
drop policy if exists "leaders read regulation reviews" on public.regulation_reviews;
create policy "leaders read regulation reviews" on public.regulation_reviews for select using (centre_id = public.my_centre_id() and public.is_leader());
grant select on public.audit_tasks, public.regulation_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- knowledge about each requirement
-- ---------------------------------------------------------------------------
-- The centre's own date (NSW). The database clock is UTC, so "today" in Sydney can be a day ahead of current_date.
create or replace function public._local_today() returns date language sql stable as $$
  select (now() at time zone 'Australia/Sydney')::date;
$$;

create or replace function public._item_task_pattern(p_key text) returns text language sql immutable as $$
  select case p_key when 'evacuation' then 'evacuat|rehears' when 'premises' then 'playground|premises' when 'sun' then 'sun protection'
                    when 'sleep' then 'sleep' when 'medical' then 'medical conditions' else null end;
$$;
create or replace function public._item_critical(p_key text) returns boolean language sql immutable as $$
  select p_key in ('wwcc', 'firstaid', 'evacuation', 'emergency', 'medical', 'incidents');
$$;
create or replace function public._item_why(p_key text) returns text language sql immutable as $$
  select case p_key
    when 'wwcc' then 'Every educator must hold a current Working with Children Check, and an officer can ask to see the register (Reg. 145–146).'
    when 'firstaid' then 'An educator with current first aid, CPR and anaphylaxis training must be on site at all times (Reg. 136).'
    when 'training' then 'Staff records must show each educator’s qualifications and training (Reg. 145–147).'
    when 'enrolment' then 'Staff must be able to reach a parent or emergency contact for every child (Reg. 160–162).'
    when 'incidents' then 'Parents must be told within 24 hours, and serious incidents notified to the regulator (Reg. 86–87).'
    when 'medical' then 'Children with medical conditions need current plans so staff can respond safely (Reg. 90–91).'
    when 'authorisations' then 'Children may only leave with an authorised person, and outings need written authorisation (Reg. 99–102).'
    when 'evacuation' then 'Emergency and evacuation procedures must be rehearsed every 3 months and each rehearsal recorded (Reg. 97).'
    when 'premises' then 'Premises, furniture and equipment must be safe, clean and well maintained (Reg. 103).'
    when 'emergency' then 'Emergency procedures, contacts and the evacuation floor plan must be current and displayed (Reg. 97, 168).'
    when 'sun' then 'The service must have a current sun protection policy that staff follow (Reg. 114, 168).'
    when 'sleep' then 'Sleep and rest policies must reflect current requirements, with a risk assessment at least every 12 months (Reg. 84A–84C).'
    else 'An authorised officer can ask to see this evidence at a visit.' end;
$$;
create or replace function public._req_label(p text) returns text language sql immutable as $$
  select case p when 'missing' then 'Missing' when 'under_review' then 'Under review' when 'compliant' then 'Compliant' else coalesce(p, '') end;
$$;
create or replace function public._audit_follow_days(p text) returns int language sql immutable as $$
  select case p when 'critical' then 2 when 'high' then 3 when 'medium' then 7 else 14 end;
$$;
create or replace function public._item_default_assignee(p_item checklist_items) returns uuid language sql stable security definer set search_path = public as $$
  select case when p_item.item_key in ('evacuation', 'premises') then
    (select s.id from staff s where s.centre_id = p_item.centre_id and s.is_active and s.position ilike 'lead%' order by s.full_name limit 1) end;
$$;

-- ---------------------------------------------------------------------------
-- the status of one requirement, with its reasons (used by the view and the agent)
-- ---------------------------------------------------------------------------
create or replace function public._requirement_status(p_item uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ci checklist_items; v_status text; v_flags text[] := '{}'; v_reason text := ''; v_cur text := ''; v_last timestamptz;
  v_ev evidence; v_pend evidence; v_exp date; v_prio text; v_prio_reason text; v_next text := ''; v_window int;
  n_bad int := 0; n_pend int := 0; n_soon int := 0; n_total int := 0; v_names text; v_task audit_tasks; v_rev record; v_rec record; v_pat text;
  v_assignee text;
begin
  select * into ci from checklist_items where id = p_item;
  if ci.id is null then return null; end if;
  -- a signed-in user only sees their own centre
  if auth.uid() is not null and ci.centre_id is distinct from my_centre_id() then return null; end if;

  if ci.evidence_kind = 'document' then
    select * into v_ev from evidence where checklist_item_id = ci.id and status = 'verified' order by recorded_on desc, created_at desc limit 1;
    select * into v_pend from evidence where checklist_item_id = ci.id and status = 'pending' order by created_at desc limit 1;
    v_window := least(30, greatest(5, ci.review_months * 7));
    if v_ev.id is not null then v_exp := (v_ev.recorded_on + make_interval(months => ci.review_months))::date; end if;
    if v_ev.id is not null and v_exp >= current_date then
      v_status := 'compliant';
      v_cur := v_ev.title || ' (' || _fmt_date(v_ev.recorded_on) || '), verified';
      v_reason := 'Verified evidence on file, current until ' || _fmt_date(v_exp) || '.';
      if v_exp <= current_date + v_window then
        v_flags := v_flags || 'review_due'::text;
        v_reason := 'Current, but due for renewal by ' || _fmt_date(v_exp) || '.';
      end if;
      if v_pend.id is not null then v_flags := v_flags || 'awaiting_verification'::text; end if;
    elsif v_pend.id is not null then
      v_status := 'under_review';
      v_cur := v_pend.title || ', uploaded ' || _fmt_date(v_pend.created_at::date) || ', not yet verified';
      v_reason := 'New evidence uploaded and waiting for verification.' ||
                  case when v_ev.id is not null then ' The last verified evidence expired on ' || _fmt_date(v_exp) || '.' else '' end;
      v_flags := v_flags || 'awaiting_verification'::text;
      if v_ev.id is not null then v_flags := v_flags || 'overdue'::text; end if;
    else
      v_status := 'missing';
      if v_ev.id is not null then
        v_flags := v_flags || 'overdue'::text;
        v_cur := v_ev.title || ' (' || _fmt_date(v_ev.recorded_on) || '), expired ' || _fmt_date(v_exp);
        v_reason := 'Out of date: the last verified evidence is from ' || _fmt_date(v_ev.recorded_on) || ' and expired on ' || _fmt_date(v_exp) || '.';
      else
        v_cur := 'No evidence on file';
        v_reason := 'No verified evidence on file.';
      end if;
    end if;
    v_last := coalesce(v_ev.verified_at, v_ev.created_at);

  elsif ci.evidence_kind = 'certificates' then
    with req as (
      select s.id sid, s.full_name, ct.id tid, ct.name tname from staff s cross join certificate_types ct
      where s.centre_id = ci.centre_id and s.is_active and s.position not ilike '%owner%' and ct.code = any (ci.cert_codes) and ct.code = any (_required_cert_codes())
    ), st as (
      select r.*, (select max(sc.expiry_date) from staff_certificates sc where sc.staff_id = r.sid and sc.certificate_type_id = r.tid) as exp,
             exists (select 1 from certificate_submissions cs where cs.staff_id = r.sid and cs.certificate_type_id = r.tid and cs.status = 'pending') as pend
      from req r
    )
    select count(*) filter (where (exp is null or exp < current_date) and not pend),
           count(*) filter (where pend),
           count(*) filter (where exp >= current_date and exp <= current_date + 30 and not pend),
           count(*),
           string_agg(split_part(full_name, ' ', 1) || ' (' || tname || case when exp is null then ', missing' else ', expired ' || _fmt_date(exp) end || ')', '; ')
             filter (where (exp is null or exp < current_date) and not pend)
      into n_bad, n_pend, n_soon, n_total, v_names from st;
    v_cur := 'Staff register: ' || n_total || ' credentials tracked';
    if n_total = 0 then
      v_status := 'missing'; v_reason := 'No staff credentials of this type are on the register.';
    elsif n_bad > 0 then
      v_status := 'missing'; v_flags := v_flags || 'overdue'::text;
      v_reason := 'Expired or missing: ' || v_names || '.';
    elsif n_pend > 0 then
      v_status := 'under_review'; v_flags := v_flags || 'awaiting_verification'::text;
      v_reason := n_pend || ' renewed certificate' || case when n_pend = 1 then ' is' else 's are' end || ' waiting for verification.';
    else
      v_status := 'compliant';
      v_reason := 'Every credential on the register is current.';
    end if;
    if n_soon > 0 then
      v_flags := v_flags || 'expiring'::text;
      v_reason := v_reason || ' ' || n_soon || ' expire' || case when n_soon = 1 then 's' else '' end || ' within 30 days; the staff agent is chasing the renewals.';
    end if;
    select max(coalesce(cs.reviewed_at, sc.created_at)) into v_last from staff_certificates sc join staff st on st.id = sc.staff_id
      left join certificate_submissions cs on cs.staff_id = st.id and cs.status = 'approved' where st.centre_id = ci.centre_id;

  elsif ci.evidence_kind = 'incidents' then
    v_cur := 'Incident register: ' || (select count(*) from incidents i where i.centre_id = ci.centre_id) || ' records';
    if exists (select 1 from v_incident_deadlines d where d.centre_id = ci.centre_id and (d.parent_status = 'overdue' or d.regulator_status = 'overdue')) then
      v_status := 'missing'; v_flags := v_flags || 'overdue'::text; v_reason := 'An incident notice is overdue.';
    elsif exists (select 1 from v_incident_deadlines d where d.centre_id = ci.centre_id and (d.parent_status = 'pending' or d.regulator_status = 'pending')) then
      v_status := 'under_review'; v_reason := 'An incident notice is due within 24 hours.';
    else
      v_status := 'compliant'; v_reason := 'Every incident notice was sent on time.';
    end if;
    select max(i.created_at) into v_last from incidents i where i.centre_id = ci.centre_id;

  elsif ci.evidence_kind = 'medical' then
    v_cur := 'Medical profiles: ' || (select count(distinct m.child_id) from medical_updates m where m.centre_id = ci.centre_id and m.status = 'approved') || ' reviewed';
    select count(*) into n_pend from medical_updates m where m.centre_id = ci.centre_id and m.status = 'pending';
    if n_pend > 0 then
      v_status := 'under_review';
      v_reason := n_pend || ' parent medical update' || case when n_pend = 1 then ' is' else 's are' end || ' waiting for review.';
      v_flags := v_flags || 'awaiting_verification'::text;
      if exists (select 1 from medical_updates m where m.centre_id = ci.centre_id and m.status = 'pending' and m.submitted_at < now() - interval '2 days') then
        v_flags := v_flags || 'overdue'::text;
      end if;
    else
      v_status := 'compliant'; v_reason := 'All medical updates are reviewed.';
    end if;
    select max(coalesce(m.approved_at, m.submitted_at)) into v_last from medical_updates m where m.centre_id = ci.centre_id;

  else -- children
    select count(*), count(*) filter (where trim(c.emergency_contact) = '') into n_total, n_bad from children c where c.centre_id = ci.centre_id and c.is_active;
    v_cur := n_total || ' active child records';
    if n_total = 0 then v_status := 'missing'; v_reason := 'No child records yet.';
    elsif n_bad > 0 then v_status := 'missing'; v_reason := n_bad || ' child record' || case when n_bad = 1 then ' is' else 's are' end || ' missing an emergency contact.';
    else v_status := 'compliant'; v_reason := 'Every child has a parent and emergency contact on file.'; end if;
    select max(c.created_at) into v_last from children c where c.centre_id = ci.centre_id;
  end if;

  -- a guidance change the owner hasn't decided on yet
  if ci.review_required then
    v_flags := v_flags || 'review_required'::text;
    if v_status = 'compliant' then v_status := 'under_review'; end if;
    v_reason := coalesce(nullif(ci.review_note, ''), 'Review required after a guidance update') || '. ' || v_reason;
  end if;
  -- the linked recurring task is overdue
  v_pat := _item_task_pattern(ci.item_key);
  if v_pat is not null then
    select q.title, r.due_date into v_rec from compliance_records r join compliance_requirements q on q.id = r.requirement_id
     where q.centre_id = ci.centre_id and q.is_active and q.title ~* v_pat and r.status = 'pending' and r.due_date < current_date
     order by r.due_date limit 1;
    if v_rec.title is not null then
      v_flags := v_flags || 'task_overdue'::text;
      v_reason := v_reason || ' The scheduled ' || lower(v_rec.title) || ' was due ' || _fmt_date(v_rec.due_date) || '.';
    end if;
  end if;

  -- priority, and why
  if v_status = 'missing' then
    v_prio := case when _item_critical(ci.item_key) then 'critical' else 'high' end;
    v_prio_reason := case when v_prio = 'critical' then 'Critical: this is a child-safety requirement and the evidence is ' || case when 'overdue' = any (v_flags) then 'out of date' else 'missing' end || '.'
                          else 'High: an officer can ask for this evidence and it is ' || case when 'overdue' = any (v_flags) then 'out of date' else 'missing' end || '.' end;
  elsif v_status = 'under_review' then
    if 'overdue' = any (v_flags) and _item_critical(ci.item_key) then v_prio := 'high'; v_prio_reason := 'High: a child-safety requirement is only covered once the new evidence is verified.';
    elsif 'review_required' = any (v_flags) then v_prio := 'medium'; v_prio_reason := 'Medium: a guidance change may affect this requirement and needs your decision.';
    else v_prio := 'medium'; v_prio_reason := 'Medium: evidence is waiting for verification.'; end if;
  else
    if 'review_due' = any (v_flags) or 'expiring' = any (v_flags) then v_prio := 'medium'; v_prio_reason := 'Medium: compliant now, but evidence expires soon.';
    else v_prio := 'low'; v_prio_reason := 'Low: compliant with verified evidence.'; end if;
  end if;
  if 'task_overdue' = any (v_flags) and v_prio in ('medium', 'low') then
    v_prio := 'high'; v_prio_reason := 'High: the scheduled ' || lower(v_rec.title) || ' is overdue.';
  end if;

  -- what should happen next
  select * into v_task from audit_tasks t where t.checklist_item_id = ci.id and t.state <> 'resolved' and t.kind in ('evidence', 'owner_action')
   order by t.opened_at limit 1;
  select coalesce(split_part(s.full_name, ' ', 1), '') into v_assignee from staff s where s.id = v_task.assignee_staff_id;
  if 'review_required' = any (v_flags) then
    select u.title, rr.decision into v_rev from regulation_reviews rr join regulation_updates u on u.id = rr.regulation_update_id
     where rr.checklist_item_id = ci.id and (rr.decision is null or (rr.decision = 'update_needed' and rr.completed_at is null)) order by rr.created_at desc limit 1;
    v_next := case when v_rev.decision = 'update_needed' then 'Upload the updated policy that reflects “' || v_rev.title || '”, then verify it.'
                   when v_rev.title is not null then 'Review “' || v_rev.title || '” and record whether the policy needs to change.'
                   else 'Review the guidance change and record your decision.' end;
  elsif v_pend.id is not null and ci.evidence_kind = 'document' then
    v_next := 'Check and verify “' || v_pend.title || '”.';
  elsif ci.evidence_kind = 'document' and v_status = 'missing' then
    v_next := case when v_task.id is not null and v_task.assignee_staff_id is not null
                   then 'Waiting for ' || v_assignee || ' to upload it' || case when v_task.next_follow_up is not null then ' (follow-up ' || _fmt_date(v_task.next_follow_up) || ')' else '' end || '.'
                   else 'Upload ' || lower(left(ci.evidence_hint, 1)) || substr(ci.evidence_hint, 2) || '.' end;
  elsif ci.evidence_kind = 'document' and 'review_due' = any (v_flags) then
    v_next := case when v_task.id is not null and v_task.assignee_staff_id is not null then 'Renewal requested from ' || v_assignee || '.'
                   else 'Upload a renewed version before ' || _fmt_date(v_exp) || '.' end;
  elsif ci.evidence_kind = 'certificates' and v_status <> 'compliant' then
    v_next := case when n_bad > 0 then 'The staff agent is chasing the renewals. Decide on its escalations in Staff certifications.'
                   else 'Verify the uploaded certificate' || case when n_pend = 1 then '' else 's' end || ' in Staff certifications.' end;
  elsif ci.evidence_kind = 'certificates' and n_soon > 0 then
    v_next := 'Nothing for you yet: the staff agent is chasing ' || n_soon || ' renewal' || case when n_soon = 1 then '' else 's' end || '.';
  elsif ci.evidence_kind = 'incidents' and v_status <> 'compliant' then v_next := 'Send the outstanding incident notice.';
  elsif ci.evidence_kind = 'medical' and v_status <> 'compliant' then v_next := 'Review the waiting medical update.';
  elsif ci.evidence_kind = 'children' and v_status <> 'compliant' then v_next := 'Add the missing emergency contacts.';
  else
    v_next := case when v_exp is not null then 'None. Next renewal due by ' || _fmt_date(v_exp) || '.' else 'None. beehive keeps watching.' end;
  end if;
  if 'task_overdue' = any (v_flags) then
    v_next := v_next || case when ci.evidence_kind = 'document' and v_status <> 'compliant'
                             then ' Verifying it also completes the overdue ' || lower(v_rec.title) || '.'
                             else ' Also complete the overdue ' || lower(v_rec.title) || '.' end;
  end if;

  return jsonb_build_object(
    'status', v_status, 'label', _req_label(v_status), 'flags', to_jsonb(v_flags), 'reason', trim(v_reason),
    'priority', v_prio, 'priority_reason', v_prio_reason, 'why', _item_why(ci.item_key), 'next_action', trim(v_next),
    'current_evidence', v_cur, 'last_reviewed', coalesce(ci.last_reviewed_at, v_last),
    'evidence_id', v_ev.id, 'evidence_title', v_ev.title, 'evidence_file', v_ev.file_path, 'evidence_date', v_ev.recorded_on, 'evidence_expires', v_exp,
    'pending_evidence_id', v_pend.id, 'open_task_id', v_task.id);
end $$;
revoke execute on function public._requirement_status(uuid) from public, anon;
grant execute on function public._requirement_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- views: same columns the app already reads, plus the agent's fields
-- ---------------------------------------------------------------------------
drop view if exists public.v_readiness;
drop view if exists public.v_checklist_status;
create view public.v_checklist_status with (security_invoker = true) as
select
  ci.id, ci.centre_id, ci.item_key, ci.area, ci.title, ci.source_ref, ci.evidence_hint, ci.evidence_kind,
  ci.summary, ci.risk_note, ci.icon, ci.review_required, ci.review_note, ci.review_months,
  (ci.approved_at is not null) as approved,
  s->>'evidence_title' as evidence_title, s->>'evidence_file' as evidence_file, (s->>'evidence_date')::date as evidence_date,
  case s->>'status' when 'compliant' then 'green' when 'under_review' then 'yellow' else 'red' end as status,
  s->>'reason' as reason,
  s->>'current_evidence' as evidence_text,
  (s->>'last_reviewed')::timestamptz as last_updated,
  s->>'status' as req_status,
  array(select jsonb_array_elements_text(s->'flags')) as flags,
  s->>'priority' as priority, s->>'priority_reason' as priority_reason, s->>'why' as why, s->>'next_action' as next_action,
  (s->>'evidence_expires')::date as evidence_expires, (s->>'pending_evidence_id')::uuid as pending_evidence_id, (s->>'open_task_id')::uuid as open_task_id
from public.checklist_items ci
cross join lateral (select public._requirement_status(ci.id) as s) x
where ci.is_active;
grant select on public.v_checklist_status to authenticated;

-- Readiness from approved requirements: compliant 1, under review 0.5, missing 0.
create view public.v_readiness with (security_invoker = true) as
select centre_id,
  count(*)::int as total_items,
  count(*) filter (where status = 'green')::int as green,
  count(*) filter (where status = 'yellow')::int as yellow,
  count(*) filter (where status = 'red')::int as red,
  case when count(*) = 0 then 0
       else round(100.0 * (count(*) filter (where status = 'green') + 0.5 * count(*) filter (where status = 'yellow')) / count(*))::int end as score
from public.v_checklist_status where approved group by centre_id;
grant select on public.v_readiness to authenticated;

-- ---------------------------------------------------------------------------
-- feed + messages
-- ---------------------------------------------------------------------------
create or replace function public._audit_event(p_centre uuid, p_item uuid, p_task uuid, p_reg uuid, p_kind text, p_state text, p_summary text, p_detail jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into agent_events (centre_id, agent, checklist_item_id, audit_task_id, regulation_update_id, kind, state, summary, detail)
  values (p_centre, 'audit', p_item, p_task, p_reg, p_kind, p_state, p_summary, coalesce(p_detail, '{}'));
  perform log_audit(p_centre, 'audit_agent.' || p_kind, coalesce(case when p_task is not null then 'audit_tasks' end, 'checklist_items'),
    coalesce(p_task::text, p_item::text, p_reg::text, ''), coalesce(p_detail, '{}') || jsonb_build_object('summary', p_summary, 'checklist_item_id', p_item));
end $$;
revoke execute on function public._audit_event(uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Simulated email/SMS to the person asked for evidence.
create or replace function public._audit_send(p_task uuid, p_kind text, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare t audit_tasks; ci checklist_items; s staff; c centres; v_owner text; v_channel text; v_to text; v_body text; v_subject text; v_next date; v_id uuid;
begin
  select * into t from audit_tasks where id = p_task;
  select * into ci from checklist_items where id = t.checklist_item_id;
  select * into s from staff where id = t.assignee_staff_id;
  if s.id is null then return null; end if;
  select * into c from centres where id = t.centre_id;
  select coalesce(u.full_name, 'the centre owner') into v_owner from users u where u.centre_id = t.centre_id and u.role = 'owner' limit 1;
  if coalesce(s.email, '') <> '' then v_channel := 'email'; v_to := s.email; elsif coalesce(s.phone, '') <> '' then v_channel := 'sms'; v_to := s.phone; else v_channel := 'none'; v_to := ''; end if;
  v_subject := case p_kind when 'request' then 'Please upload: ' || ci.title when 'follow_up' then 'Reminder: ' || ci.title else 'Please upload again: ' || ci.title end;
  v_body := 'Hi ' || split_part(s.full_name, ' ', 1) || ', ' ||
    case p_kind
      when 'request' then 'for our audit records we need ' || lower(left(ci.evidence_hint, 1)) || substr(ci.evidence_hint, 2) || ' (' || ci.source_ref || '). Please upload it' ||
                          case when t.due_date is not null then ' by ' || _fmt_date(t.due_date) else '' end || ' using your secure link.'
      when 'follow_up' then 'we still need ' || lower(left(ci.evidence_hint, 1)) || substr(ci.evidence_hint, 2) || '. Please upload it using your secure link.'
      else 'the evidence you uploaded for ' || lower(ci.title) || ' couldn’t be accepted' || case when p_note <> '' then ' (' || p_note || ')' else '' end || '. Please upload a corrected version using your secure link.'
    end || ' Thanks, ' || split_part(v_owner, ' ', 1) || ', ' || c.name || '.';
  v_next := current_date + _audit_follow_days(t.priority);
  insert into agent_messages (centre_id, task_id, audit_task_id, staff_id, kind, channel, recipient, subject, body, upload_link, outcome, next_follow_up)
  values (t.centre_id, null, t.id, s.id, p_kind, v_channel, v_to, v_subject, v_body, '/#evidence/' || t.upload_token,
          case when v_channel = 'none' then 'no_contact' else 'simulated' end, v_next)
  returning id into v_id;
  update audit_tasks set requests_sent = requests_sent + 1, last_request_at = now(), next_follow_up = v_next, updated_at = now(),
         state = case when state = 'owner_review' then state else 'waiting' end where id = t.id;
  perform _audit_event(t.centre_id, t.checklist_item_id, t.id, null,
    case p_kind when 'request' then 'evidence_requested' when 'follow_up' then 'evidence_follow_up' else 'evidence_correction' end, 'Action taken',
    case p_kind when 'request' then 'Evidence requested from ' || split_part(s.full_name, ' ', 1) when 'follow_up' then 'Follow-up sent to ' || split_part(s.full_name, ' ', 1)
                else 'Corrected evidence requested from ' || split_part(s.full_name, ' ', 1) end,
    jsonb_build_object('message_id', v_id, 'channel', v_channel, 'recipient', v_to, 'simulated', true, 'next_follow_up', v_next));
  return v_id;
end $$;
revoke execute on function public._audit_send(uuid, text, text) from public, anon, authenticated;

-- Complete the recurring task linked to a requirement (e.g. a verified drill record completes the rehearsal).
create or replace function public._complete_linked_task(p_item uuid, p_on date, p_by uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare ci checklist_items; v_pat text;
begin
  select * into ci from checklist_items where id = p_item;
  v_pat := _item_task_pattern(ci.item_key);
  if v_pat is null then return; end if;
  update compliance_records r set status = 'completed', completed_on = least(coalesce(p_on, current_date), _local_today()), completed_by = p_by, notes = coalesce(nullif(p_note, ''), 'Evidence verified')
    from compliance_requirements q
   where r.requirement_id = q.id and q.centre_id = ci.centre_id and q.is_active and q.title ~* v_pat and r.status = 'pending';
end $$;
revoke execute on function public._complete_linked_task(uuid, date, uuid, text) from public, anon, authenticated;

-- The old "drill completes rehearsal" rule now applies to any verified evidence for a linked requirement.
create or replace function public._drill_completes_rehearsal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'verified' then perform _complete_linked_task(new.checklist_item_id, new.recorded_on, new.uploaded_by, coalesce(nullif(new.title, ''), 'Evidence recorded')); end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- regulation updates: identify what may be affected (not what must change)
-- ---------------------------------------------------------------------------
create or replace function public._assess_regulation(p_update uuid)
returns int language plpgsql security definer set search_path = public as $$
declare u regulation_updates; ci record; v_impact text; v_reason text; n int := 0; v_task uuid; v_text text; v_titles text := '';
begin
  select * into u from regulation_updates where id = p_update;
  v_text := lower(u.title || ' ' || u.summary);
  for ci in select * from checklist_items where centre_id = u.centre_id and is_active and approved_at is not null loop
    v_impact := null;
    if exists (select 1 from unnest(u.match_terms) t where ci.item_key = t or ci.title ilike '%' || t || '%') then
      v_impact := 'likely';
      v_reason := 'The update is about ' || lower(ci.title) || ', which your checklist covers.';
    elsif ci.item_key is not null and (v_text like '%' || ci.item_key || '%' or (ci.item_key = 'sleep' and v_text ~ 'sleep|rest')
          or (ci.item_key = 'sun' and v_text ~ 'sun |uv') or (ci.item_key = 'evacuation' and v_text ~ 'evacuat|emergency drill')) then
      v_impact := 'possible';
      v_reason := 'The update mentions ' || lower(ci.title) || ', so it may be relevant.';
    end if;
    if v_impact is null then continue; end if;
    insert into regulation_reviews (centre_id, regulation_update_id, checklist_item_id, impact, reason, recommended)
    values (u.centre_id, u.id, ci.id, v_impact, v_reason,
            'Compare your current ' || lower(ci.title) || ' evidence with the new guidance. Record “no change needed” if it already complies, or upload an updated version if it doesn’t.')
    on conflict do nothing;
    update checklist_items set review_required = true, review_note = 'Review required: ' || u.title where id = ci.id;
    insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state, regulation_update_id, due_date)
    values (u.centre_id, ci.id, 'regulation_review', 'Review ' || ci.title || ' against “' || u.title || '”', v_reason,
            'Read the update, compare it with your current evidence and record your decision. beehive won’t change the policy or the status for you.',
            'medium', 'owner_review', u.id, current_date + 14)
    on conflict do nothing returning id into v_task;
    perform _audit_event(u.centre_id, ci.id, v_task, u.id, 'review_required', 'Owner review', 'Review required: ' || ci.title,
      jsonb_build_object('impact', v_impact, 'reason', v_reason, 'update', u.title));
    v_titles := v_titles || case when v_titles = '' then '' else ', ' end || ci.title;
    n := n + 1;
  end loop;
  if n = 0 then
    insert into regulation_reviews (centre_id, regulation_update_id, checklist_item_id, impact, reason, recommended)
    values (u.centre_id, u.id, null, 'unclear', 'beehive couldn’t match this update to a requirement in your checklist.', 'Read the update and confirm whether it applies to your centre.')
    on conflict do nothing;
    insert into audit_tasks (centre_id, kind, title, reason, recommended_action, priority, state, regulation_update_id, due_date)
    values (u.centre_id, 'regulation_review', 'Confirm whether “' || u.title || '” applies', 'No checklist requirement clearly matches this update, so the impact is uncertain.',
            'Read the update and record whether it applies.', 'medium', 'owner_review', u.id, current_date + 14)
    on conflict do nothing;
  end if;
  update regulation_updates set status = 'assessed', assessed_at = now(),
    assessment = case when n = 0 then 'Impact unclear: no requirement clearly matches. Flagged for your review.'
                      else 'May affect ' || n || ' requirement' || case when n = 1 then '' else 's' end || ': ' || v_titles || '. This identifies a potentially relevant change; it doesn’t confirm your policy must change.' end,
    affected_summary = coalesce(nullif(v_titles, ''), affected_summary)
   where id = u.id;
  perform _audit_event(u.centre_id, null, null, u.id, 'regulation_assessed', 'Action taken', 'Regulation change assessed: ' || u.title,
    jsonb_build_object('affected', n, 'items', v_titles));
  return n;
end $$;
revoke execute on function public._assess_regulation(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- the loop
-- ---------------------------------------------------------------------------
create or replace function public.run_audit_agent_for(p_centre uuid, p_trigger text default 'app')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ci checklist_items; s jsonb; v_status text; v_prio text; t audit_tasks; v_flags text[]; v_assignee uuid; r record; v_pat text; v_any boolean;
  n_gaps int := 0; n_changes int := 0; n_requests int := 0; n_follow int := 0; n_tasks int := 0; n_resolved int := 0; n_reg int := 0; n_esc int := 0;
begin
  if not exists (select 1 from checklist_items where centre_id = p_centre and is_active and approved_at is not null) then
    return jsonb_build_object('skipped', 'checklist not approved');
  end if;
  -- 1. regulation updates waiting to be assessed
  for r in select id from regulation_updates where centre_id = p_centre and status = 'new' loop
    perform _assess_regulation(r.id); n_reg := n_reg + 1;
  end loop;

  -- 2. every approved requirement
  for ci in select * from checklist_items where centre_id = p_centre and is_active and approved_at is not null order by area, title loop
    s := _requirement_status(ci.id);
    v_status := s->>'status'; v_prio := s->>'priority';
    v_flags := array(select jsonb_array_elements_text(s->'flags'));
    if ci.agent_status is null then
      if v_status <> 'compliant' then
        perform _audit_event(p_centre, ci.id, null, null, 'gap_detected', 'Monitoring',
          case v_status when 'missing' then 'Gap detected: ' else 'Needs review: ' end || ci.title,
          jsonb_build_object('status', v_status, 'reason', s->>'reason', 'priority', v_prio, 'priority_reason', s->>'priority_reason', 'why', s->>'why', 'next_action', s->>'next_action'));
        n_gaps := n_gaps + 1;
      end if;
    elsif ci.agent_status <> v_status then
      perform _audit_event(p_centre, ci.id, null, null, 'status_changed', case when v_status = 'compliant' then 'Resolved' else 'Monitoring' end,
        _req_label(ci.agent_status) || ' → ' || _req_label(v_status) || ': ' || ci.title,
        jsonb_build_object('from', ci.agent_status, 'to', v_status, 'reason', s->>'reason', 'priority', v_prio, 'priority_reason', s->>'priority_reason'));
      n_changes := n_changes + 1;
    end if;
    update checklist_items set agent_status = v_status, agent_priority = v_prio where id = ci.id;

    -- evidence collection for document requirements
    if ci.evidence_kind = 'document' then
      select * into t from audit_tasks where checklist_item_id = ci.id and kind = 'evidence' and state <> 'resolved';
      if s->>'pending_evidence_id' is not null then
        if t.id is null then
          insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state, evidence_id)
          values (p_centre, ci.id, 'evidence', 'Verify evidence for ' || ci.title, s->>'reason', 'Check the uploaded evidence against the requirement and verify or reject it.',
                  case when v_prio = 'low' then 'medium' else v_prio end, 'owner_review', (s->>'pending_evidence_id')::uuid);
          n_tasks := n_tasks + 1;
        elsif t.state <> 'owner_review' or t.evidence_id is distinct from (s->>'pending_evidence_id')::uuid then
          update audit_tasks set state = 'owner_review', evidence_id = (s->>'pending_evidence_id')::uuid, updated_at = now() where id = t.id;
        end if;
      elsif v_status = 'missing' or (v_status = 'compliant' and 'review_due' = any (v_flags) and (s->>'evidence_expires')::date <= current_date + 14) then
        if t.id is null then
          v_assignee := _item_default_assignee(ci);
          insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state, assignee_staff_id, due_date)
          values (p_centre, ci.id, 'evidence', case when v_status = 'missing' then 'Collect evidence for ' else 'Renew evidence for ' end || ci.title,
                  s->>'reason', 'Upload ' || lower(left(ci.evidence_hint, 1)) || substr(ci.evidence_hint, 2) || '.',
                  case when v_prio = 'low' then 'medium' else v_prio end, 'waiting', v_assignee,
                  case when v_status = 'missing' then current_date + _audit_follow_days(v_prio) + 2 else (s->>'evidence_expires')::date end)
          returning * into t;
          n_tasks := n_tasks + 1;
          if v_assignee is not null then
            perform _audit_send(t.id, 'request'); n_requests := n_requests + 1;
          else
            perform _audit_event(p_centre, ci.id, t.id, null, 'action_proposed', 'Waiting', 'Proposed for you: upload evidence for ' || ci.title,
              jsonb_build_object('next_action', t.recommended_action, 'priority', t.priority, 'proposed', true));
          end if;
        else
          if t.priority is distinct from v_prio and v_prio <> 'low' then update audit_tasks set priority = v_prio, updated_at = now() where id = t.id; end if;
          if t.state = 'owner_review' and t.escalated_at is null then update audit_tasks set state = 'waiting', evidence_id = null where id = t.id; end if;
          if t.assignee_staff_id is not null and t.next_follow_up is not null and t.next_follow_up <= current_date then
            if t.requests_sent >= 3 and t.escalated_at is null then
              update audit_tasks set escalated_at = now(), state = 'owner_review',
                recommended_action = 'Speak to ' || (select split_part(full_name, ' ', 1) from staff where id = t.assignee_staff_id) || ' or assign the task to someone else.'
               where id = t.id;
              perform _audit_event(p_centre, ci.id, t.id, null, 'escalated', 'Owner review', 'Escalated to you: ' || ci.title,
                jsonb_build_object('reason', 'No response after ' || t.requests_sent || ' requests.'));
              n_esc := n_esc + 1;
            elsif t.escalated_at is null then
              perform _audit_send(t.id, 'follow_up'); n_follow := n_follow + 1;
            end if;
          end if;
        end if;
      elsif t.id is not null and v_status = 'compliant' then
        update audit_tasks set state = 'resolved', resolved_at = now(), resolution = 'Verified evidence on file', updated_at = now() where id = t.id;
        perform _audit_event(p_centre, ci.id, t.id, null, 'resolved', 'Resolved', 'Gap closed: ' || ci.title, jsonb_build_object('reason', s->>'reason'));
        n_resolved := n_resolved + 1;
      end if;
    elsif ci.evidence_kind in ('medical', 'incidents', 'children') then
      select * into t from audit_tasks where checklist_item_id = ci.id and kind = 'owner_action' and state <> 'resolved';
      if v_status <> 'compliant' and t.id is null then
        insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state)
        values (p_centre, ci.id, 'owner_action', ci.title || ': ' || lower(s->>'next_action'), s->>'reason', s->>'next_action', case when v_prio = 'low' then 'medium' else v_prio end, 'waiting')
        returning * into t;
        perform _audit_event(p_centre, ci.id, t.id, null, 'action_proposed', 'Waiting', 'Proposed for you: ' || lower(s->>'next_action'),
          jsonb_build_object('reason', s->>'reason', 'proposed', true));
        n_tasks := n_tasks + 1;
      elsif v_status = 'compliant' and t.id is not null then
        update audit_tasks set state = 'resolved', resolved_at = now(), resolution = s->>'reason', updated_at = now() where id = t.id;
        perform _audit_event(p_centre, ci.id, t.id, null, 'resolved', 'Resolved', 'Gap closed: ' || ci.title, jsonb_build_object('reason', s->>'reason'));
        n_resolved := n_resolved + 1;
      end if;
    end if;
    -- certificate requirements are handled by the staff agent: nothing to send from here
  end loop;

  -- 3. overdue recurring compliance tasks
  for r in
    select rec.id as record_id, q.title, rec.due_date, q.regulation_reference,
           (select ci2.id from checklist_items ci2 where ci2.centre_id = p_centre and ci2.is_active and ci2.approved_at is not null
              and _item_task_pattern(ci2.item_key) is not null and q.title ~* _item_task_pattern(ci2.item_key) limit 1) as item_id
    from compliance_records rec join compliance_requirements q on q.id = rec.requirement_id
    where q.centre_id = p_centre and q.is_active and rec.status = 'pending' and rec.due_date < current_date
  loop
    if not exists (select 1 from audit_tasks where compliance_record_id = r.record_id and kind = 'overdue_task' and state <> 'resolved') then
      insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state, compliance_record_id, due_date)
      values (p_centre, r.item_id, 'overdue_task', 'Complete the overdue ' || lower(r.title),
              'Due ' || _fmt_date(r.due_date) || ' (' || r.regulation_reference || '). Overdue scheduled tasks are one of the first things an officer checks.',
              'Do it, record it on the Compliance page and attach any evidence.', 'high', 'waiting', r.record_id, r.due_date)
      returning * into t;
      perform _audit_event(p_centre, r.item_id, t.id, null, 'task_overdue', 'Waiting', 'Overdue: ' || r.title,
        jsonb_build_object('due_date', r.due_date, 'regulation', r.regulation_reference, 'proposed', true));
      n_tasks := n_tasks + 1;
    end if;
  end loop;
  for t in select a.* from audit_tasks a where a.centre_id = p_centre and a.kind = 'overdue_task' and a.state <> 'resolved'
           and not exists (select 1 from compliance_records rec where rec.id = a.compliance_record_id and rec.status = 'pending') loop
    update audit_tasks set state = 'resolved', resolved_at = now(), resolution = 'Task completed', updated_at = now() where id = t.id;
    perform _audit_event(p_centre, t.checklist_item_id, t.id, null, 'resolved', 'Resolved', 'Done: ' || replace(t.title, 'Complete the overdue ', ''), '{}');
    n_resolved := n_resolved + 1;
  end loop;

  insert into agent_runs (centre_id, agent, trigger, summary) values (p_centre, 'audit', p_trigger, jsonb_build_object(
    'gaps', n_gaps, 'status_changes', n_changes, 'requests', n_requests, 'follow_ups', n_follow, 'tasks', n_tasks, 'resolved', n_resolved, 'regulation_updates', n_reg, 'escalated', n_esc));
  return jsonb_build_object('gaps', n_gaps, 'status_changes', n_changes, 'requests', n_requests, 'follow_ups', n_follow, 'tasks', n_tasks,
    'resolved', n_resolved, 'regulation_updates', n_reg, 'escalated', n_esc, 'ran_at', now());
end $$;
revoke execute on function public.run_audit_agent_for(uuid, text) from public, anon, authenticated;

create or replace function public.run_audit_agent()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_leader() then raise exception 'Only the owner or director can run the agent'; end if;
  return run_audit_agent_for(my_centre_id(), 'app');
end $$;
grant execute on function public.run_audit_agent() to authenticated;

-- The daily schedule now runs both agents.
create or replace function public.run_staff_agent_all()
returns int language plpgsql security definer set search_path = public as $$
declare c record; n int := 0;
begin
  for c in select id from centres loop
    perform run_staff_agent_for(c.id, 'schedule');
    perform run_audit_agent_for(c.id, 'schedule');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.run_staff_agent_all() from public, anon, authenticated;

-- (The app runs the agent straight after the checklist is approved, and the daily schedule runs it every morning.)

-- ---------------------------------------------------------------------------
-- evidence: submit (assessed), verify or reject (owner), self-attested records
-- ---------------------------------------------------------------------------
create or replace function public._submit_evidence(p_item checklist_items, p_title text, p_file_name text, p_file_data text, p_file_path text,
  p_hash text, p_extracted jsonb, p_date date, p_source text, p_by uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ext jsonb := coalesce(p_extracted, '{}'); v_checks jsonb := '[]'; v_flag text; v_dup record; v_doc date; v_date date; v_exp date;
  v_id uuid; t audit_tasks; v_resolves boolean; v_readable boolean;
begin
  if coalesce(p_hash, '') <> '' then
    select e.id, e.status, e.created_at into v_dup from evidence e
     where e.checklist_item_id = p_item.id and e.file_hash = p_hash and e.status in ('pending', 'verified') order by e.created_at desc limit 1;
    if v_dup.id is not null then
      raise exception 'This file was already uploaded on % and is %.', _fmt_date(v_dup.created_at::date),
        case when v_dup.status = 'pending' then 'waiting for verification' else 'already verified' end;
    end if;
  end if;
  v_readable := coalesce((v_ext->>'readable')::boolean, false);
  v_doc := nullif(v_ext->>'document_date', '')::date;
  v_date := coalesce(p_date, v_doc);
  if not v_readable then
    v_checks := v_checks || jsonb_build_object('field', 'document', 'issue', 'unreadable', 'message', 'beehive couldn’t read this file. Check it’s the right document before verifying.');
  else
    if coalesce((v_ext->>'topic_match')::boolean, true) = false then
      v_checks := v_checks || jsonb_build_object('field', 'topic', 'issue', 'mismatch', 'message', 'This doesn’t look like ' || lower(p_item.evidence_hint) || '.');
    end if;
    if v_doc is null then
      v_checks := v_checks || jsonb_build_object('field', 'date', 'issue', 'missing', 'message', 'No date found in the document, so beehive can’t tell if it’s current.');
    end if;
  end if;
  if v_date is not null and v_date > _local_today() then
    v_checks := v_checks || jsonb_build_object('field', 'date', 'issue', 'future', 'message', 'The date (' || _fmt_date(v_date) || ') is in the future.');
  end if;
  if v_date is not null then
    v_exp := (v_date + make_interval(months => p_item.review_months))::date;
    if v_exp < current_date then
      v_checks := v_checks || jsonb_build_object('field', 'date', 'issue', 'out_of_date', 'message', 'Dated ' || _fmt_date(v_date) || ', so it expired on ' || _fmt_date(v_exp) || ' and wouldn’t close the gap.');
    end if;
  end if;
  if p_date is not null and v_doc is not null and p_date <> v_doc then
    v_checks := v_checks || jsonb_build_object('field', 'date', 'issue', 'differs', 'message', 'The date entered (' || _fmt_date(p_date) || ') differs from the date in the document (' || _fmt_date(v_doc) || ').');
  end if;
  if jsonb_typeof(v_ext->'uncertain') = 'array' then
    select v_checks || coalesce(jsonb_agg(jsonb_build_object('field', 'document', 'issue', 'uncertain', 'message', u)), '[]')
      into v_checks from jsonb_array_elements_text(v_ext->'uncertain') u;
  end if;
  v_flag := case when not v_readable then 'unreadable' when jsonb_array_length(v_checks) > 0 then 'needs_check' else 'clear' end;
  v_resolves := v_flag = 'clear' and v_date is not null and v_exp >= current_date;

  update evidence set status = 'superseded', review_note = 'Replaced by a newer upload' where checklist_item_id = p_item.id and status = 'pending';
  insert into evidence (centre_id, checklist_item_id, title, file_path, file_name, file_data, file_hash, recorded_on, uploaded_by, status, extracted, checks, review_flag, source, note)
  values (p_item.centre_id, p_item.id, coalesce(nullif(trim(p_title), ''), p_file_name, 'Evidence'), p_file_path, coalesce(p_file_name, ''), p_file_data, p_hash,
          coalesce(v_date, current_date), p_by, 'pending', v_ext, v_checks, v_flag, p_source,
          case when v_date is null then 'Date not confirmed' else '' end)
  returning id into v_id;

  select * into t from audit_tasks where checklist_item_id = p_item.id and kind = 'evidence' and state <> 'resolved';
  if t.id is null then
    insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state, evidence_id)
    values (p_item.centre_id, p_item.id, 'evidence', 'Verify evidence for ' || p_item.title, 'New evidence uploaded.', 'Check the uploaded evidence and verify or reject it.',
            'medium', 'owner_review', v_id) returning * into t;
  else
    update audit_tasks set state = 'owner_review', evidence_id = v_id, updated_at = now() where id = t.id;
  end if;
  perform _audit_event(p_item.centre_id, p_item.id, t.id, null, 'evidence_received', 'Owner review', 'Evidence received: ' || p_item.title,
    jsonb_build_object('evidence_id', v_id, 'source', p_source, 'file_name', p_file_name, 'date', v_date));
  perform _audit_event(p_item.centre_id, p_item.id, t.id, null, 'evidence_assessed', 'Owner review',
    case when v_resolves then 'Would close the gap once verified' when v_flag = 'unreadable' then 'Evidence unreadable: needs checking' else 'Evidence needs checking' end,
    jsonb_build_object('evidence_id', v_id, 'checks', v_checks, 'resolves', v_resolves, 'expires', v_exp));
  perform run_audit_agent_for(p_item.centre_id, 'evidence');
  return jsonb_build_object('id', v_id, 'flag', v_flag, 'checks', v_checks, 'resolves', v_resolves, 'expires', v_exp);
end $$;
revoke execute on function public._submit_evidence(checklist_items, text, text, text, text, text, jsonb, date, text, uuid) from public, anon, authenticated;

create or replace function public.submit_evidence(p_item uuid, p_title text, p_file_name text, p_file_data text default null, p_file_path text default null,
  p_hash text default null, p_extracted jsonb default '{}', p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ci checklist_items;
begin
  if not is_staff() then raise exception 'Only centre staff can add evidence'; end if;
  select * into ci from checklist_items where id = p_item and centre_id = my_centre_id() and is_active;
  if ci.id is null then raise exception 'Checklist item not found'; end if;
  if ci.evidence_kind <> 'document' then raise exception 'This requirement is checked from beehive’s own records, not from uploads.'; end if;
  if p_file_data is not null and length(p_file_data) > 4000000 then raise exception 'That file is too large. Use a PDF or photo under 3 MB.'; end if;
  return _submit_evidence(ci, p_title, p_file_name, p_file_data, p_file_path, p_hash, p_extracted, p_date, case when is_leader() then 'owner' else 'staff' end, auth.uid());
end $$;
grant execute on function public.submit_evidence(uuid, text, text, text, text, text, jsonb, date) to authenticated;

create or replace function public.evidence_request_info(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('first_name', split_part(s.full_name, ' ', 1), 'centre', c.name, 'item_id', ci.id, 'title', ci.title, 'evidence_hint', ci.evidence_hint,
           'source_ref', ci.source_ref, 'review_months', ci.review_months, 'item_key', ci.item_key, 'due_date', t.due_date,
           'pending', exists (select 1 from evidence e where e.checklist_item_id = ci.id and e.status = 'pending'))
  from audit_tasks t join checklist_items ci on ci.id = t.checklist_item_id join centres c on c.id = t.centre_id
  left join staff s on s.id = t.assignee_staff_id
  where t.upload_token = p_token and t.state <> 'resolved' and t.kind = 'evidence';
$$;
grant execute on function public.evidence_request_info(uuid) to anon, authenticated;

create or replace function public.submit_evidence_by_token(p_token uuid, p_title text, p_file_name text, p_file_data text,
  p_hash text default null, p_extracted jsonb default '{}', p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t audit_tasks; ci checklist_items; v_user uuid;
begin
  select * into t from audit_tasks where upload_token = p_token and state <> 'resolved' and kind = 'evidence';
  if t.id is null then raise exception 'This upload link has expired or the evidence is already verified.'; end if;
  if coalesce(p_file_data, '') = '' then raise exception 'Choose a photo or PDF first.'; end if;
  if length(p_file_data) > 4000000 then raise exception 'That file is too large. Use a PDF or photo under 3 MB.'; end if;
  select * into ci from checklist_items where id = t.checklist_item_id;
  select user_id into v_user from staff where id = t.assignee_staff_id;
  return _submit_evidence(ci, p_title, p_file_name, p_file_data, null, p_hash, p_extracted, p_date, 'link', v_user);
end $$;
grant execute on function public.submit_evidence_by_token(uuid, text, text, text, text, jsonb, date) to anon, authenticated;

-- Owner's decision on uploaded evidence.
create or replace function public.verify_evidence(p_evidence uuid, p_approve boolean, p_date date default null, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare e evidence; ci checklist_items; v_date date; v_exp date; t audit_tasks; v_before jsonb; v_after jsonb;
begin
  if not is_leader() then raise exception 'Only the owner or director can verify evidence'; end if;
  select * into e from evidence where id = p_evidence and centre_id = my_centre_id() for update;
  if e.id is null then raise exception 'Evidence not found'; end if;
  if e.status <> 'pending' then raise exception 'This evidence has already been %.', case e.status when 'verified' then 'verified' when 'rejected' then 'rejected' else 'replaced by a newer upload' end; end if;
  select * into ci from checklist_items where id = e.checklist_item_id;
  select * into t from audit_tasks where checklist_item_id = ci.id and kind = 'evidence' and state <> 'resolved';
  v_before := _requirement_status(ci.id);
  if p_approve then
    v_date := coalesce(p_date, e.recorded_on);
    if v_date is null then raise exception 'Enter the document date before verifying.'; end if;
    if v_date > _local_today() then raise exception 'The document date can’t be in the future.'; end if;
    v_exp := (v_date + make_interval(months => ci.review_months))::date;
    if v_exp < current_date then
      raise exception 'Evidence dated % expired on %, so it can’t make this requirement compliant. Reject it and ask for a current version.', _fmt_date(v_date), _fmt_date(v_exp);
    end if;
    update evidence set status = 'verified', recorded_on = v_date, verified_by = auth.uid(), verified_at = now(), review_note = coalesce(p_reason, '') where id = e.id;
    update checklist_items set last_reviewed_at = now(), reviewed_by = auth.uid() where id = ci.id;
    perform _complete_linked_task(ci.id, v_date, auth.uid(), 'Evidence verified: ' || e.title);
    -- an updated policy that the owner asked for after a guidance change closes that review
    if exists (select 1 from regulation_reviews rr where rr.checklist_item_id = ci.id and rr.decision = 'update_needed' and rr.completed_at is null) then
      update regulation_reviews set completed_at = now() where checklist_item_id = ci.id and decision = 'update_needed' and completed_at is null;
      if not exists (select 1 from regulation_reviews rr where rr.checklist_item_id = ci.id and (rr.decision is null or (rr.decision = 'update_needed' and rr.completed_at is null))) then
        update checklist_items set review_required = false, review_note = '' where id = ci.id;
      end if;
    end if;
    perform log_audit(ci.centre_id, 'evidence.verified', 'evidence', e.id::text, jsonb_build_object('checklist_item_id', ci.id, 'date', v_date, 'title', e.title));
    perform _audit_event(ci.centre_id, ci.id, t.id, null, 'evidence_verified', 'Resolved', 'Evidence verified: ' || ci.title,
      jsonb_build_object('evidence_id', e.id, 'date', v_date, 'valid_until', v_exp, 'verified_at', now()));
  else
    if coalesce(trim(p_reason), '') = '' then raise exception 'Say why the evidence is being rejected.'; end if;
    update evidence set status = 'rejected', review_note = p_reason, verified_by = auth.uid(), verified_at = now() where id = e.id;
    perform log_audit(ci.centre_id, 'evidence.rejected', 'evidence', e.id::text, jsonb_build_object('checklist_item_id', ci.id, 'reason', p_reason));
    perform _audit_event(ci.centre_id, ci.id, t.id, null, 'evidence_rejected', 'Action taken', 'Evidence rejected: ' || ci.title, jsonb_build_object('evidence_id', e.id, 'reason', p_reason));
    if t.id is not null then
      update audit_tasks set state = 'waiting', evidence_id = null, updated_at = now() where id = t.id;
      if t.assignee_staff_id is not null then perform _audit_send(t.id, 'correction', p_reason); end if;
    end if;
  end if;
  perform run_audit_agent_for(ci.centre_id, 'verification');
  v_after := _requirement_status(ci.id);
  return jsonb_build_object('approved', p_approve, 'before', v_before->>'status', 'after', v_after->>'status', 'valid_until', v_exp);
end $$;
grant execute on function public.verify_evidence(uuid, boolean, date, text) to authenticated;

-- The owner records something they did themselves (for example the drill they ran). Self-attested and recorded as theirs.
create or replace function public.record_evidence(p_item uuid, p_title text, p_date date, p_details jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare ci checklist_items; v_id uuid;
begin
  if not is_leader() then raise exception 'Only the owner or director can record evidence directly. Staff upload it for verification.'; end if;
  select * into ci from checklist_items where id = p_item and centre_id = my_centre_id() and is_active;
  if ci.id is null then raise exception 'Checklist item not found'; end if;
  if p_date is null or p_date > _local_today() then raise exception 'Enter the date it happened.'; end if;
  if (p_date + make_interval(months => ci.review_months))::date < current_date then raise exception 'That date is too old to count for this requirement.'; end if;
  update evidence set status = 'superseded', review_note = 'Replaced by an owner record' where checklist_item_id = ci.id and status = 'pending';
  insert into evidence (centre_id, checklist_item_id, title, recorded_on, uploaded_by, status, verified_by, verified_at, source, details, note)
  values (ci.centre_id, ci.id, p_title, p_date, auth.uid(), 'verified', auth.uid(), now(), 'owner_record', coalesce(p_details, '{}'), 'Recorded and attested by the owner')
  returning id into v_id;
  update checklist_items set last_reviewed_at = now(), reviewed_by = auth.uid() where id = ci.id;
  perform _audit_event(ci.centre_id, ci.id, null, null, 'evidence_recorded', 'Resolved', 'Recorded by you: ' || p_title, jsonb_build_object('evidence_id', v_id, 'date', p_date, 'details', p_details));
  perform run_audit_agent_for(ci.centre_id, 'evidence');
  return jsonb_build_object('id', v_id);
end $$;
grant execute on function public.record_evidence(uuid, text, date, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- regulation decisions (the owner confirms whether anything has to change)
-- ---------------------------------------------------------------------------
create or replace function public.decide_regulation_review(p_review uuid, p_decision text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare rr regulation_reviews; u regulation_updates; ci checklist_items; t audit_tasks; v_open int;
begin
  if not is_leader() then raise exception 'Only the owner or director can record this decision'; end if;
  if p_decision not in ('no_change', 'update_needed', 'not_applicable') then raise exception 'Unknown decision'; end if;
  select * into rr from regulation_reviews where id = p_review and centre_id = my_centre_id() for update;
  if rr.id is null then raise exception 'Review not found'; end if;
  if rr.decision is not null then raise exception 'You already recorded a decision for this.'; end if;
  select * into u from regulation_updates where id = rr.regulation_update_id;
  select * into ci from checklist_items where id = rr.checklist_item_id;
  update regulation_reviews set decision = p_decision, note = coalesce(p_note, ''), decided_by = auth.uid(), decided_at = now(),
    completed_at = case when p_decision = 'update_needed' then null else now() end where id = rr.id;
  update audit_tasks set state = 'resolved', resolved_at = now(), updated_at = now(),
    resolution = case p_decision when 'no_change' then 'Reviewed: no change needed' when 'not_applicable' then 'Doesn’t apply to this centre' else 'Policy needs updating' end
   where regulation_update_id = u.id and kind = 'regulation_review' and state <> 'resolved' and checklist_item_id is not distinct from rr.checklist_item_id;
  if ci.id is not null then
    if p_decision = 'update_needed' then
      update checklist_items set review_note = 'Update needed after “' || u.title || '”' where id = ci.id;
      select * into t from audit_tasks where checklist_item_id = ci.id and kind = 'evidence' and state <> 'resolved';
      if t.id is null then
        insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state, due_date, regulation_update_id)
        values (ci.centre_id, ci.id, 'evidence', 'Update ' || ci.title, 'You decided the policy needs updating after “' || u.title || '”.',
                'Update the policy, upload it and verify it. The requirement stays under review until then.', 'medium', 'waiting', current_date + 30, u.id);
      end if;
    elsif not exists (select 1 from regulation_reviews x where x.checklist_item_id = ci.id and x.id <> rr.id and (x.decision is null or (x.decision = 'update_needed' and x.completed_at is null))) then
      update checklist_items set review_required = false, review_note = '', last_reviewed_at = case when p_decision = 'no_change' then now() else last_reviewed_at end,
             reviewed_by = case when p_decision = 'no_change' then auth.uid() else reviewed_by end
       where id = ci.id;
    end if;
  end if;
  perform log_audit(u.centre_id, 'regulation_update.decision', 'regulation_reviews', rr.id::text,
    jsonb_build_object('update', u.title, 'item', ci.title, 'decision', p_decision, 'note', p_note));
  perform _audit_event(u.centre_id, ci.id, null, u.id, 'regulation_decision', case when p_decision = 'update_needed' then 'Waiting' else 'Resolved' end,
    case p_decision when 'no_change' then 'You confirmed no change needed: ' when 'not_applicable' then 'You marked as not applicable: ' else 'You decided an update is needed: ' end || coalesce(ci.title, u.title),
    jsonb_build_object('decision', p_decision, 'note', p_note, 'update', u.title));
  select count(*) into v_open from regulation_reviews where regulation_update_id = u.id and decision is null;
  if v_open = 0 then
    update regulation_updates set status = 'reviewed', reviewed_at = now() where id = u.id;
    perform _audit_event(u.centre_id, null, null, u.id, 'regulation_reviewed', 'Resolved', 'Regulation review recorded: ' || u.title, '{}');
  end if;
  perform run_audit_agent_for(u.centre_id, 'regulation_decision');
  return jsonb_build_object('decision', p_decision, 'update_status', case when v_open = 0 then 'reviewed' else 'assessed' end);
end $$;
grant execute on function public.decide_regulation_review(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- small owner actions
-- ---------------------------------------------------------------------------
create or replace function public.assign_audit_task(p_task uuid, p_staff uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare t audit_tasks; ci checklist_items;
begin
  if not is_leader() then raise exception 'Only the owner or director can assign tasks'; end if;
  select * into t from audit_tasks where id = p_task and centre_id = my_centre_id();
  if t.id is null or t.state = 'resolved' then raise exception 'This task is already complete.'; end if;
  if t.kind <> 'evidence' then raise exception 'Only evidence requests can be assigned.'; end if;
  if p_staff is not null and not exists (select 1 from staff where id = p_staff and centre_id = t.centre_id and is_active) then raise exception 'Staff member not found'; end if;
  update audit_tasks set assignee_staff_id = p_staff, escalated_at = null, requests_sent = 0, next_follow_up = null,
         state = case when evidence_id is not null then 'owner_review' else 'waiting' end, updated_at = now() where id = t.id;
  select * into ci from checklist_items where id = t.checklist_item_id;
  if p_staff is not null then perform _audit_send(t.id, 'request');
  else perform _audit_event(t.centre_id, ci.id, t.id, null, 'action_proposed', 'Waiting', 'Assigned to you: ' || ci.title, jsonb_build_object('proposed', true)); end if;
end $$;
grant execute on function public.assign_audit_task(uuid, uuid) to authenticated;

create or replace function public.audit_send_now(p_task uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t audit_tasks;
begin
  if not is_leader() then raise exception 'Only the owner or director can do this'; end if;
  select * into t from audit_tasks where id = p_task and centre_id = my_centre_id();
  if t.id is null or t.state = 'resolved' then raise exception 'This task is already complete.'; end if;
  if t.assignee_staff_id is null then raise exception 'Assign the task to a staff member first.'; end if;
  return _audit_send(t.id, case when t.requests_sent = 0 then 'request' else 'follow_up' end);
end $$;
grant execute on function public.audit_send_now(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- views for the interface
-- ---------------------------------------------------------------------------
create or replace view public.v_audit_tasks with (security_invoker = on) as
select t.*, ci.title as item_title, ci.item_key, ci.area, s.full_name as assignee_name, s.email as assignee_email, u.title as update_title,
       q.title as compliance_title, lm.sent_at as last_message_at, lm.channel as last_channel, lm.kind as last_kind
from public.audit_tasks t
left join public.checklist_items ci on ci.id = t.checklist_item_id
left join public.staff s on s.id = t.assignee_staff_id
left join public.regulation_updates u on u.id = t.regulation_update_id
left join public.compliance_records r on r.id = t.compliance_record_id
left join public.compliance_requirements q on q.id = r.requirement_id
left join lateral (select m.* from public.agent_messages m where m.audit_task_id = t.id order by m.sent_at desc limit 1) lm on true;
grant select on public.v_audit_tasks to authenticated;

drop view if exists public.v_agent_feed;
create view public.v_agent_feed with (security_invoker = on) as
select e.id, e.centre_id, e.agent, e.task_id, e.staff_id, e.kind, e.state, e.summary, e.detail, e.demo, e.created_at,
       s.full_name as staff_name, ct.code as type_code, ct.name as type_name,
       t.state as task_state, t.priority as task_priority, t.next_follow_up,
       e.checklist_item_id, ci.title as item_title, e.audit_task_id, at.state as audit_task_state, at.kind as audit_task_kind,
       e.regulation_update_id, ru.title as update_title
from public.agent_events e
left join public.staff s on s.id = e.staff_id
left join public.certificate_types ct on ct.id = e.certificate_type_id
left join public.credential_tasks t on t.id = e.task_id
left join public.checklist_items ci on ci.id = e.checklist_item_id
left join public.audit_tasks at on at.id = e.audit_task_id
left join public.regulation_updates ru on ru.id = e.regulation_update_id;
grant select on public.v_agent_feed to authenticated;
