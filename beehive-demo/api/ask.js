// "Ask beehive" and "Draft with AI": Claude, server-side at /api/ask (Vercel function).
//
// ask:   answers the owner's question from beehive's own records through three read-only tools
//        (the Overview data, the compliance library, record search). It can't change anything.
// draft: writes a short message to a family from the educator's note. Staff always review it before
//        anything is sent; the message is saved as a draft by the app, never sent from here.
//
// Uses the same settings as the Compliance agent (api/agent.js): ANTHROPIC_API_KEY, AGENT_MODEL,
// BEEHIVE_AGENT_KEY. Free AI tiers aren't private: use invented data only.

const { generateText, generateObject, tool, stepCountIs } = require("ai");
const { z } = require("zod");
const { explainError } = require("./agent.js");
const { modelFor } = require("./_model.js");
const { tooMany } = require("./_guard.js");

const SUPABASE_URL = process.env.BEEHIVE_SUPABASE_URL || "https://gaxkvceirdxqfpeeskwf.supabase.co";
const SUPABASE_KEY = process.env.BEEHIVE_SUPABASE_KEY || "sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8"; // public by design
const TIME_LIMIT_MS = Number(process.env.AGENT_TIME_LIMIT_MS) || 110000;
const MAX_STEPS = 4;

const ASK_INSTRUCTIONS = `You are "Ask beehive", the assistant inside beehive, a compliance app for an Australian long day care centre (NSW, Education and Care Services National Regulations). You answer the centre owner's questions.

How to answer:
- Use only facts from the BEEHIVE OVERVIEW in the message and from your tools. The overview is current: it covers readiness, gaps, staff credentials, renewals, regulation updates, compliance tasks and what needs the owner, so answer those questions straight from it without calling a tool. Use get_guidance for what the law or official guidance says. Use search_records to find specific records for a spot check.
- Never invent names, dates, numbers or regulations. If the records don't answer the question, say so and suggest where in beehive to look.
- Be brief and practical: a one-sentence answer first, then up to 5 short bullet points ("- " at the start of a line). Use the exact requirement titles and staff names from the data. For each gap say why it matters and the next action.
- "What is stopping us from being audit ready?" means: the requirements that aren't compliant, highest priority first, with why each matters and what to do next.
- beehive's agents already chase renewals and evidence and follow up automatically; email and SMS in this prototype are simulated (recorded, not delivered). Don't tell the owner to send reminders the agents are already sending.
- Guidance is not legal advice; for legal questions point to the official source.
- Plain Australian English, no headings, no tables, no emoji.`;

const DRAFT_INSTRUCTIONS = `You write short messages from an Australian childcare centre to a parent, for a staff member to review before sending.
- Use only the facts in the educator's note. Never add health, medical or incident details that aren't in the note.
- Warm, plain Australian English, 2 to 4 sentences, first names only, no emoji, no sign-off name.
- Reply with the message text only.`;

const BRIEF_INSTRUCTIONS = `You brief the owner of an Australian long day care centre (NSW, Education and Care Services National Law and Regulations) on a regulation or policy change they pasted in.
- Use only the pasted text and the centre's requirement list. Never invent regulation numbers, dates or obligations that aren't in the text.
- whatChanged: 1 to 2 plain sentences on what the change requires.
- affects: the exact titles from the requirement list that the change touches. Empty if none clearly match.
- actions: 1 to 4 short, concrete steps for this centre, starting with a verb. Say "check" or "review", not "you are non-compliant": a change only flags what may need updating.
- deadline: when it takes effect, quoted from the text, or "No start date in the text: check the official notice."
- Plain Australian English, no legal advice.`;

async function brief({ title, text, requirements, model, timeLimitMs }) {
  const m = modelFor(model);
  const reqs = (Array.isArray(requirements) ? requirements : []).slice(0, 40)
    .map((r) => "- " + String(r.title || "").slice(0, 120) + " (" + String(r.area || "").slice(0, 40) + ", " + String(r.status || "").slice(0, 20) + ")").join("\n");
  const { object } = await generateObject({
    model: m.model, providerOptions: m.providerOptions, system: BRIEF_INSTRUCTIONS,
    schema: z.object({
      title: z.string().max(100),
      whatChanged: z.string().max(500),
      affects: z.array(z.string().max(120)).max(12),
      actions: z.array(z.string().max(220)).min(1).max(4),
      deadline: z.string().max(160),
    }),
    prompt: "Title: " + String(title || "(none given)").slice(0, 120) + "\n\nPasted change:\n" + String(text || "").slice(0, 6000) + "\n\nCentre's requirements:\n" + reqs,
    maxRetries: 0, abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
  });
  const known = new Set((Array.isArray(requirements) ? requirements : []).map((r) => r.title));
  object.affects = object.affects.filter((t) => known.has(t)); // only titles that really are on the checklist
  return object;
}

const ROSTER_INSTRUCTIONS = `You explain a weekly roster that beehive's rules engine built for an Australian long day care centre (NSW) to the centre owner.
- Use only the roster data in the message. Never invent educators, numbers or rules.
- Cover: how each day meets ratios and the 50% diploma rule (Reg 126: at least half the educators needed for ratio hold a diploma or above, or are working towards one), first aid cover on every shift, and any issue the data lists that still needs the owner.
- 3 to 6 short bullet points ("- " at the start of each line), plain Australian English, no headings, no emoji.`;

