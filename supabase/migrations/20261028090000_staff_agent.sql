-- beehive staff compliance agent
-- A monitoring and action loop for staff credentials that runs without the owner:
-- detect -> prioritise -> request (simulated email/SMS) -> wait -> follow up -> process upload
-- -> owner verification -> update record -> resolve, escalating anything critical.
--
-- Priority, used everywhere (database and interface):
--   critical  expired or missing
--   high      expires within 7 days
--   medium    expires within 30 days
--   monitor   expires within the reminder window (60 days)
--
-- Task states: monitoring, waiting (request out), owner_review (upload or escalation needs the
-- owner), resolved. Every step is written to agent_events (the activity feed) and audit_log.
-- Messages are SIMULATED: they are recorded with recipient and timestamp but nothing leaves beehive.

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
create table if not exists public.credential_tasks (
  id                   uuid primary key default gen_random_uuid(),
  centre_id            uuid not null references public.centres (id) on delete cascade,
  staff_id             uuid not null references public.staff (id) on delete cascade,
  certificate_type_id  uuid not null references public.certificate_types (id),
  priority             text not null check (priority in ('critical', 'high', 'medium', 'monitor')),
  state                text not null default 'monitoring' check (state in ('monitoring', 'waiting', 'owner_review', 'resolved')),
  reason               text not null default '',
  expiry_date          date,
  requests_sent        int not null default 0,
  last_request_at      timestamptz,
  next_follow_up       date,
  escalated_at         timestamptz,
  escalation_reason    text,
  recommended_action   text,
  escalation_ack_at    timestamptz,
  upload_token         uuid not null default gen_random_uuid(),
  opened_at            timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  resolved_at          timestamptz,
  resolution           text
);
create unique index if not exists credential_tasks_open_idx on public.credential_tasks (staff_id, certificate_type_id) where state <> 'resolved';
create unique index if not exists credential_tasks_token_idx on public.credential_tasks (upload_token);
create index if not exists credential_tasks_centre_idx on public.credential_tasks (centre_id, state);

create table if not exists public.agent_messages (
  id           uuid primary key default gen_random_uuid(),
  centre_id    uuid not null references public.centres (id) on delete cascade,
  task_id      uuid references public.credential_tasks (id) on delete cascade,
  staff_id     uuid not null references public.staff (id) on delete cascade,
  kind         text not null check (kind in ('request', 'follow_up', 'correction')),
  channel      text not null check (channel in ('email', 'sms', 'none')),
  recipient    text not null default '',
  subject      text not null default '',
  body         text not null,
  upload_link  text not null default '',
  outcome      text not null default 'simulated' check (outcome in ('simulated', 'no_contact')),
  sent_at      timestamptz not null default now(),
  next_follow_up date
);
create index if not exists agent_messages_staff_idx on public.agent_messages (staff_id, sent_at desc);

create table if not exists public.agent_events (
  id                   bigint generated always as identity primary key,
  centre_id            uuid not null references public.centres (id) on delete cascade,
  task_id              uuid references public.credential_tasks (id) on delete cascade,
  staff_id             uuid references public.staff (id) on delete cascade,
  certificate_type_id  uuid references public.certificate_types (id),
  kind                 text not null,   -- detected, reprioritised, request_sent, follow_up_sent, upload_received, flagged,
                                        -- approved, rejected, correction_requested, record_updated, escalated,
                                        -- escalation_acknowledged, resolved, no_contact
  state                text not null check (state in ('Monitoring', 'Action taken', 'Waiting', 'Owner review', 'Resolved')),
  summary              text not null,
  detail               jsonb not null default '{}',
  demo                 boolean not null default false,
  created_at           timestamptz not null default now()
);
create index if not exists agent_events_centre_idx on public.agent_events (centre_id, created_at desc);

create table if not exists public.agent_runs (
  id          bigint generated always as identity primary key,
  centre_id   uuid not null references public.centres (id) on delete cascade,
  trigger     text not null default 'app',
  ran_at      timestamptz not null default now(),
  summary     jsonb not null default '{}'
);
create index if not exists agent_runs_centre_idx on public.agent_runs (centre_id, ran_at desc);

-- uploaded certificates: what was extracted and what the checks found
alter table public.certificate_submissions add column if not exists file_name   text not null default '';
alter table public.certificate_submissions add column if not exists file_data   text;          -- small data URL when uploaded through a request link
alter table public.certificate_submissions add column if not exists file_hash   text;
alter table public.certificate_submissions add column if not exists extracted   jsonb not null default '{}';
alter table public.certificate_submissions add column if not exists checks      jsonb not null default '[]';
alter table public.certificate_submissions add column if not exists review_flag text not null default 'clear';
alter table public.certificate_submissions add column if not exists task_id     uuid references public.credential_tasks (id) on delete set null;
alter table public.certificate_submissions add column if not exists source      text not null default 'app';

alter table public.staff add column if not exists phone text not null default '';

