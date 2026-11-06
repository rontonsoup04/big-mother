// Beehive Compliance Agent: server-only Vercel function at /api/agent (see AGENT.md).
// Runs Gemini through the Vercel AI SDK with three tools: review credentials, save reminder
// drafts, flag for the owner. It has no tool that can send, approve or change records.
//
// Environment variables (Vercel → Settings → Environment Variables, and .env.local for local runs):
//   GOOGLE_GENERATIVE_AI_API_KEY  Gemini key from aistudio.google.com   (server only)
//   AGENT_MODEL                   optional, defaults to gemini-3.8-flash (Google retired gemini-2.5-flash for new keys)
//   AGENT_PASSCODE                shared team passcode; the agent only runs if it matches
//   BEEHIVE_AGENT_KEY             the centre's agent key (last row of seed_demo.sql)   (server only)
//   AGENT_TIME_LIMIT_MS           optional, default 110000; keep it under maxDuration in vercel.json

const { generateText, tool, stepCountIs } = require("ai");
const { z } = require("zod");
const crypto = require("crypto");
const INSTRUCTIONS = require("./_agent-instructions.js");

const SUPABASE_URL = process.env.BEEHIVE_SUPABASE_URL || "https://gaxkvceirdxqfpeeskwf.supabase.co";
const SUPABASE_KEY = process.env.BEEHIVE_SUPABASE_KEY || "sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8"; // public by design
const MAX_TOOL_CALLS = 5;
const CERTS = ["WWCC", "FIRST_AID", "CPR", "ANAPHYLAXIS", "ASTHMA"];

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
    throw new Error("Beehive database: " + msg);
  }
  return text ? JSON.parse(text) : null;
}

function buildTools(ctx) {
  const guard = (name) => {
    ctx.calls += 1;
    if (ctx.calls > MAX_TOOL_CALLS) throw new Error("Tool limit reached (" + MAX_TOOL_CALLS + " calls). Stop and summarise.");
    const entry = { tool: name };
    ctx.log.push(entry);
    return entry; // tools can run in parallel, so each writes its result to its own entry
  };
  return {
    review_credentials: tool({
      description: "Read the educators' required credentials (WWCC, FIRST_AID, CPR, ANAPHYLAXIS, ASTHMA) that are expired, missing or expiring within their reminder window, with days left, last reminder sent, whether a renewal was submitted and whether a draft or escalation is already waiting.",
      inputSchema: z.object({}),
      execute: async () => {
        const entry = guard("review_credentials");
        const r = focusReview(await rpc("agent_credential_review", {}, ctx.fetch));
        entry.result = r.needs_attention.length + " to act on";
        return r;
      },
    }),
    save_reminder_drafts: tool({
      description: "Save renewal reminders to educators as DRAFTS for Sara to approve. Nothing is sent. Use one call for all reminders.",
      inputSchema: z.object({
        drafts: z.array(z.object({
          staff: z.string().min(3).max(80).describe("Educator's full name exactly as review_credentials returned it"),
          certificate: z.enum(CERTS),
          kind: z.enum(["renewal", "missing", "follow_up"]),
          priority: z.enum(["high", "medium", "low"]),
          reason: z.string().min(3).max(300).describe("One line for Sara: why this reminder"),
          body: z.string().min(20).max(900).describe("2-4 sentence message to the educator, including the upload link"),
          follow_up_in_days: z.number().int().min(1).max(30),
        })).min(1).max(15),
      }),
      execute: async ({ drafts }) => {
        const entry = guard("save_reminder_drafts");
        // Server-side: every reminder carries the upload link, whatever the model wrote.
        const cleaned = drafts.map((d) => Object.assign({}, d, {
          body: d.body.includes(ctx.uploadLink) ? d.body.trim() : d.body.trim() + "\n\nUpload your new certificate here: " + ctx.uploadLink,
        }));
        const r = await rpc("agent_save_reminder_drafts", { p_drafts: cleaned }, ctx.fetch);
        ctx.saved += (r.saved || []).length;
        entry.result = (r.saved || []).length + " drafts saved, " + (r.skipped || []).length + " skipped";
        return r;
      },
    }),
    flag_for_owner: tool({
      description: "Escalate credentials that need Sara's own decision (expired, missing, renewal waiting for her review, follow-up with no response, educator has no Beehive login). Use one call for all escalations.",
      inputSchema: z.object({
        items: z.array(z.object({
          staff: z.string().min(3).max(80),
          certificate: z.enum(CERTS).optional(),
          reason: z.string().min(5).max(300),
        })).min(1).max(15),
      }),
      execute: async ({ items }) => {
        const entry = guard("flag_for_owner");
        const r = await rpc("agent_flag_for_owner", { p_items: items }, ctx.fetch);
        ctx.escalated += (r.escalated || []).length;
        entry.result = (r.escalated || []).length + " escalated" + ((r.skipped || []).length ? ", " + r.skipped.length + " already escalated" : "");
        return r;
      },
    }),
  };
}

// Gemini only sees what it can act on: the staff agent is already chasing renewals it has sent a request for,
// and the database would discard a second reminder anyway. Fewer, shorter rows keep the Gemini call quick.
const MAX_FOCUS = 8;
function focusReview(review) {
  const all = (review && review.needs_attention) || [];
  const act = [], waiting = [];
  let chasing = 0;
  for (const r of all) {
    if (r.draft_already_waiting || r.escalation_open) { waiting.push(r.staff + " (" + r.certificate + ")"); continue; }
    // The staff agent emails or texts educators and follows up on its own, so a beehive login isn't needed
    // and its follow-ups aren't Gemini's job.
    const urgent = r.status === "expired" || r.status === "missing" || r.renewal_submitted;
    if (r.last_reminder_sent && !urgent) { chasing++; continue; }
    act.push({ staff: r.staff, certificate: r.certificate, status: r.status, expiry_date: r.expiry_date, days_left: r.days_left,
      last_reminder_sent: r.last_reminder_sent, renewal_submitted: r.renewal_submitted });
  }
  return {
    today: review && review.today,
    educators_checked: review && review.educators_checked,
    needs_attention: act.slice(0, MAX_FOCUS),
    left_for_next_run: Math.max(0, act.length - MAX_FOCUS),
    already_chased_by_staff_agent: chasing,
    already_waiting_for_sara: waiting,
  };
}

