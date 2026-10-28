// Beehive Compliance Agent: server-only Vercel function at /api/agent (see AGENT.md).
// Runs Gemini through the Vercel AI SDK with three tools: review credentials, save reminder
// drafts, flag for the owner. It has no tool that can send, approve or change records.
//
// Environment variables (Vercel → Settings → Environment Variables, and .env.local for local runs):
//   GOOGLE_GENERATIVE_AI_API_KEY  Gemini key from aistudio.google.com   (server only)
//   AGENT_MODEL                   optional, defaults to gemini-3.8-flash (Google retired gemini-2.5-flash for new keys)
//   AGENT_PASSCODE                shared team passcode; the agent only runs if it matches
//   BEEHIVE_AGENT_KEY             the centre's agent key (last row of seed_demo.sql)   (server only)
//   AGENT_TIME_LIMIT_MS           optional, default 50000; keep it under maxDuration in vercel.json

const { generateText, tool, stepCountIs } = require("ai");
const { z } = require("zod");
const crypto = require("crypto");
const INSTRUCTIONS = require("./_agent-instructions.js");

const SUPABASE_URL = process.env.BEEHIVE_SUPABASE_URL || "https://gaxkvceirdxqfpeeskwf.supabase.co";
const SUPABASE_KEY = process.env.BEEHIVE_SUPABASE_KEY || "sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8"; // public by design
const MAX_TOOL_CALLS = 5;
const CERTS = ["WWCC", "FIRST_AID", "CPR", "ANAPHYLAXIS"];

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
    ctx.log.push({ tool: name });
  };
  return {
    review_credentials: tool({
      description: "Read the educators' required credentials (WWCC, FIRST_AID, CPR, ANAPHYLAXIS) that are expired, missing or expiring within their reminder window, with days left, last reminder sent, whether a renewal was submitted and whether a draft or escalation is already waiting.",
      inputSchema: z.object({}),
      execute: async () => {
        guard("review_credentials");
        const r = await rpc("agent_credential_review", {}, ctx.fetch);
        ctx.log[ctx.log.length - 1].result = (r.needs_attention || []).length + " credentials need attention";
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
        guard("save_reminder_drafts");
        // Server-side: every reminder carries the upload link, whatever the model wrote.
        const cleaned = drafts.map((d) => Object.assign({}, d, {
          body: d.body.includes(ctx.uploadLink) ? d.body.trim() : d.body.trim() + "\n\nUpload your new certificate here: " + ctx.uploadLink,
        }));
        const r = await rpc("agent_save_reminder_drafts", { p_drafts: cleaned }, ctx.fetch);
        ctx.saved += (r.saved || []).length;
        ctx.log[ctx.log.length - 1].result = (r.saved || []).length + " drafts saved, " + (r.skipped || []).length + " skipped";
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
        guard("flag_for_owner");
        const r = await rpc("agent_flag_for_owner", { p_items: items }, ctx.fetch);
        ctx.escalated += (r.escalated || []).length;
        ctx.log[ctx.log.length - 1].result = (r.escalated || []).length + " escalated";
        return r;
      },
    }),
  };
}

// Runs one agent turn. `model` and `fetchImpl` can be swapped in tests.
// Vercel stops the function at maxDuration (vercel.json); stop a little earlier so the owner gets a clear message.
const TIME_LIMIT_MS = Number(process.env.AGENT_TIME_LIMIT_MS) || 50000;

async function runAgent({ message, uploadLink, model, fetchImpl, timeLimitMs }) {
  const ctx = { calls: 0, saved: 0, escalated: 0, log: [], fetch: fetchImpl, uploadLink };
  const modelId = process.env.AGENT_MODEL || "gemini-3.8-flash";
  if (!model) {
    const { google } = require("@ai-sdk/google");
    model = google(modelId);
  }
  // Gemini 3 models think before answering; "low" is plenty for this task and keeps each step fast.
  const providerOptions = /gemini-3/.test(modelId) ? { google: { thinkingConfig: { thinkingLevel: "low" } } } : undefined;
  const result = await generateText({
    model,
    system: INSTRUCTIONS.replace("{UPLOAD_LINK}", uploadLink),
    prompt: String(message || "Run the weekly credential check.").slice(0, 1000),
    tools: buildTools(ctx),
    stopWhen: stepCountIs(MAX_TOOL_CALLS + 1),
    providerOptions,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
  });
  return { reply: result.text || "(The agent finished without a summary.)", actions: ctx.log, drafts_saved: ctx.saved, escalated: ctx.escalated };
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
    const msg = String((e && e.message) || e);
    if ((e && (e.name === "TimeoutError" || e.name === "AbortError")) || /aborted|timed? ?out/i.test(msg))
      return send(res, 504, { error: "The AI agent took too long and was stopped. Any drafts it saved before stopping are on this page. Try again, or ask for something narrower, like “Only check WWCC”." });
    return send(res, 502, { error: "The AI agent couldn't finish: " + msg.slice(0, 400) });
  }
};
module.exports.runAgent = runAgent;
module.exports.MAX_TOOL_CALLS = MAX_TOOL_CALLS;
