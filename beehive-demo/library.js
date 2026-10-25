// Beehive compliance library: official documents behind each checklist item,
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

  const guide = (key) => data.guides.find((g) => g.item_key === key);
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
      '<span class="docText"><b>' + esc(d.title) + "</b><small>" + esc(d.issuer) + (d.published ? " · " + esc(d.published) : "") + "</small>" +
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
      '<details class="guideSteps"' + (filter !== "All" ? " open" : "") + "><summary>What to do · " + g.directions.length + " steps</summary><ol>" +
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
      '<div class="libNote"><b>Sources checked ' + esc(fmtChecked()) + '</b> · ACECQA, NSW Legislation, NSW Department of Education, the NSW Early Learning Commission and the Office of the Children’s Guardian. ' +
      "Summaries are guidance only, not legal advice. Always confirm the current official document." +
      (LIVE ? "" : " <span class=\"libMode\">Offline copy</span>") + "</div>" +
      '<div class="areaFilters libFilters">' + chips + "</div>" +
      (showRefs
        ? '<section class="libGroup"><h3 class="libGroupTitle">Key references</h3><div class="card refCard">' + data.general.map(docRow).join("") + "</div></section>"
        : "") +
      groups
    );
  }


  // ---------- compliance register: recurring tasks ----------
  const FREQ = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Every 3 months", "six-monthly": "Every 6 months", annual: "Every 12 months", once: "One-off" };
  const FREQ_DAYS = { daily: 1, weekly: 7, monthly: 30, quarterly: 91, "six-monthly": 182, annual: 365 };
  // Offline demo copy of the seeded tasks: [title, regulation, frequency, days since done (latest first), due in days, note]
  const OFFLINE_TASKS = [
    ["Emergency and evacuation rehearsal", "Reg 97", "quarterly", [100, 190], -10, "Fire evacuation, all rooms, 4 min 10 s"],
    ["Playground and premises safety check", "Reg 103", "weekly", [5, 12, 19], 2, "No hazards found"],
    ["Fire equipment service", "Reg 97, 103", "six-monthly", [140], 40, "Extinguishers and blankets serviced by contractor"],
    ["Medical conditions policy review", "Reg 90, 91", "annual", [300], 65, "Reviewed with families of children with action plans"],
    ["Sun protection policy review", "Reg 114, 168", "annual", [355], 10, "Checked against ACECQA guidelines"],
    ["Sleep and rest policy review", "Reg 84A–84C", "annual", [380], -15, "Annual review"],
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
      const r = await sb.from("v_compliance_register").select("*").order("due_date", { ascending: true, nullsFirst: false });
      if (!r.error) tasks = r.data || [];
    } catch (e) { /* leave as is */ }
  }
  function resetOffline() { tasks = null; try { localStorage.removeItem(STORE); } catch (e) {} }
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
    if (t.days < 0) return "Overdue by " + -t.days + " day" + (t.days === -1 ? "" : "s") + " · was due " + fmtDay(t.due_date);
    if (t.days === 0) return "Due today";
    if (t.state === "due_soon") return "Due in " + t.days + " day" + (t.days === 1 ? "" : "s") + " · " + fmtDay(t.due_date);
    return "Due " + fmtDay(t.due_date, true);
  }
  function taskRow(t) {
    const [cls, label] = STATE_UI[t.state];
    const last = t.last_completed ? "Last done " + fmtDay(t.last_completed, true) + (t.last_completed_by ? " by " + esc(t.last_completed_by) : "") : "Not done yet";
    return (
      '<div class="taskRow ' + t.state + '"><div class="taskMain"><b>' + esc(t.title) + "</b><small>" + esc(t.regulation_reference || "") + " · " + esc(FREQ[t.frequency] || t.frequency) + " · " + last + "</small></div>" +
      '<div class="taskDue"><span class="status ' + cls + '">' + label + "</span><small>" + esc(dueText(t)) + "</small></div>" +
      '<div class="taskBtns">' + (t.guide_key ? '<button class="button small" onclick="Library.focus(\'' + t.guide_key + '\')">Guidance</button>' : "") +
      (t.state !== "done" && t.record_id ? '<button class="button small primary" onclick="Library.complete(\'' + t.record_id + '\')">Mark done</button>' : "") + "</div></div>"
    );
  }
  function checklistRow(x) {
    return (
      '<div class="taskRow"><div class="taskMain"><b>' + esc(x.title) + "</b><small>" + esc(x.area) + " · " + esc(x.source) + "</small></div>" +
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
      '<div class="summaryGrid compTiles">' +
      miniCard(n("overdue"), "Overdue", "tasks past their due date") +
      miniCard(n("due_soon"), "Due in 14 days", "coming up next") +
      miniCard(n("on_track") + n("done"), "On track", "scheduled or complete") +
      miniCard(green + "/" + list.length, "Audit checklist", "items with current evidence") +
      "</div>" +
      '<section class="card compCard"><div class="compHead"><div><h2>Recurring compliance tasks</h2><p>Every regular check, review and service the regulations require. Mark a task done and Beehive sets the next due date.</p></div></div>' +
      (ts.length ? ts.map(taskRow).join("") : '<div class="emptyState">No recurring tasks yet.</div>') + "</section>" +
      '<section class="card compCard"><div class="compHead"><div><h2>Audit checklist</h2><p>' + (approved ? "Your approved baseline: the records an authorised officer can ask to see." : "Draft baseline: approve it in Audit readiness to start scoring.") + '</p></div><button class="button small" onclick="go(\'audit\')">Open audit readiness</button></div>' +
      list.map(checklistRow).join("") + "</section>"
    );
  }
  function page() {
    const tabs = [["all", "All compliance"], ["guidance", "Official guidance"]].map(([k, l]) =>
      '<button class="compTab ' + (tab === k ? "active" : "") + '" onclick="Library.setTab(\'' + k + '\')">' + l + "</button>").join("");
    return (
      header("Compliance", "Every compliance requirement for your centre in one place, with the official government guidance behind it.",
        '<button class="button" onclick="go(\'audit\')">Audit readiness</button>') +
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
      '<button class="textButton libMore" onclick="Library.focus(\'' + esc(key) + '\')">All ' + g.directions.length + " steps and " + (g.documents || []).length + " official documents →</button></div>"
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
        esc(g.title) + " · guidance</b><small>" + esc(g.source_ref) + " · " + (g.documents || []).length + " official documents</small></button>").join("");
  }

  return { page, itemSection, focus, setFilter, setTab, searchHtml, loadFrom, guide, loadTasks, complete, drillLogged, resetOffline, taskList,
           get source() { return source; } };
})();
