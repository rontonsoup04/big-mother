// beehive AI assistant.
// - If config.copilotTokenEndpoint is set, "Ask beehive" opens the Copilot Studio agent
//   (Beehive Audit Assistant) inside the app, and "Draft with AI" asks the agent to write
//   parent messages over Direct Line.
// - Otherwise a built-in assistant answers from the centre's own records (no AI model),
//   so the demo still works. Every AI-drafted parent message needs staff approval.
const Assistant = (() => {
  const cfg = window.BEEHIVE_CONFIG || {};
  const connected = () => !!(cfg.copilotTokenEndpoint && cfg.copilotTokenEndpoint.trim());
  let open = false;
  let webchatLoaded = false;
  let chat = []; // built-in assistant history

  // ---------- floating button + panel ----------
  function refresh() {
    const fab = document.getElementById("assistantFab");
    if (!fab) return;
    const parent = typeof isFamily === "function" && isFamily();
    const educator = LIVE && ME && ME.role === "educator";
    fab.classList.toggle("hidden", parent || educator);
    if ((parent || educator) && open) toggle(false);
  }

  function toggle(force) {
    open = typeof force === "boolean" ? force : !open;
    const panel = document.getElementById("assistantPanel");
    panel.classList.toggle("hidden", !open);
    document.body.classList.toggle("assistantOpen", open);
    if (open) renderPanel();
  }

  function renderPanel() {
    const panel = document.getElementById("assistantPanel");
    const head =
      '<div class="assistantHead"><span class="assistantMark">✦</span><div><b>Ask beehive</b><small>' +
      (connected() ? "Audit assistant in Copilot Studio" : "Answers from your centre’s records") +
      '</small></div><button class="closeButton" aria-label="Close assistant" onclick="Assistant.toggle(false)">×</button></div>';
    if (connected()) {
      panel.innerHTML = head + '<div id="webchat" class="webchat" role="log"><div class="assistantLoading">Connecting to your agent…</div></div>';
      startWebChat().catch((e) => {
        document.getElementById("webchat").innerHTML =
          '<div class="assistantError"><b>Couldn’t connect to Copilot Studio.</b><p>' + esc(e.message || String(e)) +
          '</p><p>Check the token endpoint in config.js and that the agent is published with “No authentication”.</p></div>';
      });
      return;
    }
    const chips = ["What should I fix first?", "What compliance is overdue?", "What does the law say about sleep?", "Show the WWCC register", "Which certificates expire soon?", "Draft a message to a family"];
    panel.innerHTML =
      head +
      '<div class="assistantBody" id="assistantBody">' +
      (chat.length
        ? chat.map(bubble).join("")
        : bubble({ from: "bot", text: "Hi " + esc(firstName(OWNER_NAME)) + ", I can check your audit readiness, find records for a spot check, list expiring certificates and draft messages to families for you to approve." })) +
      '</div><div class="assistantChips">' +
      chips.map((c) => '<button class="chip" onclick="Assistant.ask(\'' + c.replace(/'/g, "\\'") + "')\">" + c + "</button>").join("") +
      '</div><form class="assistantInput" onsubmit="event.preventDefault();Assistant.ask(document.getElementById(\'assistantText\').value)">' +
      '<input id="assistantText" type="text" placeholder="Ask about readiness, staff or a record…" autocomplete="off" aria-label="Ask beehive"><button class="button primary small">Ask</button></form>' +
      '<p class="assistantFoot">' + (LIVE ? "" : "Offline demo data. ") + "To use your Copilot Studio agent, open your account menu and choose Connect AI agent.</p>";
    const body = document.getElementById("assistantBody");
    body.scrollTop = body.scrollHeight;
  }

  function bubble(m) {
    return '<div class="assistantMsg ' + m.from + '">' + m.text + "</div>";
  }

  // ---------- Copilot Studio web chat ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Couldn’t load the chat component."));
      document.head.appendChild(s);
    });
  }
  async function getToken() {
    const res = await fetch(cfg.copilotTokenEndpoint);
    if (!res.ok) throw new Error("Token endpoint returned " + res.status);
    return res.json(); // { token, conversationId? }
  }
  async function startWebChat() {
    if (!webchatLoaded) { await loadScript("https://cdn.botframework.com/botframework-webchat/latest/webchat.js"); webchatLoaded = true; }
    const { token } = await getToken();
    const el = document.getElementById("webchat");
    el.innerHTML = "";
    window.WebChat.renderWebChat({
      directLine: window.WebChat.createDirectLine({ token }),
      locale: "en-AU",
      styleOptions: {
        accent: "#d79e13", bubbleBackground: "#fffefa", bubbleBorderRadius: 14, bubbleFromUserBackground: "#fff2c9",
        bubbleFromUserBorderRadius: 14, primaryFont: "Inter, -apple-system, Segoe UI, sans-serif", rootHeight: "100%",
        hideUploadButton: true, sendBoxBackground: "#fffefa", suggestedActionBorderRadius: 999,
      },
    }, el);
  }

  // Ask the agent one question over Direct Line and return its first text reply.
  async function askAgent(text) {
    const { token, conversationId } = await getToken();
    const base = "https://directline.botframework.com/v3/directline/conversations";
    const auth = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
    let convId = conversationId;
    if (!convId) {
      const conv = await (await fetch(base, { method: "POST", headers: auth })).json();
      convId = conv.conversationId;
    }
    const sent = await (await fetch(`${base}/${convId}/activities`, {
      method: "POST", headers: auth, body: JSON.stringify({ type: "message", from: { id: "beehive-app", name: "beehive app" }, text, locale: "en-AU" }),
    })).json();
    let watermark = "";
    const started = Date.now();
    while (Date.now() - started < 30000) {
      await new Promise((r) => setTimeout(r, 1200));
      const page = await (await fetch(`${base}/${convId}/activities${watermark ? "?watermark=" + watermark : ""}`, { headers: auth })).json();
      watermark = page.watermark || watermark;
      const replies = (page.activities || []).filter((a) => a.type === "message" && a.from && a.from.id !== "beehive-app" && a.text && a.replyToId === sent.id);
      const any = replies.length ? replies : (page.activities || []).filter((a) => a.type === "message" && a.from && a.from.id !== "beehive-app" && a.text && new Date(a.timestamp) > new Date(started - 1000));
      if (any.length) return any[any.length - 1].text.trim();
    }
    throw new Error("The agent didn’t reply in time.");
  }

  // ---------- Draft with AI (owner reply box) ----------
  function templateDraft(child, parent, note) {
    const hi = parent ? "Hi " + firstName(parent) + "," : "Hi,";
    const clean = (note || "").trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
    if (!clean) return hi + " just a quick update about " + child + " today. Please let us know if you have any questions.";
    return hi + " a quick update about " + child + ": " + clean.charAt(0).toLowerCase() + clean.slice(1) + ". Please let us know if you have any questions.";
  }

  async function draftReply() {
    const input = document.getElementById("ownerReplyInput");
    const note = document.getElementById("draftNote");
    const childFull = ownerThread ? ownerThread.childName : familyMedical.childName;
    const child = firstName(childFull);
    const parent = (ownerThread && ownerThread.parentName) || (LIVE ? "" : PARENT_NAME);
    const staffNote = input.value.trim();
    note.textContent = "✦ Drafting…";
    let text, source;
    try {
      if (connected()) {
        text = await askAgent(
          "APP DRAFT: Write a short message from the centre to a parent. Child: " + child + ". Parent: " + (parent || "unknown") +
          ". Educator's note: \"" + (staffNote || "general positive update about the day") + "\". Use only facts in the note. Warm, plain Australian English, 2–4 sentences, first names only. Reply with the message text only."
        );
        source = "Copilot Studio";
      } else {
        text = templateDraft(child, parent, staffNote);
        source = "built-in template";
      }
    } catch (e) {
      text = templateDraft(child, parent, staffNote);
      source = "built-in template (agent unavailable: " + (e.message || e) + ")";
    }
    input.value = text;
    if (LIVE && ownerThread) {
      try { pendingDraftId = await Live.createDraft(ownerThread.childId, text, staffNote, "manual"); } catch (e) { pendingDraftId = null; }
    }
    note.textContent = "✦ AI draft (" + source + "). Edit it if needed, then Send. Nothing is sent until you do.";
  }

  // ---------- built-in assistant (no AI model) ----------
  function readinessScore() { return typeof readiness === "function" ? readiness() : 0; }
  function itemLine(x) {
    return "<li><b>" + esc(x.title) + "</b> <span class=\"status " + x.status + "\">" + statusLabel(x.status) + "</span><br><small>" + esc(x.risk || "") + " · " + esc(x.source) + "</small></li>";
  }
  // Match a question to a compliance library guide.
  const GUIDE_WORDS = {
    sleep: /sleep|\brest\b|bassinet|\bcots?\b/, sun: /\bsun|\buv\b|\bhats?\b|shade/, evacuation: /evacuat|drill|lockdown/,
    wwcc: /wwcc|working with children/, firstaid: /first aid|cpr|asthma|anaphylaxis training/, incidents: /incident|injur|trauma|illness/,
    medical: /medical|medication|allerg|action plan/, enrolment: /enrol|contact record|immunis/, authorisations: /collect|pick.?up|authoris|nominee|excursion|attendance/,
    premises: /premises|equipment|furniture|safety check|maintenance/, emergency: /display|floor plan|emergency contact/, training: /training|qualif|child protection|child safety/,
  };
  function findGuide(ql) {
    if (typeof Library === "undefined") return null;
    for (const [key, re] of Object.entries(GUIDE_WORDS)) if (re.test(ql)) return Library.guide(key);
    return null;
  }
  async function ask(question) {
    const qtext = String(question || "").trim();
    if (!qtext) return;
    chat.push({ from: "you", text: esc(qtext) });
    renderPanel();
    let answer = "";
    const ql = qtext.toLowerCase();
    try {
      const guide = /law|regulat|requir|comply|complian|guidance|official|what does|how do (i|we)|rule/.test(ql) ? findGuide(ql) : null;
      if (guide) {
        answer = "<b>" + esc(guide.title) + "</b> <small>(" + esc(guide.source_ref) + ")</small><br>" + esc(guide.summary) +
          "<ul>" + guide.directions.slice(0, 3).map((d) => "<li>" + esc(d) + "</li>").join("") + "</ul>" +
          "Official source: " + (guide.documents || []).slice(0, 2).map((d) => '<a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.title) + " ↗</a>").join(" · ") +
          '<br><button class="textButton" onclick="Assistant.toggle(false);Library.focus(\'' + guide.item_key + '\')">All steps in the compliance library</button>' +
          "<br><small>Guidance only, not legal advice. Confirm with ACECQA or the NSW Early Learning Commission.</small>";
      } else if (/overdue|compliance|due (this|soon|next)|policy review|drill/.test(ql) && typeof Library !== "undefined") {
        const ts = Library.taskList().filter((t) => t.state === "overdue" || t.state === "due_soon");
        answer = ts.length
          ? "These compliance tasks need attention:<ul>" + ts.map((t) => "<li><b>" + esc(t.title) + "</b> <span class=\"status " + (t.state === "overdue" ? "red" : "yellow") + "\">" +
              (t.state === "overdue" ? "Overdue by " + -t.days + " days" : t.days === 0 ? "Due today" : "Due in " + t.days + " days") + "</span><br><small>" + esc(t.regulation_reference || "") + "</small></li>").join("") +
            '</ul><button class="textButton" onclick="Assistant.toggle(false);go(\'compliance\')">Open the compliance register</button>'
          : "No compliance tasks are overdue or due in the next 14 days.";
      } else if (/fix|first|gap|priorit|ready|readiness|score/.test(ql)) {
        const gaps = items.filter((x) => x.status !== "green").sort((a, b) => (a.status === "red" ? 0 : 1) - (b.status === "red" ? 0 : 1));
        answer = approved
          ? "You’re <b>" + readinessScore() + "% audit-ready</b>. " + (gaps.length ? "Start with these:<ul>" + gaps.slice(0, 4).map(itemLine).join("") + "</ul>" : "Nothing needs attention right now.")
          : "Your checklist is still a draft. Review it in <b>Audit readiness</b> and approve it, then I can score your readiness.";
      } else if (/draft|message|write|tell .*(parent|family)/.test(ql)) {
        answer = "On the Overview, choose <b>Reply</b> next to a family message, type a short note (for example “ate all lunch, loved painting”) and choose <b>Draft with AI</b>. You review the draft before it’s sent.";
        if (LIVE && aiDrafts.length) answer += "<br><br>There " + (aiDrafts.length === 1 ? "is 1 AI draft" : "are " + aiDrafts.length + " AI drafts") + " waiting for your approval on the Overview page.";
      } else if (/expir|certif|first aid|cpr|anaphyl|renew/.test(ql) && !/wwcc|register/.test(ql)) {
        const due = [];
        educators.forEach((e) => e.certs.forEach((c) => { if (c.days <= 60) due.push({ e, c }); }));
        due.sort((a, b) => a.c.days - b.c.days);
        answer = due.length
          ? "These certificates are expired or due within 60 days:<ul>" + due.slice(0, 8).map((d) => "<li><b>" + esc(d.e.name) + "</b> · " + esc(d.c.type) + " · " + (d.c.days < 0 ? "<span class=\"status red\">Expired</span>" : d.c.days + " days left") + "</li>").join("") + "</ul>"
          : "No certificates are due in the next 60 days.";
      } else {
        // spot check
        let rows = [];
        if (LIVE) {
          rows = await Live.q(Live.client().rpc("spot_check_search", { p_query: qtext }));
        } else {
          const t = ql.replace(/show( me)?( the)?|register|records?/g, "").trim();
          educators.forEach((e) => e.certs.forEach((c) => { if ((t.includes("wwcc") && c.type === "WWCC") || e.name.toLowerCase().includes(t)) rows.push({ title: c.type, detail: e.name + " · expires " + c.expiry, status: certStatus(c) }); }));
          items.forEach((x) => { if ((x.title + " " + x.source).toLowerCase().includes(t)) rows.push({ title: x.title, detail: x.evidence, status: x.status }); });
        }
        answer = rows.length
          ? "Here’s what I found (" + rows.length + "):<ul>" + rows.slice(0, 10).map((r) => "<li><b>" + esc(r.title) + "</b><br><small>" + esc(r.detail || "") + " · " + esc(r.status) + "</small></li>").join("") + "</ul>"
          : "I couldn’t find matching records. Try “WWCC”, “incident records”, “first aid” or a staff member’s name.";
      }
    } catch (e) {
      answer = "Sorry, I couldn’t check that: " + esc(e.message || String(e));
    }
    chat.push({ from: "bot", text: answer });
    renderPanel();
  }

  // ---------- Connect AI agent (owner) ----------
  function openConnect() {
    const url = (cfg.supabaseUrl || "").replace(/\/$/, "");
    openModal(
      '<div class="modalHead"><div><h2>Connect your Copilot Studio agent</h2><p>Lets the agent read your readiness, search records and draft parent messages for you to approve.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection"><h3>1. Create an agent key</h3><p>The key lets the agent read this centre’s records. It’s shown once. Creating a new key stops the old one working.</p>' +
      '<div class="modalActions" style="justify-content:flex-start"><button class="button primary" onclick="Assistant.createKey()">Create agent key</button></div><div id="agentKeyOut"></div></div>' +
      '<div class="modalSection"><h3>2. Add the beehive tool in Copilot Studio</h3><p>In your agent, go to <b>Tools</b>, <b>Add a tool</b>, <b>REST API</b>, upload <code>docs/copilot-studio/beehive-agent-openapi.json</code> from the repo (paste your key where it says PASTE_AGENT_KEY_HERE). Authentication: <b>API key</b>, header <code>apikey</code>, value:</p><p><code class="copyable">' + esc(cfg.supabaseKey || "") + "</code></p><p>Server: <code>" + esc(url) + "</code></p></div>" +
      '<div class="modalSection"><h3>3. Show the agent inside beehive</h3><p>Publish the agent, then open <b>Channels</b>, <b>Mobile app</b> and copy the <b>Token endpoint</b> into <code>beehive-demo/config.js</code> as <code>copilotTokenEndpoint</code>. “Ask beehive” and “Draft with AI” will then use your agent.</p>' +
      '<p>Status: <b>' + (connected() ? "Connected to Copilot Studio" : "Not connected yet (using the built-in assistant)") + "</b></p></div>" +
      '<div class="modalActions"><button class="button" onclick="closeModal()">Done</button></div>'
    );
  }
  async function createKey() {
    const out = document.getElementById("agentKeyOut");
    out.innerHTML = '<p class="muted">Creating…</p>';
    try {
      const key = await Live.q(Live.client().rpc("create_agent_key"));
      out.innerHTML = '<div class="keyBox"><code id="agentKeyValue">' + esc(key) + '</code><button class="button small" onclick="Assistant.copyKey()">Copy</button></div><p class="helpLine">Copy it now. It won’t be shown again.</p>';
    } catch (e) {
      out.innerHTML = '<p class="authError">' + esc(e.message || String(e)) + "</p>";
    }
  }
  function copyKey() {
    const el = document.getElementById("agentKeyValue");
    if (!el) return;
    (navigator.clipboard ? navigator.clipboard.writeText(el.textContent) : Promise.reject()).then(
      () => toast("Agent key copied."),
      () => { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Key selected. Press Ctrl+C to copy."); }
    );
  }

  return { refresh, toggle, ask, draftReply, openConnect, createKey, copyKey, askAgent, connected };
})();
