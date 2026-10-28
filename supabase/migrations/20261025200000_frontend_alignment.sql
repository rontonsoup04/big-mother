-- Beehive: align the database with the web front end (beehive-demo/) and add the AI agent API.
-- Runs after 20261025100000_beehive.sql.

-- ===========================================================================
-- 1. Checklist: the front end's 12 items, summaries, "what needs attention", preview status
-- ===========================================================================
drop view if exists public.v_readiness;
drop view if exists public.v_checklist_status;

alter table public.checklist_items alter column evidence_kind drop default;
alter table public.checklist_items alter column evidence_kind type text using evidence_kind::text;
alter table public.checklist_items alter column evidence_kind set default 'document';
alter table public.checklist_items add constraint checklist_items_evidence_kind_check
  check (evidence_kind in ('document', 'certificates', 'incidents', 'compliance', 'medical', 'children'));
alter table public.checklist_items
  add column if not exists item_key text,                    -- stable key used by the front end, e.g. 'sun'
  add column if not exists summary text not null default '', -- plain-English requirement
  add column if not exists risk_note text not null default '', -- what to check when it's current
  add column if not exists icon text not null default '';
create unique index if not exists checklist_items_centre_key on public.checklist_items (centre_id, item_key) where item_key is not null and is_active;

alter table public.children add column if not exists emergency_contact text not null default '';
alter table public.staff add column if not exists room text not null default '';

-- Status for every active item (approved or still a draft), with the text the front end shows.
create view public.v_checklist_status with (security_invoker = true) as
with latest_evidence as (
  select distinct on (checklist_item_id) checklist_item_id, recorded_on, created_at, title, file_path
  from public.evidence order by checklist_item_id, recorded_on desc, created_at desc
)
select
  ci.id, ci.centre_id, ci.item_key, ci.area, ci.title, ci.source_ref, ci.evidence_hint, ci.evidence_kind,
  ci.summary, ci.risk_note, ci.icon, ci.review_required, ci.review_note,
  (ci.approved_at is not null) as approved,
  le.title as evidence_title, le.file_path as evidence_file, le.recorded_on as evidence_date,
  case when calc.status = 'green' and ci.review_required then 'yellow' else calc.status end as status,
  case
    when calc.status = 'green' and ci.review_required then coalesce(nullif(ci.review_note, ''), 'Review required after a guidance update')
    else calc.reason
  end as reason,
  calc.evidence_text,
  calc.last_updated
