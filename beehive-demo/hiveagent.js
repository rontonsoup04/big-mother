// beehive Morning hive agent (app side). See AGENT.md, "Morning hive agent", and api/hive.js.
//
// Once a day (the first time the owner opens the Overview, or when they press Run again) beehive builds a
// snapshot of the day ahead and asks the agent for at most five proposals: fill a roster gap, chase a
// credential, message a family, or flag a decision. The agent is Claude (api/hive.js); if Claude can't be
// reached, a built-in version applies the same rules, so the demo always works.
// Proposals appear as cells on the Overview canvas. Nothing changes until the owner approves one.
const Hive = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-hive-v1";
  const MAX = 5;
  const SHIFT_LABEL = { early: "6:30 am – 3:00 pm", mid: "8:00 am – 4:30 pm", late: "10:00 am – 6:30 pm" };
  let running = false;

  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  function load() { try { const s = JSON.parse(localStorage.getItem(STORE) || "null"); return s && s.on === today() ? s : null; } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }
  const first = (n) => String(n || "").split(" ")[0];

  // ---------- the day snapshot (what the agent sees) ----------
  function credStatus(c) { return c.missing ? "missing" : c.days < 0 ? "expired" : c.days <= 30 ? "due" : "current"; }
  function snapshot() {
    const st = Centre.sheetStats(), day = st.day;
    const entries = Roster.dayEntries(day);
    const check = Roster.check(day, entries);
    const dn = Roster.dayOf(day);
    const tasks = typeof StaffAgent !== "undefined" && StaffAgent.active() ? StaffAgent.data().tasks || [] : [];
    // beehive's staff agent is already on it: a request has gone out, or it's waiting on the owner's decision
    const chasing = (id, code) => tasks.some((t) => t.staffId === id && (t.code === code || t.typeName === code) && t.state !== "resolved" && (t.state === "waiting" || t.state === "owner_review" || !!t.lastMessageAt));
    const CODE = { WWCC: "WWCC", "First Aid": "FIRST_AID", CPR: "CPR", Anaphylaxis: "ANAPHYLAXIS", Asthma: "ASTHMA" };
    const eds = educators.map((e) => ({
      id: e.id, name: e.name, home_room: e.room, qualification: Roster.profile(e).qual, diploma: Roster.isDiploma(e), works: Roster.profile(e).days,
      rostered_today: entries[e.id] ? entries[e.id].room : null,
      credentials: (e.certs || []).map((c) => ({ type: c.type, status: credStatus(c), days: c.missing ? null : c.days, request_in_progress: chasing(e.id, CODE[c.type] || c.type) })),
    }));
    const kids = Centre.children().filter((k) => k.days.includes(dn) || (k.amendments || []).some((a) => !a.signedOn) || k.missing.length).map((k) => ({
      id: k.id, name: k.first + " " + k.last, room: k.room, parent: String(k.contact || "").split("·")[0].trim(), booked_today: k.days.includes(dn),
      needs: [k.allergies && "allergy: " + k.allergies, k.conditions, k.dietary].filter(Boolean).join("; "),
      open_items: k.missing.concat((k.amendments || []).filter((a) => !a.signedOn).map((a) => "Amended agreement awaiting the parent’s signature"))
        .concat(k.plan && (k.amendments || []).some((a) => a.changes && a.changes.conditions && !a.signedOn) ? ["New medical plan: action plan and medication to bring in"] : []),
    }));
    const gaps = (typeof items !== "undefined" ? items : []).filter((x) => (x.req ? x.req.status : x.status === "green" ? "compliant" : "missing") !== "compliant").map((x) => x.title);
    return {
      day, weekday: dn, centre: typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "",
      rooms: check.rooms.map((r) => ({ room: r.room, children: r.children, ratio: "1:" + r.per, needed: r.needed, rostered: r.rostered, short_by: Math.max(0, r.needed - r.rostered) })),
      diploma_rule: { diplomas_on: check.diplomas, needed: check.diplomaNeeded, met: check.diplomaOk },
      available_to_add: educators.filter((e) => Roster.rosterable(e) && Roster.profile(e).days.includes(dn) && !entries[e.id]).map((e) => e.id),
      educators: eds, children: kids,
      legal: { regulation_changes_to_decide: typeof Legal !== "undefined" ? Legal.openCount() : 0, requirement_gaps: gaps },
    };
  }

  // ---------- built-in version (same rules, no AI) ----------
  function builtin(s) {
    const out = [];
    const add = (p) => { if (out.length < MAX) out.push(p); };
    const avail = s.available_to_add.slice();
    const edById = (id) => s.educators.find((e) => e.id === id);
    s.rooms.filter((r) => r.short_by > 0 || !s.diploma_rule.met).forEach((r) => {
      for (let i = 0; i < Math.max(r.short_by, s.diploma_rule.met ? 0 : 1); i++) {
        const pick = avail.map(edById).sort((a, b) => (b.home_room === r.room) - (a.home_room === r.room) || b.diploma - a.diploma)[0];
        if (!pick) break;
        avail.splice(avail.indexOf(pick.id), 1);
        add({ kind: "fill_roster_gap", room: r.room, educator_id: pick.id, educator: pick.name, shift: "mid", reason: r.room + " has " + r.children + " children at " + r.ratio + " and needs " + r.needed + " educators; " + r.rostered + (r.rostered === 1 ? " is" : " are") + " rostered." });
      }
    });
    s.educators.forEach((e) => e.credentials.filter((c) => c.status !== "current" && !c.request_in_progress && (c.status !== "due" || c.days <= 14)).forEach((c) =>
      add({ kind: "chase_document", educator_id: e.id, educator: e.name, credential: c.type, reason: e.name + "’s " + c.type + " is " + (c.status === "due" ? "due in " + c.days + " days" : c.status) + " and no request is in progress." })));
    s.children.filter((k) => k.open_items.length).forEach((k) => {
      const item = k.open_items[0];
      add({ kind: "draft_parent_message", child_id: k.id, child: k.name, parent: k.parent, reason: k.name + ": " + item.toLowerCase() + ".",
        message: "Hi " + first(k.parent) + ", " + (/signature/i.test(item) ? "we’ve updated " + first(k.name) + "’s agreement with the changes you asked for. When you have a moment, could you check and sign it in the family app?" : "to finish " + first(k.name) + "’s enrolment record we still need the " + item.toLowerCase() + ". Could you upload it in the family app or bring it in this week?") + " Thank you." });
    });
    if (s.legal.regulation_changes_to_decide) add({ kind: "flag_for_owner", priority: "medium", title: "A regulation change needs your decision", detail: "beehive matched it to your requirements; record whether a policy needs to change.", recommended_action: "Open Legal and record your decision.", reason: "Open regulation review." });
    return { proposals: out, summary: summaryLine(s, out), source: "builtin" };
  }
  function summaryLine(s, out) {
    const kids = s.rooms.reduce((n, r) => n + r.children, 0);
    return kids + " children booked for " + s.weekday + ". " + (out.length ? out.length + " thing" + (out.length === 1 ? "" : "s") + " for you to approve." : "Everything is in order.");
  }

  // ---------- running ----------
  async function run(force) {
    if (running) return;
    if (!force && load()) return;
    if (typeof Centre === "undefined" || typeof Roster === "undefined") return;
    running = true;
    const s = snapshot();
    let r = builtin(s);
    let note = "";
    {
      try {
        const res = await fetch("api/hive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot: s }) });
        if (res.status === 404) throw Object.assign(new Error(""), { quiet: true }); // not deployed here (e.g. a local static server)
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Claude couldn’t answer (" + res.status + ").");
        r = { proposals: body.proposals || [], summary: body.summary || summaryLine(s, body.proposals || []), source: "claude", model: body.model };
      } catch (e) { if (!e.quiet) note = (e.message || String(e)) + " Showing beehive’s built-in check instead."; }
    }
    save({ on: today(), at: new Date().toISOString(), day: s.day, source: r.source, model: r.model || "", summary: r.summary, note,
      proposals: r.proposals.slice(0, MAX).map((p, i) => Object.assign({ id: "h" + Date.now().toString(36) + i, status: "open" }, p)) });
    running = false;
    if (typeof current !== "undefined" && current === "overview") render();
  }

  // ---------- approving ----------
  function find(id) { const s = load(); return s ? [s, s.proposals.find((p) => p.id === id)] : [null, null]; }
  function title(p) {
    return p.kind === "fill_roster_gap" ? "Add " + first(p.educator) + " to " + p.room.replace(/ Room$/, "")
      : p.kind === "chase_document" ? "Ask " + first(p.educator) + " for their " + p.credential
      : p.kind === "draft_parent_message" ? "Message " + first(p.parent) + " about " + first(p.child)
      : p.title;
  }
  function label(p) { return { fill_roster_gap: "Roster", chase_document: "Staff", draft_parent_message: "Families", flag_for_owner: "Decision" }[p.kind] || "beehive"; }
  function open(id) {
    const [s, p] = find(id);
    if (!p) return;
    const body = p.kind === "draft_parent_message" ? '<label class="formLabel" for="hvMsg">Message to ' + E(p.parent) + '</label><textarea class="formControl" id="hvMsg" rows="5">' + E(p.message) + "</textarea>"
      : p.kind === "fill_roster_gap" ? "<p>" + E(p.educator) + " joins the " + E(p.room) + " on " + E(new Date(s.day + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })) + ", " + E(SHIFT_LABEL[p.shift] || SHIFT_LABEL.mid) + ".</p>"
      : p.kind === "chase_document" ? "<p>beehive emails " + E(p.educator) + " a secure link to upload their " + E(p.credential) + " and follows up until it’s renewed.</p>"
      : "<p>" + E(p.detail) + "</p><p><b>Recommended:</b> " + E(p.recommended_action) + "</p>";
    openModal(
      '<div class="modalHead"><div><h2>' + E(title(p)) + "</h2><p>Suggested by " + (s.source === "claude" ? "Claude" : "beehive’s built-in check") + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection"><p class="muted small"><b>Why:</b> ' + E(p.reason) + "</p>" + body + "</div>" +
      '<div class="formActions"><button class="button" onclick="Hive.dismiss(\'' + p.id + '\')">Not now</button><button class="button primary" onclick="Hive.approve(\'' + p.id + '\')">' + (p.kind === "draft_parent_message" ? "Approve and send" : p.kind === "flag_for_owner" ? "Got it" : "Approve") + "</button></div>"
    );
  }
  async function approve(id) {
    const [s, p] = find(id);
    if (!p) return;
    try {
      if (p.kind === "fill_roster_gap") { Roster.addShift(s.day, p.educator_id, p.room, p.shift || "mid"); toast(first(p.educator) + " added to " + p.room + "."); }
      else if (p.kind === "chase_document") {
        const t = (StaffAgent.data().tasks || []).find((x) => x.staffId === p.educator_id && (StaffAgent.SHORT[x.code] === p.credential || x.typeName === p.credential) && x.state !== "resolved");
        if (t) await StaffAgent.sendNow(t.id); else toast("Request sent to " + first(p.educator) + " (simulated).");
      } else if (p.kind === "draft_parent_message") {
        const text = ((document.getElementById("hvMsg") || {}).value || p.message).trim();
        if (typeof LIVE !== "undefined" && LIVE && Live.createDraft && Live.approveDraft) { const did = await Live.createDraft(p.child_id, text, "Morning hive agent", "manual"); await Live.approveDraft(did); }
        else toast("Message sent to " + p.parent + " (simulated).");
        p.sent = text;
      } else toast("Noted.");
      p.status = "approved";
      save(s);
      closeModal();
      render();
    } catch (e) { toast(e.message || String(e)); }
  }
  function dismiss(id) { const [s, p] = find(id); if (!p) return; p.status = "dismissed"; save(s); closeModal(); render(); }

  // ---------- what the Overview reads ----------
  function cells() {
    const s = load();
    if (!s) return [];
    return s.proposals.filter((p) => p.status === "open").map((p) => ({
      id: p.id, tone: p.kind === "flag_for_owner" && p.priority === "high" ? "bad" : "agent", label: "beehive · " + label(p), title: title(p), detail: p.reason,
      act: "Hive.approve('" + p.id + "')", btn: p.kind === "draft_parent_message" ? "Review" : "Approve", openAct: "Hive.open('" + p.id + "')", altAct: "Hive.dismiss('" + p.id + "')",
      review: p.kind === "draft_parent_message",
    }));
  }
  function statusBar() {
    const s = load();
    if (!s) return '<div class="hiveBar"><span class="aiMark" data-icon="spark"></span><div><b>Morning check</b><small>' + (running ? "beehive is checking the day…" : "Not run yet today.") + '</small></div><button class="button small" onclick="Hive.run(true)">Run now</button></div>';
    const open = s.proposals.filter((p) => p.status === "open").length, done = s.proposals.filter((p) => p.status === "approved").length;
    return '<div class="hiveBar"><span class="aiMark" data-icon="spark"></span><div><b>Morning check by ' + (s.source === "claude" ? "Claude" : "beehive") + " · " + E(new Date(s.at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })) + "</b><small>" + E(s.summary) +
      (done ? " " + done + " approved." : "") + (s.note ? " " + E(s.note) : "") + '</small></div><button class="button small" onclick="Hive.run(true)"' + (running ? " disabled" : "") + ">" + (running ? "Checking…" : "Run again") + "</button></div>";
  }

  return { run, snapshot, builtin, cells, statusBar, open, approve, dismiss, isRunning: () => running };
})();
