-- Big Mother: initial schema (follows SPEC.md)
-- Compliance tracking for long day care centres + educator updates for families.
-- gen_random_uuid() is built into Postgres 13+, no extension needed.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('owner', 'director', 'educator', 'parent');
create type public.compliance_status as enum ('pending', 'completed', 'not_applicable');
create type public.reminder_status as enum ('scheduled', 'sent', 'cancelled', 'failed');
create type public.update_kind as enum ('daily', 'observation', 'photo', 'announcement');

-- ---------------------------------------------------------------------------
-- Tables (SPEC.md › Data)
-- ---------------------------------------------------------------------------
create table public.centres (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  suburb       text not null default '',
  state        text not null default 'NSW',
  -- Not in SPEC: join codes so staff and families can attach themselves to a centre.
  staff_code   text not null unique default upper(substr(md5(random()::text), 1, 6)),
  family_code  text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at   timestamptz not null default now()
);

-- App users (one row per Supabase Auth user).
create table public.users (
  id                  uuid primary key references auth.users (id) on delete cascade,
  centre_id           uuid references public.centres (id) on delete set null,
  full_name           text not null default '',
  email               text not null,
  phone               text not null default '',
  role                public.user_role,
  preferred_language  text not null default 'English',
  created_at          timestamptz not null default now()
);
create index on public.users (centre_id);
create index on public.users (lower(email));

-- Staff records. user_id is null for staff who don't use the app yet.
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  centre_id   uuid not null references public.centres (id) on delete cascade,
  user_id     uuid references public.users (id) on delete set null,
  full_name   text not null,
  email       text not null default '',
  phone       text not null default '',
  position    text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on public.staff (centre_id);
create unique index on public.staff (user_id) where user_id is not null;

create table public.certificate_types (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  expires        boolean not null default true,
  reminder_days  integer not null default 60
);

create table public.staff_certificates (
  id                   uuid primary key default gen_random_uuid(),
  staff_id             uuid not null references public.staff (id) on delete cascade,
  certificate_type_id  uuid not null references public.certificate_types (id),
  certificate_number   text not null default '',
  issue_date           date,
  expiry_date          date,
  document_url         text,
  created_at           timestamptz not null default now()
);
create index on public.staff_certificates (staff_id);
create index on public.staff_certificates (expiry_date);

create table public.reminders (
  id                    uuid primary key default gen_random_uuid(),
  staff_certificate_id  uuid not null references public.staff_certificates (id) on delete cascade,
  channel               text not null default 'email',
  send_at               timestamptz not null,
  status                public.reminder_status not null default 'scheduled',
  sent_at               timestamptz
);
create index on public.reminders (status, send_at);

create table public.compliance_requirements (
  id                    uuid primary key default gen_random_uuid(),
  centre_id             uuid not null references public.centres (id) on delete cascade,
  title                 text not null,
  regulation_reference  text not null default '',   -- e.g. 'Reg 97'
  category              text not null default 'General',
  frequency             text not null default 'annual', -- daily, weekly, monthly, quarterly, annual, once
  is_active             boolean not null default true
);
create index on public.compliance_requirements (centre_id);

create table public.compliance_records (
  id              uuid primary key default gen_random_uuid(),
  centre_id       uuid not null references public.centres (id) on delete cascade,
  requirement_id  uuid not null references public.compliance_requirements (id) on delete cascade,
  status          public.compliance_status not null default 'pending',
  due_date        date not null,
  completed_on    date,
  completed_by    uuid references public.users (id) on delete set null,
  evidence_url    text,
  notes           text not null default '',
  created_at      timestamptz not null default now()
);
create index on public.compliance_records (centre_id, status, due_date);

create table public.compliance_summaries (
  id                 uuid primary key default gen_random_uuid(),
  centre_id          uuid not null references public.centres (id) on delete cascade,
  summary            text not null,
  source_record_ids  uuid[] not null default '{}',  -- every record the summary was built from
  model              text not null,
  generated_at       timestamptz not null default now()
);
create index on public.compliance_summaries (centre_id, generated_at desc);

