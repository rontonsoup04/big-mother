-- Add a child with every enrolment detail, and keep the documents beehive drafts for them (Nov 2026).
-- Re-runnable.

-- The full enrolment record (Regs 160–162): days of care, parents, nominees, medical, immunisation and so on.
-- Kept as one JSON object so the form can grow without a migration each time.
alter table public.children add column if not exists enrolment jsonb not null default '{}'::jsonb;

-- Documents drafted for a child (contracts, consents, plans), edited by the owner before saving.
create table if not exists public.child_documents (
  id          uuid primary key default gen_random_uuid(),
  centre_id   uuid not null references public.centres (id) on delete cascade,
  child_id    uuid not null references public.children (id) on delete cascade,
  title       text not null,
  body        text not null default '',
  prompt      text not null default '',
  drafted_by_ai boolean not null default true,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists child_documents_child_idx on public.child_documents (child_id, created_at desc);

alter table public.child_documents enable row level security;
drop policy if exists "staff read child documents" on public.child_documents;
create policy "staff read child documents" on public.child_documents for select
  using (centre_id = public.my_centre_id() and public.is_staff());
drop policy if exists "leaders manage child documents" on public.child_documents;
create policy "leaders manage child documents" on public.child_documents for all
  using (centre_id = public.my_centre_id() and public.is_leader())
  with check (centre_id = public.my_centre_id() and public.is_leader());
grant select, insert, update, delete on public.child_documents to authenticated;