from public.checklist_items ci
left join latest_evidence le on le.checklist_item_id = ci.id
cross join lateral (
  select
    case ci.evidence_kind
      when 'document' then
        case
          when le.recorded_on is null then 'red'
          when (le.recorded_on + make_interval(months => ci.review_months))::date < current_date then 'red'
          when (le.recorded_on + make_interval(months => ci.review_months))::date <= current_date + least(30, greatest(5, ci.review_months * 7)) then 'yellow'
          else 'green'
        end
      when 'certificates' then
        case
          when not exists (select 1 from public.v_certificate_status v where v.centre_id = ci.centre_id and v.code = any (ci.cert_codes)) then 'red'
          when exists (select 1 from public.v_certificate_status v where v.centre_id = ci.centre_id and v.code = any (ci.cert_codes) and v.status = 'expired') then 'red'
          when exists (select 1 from public.v_certificate_status v where v.centre_id = ci.centre_id and v.code = any (ci.cert_codes) and v.status = 'expiring_soon') then 'yellow'
          else 'green'
        end
      when 'incidents' then
        case
          when exists (select 1 from public.v_incident_deadlines d where d.centre_id = ci.centre_id and (d.parent_status = 'overdue' or d.regulator_status = 'overdue')) then 'red'
          when exists (select 1 from public.v_incident_deadlines d where d.centre_id = ci.centre_id and (d.parent_status = 'pending' or d.regulator_status = 'pending')) then 'yellow'
          else 'green'
        end
      when 'compliance' then
        case
          when ci.compliance_requirement_id is null then 'red'
          when exists (select 1 from public.compliance_records r where r.requirement_id = ci.compliance_requirement_id and r.status = 'pending' and r.due_date < current_date) then 'red'
          when exists (select 1 from public.compliance_records r where r.requirement_id = ci.compliance_requirement_id and r.status = 'pending' and r.due_date <= current_date + 14) then 'yellow'
          else 'green'
        end
      when 'medical' then
        case
          when exists (select 1 from public.medical_updates m where m.centre_id = ci.centre_id and m.status = 'pending' and m.submitted_at < now() - interval '2 days') then 'red'
          when exists (select 1 from public.medical_updates m where m.centre_id = ci.centre_id and m.status = 'pending') then 'yellow'
          else 'green'
        end
      when 'children' then
        case
          when not exists (select 1 from public.children c where c.centre_id = ci.centre_id and c.is_active) then 'red'
          when exists (select 1 from public.children c where c.centre_id = ci.centre_id and c.is_active and trim(c.emergency_contact) = '') then 'red'
          else 'green'
        end
    end as status,
    case ci.evidence_kind
      when 'document' then
        case
          when le.recorded_on is null then 'No evidence on file. Upload the current document or log the date.'
          when (le.recorded_on + make_interval(months => ci.review_months))::date < current_date then 'Out of date: last recorded ' || to_char(le.recorded_on, 'DD Mon YYYY') || '. Upload a current version.'
          when (le.recorded_on + make_interval(months => ci.review_months))::date <= current_date + least(30, greatest(5, ci.review_months * 7)) then 'Due for review by ' || to_char((le.recorded_on + make_interval(months => ci.review_months))::date, 'DD Mon YYYY') || '.'
          else coalesce(nullif(ci.risk_note, ''), 'Evidence is current.')
        end
      when 'certificates' then coalesce(
        (select string_agg(v.staff_name || ' – ' || v.certificate_name || case when v.status = 'expired' then ' expired ' || to_char(v.expiry_date, 'DD Mon') else ' expires ' || to_char(v.expiry_date, 'DD Mon') end, '; ' order by v.expiry_date)
           from public.v_certificate_status v where v.centre_id = ci.centre_id and v.code = any (ci.cert_codes) and v.status <> 'valid'),
        case when exists (select 1 from public.v_certificate_status v where v.centre_id = ci.centre_id and v.code = any (ci.cert_codes))
             then coalesce(nullif(ci.risk_note, ''), 'All current on the staff certificate register.') else 'No certificates of this type on the register.' end)
      when 'incidents' then coalesce(
        (select string_agg(d.child_name || ': ' ||
                  case when d.regulator_status = 'overdue' then 'regulator notice overdue'
                       when d.parent_status = 'overdue' then 'parent notice overdue'
                       else 'notice due within 24 hours' end, '; ')
           from public.v_incident_deadlines d where d.centre_id = ci.centre_id and (d.parent_status in ('pending', 'overdue') or d.regulator_status in ('pending', 'overdue'))),
        coalesce(nullif(ci.risk_note, ''), 'All incident notices sent on time.'))
      when 'compliance' then 'From the compliance schedule.'
      when 'medical' then coalesce(
        (select count(*)::text || ' parent medical update(s) waiting for review.' from public.medical_updates m
          where m.centre_id = ci.centre_id and m.status = 'pending' having count(*) > 0),
        coalesce(nullif(ci.risk_note, ''), 'All medical updates reviewed.'))
      when 'children' then coalesce(
        (select count(*)::text || ' child record(s) missing an emergency contact.' from public.children c
          where c.centre_id = ci.centre_id and c.is_active and trim(c.emergency_contact) = '' having count(*) > 0),
        coalesce(nullif(ci.risk_note, ''), 'Records are complete.'))
    end as reason,
    case ci.evidence_kind
      when 'document' then coalesce(le.title, 'No evidence on file')
      when 'certificates' then 'Staff register · ' || (select count(distinct s.id) from public.staff s where s.centre_id = ci.centre_id and s.is_active) || ' staff records'
      when 'incidents' then 'Incident register · ' || (select count(*) from public.incidents i where i.centre_id = ci.centre_id) || ' records'
      when 'compliance' then 'Compliance schedule'
      when 'medical' then 'Children’s records · ' || (select count(distinct m.child_id) from public.medical_updates m where m.centre_id = ci.centre_id and m.status = 'approved') || ' medical profiles'
      when 'children' then (select count(*) from public.children c where c.centre_id = ci.centre_id and c.is_active) || ' active child records'
    end as evidence_text,
    case ci.evidence_kind
      when 'document' then le.created_at
      when 'certificates' then (select max(greatest(sc.created_at, coalesce(cs.reviewed_at, sc.created_at))) from public.staff_certificates sc join public.staff st on st.id = sc.staff_id
                                 left join public.certificate_submissions cs on cs.staff_id = st.id and cs.status = 'approved' where st.centre_id = ci.centre_id)
      when 'incidents' then (select max(i.created_at) from public.incidents i where i.centre_id = ci.centre_id)
      when 'compliance' then (select max(coalesce(r.completed_on::timestamptz, r.created_at)) from public.compliance_records r where r.requirement_id = ci.compliance_requirement_id)
      when 'medical' then (select max(coalesce(m.approved_at, m.submitted_at)) from public.medical_updates m where m.centre_id = ci.centre_id)
      when 'children' then (select max(c.created_at) from public.children c where c.centre_id = ci.centre_id)
    end as last_updated
) calc
where ci.is_active;

-- Readiness counts approved items only. Matches the front end: green = 1, yellow = 0.8, red = 0.
create view public.v_readiness with (security_invoker = true) as
select
  centre_id,
  count(*)::int as total_items,
  count(*) filter (where status = 'green')::int as green,
  count(*) filter (where status = 'yellow')::int as yellow,
  count(*) filter (where status = 'red')::int as red,
  case when count(*) = 0 then 0
       else round(100.0 * (count(*) filter (where status = 'green') + 0.8 * count(*) filter (where status = 'yellow')) / count(*))::int
  end as score
from public.v_checklist_status
where approved
group by centre_id;

