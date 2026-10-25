# Beehive

Childcare compliance and family communication for long day care centres. Expo / React Native app (runs on phones and in a web browser), backed by Supabase.

**Authors:** Hani Lum · Aryan Talwar · Ricky An · Emilija Gliguroska

See [SPEC.md](SPEC.md) for the specification and [PROMPTS.md](PROMPTS.md) for AI prompts.

## Run it

1. Install [Node.js](https://nodejs.org) (LTS).
2. In this folder:
   ```bash
   npm install
   npx expo start --web
   ```
3. It opens at **http://localhost:8081**. To look like a phone for a demo: press F12, then Ctrl+Shift+M (Cmd+Shift+M on Mac), and pick an iPhone size.

On a phone: run `npx expo start` and scan the QR code with the **Expo Go** app.

## Two ways to use it

- **Demo mode:** on the sign-in screen tap **Explore the demo without signing in**. Uses built-in sample content. Nothing is saved. Safest for presentations.
- **Live mode:** sign in. Everything comes from and is saved to Supabase.

## Supabase setup (once per project)

The app is already pointed at project `gaxkvceirdxqfpeeskwf` (see `src/lib/config.js`). The publishable key is meant to be public; row-level security in the database controls access. **Never put the service_role / secret key in the app.**

1. **Create the tables.** Supabase dashboard → **SQL Editor** → paste and run, in order:
   1. `supabase/migrations/20261015090000_init.sql`
   2. `supabase/migrations/20261025000000_realtime_messages.sql`
   3. `supabase/migrations/20261025100000_beehive.sql` (audit readiness, certificate uploads, medical updates, parent messages, audit log, file storage)

   Or connect the repo under **Project Settings → Integrations → GitHub** (working directory `.`, Deploy to production on `main`) so migrations apply on merge.
2. **Make sign-up easy for testing:** **Authentication → Providers → Email** → turn off **Confirm email**.
3. **Web address:** **Authentication → URL Configuration** → Site URL `http://localhost:8081` (add your deployed URL later).

### First run in live mode

1. Sign up, choose **I run a centre**. You become the owner.
2. Tap the person icon (top right) → **Load sample data**. Adds staff, certificates, children, compliance items, incidents, updates, an approved audit-readiness checklist (about 60% ready) and an AI message draft.
3. To try other roles, sign up again in a private window using the **staff code** (educator) or **family code** (parent) from the same menu. Link a parent to a child with the `link_parent` function, or in SQL:
   ```sql
   select link_parent('<child id>', 'parent@email.com', 'Mother');  -- run while signed in as the owner, or insert into child_parents
   ```

## What each screen does (live mode)

| Tab | Owner / director | Educator | Parent |
|---|---|---|---|
| Home | Compliance health, expired certificates, overdue incident notices, items due | Same, for their centre | — |
| Compliance | Overdue / due-soon items; mark done (recurring items reschedule automatically) | Same | — |
| Staff | Every staff member's certificates and reminder dates | Their own certificates | — |
| Learning | Post updates for a child or all families; recent updates | Same | — |
| Family | Message thread per child (live) | Same | Their child's updates and messages |

Voice notes record on phones only and stay on the device. The timetable is sample content.

## Beehive flows (database and data functions)

The three owner/parent flows (audit readiness, staff certification, parent medical updates) and AI-drafted parent messages are built in the database with data functions in `src/lib/beehive.js`. **See [docs/DATA.md](docs/DATA.md)** for every function, step by step. Screens for them come with the new front end.

Key rules enforced by the database:
- Approved medical records lock. Parents can only see and submit for their own child.
- Messages about a child's wellbeing or incidents need staff approval. Only receipts and reminders send automatically.
- Every submission, approval and sent message is written to an append-only audit log (owner/director can read it).

## Code layout

```
App.js                 Login, onboarding, role-based tabs, demo mode
src/lib/config.js      Supabase URL + publishable key
src/lib/supabase.js    Supabase client
src/lib/data.js        Core database reads/writes (reuse this in any new front end)
src/lib/beehive.js     Audit readiness, certificates, medical updates, parent messages, audit log
src/screens/           Auth, Onboarding, Home, Compliance, Staff, Learning, Family, More
src/demo.js            Demo-mode sample content
supabase/migrations/   Database schema, views, triggers and security rules
```

## AI

The AI agent is built in **Microsoft Copilot Studio** as the *Beehive Audit Assistant*. Its one narrow job: help the owner prove audit readiness (generate the checklist, explain gaps, spot-check search, summarise regulation changes). Its instructions are in [PROMPTS.md](PROMPTS.md).

Inside the app today, readiness scores and statuses are calculated exactly from records, not by AI, and parent message drafts use a template (`draftMessageText` in `src/lib/beehive.js`). Connecting the app to the Copilot Studio agent (via its web channel or Power Automate) is the next step. Staff approve every AI-drafted message before it reaches a parent.

## Prototype boundary

Before real childcare use: verified regulatory content, consent and media controls, file storage for evidence and photos, reminder emails, audit logging, and a privacy review. Do not use compliance summaries as legal or regulatory advice.
