-- Beehive: audit readiness, certificate self-service, medical updates, parent messages, audit log.
-- Builds on 20261015090000_init.sql (centres, users, staff, certificates, children, incidents...).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.checklist_area as enum ('staff_records', 'childrens_records', 'safety_premises', 'policies_procedures');
create type public.evidence_kind as enum ('document', 'certificates', 'incidents', 'compliance', 'medical');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.medical_category as enum ('medical_condition', 'allergy', 'dietary', 'medication', 'development');
create type public.message_trigger as enum ('manual', 'incident', 'medical', 'document_request', 'daily_summary', 'receipt', 'reminder');
create type public.message_status as enum ('draft', 'sent', 'cancelled');
create type public.message_channel as enum ('in_app', 'email', 'sms');

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  centre_id   uuid not null references public.centres (id) on delete cascade,
  actor_id    uuid references public.users (id) on delete set null,
  action      text not null,              -- e.g. 'medical_update.approved'
  entity      text not null,              -- table name
  entity_id   text not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on public.audit_log (centre_id, created_at desc);
create index on public.audit_log (entity, entity_id);

create or replace function public.prevent_audit_changes() returns trigger
language plpgsql as $$
begin
  raise exception 'The audit log cannot be changed or deleted';
end $$;
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.prevent_audit_changes();

create or replace function public.log_audit(p_centre uuid, p_action text, p_entity text, p_entity_id text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log (centre_id, actor_id, action, entity, entity_id, detail)
  values (p_centre, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_detail, '{}'));
$$;
revoke execute on function public.log_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit-readiness checklist
-- ---------------------------------------------------------------------------
create table public.checklist_items (
  id                         uuid primary key default gen_random_uuid(),
  centre_id                  uuid not null references public.centres (id) on delete cascade,
  area                       public.checklist_area not null,
  title                      text not null,               -- plain English
  source_ref                 text not null default '',    -- e.g. 'Reg 97'
  evidence_hint              text not null default '',    -- what proves it
  evidence_kind              public.evidence_kind not null default 'document',
  cert_codes                 text[] not null default '{}',-- for evidence_kind = certificates
  compliance_requirement_id  uuid references public.compliance_requirements (id) on delete set null,
  review_months              integer not null default 12, -- documents older than this are out of date
  ai_generated               boolean not null default true,
  is_active                  boolean not null default true,
  approved_at                timestamptz,                 -- null until the owner approves the checklist
  review_required            boolean not null default false,
  review_note                text not null default '',
  created_at                 timestamptz not null default now()
);
create index on public.checklist_items (centre_id, area);

create table public.evidence (
  id                 uuid primary key default gen_random_uuid(),
  centre_id          uuid not null references public.centres (id) on delete cascade,
  checklist_item_id  uuid not null references public.checklist_items (id) on delete cascade,
  title              text not null,
  file_path          text,          -- path in the 'beehive' storage bucket
  note               text not null default '',
  recorded_on        date not null default current_date,  -- e.g. date the drill happened / policy reviewed
  uploaded_by        uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now()
);
create index on public.evidence (checklist_item_id, recorded_on desc);

