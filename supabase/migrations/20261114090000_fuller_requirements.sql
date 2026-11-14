-- Fuller ACECQA requirement list (Nov 2026).
-- Adds the requirements spot checks and assessment and rating look at that weren't on the checklist,
-- and folds "Emergency contacts and procedures" into the evacuation requirement (both Reg. 97).
-- Re-runnable. Run after 20261026090000_compliance_library.sql (which now also has guides for the new items).

-- 1. The requirement list every centre starts from.
create or replace function public._requirement_defaults()
returns table (item_key text, area public.checklist_area, title text, source_ref text, evidence_hint text, evidence_kind public.evidence_kind,
               cert_codes text[], review_months int, summary text, risk_note text, icon text)
language sql immutable as $$
  values
    ('wwcc', 'staff_records'::public.checklist_area, 'Current WWCC register', 'National Regulations · Reg. 145, 146', 'Working with Children Check number and expiry for every educator', 'certificates'::public.evidence_kind, '{WWCC}'::text[], 12,
     'Keep staff records current, including each educator’s Working With Children Check details and relevant record dates.', 'An officer may ask to verify the current status of staff checks.', '♙'),
    ('firstaid', 'staff_records', 'First Aid and CPR evidence', 'National Regulations · Reg. 136', 'Current first aid (HLTAID012) and CPR (HLTAID009) certificates', 'certificates', '{FIRST_AID,CPR}', 12,
     'Maintain current first-aid qualifications for the required number of educators and keep evidence available.', 'Confirm certificates remain current before each visit.', '✚'),
    ('training', 'staff_records', 'Staff qualification and training records', 'National Regulations · Reg. 145–147', 'Anaphylaxis, asthma, child protection training and qualifications', 'certificates', '{ANAPHYLAXIS,ASTHMA,CHILD_PROTECTION,QUALIFICATION}', 12,
     'Keep the required staff records and evidence of qualifications and relevant training accessible.', 'Check that staff files and role details match the centre’s current roster.', '▤'),
    ('child_protection', 'staff_records', 'Child protection and child safe practice', 'National Law s162A · National Regulations · Reg. 84, 168', 'Child protection training records and the signed code of conduct', 'document', '{}', 12,
     'Staff must know current child protection law and their obligations, including mandatory reporting, and follow the child safe environment policy.', 'Keep a record of each staff member’s child protection briefing.', '♙'),
    ('enrolment', 'childrens_records', 'Children’s enrolment and contact records', 'National Regulations · Reg. 160–162', 'Enrolment record with parent contacts and emergency contact for every child', 'children', '{}', 12,
     'Keep each child’s enrolment, parent contact and authorised nominee information up to date.', 'Confirm records reflect recent family changes.', '♡'),
    ('incidents', 'childrens_records', 'Incident, injury, trauma and illness records', 'National Regulations · Reg. 87', 'Incident record with parent notified within 24 hours', 'incidents', '{}', 12,
     'Maintain records of incidents, injuries, trauma and illness, including the required details and notifications.', 'Be ready to show the records and associated follow-up.', '✎'),
    ('medical', 'childrens_records', 'Medical management and risk minimisation records', 'National Regulations · Reg. 90–91', 'Current, reviewed medical information for children with conditions', 'medical', '{}', 12,
     'Keep current medical management plans and risk minimisation plans where applicable.', 'Check that plans and supporting records are current.', '＋'),
    ('medication', 'childrens_records', 'Medication records and authorisations', 'National Regulations · Reg. 92–96', 'Medication record with parent authorisations', 'document', '{}', 12,
     'Give medication only with written parent authorisation and record every dose, who gave it and who checked it.', 'Keep the medication record with each child’s current authorisation.', '＋'),
    ('authorisations', 'childrens_records', 'Authorised nominees and child collection records', 'National Regulations · Reg. 99, 160–161', 'Authorised nominee and collection records', 'document', '{}', 12,
     'Keep records of authorisations and collection arrangements required for each child.', 'Confirm staff can find the current authorised nominee information.', '⌂'),
    ('evacuation', 'safety_premises', 'Emergency and evacuation rehearsal this quarter', 'National Regulations · Reg. 97', 'Drill log dated within the last 3 months', 'document', '{}', 3,
     'Rehearse emergency and evacuation procedures every 3 months, record each rehearsal, and keep the procedures and floor plan displayed.', 'Log each quarter’s drill before the next visit.', '⌁'),
    ('premises', 'safety_premises', 'Premises and safety checks', 'National Regulations · Reg. 103–115', 'Recent premises and equipment safety checklist', 'document', '{}', 1,
     'Maintain safe premises, equipment and facilities, with records of relevant checks and maintenance.', 'Keep the latest checks easy to retrieve.', '⌂'),
    ('excursions', 'safety_premises', 'Excursion risk assessments and authorisations', 'National Regulations · Reg. 100–102', 'Excursion risk assessment and signed authorisations', 'document', '{}', 12,
     'Do a risk assessment before each excursion and get written authorisation for every child who goes.', 'Update the risk assessment if the route, location or group size changes.', '⌁'),
    ('food', 'safety_premises', 'Food safety, nutrition and weekly menu', 'National Regulations · Reg. 77–80', 'This week’s menu and children’s dietary needs', 'document', '{}', 1,
     'Provide nutritious food that suits each child’s dietary needs, follow safe food handling and display the weekly menu.', 'Check this week’s menu against children’s allergies.', '☕'),
    ('sun', 'policies_procedures', 'Sun Protection Policy reviewed and current', 'National Regulations · Reg. 168 · NQS QA2', 'Reviewed policy with a review date in the last 12 months', 'document', '{}', 12,
     'A current policy should be in place for the service’s relevant health and safety practices. The centre should review its sun protection procedures against current guidance.', 'Keep the reviewed policy and its review date on file.', '☼'),
    ('sleep', 'policies_procedures', 'Sleep and rest policy review', 'National Regulations · Reg. 84A–84D · NQS QA2', 'Reviewed sleep and rest policy', 'document', '{}', 12,
     'Maintain sleep and rest policies and practices that reflect current requirements and guidance.', 'A guidance update may mean this policy needs another review.', '☾'),
    ('policies', 'policies_procedures', 'Required policies and procedures in place', 'National Regulations · Reg. 168–172', 'Policy folder with each policy’s review date', 'document', '{}', 12,
     'Have every policy the Regulations require, follow them, keep them available and give families notice of changes.', 'Keep each policy’s review date current.', '▤'),
    ('digital', 'policies_procedures', 'Safe use of digital technology and images', 'National Regulations · Reg. 168', 'Digital technology and images policy', 'document', '{}', 12,
     'Have a policy on the safe use of digital technologies and online environments, including taking and storing images of children.', 'Upload the centre’s digital technology and images policy.', '▣'),
    ('program', 'policies_procedures', 'Educational program and documentation', 'National Law s168 · National Regulations · Reg. 73–76', 'Current program and children’s learning documentation', 'document', '{}', 3,
     'Base the program on the approved learning framework, document each child’s learning and share it with families.', 'Keep each child’s documentation up to date.', '✎'),
    ('qip', 'policies_procedures', 'Quality Improvement Plan reviewed', 'National Regulations · Reg. 31, 55, 56', 'Quality Improvement Plan with its last review date', 'document', '{}', 12,
     'Keep a Quality Improvement Plan with a self-assessment against the NQS and review it at least once a year.', 'Review the plan at least once a year.', '★'),
    ('notifications', 'policies_procedures', 'Notifications to the regulator', 'National Law s174 · National Regulations · Reg. 175–176', 'Copies of notifications made to the regulator', 'document', '{}', 12,
     'Notify serious incidents and complaints alleging a serious incident or a breach within 24 hours.', 'Keep a copy of every notification with the incident record.', '!')
