-- Beehive Compliance Agent (see AGENT.md).
-- The agent reviews staff credentials, then saves renewal-reminder DRAFTS and owner escalations.
-- It cannot send anything, approve certificates or change staff records: the owner approves every
-- reminder on the Compliance page. All agent functions are scoped to one centre by its agent key.

create table if not exists public.staff_reminder_drafts (
  id                   uuid primary key default gen_random_uuid(),
  centre_id            uuid not null references public.centres (id) on delete cascade,
  staff_id             uuid not null references public.staff (id) on delete cascade,
  certificate_type_id  uuid references public.certificate_types (id),
  kind                 text not null check (kind in ('renewal', 'missing', 'follow_up', 'escalation')),
  priority             text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  reason               text not null default '',
  body                 text not null default '',          -- message to the educator (empty for escalations)
  follow_up_on         date,                              -- when to check again if still outstanding
  status               text not null default 'draft' check (status in ('draft', 'sent', 'discarded', 'resolved')),
  created_by           text not null default 'agent',
  created_at           timestamptz not null default now(),
  decided_by           uuid references public.users (id) on delete set null,
  decided_at           timestamptz
);
create index if not exists staff_reminder_drafts_centre_idx on public.staff_reminder_drafts (centre_id, status, created_at desc);

alter table public.staff_reminder_drafts enable row level security;
drop policy if exists "leaders read reminder drafts" on public.staff_reminder_drafts;
create policy "leaders read reminder drafts" on public.staff_reminder_drafts for select
  using (centre_id = public.my_centre_id() and public.is_leader());
drop policy if exists "educators read their sent reminders" on public.staff_reminder_drafts;
create policy "educators read their sent reminders" on public.staff_reminder_drafts for select
  using (status = 'sent' and kind <> 'escalation'
         and exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));
-- No insert/update/delete policies: changes only happen through the functions below.
grant select on public.staff_reminder_drafts to authenticated;

-- Which credentials every educator must hold (matches the staff register).
create or replace function public._required_cert_codes()
returns text[] language sql immutable as $$ select array['WWCC', 'FIRST_AID', 'CPR', 'ANAPHYLAXIS'] $$;

