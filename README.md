# CentreCare
#Hani Lum
#Aryan Talwar
#Ricky An
#Emilija Gliguroska

Compliance tracking and parent updates for small and medium long day care centres.

- **Directors** see every staff check, child medical plan and centre safety task in one place, with what's overdue or due in the next 30 days.
- **Educators** tap a child, record a short voice or typed memo, check the transcript, and approve an AI-drafted update before it goes to the family.
- **Families** see a timeline of their child's day. They only ever see updates an educator has approved.

Built with Next.js (App Router), Supabase (Postgres, Auth, row-level security) and deployed on Vercel. AI drafting uses the Claude API, with a rule-based fallback if no key is set.

---

## Features

| Area | What it does |
|---|---|
| **Today** (dashboard) | Compliance score, overdue and due-soon counts, "needs attention" list, which children have had an update today, drafts waiting for review |
| **Compliance** | Track requirements for staff (first aid, WWCC, CPR…), children (asthma/anaphylaxis plans, EpiPens, immunisation) and the centre (drills, safety checks, policy reviews). Status is calculated from the date: overdue, due within 30 days, or up to date. Directors add, renew, complete and remove items. Educators can view. |
| **Room** | Child tiles with alerts and today's update status |
| **Child page** | Memo → transcript check → AI draft → educator edits and approves. Health and compliance items for that child. Family members linked to the child. |
| **Family view** | Parents see approved updates for their own children, grouped by day, labelled "Drafted with AI · reviewed by [educator]" |
| **Centre** | Join codes for staff and families, rooms, add children, load a sample room |

### Roles and access

Access is enforced in the database with row-level security, not just in the UI.

| | Director | Educator | Parent |
|---|---|---|---|
| Compliance items | Read and write | Read | None |
| Children | Read and write | Read | Own children only |
| Memos and draft logs | Read and write | Read and write | None |
| Approved logs | Read | Read | Own children only |
| Link families, load demo data | Yes | No | No |

People join by code: the director creates the centre, educators join with the **staff code**, families join with the **family code** and are then linked to their child by the director.

---

## Project structure

```
src/
  app/
    login/                 Sign in / sign up
    onboarding/            Create a centre, or join with a code
    (staff)/               Director and educator area
      dashboard/           Today
      compliance/          Compliance tracker
      room/                Child tiles
      children/[id]/       Memo flow, drafts, child health, family links
      settings/            Centre, rooms, children, join codes
    family/                Parent timeline
    auth/                  Email confirmation callback, sign out
  components/              Nav, LogCard, StatusChip, SetupNotice
  lib/
    supabase/              Browser, server and middleware clients
    ai.ts                  Transcript tidy + log drafting (Claude API, with fallback)
    session.ts             requireMember(): auth + role guard
supabase/
  migrations/              Schema, RLS policies, onboarding and demo RPCs
```

---

## Setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com). Choose the **Sydney (ap-southeast-2)** region so data stays in Australia.
2. Apply the schema. Either:
   - **Supabase CLI:**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
   - **Or the dashboard:** open **SQL Editor**, paste the contents of `supabase/migrations/20261015000000_init.sql`, and run it.
3. In **Authentication → URL Configuration**, set the **Site URL** to your Vercel URL (e.g. `https://centrecare.vercel.app`) and add `http://localhost:3000/**` and `https://*.vercel.app/**` to **Redirect URLs**.
4. Copy the **Project URL** and **anon / publishable key** from **Project Settings → API**.

> For quick testing you can turn off **Authentication → Providers → Email → Confirm email**, so new accounts can sign in straight away.

### 2. Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000, create an account, choose **I run a centre**, then go to **Centre → Load sample room** to fill it with demo data.

### 3. Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import the repository. The framework is detected as Next.js; no build settings need changing.
3. Add environment variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` (optional)

   Or install the **Supabase integration** from the Vercel Marketplace, which sets the Supabase variables for you.
4. Deploy. Then set your Vercel URL as the Supabase **Site URL** (step 1.3).
5. To use your own domain, add it under **Vercel → Project → Settings → Domains**, and add it to Supabase's redirect URLs too.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (publishable) key. Safe in the browser because RLS protects the data. |
| `ANTHROPIC_API_KEY` | No | Enables AI transcript tidying and log drafting. Without it, simple rules are used. |
| `ANTHROPIC_MODEL` | No | Override the Claude model (default `claude-sonnet-5-5`) |

Never put the Supabase **service role** key in this app or in any `NEXT_PUBLIC_` variable.

---

## How the AI is kept honest

1. **Transcript check.** The AI only tidies punctuation and filler words, and flags words that may be misheard. The educator edits and must tick "This transcript is accurate" before anything is drafted.
2. **Grounded drafting.** The prompt only allows facts from the confirmed transcript: no invented amounts, times, names or feelings.
3. **Human approval.** Drafts are invisible to families until an educator approves them (enforced by RLS). The educator can edit the title and note first.
4. **Labelled.** Families see "Drafted with AI · reviewed by [educator]".
5. **Staff flags.** Injuries, bites and head knocks are flagged "Complete incident report and notify family". Food that conflicts with a child's alerts is flagged for checking.

---

## Roadmap

- Snap and scan: upload a certificate or action plan photo, AI reads the expiry date
- Expiry reminders by email to directors and the staff member responsible
- Incident report form with family digital sign-off
- Translation of family updates into the home language
- Weekly learning summaries per child
- Sync approved updates to OWNA or other childcare platforms
