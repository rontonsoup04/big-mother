-- Let a requirement be checked against the children's records themselves (Nov 2026).
-- The enrolment requirement ("Children's enrolment and contact records") uses evidence_kind 'children':
-- the readiness check counts active children with no emergency contact (see _requirement_status).
-- Run this on its own, before 20261114090000_fuller_requirements.sql: Postgres can't use a new enum value
-- in the same transaction that adds it. Re-runnable.
alter type public.evidence_kind add value if not exists 'children';
