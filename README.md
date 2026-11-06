# Beehive

Childcare compliance and family communication for long day care centres. Web app (works on desktop and phone screens) backed by Supabase, with AI agents that run on Google Claude.

**Authors:** Hani Lum · Aryan Talwar · Ricky An · Emilija Gliguroska

See [SPEC.md](SPEC.md) for the specification and [PROMPTS.md](PROMPTS.md) for AI prompts.

## Run it

The app is the static site in `beehive-demo/` (no build step).

- **Locally:** `npx serve beehive-demo` and open the address it prints (or any static server; opening `index.html` directly also works for offline mode).
- **Vercel:** New Project → import this repo → **Root Directory** `beehive-demo` → Framework Preset **Other** → Deploy.
- **Phone size:** the layout adapts below 680px wide (bottom navigation, card-style staff register, bottom-sheet dialogs, full-screen assistant). For a demo on a computer: F12 → Ctrl+Shift+M (Cmd+Shift+M on Mac) → pick an iPhone.

## Design system

The product name is always written **beehive**, in lowercase. All styling lives in `beehive-demo/beehive.css`, starting with design tokens (colour, type, spacing, radii) on `:root`:

- **Colour:** neutral surfaces with honey (`--honey`) used only for the brand mark, the current page, focus rings and hexagon markers. Red, amber and green are for status only.
- **Type:** Inter on a fixed scale (`--t-xs` to `--t-2xl`), sentence case, no all-caps labels.
- **Structure:** hairlines and whitespace instead of boxes. Cards (`.callout`, `.agentCard`) are only for things that need a decision. Details open in a side panel (`openModal`) rather than filling the page.
- **Hexagons:** the brand mark, status markers (`.status`), the Overview's hive activity timeline and the hive guide.
- **Icons:** line icons in `beehive-demo/icons.js`, added with `data-icon="name"`.

Every page answers: what needs attention, what has happened, what action is required.

## Two ways to use it

- **Live mode:** sign in. Everything is read from and saved to Supabase, and updates appear on other open screens straight away.
- **Offline demo:** on the sign-in screen click **Explore the offline demo instead**. Sample data in the browser only. Safest if the internet is unreliable during a presentation.

### Demo logins (after running the seed)

Password for all three: `Beehive2026!`

