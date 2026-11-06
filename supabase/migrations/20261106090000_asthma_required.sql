-- Emergency asthma management training is now a required credential for every educator (Reg 136).
-- Educators with no ASTHMA record show as missing, so the staff agent asks them to upload one.
create or replace function public._required_cert_codes()
returns text[] language sql immutable as $$ select array['WWCC', 'FIRST_AID', 'CPR', 'ANAPHYLAXIS', 'ASTHMA'] $$;