create table public.children (
  id             uuid primary key default gen_random_uuid(),
  centre_id      uuid not null references public.centres (id) on delete cascade,
  first_name     text not null,
  last_name      text not null default '',
  date_of_birth  date,
  room           text not null default '',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index on public.children (centre_id);

create table public.child_parents (
  child_id      uuid not null references public.children (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  relationship  text not null default 'Parent',
  primary key (child_id, user_id)
);
create index on public.child_parents (user_id);

create table public.incidents (
  id                     uuid primary key default gen_random_uuid(),
  centre_id              uuid not null references public.centres (id) on delete cascade,
  child_id               uuid not null references public.children (id) on delete cascade,
  reported_by            uuid references public.users (id) on delete set null,
  occurred_at            timestamptz not null,
  description            text not null,
  action_taken           text not null default '',
  is_serious             boolean not null default false,
  parent_notified_at     timestamptz,
  regulator_notified_at  timestamptz,
  created_at             timestamptz not null default now()
);
create index on public.incidents (centre_id, occurred_at desc);
create index on public.incidents (child_id);

create table public.updates (
  id            uuid primary key default gen_random_uuid(),
  centre_id     uuid not null references public.centres (id) on delete cascade,
  child_id      uuid references public.children (id) on delete cascade,  -- null = whole-centre announcement
  author_id     uuid references public.users (id) on delete set null,
  kind          public.update_kind not null default 'daily',
  title         text not null,
  body          text not null default '',
  media_urls    text[] not null default '{}',
  published_at  timestamptz,  -- null = draft, hidden from families
  created_at    timestamptz not null default now()
);
create index on public.updates (centre_id, published_at desc);
create index on public.updates (child_id, published_at desc);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  centre_id  uuid not null references public.centres (id) on delete cascade,
  child_id   uuid not null references public.children (id) on delete cascade,  -- one thread per child
  sender_id  uuid not null references public.users (id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  sent_at    timestamptz not null default now(),
  read_at    timestamptz
);
create index on public.messages (child_id, sent_at);

-- ---------------------------------------------------------------------------
-- Calculated views (not stored). security_invoker = RLS of the caller applies.
-- ---------------------------------------------------------------------------
create view public.v_certificate_status with (security_invoker = true) as
select
  sc.id,
  sc.staff_id,
  s.centre_id,
  s.full_name as staff_name,
  s.position,
  s.user_id as staff_user_id,
  ct.code,
  ct.name as certificate_name,
  ct.expires,
  ct.reminder_days,
  sc.certificate_number,
  sc.issue_date,
  sc.expiry_date,
  sc.document_url,
  case
    when not ct.expires or sc.expiry_date is null then 'valid'
    when sc.expiry_date < current_date then 'expired'
    when sc.expiry_date <= current_date + ct.reminder_days then 'expiring_soon'
    else 'valid'
  end as status,
  (sc.expiry_date - current_date) as days_until_expiry
from public.staff_certificates sc
join public.staff s on s.id = sc.staff_id and s.is_active
join public.certificate_types ct on ct.id = sc.certificate_type_id;

-- Education and Care Services National Regulations: notify parents as soon as
-- practicable and within 24 hours; notify the regulator of serious incidents within 24 hours.
create view public.v_incident_deadlines with (security_invoker = true) as
select
  i.id,
  i.centre_id,
  i.child_id,
  trim(c.first_name || ' ' || c.last_name) as child_name,
  i.occurred_at,
  i.is_serious,
  i.occurred_at + interval '24 hours' as parent_due_at,
  case
    when i.parent_notified_at is not null then 'done'
    when now() > i.occurred_at + interval '24 hours' then 'overdue'
    else 'pending'
  end as parent_status,
  case
    when not i.is_serious then 'not_required'
    when i.regulator_notified_at is not null then 'done'
    when now() > i.occurred_at + interval '24 hours' then 'overdue'
    else 'pending'
  end as regulator_status
from public.incidents i
join public.children c on c.id = i.child_id;

create view public.v_centre_overview with (security_invoker = true) as
select
  ce.id as centre_id,
  ce.name,
  (select count(*) from public.v_certificate_status v where v.centre_id = ce.id and v.status = 'expired')::int       as expired_certificates,
  (select count(*) from public.v_certificate_status v where v.centre_id = ce.id and v.status = 'expiring_soon')::int as expiring_certificates,
  (select count(*) from public.compliance_records r where r.centre_id = ce.id and r.status = 'pending' and r.due_date < current_date)::int as overdue_compliance,
  (select count(*) from public.compliance_records r where r.centre_id = ce.id and r.status = 'pending' and r.due_date between current_date and current_date + 14)::int as due_soon_compliance,
  (select count(*) from public.v_incident_deadlines d where d.centre_id = ce.id and (d.parent_status = 'overdue' or d.regulator_status = 'overdue'))::int as overdue_incident_notices,
  (select count(*) from public.v_incident_deadlines d where d.centre_id = ce.id and (d.parent_status = 'pending' or d.regulator_status = 'pending'))::int as pending_incident_notices,
  (select count(*) from public.staff s where s.centre_id = ce.id and s.is_active)::int as active_staff,
  (select max(generated_at) from public.compliance_summaries cs where cs.centre_id = ce.id) as latest_summary_at
from public.centres ce;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.my_centre_id() returns uuid
language sql stable security definer set search_path = public as $$
  select centre_id from public.users where id = auth.uid()
$$;

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.is_leader() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner', 'director') from public.users where id = auth.uid()), false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner', 'director', 'educator') from public.users where id = auth.uid()), false)
$$;

