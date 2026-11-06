// beehive Morning hive agent: server-only Vercel function at /api/hive (see AGENT.md, "Morning hive agent").
//
// Each morning the app sends a snapshot of the day (bookings per room, the roster, educators' credentials,
// children's open paperwork, legal items). Claude works through it with four tools and returns at most five
// proposals for the owner: fill a roster gap, chase a document, draft a message to a family, or flag a
// decision. Every tool checks its input against the snapshot, so Claude can't propose an educator who isn't
// qualified or available, or a child or credential that doesn't exist. Nothing is applied here: the owner
// approves each proposal in the app, and only then does the app make the change.
//
// Environment variables: ANTHROPIC_API_KEY, optional AGENT_MODEL (see api/_model.js). No passcode: api/_guard.js limits how often each visitor can call it.

const { generateText, tool, stepCountIs } = require("ai");
const { z } = require("zod");
const { modelFor } = require("./_model.js");
const { tooMany } = require("./_guard.js");

const MAX_PROPOSALS = 5;
const MAX_STEPS = 6;
const TIME_LIMIT_MS = Number(process.env.AGENT_TIME_LIMIT_MS) || 110000;

const INSTRUCTIONS = `You are the Morning hive agent for an Australian long day care centre in NSW. Each morning you check the day ahead and prepare the few things the centre owner should act on. The owner approves or rejects every proposal; you never change anything yourself.

Use only the DAY SNAPSHOT in the message. Never invent people, children, rooms, dates or rules.

Work in this order and stop when you have at most ${MAX_PROPOSALS} proposals:
1. Roster: for each room where "short_by" is above 0 or the diploma rule isn't met, call fill_roster_gap with an educator from "available_to_add" (fully qualified, free that day). Prefer the room's own educators and diploma holders when the diploma rule is short. One proposal per gap.
2. Credentials: for an educator whose required credential is expired, missing or due within 14 days and who has no request in progress, call chase_document.
3. Families: for a child with an amended agreement awaiting the parent's signature, a new medical plan, or missing enrolment items, call draft_parent_message with a warm 2 to 4 sentence message in plain Australian English, first names only, that asks for exactly what is needed.
4. Anything that needs the owner's judgement (a regulation change to decide, an expired credential with no cover, a requirement gap) goes through flag_for_owner.

Rules:
- Ratios: 1:4 under 2 years, 1:5 from 2 to 3, 1:10 from 3 to preschool age; the youngest child sets the room's ratio. At least half the educators needed must hold a diploma or above (Reg 126).
- Never propose an educator with an expired or missing credential for the roster.
- Each "reason" is one plain sentence the owner can check against the snapshot.
- If a tool returns an error, fix the input or skip that item.
- Finish with one sentence summarising the day, under 30 words.`;

