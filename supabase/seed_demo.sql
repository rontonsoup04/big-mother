-- ============================================================================
-- Beehive demo data (matches the people and records in beehive-demo/)
-- Run in Supabase → SQL Editor AFTER all files in supabase/migrations.
-- Safe to re-run: it deletes and recreates the demo centre and demo logins.
--
-- Demo logins (password for all: Beehive2026!)
--   sara@beehive.demo   – Sara Williams, centre owner
--   priya@beehive.demo  – Priya Patel, parent of Maya Patel
--   mia@beehive.demo    – Mia Chen, lead educator
--
-- Not included on purpose: evidence uploads for the audit checklist (added during the demo).
-- Compliance task history is included so the compliance register has realistic dates.
-- After approval, document-based checklist items show "Evidence missing" until real files are uploaded.
-- ============================================================================

do $$
declare
  c_centre uuid := 'b0000000-0000-4000-8000-000000000001';
  u_sara   uuid := 'b0000000-0000-4000-8000-0000000000a1';
  u_priya  uuid := 'b0000000-0000-4000-8000-0000000000a2';
  u_mia    uuid := 'b0000000-0000-4000-8000-0000000000a3';
  v_pw     text;
  v_key    text := 'bh_demo_' || md5(random()::text || clock_timestamp()::text);
  s record;
  v_staff uuid;
  c_maya uuid; c_oscar uuid; c_isla uuid; c_ruby uuid;