-- ---------------------------------------------------------------------------
-- security: owners and directors see everything for their centre; educators see their own
-- ---------------------------------------------------------------------------
alter table public.credential_tasks enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_events enable row level security;
alter table public.agent_runs enable row level security;
drop policy if exists "leaders read tasks" on public.credential_tasks;
create policy "leaders read tasks" on public.credential_tasks for select using (centre_id = public.my_centre_id() and public.is_leader());
drop policy if exists "educators read own tasks" on public.credential_tasks;
create policy "educators read own tasks" on public.credential_tasks for select
  using (exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));
drop policy if exists "leaders read messages" on public.agent_messages;
create policy "leaders read messages" on public.agent_messages for select using (centre_id = public.my_centre_id() and public.is_leader());
drop policy if exists "educators read own messages" on public.agent_messages;
create policy "educators read own messages" on public.agent_messages for select
  using (exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));
drop policy if exists "leaders read events" on public.agent_events;
create policy "leaders read events" on public.agent_events for select using (centre_id = public.my_centre_id() and public.is_leader());
drop policy if exists "leaders read runs" on public.agent_runs;
create policy "leaders read runs" on public.agent_runs for select using (centre_id = public.my_centre_id() and public.is_leader());
grant select on public.credential_tasks, public.agent_messages, public.agent_events, public.agent_runs to authenticated;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.cert_priority(p_days int, p_missing boolean default false)
returns text language sql immutable as $$
  select case when p_missing or p_days < 0 then 'critical'
              when p_days <= 7 then 'high'
              when p_days <= 30 then 'medium'
              else 'monitor' end;
$$;
grant execute on function public.cert_priority(int, boolean) to anon, authenticated;

create or replace function public._prio_rank(p text) returns int language sql immutable as $$
  select case p when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end;
$$;

create or replace function public._follow_up_days(p text) returns int language sql immutable as $$
  select case p when 'critical' then 1 when 'high' then 2 when 'medium' then 5 else 14 end;
$$;