$$;
revoke execute on function public._requirement_defaults() from public, anon, authenticated;

create or replace function public._generate_checklist(p_centre uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into checklist_items (centre_id, item_key, area, title, source_ref, evidence_hint, evidence_kind, cert_codes, review_months, summary, risk_note, icon)
  select p_centre, d.item_key, d.area, d.title, d.source_ref, d.evidence_hint, d.evidence_kind, d.cert_codes, d.review_months, d.summary, d.risk_note, d.icon
  from public._requirement_defaults() d
  where not exists (select 1 from checklist_items ci where ci.centre_id = p_centre and ci.item_key = d.item_key and ci.is_active);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public._generate_checklist(uuid) from public, anon, authenticated;

-- 2. Existing centres: fold Emergency contacts into the evacuation requirement, retitle two items, add the new ones
--    (already approved if the centre's checklist is approved).
update public.checklist_items set is_active = false where item_key = 'emergency' and is_active;
update public.checklist_items set title = 'Emergency and evacuation rehearsal this quarter',
  summary = 'Rehearse emergency and evacuation procedures every 3 months, record each rehearsal, and keep the procedures and floor plan displayed.'
  where item_key = 'evacuation' and is_active;
update public.checklist_items set title = 'Authorised nominees and child collection records', source_ref = 'National Regulations · Reg. 99, 160–161'
  where item_key = 'authorisations' and is_active;

insert into public.checklist_items (centre_id, item_key, area, title, source_ref, evidence_hint, evidence_kind, cert_codes, review_months, summary, risk_note, icon, approved_at)
select c.centre_id, d.item_key, d.area, d.title, d.source_ref, d.evidence_hint, d.evidence_kind, d.cert_codes, d.review_months, d.summary, d.risk_note, d.icon,
       case when c.approved then now() end
from (select centre_id, bool_or(approved_at is not null) as approved from public.checklist_items where is_active group by centre_id) c
cross join public._requirement_defaults() d
where not exists (select 1 from public.checklist_items ci where ci.centre_id = c.centre_id and ci.item_key = d.item_key and ci.is_active);

-- 3. The audit agent's per-requirement rules.
create or replace function public._item_critical(p_key text) returns boolean language sql immutable as $$
  select p_key in ('wwcc', 'firstaid', 'evacuation', 'medical', 'medication', 'incidents', 'child_protection');
$$;
create or replace function public._item_why(p_key text) returns text language sql immutable as $$
  select case p_key
    when 'wwcc' then 'Every educator must hold a current Working with Children Check, and an officer can ask to see the register (Reg. 145–146).'
    when 'firstaid' then 'An educator with current first aid, CPR and anaphylaxis training must be on site at all times (Reg. 136).'
    when 'training' then 'Staff records must show each educator’s qualifications and training (Reg. 145–147).'
    when 'child_protection' then 'Staff must know child protection law and their reporting obligations, and follow the child safe policy (Reg. 84).'
    when 'enrolment' then 'Staff must be able to reach a parent or emergency contact for every child (Reg. 160–162).'
    when 'incidents' then 'Parents must be told within 24 hours, and serious incidents notified to the regulator (Reg. 86–87).'
    when 'medical' then 'Children with medical conditions need current plans so staff can respond safely (Reg. 90–91).'
    when 'medication' then 'Medication may only be given with written authorisation, and every dose recorded (Reg. 92–96).'
    when 'authorisations' then 'Children may only leave with an authorised person (Reg. 99, 160–161).'
    when 'evacuation' then 'Emergency and evacuation procedures must be rehearsed every 3 months, each rehearsal recorded, and the procedures displayed (Reg. 97).'
    when 'premises' then 'Premises, furniture and equipment must be safe, clean and well maintained (Reg. 103).'
    when 'excursions' then 'Every excursion needs a risk assessment and written authorisation for each child (Reg. 100–102).'
    when 'food' then 'Food must suit each child’s dietary needs, be handled safely, and the weekly menu displayed (Reg. 77–80).'
    when 'sun' then 'The service must have a current sun protection policy that staff follow (Reg. 114, 168).'
    when 'sleep' then 'Sleep and rest policies must reflect current requirements, with a risk assessment at least every 12 months (Reg. 84A–84C).'
    when 'policies' then 'The service must have, follow and make available every policy the Regulations list (Reg. 168–172).'
    when 'digital' then 'The service needs a policy on the safe use of digital technology, including images of children (Reg. 168).'
    when 'program' then 'The program must follow an approved learning framework, with each child’s learning documented (Reg. 73–76).'
    when 'qip' then 'The Quality Improvement Plan must be reviewed at least once a year and kept at the service (Reg. 55–56).'
    when 'notifications' then 'Serious incidents and some complaints must be notified to the regulator within 24 hours (Reg. 175–176).'
    else 'An authorised officer can ask to see this evidence at a visit.' end;
$$;
