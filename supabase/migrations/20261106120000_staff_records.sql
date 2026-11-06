-- Staff records for the Staff page: qualification, usual days, start and leaving dates, and any document per educator.
-- Educators who leave stay on file (is_active = false, left_on set) for at least 3 years (Reg 183(2)(f)).
alter table public.staff
  add column if not exists qualification text not null default '',
  add column if not exists work_days text[] not null default '{Mon,Tue,Wed,Thu,Fri}',
  add column if not exists started_on date,
  add column if not exists left_on date;

-- Any other document on an educator's file (an employment contract, a police check, a course certificate).
insert into public.certificate_types (code, name, expires, reminder_days)
values ('OTHER', 'Other document', false, 0)
on conflict (code) do nothing;
alter table public.staff_certificates add column if not exists title text not null default '';
