// beehive renewal emails: server-only Vercel function at /api/email.
//
// Sends one staff agent reminder (renewal request or follow-up) as a real email, with the educator's secure
// upload link. It only runs when the owner presses "Send reminder now"; the agent's automatic reminders stay
// recorded-only, so a check never emails a whole staff list at once.
//
//   Live (signed in):  { messageId } + the owner's Supabase session token. The message is read back from the
//                      database with that token, so row-level security limits it to the owner's own centre, and
//                      the recipient is the educator's email on file. Nothing in the request chooses who gets it.
//   Sample data:       { demo: true, subject, body, token, staffName }. There is no real educator to email, so it
//                      only ever goes to DEMO_EMAIL_TO, and only when that is set.
//
// Environment variables:
//   RESEND_API_KEY   required: from resend.com → API Keys (never commit it)
//   EMAIL_FROM       optional: e.g. "beehive <reminders@yourdomain.com>" once a domain is verified in Resend.
//                    Default "beehive <onboarding@resend.dev>", which Resend only delivers to your own address.
//   DEMO_EMAIL_TO    optional: sends every email (live and sample) to this inbox instead. Use it for demos.
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY  optional: default to the values in config.js.

const { tooMany } = require("./_guard.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://gaxkvceirdxqfpeeskwf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8";
const FROM = process.env.EMAIL_FROM || "beehive <onboarding@resend.dev>";
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);

function siteOrigin(req) {
  const h = String((req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(h)) return "";
  return (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(h) ? "http://" : "https://") + h;
}
function linkFor(req, token) {
  const t = String(token || "").replace(/^\/?#?\/?upload\//, "");
  return /^[\w-]{4,100}$/.test(t) ? siteOrigin(req) + "/#upload/" + t : "";
}

function html(subject, body, link) {
  return (
    '<!doctype html><html><body style="margin:0;background:#FFF1BF;font-family:Arial,Helvetica,sans-serif;color:#1A1200">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF1BF;padding:28px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFBEE;border:3px solid #1A1200;border-radius:18px">' +
    '<tr><td style="padding:22px 28px 6px;font-size:22px;font-weight:800">beehive</td></tr>' +
    '<tr><td style="padding:6px 28px 0;font-size:19px;font-weight:700">' + esc(subject) + "</td></tr>" +
    '<tr><td style="padding:12px 28px 4px;font-size:15px;line-height:1.55">' + esc(body) + "</td></tr>" +
    (link ? '<tr><td style="padding:16px 28px 8px"><a href="' + esc(link) + '" style="display:inline-block;background:#F98B4B;color:#1A1200;font-weight:700;text-decoration:none;padding:12px 22px;border:3px solid #1A1200;border-radius:999px">Upload your certificate</a></td></tr>' +
      '<tr><td style="padding:4px 28px 0;font-size:12px;color:#5A4500">No app or password needed. The link is just for you, so please don’t forward it.</td></tr>' : "") +
    '<tr><td style="padding:18px 28px 22px;font-size:12px;color:#5A4500">Sent by beehive on behalf of your centre.</td></tr>' +
    "</table></td></tr></table></body></html>"
  );
}

async function fromDatabase(id, token) {
  const url = SUPABASE_URL + "/rest/v1/agent_messages?select=id,channel,recipient,subject,body,upload_link&id=eq." + encodeURIComponent(id);
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token, Accept: "application/json" } });
  if (!r.ok) throw Object.assign(new Error("Couldn’t read that reminder. Sign in again and retry."), { status: 401 });
  const rows = await r.json();
  return rows && rows[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST." }); }
  if (!process.env.RESEND_API_KEY) return res.status(501).json({ error: "Email isn’t set up yet: add RESEND_API_KEY in Vercel → Settings → Environment Variables.", code: "not_configured" });
  if (tooMany(req)) return res.status(429).json({ error: "Too many emails in a short time. Wait a few minutes and try again." });
  const b = (typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : req.body) || {};
  const demoTo = String(process.env.DEMO_EMAIL_TO || "").trim();

  let to, subject, body, link, demo = !!b.demo;
  try {
    if (demo) {
      if (!EMAIL_RE.test(demoTo)) return res.status(400).json({ error: "Sample data has no real educators to email. Set DEMO_EMAIL_TO in Vercel to send demo emails to your inbox.", code: "no_demo_inbox" });
      to = demoTo; subject = clip(b.subject, 120); body = clip(b.body, 1200); link = linkFor(req, b.token);
      if (!subject || !body) return res.status(400).json({ error: "Missing the reminder text." });
    } else {
      const auth = String((req.headers && req.headers.authorization) || "").replace(/^Bearer\s+/i, "");
      if (!auth || !/^[\w-]{8,64}$/.test(String(b.messageId || ""))) return res.status(400).json({ error: "Sign in to send emails." });
      const m = await fromDatabase(b.messageId, auth);
      if (!m) return res.status(404).json({ error: "That reminder wasn’t found in your centre." });
      if (m.channel !== "email" || !EMAIL_RE.test(m.recipient || "")) return res.status(400).json({ error: "This educator has no email address on file.", code: "no_email" });
      to = EMAIL_RE.test(demoTo) ? demoTo : m.recipient; subject = clip(m.subject, 120); body = clip(m.body, 1200); link = linkFor(req, m.upload_link);
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html: html(subject, body, link), text: body + (link ? "\n\nUpload your certificate: " + link : "") }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (out && (out.message || out.error)) || "status " + r.status;
      const hint = /only send testing emails to your own email|verify a domain/i.test(msg) ? " Without a verified domain, Resend only delivers to the address you signed up with: set DEMO_EMAIL_TO to that address." : "";
      return res.status(502).json({ error: "The email service refused it: " + msg + "." + hint });
    }
    return res.status(200).json({ ok: true, id: out.id, demoInbox: EMAIL_RE.test(demoTo) });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || "Couldn’t send the email." });
  }
};
