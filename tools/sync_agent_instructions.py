"""Copy the "Agent instructions" section of AGENT.md, word for word, into the server-only
file the agent uses as its system prompt. Run after every change to AGENT.md:

    python3 tools/sync_agent_instructions.py
"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
text = open(os.path.join(ROOT, "AGENT.md"), encoding="utf-8").read()
m = re.search(r"^## Agent instructions\n(.*?)\n## ", text, re.S | re.M)
if not m:
    raise SystemExit("AGENT.md has no '## Agent instructions' section")
instructions = m.group(1).strip()
out = os.path.join(ROOT, "beehive-demo/api/_agent-instructions.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("// Generated from AGENT.md (\"Agent instructions\") by tools/sync_agent_instructions.py. Do not edit here.\n")
    f.write("// Server-only: files starting with _ in /api are not exposed by Vercel.\n")
    f.write("module.exports = " + json.dumps(instructions, ensure_ascii=False) + ";\n")
print("wrote", out, len(instructions), "chars")