create or replace function public._agent_event(p_centre uuid, p_task uuid, p_staff uuid, p_type uuid, p_kind text, p_state text,
  p_summary text, p_detail jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into agent_events (centre_id, task_id, staff_id, certificate_type_id, kind, state, summary, detail)
  values (p_centre, p_task, p_staff, p_type, p_kind, p_state, p_summary, coalesce(p_detail, '{}'));
  perform log_audit(p_centre, 'agent.' || p_kind, 'credential_tasks', coalesce(p_task::text, ''),
    coalesce(p_detail, '{}') || jsonb_build_object('staff_id', p_staff, 'summary', p_summary));
end $$;
revoke execute on function public._agent_event(uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public._fmt_date(d date) returns text language sql immutable as $$
  select trim(to_char(d, 'FMDD Mon YYYY'));
$$;

-- Send (simulate) a renewal request, follow-up or correction request for a task.
create or replace function public._agent_send(p_task uuid, p_kind text, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t credential_tasks; s staff; ct certificate_types; c centres; v_channel text; v_recipient text; v_body text; v_subject text;
  v_first text; v_deadline text; v_link text; v_next date; v_id uuid; v_owner text;
begin
  select * into t from credential_tasks where id = p_task;
  select * into s from staff where id = t.staff_id;
  select * into ct from certificate_types where id = t.certificate_type_id;
  select * into c from centres where id = t.centre_id;
  select coalesce(u.full_name, 'the centre owner') into v_owner from users u where u.centre_id = t.centre_id and u.role = 'owner' limit 1;
  v_first := split_part(s.full_name, ' ', 1);
  v_link := '/#upload/' || t.upload_token;
  v_deadline := case when t.expiry_date is null then 'as soon as possible'
                     when t.expiry_date < current_date then 'now (it expired on ' || _fmt_date(t.expiry_date) || ')'
                     else 'before ' || _fmt_date(t.expiry_date) end;
  if coalesce(s.email, '') <> '' then v_channel := 'email'; v_recipient := s.email;
  elsif coalesce(s.phone, '') <> '' then v_channel := 'sms'; v_recipient := s.phone;
  else v_channel := 'none'; v_recipient := ''; end if;
  v_subject := case p_kind when 'request' then 'Please renew your ' || ct.name
                           when 'follow_up' then 'Reminder: your ' || ct.name || ' renewal'
                           else 'Please upload your ' || ct.name || ' again' end;
  v_body := 'Hi ' || v_first || ', ' ||
    case p_kind
      when 'request' then case when t.expiry_date is null then 'we don’t have a ' || ct.name || ' on file for you.'
                               when t.expiry_date < current_date then 'your ' || ct.name || ' expired on ' || _fmt_date(t.expiry_date) || '.'
                               else 'your ' || ct.name || ' expires on ' || _fmt_date(t.expiry_date) || '.' end ||
                          ' Please upload your renewed certificate ' ||
                          case when t.expiry_date >= current_date then 'before it expires' else v_deadline end || ' using your secure link.'
      when 'follow_up' then 'we haven’t received your renewed ' || ct.name || ' yet. Please upload it ' || v_deadline || ' using your secure link.'
      else 'we couldn’t accept the certificate you uploaded' || case when p_note <> '' then ' (' || p_note || ')' else '' end ||
           '. Please upload a clear copy of your current ' || ct.name || ' using your secure link.'
    end || ' Thanks, ' || split_part(v_owner, ' ', 1) || ', ' || c.name || '.';
  v_next := current_date + _follow_up_days(t.priority);
  insert into agent_messages (centre_id, task_id, staff_id, kind, channel, recipient, subject, body, upload_link, outcome, next_follow_up)
  values (t.centre_id, t.id, t.staff_id, p_kind, v_channel, v_recipient, v_subject, v_body, v_link,
          case when v_channel = 'none' then 'no_contact' else 'simulated' end, v_next)
  returning id into v_id;
  update credential_tasks set requests_sent = requests_sent + 1, last_request_at = now(), next_follow_up = v_next,
         state = case when state = 'owner_review' then state else 'waiting' end, updated_at = now()
   where id = t.id;
  perform _agent_event(t.centre_id, t.id, t.staff_id, t.certificate_type_id,
    case p_kind when 'request' then 'request_sent' when 'follow_up' then 'follow_up_sent' else 'correction_requested' end,
    'Action taken',
    case p_kind when 'request' then 'Renewal request sent' when 'follow_up' then 'Follow-up sent' else 'Corrected upload requested' end,
    jsonb_build_object('message_id', v_id, 'channel', v_channel, 'recipient', v_recipient, 'simulated', true, 'next_follow_up', v_next));
  return v_id;
end $$;
revoke execute on function public._agent_send(uuid, text, text) from public, anon, authenticated;

create or replace function public._escalate(p_task uuid, p_reason text, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare t credential_tasks;
begin
  select * into t from credential_tasks where id = p_task;
  update credential_tasks set escalated_at = now(), escalation_reason = p_reason, recommended_action = p_action,
         escalation_ack_at = null, state = 'owner_review', updated_at = now()
   where id = p_task;
  perform _agent_event(t.centre_id, t.id, t.staff_id, t.certificate_type_id, 'escalated', 'Owner review',
    'Escalated to you', jsonb_build_object('reason', p_reason, 'recommended_action', p_action));
end $$;
revoke execute on function public._escalate(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- the loop
-- ---------------------------------------------------------------------------
create or replace function public.run_staff_agent_for(p_centre uuid, p_trigger text default 'app')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record; t credential_tasks; v_prio text; v_days int; v_reason text; v_pending boolean;
  n_detected int := 0; n_requests int := 0; n_followups int := 0; n_escalated int := 0; n_resolved int := 0; n_reprio int := 0;
  v_window int;
begin
  for r in
    select s.id as staff_id, s.full_name, s.email, s.phone, ct.id as type_id, ct.code, ct.name as type_name, ct.reminder_days,
           sc.id as cert_id, sc.expiry_date
    from staff s
    cross join certificate_types ct
    left join lateral (select x.* from staff_certificates x where x.staff_id = s.id and x.certificate_type_id = ct.id
                       order by x.expiry_date desc nulls last limit 1) sc on true
    where s.centre_id = p_centre and s.is_active and s.position not ilike '%owner%' and ct.code = any (_required_cert_codes())
  loop
    v_window := greatest(coalesce(r.reminder_days, 60), 60);
    v_days := case when r.expiry_date is null then null else r.expiry_date - current_date end;
    select * into t from credential_tasks where staff_id = r.staff_id and certificate_type_id = r.type_id and state <> 'resolved';
    v_pending := exists (select 1 from certificate_submissions cs where cs.staff_id = r.staff_id and cs.certificate_type_id = r.type_id and cs.status = 'pending');

    -- nothing to do: current beyond the reminder window
    if r.cert_id is not null and v_days > v_window then
      if t.id is not null and not v_pending then
        update credential_tasks set state = 'resolved', resolved_at = now(), resolution = 'Credential current', updated_at = now() where id = t.id;
        perform _agent_event(p_centre, t.id, r.staff_id, r.type_id, 'resolved', 'Resolved', 'Renewal complete',
          jsonb_build_object('expiry_date', r.expiry_date));
        n_resolved := n_resolved + 1;
      end if;
      continue;
    end if;

    v_prio := cert_priority(coalesce(v_days, -1), r.cert_id is null);
    v_reason := case when r.cert_id is null then 'No ' || r.type_name || ' on file'
                     when v_days < 0 then 'Expired ' || _fmt_date(r.expiry_date)
                     when v_days = 0 then 'Expires today'
                     else 'Expires in ' || v_days || ' day' || case when v_days = 1 then '' else 's' end || ' (' || _fmt_date(r.expiry_date) || ')' end;

    -- detect
    if t.id is null then
      insert into credential_tasks (centre_id, staff_id, certificate_type_id, priority, state, reason, expiry_date)
      values (p_centre, r.staff_id, r.type_id, v_prio, case when v_pending then 'owner_review' else 'monitoring' end, v_reason, r.expiry_date)
      returning * into t;
      perform _agent_event(p_centre, t.id, r.staff_id, r.type_id, 'detected', 'Monitoring',
        initcap(v_prio) || ' priority detected', jsonb_build_object('priority', v_prio, 'reason', v_reason));
      n_detected := n_detected + 1;
    else
      if _prio_rank(v_prio) > _prio_rank(t.priority) then
        perform _agent_event(p_centre, t.id, r.staff_id, r.type_id, 'reprioritised', 'Monitoring',
          'Priority raised to ' || v_prio, jsonb_build_object('from', t.priority, 'to', v_prio, 'reason', v_reason));
        n_reprio := n_reprio + 1;
        -- more urgent now: follow up today rather than waiting for the old date
        update credential_tasks set next_follow_up = least(coalesce(next_follow_up, current_date), current_date) where id = t.id and requests_sent > 0;
      end if;
      update credential_tasks set priority = v_prio, reason = v_reason, expiry_date = r.expiry_date, updated_at = now() where id = t.id;
      select * into t from credential_tasks where id = t.id;
    end if;

    -- an upload is waiting for the owner: nothing else to send
    if v_pending then
      if t.state <> 'owner_review' then update credential_tasks set state = 'owner_review', updated_at = now() where id = t.id; end if;
      continue;
    end if;

    -- act: first request for anything that is not just being monitored
    if v_prio <> 'monitor' and t.requests_sent = 0 then
      perform _agent_send(t.id, 'request');
      n_requests := n_requests + 1;
      select * into t from credential_tasks where id = t.id;
      if coalesce(r.email, '') = '' and coalesce(r.phone, '') = '' and t.escalated_at is null then
        perform _escalate(t.id, 'No email or mobile number on file, so ' || split_part(r.full_name, ' ', 1) || ' can’t be contacted.',
          'Add contact details to the staff record, or give ' || split_part(r.full_name, ' ', 1) || ' the upload link in person.');
        n_escalated := n_escalated + 1;
      end if;
    -- follow up when the date passes with no upload
    elsif t.requests_sent > 0 and t.next_follow_up is not null and t.next_follow_up <= current_date and t.state <> 'resolved' then
      perform _agent_send(t.id, 'follow_up');
      n_followups := n_followups + 1;
      select * into t from credential_tasks where id = t.id;
    end if;

    -- escalate what needs the owner's judgement
    if t.escalated_at is null then
      if v_prio = 'critical' then
        perform _escalate(t.id,
          case when r.cert_id is null then split_part(r.full_name, ' ', 1) || ' has no ' || r.type_name || ' on file.'
               else split_part(r.full_name, ' ', 1) || '''s ' || r.type_name || ' expired on ' || _fmt_date(r.expiry_date) || '.' end,
          case r.code
            when 'WWCC' then 'Stop ' || split_part(r.full_name, ' ', 1) || ' working with children until a current Check is verified with the Office of the Children’s Guardian.'
            when 'FIRST_AID' then 'Don’t count ' || split_part(r.full_name, ' ', 1) || ' towards first aid cover (Reg. 136). Check the roster has another qualified educator on every shift.'
            when 'CPR' then 'Don’t count ' || split_part(r.full_name, ' ', 1) || ' towards first aid cover until CPR is renewed. Check the roster.'
            else 'Make sure another educator with current anaphylaxis training is on every shift until ' || split_part(r.full_name, ' ', 1) || ' renews.' end);
        n_escalated := n_escalated + 1;
      elsif t.requests_sent >= 3 then
        perform _escalate(t.id, split_part(r.full_name, ' ', 1) || ' hasn’t responded to ' || t.requests_sent || ' requests.',
          'Speak to ' || split_part(r.full_name, ' ', 1) || ' directly and agree a date to renew.');
        n_escalated := n_escalated + 1;
      end if;
    end if;
    -- after the owner acknowledges an escalation, the task goes back to waiting
    select * into t from credential_tasks where id = t.id;
    if t.state = 'owner_review' and t.escalation_ack_at is not null then
      update credential_tasks set state = case when t.requests_sent > 0 then 'waiting' else 'monitoring' end where id = t.id;
    elsif t.state = 'monitoring' and t.requests_sent > 0 then
      update credential_tasks set state = 'waiting' where id = t.id;
    end if;
  end loop;

  insert into agent_runs (centre_id, trigger, summary) values (p_centre, p_trigger, jsonb_build_object(
    'detected', n_detected, 'requests', n_requests, 'follow_ups', n_followups, 'escalated', n_escalated, 'resolved', n_resolved, 'reprioritised', n_reprio));
  return jsonb_build_object('detected', n_detected, 'requests', n_requests, 'follow_ups', n_followups,
                            'escalated', n_escalated, 'resolved', n_resolved, 'reprioritised', n_reprio, 'ran_at', now());
end $$;
revoke execute on function public.run_staff_agent_for(uuid, text) from public, anon, authenticated;

-- The app calls this when the owner opens beehive (and from "Check now").
create or replace function public.run_staff_agent()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_leader() then raise exception 'Only the owner or director can run the agent'; end if;
  return run_staff_agent_for(my_centre_id(), 'app');
end $$;
grant execute on function public.run_staff_agent() to authenticated;

-- Scheduled run for every centre (pg_cron, below).
create or replace function public.run_staff_agent_all()
returns int language plpgsql security definer set search_path = public as $$
declare c record; n int := 0;
begin
  for c in select id from centres loop perform run_staff_agent_for(c.id, 'schedule'); n := n + 1; end loop;
  return n;
end $$;
revoke execute on function public.run_staff_agent_all() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- certificate uploads: extraction results are checked against the record
-- ---------------------------------------------------------------------------
create or replace function public._norm(p text) returns text language sql immutable as $$
  select trim(regexp_replace(lower(coalesce(p, '')), '[^a-z ]+', ' ', 'g'));
$$;

create or replace function public._submit_checked(p_staff staff, p_type certificate_types, p_file_name text, p_file_data text,
  p_file_path text, p_file_hash text, p_extracted jsonb, p_expiry date, p_issue date, p_source text, p_submitted_by uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_checks jsonb := '[]'; v_flag text := 'clear'; v_ext jsonb := coalesce(p_extracted, '{}'); v_cur date; v_dup record;
  v_ex_name text; v_ex_type text; v_ex_expiry date; v_ex_issue date; v_task credential_tasks; v_id uuid; v_old uuid; v_readable boolean;
  v_tok text; v_ok boolean;
begin
  if p_expiry is not null and p_expiry < current_date then raise exception 'That expiry date has already passed'; end if;
  -- the same file twice: tell the uploader instead of creating a second record
  if coalesce(p_file_hash, '') <> '' then
    select cs.id, cs.status, cs.submitted_at into v_dup from certificate_submissions cs
     where cs.staff_id = p_staff.id and cs.file_hash = p_file_hash and cs.status in ('pending', 'approved')
     order by cs.submitted_at desc limit 1;
    if v_dup.id is not null then
      raise exception 'This file was already uploaded on % and is %.', _fmt_date(v_dup.submitted_at::date),
        case when v_dup.status = 'pending' then 'waiting for the centre to check it' else 'already approved' end;
    end if;
  end if;

  v_readable := coalesce((v_ext->>'readable')::boolean, false);
  v_ex_name := nullif(v_ext->>'name', '');
  v_ex_type := nullif(v_ext->>'type_code', '');
  v_ex_expiry := nullif(v_ext->>'expiry_date', '')::date;
  v_ex_issue := nullif(v_ext->>'issue_date', '')::date;
  select max(expiry_date) into v_cur from staff_certificates where staff_id = p_staff.id and certificate_type_id = p_type.id;

  if not v_readable then
    v_checks := v_checks || jsonb_build_object('field', 'document', 'issue', 'unreadable',
      'message', 'beehive couldn’t read any text on this file. Check it’s a clear photo or PDF of the right certificate.');
  else
    if v_ex_name is null then
      v_checks := v_checks || jsonb_build_object('field', 'name', 'issue', 'missing', 'message', 'No name found on the certificate.');
    else
      v_ok := true;
      foreach v_tok in array string_to_array(_norm(p_staff.full_name), ' ') loop
        if v_tok <> '' and position(v_tok in _norm(v_ex_name)) = 0 then v_ok := false; end if;
      end loop;
      if not v_ok then
        v_checks := v_checks || jsonb_build_object('field', 'name', 'issue', 'mismatch',
          'message', 'The name on the certificate (' || v_ex_name || ') doesn’t match ' || p_staff.full_name || '.');
      end if;
    end if;
    if v_ex_type is null then
      v_checks := v_checks || jsonb_build_object('field', 'type', 'issue', 'missing', 'message', 'Couldn’t tell which credential this is.');
    elsif v_ex_type <> p_type.code then
      v_checks := v_checks || jsonb_build_object('field', 'type', 'issue', 'mismatch',
        'message', 'This looks like a ' || coalesce((select name from certificate_types where code = v_ex_type), v_ex_type) || ', not a ' || p_type.name || '.');
    end if;
    if v_ex_expiry is null then
      v_checks := v_checks || jsonb_build_object('field', 'expiry_date', 'issue', 'missing', 'message', 'No expiry date found on the certificate.');
    else
      if v_ex_expiry < current_date then
        v_checks := v_checks || jsonb_build_object('field', 'expiry_date', 'issue', 'expired', 'message', 'The certificate expired on ' || _fmt_date(v_ex_expiry) || '.');
      elsif v_cur is not null and v_ex_expiry <= v_cur then
        v_checks := v_checks || jsonb_build_object('field', 'expiry_date', 'issue', 'not_newer',
          'message', 'The expiry date (' || _fmt_date(v_ex_expiry) || ') isn’t later than the one on file (' || _fmt_date(v_cur) || '). This may be the old certificate.');
      end if;
      if p_expiry is not null and p_expiry <> v_ex_expiry then
        v_checks := v_checks || jsonb_build_object('field', 'expiry_date', 'issue', 'differs',
          'message', 'The date entered (' || _fmt_date(p_expiry) || ') differs from the date read from the certificate (' || _fmt_date(v_ex_expiry) || ').');
      end if;
    end if;
    if v_ex_issue is not null and v_ex_issue > (now() at time zone 'Australia/Sydney')::date then
      v_checks := v_checks || jsonb_build_object('field', 'issue_date', 'issue', 'future', 'message', 'The issue date is in the future.');
    end if;
  end if;
  -- anything the reader itself was unsure about
  if jsonb_typeof(v_ext->'uncertain') = 'array' then
    select v_checks || coalesce(jsonb_agg(jsonb_build_object('field', 'document', 'issue', 'uncertain', 'message', u)), '[]')
      into v_checks from jsonb_array_elements_text(v_ext->'uncertain') u;
  end if;
  v_flag := case when not v_readable then 'unreadable' when jsonb_array_length(v_checks) > 0 then 'needs_check' else 'clear' end;

  -- a newer upload replaces an older one that hasn't been checked yet
  for v_old in select id from certificate_submissions where staff_id = p_staff.id and certificate_type_id = p_type.id and status = 'pending' loop
    update certificate_submissions set status = 'rejected', review_note = 'Replaced by a newer upload', reviewed_at = now() where id = v_old;
  end loop;

  select * into v_task from credential_tasks where staff_id = p_staff.id and certificate_type_id = p_type.id and state <> 'resolved';
  if v_task.id is null then
    insert into credential_tasks (centre_id, staff_id, certificate_type_id, priority, state, reason, expiry_date)
    values (p_staff.centre_id, p_staff.id, p_type.id,
            cert_priority(coalesce(v_cur - current_date, -1), v_cur is null), 'owner_review', 'Renewal uploaded', v_cur)
    returning * into v_task;
  else
    update credential_tasks set state = 'owner_review', updated_at = now() where id = v_task.id;
  end if;

  insert into certificate_submissions (centre_id, staff_id, certificate_type_id, file_path, file_name, file_data, file_hash,
    certificate_number, issue_date, expiry_date, extracted_by_ai, extracted, checks, review_flag, task_id, source, submitted_by)
  values (p_staff.centre_id, p_staff.id, p_type.id, p_file_path, coalesce(p_file_name, ''), p_file_data, p_file_hash,
    coalesce(v_ext->>'number', ''), coalesce(p_issue, v_ex_issue), coalesce(p_expiry, v_ex_expiry), v_readable, v_ext, v_checks, v_flag,
    v_task.id, p_source, p_submitted_by)
  returning id into v_id;

  perform _agent_event(p_staff.centre_id, v_task.id, p_staff.id, p_type.id, 'upload_received', 'Owner review', 'Certificate uploaded',
    jsonb_build_object('submission_id', v_id, 'source', p_source, 'file_name', p_file_name, 'extracted_expiry', v_ex_expiry));
  if v_flag <> 'clear' then
    perform _agent_event(p_staff.centre_id, v_task.id, p_staff.id, p_type.id, 'flagged', 'Owner review',
      case when v_flag = 'unreadable' then 'Upload unreadable: needs checking' else 'Upload needs checking' end,
      jsonb_build_object('submission_id', v_id, 'checks', v_checks));
  else
    perform _agent_event(p_staff.centre_id, v_task.id, p_staff.id, p_type.id, 'flagged', 'Owner review', 'Ready for your verification',
      jsonb_build_object('submission_id', v_id, 'checks', v_checks));
  end if;
  return jsonb_build_object('id', v_id, 'flag', v_flag, 'checks', v_checks);
end $$;
revoke execute on function public._submit_checked(staff, certificate_types, text, text, text, text, jsonb, date, date, text, uuid) from public, anon, authenticated;

-- Signed-in upload (educator for themselves, owner/director on someone's behalf).
create or replace function public.submit_certificate_checked(p_type_code text, p_file_name text, p_file_path text default null,
  p_file_data text default null, p_file_hash text default null, p_extracted jsonb default '{}', p_expiry date default null,
  p_issue date default null, p_staff_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_staff staff; v_type certificate_types;
begin
  if p_staff_id is not null and is_leader() then
    select * into v_staff from staff where id = p_staff_id and centre_id = my_centre_id() and is_active;
  else
    select * into v_staff from staff where user_id = auth.uid() and is_active;
  end if;
  if v_staff.id is null then raise exception 'Staff record not found. Ask the director to add you to the staff register.'; end if;
  select * into v_type from certificate_types where code = upper(replace(trim(p_type_code), ' ', '_'));
  if v_type.id is null then raise exception 'Unknown certificate type %', p_type_code; end if;
  if p_file_data is not null and length(p_file_data) > 4000000 then raise exception 'That file is too large. Use a photo under 3 MB.'; end if;
  return _submit_checked(v_staff, v_type, p_file_name, p_file_data, p_file_path, p_file_hash, p_extracted, p_expiry, p_issue,
    case when p_staff_id is not null and is_leader() then 'owner' else 'educator' end, auth.uid());
end $$;
grant execute on function public.submit_certificate_checked(text, text, text, text, text, jsonb, date, date, uuid) to authenticated;

-- What the secure upload link shows (no sign-in needed).
create or replace function public.upload_request_info(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('first_name', split_part(s.full_name, ' ', 1), 'full_name', s.full_name, 'centre', c.name,
           'credential', ct.name, 'type_code', ct.code, 'expiry_date', t.expiry_date, 'state', t.state,
           'pending', exists (select 1 from certificate_submissions cs where cs.task_id = t.id and cs.status = 'pending'))
  from credential_tasks t join staff s on s.id = t.staff_id join centres c on c.id = t.centre_id
  join certificate_types ct on ct.id = t.certificate_type_id
  where t.upload_token = p_token and t.state <> 'resolved';
$$;
grant execute on function public.upload_request_info(uuid) to anon, authenticated;

create or replace function public.submit_certificate_by_token(p_token uuid, p_file_name text, p_file_data text,
  p_file_hash text default null, p_extracted jsonb default '{}', p_expiry date default null, p_issue date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t credential_tasks; v_staff staff; v_type certificate_types;
begin
  select * into t from credential_tasks where upload_token = p_token and state <> 'resolved';
  if t.id is null then raise exception 'This upload link has expired or the renewal is already complete.'; end if;
  if coalesce(p_file_data, '') = '' then raise exception 'Choose a photo or PDF of your certificate.'; end if;
  if length(p_file_data) > 4000000 then raise exception 'That file is too large. Use a photo under 3 MB.'; end if;
  select * into v_staff from staff where id = t.staff_id;
  select * into v_type from certificate_types where id = t.certificate_type_id;
  return _submit_checked(v_staff, v_type, p_file_name, p_file_data, null, p_file_hash, p_extracted, p_expiry, p_issue, 'link', null);
end $$;
grant execute on function public.submit_certificate_by_token(uuid, text, text, text, jsonb, date, date) to anon, authenticated;

-- Owner decision on an upload.
create or replace function public.verify_certificate(p_submission uuid, p_approve boolean, p_expiry date default null, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sub certificate_submissions; v_cert uuid; v_expiry date; v_task credential_tasks; v_type certificate_types;
begin
  if not is_leader() then raise exception 'Only the owner or director can verify certificates'; end if;
  select * into v_sub from certificate_submissions where id = p_submission and centre_id = my_centre_id() for update;
  if not found then raise exception 'Submission not found'; end if;
  if v_sub.status <> 'pending' then raise exception 'This upload has already been %.', case when v_sub.status = 'approved' then 'approved' else 'rejected or replaced' end; end if;
  select * into v_type from certificate_types where id = v_sub.certificate_type_id;
  select * into v_task from credential_tasks where id = v_sub.task_id;
  if v_task.id is null then
    select * into v_task from credential_tasks where staff_id = v_sub.staff_id and certificate_type_id = v_sub.certificate_type_id and state <> 'resolved';
  end if;

  if p_approve then
    v_expiry := coalesce(p_expiry, v_sub.expiry_date);
    if v_expiry is null then raise exception 'Enter the expiry date before approving.'; end if;
    if v_expiry < current_date then raise exception 'That expiry date has already passed, so the certificate can’t be approved.'; end if;
    select id into v_cert from staff_certificates where staff_id = v_sub.staff_id and certificate_type_id = v_sub.certificate_type_id
      order by expiry_date desc nulls last limit 1;
    if v_cert is null then
      insert into staff_certificates (staff_id, certificate_type_id, certificate_number, issue_date, expiry_date, document_url)
      values (v_sub.staff_id, v_sub.certificate_type_id, v_sub.certificate_number, v_sub.issue_date, v_expiry, v_sub.file_path)
      returning id into v_cert;
    else
      update staff_certificates set expiry_date = v_expiry, issue_date = coalesce(v_sub.issue_date, issue_date),
        certificate_number = coalesce(nullif(v_sub.certificate_number, ''), certificate_number),
        document_url = coalesce(v_sub.file_path, document_url)
      where id = v_cert;
    end if;
    update certificate_submissions set status = 'approved', expiry_date = v_expiry, reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = coalesce(p_reason, '') where id = p_submission;
    perform log_audit(v_sub.centre_id, 'certificate.approved', 'certificate_submissions', p_submission::text,
      jsonb_build_object('staff_certificate_id', v_cert, 'expiry_date', v_expiry, 'staff_id', v_sub.staff_id));
    if v_task.id is not null then
      perform _agent_event(v_sub.centre_id, v_task.id, v_sub.staff_id, v_sub.certificate_type_id, 'approved', 'Resolved',
        'Certificate verified', jsonb_build_object('submission_id', p_submission, 'expiry_date', v_expiry));
      perform _agent_event(v_sub.centre_id, v_task.id, v_sub.staff_id, v_sub.certificate_type_id, 'record_updated', 'Resolved',
        'Staff record updated', jsonb_build_object('expiry_date', v_expiry, 'verified_at', now()));
      update credential_tasks set state = 'resolved', resolved_at = now(), resolution = 'Renewed until ' || _fmt_date(v_expiry),
        expiry_date = v_expiry, updated_at = now() where id = v_task.id;
      perform _agent_event(v_sub.centre_id, v_task.id, v_sub.staff_id, v_sub.certificate_type_id, 'resolved', 'Resolved',
        'Renewal task closed', jsonb_build_object('expiry_date', v_expiry));
    end if;
    return jsonb_build_object('approved', true, 'expiry_date', v_expiry);
  else
    if coalesce(trim(p_reason), '') = '' then raise exception 'Say why the upload is being rejected, so the educator knows what to fix.'; end if;
    update certificate_submissions set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_reason
     where id = p_submission;
    perform log_audit(v_sub.centre_id, 'certificate.rejected', 'certificate_submissions', p_submission::text,
      jsonb_build_object('reason', p_reason, 'staff_id', v_sub.staff_id));
    if v_task.id is not null then
      update credential_tasks set state = 'waiting', updated_at = now() where id = v_task.id;
      perform _agent_event(v_sub.centre_id, v_task.id, v_sub.staff_id, v_sub.certificate_type_id, 'rejected', 'Action taken',
        'Upload rejected', jsonb_build_object('submission_id', p_submission, 'reason', p_reason));
      perform _agent_send(v_task.id, 'correction', p_reason);
    end if;
    return jsonb_build_object('approved', false);
  end if;
end $$;
grant execute on function public.verify_certificate(uuid, boolean, date, text) to authenticated;

-- Owner acknowledges an escalation (the agent keeps chasing the renewal).
create or replace function public.acknowledge_escalation(p_task uuid, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare t credential_tasks;
begin
  if not is_leader() then raise exception 'Only the owner or director can do this'; end if;
  select * into t from credential_tasks where id = p_task and centre_id = my_centre_id();
  if not found then raise exception 'Task not found'; end if;
  if t.escalated_at is null or t.escalation_ack_at is not null then raise exception 'There’s nothing to acknowledge on this task.'; end if;
  update credential_tasks set escalation_ack_at = now(),
    state = case when exists (select 1 from certificate_submissions cs where cs.task_id = t.id and cs.status = 'pending') then 'owner_review'
                 when requests_sent > 0 then 'waiting' else 'monitoring' end,
    updated_at = now() where id = p_task;
  perform _agent_event(t.centre_id, t.id, t.staff_id, t.certificate_type_id, 'escalation_acknowledged', 'Waiting',
    'You acknowledged the escalation', jsonb_build_object('note', coalesce(p_note, '')));
end $$;
grant execute on function public.acknowledge_escalation(uuid, text) to authenticated;

-- Owner asks the agent to chase now instead of waiting for the follow-up date.
create or replace function public.agent_send_now(p_task uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t credential_tasks;
begin
  if not is_leader() then raise exception 'Only the owner or director can do this'; end if;
  select * into t from credential_tasks where id = p_task and centre_id = my_centre_id();
  if not found or t.state = 'resolved' then raise exception 'This renewal is already complete.'; end if;
  return _agent_send(t.id, case when t.requests_sent = 0 then 'request' else 'follow_up' end);
end $$;
grant execute on function public.agent_send_now(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- views for the interface
-- ---------------------------------------------------------------------------
create or replace view public.v_credential_tasks with (security_invoker = on) as
select t.*, s.full_name as staff_name, coalesce(nullif(s.room, ''), '—') as room, s.email, s.phone, s.user_id as staff_user_id,
       ct.code as type_code, ct.name as type_name,
       case when t.expiry_date is null then null else t.expiry_date - current_date end as days_left,
       lm.sent_at as last_message_at, lm.channel as last_channel, lm.kind as last_kind, lm.recipient as last_recipient,
       ps.id as pending_submission_id, ps.review_flag as pending_flag
from public.credential_tasks t
join public.staff s on s.id = t.staff_id
join public.certificate_types ct on ct.id = t.certificate_type_id
left join lateral (select m.* from public.agent_messages m where m.task_id = t.id order by m.sent_at desc limit 1) lm on true
left join lateral (select cs.id, cs.review_flag from public.certificate_submissions cs where cs.task_id = t.id and cs.status = 'pending'
                   order by cs.submitted_at desc limit 1) ps on true;
grant select on public.v_credential_tasks to authenticated;

create or replace view public.v_agent_feed with (security_invoker = on) as
select e.id, e.centre_id, e.task_id, e.staff_id, e.kind, e.state, e.summary, e.detail, e.demo, e.created_at,
       s.full_name as staff_name, ct.code as type_code, ct.name as type_name,
       t.state as task_state, t.priority as task_priority, t.next_follow_up
from public.agent_events e
left join public.staff s on s.id = e.staff_id
left join public.certificate_types ct on ct.id = e.certificate_type_id
left join public.credential_tasks t on t.id = e.task_id;
grant select on public.v_agent_feed to authenticated;

-- ---------------------------------------------------------------------------
-- schedule: run every morning at 7:00 Sydney time where pg_cron is available
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available: the agent will run when the owner opens beehive';
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('beehive-staff-agent') where exists (select 1 from cron.job where jobname = 'beehive-staff-agent');
      perform cron.schedule('beehive-staff-agent', '0 20 * * *', 'select public.run_staff_agent_all()');  -- 20:00 UTC = 7:00 AEDT
    exception when others then
      raise notice 'Could not schedule the staff agent: %', sqlerrm;
    end;
  end if;
end $$;
