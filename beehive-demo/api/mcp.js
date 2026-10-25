// Beehive MCP server for the Copilot Studio agent (Model Context Protocol, streamable HTTP).
// Deployed by Vercel at /api/mcp. Stateless: every request is answered with plain JSON.
//
// Copilot Studio → Tools → Add → Model Context Protocol
//   Server URL:      https://<your-vercel-site>/api/mcp
//   Authentication:  API key · Header · x-beehive-key   (the value is the centre's agent key)
//
// The agent key only unlocks the agent_* database functions for one centre. The Supabase
// publishable key below is public by design. Never put a secret / service_role key here.

const SUPABASE_URL = process.env.BEEHIVE_SUPABASE_URL || "https://gaxkvceirdxqfpeeskwf.supabase.co";
const SUPABASE_KEY = process.env.BEEHIVE_SUPABASE_KEY || "sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8";
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const str = (description, extra) => Object.assign({ type: "string", description }, extra || {});

const TOOLS = [
  {
    name: "get_audit_readiness", rpc: "agent_readiness",
    description: "Get the centre's audit readiness: score, every checklist item (status green/yellow/red, source regulation, what needs attention), pending reviews and new regulation updates. Most urgent first. Use for 'how ready are we', 'what should I fix first', 'explain this gap'.",
    properties: {}, required: [],
  },
  {
    name: "spot_check_search", rpc: "agent_search",
    description: "Find staff certificates, incident records, checklist items and approved medical profiles matching a query such as 'WWCC', 'incident records', 'first aid' or a person's name. Use when an authorised officer asks to see records.",
    properties: { p_query: str("What to search for, e.g. WWCC or incident records.") }, required: ["p_query"],
  },
  {
    name: "list_expiring_certificates", rpc: "agent_certificates",
    description: "List staff certificates that are expired or due within 60 days, with staff name, room, expiry date, days left and reminder status.",
    properties: {}, required: [],
  },
  {
    name: "list_compliance_tasks", rpc: "agent_compliance_tasks",
    description: "List every recurring compliance task (evacuation rehearsals, premises checks, fire equipment, policy reviews, Quality Improvement Plan, staff register, excursion risk assessments) with regulation, frequency, state (overdue, due_soon, on_track, done), due date and last completion. Use for 'what compliance is overdue'.",
    properties: {}, required: [],
  },
  {
    name: "get_official_guidance", rpc: "agent_guidance",
    description: "Get the official government documents (ACECQA, NSW Legislation, NSW Department of Education, NSW Early Learning Commission, Office of the Children's Guardian) behind a checklist item or topic, with a plain-English summary, steps to comply, evidence to show an officer and record retention. Use for 'what does the law say about ...'. Empty topic lists everything.",
    properties: { p_topic: str("Topic or checklist item, e.g. sleep, WWCC, incidents, evacuation, Reg 97. Empty for everything.") }, required: ["p_topic"],
  },
  {
    name: "list_children", rpc: "agent_children",
    description: "List the names and rooms of enrolled children (no medical information). Use to check a child's exact name before drafting a message.",
    properties: {}, required: [],
  },
  {
    name: "draft_parent_message", rpc: "agent_draft_parent_message",
    description: "Save a message to a child's parents as a DRAFT. It is NOT sent: a staff member reviews and approves it in Beehive first. Only include facts the user gave you.",
    properties: {
      p_child_name: str("Child's first name or full name."),
      p_body: str("The message: 2-4 warm sentences in plain Australian English."),
      p_trigger: str("Type of message.", { enum: ["manual", "daily_summary", "incident", "medical", "document_request"] }),
      p_staff_note: str("The staff member's original note or request."),
    },
    required: ["p_child_name", "p_body"],
  },
  {
    name: "add_regulation_update", rpc: "agent_add_regulation_update",
    description: "Record a new regulation or ACECQA guidance change for the owner to review and accept in Beehive. Match terms are words in affected checklist item titles, e.g. sleep, sun, evacuation.",
    properties: {
      p_title: str("Short title of the change."),
      p_summary: str("Plain-English summary of what changed."),
      p_match_terms: { type: "array", items: { type: "string" }, description: "Words that identify affected checklist items." },
      p_source_url: str("Link to the official source."),
    },
    required: ["p_title", "p_summary", "p_match_terms"],
  },
];

function agentKey(req) {
  const h = req.headers || {};
  const auth = String(h.authorization || "");
  const fromQuery = (() => { try { return new URL(req.url, "http://x").searchParams.get("key"); } catch (e) { return null; } })();
  return (h["x-beehive-key"] || h["x-api-key"] || (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "") || fromQuery || process.env.BEEHIVE_AGENT_KEY || "").trim();
}

async function callTool(name, args, key) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { content: [{ type: "text", text: "Unknown tool: " + name }], isError: true };
  if (!key) return { content: [{ type: "text", text: "Missing Beehive agent key. Add it as the x-beehive-key header in the MCP connection." }], isError: true };
  const body = { p_key: key };
  for (const p of Object.keys(tool.properties)) if (args && args[p] !== undefined && args[p] !== null) body[p] = args[p];
  if (tool.name === "get_official_guidance" && body.p_topic === undefined) body.p_topic = "";
  const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + tool.rpc, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch (e) {}
    return { content: [{ type: "text", text: "Beehive error: " + msg }], isError: true };
  }
  return { content: [{ type: "text", text: text || "null" }] };
}

async function handle(msg, key) {
  const { id, method, params } = msg || {};
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return fail(-32600, "Invalid request");
  if (id === undefined || id === null) return null; // notification (e.g. notifications/initialized)
  switch (method) {
    case "initialize": {
      const asked = params && params.protocolVersion;
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "beehive", title: "Beehive", version: "1.0.0" },
        instructions: "Beehive childcare compliance tools for one centre. Read readiness, records, certificates, compliance tasks and official guidance; save parent-message drafts that staff must approve.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: TOOLS.map((t) => ({
          name: t.name, description: t.description,
          inputSchema: { type: "object", properties: t.properties, required: t.required },
          annotations: { readOnlyHint: !/draft|add_/.test(t.name) },
        })),
      });
    case "tools/call":
      try { return reply(await callTool(params && params.name, (params && params.arguments) || {}, key)); }
      catch (e) { return reply({ content: [{ type: "text", text: "Beehive error: " + (e.message || String(e)) }], isError: true }); }
    default:
      return fail(-32601, "Method not found: " + method);
  }
}

module.exports = async function mcp(req, res) {
  if (req.method === "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Beehive MCP server. Use POST (streamable HTTP).");
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let payload = req.body;
  if (payload === undefined || typeof payload === "string" || Buffer.isBuffer(payload)) {
    let raw = typeof payload === "string" ? payload : Buffer.isBuffer(payload) ? payload.toString("utf8") : "";
    if (!raw) raw = await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); });
    try { payload = JSON.parse(raw); } catch (e) { payload = null; }
  }
  const key = agentKey(req);
  const out = Array.isArray(payload)
    ? (await Promise.all(payload.map((m) => handle(m, key)))).filter(Boolean)
    : await handle(payload, key);
  if (!out || (Array.isArray(out) && !out.length)) { res.statusCode = 202; return res.end(); }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(out));
};
module.exports.TOOLS = TOOLS;