// ---------- validation against the snapshot ----------
function buildTools(snap, out) {
  const ed = (id) => (snap.educators || []).find((e) => e.id === id);
  const kid = (id) => (snap.children || []).find((k) => k.id === id);
  const room = (name) => (snap.rooms || []).find((r) => r.room === name);
  const full = () => out.length >= MAX_PROPOSALS;
  const push = (p) => { if (full()) return { error: "You already have " + MAX_PROPOSALS + " proposals. Stop and write the summary." }; out.push(p); return { ok: true, proposals_so_far: out.length }; };
  return {
    fill_roster_gap: tool({
      description: "Propose adding one educator to a room on the day's roster.",
      inputSchema: z.object({ room: z.string(), educator_id: z.string(), shift: z.enum(["early", "mid", "late"]), reason: z.string().max(240) }),
      execute: async (i) => {
        const r = room(i.room), e = ed(i.educator_id);
        if (!r) return { error: "No room called " + i.room + " in the snapshot." };
        if (!e) return { error: "No educator with id " + i.educator_id + "." };
        if (!(snap.available_to_add || []).includes(e.id)) return { error: e.name + " isn't available to add: not fully qualified, not working that day, or already rostered." };
        if (out.some((p) => p.kind === "fill_roster_gap" && p.educator_id === e.id)) return { error: e.name + " is already proposed for another room." };
        return push({ kind: "fill_roster_gap", room: r.room, educator_id: e.id, educator: e.name, shift: i.shift, reason: i.reason });
      },
    }),
    chase_document: tool({
      description: "Propose sending an educator a request (with a secure upload link) for one required credential.",
      inputSchema: z.object({ educator_id: z.string(), credential: z.enum(["WWCC", "First Aid", "CPR", "Anaphylaxis", "Asthma"]), reason: z.string().max(240) }),
      execute: async (i) => {
        const e = ed(i.educator_id);
        if (!e) return { error: "No educator with id " + i.educator_id + "." };
        const c = (e.credentials || []).find((x) => x.type === i.credential);
        if (!c) return { error: e.name + " has no " + i.credential + " entry in the snapshot." };
        if (c.status === "current") return { error: e.name + "'s " + i.credential + " is current; nothing to chase." };
        if (c.request_in_progress) return { error: "beehive is already chasing " + e.name + "'s " + i.credential + "." };
        return push({ kind: "chase_document", educator_id: e.id, educator: e.name, credential: i.credential, reason: i.reason });
      },
    }),
    draft_parent_message: tool({
      description: "Propose a message to a child's family, for the owner to approve before it's sent.",
      inputSchema: z.object({ child_id: z.string(), message: z.string().min(20).max(700), reason: z.string().max(240) }),
      execute: async (i) => {
        const k = kid(i.child_id);
        if (!k) return { error: "No child with id " + i.child_id + "." };
        if (!(k.open_items || []).length) return { error: k.name + " has nothing open with the family." };
        if (out.some((p) => p.kind === "draft_parent_message" && p.child_id === k.id)) return { error: "There's already a message for " + k.name + "'s family." };
        return push({ kind: "draft_parent_message", child_id: k.id, child: k.name, parent: k.parent, message: i.message.trim(), reason: i.reason });
      },
    }),
    flag_for_owner: tool({
      description: "Flag something only the owner can decide, with the action you recommend.",
      inputSchema: z.object({ title: z.string().max(90), detail: z.string().max(300), recommended_action: z.string().max(200), priority: z.enum(["high", "medium"]) }),
      execute: async (i) => push({ kind: "flag_for_owner", title: i.title, detail: i.detail, recommended_action: i.recommended_action, priority: i.priority, reason: i.detail }),
    }),
  };
}

async function runHive({ snapshot, model, timeLimitMs }) {
  const m = modelFor(model);
  const out = [];
  const timings = [];
  let last = Date.now();
  const result = await generateText({
    model: m.model, providerOptions: m.providerOptions, system: INSTRUCTIONS, tools: buildTools(snapshot || {}, out),
    prompt: "DAY SNAPSHOT:\n" + JSON.stringify(snapshot || {}).slice(0, 24000),
    stopWhen: stepCountIs(MAX_STEPS), maxRetries: 0, abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
    onStepFinish: () => { timings.push({ step: "Claude step " + (timings.length + 1), ms: Date.now() - last }); last = Date.now(); },
  });
  return { proposals: out, summary: (result.text || "").trim().slice(0, 300), model: m.modelId, timings };
}

// ---------- HTTP ----------
async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === "string" ? req.body : "";
  if (!raw) raw = await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); });
  try { return JSON.parse(raw || "{}"); } catch (e) { return {}; }
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  const body = await readJson(req);
  if (tooMany(req)) return send(res, 429, { error: "Too many AI requests from this device. Wait a few minutes and try again." });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 500, { error: "Claude isn't set up yet: add ANTHROPIC_API_KEY in Vercel's environment variables." });
  if (!body.snapshot || typeof body.snapshot !== "object") return send(res, 400, { error: "Send the day snapshot." });
  try {
    return send(res, 200, await runHive({ snapshot: body.snapshot }));
  } catch (e) {
    const { explainError } = require("./agent.js");
    return send(res, 502, explainError(e));
  }
};
module.exports.runHive = runHive;
module.exports.INSTRUCTIONS = INSTRUCTIONS;
