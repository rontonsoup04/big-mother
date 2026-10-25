# Beehive

Childcare compliance and family communication for long day care centres. Web app (works on desktop and phone screens) backed by Supabase, with an AI agent built in Microsoft Copilot Studio.

**Authors:** Hani Lum · Aryan Talwar · Ricky An · Emilija Gliguroska

See [SPEC.md](SPEC.md) for the specification and [PROMPTS.md](PROMPTS.md) for AI prompts.

## Run it

The app is the static site in `beehive-demo/` (no build step).

- **Locally:** `npx serve beehive-demo` and open the address it prints (or any static server; opening `index.html` directly also works for offline mode).
- **Vercel:** New Project → import this repo → **Root Directory** `beehive-demo` → Framework Preset **Other** → Deploy.
- **Phone size:** the layout adapts below 680px wide (bottom navigation, card-style staff register, bottom-sheet dialogs, full-screen assistant). For a demo on a computer: F12 → Ctrl+Shift+M (Cmd+Shift+M on Mac) → pick an iPhone.

## Two ways to use it

- **Live mode:** sign in. Everything is read from and saved to Supabase, and updates appear on other open screens straight away.
- **Offline demo:** on the sign-in screen click **Explore the offline demo instead**. Sample data in the browser only. Safest if the internet is unreliable during a presentation.

### Demo logins (after running the seed)

Password for all three: `Beehive2026!`

| Login | Role | Lands on |
|---|---|---|
| sara@beehive.demo | Centre owner (Sara Williams) | Overview: readiness, staff register, family inbox, AI drafts, Ask Beehive |
| priya@beehive.demo | Parent of Maya Patel | Family app: messages, medical update form |
| mia@beehive.demo | Educator (Mia Chen) | Upload her own certificate |

The sign-in screen has one-click buttons for each.

## Supabase setup (once per project)

The app points at project `gaxkvceirdxqfpeeskwf` (`beehive-demo/config.js`). The publishable key there is public by design; row-level security in the database controls access. **Never put the service_role / secret key in the app or in GitHub.**

1. **Tables and functions.** Supabase dashboard → **SQL Editor** → paste and run, in order:
   1. `supabase/migrations/20261015090000_init.sql`
   2. `supabase/migrations/20261025000000_realtime_messages.sql`
   3. `supabase/migrations/20261025100000_beehive.sql`
   4. `supabase/migrations/20261025200000_frontend_alignment.sql` (matches the database to the web app's screens, adds the AI agent API)
2. **Demo data.** Run `supabase/seed_demo.sql`. It creates the three logins, Beehive Early Learning, 10 educators with certificates, 12 children with medical profiles, incidents, a regulation update and a draft checklist. No compliance documents or evidence files are included; you add those during the demo. The last row it returns is the AI agent key. Re-run it any time to reset the demo.
3. **Auth.** **Authentication → URL Configuration** → Site URL = your Vercel address (and `http://localhost:3000` for local). **Providers → Email** → turn off **Confirm email** if you want new sign-ups to work immediately.

## Tables the app uses

| Screen | Tables / views |
|---|---|
| Audit readiness | `checklist_items`, `evidence`, `v_checklist_status`, `v_readiness`, `regulation_updates` |
| Staff certificates | `staff`, `staff_certificates`, `certificate_types`, `certificate_submissions`, `reminders`, `v_certificate_reminders` |
| Spot-check search | `spot_check_search()` over certificates, incidents, checklist and medical profiles |
| Family messages | `messages`, `parent_messages`, `v_family_thread` |
| Medical updates | `medical_updates`, `children`, `child_parents`, `v_child_medical_profile` |
| Incidents | `incidents`, `v_incident_deadlines` |
| Everything | `centres`, `users`, `audit_log` (append-only), storage bucket `beehive` for uploaded files |

## AI agent

The **Beehive Audit Assistant** runs in Microsoft Copilot Studio and reads live Beehive data through a REST tool. In the app:

- **Ask Beehive** (owner, bottom right): readiness, what to fix first, WWCC register, expiring certificates, draft a message.
- **Draft with AI** in a family reply, and **AI drafts awaiting approval** on the overview.

Set-up steps: [docs/copilot-studio/SETUP.md](docs/copilot-studio/SETUP.md). Until the agent's token endpoint is added to `config.js`, the app uses a built-in assistant over the same data, so the demo works either way.

The agent never sends anything to a parent. Only receipts and reminders send automatically; every other message is a draft until a staff member approves it.

## What's simulated

SMS and email delivery (messages appear in the app only), reading expiry dates from certificate photos (the owner confirms the date), and regulation monitoring (updates are added by the agent or in the seed).

## Beehive flows (database and data functions)

The three owner/parent flows (audit readiness, staff certification, parent medical updates) and AI-drafted parent messages are built in the database. The web app calls them in `beehive-demo/live.js`; [docs/DATA.md](docs/DATA.md) documents the earlier `src/lib/beehive.js` wrappers.

Key rules enforced by the database:
- Approved medical records lock. Parents can only see and submit for their own child.
- Messages about a child's wellbeing or incidents need staff approval. Only receipts and reminders send automatically.
- Every submission, approval and sent message is written to an append-only audit log (owner/director can read it).

## Code layout

```
beehive-demo/          The web app
  index.html, app.js, app.css   Screens (offline demo logic included)
  live.js              Supabase sign-in, loading and saving (live mode)
  assistant.js         Ask Beehive, Draft with AI, Connect AI agent
  beehive-live.css     Live-mode extras and the phone layout
  config.js            Supabase URL + publishable key + Copilot token endpoint
supabase/migrations/   Database schema, views, functions and security rules
supabase/seed_demo.sql Demo data for the web app
docs/copilot-studio/   Agent setup guide and REST tool definition
App.js, src/           Earlier Expo (React Native) version, kept for reference
```

## Prototype boundary

Before real childcare use: verified regulatory content, consent and media controls, real SMS/email delivery, signed-in access to the AI agent, and a privacy review. Do not use compliance summaries as legal or regulatory advice.
