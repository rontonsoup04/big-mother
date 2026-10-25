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

## 3. Give it the Beehive tools (MCP)

Beehive includes a small MCP (Model Context Protocol) server, deployed with the website at `/api/mcp`. The website must be deployed on Vercel from a branch that includes `beehive-demo/api/mcp.js`.

1. In the agent: **Tools** → **Add a tool** → **+ Add** → **Model Context Protocol**.
2. Fill in:
   - **Server name:** Beehive
   - **Server description:** Beehive centre records, compliance tasks, official guidance and parent message drafts
   - **Server URL:** `https://<your-vercel-site>/api/mcp`
3. **Authentication:** API key → **Type:** Header → **Header name:** `x-beehive-key` → **Create**.
4. When it asks for a connection, choose **Create new connection** and paste your **agent key** (from step 1) as the API key → **Create** → **Add to agent**.
5. Check the 8 tools appear and are turned on: get_audit_readiness, spot_check_search, list_expiring_certificates, list_compliance_tasks, get_official_guidance, list_children, draft_parent_message, add_regulation_update.

If the API key option gives you trouble, choose **Authentication: None** and put the key in the URL instead: `https://<your-vercel-site>/api/mcp?key=<agent key>`. Fine for the demo; anyone with that URL can read the demo centre's data.

**Alternative (accounts with REST API tools):** **+ Add** → **REST API**, upload [beehive-agent-openapi.json](beehive-agent-openapi.json) with every `PASTE_AGENT_KEY_HERE` replaced by your key, authentication API key in header `apikey`, connection value = the Supabase publishable key.

Test in the right-hand panel:
- "How ready are we for an audit?" → readiness score and the red items.
- "Show me the WWCC register" → ten educators.
- "What compliance is overdue?" → the sleep policy review and the evacuation rehearsal.
- "What does the law say about sleep and rest?" → summary, steps and the ACECQA documents, with links.
- "Draft a message to Maya's mum: she had a great day painting." → "Saved as a draft" — it appears on the Beehive overview under **AI drafts awaiting approval**.

If a tool says "Missing Beehive agent key", the connection has no key (check the header name is `x-beehive-key`). "Invalid Beehive agent key" means the key is wrong, or `seed_demo.sql` hasn't been run in this Supabase project. Opening `https://<your-vercel-site>/api/mcp` in a browser should show "Beehive MCP server. Use POST"; a 404 means the site hasn't been redeployed with the MCP server yet.

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
                                                       │  MCP: https://<site>/api/mcp + agent key
                                                       ▼
                                   Beehive MCP server (Vercel function, beehive-demo/api/mcp.js)
                                                       ▼
                                   Supabase: agent_readiness · agent_search · agent_certificates
                                             agent_children · agent_draft_parent_message
                                             agent_add_regulation_update · agent_guidance · agent_compliance_tasks
```

| Tool | What it does | Writes? |
|---|---|---|
| get_audit_readiness | Score, every checklist item, pending reviews | No |
| spot_check_search | Certificates, incidents, checklist items and approved medical profiles (allergies, conditions) matching a query | No |
| list_expiring_certificates | Expired / due within 60 days | No |
| list_children | Names and rooms only | No |
| draft_parent_message | Saves a message as a draft for staff approval | Draft only |
| add_regulation_update | Records a regulation change for the owner to accept | Yes (as "new") |
| list_compliance_tasks | Recurring compliance tasks with due dates and status | No |
| get_official_guidance | Official documents, summary and steps for a checklist item (the compliance library) | No |

Every draft and regulation update the agent creates is written to the audit log. Messages reach a parent only after a staff member approves them in Beehive.
