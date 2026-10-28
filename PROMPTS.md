# AI prompts

Every AI prompt that shapes Beehive.

## 0. Beehive Compliance Agent (Gemini, server-side)

**Where it runs:** `beehive-demo/api/agent.js` (Vercel function) with the Vercel AI SDK and a Gemini Flash model. Started from the Compliance page with the team passcode.
**Prompt:** the "Agent instructions" section of [AGENT.md](AGENT.md), copied word for word into `beehive-demo/api/_agent-instructions.js` by `tools/sync_agent_instructions.py`. AGENT.md's Design Card is the source of truth: change a decision there, regenerate the instructions, sync, and retest.
**Safeguards:** three tools only (review credentials, save reminder drafts, flag for owner); the database refuses drafts for current credentials, submitted renewals, duplicates and unknown names; the server adds the upload link, caps each call at 15 drafts and stops after 5 tool calls; every reminder is a draft until Sara approves it; every agent action is in the audit log.

**v1 (26 Oct 2026):** first version from the Design Card.

## 1. Ask beehive (Gemini, server-side)

**Where it runs:** `beehive-demo/api/ask.js` (Vercel function), Gemini Flash through the Vercel AI SDK. Opened with **Ask beehive** (owner, top right) after entering the team passcode.
**Pattern:** one narrow job: answer the owner's questions about this centre's compliance from its own records.
**Tools (read-only):** `get_overview` (database function `agent_overview`), `get_guidance` (`agent_guidance`, the compliance library with official sources) and `search_records` (`agent_search`, without medical records). At most 4 steps; 50-second limit.
**Instructions:** the `ASK_INSTRUCTIONS` constant in `beehive-demo/api/ask.js`. In short: use only facts from the tools, never invent names, dates or regulations; answer in one sentence then up to five bullets with exact requirement titles, why each matters and the next action; the agents already chase renewals and evidence, and email/SMS are simulated; guidance is not legal advice.
**Fallback:** without the passcode, offline, or if Gemini fails, `Assistant.ask` in `beehive-demo/assistant.js` answers with fixed rules over the same records and labels the answer "Built-in answer".

**v2 (29 Oct 2026):** moved to Gemini; reads the agents' requirement, renewal and regulation data.

## 2. Parent message drafts

**Where it runs:** the **Draft with AI** button in a family reply. With the team passcode entered, the app asks Gemini through `beehive-demo/api/ask.js` (mode `draft`, instructions in `DRAFT_INSTRUCTIONS`). Without it, `Assistant.draftReply` in `beehive-demo/assistant.js` uses a fixed template. Either way the result is a draft that staff approve.

**What the app sends to Gemini:** the child's first name, the parent's first name and the educator's note, with these instructions:

```text
You write short messages from an Australian childcare centre to a parent, for a staff member to review before sending.
- Use only the facts in the educator's note. Never add health, medical or incident details that aren't in the note.
- Warm, plain Australian English, 2 to 4 sentences, first names only, no emoji, no sign-off name.
- Reply with the message text only.
```

The returned text goes into the reply box; the staff member edits it and presses Send, or it's saved as a draft for approval.

**Safeguards**
- Every wellbeing or incident message is saved as a draft. A staff member must approve it before the parent sees it, and the database blocks inserting a message as already sent.
- The audit log stores both the AI draft and the final approved text.
- Only receipts and document reminders are sent automatically, and those use fixed wording.