async function explainRoster({ week, days, model, timeLimitMs }) {
  const m = modelFor(model);
  const result = await generateText({
    model: m.model, providerOptions: m.providerOptions, system: ROSTER_INSTRUCTIONS,
    prompt: "Week starting " + String(week || "").slice(0, 10) + ":\n" + JSON.stringify(Array.isArray(days) ? days.slice(0, 7) : []).slice(0, 12000),
    maxRetries: 0, abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
  });
  return { text: (result.text || "").trim() };
}

async function rpc(fn, body, fetchImpl) {
  const res = await (fetchImpl || fetch)(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(Object.assign({ p_key: process.env.BEEHIVE_AGENT_KEY }, body)),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch (e) {}
    throw new Error("beehive database: " + msg);
  }
  return text ? JSON.parse(text) : null;
}

function buildTools(ctx) {
  const used = (name) => ctx.used.push(name);
  return {
    get_overview: tool({
      description: "beehive's current state: audit readiness and how it's calculated, every requirement with status, priority, why and next action, staff credential renewals, open audit tasks, regulation updates and decisions, compliance tasks, and what is waiting for the owner.",
      inputSchema: z.object({}),
      execute: async () => { used("get_overview"); return rpc("agent_overview", {}, ctx.fetch); },
    }),
    get_guidance: tool({
      description: "Official guidance from beehive's compliance library: summary, steps to comply, evidence to show an officer and links to the official documents. Topic examples: sleep, sun, evacuation, wwcc, first aid, incidents, medical, enrolment, authorisations, premises, emergency, training.",
      inputSchema: z.object({ topic: z.string().min(2).max(60) }),
      execute: async ({ topic }) => { used("get_guidance"); return rpc("agent_guidance", { p_topic: topic }, ctx.fetch); },
    }),
    search_records: tool({
      description: "Search beehive's records (staff certificates, incident register, checklist items) for a spot check, for example 'WWCC', 'first aid' or a staff member's name.",
      inputSchema: z.object({ query: z.string().min(2).max(80) }),
      execute: async ({ query }) => {
        used("search_records");
        const rows = (await rpc("agent_search", { p_query: query }, ctx.fetch)) || [];
        return rows.filter((r) => r.kind !== "medical").slice(0, 15); // children's medical details stay in beehive
      },
    }),
  };
}


// One question, with the last few turns for context. `model` and `fetchImpl` can be swapped in tests.
async function ask({ question, history, model, fetchImpl, timeLimitMs }) {
  const ctx = { used: [], fetch: fetchImpl };
  const m = modelFor(model);
  const messages = (Array.isArray(history) ? history : []).slice(-6)
    .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string" && h.text.trim())
    .map((h) => ({ role: h.role, content: h.text.slice(0, 1500) }));
  // The overview goes in up front (a quick database call), so most questions need a single Claude call.
  const t0 = Date.now();
  const overview = await rpc("agent_overview", {}, fetchImpl);
  ctx.timings = [{ step: "beehive overview", ms: Date.now() - t0 }];
  messages.push({ role: "user", content: String(question || "").slice(0, 600) + "\n\nBEEHIVE OVERVIEW (current):\n" + JSON.stringify(overview) });
  let last = Date.now();
  try {
    const result = await generateText({
      model: m.model, providerOptions: m.providerOptions, system: ASK_INSTRUCTIONS, messages, tools: buildTools(ctx),
      stopWhen: stepCountIs(MAX_STEPS), maxRetries: 0, abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
      onStepFinish: () => { ctx.timings.push({ step: "Claude step " + ctx.timings.length, ms: Date.now() - last }); last = Date.now(); },
    });
    return { answer: (result.text || "").trim() || "I couldn’t find an answer in beehive’s records.", tools: ctx.used, timings: ctx.timings };
  } catch (e) {
    ctx.timings.push({ step: "Claude step " + ctx.timings.length + " (unfinished)", ms: Date.now() - last });
    e.timings = ctx.timings;
    throw e;
  }
}

async function draft({ child, parent, note, model, timeLimitMs }) {
  const m = modelFor(model);
  const prompt = "Child: " + String(child || "the child").slice(0, 40) + ". Parent: " + String(parent || "unknown").slice(0, 40) +
    ". Educator's note: \"" + (String(note || "").trim().slice(0, 500) || "general positive update about the day") + "\".";
  const result = await generateText({
    model: m.model, providerOptions: m.providerOptions, system: DRAFT_INSTRUCTIONS, prompt,
    maxRetries: 0, abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
  });
  return { text: (result.text || "").trim() };
}

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
  try {
    if (body.mode === "draft") return send(res, 200, await draft(body));
    if (body.mode === "roster") return send(res, 200, await explainRoster(body));
    if (body.mode === "brief") {
      if (String(body.text || "").trim().length < 40) return send(res, 400, { error: "Paste the text of the change first." });
      return send(res, 200, await brief(body));
    }
    if (!process.env.BEEHIVE_AGENT_KEY) return send(res, 500, { error: "Claude can't read beehive yet: add BEEHIVE_AGENT_KEY (the centre's agent key) in Vercel's environment variables." });
    if (!String(body.question || "").trim()) return send(res, 400, { error: "Ask a question." });
    return send(res, 200, await ask(body));
  } catch (e) {
    const out = explainError(e);
    return send(res, 502, { error: out.error.replace("The AI agent couldn't finish", "Claude couldn't answer").replace(" Try again, or ask for something narrower, like “Only check WWCC”.", " Try again, or ask something narrower.").replace(", so the agent stopped", "") });
  }
};
module.exports.ask = ask;
module.exports.draft = draft;
module.exports.brief = brief;
module.exports.explainRoster = explainRoster;