-- The AI-suggested baseline (same 12 items as the front end). Internal, called by generate_checklist() and the demo seed.
create or replace function public._generate_checklist(p_centre uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into checklist_items (centre_id, item_key, area, title, source_ref, evidence_hint, evidence_kind, cert_codes, review_months, summary, risk_note, icon) values
    (p_centre, 'wwcc', 'staff_records', 'Current WWCC register', 'National Regulations · Reg. 145, 146', 'Working with Children Check number and expiry for every educator', 'certificates', '{WWCC}', 12,
     'Keep staff records current, including each educator’s Working With Children Check details and relevant record dates.', 'An officer may ask to verify the current status of staff checks.', '♙'),
    (p_centre, 'firstaid', 'staff_records', 'First Aid and CPR evidence', 'National Regulations · Reg. 136', 'Current first aid (HLTAID012) and CPR (HLTAID009) certificates', 'certificates', '{FIRST_AID,CPR}', 12,
     'Maintain current first-aid qualifications for the required number of educators and keep evidence available.', 'Confirm certificates remain current before each visit.', '✚'),
    (p_centre, 'training', 'staff_records', 'Staff qualification and training records', 'National Regulations · Reg. 145–147', 'Anaphylaxis, asthma, child protection training and qualifications', 'certificates', '{ANAPHYLAXIS,ASTHMA,CHILD_PROTECTION,QUALIFICATION}', 12,
     'Keep the required staff records and evidence of qualifications and relevant training accessible.', 'Check that staff files and role details match the centre’s current roster.', '▤'),
    (p_centre, 'enrolment', 'childrens_records', 'Children’s enrolment and contact records', 'National Regulations · Reg. 160–162', 'Enrolment record with parent contacts and emergency contact for every child', 'children', '{}', 12,
     'Keep each child’s enrolment, parent contact and authorised nominee information up to date.', 'Confirm records reflect recent family changes.', '♡'),
    (p_centre, 'incidents', 'childrens_records', 'Incident, injury, trauma and illness records', 'National Regulations · Reg. 87', 'Incident record with parent notified within 24 hours', 'incidents', '{}', 12,
     'Maintain records of incidents, injuries, trauma and illness, including the required details and notifications.', 'Be ready to show the records and associated follow-up.', '✎'),
    (p_centre, 'medical', 'childrens_records', 'Medical management and risk minimisation records', 'National Regulations · Reg. 90–91', 'Current, reviewed medical information for children with conditions', 'medical', '{}', 12,
     'Keep current medical management plans and risk minimisation plans where applicable.', 'Check that plans and supporting records are current.', '＋'),
    (p_centre, 'authorisations', 'childrens_records', 'Authorisations and child collection records', 'National Regulations · Reg. 99–102', 'Authorised nominee and collection records', 'document', '{}', 12,
     'Keep records of authorisations and collection arrangements required for each child.', 'Confirm staff can find the current authorised nominee information.', '⌂'),
    (p_centre, 'evacuation', 'safety_premises', 'Emergency evacuation drill logged this quarter', 'National Regulations · Reg. 97', 'Drill log dated within the last 3 months', 'document', '{}', 3,
     'Keep a record of emergency and evacuation rehearsals, including the date and relevant details.', 'Log each quarter’s drill before the next visit.', '⌁'),
    (p_centre, 'premises', 'safety_premises', 'Premises and safety checks', 'National Regulations · Reg. 103–115', 'Recent premises and equipment safety checklist', 'document', '{}', 1,
     'Maintain safe premises, equipment and facilities, with records of relevant checks and maintenance.', 'Keep the latest checks easy to retrieve.', '⌂'),
    (p_centre, 'emergency', 'safety_premises', 'Emergency contacts and procedures', 'National Regulations · Reg. 168, 170', 'Current emergency procedures and contacts on display', 'document', '{}', 12,
     'Keep required policies and procedures available and ensure staff know where to find them.', 'Confirm the displayed emergency information is still current.', '!'),
    (p_centre, 'sun', 'policies_procedures', 'Sun Protection Policy reviewed and current', 'National Regulations · Reg. 168 · NQS QA2', 'Reviewed policy with a review date in the last 12 months', 'document', '{}', 12,
     'A current policy should be in place for the service’s relevant health and safety practices. The centre should review its sun protection procedures against current guidance.', 'Keep the reviewed policy and its review date on file.', '☼'),
    (p_centre, 'sleep', 'policies_procedures', 'Sleep and rest policy review', 'National Regulations · Reg. 84A–84D · NQS QA2', 'Reviewed sleep and rest policy', 'document', '{}', 12,
     'Maintain sleep and rest policies and practices that reflect current requirements and guidance.', 'A guidance update may mean this policy needs another review.', '☾');
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public._generate_checklist(uuid) from public, anon, authenticated;

create or replace function public.generate_checklist()
returns integer language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); v_count int;
begin
  if not is_leader() then raise exception 'Only the owner or director can generate the checklist'; end if;
  if exists (select 1 from checklist_items where centre_id = v_centre and is_active) then
    raise exception 'A checklist already exists for this centre';
  end if;
  v_count := _generate_checklist(v_centre);
  perform log_audit(v_centre, 'checklist.generated', 'checklist_items', v_centre::text, jsonb_build_object('items', v_count));
  return v_count;
