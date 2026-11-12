// The AI model behind every beehive agent: Claude, through the Vercel AI SDK's Anthropic provider.
//
// Environment variables (Vercel → Settings → Environment Variables, and .env.local for local runs):
//   ANTHROPIC_API_KEY   API key from console.anthropic.com (server only; a Claude.ai subscription doesn't include API access)
//   AGENT_MODEL         optional, defaults to claude-haiku-5-5 (fast and low cost); claude-sonnet-5-5 for harder work
const DEFAULT_MODEL = "claude-haiku-5-5";

function modelFor(model) {
  // An AGENT_MODEL left over from another provider (for example a Gemini model name) would break every call.
  const wanted = String(process.env.AGENT_MODEL || "").trim();
  const modelId = /^claude-/.test(wanted) ? wanted : DEFAULT_MODEL;
  if (!model) { const { anthropic } = require("@ai-sdk/anthropic"); model = anthropic(modelId); }
  return { model, modelId, providerOptions: undefined };
}

module.exports = { modelFor, DEFAULT_MODEL };