create table public.regulation_updates (
  id            uuid primary key default gen_random_uuid(),
  centre_id     uuid not null references public.centres (id) on delete cascade,
  title         text not null,
  summary       text not null,
  source_url    text,
  published_on  date not null default current_date,
  created_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- Staff certificate self-service
-- ---------------------------------------------------------------------------
create table public.certificate_submissions (
  id                   uuid primary key default gen_random_uuid(),
  centre_id            uuid not null references public.centres (id) on delete cascade,
  staff_id             uuid not null references public.staff (id) on delete cascade,
  certificate_type_id  uuid not null references public.certificate_types (id),
  file_path            text,              -- photo/PDF in the 'beehive' bucket
  certificate_number   text not null default '',
  issue_date           date,
  expiry_date          date,              -- typed or extracted from the photo
  extracted_by_ai      boolean not null default false,
  status               public.review_status not null default 'pending',
  submitted_by         uuid references public.users (id) on delete set null,
  submitted_at         timestamptz not null default now(),
  reviewed_by          uuid references public.users (id) on delete set null,
  reviewed_at          timestamptz,
  review_note          text not null default ''
);
create index on public.certificate_submissions (centre_id, status);

-- Educators see where each certificate's reminder stands.
create view public.v_certificate_reminders with (security_invoker = true) as
select v.*, r.send_at as next_reminder_at,
  case
    when exists (select 1 from public.certificate_submissions cs where cs.staff_id = v.staff_id
                 and cs.certificate_type_id = (select certificate_type_id from public.staff_certificates where id = v.id)
                 and cs.status = 'pending') then 'Renewal submitted, awaiting approval'
    when v.status = 'expired' then 'Expired'
    when v.status = 'expiring_soon' then 'Renewal prompt sent (' || v.days_until_expiry || ' days remaining)'
    else 'Active'
  end as renewal_state
from public.v_certificate_status v
left join lateral (
  select send_at from public.reminders r where r.staff_certificate_id = v.id and r.status = 'scheduled' order by send_at limit 1
) r on true;

-- ---------------------------------------------------------------------------
-- Children's medical updates (parent intake -> director approval -> locked)
-- ---------------------------------------------------------------------------
create table public.medical_updates (
  id               uuid primary key default gen_random_uuid(),
  centre_id        uuid not null references public.centres (id) on delete cascade,
  child_id         uuid not null references public.children (id) on delete cascade,
  category         public.medical_category not null,
  condition        text not null,             -- e.g. 'Anaphylaxis – peanut'
  instructions     text not null default '',  -- dosage, action plan steps
  attachment_path  text,                      -- doctor's plan in the 'beehive' bucket
  parent_confirmed boolean not null check (parent_confirmed),
  submitted_by     uuid references public.users (id) on delete set null,
  submitted_at     timestamptz not null default now(),
  status           public.review_status not null default 'pending',
  approved_by      uuid references public.users (id) on delete set null,
  approved_at      timestamptz,
  review_note      text not null default ''
);
create index on public.medical_updates (centre_id, status);
create index on public.medical_updates (child_id, category, approved_at desc);

-- Approved records are locked.
create or replace function public.lock_approved_medical() returns trigger
language plpgsql as $$
begin
  if old.status = 'approved' then
    raise exception 'This medical record has been approved and is locked. Submit a new update instead.';
  end if;
  return new;
end $$;
create trigger medical_updates_lock before update on public.medical_updates
  for each row execute function public.lock_approved_medical();

-- Current medical profile: latest approved record per child and category. Educators use this as the allergy roster.
create view public.v_child_medical with (security_invoker = true) as
select distinct on (m.child_id, m.category, lower(m.condition))
  m.id, m.centre_id, m.child_id, c.first_name, c.last_name, c.room,
  m.category, m.condition, m.instructions, m.attachment_path, m.approved_at
from public.medical_updates m
join public.children c on c.id = m.child_id
where m.status = 'approved'
order by m.child_id, m.category, lower(m.condition), m.approved_at desc;

-- ---------------------------------------------------------------------------
-- Messages to parents
-- ---------------------------------------------------------------------------
create table public.parent_messages (
  id              uuid primary key default gen_random_uuid(),
  centre_id       uuid not null references public.centres (id) on delete cascade,
  child_id        uuid not null references public.children (id) on delete cascade,
  trigger         public.message_trigger not null default 'manual',
  related_id      uuid,                       -- incident / medical update / etc.
  staff_note      text not null default '',   -- what the educator asked for
  body            text not null,              -- English text staff approved
  language        text not null default 'English',
  translated_body text,                       -- in the family's preferred language, if different
  channel         public.message_channel not null default 'in_app',
  status          public.message_status not null default 'draft',
  is_automatic    boolean not null default false,  -- receipts and reminders only
  drafted_by_ai   boolean not null default false,
  created_by      uuid references public.users (id) on delete set null,
  approved_by     uuid references public.users (id) on delete set null,
  sent_at         timestamptz,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  constraint auto_only_receipts check (not is_automatic or trigger in ('receipt', 'reminder'))
);
create index on public.parent_messages (centre_id, status, created_at desc);
create index on public.parent_messages (child_id, sent_at desc);

-- Automatic message (receipts/reminders). Used inside security-definer functions only.
create or replace function public.send_auto_message(p_child uuid, p_trigger public.message_trigger, p_body text, p_related uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_centre uuid;
begin
  select centre_id into v_centre from children where id = p_child;
  insert into parent_messages (centre_id, child_id, trigger, related_id, body, status, is_automatic, sent_at)
  values (v_centre, p_child, p_trigger, p_related, p_body, 'sent', true, now())
  returning id into v_id;
  perform log_audit(v_centre, 'parent_message.auto_sent', 'parent_messages', v_id::text,
                    jsonb_build_object('trigger', p_trigger, 'child_id', p_child));
  return v_id;
end $$;
revoke execute on function public.send_auto_message(uuid, public.message_trigger, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Checklist status (needs medical_updates, so defined here)
-- ---------------------------------------------------------------------------
-- Status of every approved checklist item: green / yellow / red, with the reason.
create view public.v_checklist_status with (security_invoker = true) as
with latest_evidence as (
  select distinct on (checklist_item_id) checklist_item_id, recorded_on, created_at, title
  from public.evidence order by checklist_item_id, recorded_on desc, created_at desc
)
select
  ci.id, ci.centre_id, ci.area, ci.title, ci.source_ref, ci.evidence_hint, ci.evidence_kind,
  ci.review_required, ci.review_note,
  s.status, s.reason, s.last_updated
from public.checklist_items ci
left join latest_evidence le on le.checklist_item_id = ci.id
cross join lateral (
  select
    case
      when base.status = 'green' and ci.review_required then 'yellow'
      else base.status
    end as status,
    case
      when base.status = 'green' and ci.review_required then coalesce(nullif(ci.review_note, ''), 'Review required after a regulation change')
      else base.reason
    end as reason,
    base.last_updated
  from (
    select * from (values (1)) dummy(x)
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
              when not exists (select 1 from public.compliance_records r where r.requirement_id = ci.compliance_requirement_id and r.status = 'completed') then 'yellow'
              else 'green'
            end
          when 'medical' then
            case
              when exists (select 1 from public.medical_updates m where m.centre_id = ci.centre_id and m.status = 'pending' and m.submitted_at < now() - interval '2 days') then 'red'
              when exists (select 1 from public.medical_updates m where m.centre_id = ci.centre_id and m.status = 'pending') then 'yellow'
              else 'green'
            end
        end as status,
        case ci.evidence_kind
          when 'document' then
            case
              when le.recorded_on is null then 'No evidence on file'
              when (le.recorded_on + make_interval(months => ci.review_months))::date < current_date then 'Out of date: last recorded ' || to_char(le.recorded_on, 'DD Mon YYYY')
              when (le.recorded_on + make_interval(months => ci.review_months))::date <= current_date + least(30, greatest(5, ci.review_months * 7)) then 'Due for review by ' || to_char((le.recorded_on + make_interval(months => ci.review_months))::date, 'DD Mon YYYY')
              else 'On file: ' || le.title
            end
          when 'certificates' then coalesce(
            (select string_agg(v.staff_name || ' – ' || v.certificate_name || case when v.status = 'expired' then ' expired ' || to_char(v.expiry_date, 'DD Mon') else ' expires ' || to_char(v.expiry_date, 'DD Mon') end, '; ' order by v.expiry_date)
               from public.v_certificate_status v where v.centre_id = ci.centre_id and v.code = any (ci.cert_codes) and v.status <> 'valid'),
            case when exists (select 1 from public.v_certificate_status v where v.centre_id = ci.centre_id and v.code = any (ci.cert_codes))
                 then 'All current on the staff certificate register' else 'No certificates of this type on the register' end)
          when 'incidents' then coalesce(
            (select string_agg(d.child_name || ': ' ||
                      case when d.regulator_status = 'overdue' then 'regulator notice overdue'
                           when d.parent_status = 'overdue' then 'parent notice overdue'
                           else 'notice due within 24h' end, '; ')
               from public.v_incident_deadlines d where d.centre_id = ci.centre_id and (d.parent_status in ('pending', 'overdue') or d.regulator_status in ('pending', 'overdue'))),
            'All incident notices sent on time')
          when 'compliance' then 'From the compliance schedule'
          when 'medical' then coalesce(
            (select count(*)::text || ' medical update(s) waiting for director approval' from public.medical_updates m
              where m.centre_id = ci.centre_id and m.status = 'pending' having count(*) > 0),
            'All medical updates reviewed and active')
        end as reason,
        case ci.evidence_kind
          when 'document' then le.created_at
          when 'certificates' then (select max(sc.created_at) from public.staff_certificates sc join public.staff st on st.id = sc.staff_id where st.centre_id = ci.centre_id)
          when 'incidents' then (select max(i.created_at) from public.incidents i where i.centre_id = ci.centre_id)
          when 'compliance' then (select max(coalesce(r.completed_on::timestamptz, r.created_at)) from public.compliance_records r where r.requirement_id = ci.compliance_requirement_id)
          when 'medical' then (select max(m.submitted_at) from public.medical_updates m where m.centre_id = ci.centre_id)
        end as last_updated
    ) calc
  ) base
) s
where ci.is_active and ci.approved_at is not null;

-- ---------------------------------------------------------------------------
-- Triggers that write the audit log and send receipts
-- ---------------------------------------------------------------------------
create or replace function public.audit_evidence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform log_audit(new.centre_id, 'evidence.added', 'evidence', new.id::text,
    jsonb_build_object('checklist_item_id', new.checklist_item_id, 'title', new.title, 'recorded_on', new.recorded_on));
  return new;
end $$;
create trigger evidence_audit after insert on public.evidence for each row execute function public.audit_evidence();

create or replace function public.audit_compliance_record() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform log_audit(new.centre_id, 'compliance_record.' || new.status, 'compliance_records', new.id::text,
      jsonb_build_object('completed_on', new.completed_on, 'evidence_url', new.evidence_url));
  end if;
  return new;
end $$;
create trigger compliance_records_audit after update of status on public.compliance_records
  for each row execute function public.audit_compliance_record();

create or replace function public.audit_incident() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_audit(new.centre_id, 'incident.logged', 'incidents', new.id::text,
      jsonb_build_object('child_id', new.child_id, 'is_serious', new.is_serious, 'occurred_at', new.occurred_at));
  else
    if new.parent_notified_at is distinct from old.parent_notified_at then
      perform log_audit(new.centre_id, 'incident.parent_notified', 'incidents', new.id::text, jsonb_build_object('at', new.parent_notified_at));
    end if;
    if new.regulator_notified_at is distinct from old.regulator_notified_at then
      perform log_audit(new.centre_id, 'incident.regulator_notified', 'incidents', new.id::text, jsonb_build_object('at', new.regulator_notified_at));
    end if;
  end if;
  return new;
end $$;
create trigger incidents_audit after insert or update on public.incidents
  for each row execute function public.audit_incident();

create or replace function public.on_medical_update_submitted() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_child children; v_centre_name text; v_label text;
begin
  select * into v_child from children where id = new.child_id;
  select name into v_centre_name from centres where id = new.centre_id;
  v_label := case new.category
    when 'medical_condition' then 'medical condition update'
    when 'allergy' then 'allergy / action plan update'
    when 'dietary' then 'dietary update'
    when 'medication' then 'medication update'
    else 'development update' end;
  perform log_audit(new.centre_id, 'medical_update.submitted', 'medical_updates', new.id::text,
    jsonb_build_object('child_id', new.child_id, 'category', new.category, 'condition', new.condition));
  perform send_auto_message(new.child_id, 'receipt',
    'Receipt confirmed: ' || v_child.first_name || '''s ' || v_label || ' (' || new.condition || ') has been received by '
    || v_centre_name || ' and is waiting for the director to review it. We''ll confirm when it is active in '
    || coalesce(nullif(v_child.room, ''), 'the room') || '.', new.id);
  return new;
end $$;
create trigger medical_updates_submitted after insert on public.medical_updates
  for each row execute function public.on_medical_update_submitted();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Step 1 of the compliance flow: draft the baseline checklist (owner then reviews and approves).
-- Items are a curated starting point from the Education and Care Services National Regulations.
-- An AI assistant can add or reword items; every item keeps its source reference.
create or replace function public.generate_checklist()
returns integer language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); v_count int;
begin
  if not is_leader() then raise exception 'Only the owner or director can generate the checklist'; end if;
  if exists (select 1 from checklist_items where centre_id = v_centre and is_active) then
    raise exception 'A checklist already exists for this centre';
  end if;
  insert into checklist_items (centre_id, area, title, source_ref, evidence_hint, evidence_kind, cert_codes, review_months) values
    (v_centre, 'staff_records', 'Every educator has a current Working with Children Check', 'Reg 145–147', 'WWCC number and expiry for each staff member', 'certificates', '{WWCC}', 12),
    (v_centre, 'staff_records', 'First aid, anaphylaxis and asthma-trained educators on the register', 'Reg 136', 'Current first aid (HLTAID012), anaphylaxis and asthma certificates', 'certificates', '{FIRST_AID,ANAPHYLAXIS,ASTHMA}', 12),
    (v_centre, 'staff_records', 'CPR refreshers are current', 'Reg 136', 'CPR (HLTAID009) completed in the last 12 months', 'certificates', '{CPR}', 12),
    (v_centre, 'staff_records', 'Responsible person and educator rosters are recorded', 'Reg 150–151', 'Daily record of the responsible person and educators working with children', 'document', '{}', 1),
    (v_centre, 'childrens_records', 'Enrolment records include health information and authorisations', 'Reg 160–162', 'Up-to-date enrolment forms with medical and emergency contact details', 'document', '{}', 12),
    (v_centre, 'childrens_records', 'Medical action plans are current and approved', 'Reg 90, 162', 'Approved action plans for every child with a medical condition', 'medical', '{}', 12),
    (v_centre, 'childrens_records', 'Incident records and parent notifications within 24 hours', 'Reg 86–87', 'Incident record for each event, parent notified within 24 hours', 'incidents', '{}', 12),
    (v_centre, 'childrens_records', 'Medication administration records', 'Reg 92–93', 'Signed medication records for every dose given', 'document', '{}', 3),
    (v_centre, 'safety_premises', 'Emergency evacuation rehearsed every 3 months', 'Reg 97', 'Drill log dated within the last 3 months', 'document', '{}', 3),
    (v_centre, 'safety_premises', 'Premises, furniture and equipment are safe and in good repair', 'Reg 103', 'Recent playground and premises safety check', 'document', '{}', 1),
    (v_centre, 'safety_premises', 'Excursion risk assessments completed', 'Reg 100–102', 'Risk assessment for each excursion or regular outing', 'document', '{}', 12),
    (v_centre, 'policies_procedures', 'Sun protection policy reviewed', 'Reg 168', 'Policy with a review date in the last 12 months', 'document', '{}', 12),
    (v_centre, 'policies_procedures', 'Sleep and rest policy reviewed', 'Reg 84A–84B, 168', 'Policy with a review date in the last 12 months', 'document', '{}', 12),
    (v_centre, 'policies_procedures', 'Medical conditions policy reviewed and given to families', 'Reg 90–91', 'Policy reviewed in the last 12 months and shared with parents', 'document', '{}', 12),
    (v_centre, 'policies_procedures', 'Child safe environment and child protection policy', 'Reg 84, 168', 'Policy reviewed in the last 12 months; staff aware of child protection law', 'document', '{}', 12),
    (v_centre, 'policies_procedures', 'Quality Improvement Plan reviewed', 'Reg 55–56', 'QIP reviewed at least annually', 'document', '{}', 12);
  get diagnostics v_count = row_count;
  perform log_audit(v_centre, 'checklist.generated', 'checklist_items', v_centre::text, jsonb_build_object('items', v_count));
  return v_count;
end $$;

create or replace function public.approve_checklist()
returns integer language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); v_count int;
begin
  if not is_leader() then raise exception 'Only the owner or director can approve the checklist'; end if;
  update checklist_items set approved_at = now() where centre_id = v_centre and is_active and approved_at is null;
  get diagnostics v_count = row_count;
  perform log_audit(v_centre, 'checklist.approved', 'checklist_items', v_centre::text, jsonb_build_object('items', v_count));
  return v_count;
end $$;

-- Overall readiness, e.g. "88% Audit-Ready". Green counts fully, yellow counts half.
create view public.v_readiness with (security_invoker = true) as
select
  centre_id,
  count(*)::int as total_items,
  count(*) filter (where status = 'green')::int as green,
  count(*) filter (where status = 'yellow')::int as yellow,
  count(*) filter (where status = 'red')::int as red,
  case when count(*) = 0 then 0
       else round(100.0 * (count(*) filter (where status = 'green') + 0.5 * count(*) filter (where status = 'yellow')) / count(*))::int
  end as score
from public.v_checklist_status
group by centre_id;

-- Step 5: record a regulation change and flag affected checklist items for review.
create or replace function public.apply_regulation_update(p_title text, p_summary text, p_match_terms text[], p_source_url text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); v_id uuid; v_count int;
begin
  if not is_leader() then raise exception 'Only the owner or director can record regulation updates'; end if;
  insert into regulation_updates (centre_id, title, summary, source_url) values (v_centre, p_title, p_summary, p_source_url)
  returning id into v_id;
  update checklist_items ci set review_required = true, review_note = 'Review required: ' || p_title
  where ci.centre_id = v_centre and ci.is_active
    and exists (select 1 from unnest(p_match_terms) t where ci.title ilike '%' || t || '%' or ci.source_ref ilike '%' || t || '%');
  get diagnostics v_count = row_count;
  perform log_audit(v_centre, 'regulation_update.applied', 'regulation_updates', v_id::text,
    jsonb_build_object('title', p_title, 'items_flagged', v_count));
  return v_count;
end $$;

create or replace function public.accept_review(p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id();
begin
  if not is_leader() then raise exception 'Only the owner or director can accept reviews'; end if;
  update checklist_items set review_required = false, review_note = '' where id = p_item and centre_id = v_centre;
  if not found then raise exception 'Checklist item not found'; end if;
  perform log_audit(v_centre, 'checklist_item.review_accepted', 'checklist_items', p_item::text, '{}');
end $$;

-- Step 4: spot-check search. Runs with the caller's permissions (RLS applies).
create or replace function public.spot_check_search(p_query text)
returns table (kind text, title text, detail text, status text, last_updated timestamptz, ref_id uuid)
language sql stable security invoker set search_path = public as $$
  with qq as (select lower(trim(p_query)) as q)
  select 'certificate', v.certificate_name, v.staff_name || coalesce(' · ' || nullif(v.certificate_number, ''), '') || ' · expires ' || coalesce(to_char(v.expiry_date, 'DD Mon YYYY'), 'never'),
         v.status, sc.created_at, v.id
  from v_certificate_status v join staff_certificates sc on sc.id = v.id, qq
  where qq.q <> '' and (
       lower(v.certificate_name) like '%' || qq.q || '%' or lower(v.staff_name) like '%' || qq.q || '%' or lower(v.code) like '%' || qq.q || '%'
    or (qq.q like '%wwc%' or qq.q like '%working with children%') and v.code = 'WWCC'
    or qq.q like '%first aid%' and v.code in ('FIRST_AID', 'CPR', 'ANAPHYLAXIS', 'ASTHMA')
    or qq.q like '%certific%' or qq.q like '%qualif%')
  union all
  select 'incident', 'Incident: ' || d.child_name, to_char(d.occurred_at at time zone 'Australia/Sydney', 'DD Mon YYYY HH12:MI am') || ' · parent ' || d.parent_status
           || case when d.regulator_status <> 'not_required' then ' · regulator ' || d.regulator_status else '' end,
         case when d.parent_status = 'overdue' or d.regulator_status = 'overdue' then 'overdue' when d.parent_status = 'pending' or d.regulator_status = 'pending' then 'pending' else 'done' end,
         i.created_at, d.id
  from v_incident_deadlines d join incidents i on i.id = d.id, qq
  where qq.q <> '' and (qq.q like '%incident%' or qq.q like '%injur%' or lower(d.child_name) like '%' || qq.q || '%' or lower(i.description) like '%' || qq.q || '%')
  union all
  select 'checklist', c.title, c.source_ref || ' · ' || coalesce(c.reason, ''), c.status, c.last_updated, c.id
  from v_checklist_status c, qq
  where qq.q <> '' and (lower(c.title) like '%' || qq.q || '%' or lower(c.source_ref) like '%' || qq.q || '%' or lower(c.evidence_hint) like '%' || qq.q || '%')
  union all
  select 'evidence', e.title, coalesce(ci.title, '') || ' · recorded ' || to_char(e.recorded_on, 'DD Mon YYYY'), 'on_file', e.created_at, e.id
  from evidence e join checklist_items ci on ci.id = e.checklist_item_id, qq
  where qq.q <> '' and (lower(e.title) like '%' || qq.q || '%' or lower(ci.title) like '%' || qq.q || '%' or lower(e.note) like '%' || qq.q || '%')
  union all
  select 'medical', m.first_name || ' ' || m.last_name || ': ' || m.condition, m.category || ' · ' || coalesce(nullif(m.room, ''), 'no room') , 'approved', m.approved_at, m.id
  from v_child_medical m, qq
  where qq.q <> '' and (qq.q like '%medic%' or qq.q like '%allerg%' or qq.q like '%action plan%' or lower(m.condition) like '%' || qq.q || '%' or lower(m.first_name) like '%' || qq.q || '%')
  order by 5 desc nulls last
  limit 50;
$$;

-- Staff certificate flow: an educator submits a renewal for their own record.
create or replace function public.submit_certificate(p_type_code text, p_expiry date, p_file_path text default null,
                                                     p_number text default '', p_issue date default null, p_extracted_by_ai boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_staff staff; v_type uuid; v_id uuid;
begin
  select * into v_staff from staff where user_id = auth.uid() and is_active;
  if not found then raise exception 'You are not on this centre''s staff register yet. Ask the director to add you.'; end if;
  select id into v_type from certificate_types where code = upper(p_type_code);
  if v_type is null then raise exception 'Unknown certificate type %', p_type_code; end if;
  if p_expiry is not null and p_expiry < current_date then raise exception 'That expiry date has already passed'; end if;
  insert into certificate_submissions (centre_id, staff_id, certificate_type_id, file_path, certificate_number, issue_date, expiry_date, extracted_by_ai, submitted_by)
  values (v_staff.centre_id, v_staff.id, v_type, p_file_path, coalesce(p_number, ''), p_issue, p_expiry, coalesce(p_extracted_by_ai, false), auth.uid())
  returning id into v_id;
  perform log_audit(v_staff.centre_id, 'certificate.submitted', 'certificate_submissions', v_id::text,
    jsonb_build_object('staff_id', v_staff.id, 'type', upper(p_type_code), 'expiry_date', p_expiry));
  return v_id;
end $$;

-- Director verifies. Approving updates (or creates) the certificate, which reschedules its reminder.
create or replace function public.review_certificate(p_submission uuid, p_approve boolean, p_expiry date default null, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_sub certificate_submissions; v_cert uuid; v_expiry date;
begin
  if not is_leader() then raise exception 'Only the owner or director can verify certificates'; end if;
  select * into v_sub from certificate_submissions where id = p_submission and centre_id = my_centre_id();
  if not found then raise exception 'Submission not found'; end if;
  if v_sub.status <> 'pending' then raise exception 'This submission has already been reviewed'; end if;
  v_expiry := coalesce(p_expiry, v_sub.expiry_date);
  if p_approve then
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
  end if;
  update certificate_submissions set status = case when p_approve then 'approved'::review_status else 'rejected' end,
    expiry_date = v_expiry, reviewed_by = auth.uid(), reviewed_at = now(), review_note = coalesce(p_note, '')
  where id = p_submission;
  perform log_audit(v_sub.centre_id, case when p_approve then 'certificate.approved' else 'certificate.rejected' end,
    'certificate_submissions', p_submission::text, jsonb_build_object('staff_certificate_id', v_cert, 'expiry_date', v_expiry));
end $$;

-- Parent medical flow, step 4: director approves and publishes (record locks), parents get confirmation.
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
  select * into v_child from children where id = v_m.child_id;
  perform log_audit(v_m.centre_id, case when p_approve then 'medical_update.approved' else 'medical_update.rejected' end,
    'medical_updates', p_update::text,
    jsonb_build_object('child_id', v_m.child_id, 'category', v_m.category, 'condition', v_m.condition,
                       'submitted_by', v_m.submitted_by, 'submitted_at', v_m.submitted_at, 'regulations', 'Reg 90, 162'));
  perform send_auto_message(v_m.child_id, 'receipt',
    case when p_approve
      then v_child.first_name || '''s ' || v_m.condition || ' details are now active in ' || coalesce(nullif(v_child.room, ''), 'the room')
           || '. Room educators have the updated information.'
      else v_child.first_name || '''s ' || v_m.condition || ' update needs a change before we can activate it: '
           || coalesce(nullif(p_note, ''), 'please contact the centre.') end,
    p_update);
end $$;

-- Ask a family to upload something (automatic reminder, no approval needed).
create or replace function public.request_document(p_child uuid, p_what text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_child children;
begin
  if not is_staff() then raise exception 'Only staff can request documents'; end if;
  select * into v_child from children where id = p_child and centre_id = my_centre_id();
  if not found then raise exception 'Child not found'; end if;
  return send_auto_message(p_child, 'reminder',
    'Reminder: please upload ' || v_child.first_name || '''s ' || p_what || ' in the Beehive parent portal so our records stay up to date. Thank you!');
end $$;

-- Messages about a child's wellbeing or an incident: staff approve every one.
create or replace function public.approve_parent_message(p_message uuid, p_body text default null, p_channel public.message_channel default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_msg parent_messages;
begin
  if not is_staff() then raise exception 'Only staff can approve messages'; end if;
  select * into v_msg from parent_messages where id = p_message and centre_id = my_centre_id();
  if not found then raise exception 'Message not found'; end if;
  if v_msg.status <> 'draft' then raise exception 'This message has already been sent or cancelled'; end if;
  if coalesce(nullif(trim(coalesce(p_body, v_msg.body)), ''), null) is null then raise exception 'The message is empty'; end if;
  update parent_messages set body = coalesce(nullif(trim(p_body), ''), body), channel = coalesce(p_channel, channel),
    status = 'sent', approved_by = auth.uid(), sent_at = now()
  where id = p_message;
  if v_msg.trigger = 'incident' and v_msg.related_id is not null then
    update incidents set parent_notified_at = coalesce(parent_notified_at, now()) where id = v_msg.related_id;
  end if;
  perform log_audit(v_msg.centre_id, 'parent_message.approved_and_sent', 'parent_messages', p_message::text,
    jsonb_build_object('child_id', v_msg.child_id, 'trigger', v_msg.trigger, 'drafted_by_ai', v_msg.drafted_by_ai,
                       'ai_draft', v_msg.body, 'final', coalesce(nullif(trim(p_body), ''), v_msg.body)));
end $$;

create or replace function public.mark_parent_messages_read(p_child uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_parent_of(p_child) then raise exception 'Not allowed'; end if;
  update parent_messages set read_at = now() where child_id = p_child and status = 'sent' and read_at is null;
end $$;


-- Beehive demo: approved checklist with realistic evidence, a regulation update and an AI draft.
-- Run after load_demo_data(). Owner/director only.
create or replace function public.load_beehive_demo()
returns void language plpgsql security definer set search_path = public as $$
declare v_centre uuid := my_centre_id(); v_me uuid := auth.uid(); v_oli uuid; v_inc uuid;
begin
  if not is_leader() then raise exception 'Only the owner or director can load demo data'; end if;
  if not exists (select 1 from checklist_items where centre_id = v_centre and is_active) then
    perform generate_checklist();
  end if;
  update checklist_items set is_active = false where centre_id = v_centre and title like 'Excursion%';
  update checklist_items set approved_at = now() where centre_id = v_centre and is_active and approved_at is null;

  insert into evidence (centre_id, checklist_item_id, title, recorded_on, uploaded_by, note)
  select v_centre, ci.id, x.t, current_date - x.days_ago, v_me, x.note
  from checklist_items ci
  join (values
    ('Responsible person%',      'Responsible person register – this week',      2,    ''),
    ('Enrolment records%',       'Enrolment forms audit – all rooms',            40,   '58 of 58 forms complete'),
    ('Medication administration%','Medication record book – current term',       12,   ''),
    ('Premises, furniture%',     'Weekly playground safety check',               6,    'Loose fence paling fixed'),
    ('Emergency evacuation%',    'Evacuation drill – all rooms',                 120,  'Last drill was over 3 months ago'),
    ('Sun protection%',          'Sun protection policy (reviewed 2023)',        1100, ''),
    ('Sleep and rest%',          'Sleep and rest policy',                        200,  ''),
    ('Medical conditions%',      'Medical conditions policy – emailed to families', 90, ''),
    ('Child safe environment%',  'Child safe environment policy',                345,  'Review due soon'),
    ('Quality Improvement%',     'QIP 2026 review',                              60,   '')
  ) as x(pattern, t, days_ago, note) on ci.title like x.pattern
  where ci.centre_id = v_centre;

  update checklist_items ci set compliance_requirement_id = r.id
  from compliance_requirements r where r.centre_id = v_centre and ci.centre_id = v_centre
    and ci.title like 'Emergency evacuation%' and r.title like 'Emergency%' and ci.evidence_kind = 'compliance';

  select id into v_oli from children where centre_id = v_centre and first_name = 'Oliver' limit 1;
  select id into v_inc from incidents where centre_id = v_centre and child_id = v_oli limit 1;
  if v_oli is not null then
    insert into parent_messages (centre_id, child_id, trigger, related_id, staff_note, body, drafted_by_ai, created_by)
    values (v_centre, v_oli, 'incident', v_inc, 'bitten on arm in block corner, skin not broken, cold pack',
      'Hi, we wanted to let you know Oliver was bitten on the forearm by another child during block play today. The skin wasn''t broken. '
      || 'We washed the area, applied a cold pack and watched him for 30 minutes, and he was happy to keep playing. '
      || 'Please let us know if you have any questions.', true, v_me);
  end if;
  perform log_audit(v_centre, 'demo.loaded', 'centres', v_centre::text, '{}');
end $$;
grant execute on function public.load_beehive_demo() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.audit_log               enable row level security;
alter table public.checklist_items         enable row level security;
alter table public.evidence                enable row level security;
alter table public.regulation_updates      enable row level security;
alter table public.certificate_submissions enable row level security;
alter table public.medical_updates         enable row level security;
alter table public.parent_messages         enable row level security;

-- Audit log: leaders read. Nobody writes directly (only the functions above).
create policy "leaders read audit log" on public.audit_log for select using (centre_id = public.my_centre_id() and public.is_leader());

create policy "staff read checklist" on public.checklist_items for select using (centre_id = public.my_centre_id() and public.is_staff());
create policy "leaders manage checklist" on public.checklist_items for all
  using (centre_id = public.my_centre_id() and public.is_leader())
  with check (centre_id = public.my_centre_id() and public.is_leader());

create policy "staff read evidence" on public.evidence for select using (centre_id = public.my_centre_id() and public.is_staff());
create policy "staff add evidence" on public.evidence for insert
  with check (centre_id = public.my_centre_id() and public.is_staff() and uploaded_by = auth.uid()
              and exists (select 1 from public.checklist_items ci where ci.id = checklist_item_id and ci.centre_id = public.my_centre_id()));

create policy "staff read regulation updates" on public.regulation_updates for select using (centre_id = public.my_centre_id() and public.is_staff());

create policy "leaders read submissions" on public.certificate_submissions for select using (centre_id = public.my_centre_id() and public.is_leader());
create policy "educators read own submissions" on public.certificate_submissions for select using (submitted_by = auth.uid());

create policy "staff read medical updates" on public.medical_updates for select using (centre_id = public.my_centre_id() and public.is_staff());
create policy "parents read own child medical updates" on public.medical_updates for select using (public.is_parent_of(child_id));
create policy "parents submit medical updates" on public.medical_updates for insert
  with check (public.is_parent_of(child_id) and submitted_by = auth.uid() and status = 'pending'
              and approved_by is null and approved_at is null
              and centre_id = (select c.centre_id from public.children c where c.id = child_id));

create policy "staff read parent messages" on public.parent_messages for select using (centre_id = public.my_centre_id() and public.is_staff());
create policy "staff create drafts" on public.parent_messages for insert
  with check (centre_id = public.my_centre_id() and public.is_staff() and created_by = auth.uid()
              and status = 'draft' and not is_automatic and sent_at is null and approved_by is null
              and exists (select 1 from public.children c where c.id = child_id and c.centre_id = public.my_centre_id()));
create policy "staff edit drafts" on public.parent_messages for update
  using (centre_id = public.my_centre_id() and public.is_staff() and status = 'draft')
  with check (centre_id = public.my_centre_id() and public.is_staff() and status in ('draft', 'cancelled') and sent_at is null and not is_automatic);
create policy "parents read sent messages" on public.parent_messages for select using (status = 'sent' and public.is_parent_of(child_id));

grant execute on function public.generate_checklist() to authenticated;
grant execute on function public.approve_checklist() to authenticated;
grant execute on function public.apply_regulation_update(text, text, text[], text) to authenticated;
grant execute on function public.accept_review(uuid) to authenticated;
grant execute on function public.spot_check_search(text) to authenticated;
grant execute on function public.submit_certificate(text, date, text, text, date, boolean) to authenticated;
grant execute on function public.review_certificate(uuid, boolean, date, text) to authenticated;
grant execute on function public.review_medical_update(uuid, boolean, text) to authenticated;
grant execute on function public.request_document(uuid, text) to authenticated;
grant execute on function public.approve_parent_message(uuid, text, public.message_channel) to authenticated;
grant execute on function public.mark_parent_messages_read(uuid) to authenticated;

-- Live updates for the director's flags and the parent inbox.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['medical_updates', 'parent_messages', 'certificate_submissions'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- File storage: private 'beehive' bucket, one folder per centre (<centre_id>/...).
-- Parents may only use <centre_id>/medical/<child_id>/... for their own child.
-- Skipped automatically where Supabase Storage isn't installed (e.g. local tests).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('beehive', 'beehive', false) on conflict (id) do nothing;

    execute $p$create policy "centre members read beehive files" on storage.objects for select to authenticated
      using (bucket_id = 'beehive' and (storage.foldername(name))[1] = public.my_centre_id()::text
             and (public.is_staff() or ((storage.foldername(name))[2] = 'medical' and public.is_parent_of(((storage.foldername(name))[3])::uuid))))$p$;
    execute $p$create policy "centre members upload beehive files" on storage.objects for insert to authenticated
      with check (bucket_id = 'beehive' and (storage.foldername(name))[1] = public.my_centre_id()::text
                  and (public.is_staff() or ((storage.foldername(name))[2] = 'medical' and public.is_parent_of(((storage.foldername(name))[3])::uuid))))$p$;
  end if;
end $$;