| Login | Role | Lands on |
|---|---|---|
| sara@beehive.demo | Centre owner (Sara Williams) | Overview: readiness, staff register, family inbox, AI drafts, Ask beehive |
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
   5. `supabase/migrations/20261026090000_compliance_library.sql` (official government documents, summaries and steps for every checklist item)
   6. `supabase/migrations/20261026100000_compliance_register.sql` (the compliance register: recurring tasks with due dates)
   7. `supabase/migrations/20261026110000_compliance_agent.sql` (the Beehive Compliance Agent's tools and reminder drafts)
   8. `supabase/migrations/20261028090000_staff_agent.sql` (the staff compliance agent: renewal tasks, simulated messages, checked uploads, activity feed, daily schedule)
   9. `supabase/migrations/20261029090000_audit_agent.sql` (the audit-readiness agent: requirement status, verified evidence, audit tasks, regulation reviews)
   10. `supabase/migrations/20261030090000_integration.sql` (joins the agents: any record change re-checks requirements at once, regulation actions routed to the right workflow, one reminder system)
   **Already set up up to step 6 (the live project)?** Run `supabase/live_setup.sql` instead of steps 7 to 10 and the demo data: it's all of them in one file, in order, and safe to run again. Rebuild it with `python3 tools/build_live_setup.py` if any of those files change.
2. **Demo data.** Run `supabase/seed_demo.sql`. It creates the three logins, Beehive Early Learning, 10 educators with certificates, 12 children with medical profiles, incidents, a regulation update and a draft checklist. No compliance documents or evidence files are included; you add those during the demo. The last row it returns is the AI agent key. Re-run it any time to reset the demo.
3. **Auth.** **Authentication → URL Configuration** → Site URL = your Vercel address (and `http://localhost:3000` for local). **Providers → Email** → turn off **Confirm email** if you want new sign-ups to work immediately.

## Tables the app uses

| Screen | Tables / views |
|---|---|
| Audit readiness | `checklist_items`, `evidence`, `v_checklist_status`, `v_readiness`, `regulation_updates` |
| Staff certificates | `staff`, `staff_certificates`, `certificate_types`, `certificate_submissions`, `reminders`, `v_certificate_reminders` |
| Staff compliance agent | `credential_tasks`, `agent_messages`, `agent_events`, `agent_runs`, `v_credential_tasks`, `v_agent_feed` |
| Audit-readiness agent | `checklist_items`, `evidence` (now with verification state), `audit_tasks`, `regulation_reviews`, `v_audit_tasks`, `v_checklist_status`, `v_readiness` |
| Spot-check search | `spot_check_search()` over certificates, incidents, checklist and medical profiles |
| Family messages | `messages`, `parent_messages`, `v_family_thread` |
| Medical updates | `medical_updates`, `children`, `child_parents`, `v_child_medical_profile` |
| Incidents | `incidents`, `v_incident_deadlines` |
| Compliance register | `compliance_requirements`, `compliance_records`, `v_compliance_register` |
| Compliance library | `compliance_guides`, `compliance_documents` (shared reference data, read-only) |
| Everything | `centres`, `users`, `audit_log` (append-only), storage bucket `beehive` for uploaded files |

## Compliance

**Compliance** (owner menu) shows every compliance requirement in one place, in two tabs:

- **All compliance:** the recurring tasks (evacuation rehearsals, weekly premises checks, fire equipment service, policy reviews, the Quality Improvement Plan, staff register, excursion risk assessments), each with its regulation, how often it's due, when it was last done and by whom, and whether it's overdue, due soon or on track. **Mark done** records it and sets the next due date. Logging an evacuation drill on the checklist also completes the rehearsal task. Below that are all the audit checklist items with their status.
- **Official guidance:** the compliance library (below).

The demo data includes realistic history: the sleep policy review and evacuation rehearsal are overdue, three tasks are due within 14 days, and the rest are on track.

### Compliance library

The **Official guidance** tab lists the official documents behind every checklist item and recurring task: the National Regulations, plus guidance from ACECQA, the NSW Department of Education, the NSW Early Learning Commission and the Office of the Children's Guardian. Each item has a plain-English summary, numbered steps to comply, what to show an officer, how long to keep records, and links to the official documents. The same guidance appears in each checklist item's dialog, in search results and in Ask beehive.

The content lives in one file, `tools/compliance_library.py`, with the date the sources were checked. To update it, edit that file and run `python3 tools/compliance_library.py`. That rewrites the migration and the offline copy (`beehive-demo/library-data.js`). Then run the migration again in Supabase; it's safe to re-run. Summaries are guidance, not legal advice.

## Staff compliance agent

beehive manages staff credential renewals on the owner's behalf. Every educator's WWCC, first aid, CPR and anaphylaxis training goes through one loop:

1. **Detect and prioritise.** Critical = expired or missing, High = 7 days or less, Medium = 30 days or less, Monitor = later (watched from 60 days). The same scale is used in the database, the staff table, the Overview and every tag.
2. **Request.** For anything High, Medium or Critical, beehive sends the educator a personal renewal request naming the credential and deadline, with a secure upload link (`#upload/<token>`, no sign-in needed). Email is used if there's an address, otherwise SMS. **Delivery is simulated:** each message is recorded with recipient, time, outcome and next follow-up date, but nothing leaves beehive, and the interface says so.
3. **Follow up.** If nothing arrives by the follow-up date (Critical 1 day, High 2, Medium 5), beehive asks again. A credential that becomes more urgent is re-prioritised and chased straight away.
4. **Escalate.** Expired or missing credentials, three unanswered requests, or no contact details go to the owner with an explanation and a recommended action (for example, not counting the educator towards first aid cover).
5. **Check the upload.** The certificate is read in the browser (pdf.js for PDFs, Tesseract OCR for photos and scans). beehive extracts the name, credential, issue and expiry dates and number, compares them with the staff record and flags mismatches, missing fields, old certificates, unreadable files and anything it was unsure of. Uploading the same file twice is refused, and a newer upload replaces an unchecked older one.
6. **Owner verifies.** Nothing counts until the owner approves. Approving updates the credential, verification status and date, closes the task and refreshes compliance; flagged uploads need an extra confirmation. Rejecting keeps the record, records the reason and sends the educator a correction request.

Everything the agent does is in **Agent activity** on the Overview (filter by Monitoring, Action taken, Waiting, Owner review, Resolved) and in the **Renewals** section of Staff certifications, each linked to the staff record with a direct action. It runs when the owner opens beehive, from **Check now**, and every morning at 7:00 Sydney time through `pg_cron` where the project has it enabled. In the offline demo the same rules run in the browser.

**Demo scenario:** Oliver King's First Aid moves from 33 to 30 days, so beehive raises it to Medium and sends the request. Open his task, then *Open Oliver's upload link (demo)*, pick the *Renewed* sample certificate and send it. Back on the Overview, verify it: his record, the task and the staff table update. The seed also has Luca's expired First Aid and Jack's missing anaphylaxis training (escalated), Amara's old WWCC upload (flagged; reject it to see the correction request), overdue follow-ups for Noah, Mia and Luca, and Leo with no email (SMS). Seeded history is labelled *Demo history*, and the sample certificates say *SAMPLE ONLY*.

## One system

The staff agent, the audit agent and the compliance assistant share one set of records and one history.

- **Shared records.** Staff, credentials, certificate uploads, evidence, compliance tasks, regulation reviews and agent tasks each live in one table. Audit requirements about credentials are worked out from the staff register, so renewing a credential updates the requirement and readiness with nothing entered twice. Any change to these records re-checks the requirements in the same save (database triggers), and the activity entry says what caused the change, for example "Jack Wilson's Anaphylaxis training was verified".
- **Linked both ways.** A credential renewal shows the audit requirement it counts towards; a credential requirement lists the renewals the staff agent is handling.
- **One reminder system.** The compliance assistant (Claude) won't draft a reminder the staff agent is already sending; an approved draft goes out through the staff agent's renewal (same message history and follow-up schedule), and its escalations land on that renewal. The old expiry check runs the staff agent.
- **Regulation decisions use the right workflow.** "Policy needs updating" on a document requirement asks for the updated policy (upload, check, verify). On a requirement checked from beehive's own records (credentials, medical, incidents, child records) it creates an owner action that points to that workflow and is closed by the owner.
- **One Overview.** A summary strip (open issues detected, actions done this week, waiting on staff, need you), one "Needs your attention" list (decisions first, then to-dos beehive proposed), one prioritised "What beehive detected" list across credentials, requirements and regulation changes, who beehive is waiting on, and the activity feed. The strip, the list and the bell use the same list, so the numbers always agree.
- **Honest activity.** The feed holds only the agents' own records with real timestamps, in five states (Monitoring, Action taken, Waiting, Owner review, Resolved). Simulated messages are labelled *Simulated message*, seeded examples *Demo history*, and suggestions *Proposed*. Every entry links to its record or task.

## Audit-readiness agent

The audit-readiness agent works over the checklist Sara approves (Staff Records, Children's Records, Safety & Premises, Policies & Procedures). It doesn't keep a second copy of anything: staff-record requirements read the same certificates the staff agent manages, and the agent's work goes into the same activity feed.

- **Every requirement shows** its description, regulatory source, required evidence, current evidence, status, priority, last-reviewed date and next action.
- **Status is Missing, Under review or Compliant**, with indicators for Overdue, Renewal due soon, Review required, Awaiting verification, Credentials expiring and Scheduled task overdue. Uploading a document never makes a requirement compliant: new evidence is *pending* until the owner verifies it, and uncertain evidence stays under review.
- **Monitoring.** On each run the agent checks for missing or out-of-date evidence, upcoming renewals, overdue compliance tasks, outstanding verifications and regulation updates. For each gap it records the affected requirement, what evidence is there or missing, the priority and why, and the next action.
- **Coordinated follow-up.** Where someone else holds the evidence (for example the lead educator for the evacuation drill), the agent assigns a task and sends a request with a secure upload link, then follows up. Delivery is simulated, as for the staff agent. Credential gaps link to the staff agent's renewals instead of sending competing reminders.
- **Evidence checks.** Uploads are read in the browser and assessed against the requirement: topic, date, whether it is recent enough to close the gap, and duplicates. The owner then verifies or rejects. Verifying updates the status, verification date and outstanding tasks; rejecting keeps the record and asks for a corrected upload.
- **Regulation updates.** A new update is assessed against the checklist. Possibly affected requirements are flagged *Review required*, each with an owner task giving the reason and the recommended next step. The agent never rewrites a policy or marks anything non-compliant on its own, and says when the impact is uncertain. The owner records one decision per requirement: *no change needed*, *update needed* (the requirement stays under review until the updated policy is uploaded and verified) or *doesn't apply*.
- **Readiness** = (compliant + ½ × under review) ÷ approved requirements, shown with the breakdown. **"What is stopping us from being audit ready?"** (on the Audit readiness page and in Ask beehive) answers from the live data: the highest-priority gaps, why they matter and what to do next, each linked to the requirement or task.

**Cross-agent demo:** on the Overview, open Jack Wilson's anaphylaxis renewal (missing, critical), open his upload link, upload the *Renewed* sample and verify it. His staff record updates, the renewal closes, *Staff qualification and training records* goes Missing → Under review → Compliant and readiness rises, all in one activity sequence. Offline, **Add a demo update** on Regulation updates adds a first aid change: record "Policy needs updating", then mark the owner action done.

**Demo scenario:** approve the checklist. The agent finds the evacuation drill out of date (last one 100 days ago, critical), asks Mia for the new drill record, and flags the missing authorisation records. Open Mia's upload link from the requirement, upload the *Out of date* sample to see it flagged and rejected, then the *Current* sample and verify it: the requirement turns Compliant, the overdue rehearsal task completes and readiness rises. For regulations, the safe sleep update flags *Sleep and rest policy* as Review required; record *update needed*, upload the updated policy and verify it to close the review.

## Beehive Compliance Agent

Designed in [AGENT.md](AGENT.md) (Design Card, instructions and tests). On the **Compliance** page, Sara types an instruction (or leaves the default "Run the weekly credential check"), and clicks **Run agent**. The agent checks every educator's WWCC, first aid, CPR and anaphylaxis, drafts personalised renewal reminders with an upload link and a follow-up date, and flags what Sara must decide (expired or missing credentials, renewals waiting for her review). Sara edits and approves each reminder; the educator then sees it on their certificates page. Nothing is sent without her approval.

It runs on the server (`beehive-demo/api/agent.js`) with the Vercel AI SDK and Claude. Its system prompt is `beehive-demo/api/_agent-instructions.js`, generated from AGENT.md with `python3 tools/sync_agent_instructions.py`. Its only tools are: review credentials, save reminder drafts, flag for the owner. The database checks every draft (no reminders for current credentials, submitted renewals or duplicates), and the server stops after 5 tool calls.

**Set up (once):**
1. Get a Claude API key at console.anthropic.com (**API keys → Create key**) and add some credit under **Billing**. A Claude.ai Pro or Max subscription doesn't include API access; the Console account is separate.
2. In Vercel → **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Claude API key
   - `AGENT_MODEL` (optional) = defaults to `claude-haiku-5-5`; use `claude-sonnet-5-5` for stronger but slower answers
   - Set a monthly spend limit at console.anthropic.com → **Settings → Limits**: the AI features don't need a passcode, so anyone with the site's link can use them (each visitor is limited to 30 AI calls per 10 minutes, see `api/_guard.js`).
   - `BEEHIVE_AGENT_KEY` = the agent key from the last row of `seed_demo.sql`
3. Run `supabase/migrations/20261026110000_compliance_agent.sql` in Supabase, then redeploy on Vercel.

Use the invented demo data only: don't send real children's or staff details to any AI service until the centre has agreed to it.

## Staff records and contracts

- **Staff → Add educator** adds a new educator (role, room, qualification, usual days). The staff agent then asks them for any required credential that isn't on file.
- Open an educator to **Add document**: required credentials (WWCC, first aid, CPR, anaphylaxis, asthma) replace the one on file; qualifications, child protection training and other documents are kept alongside. A qualification counts towards the roster's 50% diploma rule.
- **This educator is leaving** moves them to **Former educators**: off the roster and the reminders, with their records kept for 3 years after their last day (Reg 183(2)(f)). Live mode needs `supabase/migrations/20261106120000_staff_records.sql` (included in `live_setup.sql`).
- **Centre → Contracts → Change the agreement** amends a child's agreement (room, days, allergies, medical conditions, medication, diet, authorised nominees, other terms). The child's record, the daily sheet and the roster's ratios update straight away; the amended PDF shows the change and waits for the parent's signature. Amendments are stored in the browser for now.

## Ask beehive (Claude)

**Ask beehive** (owner, top right) and **Draft with AI** (in a family reply) use Claude through `beehive-demo/api/ask.js`, a Vercel function with the same settings as the Compliance agent (`ANTHROPIC_API_KEY`, `BEEHIVE_AGENT_KEY`, optional `AGENT_MODEL`).

- **Ask beehive** answers from beehive's own records through three read-only tools: the Overview data (`agent_overview`: readiness and how it's worked out, every requirement with status, priority, why and next action, staff renewals, audit tasks, regulation updates and decisions, compliance tasks, what's waiting for the owner), the compliance library (`agent_guidance`) and record search. It can't change anything and never sees children's medical details. Readiness questions also get links straight to the gaps.
- **Draft with AI** writes a short message from the educator's note. It's saved as a draft and nothing is sent until a staff member approves it.
- Signed in, these use Claude straight away (no passcode). In the offline demo, or if Claude is unavailable, a built-in assistant answers from the same records with fixed rules and says so.
- Database functions: `supabase/migrations/20261031090000_ask_beehive.sql`.

The agent never sends anything to a parent. Only receipts and reminders send automatically; every other message is a draft until a staff member approves it.

## What's simulated

SMS and email delivery (messages are recorded in the app, never delivered) and regulation monitoring (updates are added by the agent or in the seed). Certificate reading is real OCR in the browser, but it only ever suggests: the owner verifies every certificate.

## Beehive flows (database and data functions)

The three owner/parent flows (audit readiness, staff certification, parent medical updates) and AI-drafted parent messages are built in the database. The web app calls them in `beehive-demo/live.js`; [docs/DATA.md](docs/DATA.md) documents the earlier `src/lib/beehive.js` wrappers.

Key rules enforced by the database:
- Approved medical records lock. Parents can only see and submit for their own child.
- Messages about a child's wellbeing or incidents need staff approval. Only receipts and reminders send automatically.
- Every submission, approval and sent message is written to an append-only audit log (owner/director can read it).

## Code layout

```
beehive-demo/          The web app
  index.html, app.js   Screens (offline demo logic included)
  beehive.css          The design system and all styles
  icons.js             Line icons and the hexagon brand mark
  live.js              Supabase sign-in, loading and saving (live mode)
  assistant.js         Ask beehive, Draft with AI, AI settings (Claude via api/ask.js, built-in fallback)
  library.js           Compliance library page, item guidance, search
  library-data.js      Offline copy of the library (generated)
  agent.js             Staff compliance agent: renewals, activity feed, review, upload link (plus the offline engine)
  audit.js             Audit-readiness agent: requirements, gaps, evidence review, regulation reviews (plus the offline engine)
  extract.js           Reads certificates in the browser (pdf.js, Tesseract) and makes demo sample certificates
  config.js            Supabase URL + publishable key
  api/agent.js         Beehive Compliance Agent (Vercel function, Claude via the AI SDK)
  api/_agent-instructions.js  Its system prompt, generated from AGENT.md
  api/ask.js           Ask beehive and Draft with AI (Vercel function, Claude via the AI SDK)
  vercel.json          Gives the Claude functions up to 2 minutes
  package.json         Server dependencies (ai, @ai-sdk/google, zod)
supabase/migrations/   Database schema, views, functions and security rules
supabase/seed_demo.sql Demo data for the web app
tools/compliance_library.py  Source of the compliance library (generates the migration + offline copy)
App.js, src/           Earlier Expo (React Native) version, kept for reference
```

## Prototype boundary

Before real childcare use: verified regulatory content, consent and media controls, real SMS/email delivery, signed-in access to the AI agent, and a privacy review. Do not use compliance summaries as legal or regulatory advice.
