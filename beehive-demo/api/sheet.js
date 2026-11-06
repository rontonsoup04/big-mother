// beehive daily sheet writer: server-only Vercel function at /api/sheet.
//
// The app sends the day: each room with the children booked in (age, allergies, medical needs, medication,
// diet) and the educators on shift. Claude writes the parts that need judgement: the day's meals with a safe
// alternative for every child whose allergy or diet rules a dish out, an activity plan for each room suited to
// the children's ages, and the reminders staff need. The children and educators themselves come straight from
// beehive's records, never from the model. With mode "revise", Claude changes an existing sheet as the owner asks.
//
// Environment variables: ANTHROPIC_API_KEY, optional AGENT_MODEL (see api/_model.js).

const { generateObject } = require("ai");
const { z } = require("zod");
const { modelFor } = require("./_model.js");
const { tooMany } = require("./_guard.js");

const TIME_LIMIT_MS = Number(process.env.AGENT_TIME_LIMIT_MS) || 110000;

const RULES = `You write the daily sheet for an Australian long day care centre in NSW. Staff print it and follow it all day, so it must be safe and practical.
- Use only the children, rooms and educators in the DAY data. Refer to children by first name and their child_id. Never invent a child, an allergy or a medication.
- Meals: morning tea, lunch and afternoon tea, ONE menu for the whole centre per meal, at most 15 words (for example "Chicken and vegetable risotto, cucumber sticks, water"). Healthy and suited to young children (Australian Dietary Guidelines, NSW Munch & Move). Avoid whole nuts, popcorn and other choking risks.
- Alternatives: for EVERY child whose allergy, condition (for example coeliac disease) or diet rules out an ingredient in that meal, add one alternative for that child on that meal. "swap" says only what to serve instead, at most 10 words (for example "Egg-free pikelets" or "Soy yoghurt instead of dairy"). Don't repeat the child's name, don't explain, don't think aloud. Never serve a child their allergen.
- Activities: two or three per room across the day (morning, after rest, late afternoon), suited to the room's ages, with a short learning focus linked to the Early Years Learning Framework (EYLF V2.0) outcomes. Include outdoor play and a rest time.
- Reminders: at most 6, each at most 20 words: practical notes staff must not miss (medication kept in the room kit, action plans, sun safety, a child leaving early). Only from the data or the owner's request.
- Child notes: only when there is something specific for that child today.
- Headline: at most 12 words.
- Plain Australian English, short phrases. No emoji. Never include your reasoning in any field.`;

// Loose on purpose: lengths are trimmed in clean() rather than rejected, so one long line can't sink the sheet.
const Sheet = z.object({
  headline: z.string().describe("One line about the day."),
  meals: z.array(z.object({
    meal: z.string().describe("Morning tea, Lunch or Afternoon tea"),
    time: z.string(),
    menu: z.string(),
    alternatives: z.array(z.object({ child_id: z.string(), swap: z.string() })),
  })).describe("Exactly three: Morning tea, Lunch, Afternoon tea"),
  activities: z.array(z.object({ room: z.string(), time: z.string(), title: z.string(), description: z.string(), learning_focus: z.string() })),
  reminders: z.array(z.string()),
  child_notes: z.array(z.object({ child_id: z.string(), note: z.string() })),
});

// Keep only what matches the day's records, and make sure every child with a dietary need is covered.
function clean(sheet, day) {
  const cut = (t, n) => { t = String(t || "").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };
  sheet.headline = cut(sheet.headline, 140);
  sheet.meals = (sheet.meals || []).slice(0, 4).map((m) => ({ meal: cut(m.meal, 30), time: cut(m.time, 20), menu: cut(m.menu, 220), alternatives: (m.alternatives || []).slice(0, 40).map((a) => ({ child_id: a.child_id, swap: cut(a.swap, 140) })) }));
  sheet.activities = (sheet.activities || []).slice(0, 15).map((a) => ({ room: a.room, time: cut(a.time, 30), title: cut(a.title, 80), description: cut(a.description, 240), learning_focus: cut(a.learning_focus, 160) }));
  sheet.reminders = (sheet.reminders || []).slice(0, 10).map((r) => cut(r, 220));
  sheet.child_notes = (sheet.child_notes || []).slice(0, 30).map((n) => ({ child_id: n.child_id, note: cut(n.note, 180) }));
  const kids = new Map();
  (day.rooms || []).forEach((r) => (r.children || []).forEach((k) => kids.set(k.id, k)));
  const rooms = new Set((day.rooms || []).map((r) => r.room));
  sheet.meals.forEach((m) => { m.alternatives = m.alternatives.filter((a) => kids.has(a.child_id)); });
  sheet.activities = sheet.activities.filter((a) => rooms.has(a.room));
  sheet.child_notes = sheet.child_notes.filter((n) => kids.has(n.child_id));
  // a child with an allergy or special diet must appear on every meal: if the model missed one, flag it for staff
  const needs = [...kids.values()].filter((k) => k.allergies || k.dietary || /coeliac/i.test(k.conditions || ""));
  sheet.meals.forEach((m) => needs.forEach((k) => {
    if (!m.alternatives.some((a) => a.child_id === k.id))
      m.alternatives.push({ child_id: k.id, swap: "Check against " + [k.allergies && "allergy: " + k.allergies, k.dietary, /coeliac/i.test(k.conditions || "") && !/gluten/i.test(k.dietary || "") && "gluten-free"].filter(Boolean).join("; ") + " before serving", checked: false });
  }));
  return sheet;
}

async function writeSheet({ day, model, timeLimitMs }) {
  const m = modelFor(model);
  const { object } = await generateObject({
    model: m.model, providerOptions: m.providerOptions, system: RULES, schema: Sheet,
    prompt: "DAY:\n" + JSON.stringify(day).slice(0, 20000),
    maxRetries: 0, abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
  });
  return { sheet: clean(object, day), model: m.modelId };
}

async function reviseSheet({ day, sheet, instruction, model, timeLimitMs }) {
  const m = modelFor(model);
  const { object } = await generateObject({
    model: m.model, providerOptions: m.providerOptions, system: RULES + "\n- You are revising an existing sheet. Change only what the owner asks, keep everything else as it is, and keep every safety rule above even if asked otherwise.",
    schema: Sheet,
    prompt: "DAY:\n" + JSON.stringify(day).slice(0, 16000) + "\n\nCURRENT SHEET:\n" + JSON.stringify(sheet).slice(0, 12000) + "\n\nOWNER'S CHANGE:\n" + String(instruction || "").slice(0, 600),
    maxRetries: 0, abortSignal: AbortSignal.timeout(timeLimitMs || TIME_LIMIT_MS),
  });
  return { sheet: clean(object, day), model: m.modelId };
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
  if (tooMany(req)) return send(res, 429, { error: "Too many AI requests from this device. Wait a few minutes and try again." });
  const body = await readJson(req);
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 500, { error: "Claude isn't set up yet: add ANTHROPIC_API_KEY in Vercel's environment variables." });
  if (!body.day || !Array.isArray(body.day.rooms)) return send(res, 400, { error: "Send the day's rooms." });
  try {
    if (body.mode === "revise") {
      if (!String(body.instruction || "").trim()) return send(res, 400, { error: "Say what to change." });
      return send(res, 200, await reviseSheet(body));
    }
    return send(res, 200, await writeSheet(body));
  } catch (e) {
    const { explainError } = require("./agent.js");
    return send(res, 502, explainError(e));
  }
};
module.exports.writeSheet = writeSheet;
module.exports.reviseSheet = reviseSheet;
module.exports.clean = clean;
