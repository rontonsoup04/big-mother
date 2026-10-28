-- beehive: one system
-- Joins the staff compliance agent, the audit-readiness agent and the compliance assistant so they share one set
-- of records and one history:
--   1. Any change to the shared records (credentials, certificate uploads, evidence, compliance tasks, medical
--      updates, incidents, child records, regulation updates) re-checks the audit requirements in the same
--      transaction. Requirement status, readiness, audit tasks and the activity feed never wait for a later run,
--      and a status change records what caused it (for example the credential that was renewed).
--   2. Regulation decisions that need action on a requirement checked from beehive's own records (credentials,
--      medical, incidents, children) become an owner action routed to that workflow, closed by the owner.
--   3. The compliance assistant (Gemini) no longer runs a second reminder system: it won't draft a reminder the
--      staff agent is already sending, an approved draft is sent through the staff agent's renewal (same message
--      history, same follow-up schedule), and its escalations go onto the staff agent's renewal task.
--   4. The old expiry check runs the staff agent instead of its own reminder table.

-- ---------------------------------------------------------------------------
-- 1. re-check requirements whenever the shared records change
-- ---------------------------------------------------------------------------
create or replace function public._audit_refresh(p_centre uuid, p_cause text default 'change', p_detail jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if p_centre is null then return; end if;
  if not exists (select 1 from checklist_items where centre_id = p_centre and is_active and approved_at is not null) then return; end if;
  -- once per transaction is enough: deferred triggers run after every change in it
  v_key := 'beehive.refreshed_' || replace(p_centre::text, '-', '');
  if coalesce(current_setting(v_key, true), '') = '1' then return; end if;
  perform set_config(v_key, '1', true);
  perform run_audit_agent_for(p_centre, left(p_cause, 120));
  -- say what caused the changes this transaction recorded
  update agent_events set detail = detail || jsonb_build_object('cause', p_cause) || coalesce(p_detail - 'staff_id' - 'certificate_type_id', '{}'),
         staff_id = coalesce(staff_id, nullif(p_detail->>'staff_id', '')::uuid),
         certificate_type_id = coalesce(certificate_type_id, nullif(p_detail->>'certificate_type_id', '')::uuid)
   where centre_id = p_centre and agent = 'audit' and created_at = now() and kind in ('status_changed', 'resolved', 'gap_detected')
     and not (detail ? 'cause');
end $$;
revoke execute on function public._audit_refresh(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public._refresh_on_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_centre uuid; v_cause text; v_detail jsonb := '{}'; r record; v_name text; v_type text;
begin
  if tg_table_name = 'staff_certificates' then
    select s.centre_id as centre_id, s.full_name as staff_name, ct.name as type_name, s.id as staff_id, ct.id as type_id into r
      from staff s join certificate_types ct on ct.id = coalesce(new.certificate_type_id, old.certificate_type_id)
     where s.id = coalesce(new.staff_id, old.staff_id);
    v_centre := r.centre_id;
    v_cause := r.staff_name || '’s ' || r.type_name || case when tg_op = 'DELETE' then ' was removed'
               when new.expiry_date is not null then ' is now valid until ' || _fmt_date(new.expiry_date) else ' was updated' end;
    v_detail := jsonb_build_object('staff_id', r.staff_id, 'certificate_type_id', r.type_id, 'credential', r.type_name, 'staff', r.staff_name);
  elsif tg_table_name = 'certificate_submissions' then
    if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
    select s.full_name, ct.name into v_name, v_type from staff s, certificate_types ct where s.id = new.staff_id and ct.id = new.certificate_type_id;
    v_centre := new.centre_id;
    v_cause := v_name || '’s ' || v_type || case new.status when 'pending' then ' renewal was uploaded' when 'approved' then ' was verified' else ' upload was rejected' end;
    v_detail := jsonb_build_object('staff_id', new.staff_id, 'certificate_type_id', new.certificate_type_id, 'credential', v_type, 'staff', v_name);
  elsif tg_table_name = 'evidence' then
    v_centre := coalesce(new.centre_id, old.centre_id); v_cause := 'Evidence changed';
  elsif tg_table_name = 'compliance_records' then
    v_centre := coalesce(new.centre_id, old.centre_id); v_cause := 'Compliance task updated';
  elsif tg_table_name = 'medical_updates' then
    v_centre := new.centre_id; v_cause := 'Medical update ' || coalesce(new.status::text, 'changed');
  elsif tg_table_name = 'incidents' then
    v_centre := new.centre_id; v_cause := 'Incident record updated';
  elsif tg_table_name = 'children' then
    v_centre := coalesce(new.centre_id, old.centre_id); v_cause := 'Child records updated';
  elsif tg_table_name = 'regulation_updates' then
    v_centre := new.centre_id; v_cause := 'Regulation update: ' || new.title;
  end if;
  perform _audit_refresh(v_centre, v_cause, v_detail);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['staff_certificates', 'certificate_submissions', 'evidence', 'compliance_records', 'medical_updates', 'incidents', 'children'] loop
    execute format('drop trigger if exists zz_refresh_audit on public.%I', t);
    execute format('create constraint trigger zz_refresh_audit after insert or update%s on public.%I deferrable initially deferred for each row execute function public._refresh_on_change()',
                   case when t in ('staff_certificates', 'evidence', 'children') then ' or delete' else '' end, t);
  end loop;
  drop trigger if exists zz_refresh_audit on public.regulation_updates;
  create constraint trigger zz_refresh_audit after insert on public.regulation_updates deferrable initially deferred for each row execute function public._refresh_on_change();
end $$;

-- ---------------------------------------------------------------------------
-- 2. regulation decisions on requirements checked from beehive's own records
-- ---------------------------------------------------------------------------
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.audit_tasks'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%';
  if c is not null then execute 'alter table public.audit_tasks drop constraint ' || quote_ident(c); end if;
  alter table public.audit_tasks add constraint audit_tasks_kind_check check (kind in ('evidence', 'regulation_review', 'overdue_task', 'owner_action', 'regulation_action'));
end $$;
create unique index if not exists audit_tasks_open_reg_action on public.audit_tasks (regulation_update_id, checklist_item_id) where state <> 'resolved' and kind = 'regulation_action';

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
    resolution = case p_decision when 'no_change' then 'Reviewed: no change needed' when 'not_applicable' then 'Doesn’t apply to this centre' else 'Change needed' end
   where regulation_update_id = u.id and kind = 'regulation_review' and state <> 'resolved' and checklist_item_id is not distinct from rr.checklist_item_id;
  if ci.id is not null then
    if p_decision = 'update_needed' then
      update checklist_items set review_note = 'Update needed after “' || u.title || '”' where id = ci.id;
      if ci.evidence_kind = 'document' then
        -- a policy or record to update: the evidence workflow (upload, check, verify)
        select * into t from audit_tasks where checklist_item_id = ci.id and kind = 'evidence' and state <> 'resolved';
        if t.id is null then
          insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state, due_date, regulation_update_id)
          values (ci.centre_id, ci.id, 'evidence', 'Update ' || ci.title, 'You decided the policy needs updating after “' || u.title || '”.',
                  'Update the policy, upload it and verify it. The requirement stays under review until then.', 'medium', 'waiting', current_date + 30, u.id);
        end if;
      else
        -- checked from beehive's own records: an owner action in the workflow that owns those records
        insert into audit_tasks (centre_id, checklist_item_id, kind, title, reason, recommended_action, priority, state, due_date, regulation_update_id)
        values (ci.centre_id, ci.id, 'regulation_action', 'Put “' || u.title || '” into practice: ' || ci.title,
                'You decided practices need to change after “' || u.title || '”.',
                case ci.evidence_kind
                  when 'certificates' then 'Check the staff register against the new requirement in Staff certifications. Renewals and new certificates go through beehive’s staff agent. Mark this done when the change is in place.'
                  when 'medical' then 'Update how medical information is collected and ask families for anything new through beehive. Mark this done when the change is in place.'
                  when 'incidents' then 'Update the incident procedure and brief staff. Mark this done when the change is in place.'
                  else 'Make the change, then mark this done.' end,
                'medium', 'waiting', current_date + 30, u.id)
        on conflict do nothing;
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
    case p_decision when 'no_change' then 'You confirmed no change needed: ' when 'not_applicable' then 'You marked as not applicable: ' else 'You decided a change is needed: ' end || coalesce(ci.title, u.title),
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

-- The owner confirms the change a regulation decision called for is in place.
create or replace function public.complete_audit_task(p_task uuid, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare t audit_tasks; ci checklist_items; u regulation_updates;
begin
  if not is_leader() then raise exception 'Only the owner or director can do this'; end if;
  select * into t from audit_tasks where id = p_task and centre_id = my_centre_id() for update;
  if t.id is null then raise exception 'Task not found'; end if;
  if t.state = 'resolved' then raise exception 'This task is already complete.'; end if;
  if t.kind <> 'regulation_action' then raise exception 'This task closes by itself once the records show it’s done.'; end if;
  select * into ci from checklist_items where id = t.checklist_item_id;
  select * into u from regulation_updates where id = t.regulation_update_id;
  update audit_tasks set state = 'resolved', resolved_at = now(), updated_at = now(), resolution = 'Done' || case when coalesce(trim(p_note), '') <> '' then ': ' || trim(p_note) else '' end where id = t.id;
  update regulation_reviews set completed_at = now(), note = case when coalesce(trim(p_note), '') <> '' then trim(note || ' ' || trim(p_note)) else note end
   where regulation_update_id = t.regulation_update_id and checklist_item_id is not distinct from t.checklist_item_id and decision = 'update_needed' and completed_at is null;
  if ci.id is not null and not exists (select 1 from regulation_reviews rr where rr.checklist_item_id = ci.id and (rr.decision is null or (rr.decision = 'update_needed' and rr.completed_at is null))) then
    update checklist_items set review_required = false, review_note = '', last_reviewed_at = now(), reviewed_by = auth.uid() where id = ci.id;
  end if;
  perform log_audit(t.centre_id, 'audit_task.completed', 'audit_tasks', t.id::text, jsonb_build_object('note', p_note, 'update', u.title));
  perform _audit_event(t.centre_id, t.checklist_item_id, t.id, t.regulation_update_id, 'regulation_action_done', 'Resolved',
    'You put “' || coalesce(u.title, 'the change') || '” into practice: ' || coalesce(ci.title, ''), jsonb_build_object('note', p_note));
  perform run_audit_agent_for(t.centre_id, 'regulation_action');
  return jsonb_build_object('done', true);
end $$;
grant execute on function public.complete_audit_task(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. the compliance assistant works through the staff agent's renewals
-- ---------------------------------------------------------------------------
-- The assistant's credential review also sees the staff agent's messages, so it knows what was already sent.
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
                  (select max(d.decided_at)::date from staff_reminder_drafts d where d.staff_id = s.id and d.certificate_type_id = ct.id and d.status = 'sent'),
                  (select max(m.sent_at)::date from agent_messages m join credential_tasks t on t.id = m.task_id where t.staff_id = s.id and t.certificate_type_id = ct.id)),
         exists (select 1 from certificate_submissions cs where cs.staff_id = s.id and cs.certificate_type_id = ct.id and cs.status = 'pending'),
         exists (select 1 from staff_reminder_drafts d where d.staff_id = s.id and d.certificate_type_id = ct.id and d.status = 'draft' and d.kind <> 'escalation'),
         exists (select 1 from staff_reminder_drafts d where d.staff_id = s.id and d.certificate_type_id = ct.id and d.status = 'draft' and d.kind = 'escalation')
           or exists (select 1 from credential_tasks t where t.staff_id = s.id and t.certificate_type_id = ct.id and t.state <> 'resolved' and t.escalated_at is not null and t.escalation_ack_at is null),
         exists (select 1 from credential_tasks t where t.staff_id = s.id and t.certificate_type_id = ct.id and t.state <> 'resolved' and t.next_follow_up <= current_date)
  from staff s
  cross join certificate_types ct
  left join lateral (select x.* from staff_certificates x where x.staff_id = s.id and x.certificate_type_id = ct.id
                     order by x.expiry_date desc nulls last limit 1) sc on true
  where s.centre_id = p_centre and s.is_active and ct.code = any (_required_cert_codes())
    and s.position not ilike '%owner%';
$$;
revoke execute on function public._credential_review(uuid) from public, anon, authenticated;

create or replace function public.agent_save_reminder_drafts(p_key text, p_drafts jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_centre uuid := _agent_centre(p_key);
  d jsonb; v_staff staff; v_type certificate_types; v_rev record; v_body text; v_kind text; v_prio text; v_days int; v_ct credential_tasks;
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
    -- one reminder system: the staff agent is already chasing this renewal
    select * into v_ct from credential_tasks where staff_id = v_staff.id and certificate_type_id = v_type.id and state <> 'resolved';
    if v_ct.id is not null and v_ct.requests_sent > 0 then
      v_skipped := v_skipped || jsonb_build_object('staff', v_staff.full_name, 'certificate', v_type.code,
        'reason', 'beehive’s staff agent already asked ' || split_part(v_staff.full_name, ' ', 1) || ' on ' || _fmt_date(v_ct.last_request_at::date) ||
                  case when v_ct.next_follow_up is not null then ' and follows up on ' || _fmt_date(v_ct.next_follow_up) else '' end || '. No second reminder needed.');
      continue;
    end if;
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
    'note', 'Saved as drafts. Nothing has been sent. The owner approves each reminder in Beehive; approved reminders go out through the staff agent’s renewal.');
end $$;
grant execute on function public.agent_save_reminder_drafts(text, jsonb) to anon, authenticated;

-- Escalations go onto the staff agent's renewal task, so the owner sees one escalation per renewal.
create or replace function public.agent_flag_for_owner(p_key text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key); d jsonb; v_staff staff; v_type uuid; v_id uuid; v_out jsonb := '[]'::jsonb; v_skip jsonb := '[]'::jsonb; v_n int;
        v_ct credential_tasks; v_reason text;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'items must be a list'; end if;
  if jsonb_array_length(p_items) > 15 then raise exception 'At most 15 escalations per run'; end if;
  for d in select * from jsonb_array_elements(p_items) loop
    select count(*) into v_n from staff where centre_id = v_centre and is_active and lower(full_name) = lower(trim(d->>'staff'));
    if v_n <> 1 then continue; end if;
    select * into v_staff from staff where centre_id = v_centre and is_active and lower(full_name) = lower(trim(d->>'staff'));
    select id into v_type from certificate_types where code = upper(replace(trim(coalesce(d->>'certificate', '')), ' ', '_'));
    v_reason := left(coalesce(d->>'reason', 'Needs the owner’s decision'), 300);
    select * into v_ct from credential_tasks where staff_id = v_staff.id and certificate_type_id = v_type and state <> 'resolved';
    if v_ct.id is not null then
      if v_ct.escalated_at is not null and v_ct.escalation_ack_at is null then
        v_skip := v_skip || jsonb_build_object('staff', v_staff.full_name, 'reason', 'Already escalated to the owner on the renewal task');
        continue;
      end if;
      perform _escalate(v_ct.id, v_reason, 'Review the compliance assistant’s concern and decide the next step.');
      v_out := v_out || jsonb_build_object('staff', v_staff.full_name, 'escalation_id', v_ct.id, 'routed_to', 'staff_agent');
      continue;
    end if;
    if exists (select 1 from staff_reminder_drafts x where x.staff_id = v_staff.id and x.kind = 'escalation' and x.status = 'draft'
               and x.certificate_type_id is not distinct from v_type) then continue; end if;
    insert into staff_reminder_drafts (centre_id, staff_id, certificate_type_id, kind, priority, reason)
    values (v_centre, v_staff.id, v_type, 'escalation', 'high', v_reason)
    returning id into v_id;
    perform log_audit(v_centre, 'agent.escalated', 'staff_reminder_drafts', v_id::text,
      jsonb_build_object('staff_id', v_staff.id, 'reason', d->>'reason', 'by', 'Beehive Compliance Agent'));
    v_out := v_out || jsonb_build_object('staff', v_staff.full_name, 'escalation_id', v_id, 'routed_to', 'compliance_page');
  end loop;
  return jsonb_build_object('escalated', v_out, 'skipped', v_skip, 'note', 'Flagged for the owner. The agent has not contacted anyone.');
end $$;
grant execute on function public.agent_flag_for_owner(text, jsonb) to anon, authenticated;

-- An approved draft is sent through the staff agent's renewal: same message history, same follow-up schedule.
create or replace function public.approve_staff_reminder(p_id uuid, p_body text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_d staff_reminder_drafts; v_cert uuid; v_ct credential_tasks; s staff; ct certificate_types; v_exp date; v_channel text; v_to text; v_next date; v_msg uuid; v_body text;
begin
  if not is_leader() then raise exception 'Only the owner or director can approve reminders'; end if;
  select * into v_d from staff_reminder_drafts where id = p_id and centre_id = my_centre_id();
  if not found then raise exception 'Reminder not found'; end if;
  if v_d.status <> 'draft' or v_d.kind = 'escalation' then raise exception 'This reminder has already been handled'; end if;
  select * into v_ct from credential_tasks where staff_id = v_d.staff_id and certificate_type_id = v_d.certificate_type_id and state <> 'resolved';
  if v_ct.id is not null and v_ct.requests_sent > 0 and v_ct.last_request_at > now() - interval '1 day' then
    raise exception 'beehive’s staff agent already sent this reminder today. Discard the draft.';
  end if;
  v_body := coalesce(nullif(trim(p_body), ''), v_d.body);
  update staff_reminder_drafts set status = 'sent', body = v_body, decided_by = auth.uid(), decided_at = now() where id = p_id;
  select * into s from staff where id = v_d.staff_id;
  select * into ct from certificate_types where id = v_d.certificate_type_id;
  select id, expiry_date into v_cert, v_exp from staff_certificates where staff_id = v_d.staff_id and certificate_type_id = v_d.certificate_type_id
   order by expiry_date desc nulls last limit 1;
  if v_ct.id is null then
    insert into credential_tasks (centre_id, staff_id, certificate_type_id, priority, state, reason, expiry_date)
    values (v_d.centre_id, v_d.staff_id, v_d.certificate_type_id, cert_priority(coalesce(v_exp - current_date, -1), v_exp is null), 'waiting',
            case when v_exp is null then 'No ' || ct.name || ' on file' else 'Expires ' || _fmt_date(v_exp) end, v_exp)
    returning * into v_ct;
    perform _agent_event(v_d.centre_id, v_ct.id, v_d.staff_id, v_d.certificate_type_id, 'detected', 'Monitoring', 'Renewal opened from the compliance assistant',
      jsonb_build_object('priority', v_ct.priority, 'reason', v_ct.reason));
  end if;
  if coalesce(s.email, '') <> '' then v_channel := 'email'; v_to := s.email; elsif coalesce(s.phone, '') <> '' then v_channel := 'sms'; v_to := s.phone; else v_channel := 'none'; v_to := ''; end if;
  v_next := coalesce(v_d.follow_up_on, current_date + _follow_up_days(v_ct.priority));
  insert into agent_messages (centre_id, task_id, staff_id, kind, channel, recipient, subject, body, upload_link, outcome, next_follow_up)
  values (v_d.centre_id, v_ct.id, v_d.staff_id, case when v_ct.requests_sent = 0 then 'request' else 'follow_up' end, v_channel, v_to,
          'Please renew your ' || ct.name, v_body, '/#upload/' || v_ct.upload_token, case when v_channel = 'none' then 'no_contact' else 'simulated' end, v_next)
  returning id into v_msg;
  update credential_tasks set requests_sent = requests_sent + 1, last_request_at = now(), next_follow_up = v_next, updated_at = now(),
         state = case when state = 'owner_review' then state else 'waiting' end where id = v_ct.id;
  perform _agent_event(v_d.centre_id, v_ct.id, v_d.staff_id, v_d.certificate_type_id, case when v_ct.requests_sent = 0 then 'request_sent' else 'follow_up_sent' end, 'Action taken',
    'Reminder approved by you and sent', jsonb_build_object('message_id', v_msg, 'channel', v_channel, 'recipient', v_to, 'simulated', true, 'next_follow_up', v_next, 'source', 'compliance_assistant'));
  if v_cert is not null then
    insert into reminders (staff_certificate_id, channel, send_at, status, sent_at) values (v_cert, 'in_app', now(), 'sent', now());
  end if;
  perform log_audit(v_d.centre_id, 'staff_reminder.sent', 'staff_reminder_drafts', p_id::text,
    jsonb_build_object('staff_id', v_d.staff_id, 'drafted_by_agent', v_d.created_by = 'agent', 'follow_up_on', v_next, 'credential_task_id', v_ct.id));
  return jsonb_build_object('sent', true, 'follow_up_on', v_next, 'credential_task_id', v_ct.id);
end $$;
grant execute on function public.approve_staff_reminder(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. the old expiry check runs the staff agent
-- ---------------------------------------------------------------------------
create or replace function public.run_expiry_check()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); r jsonb; v_staff int;
begin
  if not is_leader() then raise exception 'Only the owner or director can run the expiry check'; end if;
  r := run_staff_agent_for(v_centre, 'expiry_check');
  select count(distinct m.staff_id) into v_staff from agent_messages m where m.centre_id = v_centre and m.sent_at = now();
  perform log_audit(v_centre, 'reminders.expiry_check', 'credential_tasks', v_centre::text, r);
  return jsonb_build_object('sent', coalesce((r->>'requests')::int, 0) + coalesce((r->>'follow_ups')::int, 0), 'staff', v_staff, 'agent', r);
end $$;
grant execute on function public.run_expiry_check() to authenticated;