end $$;

-- Approve exactly the items the owner kept switched on.
create or replace function public.approve_checklist_selection(p_keep uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); v_count int;
begin
  if not is_leader() then raise exception 'Only the owner or director can approve the checklist'; end if;
  if coalesce(array_length(p_keep, 1), 0) < 4 then raise exception 'Keep at least four items in your centre baseline.'; end if;
  update checklist_items set is_active = false where centre_id = v_centre and is_active and not (id = any (p_keep));
  update checklist_items set approved_at = coalesce(approved_at, now()) where centre_id = v_centre and is_active;
  get diagnostics v_count = row_count;
  perform log_audit(v_centre, 'checklist.approved', 'checklist_items', v_centre::text, jsonb_build_object('items', v_count));
  return v_count;
end $$;

-- "Edit baseline": back to draft so the owner can change the selection.
create or replace function public.reopen_checklist()
returns void language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id();
begin
  if not is_leader() then raise exception 'Only the owner or director can edit the checklist'; end if;
  update checklist_items set approved_at = null where centre_id = v_centre and is_active;
  perform log_audit(v_centre, 'checklist.reopened', 'checklist_items', v_centre::text, '{}');
end $$;

-- ===========================================================================
-- 2. Staff certificates: 60 / 30 / 7-day reminder windows, expiry check, owner uploads on behalf
-- ===========================================================================
update public.certificate_types set reminder_days = 60 where expires;
alter table public.reminders add column if not exists window_days integer;

create or replace function public.schedule_reminders_for(p_cert uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_expiry date; v_expires boolean; w int; v_passed int;
begin
  select sc.expiry_date, ct.expires into v_expiry, v_expires
  from staff_certificates sc join certificate_types ct on ct.id = sc.certificate_type_id where sc.id = p_cert;
  update reminders set status = 'cancelled' where staff_certificate_id = p_cert and status = 'scheduled';
  if not v_expires or v_expiry is null then return; end if;
  foreach w in array array[60, 30, 7] loop
    if v_expiry - w >= current_date then
      insert into reminders (staff_certificate_id, channel, send_at, window_days)
      values (p_cert, 'email', (v_expiry - w)::timestamptz + interval '9 hours', w);
    elsif v_expiry >= current_date and v_passed is null then
      v_passed := w; -- most recent window already passed: prompt at the next expiry check
    end if;
  end loop;
  if v_passed is not null then
    select min(x) into v_passed from unnest(array[60, 30, 7]) x where v_expiry - x < current_date;
    insert into reminders (staff_certificate_id, channel, send_at, window_days) values (p_cert, 'email', now(), v_passed);
  end if;
end $$;
revoke execute on function public.schedule_reminders_for(uuid) from public, anon, authenticated;

create or replace function public.schedule_certificate_reminder() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.expiry_date is not distinct from old.expiry_date then return new; end if;
  perform schedule_reminders_for(new.id);
  return new;
end $$;

-- Re-plan reminders for certificates that already exist.
do $$ declare r record; begin
  for r in select id from public.staff_certificates loop perform public.schedule_reminders_for(r.id); end loop;
end $$;

-- "Run expiry check": sends every reminder that is due. Real SMS/email delivery plugs in here.
create or replace function public.run_expiry_check()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); v_sent int; v_staff int;
begin
  if not is_leader() then raise exception 'Only the owner or director can run the expiry check'; end if;
  with due as (
    update reminders r set status = 'sent', sent_at = now()
    from staff_certificates sc join staff s on s.id = sc.staff_id
    where r.staff_certificate_id = sc.id and s.centre_id = v_centre and s.is_active
      and r.status = 'scheduled' and r.send_at <= now()
    returning sc.staff_id
  )
  select count(*), count(distinct staff_id) into v_sent, v_staff from due;
  perform log_audit(v_centre, 'reminders.expiry_check', 'reminders', v_centre::text, jsonb_build_object('sent', v_sent, 'staff', v_staff));
  return jsonb_build_object('sent', v_sent, 'staff', v_staff);
end $$;

drop view if exists public.v_certificate_reminders;
create view public.v_certificate_reminders with (security_invoker = true) as
select v.*, s.room,
  nx.send_at as next_reminder_at, nx.window_days as next_window,
  ls.sent_at as last_prompt_at, ls.window_days as last_prompt_window,
  case
    when exists (select 1 from public.certificate_submissions cs where cs.staff_id = v.staff_id and cs.certificate_type_id = sc.certificate_type_id and cs.status = 'pending')
      then 'Renewal submitted · awaiting approval'
    when exists (select 1 from public.certificate_submissions cs where cs.staff_id = v.staff_id and cs.certificate_type_id = sc.certificate_type_id and cs.status = 'approved' and cs.reviewed_at > now() - interval '30 days')
      then 'Approved · next reminder 60 days before expiry'
    when v.status = 'expired' then 'Follow up required'
    when ls.sent_at is not null and v.status <> 'valid' then 'Renewal prompt sent · ' || ls.window_days || ' days'
    else ''
  end as alert_state,
  (select max(cs.reviewed_at) from public.certificate_submissions cs where cs.staff_id = v.staff_id and cs.certificate_type_id = sc.certificate_type_id and cs.status = 'approved') as verified_at