-- One row per educator per required credential, with what the agent needs to decide.
drop function if exists public._credential_review(uuid);
create or replace function public._credential_review(p_centre uuid)
returns table (staff_id uuid, staff_name text, room text, has_login boolean, certificate_code text, certificate_name text,
               status text, expiry_date date, days_left int, reminder_window int,
               last_reminder_sent date, renewal_submitted boolean, open_draft boolean, escalation_open boolean, follow_up_due boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, coalesce(nullif(s.room, ''), '—'), s.user_id is not null, ct.code, ct.name,
         case when sc.id is null then 'missing'
              when not ct.expires or sc.expiry_date is null then 'valid'
              when sc.expiry_date < current_date then 'expired'
              when sc.expiry_date <= current_date + ct.reminder_days then 'expiring_soon'
              else 'valid' end,
         sc.expiry_date,
         case when sc.expiry_date is null then null else sc.expiry_date - current_date end,
         ct.reminder_days,
         greatest((select max(r.sent_at)::date from reminders r where r.staff_certificate_id = sc.id and r.status = 'sent'),
                  (select max(d.decided_at)::date from staff_reminder_drafts d where d.staff_id = s.id and d.certificate_type_id = ct.id and d.status = 'sent')),
         exists (select 1 from certificate_submissions cs where cs.staff_id = s.id and cs.certificate_type_id = ct.id and cs.status = 'pending'),
         exists (select 1 from staff_reminder_drafts d where d.staff_id = s.id and d.certificate_type_id = ct.id and d.status = 'draft' and d.kind <> 'escalation'),
         exists (select 1 from staff_reminder_drafts d where d.staff_id = s.id and d.certificate_type_id = ct.id and d.status = 'draft' and d.kind = 'escalation'),
         exists (select 1 from staff_reminder_drafts d where d.staff_id = s.id and d.certificate_type_id = ct.id and d.status = 'sent'
                   and d.follow_up_on <= current_date)
  from staff s
  cross join certificate_types ct
  left join lateral (select x.* from staff_certificates x where x.staff_id = s.id and x.certificate_type_id = ct.id
                     order by x.expiry_date desc nulls last limit 1) sc on true
  where s.centre_id = p_centre and s.is_active and ct.code = any (_required_cert_codes())
    and s.position not ilike '%owner%';
$$;
revoke execute on function public._credential_review(uuid) from public, anon, authenticated;

-- AGENT TOOL 1: read. Only credentials that need attention, plus counts.
create or replace function public.agent_credential_review(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key);
begin
  return jsonb_build_object(
    'today', current_date,
    'required_credentials', _required_cert_codes(),
    'educators_checked', (select count(distinct staff_id) from _credential_review(v_centre)),
    'needs_attention', coalesce((
      select jsonb_agg(jsonb_build_object(
               'staff', r.staff_name, 'room', r.room, 'certificate', r.certificate_code, 'certificate_name', r.certificate_name,
               'status', r.status, 'expiry_date', r.expiry_date, 'days_left', r.days_left, 'reminder_window_days', r.reminder_window,
               'last_reminder_sent', r.last_reminder_sent, 'renewal_submitted', r.renewal_submitted,
               'draft_already_waiting', r.open_draft, 'escalation_open', r.escalation_open, 'follow_up_due', r.follow_up_due, 'has_beehive_login', r.has_login)
             order by case r.status when 'expired' then 0 when 'missing' then 1 else 2 end, r.days_left nulls first)
      from _credential_review(v_centre) r
      where r.status in ('expired', 'missing', 'expiring_soon')), '[]'::jsonb));
end $$;

-- AGENT TOOL 2: save reminder drafts (one call, many drafts). Every input is checked here,
-- so the rules hold even if the model ignores its instructions.
create or replace function public.agent_save_reminder_drafts(p_key text, p_drafts jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_centre uuid := _agent_centre(p_key);
  d jsonb; v_staff staff; v_type certificate_types; v_rev record; v_body text; v_kind text; v_prio text; v_days int;
  v_saved jsonb := '[]'::jsonb; v_skipped jsonb := '[]'::jsonb; v_id uuid; v_n int;
begin
  if jsonb_typeof(p_drafts) <> 'array' then raise exception 'drafts must be a list'; end if;
  if jsonb_array_length(p_drafts) > 15 then raise exception 'At most 15 drafts per run'; end if;
  for d in select * from jsonb_array_elements(p_drafts) loop
    v_body := trim(coalesce(d->>'body', ''));
    v_kind := coalesce(d->>'kind', 'renewal');
    v_prio := coalesce(d->>'priority', 'medium');
    v_days := coalesce(nullif(d->>'follow_up_in_days', '')::int, 7);
    select count(*) into v_n from staff where centre_id = v_centre and is_active and lower(full_name) = lower(trim(d->>'staff'));
    if v_n <> 1 then v_skipped := v_skipped || jsonb_build_object('staff', d->>'staff', 'reason', 'No single active educator with that exact name'); continue; end if;
    select * into v_staff from staff where centre_id = v_centre and is_active and lower(full_name) = lower(trim(d->>'staff'));
    select * into v_type from certificate_types where code = upper(replace(trim(coalesce(d->>'certificate', '')), ' ', '_'));
    if v_type.id is null or not (v_type.code = any (_required_cert_codes())) then
      v_skipped := v_skipped || jsonb_build_object('staff', v_staff.full_name, 'reason', 'Unknown or not-required certificate'); continue; end if;
    select * into v_rev from _credential_review(v_centre) r where r.staff_id = v_staff.id and r.certificate_code = v_type.code;
    if v_rev.status = 'valid' then
      v_skipped := v_skipped || jsonb_build_object('staff', v_staff.full_name, 'certificate', v_type.code, 'reason', 'Certificate is current; no reminder needed'); continue; end if;
    if v_rev.renewal_submitted then
      v_skipped := v_skipped || jsonb_build_object('staff', v_staff.full_name, 'certificate', v_type.code, 'reason', 'Renewal already submitted; the owner must review it'); continue; end if;
    if v_rev.open_draft then
      v_skipped := v_skipped || jsonb_build_object('staff', v_staff.full_name, 'certificate', v_type.code, 'reason', 'A draft is already waiting for approval'); continue; end if;
    if v_kind not in ('renewal', 'missing', 'follow_up') then v_kind := 'renewal'; end if;
    if v_prio not in ('high', 'medium', 'low') then v_prio := 'medium'; end if;
    if length(v_body) < 20 or length(v_body) > 900 then
      v_skipped := v_skipped || jsonb_build_object('staff', v_staff.full_name, 'reason', 'Message must be 20 to 900 characters'); continue; end if;
    if v_days < 1 or v_days > 30 then v_days := 7; end if;
    insert into staff_reminder_drafts (centre_id, staff_id, certificate_type_id, kind, priority, reason, body, follow_up_on)
    values (v_centre, v_staff.id, v_type.id, v_kind, v_prio, left(coalesce(d->>'reason', ''), 300), v_body, current_date + v_days)
    returning id into v_id;
    perform log_audit(v_centre, 'agent.reminder_drafted', 'staff_reminder_drafts', v_id::text,
      jsonb_build_object('staff_id', v_staff.id, 'certificate', v_type.code, 'kind', v_kind, 'by', 'Beehive Compliance Agent'));
    v_saved := v_saved || jsonb_build_object('staff', v_staff.full_name, 'certificate', v_type.code, 'draft_id', v_id, 'follow_up_on', current_date + v_days);
  end loop;
  return jsonb_build_object('saved', v_saved, 'skipped', v_skipped,
    'note', 'Saved as drafts. Nothing has been sent. The owner approves each reminder in Beehive.');
end $$;

-- AGENT TOOL 3: escalate to the owner (no message to the educator).
create or replace function public.agent_flag_for_owner(p_key text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key); d jsonb; v_staff staff; v_type uuid; v_id uuid; v_out jsonb := '[]'::jsonb; v_n int;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'items must be a list'; end if;
  if jsonb_array_length(p_items) > 15 then raise exception 'At most 15 escalations per run'; end if;
  for d in select * from jsonb_array_elements(p_items) loop
    select count(*) into v_n from staff where centre_id = v_centre and is_active and lower(full_name) = lower(trim(d->>'staff'));
    if v_n <> 1 then continue; end if;
    select * into v_staff from staff where centre_id = v_centre and is_active and lower(full_name) = lower(trim(d->>'staff'));
    select id into v_type from certificate_types where code = upper(replace(trim(coalesce(d->>'certificate', '')), ' ', '_'));
    if exists (select 1 from staff_reminder_drafts x where x.staff_id = v_staff.id and x.kind = 'escalation' and x.status = 'draft'
               and x.certificate_type_id is not distinct from v_type) then continue; end if;
    insert into staff_reminder_drafts (centre_id, staff_id, certificate_type_id, kind, priority, reason)
    values (v_centre, v_staff.id, v_type, 'escalation', 'high', left(coalesce(d->>'reason', 'Needs the owner''s decision'), 300))
    returning id into v_id;
    perform log_audit(v_centre, 'agent.escalated', 'staff_reminder_drafts', v_id::text,
      jsonb_build_object('staff_id', v_staff.id, 'reason', d->>'reason', 'by', 'Beehive Compliance Agent'));
    v_out := v_out || jsonb_build_object('staff', v_staff.full_name, 'escalation_id', v_id);
  end loop;
  return jsonb_build_object('escalated', v_out, 'note', 'Flagged for the owner. The agent has not contacted anyone.');
end $$;

grant execute on function public.agent_credential_review(text) to anon, authenticated;
grant execute on function public.agent_save_reminder_drafts(text, jsonb) to anon, authenticated;
grant execute on function public.agent_flag_for_owner(text, jsonb) to anon, authenticated;

-- OWNER ACTIONS (Compliance page). Approving records the reminder as sent and schedules the follow-up.
create or replace function public.approve_staff_reminder(p_id uuid, p_body text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_d staff_reminder_drafts; v_cert uuid;
begin
  if not is_leader() then raise exception 'Only the owner or director can approve reminders'; end if;
  select * into v_d from staff_reminder_drafts where id = p_id and centre_id = my_centre_id();
  if not found then raise exception 'Reminder not found'; end if;
  if v_d.status <> 'draft' or v_d.kind = 'escalation' then raise exception 'This reminder has already been handled'; end if;
  update staff_reminder_drafts set status = 'sent', body = coalesce(nullif(trim(p_body), ''), body), decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  select id into v_cert from staff_certificates where staff_id = v_d.staff_id and certificate_type_id = v_d.certificate_type_id
   order by expiry_date desc nulls last limit 1;
  if v_cert is not null then
    insert into reminders (staff_certificate_id, channel, send_at, status, sent_at) values (v_cert, 'in_app', now(), 'sent', now());
  end if;
  perform log_audit(v_d.centre_id, 'staff_reminder.sent', 'staff_reminder_drafts', p_id::text,
    jsonb_build_object('staff_id', v_d.staff_id, 'drafted_by_agent', v_d.created_by = 'agent', 'follow_up_on', v_d.follow_up_on));
  return jsonb_build_object('sent', true, 'follow_up_on', v_d.follow_up_on);
end $$;

create or replace function public.decide_staff_reminder(p_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare v_d staff_reminder_drafts;
begin
  if not is_leader() then raise exception 'Only the owner or director can do this'; end if;
  if p_decision not in ('discarded', 'resolved') then raise exception 'Unknown decision'; end if;
  select * into v_d from staff_reminder_drafts where id = p_id and centre_id = my_centre_id();
  if not found then raise exception 'Item not found'; end if;
  if v_d.status <> 'draft' then raise exception 'This item has already been handled'; end if;
  update staff_reminder_drafts set status = p_decision, decided_by = auth.uid(), decided_at = now() where id = p_id;
  perform log_audit(v_d.centre_id, 'staff_reminder.' || p_decision, 'staff_reminder_drafts', p_id::text, jsonb_build_object('kind', v_d.kind));
end $$;

grant execute on function public.approve_staff_reminder(uuid, text) to authenticated;
grant execute on function public.decide_staff_reminder(uuid, text) to authenticated;

-- What the owner sees on the Compliance page.
create or replace view public.v_staff_reminder_queue with (security_invoker = on) as
select d.id, d.centre_id, d.kind, d.priority, d.reason, d.body, d.follow_up_on, d.status, d.created_at, d.decided_at,
       s.full_name as staff_name, coalesce(nullif(s.room, ''), '—') as room, ct.code as certificate_code, ct.name as certificate_name
from public.staff_reminder_drafts d
join public.staff s on s.id = d.staff_id
left join public.certificate_types ct on ct.id = d.certificate_type_id;
grant select on public.v_staff_reminder_queue to authenticated;
