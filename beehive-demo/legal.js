// beehive Legal section: the policy-change briefing agent.
//
// The agent reads each regulation or policy change and tells the owner, in plain English:
// what changed, which of the centre's requirements it touches (and how they stand today), what to do
// and by when. The owner can also paste the text of a new change (an ACECQA or NSW Early Learning
// Commission notice, say) and the agent summarises it.
//
// Signed in with the team passcode, the summary comes from Gemini (api/ask.js, mode "brief"). Otherwise a
// built-in reader matches the text to the checklist with fixed rules, so the offline demo still works.
// The agent never changes a policy or a requirement's status: it explains, the owner decides.
const Legal = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const SAFETY_AREA = "Safety & Premises";
  // Which checklist requirement a change is about (requirement id -> words that point to it).
  const TOPICS = {
    wwcc: /working with children|\bwwcc\b|children'?s guardian|worker register/,
    firstaid: /first aid|\bcpr\b|resuscitation|asthma|anaphyla|hltaid/,
    training: /qualification|child protection training|child safety training|diploma|early childhood teacher|\bect\b/,
    enrolment: /enrol/,
    incidents: /incident|injur|trauma|serious (incident|harm)/,
    medical: /medic|allerg|medication|health plan/,
    authorisations: /authoris|collection of children|delivery and collection|excursion|transport/,
    evacuation: /evacuat|emergency drill|lockdown/,
    premises: /premises|fenc|playground|building|equipment|hazard|digital device|cctv|toilet|nappy change/,
    emergency: /emergency contact|emergency and evacuation|emergency procedure/,
    sun: /sun |sun protection|\buv\b|sunscreen/,
    sleep: /sleep|rest|cot|safe sleep/,
  };
  const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";

  let briefs = []; // summaries of changes the owner pasted in this session: { id, title, source, gemini, ... }
  let busy = false;

  const reqItems = () => (typeof items !== "undefined" ? items.filter((x) => !x.omitted) : []);
  const reqStatus = (x) => {
    const r = x.req && x.req.status;
    if (r) return r === "compliant" ? ["green", "On track"] : r === "under_review" ? ["yellow", "Under review"] : ["red", "Gap"];
    return x.status === "green" ? ["green", "On track"] : x.status === "yellow" ? ["yellow", "Review due"] : ["red", "Gap"];
  };

  // ---------- the built-in reader (offline demo, or Gemini not connected) ----------
  function affected(text) {
    const t = " " + String(text || "").toLowerCase() + " ";
    return reqItems().filter((x) => TOPICS[x.id] && TOPICS[x.id].test(t));
  }
  function firstSentences(text, n) {
    const s = String(text || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+/g) || [String(text || "").trim()];
    return s.slice(0, n).join(" ").trim();
  }
  function findDate(text) {
    const m = String(text || "").match(new RegExp("(?:from|by|before|on|commenc\\w*|effective|takes effect)\\s+(?:on\\s+)?(\\d{1,2}\\s+(?:" + MONTHS + ")\\s+\\d{4})", "i"));
    return m ? m[1] : "";
  }
  function builtinBrief(title, text) {
    const hit = affected(title + " " + text);
    const when = findDate(text);
    return {
      title: title || firstSentences(text, 1).slice(0, 80),
      whatChanged: firstSentences(text, 2),
      affects: hit.map((x) => x.title),
      actions: hit.length
        ? hit.map((x) => "Check your " + x.title.charAt(0).toLowerCase() + x.title.slice(1) + " against the change and record whether anything needs updating.")
        : ["Read the change and confirm whether it applies to your centre. beehive couldn’t match it to a requirement."],
      deadline: when ? "Comes into effect " + when : "No start date found in the text: check the official notice.",
      source: "builtin",
    };
  }

  // ---------- summarise a pasted change ----------
  async function summarise() {
    if (busy) return;
    const title = ((document.getElementById("briefTitle") || {}).value || "").trim();
    const text = ((document.getElementById("briefText") || {}).value || "").trim();
    if (text.length < 40) return toast("Paste the text of the change first (a sentence or two at least).");
    busy = true; render();
    let b;
    try {
      if (typeof Assistant !== "undefined" && Assistant.geminiReady()) {
        const reqs = reqItems().map((x) => ({ title: x.title, area: x.area, status: reqStatus(x)[1] }));
        const g = await Assistant.callGemini({ mode: "brief", title, text, requirements: reqs });
        b = Object.assign({ source: "gemini" }, g);
      } else b = builtinBrief(title, text);
    } catch (e) {
      b = builtinBrief(title, text);
      b.note = (e && e.message ? e.message : "Gemini couldn’t answer") + " This summary uses beehive’s built-in reader instead.";
    }
    b.id = "b" + Date.now();
    b.text = text;
    briefs.unshift(b);
    busy = false;
    render();
  }
  // Offline demo: send a pasted change through the audit agent, so it opens reviews on the affected requirements.
  function track(id) {
    const b = briefs.find((x) => x.id === id);
    if (!b || typeof AuditAgent === "undefined") return;
    const terms = affected(b.title + " " + b.text).map((x) => x.id);
    AuditAgent.addDemoUpdate({ title: b.title, summary: b.whatChanged, terms });
    briefs = briefs.filter((x) => x.id !== id);
    go("updates");
  }
  function dismiss(id) { briefs = briefs.filter((b) => b.id !== id); render(); }

  // ---------- page ----------
  function updates() {
    if (typeof auditOn === "function" && auditOn()) {
      const d = AuditAgent.data();
      return d.updates.map((u) => ({ u, reviews: d.reviews.filter((r) => r.updateId === u.id) }));
    }
    return [];
  }
  function updateCard(o) {
    const u = o.u, open = o.reviews.filter((r) => !r.decision);
    const hit = o.reviews.map((r) => (r.itemId && typeof findItem === "function" ? findItem(r.itemId) : null)).filter(Boolean);
    const due = open.length ? new Date(Date.parse(String(u.assessedAt || u.published).slice(0, 10)) + 14 * 864e5).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "";
    return (
      '<article class="brief"><p class="updateMeta">' +
        (open.length ? '<span class="status crit">' + open.length + " to review</span>" : '<span class="status green">Reviewed</span>') +
        "<span>Published " + E(new Date(String(u.published).slice(0, 10) + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })) + "</span>" + (u.demo ? '<span class="demoTag">Demo update</span>' : "") + "</p>" +
      "<h2>" + E(u.title) + "</h2>" +
      '<div class="briefGrid"><div><h3>What changed</h3><p>' + E(u.summary) + "</p></div>" +
      "<div><h3>What it means for " + E(typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "your centre") + "</h3>" +
        (hit.length ? '<ul class="briefList">' + hit.map((x) => { const s = reqStatus(x); return "<li>" + E(x.title) + ' <span class="status ' + s[0] + '">' + s[1] + "</span></li>"; }).join("") + "</ul>" : "<p>No requirement clearly matches. Confirm whether it applies.</p>") + "</div>" +
      "<div><h3>What to do</h3><p>" + (open.length ? "Record a decision on " + open.length + " requirement" + (open.length === 1 ? "" : "s") + " by " + E(due) + ": no change needed, update the policy, or doesn’t apply." : "Nothing left. Your decisions are recorded.") + "</p></div></div>" +
      (open.length ? '<div class="buttonRow"><button class="button primary" onclick="go(\'updates\')">Review now</button></div>' : "") + "</article>"
    );
  }
  function briefCard(b) {
    return (
      '<article class="brief"><p class="updateMeta"><span class="status neutral">Summarised by ' + (b.source === "gemini" ? "Gemini" : "beehive’s built-in reader") + "</span><span>Not yet tracked</span></p>" +
      "<h2>" + E(b.title) + "</h2>" + (b.note ? '<p class="muted small">' + E(b.note) + "</p>" : "") +
      '<div class="briefGrid"><div><h3>What changed</h3><p>' + E(b.whatChanged) + "</p></div>" +
      "<div><h3>Requirements it touches</h3>" + (b.affects && b.affects.length ? '<ul class="briefList">' + b.affects.map((t) => "<li>" + E(t) + "</li>").join("") + "</ul>" : "<p>None clearly matched.</p>") + "</div>" +
      "<div><h3>What to do</h3><ul class=\"briefList\">" + (b.actions || []).map((a) => "<li>" + E(a) + "</li>").join("") + "</ul><p class=\"muted small\">" + E(b.deadline || "") + "</p></div></div>" +
      '<div class="buttonRow">' + (!LIVE && typeof AuditAgent !== "undefined" && auditOn() ? '<button class="button primary" onclick="Legal.track(\'' + b.id + '\')">Track it in regulation updates</button>' : "") +
      '<button class="textButton" onclick="Legal.dismiss(\'' + b.id + '\')">Dismiss</button></div></article>'
    );
  }
  function briefingPage() {
    const ups = updates();
    const open = ups.reduce((n, o) => n + o.reviews.filter((r) => !r.decision).length, 0);
    const lede = ups.length
      ? (open ? open + " requirement" + (open === 1 ? "" : "s") + " need" + (open === 1 ? "s" : "") + " your decision after recent changes." : "You’re up to date with every change beehive has read.")
      : "beehive reads regulation and policy changes and tells you what each one means for your centre.";
    return (
      header("Legal briefing", lede) +
      '<section class="section briefPaste"><div class="sectionHead"><h2>Summarise a new change</h2><p>Paste a notice from ACECQA, the NSW Early Learning Commission or a newsletter</p></div>' +
        '<label class="formLabel" for="briefTitle">Title (optional)</label><input class="formControl" id="briefTitle" placeholder="e.g. Child safe environment policy requirements">' +
        '<label class="formLabel" for="briefText">Text of the change</label><textarea class="formControl" id="briefText" rows="5" placeholder="Paste the notice here"></textarea>' +
        '<div class="buttonRow"><button class="button primary" onclick="Legal.summarise()" ' + (busy ? "disabled" : "") + '><span data-icon="spark"></span>' + (busy ? "Reading…" : "Summarise for me") + "</button>" +
        '<button class="textButton" onclick="Legal.example()">Try an example</button></div></section>' +
      briefs.map(briefCard).join("") +
      '<section class="section"><div class="sectionHead"><h2>Changes beehive has read<span class="count">' + ups.length + "</span></h2></div>" +
        (ups.length ? ups.map(updateCard).join("") : '<p class="empty">' + (typeof approved !== "undefined" && !approved ? "Approve your requirements checklist first (ACECQA requirements tab), so beehive can match changes to it." : "No changes yet.") + "</p>") +
      "</section>" +
      '<p class="footnote">Summaries are guidance, not legal advice. beehive flags what a change may affect; it never rewrites a policy or changes a requirement’s status on its own. Check the official source.</p>'
    );
  }
  function example() {
    document.getElementById("briefTitle").value = "Safe sleep guidance for cots and rest areas";
    document.getElementById("briefText").value = "Updated safe sleep guidance for education and care services takes effect from 1 February 2027. Services must check sleeping children at least every 10 minutes and record each check. Cots must meet the current Australian Standard, and rest areas must be visible to educators at all times. Services should review their sleep and rest policy and premises checks against the new guidance.";
  }

  // ---------- Safety and premises tab ----------
  function safetyPage() {
    const list = reqItems().filter((x) => x.area === SAFETY_AREA);
    const gaps = list.filter((x) => reqStatus(x)[0] !== "green").length;
    return (
      header("Safety and premises", gaps ? gaps + " of " + list.length + " checks need attention." : "Every safety and premises check is on track.") +
      (list.length
        ? '<section class="areaBlock">' + list.map((x) => { const s = reqStatus(x); return '<div class="checkRow"><button onclick="openItem(\'' + x.id + '\')"><span class="rowMain"><b>' + E(x.title) + "</b><small>" + E(x.source || "") + '</small></span><span class="rowEnd"><span class="status ' + s[0] + '">' + s[1] + '</span><span class="chev">' + ico("chevron") + "</span></span></button></div>"; }).join("") + "</section>"
        : '<p class="empty">No safety and premises checks in your requirements yet.</p>') +
      '<p class="footnote">Includes emergency evacuation drills, premises and equipment checks, and emergency procedures (Regs 97, 103–117). Open a check to upload evidence or assign it.</p>'
    );
  }

  // ---------- tab strip shared by every Legal page ----------
  function tabs() {
    const n = updates().reduce((k, o) => k + o.reviews.filter((r) => !r.decision).length, 0);
    const tab = (id, label, badge) => '<button class="filterButton ' + (current === id ? "active" : "") + '" onclick="go(\'' + id + '\')">' + label + (badge ? ' <b class="tabBadge">' + badge + "</b>" : "") + "</button>";
    return '<div class="areaFilters legalTabs" role="tablist">' + tab("legal", "Briefing", n) + tab("audit", "ACECQA requirements") + tab("legal-safety", "Safety and premises") + tab("updates", "Regulation updates") + "</div>";
  }

  return { briefingPage, safetyPage, tabs, summarise, track, dismiss, example, builtinBrief };
})();