create or replace function public.is_parent_of(p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.child_parents where child_id = p_child and user_id = auth.uid())
$$;

create or replace function public.can_see_child(p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_parent_of(p_child)
      or (public.is_staff() and exists (select 1 from public.children where id = p_child and centre_id = public.my_centre_id()))
$$;

-- New auth user -> users row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Schedule a reminder whenever a certificate is added or its expiry changes.
create or replace function public.schedule_certificate_reminder() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_days int; v_expires boolean;
begin
  if tg_op = 'UPDATE' and new.expiry_date is not distinct from old.expiry_date then
    return new;
  end if;
  update reminders set status = 'cancelled'
   where staff_certificate_id = new.id and status = 'scheduled';
  select reminder_days, expires into v_days, v_expires from certificate_types where id = new.certificate_type_id;
  if v_expires and new.expiry_date is not null then
    insert into reminders (staff_certificate_id, channel, send_at)
    values (new.id, 'email',
            greatest(now(), (new.expiry_date - v_days)::timestamptz + interval '9 hours'));
  end if;
  return new;
end $$;

create trigger staff_certificates_reminder
  after insert or update of expiry_date on public.staff_certificates
  for each row execute function public.schedule_certificate_reminder();

-- When a recurring compliance record is completed, schedule the next one.
create or replace function public.schedule_next_compliance_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_req compliance_requirements; v_next date; v_base date;
begin
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;
  select * into v_req from compliance_requirements where id = new.requirement_id;
  if not v_req.is_active then return new; end if;
  v_base := coalesce(new.completed_on, current_date);
  v_next := case v_req.frequency
    when 'daily'       then v_base + 1
    when 'weekly'      then v_base + 7
    when 'monthly'     then (v_base + interval '1 month')::date
    when 'quarterly'   then (v_base + interval '3 months')::date
    when 'six-monthly' then (v_base + interval '6 months')::date
    when 'annual'      then (v_base + interval '1 year')::date
    else null
  end;
  if v_next is not null and not exists (
    select 1 from compliance_records where requirement_id = new.requirement_id and status = 'pending'
  ) then
    insert into compliance_records (centre_id, requirement_id, due_date)
    values (new.centre_id, new.requirement_id, v_next);
  end if;
  return new;
end $$;

create trigger compliance_records_next
  after update of status on public.compliance_records
  for each row execute function public.schedule_next_compliance_record();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_centre(p_name text, p_suburb text, p_state text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if (select centre_id from users where id = auth.uid()) is not null then
    raise exception 'You already belong to a centre';
  end if;
  insert into centres (name, suburb, state) values (p_name, coalesce(p_suburb, ''), coalesce(nullif(p_state, ''), 'NSW'))
  returning id into v_id;
  update users set centre_id = v_id, role = 'owner', full_name = p_full_name
   where id = auth.uid() returning email into v_email;
  insert into staff (centre_id, user_id, full_name, email, position)
  values (v_id, auth.uid(), p_full_name, v_email, 'Approved provider');
  perform seed_compliance_requirements(v_id);
  return v_id;
end $$;

-- Staff code -> educator (with a staff record), family code -> parent.
create or replace function public.join_centre(p_code text, p_full_name text)
returns public.user_role language plpgsql security definer set search_path = public as $$
declare v_centre centres; v_role user_role; v_email text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if (select centre_id from users where id = auth.uid()) is not null then
    raise exception 'You already belong to a centre';
  end if;
  select * into v_centre from centres where staff_code = upper(trim(p_code));
  if found then v_role := 'educator';
  else
    select * into v_centre from centres where family_code = upper(trim(p_code));
    if found then v_role := 'parent'; else raise exception 'That code does not match a centre'; end if;
  end if;
  update users set centre_id = v_centre.id, role = v_role, full_name = p_full_name
   where id = auth.uid() returning email into v_email;
  if v_role = 'educator' then
    -- Attach to an existing staff record with the same email, or create one.
    update staff set user_id = auth.uid()
     where centre_id = v_centre.id and user_id is null and lower(email) = lower(v_email);
    if not found then
      insert into staff (centre_id, user_id, full_name, email, position)
      values (v_centre.id, auth.uid(), p_full_name, v_email, 'Educator');
    end if;
  end if;
  return v_role;
end $$;

create or replace function public.link_parent(p_child uuid, p_email text, p_relationship text default 'Parent')
returns void language plpgsql security definer set search_path = public as $$
declare v_parent users;
begin
  if not is_leader() then raise exception 'Only the owner or director can link families'; end if;
  if (select centre_id from children where id = p_child) is distinct from my_centre_id() then
    raise exception 'Child not found';
  end if;
  select * into v_parent from users
   where lower(email) = lower(trim(p_email)) and centre_id = my_centre_id() and role = 'parent';
  if not found then
    raise exception 'No parent with that email has joined this centre yet. Share the family code with them first.';
  end if;
  insert into child_parents (child_id, user_id, relationship)
  values (p_child, v_parent.id, coalesce(nullif(p_relationship, ''), 'Parent'))
  on conflict do nothing;
end $$;

-- Mark every message in a child's thread that someone else sent as read.
create or replace function public.mark_thread_read(p_child uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_see_child(p_child) then raise exception 'Not allowed'; end if;
  update messages set read_at = now()
   where child_id = p_child and sender_id <> auth.uid() and read_at is null
     and (is_staff() = (select role = 'parent' from users where id = sender_id));
end $$;

-- Standard National Regulations items every new centre starts with.
create or replace function public.seed_compliance_requirements(p_centre uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into compliance_requirements (centre_id, title, regulation_reference, category, frequency) values
    (p_centre, 'Emergency and evacuation rehearsal',            'Reg 97',  'Safety',   'quarterly'),
    (p_centre, 'Playground and premises safety check',          'Reg 103', 'Safety',   'weekly'),
    (p_centre, 'Fire equipment service',                        'Reg 97',  'Safety',   'six-monthly'),
    (p_centre, 'Medical conditions policy review',              'Reg 90',  'Policy',   'annual'),
    (p_centre, 'Sun protection policy review',                  'Reg 168', 'Policy',   'annual'),
    (p_centre, 'Sleep and rest policy review',                  'Reg 84A', 'Policy',   'annual'),
    (p_centre, 'Quality Improvement Plan review',               'Reg 56',  'Quality',  'annual'),
    (p_centre, 'Staff record and responsible person register',  'Reg 145', 'Records',  'monthly'),
    (p_centre, 'Excursion risk assessments up to date',         'Reg 100', 'Safety',   'once');
  -- First record for each, due in 30 days. Directors adjust dates on the Compliance page.
  insert into compliance_records (centre_id, requirement_id, due_date)
  select p_centre, id, current_date + 30 from compliance_requirements where centre_id = p_centre;
end $$;
revoke execute on function public.seed_compliance_requirements(uuid) from public, anon, authenticated;

-- Realistic sample data for demos. Owner/director only. Dates are relative to today.
create or replace function public.load_demo_data()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_centre uuid := my_centre_id();
  v_me uuid := auth.uid();
  s_sarah uuid; s_james uuid; s_priya uuid; s_tom uuid;
  c_leo uuid; c_ava uuid; c_oli uuid; c_ruby uuid;
  t uuid;
begin
  if not is_leader() then raise exception 'Only the owner or director can load demo data'; end if;

  insert into staff (centre_id, full_name, email, position) values (v_centre, 'Sarah Mitchell', 'sarah@example.com', 'Room leader') returning id into s_sarah;
  insert into staff (centre_id, full_name, email, position) values (v_centre, 'James Lee', 'james@example.com', 'Educator') returning id into s_james;
  insert into staff (centre_id, full_name, email, position) values (v_centre, 'Priya Sharma', 'priya@example.com', 'Early childhood teacher') returning id into s_priya;
  insert into staff (centre_id, full_name, email, position) values (v_centre, 'Tom Nguyen', 'tom@example.com', 'Cook') returning id into s_tom;

  insert into staff_certificates (staff_id, certificate_type_id, certificate_number, issue_date, expiry_date)
  select s, (select id from certificate_types where code = c), n, current_date - i, current_date + e
  from (values
    (s_sarah, 'WWCC',        'WWC1234567E', 1500, 400),
    (s_sarah, 'FIRST_AID',   'HLTAID012',   1080, 18),
    (s_sarah, 'CPR',         'HLTAID009',   350,  15),
    (s_sarah, 'ANAPHYLAXIS', '22578VIC',    900,  195),
    (s_james, 'WWCC',        'WWC7654321E', 1700, 120),
    (s_james, 'FIRST_AID',   'HLTAID012',   1100, -4),
    (s_james, 'CPR',         'HLTAID009',   370,  -5),
    (s_priya, 'WWCC',        'WWC5550001E', 1800, 25),
    (s_priya, 'FIRST_AID',   'HLTAID012',   300,  795),
    (s_priya, 'ASTHMA',      '22556VIC',    500,  595),
    (s_tom,   'WWCC',        'WWC2223334E', 900,  925)
  ) as x(s, c, n, i, e);
  insert into staff_certificates (staff_id, certificate_type_id, certificate_number, issue_date)
  values (s_priya, (select id from certificate_types where code = 'QUALIFICATION'), 'Bachelor of Education (Early Childhood)', current_date - 2000);

  insert into children (centre_id, first_name, last_name, date_of_birth, room) values
    (v_centre, 'Leo',    'Nguyen',   current_date - 860,  'Possums') returning id into c_leo;
  insert into children (centre_id, first_name, last_name, date_of_birth, room) values
    (v_centre, 'Ava',    'Kaur',     current_date - 1010, 'Possums') returning id into c_ava;
  insert into children (centre_id, first_name, last_name, date_of_birth, room) values
    (v_centre, 'Oliver', 'Tran',     current_date - 800,  'Possums') returning id into c_oli;
  insert into children (centre_id, first_name, last_name, date_of_birth, room) values
    (v_centre, 'Ruby',   'Chen',     current_date - 1450, 'Wombats') returning id into c_ruby;
  insert into children (centre_id, first_name, last_name, date_of_birth, room) values
    (v_centre, 'Mia',    'Hassan',   current_date - 1060, 'Possums'),
    (v_centre, 'Noah',   'Petrovic', current_date - 1300, 'Wombats'),
    (v_centre, 'Isla',   'Brown',    current_date - 1520, 'Wombats');

  -- Spread the starting records across overdue / due soon / done.
  update compliance_records r set
    due_date = case
      when q.title like 'Sun%'          then current_date - 30
      when q.title like 'Emergency%'    then current_date - 3
      when q.title like 'Playground%'   then current_date + 2
      when q.title like 'Medical%'      then current_date + 10
      when q.title like 'Staff record%' then current_date + 12
      when q.title like 'Sleep%'        then current_date + 60
      when q.title like 'Fire%' or q.title like 'Quality%' then current_date - 20
      else current_date + 90
    end,
    notes = case when q.title like 'Sun%' then 'Annual review overdue' else r.notes end
  from compliance_requirements q
  where q.id = r.requirement_id and r.centre_id = v_centre and r.status = 'pending';
  -- Two already done (this also schedules their next occurrence).
  update compliance_records r set status = 'completed', completed_on = current_date - 20, completed_by = v_me
  from compliance_requirements q
  where q.id = r.requirement_id and r.centre_id = v_centre and r.status = 'pending'
    and (q.title like 'Fire%' or q.title like 'Quality%');

  insert into incidents (centre_id, child_id, reported_by, occurred_at, description, action_taken, is_serious, parent_notified_at)
  values
    (v_centre, c_leo, v_me, now() - interval '3 hours', 'Leo tripped on the sandpit edge and grazed his left knee.', 'Cleaned with saline, applied a bandaid and comforted. Returned to play.', false, null),
    (v_centre, c_oli, v_me, now() - interval '30 hours', 'Oliver was bitten on the forearm by another child during block play. Skin not broken.', 'Washed area, applied cold pack, monitored for 30 minutes.', false, null),
    (v_centre, c_ruby, v_me, now() - interval '3 days', 'Ruby fell from the climbing frame and hit her head. Small lump, no loss of consciousness.', 'First aid, head injury observation for 2 hours, parent called and collected early. GP visit recommended.', true, now() - interval '3 days' + interval '20 minutes');

  insert into updates (centre_id, child_id, author_id, kind, title, body, published_at) values
    (v_centre, c_leo, v_me, 'observation', 'Tallest tower yet', 'Leo built a block tower taller than himself and counted the blocks with Mia. When it fell he laughed and started again.', now() - interval '2 hours'),
    (v_centre, c_ava, v_me, 'daily', 'Lunch and rest', 'Ava ate most of her chicken and rice, drank a full cup of water and slept from 12:40 to 2:10.', now() - interval '1 hour'),
    (v_centre, null,  v_me, 'announcement', 'Hat reminder', 'Sun protection season has started. Please pack a broad-brimmed hat every day.', now() - interval '1 day'),
    (v_centre, c_oli, v_me, 'daily', 'Draft: afternoon', 'Oliver spent the afternoon in the sandpit.', null);
end $$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
insert into public.certificate_types (code, name, expires, reminder_days) values
  ('WWCC',             'Working with Children Check',            true,  90),
  ('FIRST_AID',        'First aid (HLTAID012)',                  true,  60),
  ('CPR',              'CPR refresher (HLTAID009)',              true,  30),
  ('ANAPHYLAXIS',      'Anaphylaxis management training',        true,  60),
  ('ASTHMA',           'Emergency asthma management training',  true,  60),
  ('CHILD_PROTECTION', 'Child protection training',              true,  60),
  ('QUALIFICATION',    'Early childhood qualification',          false, 0);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.centres                 enable row level security;
alter table public.users                   enable row level security;
alter table public.staff                   enable row level security;
alter table public.certificate_types       enable row level security;
alter table public.staff_certificates      enable row level security;
alter table public.reminders               enable row level security;
alter table public.compliance_requirements enable row level security;
alter table public.compliance_records      enable row level security;
alter table public.compliance_summaries    enable row level security;
alter table public.children                enable row level security;
alter table public.child_parents           enable row level security;
alter table public.incidents               enable row level security;
alter table public.updates                 enable row level security;
alter table public.messages                enable row level security;

-- centres
create policy "members read centre" on public.centres for select using (id = public.my_centre_id());
create policy "leaders update centre" on public.centres for update using (id = public.my_centre_id() and public.is_leader());

-- users: self; staff see everyone in the centre; parents see staff names (for messages)
create policy "read self" on public.users for select using (id = auth.uid());
create policy "staff read centre users" on public.users for select
  using (centre_id = public.my_centre_id() and public.is_staff());
create policy "parents read staff names" on public.users for select
  using (centre_id = public.my_centre_id() and role <> 'parent');
create policy "update own details" on public.users for update using (id = auth.uid())
  with check (id = auth.uid()
    and centre_id is not distinct from public.my_centre_id()
    and role is not distinct from public.my_role());

-- staff + certificates + reminders: leaders manage; educators see their own
create policy "leaders manage staff" on public.staff for all
  using (centre_id = public.my_centre_id() and public.is_leader())
  with check (centre_id = public.my_centre_id() and public.is_leader());
create policy "educators read own staff record" on public.staff for select using (user_id = auth.uid());

create policy "signed-in read certificate types" on public.certificate_types for select to authenticated using (true);

create policy "leaders manage certificates" on public.staff_certificates for all
  using (public.is_leader() and exists (select 1 from public.staff s where s.id = staff_id and s.centre_id = public.my_centre_id()))
  with check (public.is_leader() and exists (select 1 from public.staff s where s.id = staff_id and s.centre_id = public.my_centre_id()));
create policy "educators read own certificates" on public.staff_certificates for select
  using (exists (select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid()));

create policy "leaders read reminders" on public.reminders for select
  using (public.is_leader() and exists (
    select 1 from public.staff_certificates sc join public.staff s on s.id = sc.staff_id
    where sc.id = staff_certificate_id and s.centre_id = public.my_centre_id()));
create policy "educators read own reminders" on public.reminders for select
  using (exists (
    select 1 from public.staff_certificates sc join public.staff s on s.id = sc.staff_id
    where sc.id = staff_certificate_id and s.user_id = auth.uid()));

-- compliance: leaders manage; educators read and can complete records
create policy "staff read requirements" on public.compliance_requirements for select
  using (centre_id = public.my_centre_id() and public.is_staff());
create policy "leaders manage requirements" on public.compliance_requirements for all
  using (centre_id = public.my_centre_id() and public.is_leader())
  with check (centre_id = public.my_centre_id() and public.is_leader());

create policy "staff read records" on public.compliance_records for select
  using (centre_id = public.my_centre_id() and public.is_staff());
create policy "staff complete records" on public.compliance_records for update
  using (centre_id = public.my_centre_id() and public.is_staff())
  with check (centre_id = public.my_centre_id() and public.is_staff());
create policy "leaders create records" on public.compliance_records for insert
  with check (centre_id = public.my_centre_id() and public.is_leader());
create policy "leaders delete records" on public.compliance_records for delete
  using (centre_id = public.my_centre_id() and public.is_leader());

create policy "leaders read summaries" on public.compliance_summaries for select
  using (centre_id = public.my_centre_id() and public.is_leader());
create policy "leaders create summaries" on public.compliance_summaries for insert
  with check (centre_id = public.my_centre_id() and public.is_leader());

-- children
create policy "staff read children" on public.children for select
  using (centre_id = public.my_centre_id() and public.is_staff());
create policy "parents read own children" on public.children for select using (public.is_parent_of(id));
create policy "leaders manage children" on public.children for all
  using (centre_id = public.my_centre_id() and public.is_leader())
  with check (centre_id = public.my_centre_id() and public.is_leader());

create policy "staff read family links" on public.child_parents for select
  using (public.is_staff() and exists (select 1 from public.children c where c.id = child_id and c.centre_id = public.my_centre_id()));
create policy "parents read own links" on public.child_parents for select using (user_id = auth.uid());
create policy "leaders remove family links" on public.child_parents for delete
  using (public.is_leader() and exists (select 1 from public.children c where c.id = child_id and c.centre_id = public.my_centre_id()));

-- incidents: staff log and update; parents read their own child's
create policy "staff read incidents" on public.incidents for select
  using (centre_id = public.my_centre_id() and public.is_staff());
create policy "staff log incidents" on public.incidents for insert
  with check (centre_id = public.my_centre_id() and public.is_staff() and reported_by = auth.uid());
create policy "staff update incidents" on public.incidents for update
  using (centre_id = public.my_centre_id() and public.is_staff())
  with check (centre_id = public.my_centre_id() and public.is_staff());
create policy "parents read own child incidents" on public.incidents for select using (public.is_parent_of(child_id));

-- updates: staff manage; parents read published ones for their child or the whole centre
create policy "staff read updates" on public.updates for select
  using (centre_id = public.my_centre_id() and public.is_staff());
create policy "staff create updates" on public.updates for insert
  with check (centre_id = public.my_centre_id() and public.is_staff() and author_id = auth.uid());
create policy "staff edit updates" on public.updates for update
  using (centre_id = public.my_centre_id() and public.is_staff())
  with check (centre_id = public.my_centre_id() and public.is_staff());
create policy "staff delete drafts" on public.updates for delete
  using (centre_id = public.my_centre_id() and public.is_staff() and published_at is null);
create policy "parents read published updates" on public.updates for select
  using (published_at is not null and (
    public.is_parent_of(child_id)
    or (child_id is null and centre_id = public.my_centre_id() and public.my_role() = 'parent')));

-- messages: anyone who can see the child can read and post in its thread
create policy "read child thread" on public.messages for select using (public.can_see_child(child_id));
create policy "post to child thread" on public.messages for insert
  with check (sender_id = auth.uid() and public.can_see_child(child_id)
    and centre_id = (select c.centre_id from public.children c where c.id = child_id));

grant execute on function public.create_centre(text, text, text, text) to authenticated;
grant execute on function public.join_centre(text, text) to authenticated;
grant execute on function public.link_parent(uuid, text, text) to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
grant execute on function public.load_demo_data() to authenticated;