begin
  -- ---------- reset previous demo ----------
  alter table public.audit_log disable trigger audit_log_immutable;
  delete from public.centres where id = c_centre;
  alter table public.audit_log enable trigger audit_log_immutable;
  delete from auth.users where email in ('sara@beehive.demo', 'priya@beehive.demo', 'mia@beehive.demo');

  -- ---------- demo logins ----------
  v_pw := extensions.crypt('Beehive2026!', extensions.gen_salt('bf'));
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values
    ('00000000-0000-0000-0000-000000000000', u_sara,  'authenticated', 'authenticated', 'sara@beehive.demo',  v_pw, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sara Williams"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u_priya, 'authenticated', 'authenticated', 'priya@beehive.demo', v_pw, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Patel"}',   now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u_mia,   'authenticated', 'authenticated', 'mia@beehive.demo',   v_pw, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mia Chen"}',      now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u where u.id in (u_sara, u_priya, u_mia);

  -- ---------- centre ----------
  insert into public.centres (id, name, suburb, state, staff_code, family_code)
  values (c_centre, 'Beehive Early Learning', 'Liverpool', 'NSW', 'BEESTF', 'BEEFAM');
  update public.users set centre_id = c_centre, role = 'owner',    full_name = 'Sara Williams', phone = '04 0000 1357' where id = u_sara;
  update public.users set centre_id = c_centre, role = 'parent',   full_name = 'Priya Patel',   phone = '04 0000 2468' where id = u_priya;
  update public.users set centre_id = c_centre, role = 'educator', full_name = 'Mia Chen'      where id = u_mia;
  perform public.seed_compliance_requirements(c_centre);

  -- ---------- compliance history: when each recurring task was last done and when it's next due ----------
  for s in select * from (values
    ('Emergency and evacuation rehearsal',           array[100, 190], -10, 'Fire evacuation, all rooms, 4 min 10 s'),
    ('Playground and premises safety check',         array[5, 12, 19],  2, 'No hazards found'),
    ('Fire equipment service',                       array[140],       40, 'Extinguishers and blankets serviced by contractor'),
    ('Medical conditions policy review',             array[300],       65, 'Reviewed with families of children with action plans'),
    ('Sun protection policy review',                 array[355],       10, 'Checked against ACECQA guidelines'),
    ('Sleep and rest policy review',                 array[210],      155, 'Annual review and risk assessment'),
    ('Quality Improvement Plan review',              array[200],      165, 'QA2 and QA7 goals updated'),
    ('Staff record and responsible person register', array[26, 57],     4, 'Register checked against roster'),
    ('Excursion risk assessments up to date',        array[]::int[],   21, '')
  ) as t(title, done_days, due_in, note) loop
    update public.compliance_records r set due_date = current_date + s.due_in
      from public.compliance_requirements q
     where r.requirement_id = q.id and q.centre_id = c_centre and q.title = s.title and r.status = 'pending';
    insert into public.compliance_records (centre_id, requirement_id, status, due_date, completed_on, completed_by, notes, created_at)
    select c_centre, q.id, 'completed', current_date - d, current_date - d, u_sara, s.note, now() - make_interval(days => d)
      from public.compliance_requirements q, unnest(s.done_days) d
     where q.centre_id = c_centre and q.title = s.title;
  end loop;

  -- ---------- staff and certificates (days from today, as in the prototype) ----------
  insert into public.staff (centre_id, user_id, full_name, email, position, room)
  values (c_centre, u_sara, 'Sara Williams', 'sara@beehive.demo', 'Centre owner', '');

  for s in select * from (values
    ('Mia Chen',      'mia@beehive.demo',   'Lead educator',      'Wattle Room',  597, 250, 250, 195, 540),
    ('Noah Williams', 'noah@example.com',   'Educator',           'Banksia Room', 466, 169, 169, 320, 410),
    ('Ava Patel',     'ava@example.com',    'Educator',           'Gumtree Room', 700, 142, 142, 299, 430),
    ('Luca Martin',   'luca@example.com',   'Assistant educator', 'Wattle Room',  441, -46, 240, 178, 365),
    ('Ella Brooks',   'ella@example.com',   'Educator',           'Banksia Room', 615, 201, 201, 104, 380),
    ('Oliver King',   'oliver@example.com', 'Educator',           'Gumtree Room', 326, 210, 210, 220, 300),
    ('Zara Ali',      'zara@example.com',   'Educator',           'Wattle Room',  534, 300, 300, 280, 488),
    ('Leo Thompson',  'leo@example.com',    'Assistant educator', 'Banksia Room', 286, 107, 107, 107, 150),
    ('Amara Singh',   'amara@example.com',  'Educator',           'Gumtree Room', 7,   192, 192, 202, 260),
    ('Jack Wilson',   'jack@example.com',   'Educator',           'Wattle Room',  453, 88,  88,  233, 95)
  ) as t(name, email, position, room, d_wwcc, d_fa, d_cpr, d_ana, d_ast) loop
    insert into public.staff (centre_id, user_id, full_name, email, position, room)
    values (c_centre, case when s.email = 'mia@beehive.demo' then u_mia end, s.name, s.email, s.position, s.room)
    returning id into v_staff;
    insert into public.staff_certificates (staff_id, certificate_type_id, certificate_number, issue_date, expiry_date)
    values
      (v_staff, (select id from public.certificate_types where code = 'WWCC'),        'WWC' || (1000000 + floor(random() * 8999999))::int || 'E', current_date + s.d_wwcc - 1825, current_date + s.d_wwcc),
      (v_staff, (select id from public.certificate_types where code = 'FIRST_AID'),   'HLTAID012', current_date + s.d_fa - 1095,  current_date + s.d_fa),
      (v_staff, (select id from public.certificate_types where code = 'CPR'),         'HLTAID009', current_date + s.d_cpr - 365,  current_date + s.d_cpr),
      (v_staff, (select id from public.certificate_types where code = 'ANAPHYLAXIS'), '22578VIC',  current_date + s.d_ana - 1095, current_date + s.d_ana),
      (v_staff, (select id from public.certificate_types where code = 'ASTHMA'),      '22556VIC',  current_date + s.d_ast - 1095, current_date + s.d_ast);
  end loop;

  -- ---------- staff compliance agent: contact details and a few days of history ----------
  -- Phone numbers are invented. Leo has no email, so the agent texts him (simulated SMS).
  update public.staff set phone = '04 0000 ' || lpad((1000 + x.rn)::text, 4, '0')
    from (select id as sid, row_number() over (order by full_name) as rn from public.staff where centre_id = c_centre) x
   where id = x.sid;
  update public.staff set email = '' where centre_id = c_centre and full_name = 'Leo Thompson';
  -- Jack never supplied his anaphylaxis training (missing = critical).
  delete from public.staff_certificates sc using public.staff st, public.certificate_types ct
   where sc.staff_id = st.id and sc.certificate_type_id = ct.id and st.centre_id = c_centre and st.full_name = 'Jack Wilson' and ct.code = 'ANAPHYLAXIS';
  perform public.run_staff_agent_for(c_centre, 'seed');
  -- That run happened three days ago.
  update public.agent_events set created_at = created_at - interval '3 days', demo = true where centre_id = c_centre;
  update public.agent_messages set sent_at = sent_at - interval '3 days', next_follow_up = next_follow_up - 3 where centre_id = c_centre;
  update public.agent_runs set ran_at = ran_at - interval '3 days' where centre_id = c_centre;
  update public.credential_tasks set opened_at = opened_at - interval '3 days', updated_at = updated_at - interval '3 days',
         last_request_at = last_request_at - interval '3 days', next_follow_up = next_follow_up - 3,
         escalated_at = escalated_at - interval '3 days'
   where centre_id = c_centre;
  -- Yesterday Amara uploaded a Working with Children Check through her link, but it's her old one: flagged for Sara.
  perform public._submit_checked(st, ct, 'amara-wwcc.jpg', null, null, 'demo-amara-old-wwcc',
            jsonb_build_object('readable', true, 'name', 'Amara Singh', 'type_code', 'WWCC', 'number', 'WWC0458812E',
                               'issue_date', current_date + 7 - 1825, 'expiry_date', current_date + 7, 'demo', true),
            null, null, 'link', null)
    from public.staff st, public.certificate_types ct
   where st.centre_id = c_centre and st.full_name = 'Amara Singh' and ct.code = 'WWCC';
  update public.certificate_submissions set submitted_at = now() - interval '1 day' where centre_id = c_centre and source = 'link';
  update public.agent_events set created_at = now() - interval '1 day', demo = true where centre_id = c_centre and kind in ('upload_received', 'flagged');

  -- ---------- children (3 rooms) ----------
  insert into public.children (centre_id, first_name, last_name, date_of_birth, room, emergency_contact) values
    (c_centre, 'Maya',   'Patel',    current_date - 1100, 'Banksia Room', 'Priya Patel · 04 0000 2468') returning id into c_maya;
  insert into public.children (centre_id, first_name, last_name, date_of_birth, room, emergency_contact) values
    (c_centre, 'Oscar',  'Nguyen',   current_date - 900,  'Wattle Room',  'Linh Nguyen · 04 0000 3141') returning id into c_oscar;
  insert into public.children (centre_id, first_name, last_name, date_of_birth, room, emergency_contact) values
    (c_centre, 'Isla',   'Brown',    current_date - 1500, 'Gumtree Room', 'Tom Brown · 04 0000 2718') returning id into c_isla;
  insert into public.children (centre_id, first_name, last_name, date_of_birth, room, emergency_contact) values
    (c_centre, 'Ruby',   'Chen',     current_date - 1300, 'Banksia Room', 'Grace Chen · 04 0000 1618') returning id into c_ruby;
  insert into public.children (centre_id, first_name, last_name, date_of_birth, room, emergency_contact) values
    (c_centre, 'Noah',   'Kaur',     current_date - 820,  'Wattle Room',  'Harpreet Kaur · 04 0000 1414'),
    (c_centre, 'Ava',    'Hassan',   current_date - 1010, 'Banksia Room', 'Omar Hassan · 04 0000 1732'),
    (c_centre, 'Leo',    'Petrovic', current_date - 1400, 'Gumtree Room', 'Ana Petrovic · 04 0000 2236'),
    (c_centre, 'Mila',   'Rossi',    current_date - 760,  'Wattle Room',  'Marco Rossi · 04 0000 2645'),
    (c_centre, 'Jayden', 'Smith',    current_date - 1550, 'Gumtree Room', 'Kate Smith · 04 0000 3316'),
    (c_centre, 'Zoe',    'Wilson',   current_date - 1180, 'Banksia Room', 'Ben Wilson · 04 0000 1123'),
    (c_centre, 'Arjun',  'Mehta',    current_date - 980,  'Wattle Room',  'Neha Mehta · 04 0000 1958'),
    (c_centre, 'Sophie', 'Taylor',   current_date - 1450, 'Gumtree Room', 'Emma Taylor · 04 0000 2584');
  insert into public.child_parents (child_id, user_id, relationship) values (c_maya, u_priya, 'Mother');

  -- ---------- medical profiles (already reviewed by the centre) ----------
  insert into public.medical_updates (centre_id, child_id, allergies, conditions, dietary, medications, care_notes, emergency_contact,
                                      signer_name, parent_confirmed, submitted_by, submitted_at, status, approved_by, approved_at)
  values
    (c_centre, c_maya, 'Peanuts', 'Asthma', 'Peanut-free meals', 'Ventolin inhaler (as needed)', 'Please contact me if Maya has breathing symptoms.',
     'Priya Patel · 04 0000 2468', 'Priya Patel', true, u_priya, now() - interval '8 days', 'approved', u_sara, now() - interval '7 days'),
    (c_centre, c_oscar, 'Egg', 'Anaphylaxis', 'Egg-free meals', 'EpiPen Jr 0.15 mg (kept in Wattle Room kit)', 'Action plan on the room wall.',
     'Linh Nguyen · 04 0000 3141', 'Linh Nguyen', true, null, now() - interval '30 days', 'approved', u_sara, now() - interval '29 days'),
    (c_centre, c_isla, 'None', 'None', 'Dairy-free', 'None', 'Prefers a short rest after lunch.',
     'Tom Brown · 04 0000 2718', 'Tom Brown', true, null, now() - interval '60 days', 'approved', u_sara, now() - interval '59 days');
  insert into public.medical_updates (centre_id, child_id, allergies, conditions, dietary, medications, care_notes, emergency_contact,
                                      signer_name, parent_confirmed, submitted_at, status, approved_by, approved_at)
  select c_centre, ch.id, m.allergies, m.conditions, m.dietary, m.medications, m.notes, ch.emergency_contact, split_part(ch.emergency_contact, ' · ', 1),
         true, now() - interval '40 days', 'approved', u_sara, now() - interval '39 days'
    from (values
      ('Zoe',    'None',      'Asthma',      'None',            'Ventolin inhaler (as needed)',             'Asthma action plan in the Banksia Room kit.'),
      ('Leo',    'Tree nuts', 'Anaphylaxis', 'Nut-free meals',  'EpiPen 0.3 mg (kept in Gumtree Room kit)', 'Action plan on the room wall.'),
      ('Mila',   'None',      'None',        'Vegetarian',      'None',                                     ''),
      ('Ava',    'None',      'None',        'Halal',           'None',                                     ''),
      ('Arjun',  'Cow’s milk','None',        'Dairy-free',      'None',                                     'Soy milk from home.'),
      ('Sophie', 'None',      'Eczema',      'None',            'Moisturiser after water play',             '')
    ) as m(first_name, allergies, conditions, dietary, medications, notes)
    join public.children ch on ch.centre_id = c_centre and ch.first_name = m.first_name;
  delete from public.parent_messages where centre_id = c_centre and trigger = 'receipt';  -- no receipts for historic records

  -- ---------- family thread for Maya ----------
  insert into public.parent_messages (centre_id, child_id, trigger, body, status, is_automatic, sent_at)
  values (c_centre, c_maya, 'reminder',
          'Hi Priya, it’s time to review Maya’s medical details. Please check the information in the family portal and send us any changes.',
          'sent', true, date_trunc('day', now()) + interval '9 hours 15 minutes' - interval '11 hours');

  -- ---------- incident register (all notices sent on time) ----------
  insert into public.incidents (centre_id, child_id, reported_by, occurred_at, description, action_taken, is_serious, parent_notified_at) values
    (c_centre, c_ruby,  u_mia,  now() - interval '7 days',  'Ruby tripped on the edge of the sandpit and grazed her left knee.', 'Cleaned with saline, applied a bandaid and comforted. Returned to play.', false, now() - interval '7 days' + interval '2 hours'),
    (c_centre, c_oscar, u_mia,  now() - interval '15 days', 'Oscar had a mild rash on his arms after outdoor play. No breathing symptoms.', 'Monitored for 30 minutes, no further reaction. Parent informed at pickup.', false, now() - interval '15 days' + interval '4 hours'),
    (c_centre, c_isla,  u_sara, now() - interval '24 days', 'Isla bumped her forehead on a table corner during group time. Small red mark, no loss of consciousness.', 'Cold pack, head injury observation for 2 hours.', false, now() - interval '24 days' + interval '30 minutes');

  -- ---------- regulation update waiting for the owner ----------
  insert into public.regulation_updates (centre_id, title, summary, source_url, published_on, status, match_terms, affected_summary)
  values (c_centre, 'Safe sleep guidance review',
          'New safe sleep guidance may affect the centre’s Sleep and Rest Policy. Review current sleep and rest procedures against the latest official guidance and your service’s approved policy.',
          'https://www.acecqa.gov.au/nqf/national-law-regulations/national-regulations', current_date - 7, 'new', '{sleep}',
          'Sleep and rest policy review · Policies & Procedures');

  -- ---------- AI-suggested checklist, waiting for Sara to approve ----------
  perform public._generate_checklist(c_centre);

  -- ---------- audit evidence already on file (verified by Sara) ----------
  -- Evacuation drill is out of date (quarterly, last one 100 days ago) and authorisation records are missing:
  -- the audit agent picks both up once Sara approves the checklist. Sun protection policy is due for renewal soon.
  set constraints all immediate;
  alter table public.evidence disable trigger evidence_completes_rehearsal;
  set constraints all deferred;
  insert into public.evidence (centre_id, checklist_item_id, title, recorded_on, uploaded_by, status, verified_by, verified_at, source, note, created_at)
  select c_centre, ci.id, e.title, current_date - e.days, u_sara, 'verified', u_sara, now() - make_interval(days => e.days - 1), 'seed', 'Demo record', now() - make_interval(days => e.days)
  from (values
    ('evacuation', 'Evacuation drill: all rooms, 4 min 10 s', 100),
    ('premises',   'Weekly premises and playground safety checklist', 5),
    ('emergency',  'Emergency procedures, contacts and floor plan (displayed)', 150),
    ('sun',        'Sun Protection Policy (reviewed)', 345),
    ('sleep',      'Sleep and Rest Policy and risk assessment', 210)
  ) as e(item_key, title, days)
  join public.checklist_items ci on ci.centre_id = c_centre and ci.item_key = e.item_key and ci.is_active;
  set constraints all immediate;  -- run the queued requirement checks before changing the table
  alter table public.evidence enable trigger evidence_completes_rehearsal;
  set constraints all deferred;

  -- ---------- AI agent key (Vercel: BEEHIVE_AGENT_KEY) ----------
  insert into public.agent_keys (centre_id, key_hash, created_by)
  values (c_centre, encode(sha256(convert_to(v_key, 'UTF8')), 'hex'), u_sara);
  perform set_config('beehive.demo_agent_key', v_key, false);
end $$;

-- Copy this key into Vercel as BEEHIVE_AGENT_KEY (shown once; re-run this file to get a new one).
select 'Demo centre ready. Logins: sara@beehive.demo / priya@beehive.demo / mia@beehive.demo, password Beehive2026!' as done,
       current_setting('beehive.demo_agent_key') as agent_key;
