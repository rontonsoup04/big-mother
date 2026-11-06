// A light brake on the AI endpoints now that they don't need a passcode: each visitor (by IP address) gets
// a limited number of Claude calls in a 10-minute window. It's per server instance, so it slows abuse rather
// than stopping it; also set a monthly spend limit at console.anthropic.com → Settings → Limits.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS = Number(process.env.AI_CALLS_PER_10_MIN) || 30;
const seen = new Map();

function tooMany(req) {
  const ip = String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "local").split(",")[0].trim();
  const now = Date.now();
  const list = (seen.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_CALLS) { seen.set(ip, list); return true; }
  list.push(now);
  seen.set(ip, list);
  if (seen.size > 5000) seen.clear();
  return false;
}

module.exports = { tooMany };
