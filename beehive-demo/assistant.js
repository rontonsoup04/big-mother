// beehive AI assistant.
// - Signed in with the team passcode, "Ask beehive" and "Draft with AI" use Gemini on the server (api/ask.js),
//   which reads the centre's records through read-only tools.
// - Otherwise (offline demo, no passcode, or Gemini unavailable) a built-in assistant answers from the same
//   records with fixed rules, so the demo still works. Every AI-drafted parent message needs staff approval.
const Assistant = (() => {
  const PASS_KEY = "beehive-agent-passcode"; // shared with the Compliance agent on the Compliance page
  const getPass = () => { try { return sessionStorage.getItem(PASS_KEY) || ""; } catch (e) { return ""; } };
  const setPass = (v) => { try { v ? sessionStorage.setItem(PASS_KEY, v) : sessionStorage.removeItem(PASS_KEY); } catch (e) {} };
  const geminiReady = () => typeof LIVE !== "undefined" && LIVE && !!getPass();
  let open = false;
  let busy = false;
  let chat = []; // { from: "you" | "bot", text: html, plain: text, source: "gemini" | "builtin" }

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
      (geminiReady() ? "Gemini, reading your centre’s records" : "Built-in answers from your centre’s records") +
      '</small></div><button class="closeButton" aria-label="Close assistant" onclick="Assistant.toggle(false)">×</button></div>';
    const chips = ["What is stopping us from being audit ready?", "What should I fix first?", "What is beehive waiting on?", "What compliance is overdue?", "What does the law say about sleep?", "Which certificates expire soon?"];
    panel.innerHTML =
      head +
      '<div class="assistantBody" id="assistantBody">' +
      (chat.length
        ? chat.map(bubble).join("")
        : bubble({ from: "bot", text: "Hi " + esc(firstName(OWNER_NAME)) + ", ask me about audit readiness, staff credentials, regulation updates or a record for a spot check." })) +
      (busy ? '<div class="assistantMsg bot"><span class="reading"><span class="hx"></span>' + (geminiReady() ? "Gemini is checking your records…" : "Checking…") + "</span></div>" : "") +
      '</div><div class="assistantChips">' +
      chips.map((c) => '<button class="chip" onclick="Assistant.ask(\'' + c.replace(/'/g, "\\'") + "')\">" + c + "</button>").join("") +
      '</div><form class="assistantInput" onsubmit="event.preventDefault();Assistant.ask(document.getElementById(\'assistantText\').value)">' +
      '<input id="assistantText" type="text" placeholder="Ask about readiness, staff or a record…" autocomplete="off" aria-label="Ask beehive"' + (busy ? " disabled" : "") + '><button class="button primary small"' + (busy ? " disabled" : "") + ">Ask</button></form>" +
      '<p class="assistantFoot">' + footNote() + "</p>";
    const body = document.getElementById("assistantBody");
    body.scrollTop = body.scrollHeight;
  }
  function footNote() {
    if (typeof LIVE === "undefined" || !LIVE) return "Offline demo: built-in answers. Sign in to use Gemini.";
    if (!getPass()) return 'Built-in answers. <button class="textButton" onclick="Assistant.openSettings()">Add the team passcode</button> to use Gemini.';
    return "Gemini reads beehive’s records but can’t change anything. Check important answers against the record.";
  }

  function bubble(m) {
    return '<div class="assistantMsg ' + m.from + '">' + m.text + (m.from === "bot" && m.source ? '<small class="srcNote">' + (m.source === "gemini" ? "Gemini" : "Built-in answer") + "</small>" : "") + "</div>";
  }

  // Gemini's plain text -> safe HTML (paragraphs and "- " bullet lists only)
  function formatAnswer(text) {
    const lines = String(text || "").split(/\n+/);
    let html = "", inList = false;
    lines.forEach((l) => {
      const t = l.trim();
      if (!t) return;
      const b = t.match(/^[-*•]\s+(.*)$/);
      const inline = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      if (b) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + inline(b[1]) + "</li>"; }
      else { if (inList) { html += "</ul>"; inList = false; } html += "<p>" + inline(t) + "</p>"; }
    });
    if (inList) html += "</ul>";
    return html;
  }
  async function callGemini(payload) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 130000) : null;
    try {
      const res = await fetch("api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ passcode: getPass() }, payload)), signal: ctl ? ctl.signal : undefined });
      let body = {};
      try { body = await res.json(); } catch (e) { body = { error: res.status === 404 ? "Gemini isn’t deployed on this site yet." : res.status === 504 ? "Gemini took too long." : "Unexpected response (" + res.status + ")." }; }
      if (res.status === 401) setPass("");
      if (!res.ok) throw new Error(body.error || "Gemini couldn’t answer (" + res.status + ").");
      return body;
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("Gemini didn’t answer within 2 minutes.");
      throw e;
    } finally { if (timer) clearTimeout(timer); }
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
      if (geminiReady()) {
        text = (await callGemini({ mode: "draft", child, parent, note: staffNote })).text;
        if (!text) throw new Error("empty draft");
        source = "Gemini";
      } else {
        text = templateDraft(child, parent, staffNote);
        source = "built-in template";
      }
    } catch (e) {
      text = templateDraft(child, parent, staffNote);
      source = "built-in template, because Gemini wasn’t available: " + (e.message || e);
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
  // links to the records behind a readiness answer, so the owner can go straight to resolving them
  function blockerLinks() {
    if (typeof AuditAgent === "undefined" || !AuditAgent.active() || !approved) return "";
    const b = AuditAgent.blockers().filter((y) => y.r.status !== "compliant").slice(0, 4);
    return b.length ? '<div class="askLinks">' + b.map(({ x }) => '<button class="chip" onclick="Assistant.toggle(false);openItem(\'' + x.id + '\')">' + esc(x.title) + "</button>").join("") +
      '<button class="chip" onclick="Assistant.toggle(false);AuditAgent.openBlockers()">The full answer</button></div>' : "";
  }
  async function ask(question) {
    const qtext = String(question || "").trim();
    if (!qtext || busy) return;
    const history = chat.filter((m) => m.plain).slice(-6).map((m) => ({ role: m.from === "you" ? "user" : "assistant", text: m.plain }));
    chat.push({ from: "you", text: esc(qtext), plain: qtext });
    if (geminiReady()) {
      busy = true; renderPanel();
      try {
        const r = await callGemini({ mode: "ask", question: qtext, history });
        const links = /stopping|blocking|audit.?ready|not ready|fix first|gap|priorit|readiness/i.test(qtext) ? blockerLinks() : "";
        chat.push({ from: "bot", text: formatAnswer(r.answer) + links, plain: r.answer, source: "gemini" });
        busy = false; renderPanel();
        return;
      } catch (e) {
        busy = false;
        chat.push({ from: "bot", text: '<small class="srcNote">Gemini wasn’t available (' + esc(e.message || String(e)) + "). Here’s the built-in answer instead.</small>", source: "" });
      }
    }
    const answer = await builtinAnswer(qtext);
    chat.push({ from: "bot", text: answer, source: "builtin" });
    renderPanel();
  }
  async function builtinAnswer(qtext) {
    let answer = "";
    const ql = qtext.toLowerCase();
    try {
      const guide = /law|regulat|requir|comply|complian|guidance|official|what does|how do (i|we)|rule/.test(ql) ? findGuide(ql) : null;
      const blockerQ = /stopping|blocking|holding .*back|audit.?ready|not ready|fix first|gap|priorit|readiness/.test(ql);
      const waitingQ = /waiting|outstanding|owe|chasing|follow.?up/.test(ql);
      if (waitingQ && typeof StaffAgent !== "undefined" && StaffAgent.active()) {
        const w = StaffAgent.waitingItems();
        answer = w.length
          ? "beehive is waiting on " + w.length + " response" + (w.length === 1 ? "" : "s") + " and follows up automatically:<ul>" +
            w.slice(0, 8).map((x) => "<li><b>" + esc(x.who || "Staff") + "</b> · " + esc(x.what) + (x.next ? "<br><small>Follow-up " + esc(x.next) + "</small>" : "") + "</li>").join("") + "</ul>"
          : "No one owes beehive a response right now.";
      } else if (blockerQ && typeof AuditAgent !== "undefined" && AuditAgent.active() && approved) {
        answer = AuditAgent.blockersAnswer();
      } else if (guide) {
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
    return answer;
  }

  // ---------- AI settings (owner) ----------
  function openSettings() {
    openModal(
      '<div class="modalHead"><div><h2>AI settings</h2><p>Ask beehive, Draft with AI and the Compliance agent use Gemini on the server. Your Gemini key never reaches the browser.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection"><h3>Team passcode</h3><p>Saved on this device until you close the browser. It’s the same passcode as the Compliance agent.</p>' +
      '<div class="assignLine"><input class="formControl" id="aiPass" type="password" placeholder="Team passcode" autocomplete="off" value="' + esc(getPass()) + '"><button class="button primary" onclick="Assistant.savePass()">Save</button></div>' +
      '<p class="helpLine">Status: <b>' + (geminiReady() ? "Gemini on" : typeof LIVE !== "undefined" && LIVE ? "built-in answers (no passcode yet)" : "offline demo, built-in answers") + "</b></p></div>" +
      '<div class="modalSection"><h3>Agent key for Vercel</h3><p>Gemini reads this centre’s records with an agent key. Put it in Vercel as <code>BEEHIVE_AGENT_KEY</code>, then redeploy. Creating a new key stops the old one working.</p>' +
      '<div class="modalActions" style="justify-content:flex-start"><button class="button" onclick="Assistant.createKey()">Create agent key</button></div><div id="agentKeyOut"></div></div>' +
      '<div class="modalSection"><h3>Vercel settings</h3><p><code>GOOGLE_GENERATIVE_AI_API_KEY</code> (from aistudio.google.com), <code>AGENT_PASSCODE</code>, <code>BEEHIVE_AGENT_KEY</code> and, optionally, <code>AGENT_MODEL</code> (default gemini-3.8-flash).</p></div>' +
      '<div class="modalActions"><button class="button" onclick="closeModal()">Done</button></div>'
    );
  }
  function savePass() {
    const v = ((document.getElementById("aiPass") || {}).value || "").trim();
    setPass(v);
    closeModal();
    toast(v ? "Passcode saved. Ask beehive will use Gemini." : "Passcode cleared. Ask beehive will use built-in answers.");
    if (open) renderPanel();
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

  return { refresh, toggle, ask, draftReply, openSettings, openConnect: openSettings, savePass, createKey, copyKey, geminiReady, callGemini };
})();