// Runs one agent turn. `model` and `fetchImpl` can be swapped in tests.
// Vercel stops the function at maxDuration (vercel.json); stop a little earlier so the owner gets a clear message.
const TIME_LIMIT_MS = Number(process.env.AGENT_TIME_LIMIT_MS) || 110000;

async function runAgent({ message, uploadLink, model, fetchImpl, timeLimitMs }) {
  const ctx = { calls: 0, saved: 0, escalated: 0, log: [], fetch: fetchImpl, uploadLink, timings: [] };
  const modelId = process.env.AGENT_MODEL || "gemini-3.8-flash";
  if (!model) {
    const { google } = require("@ai-sdk/google");
    model = google(modelId);
  }
  // Gemini 3 models think before answering; "low" is the fastest level this model accepts ("minimal" is refused).
  const providerOptions = /gemini-3/.test(modelId) ? { google: { thinkingConfig: { thinkingLevel: process.env.AGENT_THINKING || "low" } } } : undefined;
  // Read the credentials first (a quick database call), so Gemini needs two calls instead of four:
  // one to save drafts and escalations together, one to write the summary.
  const t0 = Date.now();
  const review = focusReview(await rpc("agent_credential_review", {}, fetchImpl));
  ctx.log.push({ tool: "review_credentials", result: review.needs_attention.length + " to act on, " + review.already_chased_by_staff_agent + " already being chased by the staff agent" });
  ctx.timings = [{ step: "beehive credential review", ms: Date.now() - t0 }];
  let last = Date.now();
  try {
    const result = await generateText({
      model,
      system: INSTRUCTIONS.replace("{UPLOAD_LINK}", uploadLink),
      prompt: String(message || "Run the weekly credential check.").slice(0, 1000) + "\n\nCREDENTIAL REVIEW (from beehive just now):\n" + JSON.stringify(review),
      tools: buildTools(ctx),
      stopWhen: stepCountIs(MAX_TOOL_CALLS + 1),
      providerOptions,
      maxRetries: 0, // a rate limit shows straight away instead of a silent wait
      abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
      onStepFinish: () => { ctx.timings.push({ step: "Gemini step " + ctx.timings.length, ms: Date.now() - last }); last = Date.now(); },
    });
    return { reply: result.text || "(The agent finished without a summary.)", actions: ctx.log, drafts_saved: ctx.saved, escalated: ctx.escalated, timings: ctx.timings, seconds: Math.round((Date.now() - t0) / 1000) };
  } catch (e) {
    ctx.timings.push({ step: "Gemini step " + ctx.timings.length + " (unfinished)", ms: Date.now() - last });
    e.timings = ctx.timings; e.saved = ctx.saved;
    throw e;
  }
}

// Turn a failure into something the owner can act on, with where the time went.
function explainError(e) {
  const msg = String((e && e.message) || e);
  const where = e && e.timings && e.timings.length ? " Timing: " + e.timings.map((t) => t.step + " " + (t.ms / 1000).toFixed(1) + "s").join(", ") + "." : "";
  const saved = e && e.saved ? " " + e.saved + " draft" + (e.saved === 1 ? " was" : "s were") + " saved before it stopped." : "";
  const status = e && (e.statusCode || (e.lastError && e.lastError.statusCode));
  if (status === 429 || /quota|rate.?limit|resource.?exhausted|too many requests/i.test(msg))
    return { error: "Gemini’s usage limit was reached (free tier). Wait a minute and try again." + saved + where };
  if ((e && (e.name === "TimeoutError" || e.name === "AbortError")) || /aborted|timed? ?out/i.test(msg))
    return { error: "Gemini took too long, so the agent stopped." + saved + where + " Try again, or ask for something narrower, like “Only check WWCC”." };
  return { error: "The AI agent couldn't finish: " + msg.slice(0, 300) + saved + where };
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

module.exports = async function agent(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  const body = await readJson(req);
  if (!process.env.AGENT_PASSCODE) return send(res, 500, { error: "The agent isn't set up yet: add AGENT_PASSCODE in Vercel's environment variables." });
  if (!samePasscode(body.passcode, process.env.AGENT_PASSCODE)) return send(res, 401, { error: "Wrong passcode." });
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return send(res, 500, { error: "The agent isn't set up yet: add GOOGLE_GENERATIVE_AI_API_KEY in Vercel's environment variables." });
  if (!process.env.BEEHIVE_AGENT_KEY) return send(res, 500, { error: "The agent isn't set up yet: add BEEHIVE_AGENT_KEY (the centre's agent key) in Vercel's environment variables." });
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const uploadLink = process.env.BEEHIVE_UPLOAD_LINK || (host ? proto + "://" + host + "/#upload" : "the Beehive app");
  try {
    return send(res, 200, await runAgent({ message: body.message, uploadLink }));
  } catch (e) {
    return send(res, 502, explainError(e));
  }
};
module.exports.runAgent = runAgent;
module.exports.explainError = explainError;
module.exports.MAX_TOOL_CALLS = MAX_TOOL_CALLS;
module.exports.focusReview = focusReview;