from public.v_certificate_status v
join public.staff_certificates sc on sc.id = v.id
join public.staff s on s.id = v.staff_id
left join lateral (select send_at, window_days from public.reminders r where r.staff_certificate_id = v.id and r.status = 'scheduled' order by send_at limit 1) nx on true
left join lateral (select sent_at, window_days from public.reminders r where r.staff_certificate_id = v.id and r.status = 'sent' order by sent_at desc limit 1) ls on true;

-- Educators submit their own; the owner can also submit on a staff member's behalf (front end "staff upload view").
drop function if exists public.submit_certificate(text, date, text, text, date, boolean);
create or replace function public.submit_certificate(p_type_code text, p_expiry date, p_file_path text default null,
  p_number text default '', p_issue date default null, p_extracted_by_ai boolean default false, p_staff_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_staff staff; v_type uuid; v_id uuid;
begin
  if p_staff_id is not null and is_leader() then
    select * into v_staff from staff where id = p_staff_id and centre_id = my_centre_id() and is_active;
  else
    select * into v_staff from staff where user_id = auth.uid() and is_active;
  end if;
  if v_staff.id is null then raise exception 'Staff record not found. Ask the director to add you to the staff register.'; end if;
  select id into v_type from certificate_types where code = upper(replace(p_type_code, ' ', '_'));
  if v_type is null then raise exception 'Unknown certificate type %', p_type_code; end if;
  if p_expiry is not null and p_expiry < current_date then raise exception 'That expiry date has already passed'; end if;
  insert into certificate_submissions (centre_id, staff_id, certificate_type_id, file_path, certificate_number, issue_date, expiry_date, extracted_by_ai, submitted_by)
  values (v_staff.centre_id, v_staff.id, v_type, p_file_path, coalesce(p_number, ''), p_issue, p_expiry, coalesce(p_extracted_by_ai, false), auth.uid())
  returning id into v_id;
  perform log_audit(v_staff.centre_id, 'certificate.submitted', 'certificate_submissions', v_id::text,
    jsonb_build_object('staff_id', v_staff.id, 'type', upper(p_type_code), 'expiry_date', p_expiry, 'on_behalf', p_staff_id is not null));
  return v_id;
end $$;
grant execute on function public.submit_certificate(text, date, text, text, date, boolean, uuid) to authenticated;

-- ===========================================================================
-- 3. Medical profile form (one form per update, like the front end)
-- ===========================================================================
alter table public.medical_updates alter column category drop not null;
alter table public.medical_updates alter column condition drop not null;
alter table public.medical_updates
  add column if not exists allergies text,
  add column if not exists conditions text,
  add column if not exists dietary text,
  add column if not exists medications text,
  add column if not exists care_notes text,
  add column if not exists emergency_contact text,
  add column if not exists signer_name text;

create or replace function public.on_medical_update_submitted() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_child children;
begin
  select * into v_child from children where id = new.child_id;
  perform log_audit(new.centre_id, 'medical_update.submitted', 'medical_updates', new.id::text,
    jsonb_build_object('child_id', new.child_id, 'signer', new.signer_name, 'category', new.category));
  if new.status = 'pending' then
    perform send_auto_message(new.child_id, 'receipt',
      'Thanks, ' || coalesce(nullif(new.signer_name, ''), 'we’ve got it') || '. We’ve received ' || v_child.first_name
      || '’s medical update and sent it to the centre team for review.', new.id);
  end if;
  return new;
end $$;

create or replace function public.review_medical_update(p_update uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_m medical_updates; v_child children;
begin
  if not is_leader() then raise exception 'Only the owner or director can approve medical updates'; end if;
  select * into v_m from medical_updates where id = p_update and centre_id = my_centre_id();
  if not found then raise exception 'Medical update not found'; end if;
  if v_m.status <> 'pending' then raise exception 'This update has already been reviewed'; end if;
  update medical_updates set status = case when p_approve then 'approved'::review_status else 'rejected' end,
    approved_by = auth.uid(), approved_at = now(), review_note = coalesce(p_note, '')
  where id = p_update;
  if p_approve and nullif(trim(coalesce(v_m.emergency_contact, '')), '') is not null then
    update children set emergency_contact = v_m.emergency_contact where id = v_m.child_id;
  end if;
  select * into v_child from children where id = v_m.child_id;
  perform log_audit(v_m.centre_id, case when p_approve then 'medical_update.approved' else 'medical_update.rejected' end,
    'medical_updates', p_update::text,
    jsonb_build_object('child_id', v_m.child_id, 'submitted_by', v_m.submitted_by, 'signer', v_m.signer_name,
                       'submitted_at', v_m.submitted_at, 'regulations', 'Reg 90, 162'));
  perform send_auto_message(v_m.child_id, 'receipt',
    case when p_approve
      then 'The centre has reviewed and acknowledged ' || v_child.first_name || '’s medical update. Room educators have the updated details. Please message us if anything changes.'
      else v_child.first_name || '’s medical update needs a change before we can accept it: ' || coalesce(nullif(p_note, ''), 'please contact the centre.') end,
    p_update);
end $$;

-- Current medical profile per child = latest approved form.
create view public.v_child_medical_profile with (security_invoker = true) as
select c.id as child_id, c.centre_id, c.first_name, c.last_name, c.room,
  m.id as update_id, m.allergies, m.conditions, m.dietary, m.medications, m.care_notes,
  coalesce(nullif(m.emergency_contact, ''), nullif(c.emergency_contact, '')) as emergency_contact,
  m.approved_at as reviewed_at
from public.children c
left join lateral (
  select * from public.medical_updates mu
  where mu.child_id = c.id and mu.status = 'approved' and mu.category is null
  order by mu.approved_at desc limit 1
) m on true
where c.is_active;

-- ===========================================================================
-- 4. Family thread: parent ↔ centre messages, receipts and approved AI messages in one conversation
-- ===========================================================================
create view public.v_family_thread with (security_invoker = true) as
select m.id, m.centre_id, m.child_id,
  case when u.role = 'parent' then 'parent' else 'centre' end as sender,
  u.full_name as sender_name, m.body, m.sent_at, 'message'::text as kind, false as drafted_by_ai
from public.messages m
left join public.users u on u.id = m.sender_id
union all
select p.id, p.centre_id, p.child_id, 'centre', 'Beehive', coalesce(p.translated_body, p.body), p.sent_at, p.trigger::text, p.drafted_by_ai
from public.parent_messages p
where p.status = 'sent';

-- ===========================================================================
-- 5. Regulation updates: new → accepted (items flagged) → reviewed
-- ===========================================================================
alter table public.regulation_updates
  add column if not exists status text not null default 'new' check (status in ('new', 'accepted', 'reviewed')),
  add column if not exists match_terms text[] not null default '{}',
  add column if not exists affected_summary text not null default '',
  add column if not exists accepted_at timestamptz,
  add column if not exists reviewed_at timestamptz;

create or replace function public.accept_regulation_update(p_update uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_u regulation_updates; v_count int;
begin
  if not is_leader() then raise exception 'Only the owner or director can accept updates'; end if;
  select * into v_u from regulation_updates where id = p_update and centre_id = my_centre_id();
  if not found then raise exception 'Update not found'; end if;
  update checklist_items ci set review_required = true, review_note = 'Review required: ' || v_u.title
  where ci.centre_id = v_u.centre_id and ci.is_active
    and exists (select 1 from unnest(v_u.match_terms) t where ci.title ilike '%' || t || '%' or ci.item_key = t);
  get diagnostics v_count = row_count;
  update regulation_updates set status = 'accepted', accepted_at = now() where id = p_update;
  perform log_audit(v_u.centre_id, 'regulation_update.accepted', 'regulation_updates', p_update::text,
    jsonb_build_object('title', v_u.title, 'items_flagged', v_count));
  return v_count;
end $$;

create or replace function public.complete_regulation_review(p_update uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_u regulation_updates;
begin
  if not is_leader() then raise exception 'Only the owner or director can complete reviews'; end if;
  select * into v_u from regulation_updates where id = p_update and centre_id = my_centre_id();
  if not found then raise exception 'Update not found'; end if;
  update checklist_items ci set review_required = false, review_note = ''
  where ci.centre_id = v_u.centre_id and ci.review_required
    and exists (select 1 from unnest(v_u.match_terms) t where ci.title ilike '%' || t || '%' or ci.item_key = t);
  update regulation_updates set status = 'reviewed', reviewed_at = now() where id = p_update;
  perform log_audit(v_u.centre_id, 'regulation_update.reviewed', 'regulation_updates', p_update::text, jsonb_build_object('title', v_u.title));
end $$;

-- ===========================================================================
-- 6. Spot-check search scoped to one centre (shared by the app and the AI agent)
-- ===========================================================================
create or replace function public._search(p_centre uuid, p_query text)
returns table (kind text, title text, detail text, status text, last_updated timestamptz, ref_id uuid)
language sql stable security definer set search_path = public as $$
  with qq as (select lower(trim(p_query)) as q)
  select 'certificate', v.certificate_name, v.staff_name || coalesce(' · ' || nullif(v.certificate_number, ''), '') || ' · expires ' || coalesce(to_char(v.expiry_date, 'DD Mon YYYY'), 'never'),
         v.status, sc.created_at, v.id
  from v_certificate_status v join staff_certificates sc on sc.id = v.id, qq
  where v.centre_id = p_centre and qq.q <> '' and (
       lower(v.certificate_name) like '%' || qq.q || '%' or lower(v.staff_name) like '%' || qq.q || '%' or lower(v.code) like '%' || qq.q || '%'
    or (qq.q like '%wwc%' or qq.q like '%working with children%') and v.code = 'WWCC'
    or qq.q like '%first aid%' and v.code in ('FIRST_AID', 'CPR')
    or qq.q like '%certific%' or qq.q like '%qualif%' or qq.q like '%staff%')
  union all
  select 'incident', 'Incident: ' || d.child_name, to_char(d.occurred_at at time zone 'Australia/Sydney', 'DD Mon YYYY') || ' · parent notice ' || d.parent_status
           || case when d.regulator_status <> 'not_required' then ' · regulator ' || d.regulator_status else '' end,
         case when d.parent_status = 'overdue' or d.regulator_status = 'overdue' then 'red' when d.parent_status = 'pending' or d.regulator_status = 'pending' then 'yellow' else 'green' end,
         i.created_at, d.id
  from v_incident_deadlines d join incidents i on i.id = d.id, qq
  where d.centre_id = p_centre and qq.q <> '' and (qq.q like '%incident%' or qq.q like '%injur%' or lower(d.child_name) like '%' || qq.q || '%' or lower(i.description) like '%' || qq.q || '%')
  union all
  select 'checklist', c.title, c.source_ref || ' · ' || coalesce(c.evidence_text, ''), c.status, c.last_updated, c.id
  from v_checklist_status c, qq
  where c.centre_id = p_centre and qq.q <> '' and (lower(c.title) like '%' || qq.q || '%' or lower(c.source_ref) like '%' || qq.q || '%'
        or lower(c.evidence_hint) like '%' || qq.q || '%' or lower(c.area::text) like '%' || replace(qq.q, ' ', '_') || '%' or lower(coalesce(c.evidence_title, '')) like '%' || qq.q || '%')
  union all
  select 'medical', p.first_name || ' ' || p.last_name || ': medical profile', concat_ws(' · ', nullif(p.allergies, ''), nullif(p.conditions, ''), nullif(p.room, '')), 'green', p.reviewed_at, p.child_id
  from v_child_medical_profile p, qq
  where p.centre_id = p_centre and p.update_id is not null and qq.q <> ''
    and (qq.q like '%medic%' or qq.q like '%allerg%' or qq.q like '%action plan%' or lower(coalesce(p.allergies, '') || ' ' || coalesce(p.conditions, '')) like '%' || qq.q || '%' or lower(p.first_name) like '%' || qq.q || '%')
  order by 5 desc nulls last
  limit 50;
$$;
revoke execute on function public._search(uuid, text) from public, anon, authenticated;

create or replace function public.spot_check_search(p_query text)
returns table (kind text, title text, detail text, status text, last_updated timestamptz, ref_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then return; end if;
  return query select * from _search(my_centre_id(), p_query);
end $$;

-- ===========================================================================
-- 7. AI agent API (the Gemini functions in beehive-demo/api call these over HTTPS with the centre's agent key)
-- ===========================================================================
create table if not exists public.agent_keys (
  centre_id   uuid primary key references public.centres (id) on delete cascade,
  key_hash    text not null,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.agent_keys enable row level security;  -- no policies: only the functions below touch it

create or replace function public.create_agent_key()
returns text language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); v_key text;
begin
  if not is_leader() then raise exception 'Only the owner or director can create the AI agent key'; end if;
  v_key := 'bh_' || md5(random()::text || clock_timestamp()::text) || md5(random()::text || v_centre::text);
  insert into agent_keys (centre_id, key_hash, created_by) values (v_centre, encode(sha256(convert_to(v_key, 'UTF8')), 'hex'), auth.uid())
  on conflict (centre_id) do update set key_hash = excluded.key_hash, created_by = excluded.created_by, created_at = now();
  perform log_audit(v_centre, 'agent_key.created', 'agent_keys', v_centre::text, '{}');
  return v_key;   -- shown once; paste it into Vercel as BEEHIVE_AGENT_KEY
end $$;

create or replace function public._agent_centre(p_key text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid;
begin
  select centre_id into v_centre from agent_keys where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
  if v_centre is null then raise exception 'Invalid Beehive agent key'; end if;
  return v_centre;
end $$;
revoke execute on function public._agent_centre(text) from public, anon, authenticated;

-- Readiness, every checklist item and the top gaps.
create or replace function public.agent_readiness(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key);
begin
  return jsonb_build_object(
    'centre', (select name from centres where id = v_centre),
    'today', to_char(current_date, 'DD Mon YYYY'),
    'checklist_approved', exists (select 1 from checklist_items where centre_id = v_centre and is_active and approved_at is not null),
    'readiness', (select to_jsonb(r) - 'centre_id' from v_readiness r where r.centre_id = v_centre),
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', c.title, 'area', c.area, 'status', c.status, 'source', c.source_ref,
                        'what_it_requires', c.summary, 'what_needs_attention', c.reason, 'evidence', c.evidence_text,
                        'last_updated', to_char(c.last_updated at time zone 'Australia/Sydney', 'DD Mon YYYY'))
                        order by case c.status when 'red' then 0 when 'yellow' then 1 else 2 end, c.area, c.title)
                      from v_checklist_status c where c.centre_id = v_centre), '[]'::jsonb),
    'pending_medical_updates', (select count(*) from medical_updates where centre_id = v_centre and status = 'pending'),
    'pending_certificate_submissions', (select count(*) from certificate_submissions where centre_id = v_centre and status = 'pending'),
    'new_regulation_updates', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'summary', summary, 'status', status, 'published_on', published_on))
                               from regulation_updates where centre_id = v_centre and status <> 'reviewed'), '[]'::jsonb)
  );
