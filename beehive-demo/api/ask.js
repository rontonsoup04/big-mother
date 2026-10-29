// "Ask beehive" and "Draft with AI": Gemini, server-side at /api/ask (Vercel function).
//
// ask:   answers the owner's question from beehive's own records through three read-only tools
//        (the Overview data, the compliance library, record search). It can't change anything.
// draft: writes a short message to a family from the educator's note. Staff always review it before
//        anything is sent; the message is saved as a draft by the app, never sent from here.
//
// Uses the same settings as the Compliance agent (api/agent.js): GOOGLE_GENERATIVE_AI_API_KEY, AGENT_MODEL,
// AGENT_PASSCODE, BEEHIVE_AGENT_KEY. Free AI tiers aren't private: use invented data only.

const { generateText, tool, stepCountIs } = require("ai");
const { z } = require("zod");
const crypto = require("crypto");
const { explainError } = require("./agent.js");

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

function modelFor(model) {
  const modelId = process.env.AGENT_MODEL || "gemini-3.8-flash";
  if (!model) { const { google } = require("@ai-sdk/google"); model = google(modelId); }
  const providerOptions = /gemini-3/.test(modelId) ? { google: { thinkingConfig: { thinkingLevel: process.env.AGENT_THINKING || "low" } } } : undefined;
  return { model, providerOptions };
}

// One question, with the last few turns for context. `model` and `fetchImpl` can be swapped in tests.
async function ask({ question, history, model, fetchImpl, timeLimitMs }) {
  const ctx = { used: [], fetch: fetchImpl };
  const m = modelFor(model);
  const messages = (Array.isArray(history) ? history : []).slice(-6)
    .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string" && h.text.trim())
    .map((h) => ({ role: h.role, content: h.text.slice(0, 1500) }));
  // The overview goes in up front (a quick database call), so most questions need a single Gemini call.
  const t0 = Date.now();
  const overview = await rpc("agent_overview", {}, fetchImpl);
  ctx.timings = [{ step: "beehive overview", ms: Date.now() - t0 }];
  messages.push({ role: "user", content: String(question || "").slice(0, 600) + "\n\nBEEHIVE OVERVIEW (current):\n" + JSON.stringify(overview) });
  let last = Date.now();
  try {
    const result = await generateText({
      model: m.model, providerOptions: m.providerOptions, system: ASK_INSTRUCTIONS, messages, tools: buildTools(ctx),
      stopWhen: stepCountIs(MAX_STEPS), maxRetries: 0, abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
      onStepFinish: () => { ctx.timings.push({ step: "Gemini step " + ctx.timings.length, ms: Date.now() - last }); last = Date.now(); },
    });
    return { answer: (result.text || "").trim() || "I couldn’t find an answer in beehive’s records.", tools: ctx.used, timings: ctx.timings };
  } catch (e) {
    ctx.timings.push({ step: "Gemini step " + ctx.timings.length + " (unfinished)", ms: Date.now() - last });
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

function samePasscode(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
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
  if (!process.env.AGENT_PASSCODE) return send(res, 500, { error: "Gemini isn't set up yet: add AGENT_PASSCODE in Vercel's environment variables." });
  if (!samePasscode(body.passcode, process.env.AGENT_PASSCODE)) return send(res, 401, { error: "Wrong passcode." });
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return send(res, 500, { error: "Gemini isn't set up yet: add GOOGLE_GENERATIVE_AI_API_KEY in Vercel's environment variables." });
  try {
    if (body.mode === "draft") return send(res, 200, await draft(body));
    if (!process.env.BEEHIVE_AGENT_KEY) return send(res, 500, { error: "Gemini can't read beehive yet: add BEEHIVE_AGENT_KEY (the centre's agent key) in Vercel's environment variables." });
    if (!String(body.question || "").trim()) return send(res, 400, { error: "Ask a question." });
    return send(res, 200, await ask(body));
  } catch (e) {
    const out = explainError(e);
    return send(res, 502, { error: out.error.replace("The AI agent couldn't finish", "Gemini couldn't answer").replace(" Try again, or ask for something narrower, like “Only check WWCC”.", " Try again, or ask something narrower.").replace(", so the agent stopped", "") });
  }
};
module.exports.ask = ask;
module.exports.draft = draft;
