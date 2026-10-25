# Connect the Beehive Audit Assistant (Copilot Studio)

About 20 minutes. You need: Copilot Studio (UNSW login), the Supabase database set up (see the main README), and the owner login for Beehive.

The agent reads live Beehive data through eight database functions, and can save parent-message **drafts** that staff approve in the app. It cannot send anything to parents itself.

## 1. Get the centre's agent key

1. Open Beehive and sign in as the owner (`sara@beehive.demo`).
2. Click **SW** (top right) → **Connect AI agent** → **Create agent key** → **Copy**.

(The demo seed also prints a key at the end of `seed_demo.sql`.) Treat the key like a password: it only works for this one centre, but don't commit it to GitHub.

## 2. Create the agent

1. [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com) → **Create** → **New agent** → **Skip to configure**.
2. **Name:** Beehive Audit Assistant
3. **Description:** Helps a long day care owner prove audit readiness and find evidence fast.
4. **Instructions:** paste the block from section 1 of [PROMPTS.md](../../PROMPTS.md).
5. **Knowledge** → add these public websites:
   - https://www.acecqa.gov.au/nqf/national-law-regulations
   - https://www.acecqa.gov.au/resources/applications/notifications
   - https://www.acecqa.gov.au/nqf/national-quality-standard
6. **Create**.

## 3. Give it the Beehive tool

1. Open [beehive-agent-openapi.json](beehive-agent-openapi.json) in a text editor. Replace every `PASTE_AGENT_KEY_HERE` with the key from step 1 (eight places). Save a copy somewhere outside the repo.
2. In the agent: **Tools** → **Add a tool** → **New tool** → **REST API**.
3. Upload your edited file. Name it **Beehive**, description *Beehive centre records and parent message drafts*.
4. **Authentication:** API key. **Parameter label:** apikey · **Parameter name:** apikey · **Location:** Header.
5. Select all eight tools → **Add**. When asked for a connection, paste the Supabase **publishable key**: `sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8` (it's public by design; never use the secret/service_role key).
6. Open each tool and check **Allow the agent to use this tool** is on. For *DraftParentMessage* set **Ask the user before running** to off (it only saves a draft).

Test in the right-hand panel:
- "How ready are we for an audit?" → readiness score and the red items.
- "Show me the WWCC register" → ten educators.
- "What compliance is overdue?" → the sleep policy review and the evacuation rehearsal.
- "What does the law say about sleep and rest?" → summary, steps and the ACECQA documents, with links.
- "Draft a message to Maya's mum: she had a great day painting." → "Saved as a draft" — it appears on the Beehive overview under **AI drafts awaiting approval**.

If a call fails with 401, the apikey connection is wrong. If it says "Invalid Beehive agent key", the key in the file is wrong.

## 4. Show the agent inside Beehive

1. **Settings** (gear) → **Security** → **Authentication** → **No authentication** → Save. (Demo only: anyone with the token link can chat to it. The data it can reach is limited to this demo centre.)
2. **Publish**.
3. **Channels** → **Mobile app** (or **Web app**) → copy the **Token endpoint** URL.
4. Paste it into `beehive-demo/config.js`:
   ```js
   copilotTokenEndpoint: "https://....powerplatform.com/powervirtualagents/botsbyschema/.../directline/token?api-version=2022-03-01-preview",
   ```
5. Commit and redeploy (or refresh locally).

Now **Ask Beehive** (bottom right) opens your Copilot agent, and **Draft with AI** in a family reply uses it too. With the token endpoint empty, both fall back to a built-in assistant that reads the same data, so the demo always works.

## How it fits together

```
Beehive web app ── Ask Beehive / Draft with AI ──► Copilot Studio agent (Direct Line token endpoint)
                                                       │  REST tool, apikey + agent key
                                                       ▼
                                   Supabase: agent_readiness · agent_search · agent_certificates
                                             agent_children · agent_draft_parent_message
                                             agent_add_regulation_update · agent_guidance · agent_compliance_tasks
```

| Tool | What it does | Writes? |
|---|---|---|
| GetAuditReadiness | Score, every checklist item, pending reviews | No |
| SpotCheckSearch | Certificates, incidents, checklist items and approved medical profiles (allergies, conditions) matching a query | No |
| ListExpiringCertificates | Expired / due within 60 days | No |
| ListChildren | Names and rooms only | No |
| DraftParentMessage | Saves a message as a draft for staff approval | Draft only |
| AddRegulationUpdate | Records a regulation change for the owner to accept | Yes (as "new") |
| ListComplianceTasks | Recurring compliance tasks with due dates and status | No |
| GetOfficialGuidance | Official documents, summary and steps for a checklist item (the compliance library) | No |

Every draft and regulation update the agent creates is written to the audit log. Messages reach a parent only after a staff member approves them in Beehive.