end $$;

-- Spot-check search for an authorised officer's request.
create or replace function public.agent_search(p_key text, p_query text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('kind', s.kind, 'title', s.title, 'detail', s.detail, 'status', s.status,
                     'last_updated', to_char(s.last_updated at time zone 'Australia/Sydney', 'DD Mon YYYY')))
                   from _search(v_centre, p_query) s), '[]'::jsonb);
end $$;

-- Staff certificates that are expired or due within 60 days.
create or replace function public.agent_certificates(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('staff', v.staff_name, 'room', v.room, 'certificate', v.certificate_name,
                     'expiry', to_char(v.expiry_date, 'DD Mon YYYY'), 'days_left', v.days_until_expiry, 'status', v.status, 'alert', v.alert_state)
                     order by v.expiry_date)
                   from v_certificate_reminders v where v.centre_id = v_centre and v.status <> 'valid'), '[]'::jsonb);
end $$;

-- Children the agent may write about (names and rooms only, no medical data).
create or replace function public.agent_children(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('name', first_name || ' ' || last_name, 'room', room) order by first_name)
                   from children where centre_id = v_centre and is_active), '[]'::jsonb);
end $$;

-- The agent drafts a message to a child's family. It is NOT sent: staff approve it in Beehive.
create or replace function public.agent_draft_parent_message(p_key text, p_child_name text, p_body text,
  p_trigger text default 'manual', p_staff_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key); v_child children; v_id uuid; v_matches int;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'The message is empty'; end if;
  select count(*) into v_matches from children
   where centre_id = v_centre and is_active
     and (lower(first_name || ' ' || last_name) = lower(trim(p_child_name)) or lower(first_name) = lower(trim(p_child_name)));
  if v_matches = 0 then raise exception 'No child called % at this centre', p_child_name; end if;
  if v_matches > 1 then raise exception 'More than one child is called %. Use their full name.', p_child_name; end if;
  select * into v_child from children
   where centre_id = v_centre and is_active
     and (lower(first_name || ' ' || last_name) = lower(trim(p_child_name)) or lower(first_name) = lower(trim(p_child_name)));
  insert into parent_messages (centre_id, child_id, trigger, staff_note, body, drafted_by_ai, status)
  values (v_centre, v_child.id,
          case when p_trigger in ('manual', 'incident', 'daily_summary', 'medical', 'document_request') then p_trigger::message_trigger else 'manual' end,
          coalesce(p_staff_note, ''), trim(p_body), true, 'draft')
  returning id into v_id;
  perform log_audit(v_centre, 'parent_message.ai_drafted', 'parent_messages', v_id::text,
    jsonb_build_object('child_id', v_child.id, 'by', 'AI agent'));
  return jsonb_build_object('draft_id', v_id, 'child', v_child.first_name || ' ' || v_child.last_name,
                            'status', 'Saved as a draft. A staff member must approve it in Beehive before the family sees it.');
