// beehive compliance library: official documents behind each checklist item,
// with a plain-English summary and steps. Offline mode uses LIBRARY_DATA
// (library-data.js); live mode replaces it with the copy in Supabase.

const Library = (() => {
  const AREA_NAMES = {
    staff_records: "Staff Records",
    childrens_records: "Children’s Records",
    safety_premises: "Safety & Premises",
    policies_procedures: "Policies & Procedures",
  };
  let data = typeof LIBRARY_DATA !== "undefined" ? LIBRARY_DATA : { checked: "", general: [], guides: [] };
  let source = "offline";
  let filter = "All";
  let tab = "all";

  // Falls back to the copy shipped with the app, so a guide added since the database was last set up still shows.
  const guide = (key) => data.guides.find((g) => g.item_key === key) || (typeof LIBRARY_DATA !== "undefined" ? LIBRARY_DATA.guides.find((g) => g.item_key === key) : undefined);
  const fmtChecked = () => {
    if (!data.checked) return "";
    const d = new Date(data.checked + "T00:00:00");
    return isNaN(d) ? data.checked : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  };

  // Live mode: read the library from Supabase (falls back to the bundled copy).
  async function loadFrom(sb) {
    try {
      const [g, d] = await Promise.all([
        sb.from("compliance_guides").select("*").order("sort"),
        sb.from("compliance_documents").select("*").order("sort"),
      ]);
      if (g.error || d.error || !g.data || !g.data.length) return;
      const docs = d.data;
      data = {
        checked: g.data.reduce((m, x) => { const c = String(x.checked_on || "").slice(0, 10); return c > m ? c : m; }, ""),
        general: docs.filter((x) => !x.item_key),
        guides: g.data.map((x) => Object.assign({}, x, { documents: docs.filter((y) => y.item_key === x.item_key) })),
      };
      source = "database";
      if (typeof current !== "undefined" && current === "compliance") render();
    } catch (e) { /* keep bundled copy */ }
  }

  function docRow(d) {
    return (
      '<a class="docRow" href="' + esc(d.url) + '" target="_blank" rel="noopener">' +
      '<span class="docType">' + esc(d.doc_type || d.type || "Document") + "</span>" +
      '<span class="docText"><b>' + esc(d.title) + "</b><small>" + esc(d.issuer) + (d.published ? ", " + esc(d.published) : "") + "</small>" +
      (d.note ? "<em>" + esc(d.note) + "</em>" : "") + "</span>" +
      '<span class="docOpen" aria-hidden="true">↗</span></a>'
    );
  }

  function guideCard(g) {
    const item = typeof findItemByKey === "function" ? findItemByKey(g.item_key) : null;
    const chip = item ? '<span class="status ' + item.status + '">' + statusLabel(item.status) + "</span>" : "";
    return (
      '<article class="card guideCard" id="guide-' + esc(g.item_key) + '">' +
      '<div class="guideHead"><div><div class="eyebrow">' + esc(AREA_NAMES[g.area] || g.area) + "</div><h2>" + esc(g.title) + "</h2>" +
      '<p class="guideRefs">' + esc(g.source_ref) + "</p></div>" + chip + "</div>" +
      '<p class="guideSummary">' + esc(g.summary) + "</p>" +
      '<details class="guideSteps"' + (filter !== "All" ? " open" : "") + "><summary>What to do (" + g.directions.length + " steps)</summary><ol>" +
      g.directions.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol></details>" +
      '<div class="guideFacts">' +
      (g.evidence ? '<div><span>Show an officer</span><p>' + esc(g.evidence) + "</p></div>" : "") +
      (g.retention ? '<div><span>Keep records</span><p>' + esc(g.retention) + "</p></div>" : "") +
      "</div>" +
      '<div class="guideDocs"><span class="guideDocsLabel">Official documents</span>' + (g.documents || []).map(docRow).join("") + "</div>" +
      (item ? '<div class="guideActions"><button class="button small" onclick="openItem(\'' + item.id + '\')">Open checklist item</button></div>' : "") +
      "</article>"
    );
  }

  function guidancePage() {
    const areas = ["All", "Key references"].concat(Object.values(AREA_NAMES));
    const chips = areas.map((a) =>
      '<button class="filterButton ' + (filter === a ? "active" : "") + '" onclick="Library.setFilter(\'' + a.replace(/’/g, "\\u2019") + '\')">' + esc(a) + "</button>").join("");
    const showRefs = filter === "All" || filter === "Key references";
    const groups = Object.entries(AREA_NAMES)
      .filter(([, name]) => filter === "All" || filter === name)
      .map(([key, name]) => {
        const gs = data.guides.filter((g) => g.area === key);
        return gs.length ? '<section class="libGroup"><h3 class="libGroupTitle">' + esc(name) + "</h3>" + gs.map(guideCard).join("") + "</section>" : "";
      }).join("");
    return (
      '<div class="libNote"><b>Sources checked ' + esc(fmtChecked()) + '.</b> From ACECQA, NSW Legislation, the NSW Department of Education, the NSW Early Learning Commission and the Office of the Children’s Guardian. ' +
      "Summaries are guidance only, not legal advice. Always confirm the current official document." +
      (LIVE ? "" : " <span class=\"libMode\">Offline copy</span>") + "</div>" +
      '<div class="areaFilters libFilters">' + chips + "</div>" +
      (showRefs
        ? '<section class="libGroup"><h3 class="libGroupTitle">Key references</h3><div class="card refCard">' + data.general.map(docRow).join("") + "</div></section>"
        : "") +
      groups
    );
  }



  // ---------- beehive compliance agent (server: /api/agent, see AGENT.md) ----------
  let agentQueue = [];
  let agentRun = { busy: false, reply: "", actions: [], error: "" };
  const PRIO = { high: "red", medium: "yellow", low: "neutral" };
  const KIND = { renewal: "Renewal", missing: "Missing", follow_up: "Follow-up", escalation: "Needs your decision" };

  async function runAgent() {
    const message = ((document.getElementById("agentAsk") || {}).value || "").trim() || "Run the weekly credential check.";
    agentRun = { busy: true, reply: "", actions: [], error: "", message };
    render();
    // never leave the button spinning: give up after 2 minutes, and always redraw
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 130000) : null;
    try {
      const res = await fetch("api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }), signal: ctl ? ctl.signal : undefined });
      let body = {};
      try { body = await res.json(); } catch (e) {
        body = { error: res.status === 404 ? "The agent isn't deployed on this site yet (no /api/agent). Deploy the latest version on Vercel."
          : res.status === 504 ? "The AI agent took too long and Vercel stopped it. Try again, or ask for something narrower, like “Only check WWCC”."
          : "The agent returned an unexpected response (" + res.status + ")." };
      }
      if (!res.ok) agentRun = { busy: false, reply: "", actions: [], error: body.error || "The agent couldn't run (" + res.status + ")." , message };
      else agentRun = { busy: false, reply: body.reply, actions: body.actions || [], error: "", message, saved: body.drafts_saved, escalated: body.escalated, seconds: body.seconds };
    } catch (e) {
      agentRun = { busy: false, reply: "", actions: [], error: e && e.name === "AbortError" ? "The agent didn’t answer within 2 minutes. Try again, or ask for something narrower." : "Couldn't reach the agent: " + (e.message || e), message };
    } finally {
      if (timer) clearTimeout(timer);
      agentRun.busy = false;
    }
    try { if (LIVE) await Live.reload(); else render(); } catch (e) { render(); }
  }

  function agentCard() {
    const drafts = agentQueue.filter((d) => d.kind !== "escalation");
    const escalations = agentQueue.filter((d) => d.kind === "escalation");
    const prioRank = { high: 0, medium: 1, low: 2 };
    drafts.sort((a, b) => prioRank[a.priority] - prioRank[b.priority]);
    if (!LIVE) {
      return '<section class="card agentCard"><div class="agentHead"><span class="assistantMark">✦</span><div><h2>Compliance agent</h2><p>Checks every educator’s credentials, drafts renewal reminders with an upload link, and flags what you need to decide. Sign in to run it on live data.</p></div></div></section>';
    }
    const result = agentRun.busy
      ? '<div class="agentResult"><span class="agentSpinner"></span> Checking credentials and drafting reminders…</div>'
      : agentRun.error
      ? '<div class="agentResult agentError"><b>Couldn’t run the agent.</b> ' + esc(agentRun.error) + "</div>"
      : agentRun.reply
      ? '<div class="agentResult"><small>You asked: “' + esc(agentRun.message || "") + '”' + (agentRun.seconds != null ? " · took " + agentRun.seconds + " s" : "") + '</small><div class="agentReply">' + esc(agentRun.reply).replace(/\n/g, "<br>") + "</div>" +
        (agentRun.actions.length ? '<div class="agentSteps">' + agentRun.actions.map((a, i) => "<span>" + (i + 1) + ". " + esc(a.tool.replace(/_/g, " ")) + (a.result ? ": " + esc(a.result) : "") + "</span>").join("") + "</div>" : "") + "</div>"
      : "";
    return (
      '<section class="card agentCard"><div class="agentHead"><span class="assistantMark">✦</span><div><h2>Compliance agent</h2>' +
      "<p>Checks every educator’s WWCC, first aid, CPR and anaphylaxis, drafts renewal reminders and flags what you need to decide. Nothing is sent until you approve it.</p></div></div>" +
      '<div class="agentForm"><input class="formControl" id="agentAsk" placeholder="Run the weekly credential check" value="' + esc(agentRun.message && agentRun.message !== "Run the weekly credential check." ? agentRun.message : "") + '" onkeydown="if(event.key===\'Enter\')Library.runAgent()">' +
      '<button class="button primary" ' + (agentRun.busy ? "disabled" : "") + ' onclick="Library.runAgent()">' + (agentRun.busy ? "Running…" : "Run agent") + "</button></div>" +
      result +
      (escalations.length ? '<div class="agentList"><h3>Needs your decision (' + escalations.length + ")</h3>" + escalations.map((d) =>
        '<div class="agentItem escalation"><div><b>' + esc(d.staff_name) + (d.certificate_code ? ", " + esc(d.certificate_name || d.certificate_code) : "") + "</b><small>" + esc(d.reason) + "</small></div>" +
        '<div class="draftActions"><button class="button small" onclick="Library.decide(\'' + d.id + '\',\'resolved\')">Mark handled</button></div></div>').join("") + "</div>" : "") +
      (drafts.length ? '<div class="agentList"><h3>Reminder drafts to approve (' + drafts.length + ")</h3>" + drafts.map((d) =>
        '<div class="agentItem"><div class="agentItemTop"><b>' + esc(d.staff_name) + ", " + esc(d.certificate_name || d.certificate_code || "") + '</b><span class="status ' + PRIO[d.priority] + '">' + esc(d.priority[0].toUpperCase() + d.priority.slice(1)) + " priority, " + esc((KIND[d.kind] || d.kind).toLowerCase()) + "</span></div>" +
        "<small>" + esc(d.reason) + (d.follow_up_on ? ". Follow up " + esc(fmtDay(d.follow_up_on, true)) + " if still outstanding." : "") + "</small>" +
        '<textarea id="rd-' + d.id + '" rows="4">' + esc(d.body) + "</textarea>" +
        '<div class="draftActions"><button class="button small" onclick="Library.decide(\'' + d.id + '\',\'discarded\')">Discard</button><button class="button small primary" onclick="Library.approveReminder(\'' + d.id + '\')">Approve & send</button></div></div>').join("") + "</div>"
        : (agentRun.reply ? "" : '<p class="agentEmpty">No reminder drafts waiting. Run the agent to check credentials.</p>')) +
      "</section>"
    );
  }

  async function approveReminder(id) {
    const ta = document.getElementById("rd-" + id);
    try {
      const r = await Live.q(Live.client().rpc("approve_staff_reminder", { p_id: id, p_body: ta ? ta.value : null }));
      toast("Reminder sent to the educator" + (r && r.follow_up_on ? ". Follow-up check on " + fmtDay(r.follow_up_on, true) + "." : "."));
      await Live.reload();
    } catch (e) { toast(e.message || String(e)); }
  }
  async function decide(id, decision) {
    try {
      await Live.q(Live.client().rpc("decide_staff_reminder", { p_id: id, p_decision: decision }));
      toast(decision === "resolved" ? "Marked as handled." : "Draft discarded.");
      await Live.reload();
    } catch (e) { toast(e.message || String(e)); }
  }
  // Educators: reminders the owner approved for them.
  function educatorReminders() {
    // approved reminders go out through the staff agent's renewal, so they're listed with its requests instead
    if (typeof StaffAgent !== "undefined" && StaffAgent.active()) return "";
    if (!LIVE || !agentQueue.length) return "";
    return '<section class="card agentCard educatorReminders"><h2>Reminders from ' + esc(typeof ownerFirst === "function" ? ownerFirst() : "your centre") + "</h2>" +
      agentQueue.map((d) => '<div class="agentItem"><div class="agentItemTop"><b>' + esc(d.certificate_name || d.certificate_code || "Certificate") + "</b><small>" + esc(fmtDay(String(d.decided_at || "").slice(0, 10), true)) + "</small></div><p>" + esc(d.body).replace(/\n/g, "<br>") + "</p></div>").join("") + "</section>";
  }

  // ---------- compliance register: recurring tasks ----------
  const FREQ = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Every 3 months", "six-monthly": "Every 6 months", annual: "Every 12 months", once: "One-off" };
  const FREQ_DAYS = { daily: 1, weekly: 7, monthly: 30, quarterly: 91, "six-monthly": 182, annual: 365 };
  // Offline demo copy of the seeded tasks: [title, regulation, frequency, days since done (latest first), due in days, note]
  const OFFLINE_TASKS = [
    ["Emergency and evacuation rehearsal", "Reg 97", "quarterly", [100, 190], -10, "Fire evacuation, whole centre, 4 min 10 s"],
    ["Playground and premises safety check", "Reg 103", "weekly", [5, 12, 19], 2, "No hazards found"],
    ["Fire equipment service", "Reg 97, 103", "six-monthly", [140], 40, "Extinguishers and blankets serviced by contractor"],
    ["Medical conditions policy review", "Reg 90, 91", "annual", [300], 65, "Reviewed with families of children with action plans"],
    ["Sun protection policy review", "Reg 114, 168", "annual", [355], 10, "Checked against ACECQA guidelines"],
    ["Sleep and rest policy review", "Reg 84A–84C", "annual", [210], 155, "Annual review and risk assessment"],
    ["Quality Improvement Plan review", "Reg 55, 56", "annual", [200], 165, "QA2 and QA7 goals updated"],
    ["Staff record and responsible person register", "Reg 145, 150", "monthly", [26, 57], 4, "Register checked against roster"],
    ["Excursion risk assessments up to date", "Reg 100–102", "once", [], 21, ""],
  ];
  const STORE = "beehive-compliance-v1";
  let tasks = null;

  const isoDay = (offset) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
  const daysUntil = (iso) => { if (!iso) return null; const t = new Date(); t.setHours(12, 0, 0, 0); return Math.round((new Date(String(iso).slice(0, 10) + "T12:00:00") - t) / 86400000); };
  const fmtDay = (iso, year) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("en-AU", year ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" }) : "";
  function guideKeyFor(title) {
    const t = title.toLowerCase();
    const rules = [[/evacuat|rehears|fire/, "evacuation"], [/playground|premises/, "premises"], [/medical/, "medical"], [/sun/, "sun"], [/sleep/, "sleep"],
      [/quality improvement/, "qip"], [/excursion/, "excursions"], [/staff record|responsible person/, "wwcc"], [/incident/, "incidents"], [/enrol/, "enrolment"]];
    const hit = rules.find(([re]) => re.test(t));
    return hit ? hit[1] : null;
  }
  function offlineTasks() {
    try { const saved = JSON.parse(localStorage.getItem(STORE) || "null"); if (saved && saved.length) return saved; } catch (e) {}
    return OFFLINE_TASKS.map(([title, ref, freq, done, due, note], i) => ({
      record_id: "offline-" + i, title, regulation_reference: ref, frequency: freq, due_date: isoDay(due),
      last_completed: done.length ? isoDay(-done[0]) : null, last_completed_by: done.length ? (typeof OWNER_NAME !== "undefined" ? OWNER_NAME : "Centre owner") : null,
      last_notes: note, times_completed: done.length, guide_key: guideKeyFor(title),
    }));
  }
  function saveOffline() { try { localStorage.setItem(STORE, JSON.stringify(tasks)); } catch (e) {} }
  function taskList() {
    if (!LIVE && !tasks) tasks = offlineTasks();
    return (tasks || []).map((t) => {
      const days = t.due_date ? daysUntil(t.due_date) : null;
      const state = !t.due_date ? "done" : days < 0 ? "overdue" : days <= 14 ? "due_soon" : "on_track";
      return Object.assign({}, t, { days, state, guide_key: t.guide_key || guideKeyFor(t.title) });
    }).sort((a, b) => (a.days === null ? 1e9 : a.days) - (b.days === null ? 1e9 : b.days));
  }
  async function loadTasks(sb) {
    try {
      const leader = typeof ME !== "undefined" && ME && (ME.role === "owner" || ME.role === "director");
      const [r, qd] = await Promise.all([
        leader ? sb.from("v_compliance_register").select("*").order("due_date", { ascending: true, nullsFirst: false }) : Promise.resolve({ data: [] }),
        leader ? sb.from("v_staff_reminder_queue").select("*").eq("status", "draft").order("created_at", { ascending: false })
               : sb.from("v_staff_reminder_queue").select("*").eq("status", "sent").order("decided_at", { ascending: false }).limit(5),
      ]);
      if (!r.error) tasks = r.data || [];
      if (!qd.error) agentQueue = qd.data || [];
    } catch (e) { /* leave as is */ }
  }
  function complete(recordId) {
    if (LIVE) return Live.completeTask(recordId);
    const t = (tasks || []).find((x) => x.record_id === recordId);
    if (!t || !t.due_date) return;
    completeOffline(t);
    render();
    toast(t.due_date ? "Done. Next due " + fmtDay(t.due_date, true) + "." : "Done. This one-off task is complete.");
  }
  function completeOffline(t, note) {
    t.last_completed = isoDay(0);
    t.last_completed_by = typeof OWNER_NAME !== "undefined" ? OWNER_NAME : "Centre owner";
    t.times_completed = (t.times_completed || 0) + 1;
    if (note) t.last_notes = note;
    t.due_date = FREQ_DAYS[t.frequency] ? isoDay(FREQ_DAYS[t.frequency]) : null;
    saveOffline();
  }
  // Offline: verified evidence completes the linked recurring task (same rule as the database).
  function completeMatching(re, note) {
    if (LIVE) return;
    if (!tasks) tasks = offlineTasks();
    tasks.filter((x) => re.test(x.title) && x.due_date).forEach((t) => completeOffline(t, note));
  }
  // Offline: logging a drill on the checklist also completes the rehearsal task.
  function drillLogged() {
    if (LIVE) return;
    if (!tasks) tasks = offlineTasks();
    const t = tasks.find((x) => /evacuation/i.test(x.title) && x.due_date);
    if (t) completeOffline(t, "Drill logged");
  }
  const STATE_UI = { overdue: ["red", "Overdue"], due_soon: ["yellow", "Due soon"], on_track: ["green", "On track"], done: ["green", "Done"] };
  function dueText(t) {
    if (t.state === "done") return "Completed";
    if (t.days < 0) return "Overdue by " + -t.days + " day" + (t.days === -1 ? "" : "s") + " (due " + fmtDay(t.due_date) + ")";
    if (t.days === 0) return "Due today";
    if (t.state === "due_soon") return "Due in " + t.days + " day" + (t.days === 1 ? "" : "s") + ", " + fmtDay(t.due_date);
    return "Due " + fmtDay(t.due_date, true);
  }
  function taskRow(t) {
    const [cls, label] = STATE_UI[t.state];
    const last = t.last_completed ? "Last done " + fmtDay(t.last_completed, true) + (t.last_completed_by ? " by " + esc(t.last_completed_by) : "") : "Not done yet";
    return (
      '<div class="taskRow ' + t.state + '"><div class="taskMain"><b>' + esc(t.title) + "</b><small>" + esc(t.regulation_reference || "") + ", " + esc((FREQ[t.frequency] || t.frequency).toLowerCase()) + ". " + last + "</small></div>" +
      '<div class="taskDue"><span class="status ' + cls + '">' + label + "</span><small>" + esc(dueText(t)) + "</small></div>" +
      '<div class="taskBtns">' + (t.guide_key ? '<button class="button small" onclick="Library.focus(\'' + t.guide_key + '\')">Guidance</button>' : "") +
      (t.state !== "done" && t.record_id ? '<button class="button small primary" onclick="Library.complete(\'' + t.record_id + '\')">Mark done</button>' : "") + "</div></div>"
    );
  }
  function checklistRow(x) {
    return (
      '<div class="taskRow"><div class="taskMain"><b>' + esc(x.title) + "</b><small>" + esc(x.area) + ", " + esc(x.source) + "</small></div>" +
      '<div class="taskDue"><span class="status ' + x.status + '">' + statusLabel(x.status) + "</span><small>" + esc(x.updated || "") + "</small></div>" +
      '<div class="taskBtns"><button class="button small" onclick="Library.focus(\'' + esc(x.key || x.id) + '\')">Guidance</button><button class="button small" onclick="openItem(\'' + x.id + '\')">Open</button></div></div>'
    );
  }
  function registerPage() {
    const ts = taskList();
    const n = (st) => ts.filter((t) => t.state === st).length;
    const list = typeof items !== "undefined" ? items : [];
    const green = list.filter((x) => x.status === "green").length;
    return (
      '<div class="summaryLine">' +
      stat(n("overdue"), "overdue", n("overdue") ? "red" : "") +
      stat(n("due_soon"), "due in 14 days", n("due_soon") ? "yellow" : "") +
      stat(n("on_track") + n("done"), "on track") +
      stat(green + "/" + list.length, "checklist items with current evidence") +
      "</div>" +
      agentCard() +
      '<section class="card compCard"><div class="compHead"><div><h2>Recurring tasks</h2><p>Drills, safety checks and policy reviews. Mark one done and beehive sets the next due date.</p></div></div>' +
      (ts.length ? ts.map(taskRow).join("") : '<div class="emptyState">No recurring tasks yet.</div>') + "</section>" +
      '<section class="card compCard"><div class="compHead"><div><h2>Audit checklist</h2><p>' + (approved ? "The records an authorised officer can ask to see." : "Approve your checklist in Audit readiness to start scoring.") + '</p></div><button class="textButton" onclick="go(\'audit\')">Audit readiness</button></div>' +
      list.map(checklistRow).join("") + "</section>"
    );
  }
  function page() {
    const tabs = [["all", "All compliance"], ["guidance", "Official guidance"]].map(([k, l]) =>
      '<button class="compTab ' + (tab === k ? "active" : "") + '" onclick="Library.setTab(\'' + k + '\')">' + l + "</button>").join("");
    return (
      header("Compliance", "Requirements, evidence and outstanding actions, with the official guidance behind them.") +
      '<div class="compTabs" role="tablist">' + tabs + "</div>" +
      (tab === "all" ? registerPage() : guidancePage())
    );
  }
  function setTab(k) { tab = k; render(); window.scrollTo(0, 0); }

  // Short version inside a checklist item's dialog.
  function itemSection(key) {
    const g = guide(key);
    if (!g) return "";
    return (
      '<div class="modalSection libInModal"><h3>How to comply</h3><ol>' +
      g.directions.slice(0, 3).map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>" +
      (g.retention ? '<p class="libKeep"><b>Keep records:</b> ' + esc(g.retention) + "</p>" : "") +
      '<div class="guideDocs">' + (g.documents || []).slice(0, 2).map(docRow).join("") + "</div>" +
      '<button class="textButton libMore" onclick="Library.focus(\'' + esc(key) + '\')">All ' + g.directions.length + " steps and " + (g.documents || []).length + " official documents</button></div>"
    );
  }

  function focus(key) {
    closeModal();
    filter = "All";
    tab = "guidance";
    go("compliance");
    setTimeout(() => {
      const el = document.getElementById("guide-" + key);
      if (!el) return;
      const d = el.querySelector("details");
      if (d) d.open = true;
      el.classList.add("guideFocus");
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => el.classList.remove("guideFocus"), 2200);
    }, 30);
  }

  function setFilter(a) { filter = a; render(); }

  // Search results for the top search bar (both modes).
  function searchHtml(value) {
    const terms = String(value || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return "";
    const hits = data.guides.filter((g) => {
      const text = (g.title + " " + g.source_ref + " " + g.summary + " " + (g.documents || []).map((d) => d.title).join(" ")).toLowerCase();
      return terms.every((t) => text.includes(t)) || (terms.join(" ").includes("wwc") && g.item_key === "wwcc");
    }).slice(0, 3);
    if (!hits.length) return "";
    return '<div class="resultHeading libResultHeading">Official guidance</div>' +
      hits.map((g) => '<button class="searchResult" onclick="document.getElementById(\'searchResults\').classList.add(\'hidden\');Library.focus(\'' + g.item_key + '\')"><b>' +
        esc(g.title) + "</b><small>Official guidance, " + esc(g.source_ref) + ", " + (g.documents || []).length + " documents</small></button>").join("");
  }

  return { page, itemSection, focus, setFilter, setTab, searchHtml, loadFrom, guide, loadTasks, complete, drillLogged, completeMatching, taskList,
           runAgent, approveReminder, decide, educatorReminders, agentDraftCount: () => agentQueue.filter((d) => d.status === "draft").length,
           get source() { return source; } };
})();