end $$;

-- The agent records a regulation or guidance change; the owner accepts it in Beehive.
create or replace function public.agent_add_regulation_update(p_key text, p_title text, p_summary text, p_match_terms text[], p_source_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key); v_id uuid;
begin
  insert into regulation_updates (centre_id, title, summary, source_url, match_terms, status)
  values (v_centre, p_title, p_summary, p_source_url, coalesce(p_match_terms, '{}'), 'new')
  returning id into v_id;
  perform log_audit(v_centre, 'regulation_update.ai_added', 'regulation_updates', v_id::text, jsonb_build_object('title', p_title));
  return jsonb_build_object('id', v_id, 'status', 'Added. The owner will review and accept it in Beehive.');
end $$;

grant execute on function public.agent_readiness(text) to anon, authenticated;
grant execute on function public.agent_search(text, text) to anon, authenticated;
grant execute on function public.agent_certificates(text) to anon, authenticated;
grant execute on function public.agent_children(text) to anon, authenticated;
grant execute on function public.agent_draft_parent_message(text, text, text, text, text) to anon, authenticated;
grant execute on function public.agent_add_regulation_update(text, text, text, text[], text) to anon, authenticated;
grant execute on function public.create_agent_key() to authenticated;
grant execute on function public.approve_checklist_selection(uuid[]) to authenticated;
grant execute on function public.reopen_checklist() to authenticated;
grant execute on function public.run_expiry_check() to authenticated;
grant execute on function public.accept_regulation_update(uuid) to authenticated;
grant execute on function public.complete_regulation_review(uuid) to authenticated;
grant execute on function public.spot_check_search(text) to authenticated;
grant execute on function public.generate_checklist() to authenticated;
