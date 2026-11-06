// beehive audit-readiness agent (interface + offline engine).
//
// Watches every requirement in the approved checklist and its evidence:
//   detect gap -> explain and prioritise -> request evidence (simulated email/SMS) or propose an action -> follow up
//   -> assess what's submitted -> owner verifies -> requirement and readiness update.
// Regulation updates are assessed for possibly affected requirements, flagged "Review required" and given an owner
// task; only the owner's decision changes anything. Credential requirements reuse the staff agent's renewals.
//
// Signed in, the loop runs in the database (supabase/migrations/20261029090000_audit_agent.sql) and this file reads it.
// In the offline demo the same rules run here, in the browser.
//
// Status: Missing, Under review, Compliant (+ indicators). Readiness = (compliant + ½ under review) / requirements.
const AuditAgent = (() => {
  const STORE = "beehive-audit-v3";
  const LABEL = { missing: "Missing", under_review: "Under review", compliant: "Compliant" };
  const STATUS_CLASS = { missing: "red", under_review: "yellow", compliant: "green" };
  const COLOR_OF = { missing: "red", under_review: "yellow", compliant: "green" };
  const PRIO = { critical: ["crit", "Critical", 4], high: ["high", "High", 3], medium: ["medium", "Medium", 2], low: ["monitor", "Low", 1] };
  const FLAG = { overdue: "Overdue", review_due: "Renewal due soon", review_required: "Review required", awaiting_verification: "Awaiting verification", expiring: "Credentials expiring", task_overdue: "Scheduled task overdue" };
  const TASK_STATE = { monitoring: "Monitoring", waiting: "Waiting", owner_review: "Owner review", resolved: "Resolved" };
  const FOLLOW = { critical: 2, high: 3, medium: 7, low: 14 };
  const REQUIRED = ["WWCC", "FIRST_AID", "CPR", "ANAPHYLAXIS", "ASTHMA"];
  // What each requirement is checked against (offline copy of the checklist_items columns).
  const META = {
    wwcc: { kind: "certificates", codes: ["WWCC"], months: 12, hint: "Working with Children Check number and expiry for every educator" },
    firstaid: { kind: "certificates", codes: ["FIRST_AID", "CPR"], months: 12, hint: "Current first aid (HLTAID012) and CPR (HLTAID009) certificates" },
    training: { kind: "certificates", codes: ["ANAPHYLAXIS", "ASTHMA", "CHILD_PROTECTION", "QUALIFICATION"], months: 12, hint: "Anaphylaxis, asthma, child protection training and qualifications" },
    enrolment: { kind: "children", months: 12, hint: "Enrolment record with parent contacts and emergency contact for every child" },
    incidents: { kind: "incidents", months: 12, hint: "Incident record with parent notified within 24 hours" },
    medical: { kind: "medical", months: 12, hint: "Current, reviewed medical information for children with conditions" },
    authorisations: { kind: "document", months: 12, hint: "Authorised nominee and collection records" },
    evacuation: { kind: "document", months: 3, hint: "Drill log dated within the last 3 months" },
    premises: { kind: "document", months: 1, hint: "Recent premises and equipment safety checklist" },
    emergency: { kind: "document", months: 12, hint: "Current emergency procedures and contacts on display" },
    sun: { kind: "document", months: 12, hint: "Reviewed policy with a review date in the last 12 months" },
    sleep: { kind: "document", months: 12, hint: "Reviewed sleep and rest policy" },
  };
  // what a regulation decision asks the owner to do when the requirement is checked from beehive's own records
  const REG_ACTION = {
    certificates: "Check the staff register against the new requirement in Staff certifications. Renewals and new certificates go through beehive’s staff agent. Mark this done when the change is in place.",
    medical: "Update how medical information is collected and ask families for anything new through beehive. Mark this done when the change is in place.",
    incidents: "Update the incident procedure and brief staff. Mark this done when the change is in place.",
  };
  const CRITICAL = ["wwcc", "firstaid", "evacuation", "emergency", "medical", "incidents"];
  const TASK_PATTERN = { evacuation: /evacuat|rehears/i, premises: /playground|premises/i, sun: /sun protection/i, sleep: /sleep/i, medical: /medical conditions/i };
  const WHY = {
    wwcc: "Every educator must hold a current Working with Children Check, and an officer can ask to see the register (Reg. 145–146).",
    firstaid: "An educator with current first aid, CPR and anaphylaxis training must be on site at all times (Reg. 136).",
    training: "Staff records must show each educator’s qualifications and training (Reg. 145–147).",
    enrolment: "Staff must be able to reach a parent or emergency contact for every child (Reg. 160–162).",
    incidents: "Parents must be told within 24 hours, and serious incidents notified to the regulator (Reg. 86–87).",
    medical: "Children with medical conditions need current plans so staff can respond safely (Reg. 90–91).",
    authorisations: "Children may only leave with an authorised person, and outings need written authorisation (Reg. 99–102).",
    evacuation: "Emergency and evacuation procedures must be rehearsed every 3 months and each rehearsal recorded (Reg. 97).",
    premises: "Premises, furniture and equipment must be safe, clean and well maintained (Reg. 103).",
    emergency: "Emergency procedures, contacts and the evacuation floor plan must be current and displayed (Reg. 97, 168).",
    sun: "The service must have a current sun protection policy that staff follow (Reg. 114, 168).",
    sleep: "Sleep and rest policies must reflect current requirements, with a risk assessment at least every 12 months (Reg. 84A–84C).",
  };
  const TOPIC = { authorisations: /authoris|nominee|collect/i, evacuation: /evacuat|drill|emergency/i, premises: /premises|safety check|playground|equipment/i,
    emergency: /emergency|evacuat|contact/i, sun: /sun|uv|shade|hat/i, sleep: /sleep|rest|cot|bassinet/i };

  let data = { available: false, mode: "", error: "", tasks: [], evidence: [], reviews: [], updates: [], events: [], messages: [], lastRun: null, staff: [] };
  let attentionTab = "verify";
  let link = null; // evidence link upload state { token, itemId, file, analysis }

  const isLive = () => typeof LIVE !== "undefined" && LIVE;
  const leader = () => !isLive() || (ME && (ME.role === "owner" || ME.role === "director"));
  const active = () => data.available;
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const addMonths = (iso, m) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); };
  const daysFrom = (iso) => (iso ? Math.round((Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") - Date.parse(today() + "T00:00:00Z")) / 864e5) : null);
  const fmtDate = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");
  const first = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const lc = (s) => String(s || "").charAt(0).toLowerCase() + String(s || "").slice(1);
  const itemById = (id) => (typeof items !== "undefined" ? items.find((x) => x.id === id) : null);
  const keyOf = (x) => (x ? x.key || x.id : "");
  const meta = (x) => Object.assign({}, META[keyOf(x)] || { kind: "document", months: 12, hint: "" }, x && x.kind ? { kind: x.kind } : {}, x && x.months ? { months: x.months } : {}, x && x.hint ? { hint: x.hint } : {});

  // =====================================================================================
  // Offline engine (same rules as the database functions)
  // =====================================================================================
  const Engine = (() => {
    let S = null;
    const now = () => new Date().toISOString();
    const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };
    const st = (id) => (S.items[id] = S.items[id] || { agentStatus: null, agentPriority: null, lastReviewedAt: null, reviewRequired: false, reviewNote: "" });
    function event(itemId, taskId, updateId, kind, state, summary, detail, at) {
      S.events.push({ id: ++S.seq, itemId, taskId, updateId, kind, state, summary, detail: detail || {}, demo: !!S.seeding, at: at || now() });
    }
    const evidenceFor = (id) => S.evidence.filter((e) => e.itemId === id);
    const latest = (list) => list.slice().sort((a, b) => String(b.recordedOn).localeCompare(String(a.recordedOn)) || String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const openTask = (itemId, kinds) => S.tasks.find((t) => t.itemId === itemId && t.state !== "resolved" && kinds.includes(t.kind));
    const staffList = () => (typeof educators !== "undefined" ? educators : []);
    const staffName = (id) => { const e = staffList().find((x) => x.id === id); return e ? e.name : ""; };
    const compTasks = () => (typeof Library !== "undefined" ? Library.taskList() : []);
    const linkedOverdue = (key) => { const re = TASK_PATTERN[key]; return re ? compTasks().find((t) => re.test(t.title) && t.state === "overdue") : null; };

    function status(x) {
      const id = x.id, key = keyOf(x), m = meta(x), s = st(id), d = today();
      let status, flags = [], reason = "", cur = "", last = null, ev = null, pend = null, exp = null;
      let nBad = 0, nPend = 0, nSoon = 0, nTotal = 0, names = [];
      if (m.kind === "document") {
        ev = latest(evidenceFor(id).filter((e) => e.status === "verified"));
        pend = evidenceFor(id).filter((e) => e.status === "pending").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
        const win = Math.min(30, Math.max(5, m.months * 7));
        if (ev) exp = addMonths(ev.recordedOn, m.months);
        if (ev && exp >= d) {
          status = "compliant"; cur = ev.title + " (" + fmtDate(ev.recordedOn) + "), verified"; reason = "Verified evidence on file, current until " + fmtDate(exp) + ".";
          if (exp <= addDays(d, win)) { flags.push("review_due"); reason = "Current, but due for renewal by " + fmtDate(exp) + "."; }
          if (pend) flags.push("awaiting_verification");
        } else if (pend) {
          status = "under_review"; cur = pend.title + ", uploaded " + fmtDate(pend.createdAt) + ", not yet verified";
          reason = "New evidence uploaded and waiting for verification." + (ev ? " The last verified evidence expired on " + fmtDate(exp) + "." : "");
          flags.push("awaiting_verification"); if (ev) flags.push("overdue");
        } else {
          status = "missing";
          if (ev) { flags.push("overdue"); cur = ev.title + " (" + fmtDate(ev.recordedOn) + "), expired " + fmtDate(exp); reason = "Out of date: the last verified evidence is from " + fmtDate(ev.recordedOn) + " and expired on " + fmtDate(exp) + "."; }
          else { cur = "No evidence on file"; reason = "No verified evidence on file."; }
        }
        last = ev ? ev.verifiedAt || ev.createdAt : null;
      } else if (m.kind === "certificates") {
        const subs = typeof StaffAgent !== "undefined" ? StaffAgent.data().subs : [];
        staffList().forEach((e) => m.codes.filter((c) => REQUIRED.includes(c)).forEach((code) => {
          nTotal++;
          const c = e.certs.find((y) => y.code === code || (StaffAgent.SHORT[code] === y.type));
          const pending = subs.some((sb) => sb.staffId === e.id && sb.code === code);
          const bad = !c || c.missing || c.days < 0;
          if (pending) nPend++;
          else if (bad) { nBad++; names.push(first(e.name) + " (" + StaffAgent.TYPE[code] + (!c || c.missing ? ", missing" : ", expired " + c.expiry) + ")"); }
          else if (c.days <= 30) nSoon++;
        }));
        cur = "Staff register: " + nTotal + " credentials tracked";
        if (!nTotal) { status = "missing"; reason = "No staff credentials of this type are on the register."; }
        else if (nBad) { status = "missing"; flags.push("overdue"); reason = "Expired or missing: " + names.join("; ") + "."; }
        else if (nPend) { status = "under_review"; flags.push("awaiting_verification"); reason = nPend + " renewed certificate" + (nPend === 1 ? " is" : "s are") + " waiting for verification."; }
        else { status = "compliant"; reason = "Every credential on the register is current."; }
        if (nSoon) { flags.push("expiring"); reason += " " + nSoon + " expire" + (nSoon === 1 ? "s" : "") + " within 30 days; the staff agent is chasing the renewals."; }
      } else if (m.kind === "medical") {
        const p = typeof medicalSubmission !== "undefined" && medicalSubmission && medicalSubmission.status === "pending";
        cur = "Medical profiles: reviewed";
        if (p) { status = "under_review"; flags.push("awaiting_verification"); reason = "1 parent medical update is waiting for review."; nPend = 1; }
        else { status = "compliant"; reason = "All medical updates are reviewed."; }
      } else if (m.kind === "incidents") {
        status = "compliant"; cur = "Incident register: 3 records"; reason = "Every incident notice was sent on time.";
      } else {
        status = "compliant"; cur = "12 active child records"; reason = "Every child has a parent and emergency contact on file.";
      }
      if (s.reviewRequired) { flags.push("review_required"); if (status === "compliant") status = "under_review"; reason = (s.reviewNote || "Review required after a guidance update") + ". " + reason; }
      const od = linkedOverdue(key);
      if (od) { flags.push("task_overdue"); reason += " The scheduled " + od.title.toLowerCase() + " was due " + fmtDate(od.due_date) + "."; }

      let prio, prioReason;
      if (status === "missing") {
        prio = CRITICAL.includes(key) ? "critical" : "high";
        prioReason = prio === "critical" ? "Critical: this is a child-safety requirement and the evidence is " + (flags.includes("overdue") ? "out of date" : "missing") + "."
          : "High: an officer can ask for this evidence and it is " + (flags.includes("overdue") ? "out of date" : "missing") + ".";
      } else if (status === "under_review") {
        if (flags.includes("overdue") && CRITICAL.includes(key)) { prio = "high"; prioReason = "High: a child-safety requirement is only covered once the new evidence is verified."; }
        else if (flags.includes("review_required")) { prio = "medium"; prioReason = "Medium: a guidance change may affect this requirement and needs your decision."; }
        else { prio = "medium"; prioReason = "Medium: evidence is waiting for verification."; }
      } else if (flags.includes("review_due") || flags.includes("expiring")) { prio = "medium"; prioReason = "Medium: compliant now, but evidence expires soon."; }
      else { prio = "low"; prioReason = "Low: compliant with verified evidence."; }
      if (od && (prio === "medium" || prio === "low")) { prio = "high"; prioReason = "High: the scheduled " + od.title.toLowerCase() + " is overdue."; }

      const t = openTask(id, ["evidence", "owner_action"]);
      let next;
      if (flags.includes("review_required")) {
        const rv = S.reviews.filter((r) => r.itemId === id && (!r.decision || (r.decision === "update_needed" && !r.completedAt))).pop();
        const u = rv && S.updates.find((y) => y.id === rv.updateId);
        next = rv && rv.decision === "update_needed" ? "Upload the updated policy that reflects “" + u.title + "”, then verify it." : u ? "Review “" + u.title + "” and record whether the policy needs to change." : "Review the guidance change and record your decision.";
      } else if (pend && m.kind === "document") next = "Check and verify “" + pend.title + "”.";
      else if (m.kind === "document" && status === "missing") next = t && t.assigneeId ? "Waiting for " + first(staffName(t.assigneeId)) + " to upload it" + (t.nextFollowUp ? " (follow-up " + fmtDate(t.nextFollowUp) + ")" : "") + "." : "Upload " + lc(m.hint) + ".";
      else if (m.kind === "document" && flags.includes("review_due")) next = t && t.assigneeId ? "Renewal requested from " + first(staffName(t.assigneeId)) + "." : "Upload a renewed version before " + fmtDate(exp) + ".";
      else if (m.kind === "certificates" && status !== "compliant") next = nBad ? "The staff agent is chasing the renewals. Decide on its escalations in Staff certifications." : "Verify the uploaded certificate" + (nPend === 1 ? "" : "s") + " in Staff certifications.";
      else if (m.kind === "certificates" && nSoon) next = "Nothing for you yet: the staff agent is chasing " + nSoon + " renewal" + (nSoon === 1 ? "" : "s") + ".";
      else if (m.kind === "medical" && status !== "compliant") next = "Review the waiting medical update.";
      else next = exp ? "None. Next renewal due by " + fmtDate(exp) + "." : "None. beehive keeps watching.";
      if (od) next += m.kind === "document" && status !== "compliant" ? " Verifying it also completes the overdue " + od.title.toLowerCase() + "." : " Also complete the overdue " + od.title.toLowerCase() + ".";
      return { status, label: LABEL[status], flags, reason: reason.trim(), priority: prio, priorityReason: prioReason, why: WHY[key] || "", nextAction: next,
               currentEvidence: cur, lastReviewed: s.lastReviewedAt || last, evidenceDate: ev ? ev.recordedOn : null, evidenceExpires: exp,
               pendingEvidenceId: pend ? pend.id : null, openTaskId: t ? t.id : null };
    }

    function send(t, kind, note) {
      const x = itemById(t.itemId), m = meta(x);
      const name = staffName(t.assigneeId), contact = typeof StaffAgent !== "undefined" ? StaffAgent.contactFor(t.assigneeId) || {} : {};
      const channel = contact.email ? "email" : contact.phone ? "sms" : "none", to = contact.email || contact.phone || "";
      const subject = kind === "request" ? "Please upload: " + x.title : kind === "follow_up" ? "Reminder: " + x.title : "Please upload again: " + x.title;
      const body = "Hi " + first(name) + ", " + (kind === "request" ? "for our audit records we need " + lc(m.hint) + " (" + x.source + "). Please upload it" + (t.dueDate ? " by " + fmtDate(t.dueDate) : "") + " using your secure link."
        : kind === "follow_up" ? "we still need " + lc(m.hint) + ". Please upload it using your secure link."
        : "the evidence you uploaded for " + x.title.toLowerCase() + " couldn’t be accepted" + (note ? " (" + note + ")" : "") + ". Please upload a corrected version using your secure link.") +
        " Thanks, " + first(typeof OWNER_NAME !== "undefined" ? OWNER_NAME : "Sara") + ", " + (typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "the centre") + ".";
      const next = addDays(today(), FOLLOW[t.priority] || 7);
      const msg = { id: uid(), taskId: t.id, staffId: t.assigneeId, kind, channel, recipient: to, subject, body, link: "#evidence/" + t.token, outcome: channel === "none" ? "no_contact" : "simulated", at: now(), nextFollowUp: next };
      S.messages.push(msg);
      t.requestsSent++; t.lastRequestAt = msg.at; t.nextFollowUp = next; t.updatedAt = msg.at;
      if (t.state !== "owner_review") t.state = "waiting";
      event(t.itemId, t.id, null, kind === "request" ? "evidence_requested" : kind === "follow_up" ? "evidence_follow_up" : "evidence_correction", "Action taken",
        (kind === "request" ? "Evidence requested from " : kind === "follow_up" ? "Follow-up sent to " : "Corrected evidence requested from ") + first(name),
        { channel, recipient: to, simulated: true, next_follow_up: next });
      return msg;
    }
    function newTask(o) {
      const t = Object.assign({ id: uid(), itemId: null, kind: "evidence", title: "", reason: "", recommended: "", priority: "medium", state: "waiting", assigneeId: null, dueDate: null,
        nextFollowUp: null, requestsSent: 0, lastRequestAt: null, escalatedAt: null, evidenceId: null, updateId: null, recordTitle: null, token: "demo-" + uid(), openedAt: now(), updatedAt: now(), resolvedAt: null, resolution: null }, o);
      S.tasks.push(t);
      return t;
    }
    function resolve(t, why) { t.state = "resolved"; t.resolvedAt = now(); t.resolution = why; t.updatedAt = now(); }
    function defaultAssignee(key) {
      if (!["evacuation", "premises"].includes(key)) return null;
      const lead = staffList().find((e) => /^lead/i.test(e.role || ""));
      return lead ? lead.id : null;
    }

    function assessRegulation(u) {
      const text = (u.title + " " + u.summary).toLowerCase();
      let n = 0, titles = [];
      (typeof items !== "undefined" ? items : []).forEach((x) => {
        const key = keyOf(x);
        let impact = null, reason = "";
        if ((u.terms || []).some((t) => key === t || x.title.toLowerCase().includes(t))) { impact = "likely"; reason = "The update is about " + x.title.toLowerCase() + ", which your checklist covers."; }
        else if (text.includes(key) || (key === "sleep" && /sleep|rest/.test(text)) || (key === "sun" && /sun |uv/.test(text)) || (key === "evacuation" && /evacuat|emergency drill/.test(text))) { impact = "possible"; reason = "The update mentions " + x.title.toLowerCase() + ", so it may be relevant."; }
        if (!impact) return;
        S.reviews.push({ id: uid(), updateId: u.id, itemId: x.id, impact, reason, recommended: "Compare your current " + x.title.toLowerCase() + " evidence with the new guidance. Record “no change needed” if it already complies, or upload an updated version if it doesn’t.", decision: null, note: "", decidedAt: null, completedAt: null });
        const s = st(x.id); s.reviewRequired = true; s.reviewNote = "Review required: " + u.title;
        const t = newTask({ itemId: x.id, kind: "regulation_review", title: "Review " + x.title + " against “" + u.title + "”", reason, recommended: "Read the update, compare it with your current evidence and record your decision. beehive won’t change the policy or the status for you.", priority: "medium", state: "owner_review", updateId: u.id, dueDate: addDays(today(), 14) });
        event(x.id, t.id, u.id, "review_required", "Owner review", "Review required: " + x.title, { impact, reason, update: u.title });
        titles.push(x.title); n++;
      });
      if (!n) {
        S.reviews.push({ id: uid(), updateId: u.id, itemId: null, impact: "unclear", reason: "beehive couldn’t match this update to a requirement in your checklist.", recommended: "Read the update and confirm whether it applies to your centre.", decision: null });
        newTask({ kind: "regulation_review", title: "Confirm whether “" + u.title + "” applies", reason: "No checklist requirement clearly matches this update, so the impact is uncertain.", recommended: "Read the update and record whether it applies.", state: "owner_review", updateId: u.id });
      }
      u.status = "assessed"; u.assessedAt = now();
      u.assessment = n ? "May affect " + n + " requirement" + (n === 1 ? "" : "s") + ": " + titles.join(", ") + ". This identifies a potentially relevant change; it doesn’t confirm your policy must change." : "Impact unclear: no requirement clearly matches. Flagged for your review.";
      event(null, null, u.id, "regulation_assessed", "Action taken", "Regulation change assessed: " + u.title, { affected: n, items: titles.join(", ") });
    }

    function run(trigger, cause) {
      const out = { gaps: 0, status_changes: 0, requests: 0, follow_ups: 0, tasks: 0, resolved: 0, regulation_updates: 0, escalated: 0 };
      if (typeof approved === "undefined" || !approved) { return { skipped: "checklist not approved" }; }
      const startAt = S.events.length;
      S.updates.filter((u) => u.status === "new").forEach((u) => { assessRegulation(u); out.regulation_updates++; });
      const d = today();
      items.forEach((x) => {
        const s = st(x.id), r = status(x), m = meta(x), key = keyOf(x);
        if (s.agentStatus == null) {
          if (r.status !== "compliant") { event(x.id, null, null, "gap_detected", "Monitoring", (r.status === "missing" ? "Gap detected: " : "Needs review: ") + x.title, { status: r.status, reason: r.reason, priority: r.priority, priority_reason: r.priorityReason, why: r.why, next_action: r.nextAction }); out.gaps++; }
        } else if (s.agentStatus !== r.status) {
          event(x.id, null, null, "status_changed", r.status === "compliant" ? "Resolved" : "Monitoring", LABEL[s.agentStatus] + " → " + LABEL[r.status] + ": " + x.title, { from: s.agentStatus, to: r.status, reason: r.reason, priority: r.priority, priority_reason: r.priorityReason });
          out.status_changes++;
        }
        s.agentStatus = r.status; s.agentPriority = r.priority;
        if (m.kind === "document") {
          let t = openTask(x.id, ["evidence"]);
          if (r.pendingEvidenceId) {
            if (!t) { newTask({ itemId: x.id, title: "Verify evidence for " + x.title, reason: r.reason, recommended: "Check the uploaded evidence against the requirement and verify or reject it.", priority: r.priority === "low" ? "medium" : r.priority, state: "owner_review", evidenceId: r.pendingEvidenceId }); out.tasks++; }
            else { t.state = "owner_review"; t.evidenceId = r.pendingEvidenceId; }
          } else if (r.status === "missing" || (r.status === "compliant" && r.flags.includes("review_due") && r.evidenceExpires <= addDays(d, 14))) {
            if (!t) {
              const who = defaultAssignee(key);
              t = newTask({ itemId: x.id, title: (r.status === "missing" ? "Collect evidence for " : "Renew evidence for ") + x.title, reason: r.reason, recommended: "Upload " + lc(m.hint) + ".",
                priority: r.priority === "low" ? "medium" : r.priority, assigneeId: who, dueDate: r.status === "missing" ? addDays(d, (FOLLOW[r.priority] || 7) + 2) : r.evidenceExpires });
              out.tasks++;
              if (who) { send(t, "request"); out.requests++; }
              else event(x.id, t.id, null, "action_proposed", "Waiting", "Proposed for you: upload evidence for " + x.title, { next_action: t.recommended, priority: t.priority, proposed: true });
            } else {
              if (r.priority !== "low") t.priority = r.priority;
              if (t.state === "owner_review" && !t.escalatedAt) { t.state = "waiting"; t.evidenceId = null; }
              if (t.assigneeId && t.nextFollowUp && t.nextFollowUp <= d) {
                if (t.requestsSent >= 3 && !t.escalatedAt) {
                  t.escalatedAt = now(); t.state = "owner_review"; t.recommended = "Speak to " + first(staffName(t.assigneeId)) + " or assign the task to someone else.";
                  event(x.id, t.id, null, "escalated", "Owner review", "Escalated to you: " + x.title, { reason: "No response after " + t.requestsSent + " requests." }); out.escalated++;
                } else if (!t.escalatedAt) { send(t, "follow_up"); out.follow_ups++; }
              }
            }
          } else if (t && r.status === "compliant") { resolve(t, "Verified evidence on file"); event(x.id, t.id, null, "resolved", "Resolved", "Gap closed: " + x.title, { reason: r.reason }); out.resolved++; }
        } else if (["medical", "incidents", "children"].includes(m.kind)) {
          const t = openTask(x.id, ["owner_action"]);
          if (r.status !== "compliant" && !t) {
            const nt = newTask({ itemId: x.id, kind: "owner_action", title: x.title + ": " + lc(r.nextAction), reason: r.reason, recommended: r.nextAction, priority: r.priority === "low" ? "medium" : r.priority });
            event(x.id, nt.id, null, "action_proposed", "Waiting", "Proposed for you: " + lc(r.nextAction), { reason: r.reason, proposed: true }); out.tasks++;
          } else if (r.status === "compliant" && t) { resolve(t, r.reason); event(x.id, t.id, null, "resolved", "Resolved", "Gap closed: " + x.title, { reason: r.reason }); out.resolved++; }
        }
      });
      // overdue recurring tasks
      compTasks().filter((c) => c.state === "overdue").forEach((c) => {
        if (S.tasks.some((t) => t.kind === "overdue_task" && t.recordTitle === c.title && t.state !== "resolved")) return;
        const it = items.find((x) => TASK_PATTERN[keyOf(x)] && TASK_PATTERN[keyOf(x)].test(c.title));
        const t = newTask({ itemId: it ? it.id : null, kind: "overdue_task", title: "Complete the overdue " + c.title.toLowerCase(), recordTitle: c.title,
          reason: "Due " + fmtDate(c.due_date) + " (" + c.regulation_reference + "). Overdue scheduled tasks are one of the first things an officer checks.", recommended: "Do it, record it on the Compliance page and attach any evidence.", priority: "high", dueDate: c.due_date });
        event(t.itemId, t.id, null, "task_overdue", "Waiting", "Overdue: " + c.title, { due_date: c.due_date, proposed: true }); out.tasks++;
      });
      S.tasks.filter((t) => t.kind === "overdue_task" && t.state !== "resolved").forEach((t) => {
        if (!compTasks().some((c) => c.title === t.recordTitle && c.state === "overdue")) { resolve(t, "Task completed"); event(t.itemId, t.id, null, "resolved", "Resolved", "Done: " + t.recordTitle, {}); out.resolved++; }
      });
      // say what caused the changes this run recorded (for example the credential that was renewed)
      if (cause) S.events.slice(startAt).filter((e) => ["status_changed", "resolved", "gap_detected"].includes(e.kind)).forEach((e) => {
        e.detail = Object.assign({}, e.detail, { cause: cause.text }); e.staffId = cause.staffId || null; e.code = cause.code || null; e.staffName = cause.staffName || "";
      });
      S.runs.push({ at: now(), trigger, summary: out });
      if (S.runs.length > 50) S.runs.shift();
      save();
      return Object.assign({ ran_at: now() }, out);
    }

    function submit(itemId, f) {
      const x = itemById(itemId), m = meta(x), ext = f.extracted || {}, d = today();
      if (f.hash) {
        const dup = S.evidence.filter((e) => e.itemId === itemId && e.hash === f.hash && (e.status === "pending" || e.status === "verified")).pop();
        if (dup) throw new Error("This file was already uploaded on " + fmtDate(dup.createdAt) + " and is " + (dup.status === "pending" ? "waiting for verification." : "already verified."));
      }
      const checks = [], doc = ext.document_date || null, date = f.date || doc;
      if (!ext.readable) checks.push({ field: "document", issue: "unreadable", message: "beehive couldn’t read this file. Check it’s the right document before verifying." });
      else {
        if (ext.topic_match === false) checks.push({ field: "topic", issue: "mismatch", message: "This doesn’t look like " + lc(m.hint) + "." });
        if (!doc) checks.push({ field: "date", issue: "missing", message: "No date found in the document, so beehive can’t tell if it’s current." });
      }
      let exp = null;
      if (date && date > d) checks.push({ field: "date", issue: "future", message: "The date (" + fmtDate(date) + ") is in the future." });
      if (date) { exp = addMonths(date, m.months); if (exp < d) checks.push({ field: "date", issue: "out_of_date", message: "Dated " + fmtDate(date) + ", so it expired on " + fmtDate(exp) + " and wouldn’t close the gap." }); }
      if (f.date && doc && f.date !== doc) checks.push({ field: "date", issue: "differs", message: "The date entered (" + fmtDate(f.date) + ") differs from the date in the document (" + fmtDate(doc) + ")." });
      (ext.uncertain || []).forEach((u) => checks.push({ field: "document", issue: "uncertain", message: u }));
      const flag = !ext.readable ? "unreadable" : checks.length ? "needs_check" : "clear";
      const resolves = flag === "clear" && !!date && exp >= d;
      S.evidence.filter((e) => e.itemId === itemId && e.status === "pending").forEach((e) => { e.status = "superseded"; e.reviewNote = "Replaced by a newer upload"; });
      const ev = { id: uid(), itemId, title: f.title || f.fileName || "Evidence", fileName: f.fileName || "", fileData: f.fileData || null, hash: f.hash || "", recordedOn: date || d, status: "pending",
        extracted: ext, checks, flag, source: f.source || "owner", createdAt: now(), verifiedAt: null, reviewNote: "", note: date ? "" : "Date not confirmed" };
      S.evidence.push(ev);
      let t = openTask(itemId, ["evidence"]);
      if (!t) t = newTask({ itemId, title: "Verify evidence for " + x.title, reason: "New evidence uploaded.", recommended: "Check the uploaded evidence and verify or reject it.", state: "owner_review", evidenceId: ev.id });
      else { t.state = "owner_review"; t.evidenceId = ev.id; }
      event(itemId, t.id, null, "evidence_received", "Owner review", "Evidence received: " + x.title, { evidence_id: ev.id, source: ev.source, file_name: ev.fileName, date });
      event(itemId, t.id, null, "evidence_assessed", "Owner review", resolves ? "Would close the gap once verified" : flag === "unreadable" ? "Evidence unreadable: needs checking" : "Evidence needs checking", { evidence_id: ev.id, checks, resolves, expires: exp });
      run("evidence");
      return { id: ev.id, flag, checks, resolves, expires: exp };
    }

    function verify(evId, approve, date, reason) {
      const ev = S.evidence.find((e) => e.id === evId);
      if (!ev) throw new Error("Evidence not found");
      if (ev.status !== "pending") throw new Error("This evidence has already been " + (ev.status === "verified" ? "verified." : ev.status === "rejected" ? "rejected." : "replaced by a newer upload."));
      const x = itemById(ev.itemId), m = meta(x), s = st(ev.itemId), t = openTask(ev.itemId, ["evidence"]);
      const before = status(x).status;
      let exp = null;
      if (approve) {
        const dt = date || ev.recordedOn;
        if (!dt) throw new Error("Enter the document date before verifying.");
        if (dt > today()) throw new Error("The document date can’t be in the future.");
        exp = addMonths(dt, m.months);
        if (exp < today()) throw new Error("Evidence dated " + fmtDate(dt) + " expired on " + fmtDate(exp) + ", so it can’t make this requirement compliant. Reject it and ask for a current version.");
        ev.status = "verified"; ev.recordedOn = dt; ev.verifiedAt = now(); ev.reviewNote = reason || "";
        s.lastReviewedAt = now();
        completeLinked(keyOf(x), "Evidence verified: " + ev.title);
        const open = S.reviews.filter((r) => r.itemId === ev.itemId && r.decision === "update_needed" && !r.completedAt);
        if (open.length) { open.forEach((r) => (r.completedAt = now())); if (!S.reviews.some((r) => r.itemId === ev.itemId && !r.decision)) { s.reviewRequired = false; s.reviewNote = ""; } }
        event(ev.itemId, t && t.id, null, "evidence_verified", "Resolved", "Evidence verified: " + x.title, { evidence_id: ev.id, date: dt, valid_until: exp, verified_at: now() });
      } else {
        if (!String(reason || "").trim()) throw new Error("Say why the evidence is being rejected.");
        ev.status = "rejected"; ev.reviewNote = reason; ev.verifiedAt = now();
        event(ev.itemId, t && t.id, null, "evidence_rejected", "Action taken", "Evidence rejected: " + x.title, { evidence_id: ev.id, reason });
        if (t) { t.state = "waiting"; t.evidenceId = null; if (t.assigneeId) send(t, "correction", reason); }
      }
      run("verification");
      return { approved: approve, before, after: status(x).status, valid_until: exp };
    }
    function completeLinked(key, note) {
      const re = TASK_PATTERN[key];
      if (re && typeof Library !== "undefined" && Library.completeMatching) Library.completeMatching(re, note);
    }
    function record(itemId, title, date, details) {
      const x = itemById(itemId), m = meta(x);
      if (!date || date > today()) throw new Error("Enter the date it happened.");
      if (addMonths(date, m.months) < today()) throw new Error("That date is too old to count for this requirement.");
      S.evidence.filter((e) => e.itemId === itemId && e.status === "pending").forEach((e) => { e.status = "superseded"; e.reviewNote = "Replaced by an owner record"; });
      const ev = { id: uid(), itemId, title, recordedOn: date, status: "verified", verifiedAt: now(), createdAt: now(), source: "owner_record", details: details || {}, note: "Recorded and attested by the owner", checks: [], flag: "clear" };
      S.evidence.push(ev);
      st(itemId).lastReviewedAt = now();
      completeLinked(keyOf(x), title);
      event(itemId, null, null, "evidence_recorded", "Resolved", "Recorded by you: " + title, { evidence_id: ev.id, date, details });
      run("evidence");
      return { id: ev.id };
    }
    function decide(reviewId, decision, note) {
      const rv = S.reviews.find((r) => r.id === reviewId);
      if (!rv) throw new Error("Review not found");
      if (rv.decision) throw new Error("You already recorded a decision for this.");
      const u = S.updates.find((y) => y.id === rv.updateId), x = rv.itemId ? itemById(rv.itemId) : null;
      rv.decision = decision; rv.note = note || ""; rv.decidedAt = now(); rv.completedAt = decision === "update_needed" ? null : now();
      S.tasks.filter((t) => t.kind === "regulation_review" && t.updateId === u.id && t.state !== "resolved" && t.itemId === rv.itemId)
        .forEach((t) => resolve(t, decision === "no_change" ? "Reviewed: no change needed" : decision === "not_applicable" ? "Doesn’t apply to this centre" : "Policy needs updating"));
      if (x) {
        const s = st(x.id);
        if (decision === "update_needed") {
          s.reviewNote = "Update needed after “" + u.title + "”";
          const kind = meta(x).kind;
          if (kind === "document") {
            if (!openTask(x.id, ["evidence"])) newTask({ itemId: x.id, title: "Update " + x.title, reason: "You decided the policy needs updating after “" + u.title + "”.", recommended: "Update the policy, upload it and verify it. The requirement stays under review until then.", dueDate: addDays(today(), 30), updateId: u.id });
          } else if (!S.tasks.some((t) => t.kind === "regulation_action" && t.updateId === u.id && t.itemId === x.id && t.state !== "resolved")) {
            // checked from beehive's own records: an owner action in the workflow that owns those records
            newTask({ itemId: x.id, kind: "regulation_action", title: "Put “" + u.title + "” into practice: " + x.title, reason: "You decided practices need to change after “" + u.title + "”.",
              recommended: REG_ACTION[kind] || "Make the change, then mark this done.", dueDate: addDays(today(), 30), updateId: u.id });
          }
        } else if (!S.reviews.some((r) => r.itemId === x.id && r.id !== rv.id && (!r.decision || (r.decision === "update_needed" && !r.completedAt)))) {
          s.reviewRequired = false; s.reviewNote = ""; if (decision === "no_change") s.lastReviewedAt = now();
        }
      }
      event(x ? x.id : null, null, u.id, "regulation_decision", decision === "update_needed" ? "Waiting" : "Resolved",
        (decision === "no_change" ? "You confirmed no change needed: " : decision === "not_applicable" ? "You marked as not applicable: " : "You decided an update is needed: ") + (x ? x.title : u.title), { decision, note, update: u.title });
      if (!S.reviews.some((r) => r.updateId === u.id && !r.decision)) {
        u.status = "reviewed"; u.reviewedAt = now();
        event(null, null, u.id, "regulation_reviewed", "Resolved", "Regulation review recorded: " + u.title, {});
      }
      run("regulation_decision");
      return { decision, update_status: u.status };
    }
    function complete(taskId, note) {
      const t = S.tasks.find((y) => y.id === taskId);
      if (!t) throw new Error("Task not found");
      if (t.state === "resolved") throw new Error("This task is already complete.");
      if (t.kind !== "regulation_action") throw new Error("This task closes by itself once the records show it’s done.");
      const u = S.updates.find((y) => y.id === t.updateId) || {}, x = t.itemId ? itemById(t.itemId) : null;
      resolve(t, "Done" + (note ? ": " + note : ""));
      S.reviews.filter((r) => r.updateId === t.updateId && r.itemId === t.itemId && r.decision === "update_needed" && !r.completedAt).forEach((r) => { r.completedAt = now(); if (note) r.note = (r.note + " " + note).trim(); });
      if (x && !S.reviews.some((r) => r.itemId === x.id && (!r.decision || (r.decision === "update_needed" && !r.completedAt)))) { const s = st(x.id); s.reviewRequired = false; s.reviewNote = ""; s.lastReviewedAt = now(); }
      event(t.itemId, t.id, t.updateId, "regulation_action_done", "Resolved", "You put “" + (u.title || "the change") + "” into practice: " + (x ? x.title : ""), { note });
      run("regulation_action");
      return { done: true };
    }
    // offline demo: a new update arrives (signed in, the AI agent adds updates through its API)
    function addUpdate(o) {
      const u = { id: "reg-" + uid(), title: o.title, summary: o.summary, status: "new", published: today(), terms: o.terms || [], source: o.source || "", demo: true };
      S.updates.unshift(u);
      run("regulation_update");
      return u;
    }
    function assign(taskId, staffId) {
      const t = S.tasks.find((y) => y.id === taskId);
      if (!t || t.state === "resolved") throw new Error("This task is already complete.");
      t.assigneeId = staffId || null; t.escalatedAt = null; t.requestsSent = 0; t.nextFollowUp = null; t.state = t.evidenceId ? "owner_review" : "waiting";
      if (staffId) send(t, "request");
      else event(t.itemId, t.id, null, "action_proposed", "Waiting", "Assigned to you: " + itemById(t.itemId).title, { proposed: true });
      save();
    }
    function sendNow(taskId) {
      const t = S.tasks.find((y) => y.id === taskId);
      if (!t || t.state === "resolved") throw new Error("This task is already complete.");
      if (!t.assigneeId) throw new Error("Assign the task to a staff member first.");
      const msg = send(t, t.requestsSent ? "follow_up" : "request"); save(); return msg;
    }
    function linkInfo(token) {
      const t = S.tasks.find((y) => y.token === token && y.state !== "resolved" && y.kind === "evidence");
      if (!t) return null;
      const x = itemById(t.itemId), m = meta(x);
      return { first_name: first(staffName(t.assigneeId)) || first(typeof OWNER_NAME !== "undefined" ? OWNER_NAME : ""), centre: typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "", item_id: x.id, title: x.title,
               evidence_hint: m.hint, source_ref: x.source, review_months: m.months, item_key: keyOf(x), due_date: t.dueDate, pending: S.evidence.some((e) => e.itemId === x.id && e.status === "pending") };
    }

    function seed() {
      const d = today();
      S = { v: 1, seq: 0, items: {}, evidence: [], tasks: [], reviews: [], updates: [], events: [], messages: [], runs: [] };
      const add = (key, title, days) => { const x = (typeof items !== "undefined" ? items : []).find((y) => keyOf(y) === key); if (x) S.evidence.push({ id: uid(), itemId: x.id, title, recordedOn: addDays(d, -days), status: "verified", verifiedAt: new Date(Date.now() - (days - 1) * 864e5).toISOString(), createdAt: new Date(Date.now() - days * 864e5).toISOString(), source: "seed", note: "Demo record", checks: [], flag: "clear", demo: true }); };
      add("evacuation", "Evacuation drill: all rooms, 4 min 10 s", 100);
      add("premises", "Weekly premises and playground safety checklist", 5);
      add("emergency", "Emergency procedures, contacts and floor plan (displayed)", 150);
      add("sun", "Sun Protection Policy (reviewed)", 345);
      add("sleep", "Sleep and Rest Policy and risk assessment", 210);
      S.updates.push({ id: "reg-safe-sleep", title: "Safe sleep guidance review", status: "new", published: addDays(d, -7), terms: ["sleep"], source: "https://www.acecqa.gov.au/QA2-information-sheet-sleep-and-rest-legislative-requirements",
        summary: "New safe sleep guidance may affect the centre’s Sleep and Rest Policy. Review current sleep and rest procedures against the latest official guidance and your service’s approved policy." });
      save();
    }
    function load() {
      try { S = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { S = null; }
      if (!S || S.v !== 1) seed();
      return S;
    }
    function reset() { try { localStorage.removeItem(STORE); } catch (e) {} S = null; }
    function view() {
      const staffName2 = staffName;
      const tasks = S.tasks.map((t) => {
        const x = t.itemId ? itemById(t.itemId) : null, u = t.updateId ? S.updates.find((y) => y.id === t.updateId) : null;
        const lm = S.messages.filter((m) => m.taskId === t.id).pop();
        return Object.assign({}, t, { itemTitle: x ? x.title : "", assigneeName: staffName2(t.assigneeId), updateTitle: u ? u.title : "", lastMessageAt: lm && lm.at, lastChannel: lm && lm.channel, lastKind: lm && lm.kind });
      });
      return { tasks, evidence: S.evidence.slice(), reviews: S.reviews.slice(), updates: S.updates.slice(), events: S.events.slice(-200).reverse(), messages: S.messages.slice().reverse(), lastRun: S.runs[S.runs.length - 1] || null };
    }
    return { load, run, status, submit, verify, record, decide, complete, addUpdate, assign, sendNow, linkInfo, view, reset, approvedRun: () => run("checklist_approved") };
  })();

  // =====================================================================================
  // Loading
  // =====================================================================================
  function applyOffline() {
    data = Object.assign({ available: true, mode: "offline", error: "" }, Engine.view());
    if (typeof items === "undefined") return;
    items.forEach((x) => {
      const r = Engine.status(x);
      x.req = r;
      x.status = COLOR_OF[r.status];
      x.risk = r.reason;
      x.evidence = r.currentEvidence;
      x.updated = r.lastReviewed ? "Verified " + fmtDate(String(r.lastReviewed).slice(0, 10)) : r.status === "missing" ? "No verified evidence" : "From beehive’s records";
    });
    if (typeof persist === "function") persist();
  }
  function loadOffline() {
    Engine.load();
    const r = approvedNow() ? Engine.run("app") : null;
    applyOffline();
    return r;
  }
  const approvedNow = () => typeof approved !== "undefined" && approved;
  function runOffline(cause) { Engine.load(); const r = Engine.run("app", cause); applyOffline(); return r; }
  async function runRemote(quiet) {
    if (!leader()) return null; // only the owner or director runs the agent; educators just read their own tasks
    try { const r = await Live.client().rpc("run_audit_agent"); return r.error ? null : r.data; } catch (e) { return null; }
  }
  async function loadLive(sb) {
    const isLead = leader();
    try {
      const sel = (p) => p.then((r) => { if (r.error) throw r.error; return r.data || []; });
      const [tasks, ev, pend, ups, revs, feed, msgs, runs, staff] = await Promise.all([
        sel(sb.from("v_audit_tasks").select("*").order("opened_at", { ascending: false }).limit(300)),
        isLead ? sel(sb.from("evidence").select("id, checklist_item_id, title, file_name, file_path, recorded_on, status, verified_at, checks, review_flag, extracted, source, created_at, review_note, details, note").order("created_at", { ascending: false }).limit(300)) : Promise.resolve([]),
        isLead ? sel(sb.from("evidence").select("id, file_data").eq("status", "pending")) : Promise.resolve([]),
        isLead ? sel(sb.from("regulation_updates").select("*").order("published_on", { ascending: false })) : Promise.resolve([]),
        isLead ? sel(sb.from("regulation_reviews").select("*").order("created_at")) : Promise.resolve([]),
        isLead ? sel(sb.from("v_agent_feed").select("*").eq("agent", "audit").order("id", { ascending: false }).limit(150)) : Promise.resolve([]),
        sel(sb.from("agent_messages").select("*").not("audit_task_id", "is", null).order("sent_at", { ascending: false }).limit(200)),
        isLead ? sel(sb.from("agent_runs").select("*").eq("agent", "audit").order("ran_at", { ascending: false }).limit(1)) : Promise.resolve([]),
        sel(sb.from("staff").select("id, full_name, position, email, phone, user_id").eq("is_active", true).order("full_name")),
      ]);
      const fileData = Object.fromEntries(pend.map((p) => [p.id, p.file_data]));
      data = {
        available: true, mode: "live", error: "",
        staff: staff.filter((s) => !/owner/i.test(s.position || "")).map((s) => ({ id: s.id, name: s.full_name, role: s.position, userId: s.user_id })),
        tasks: tasks.map((t) => ({ id: t.id, itemId: t.checklist_item_id, kind: t.kind, title: t.title, reason: t.reason, recommended: t.recommended_action, priority: t.priority, state: t.state,
          assigneeId: t.assignee_staff_id, assigneeName: t.assignee_name, dueDate: t.due_date, nextFollowUp: t.next_follow_up, requestsSent: t.requests_sent, lastRequestAt: t.last_request_at,
          escalatedAt: t.escalated_at, evidenceId: t.evidence_id, updateId: t.regulation_update_id, updateTitle: t.update_title, recordTitle: t.compliance_title, token: t.upload_token,
          openedAt: t.opened_at, resolvedAt: t.resolved_at, resolution: t.resolution, itemTitle: t.item_title, lastMessageAt: t.last_message_at, lastChannel: t.last_channel, lastKind: t.last_kind })),
        evidence: ev.map((e) => ({ id: e.id, itemId: e.checklist_item_id, title: e.title, fileName: e.file_name, filePath: e.file_path, fileData: fileData[e.id] || null, recordedOn: e.recorded_on, status: e.status,
          verifiedAt: e.verified_at, checks: e.checks || [], flag: e.review_flag, extracted: e.extracted || {}, source: e.source, createdAt: e.created_at, reviewNote: e.review_note, details: e.details || {}, note: e.note })),
        updates: ups.map((u) => ({ id: u.id, title: u.title, summary: u.summary, status: u.status, published: u.published_on, assessment: u.assessment, source: u.source_url, assessedAt: u.assessed_at, reviewedAt: u.reviewed_at })),
        reviews: revs.map((r) => ({ id: r.id, updateId: r.regulation_update_id, itemId: r.checklist_item_id, impact: r.impact, reason: r.reason, recommended: r.recommended, decision: r.decision, note: r.note, decidedAt: r.decided_at, completedAt: r.completed_at })),
        events: feed.map((e) => ({ id: e.id, itemId: e.checklist_item_id, taskId: e.audit_task_id, updateId: e.regulation_update_id, kind: e.kind, state: e.state, summary: e.summary, detail: e.detail || {}, demo: e.demo, at: e.created_at, itemTitle: e.item_title, updateTitle: e.update_title,
          staffId: e.staff_id, staffName: e.staff_name, code: e.type_code })),
        messages: msgs.map((m) => ({ id: m.id, taskId: m.audit_task_id, staffId: m.staff_id, kind: m.kind, channel: m.channel, recipient: m.recipient, subject: m.subject, body: m.body, link: (m.upload_link || "").replace(/^\/?/, ""), outcome: m.outcome, at: m.sent_at, nextFollowUp: m.next_follow_up })),
        lastRun: runs[0] ? { at: runs[0].ran_at, summary: runs[0].summary } : null,
      };
    } catch (e) {
      const m = (e && e.message) || String(e);
      data = { available: false, mode: "live", error: /does not exist|Could not find|schema cache|column/i.test(m) ? "setup" : m, tasks: [], evidence: [], reviews: [], updates: [], events: [], messages: [], lastRun: null, staff: [] };
    }
  }

  // =====================================================================================
  // Derived views
  // =====================================================================================
  const reqOf = (x) => x.req || { status: x.status === "green" ? "compliant" : x.status === "yellow" ? "under_review" : "missing", flags: [], priority: "medium", reason: x.risk, nextAction: "", currentEvidence: x.evidence };
  const openTasks = () => data.tasks.filter((t) => t.state !== "resolved");
  const prioRank = (p) => (PRIO[p] || PRIO.low)[2];
  const medicalDecisionPending = () => typeof medicalSubmission !== "undefined" && medicalSubmission && medicalSubmission.status === "pending";
  // owner to-dos the agent proposed (not decisions): evidence only the owner holds, owner actions, overdue scheduled tasks
  function todoTasks() {
    return openTasks().filter((t) => t.state === "waiting" && !t.assigneeId)
      .filter((t) => !(t.kind === "owner_action" && medicalDecisionPending() && keyOf(itemById(t.itemId)) === "medical"))
      .sort((a, b) => prioRank(b.priority) - prioRank(a.priority));
  }
  function todoItems() {
    return todoTasks().map((t) => ({ kind: t.kind === "overdue_task" ? "Overdue task" : t.kind === "regulation_action" ? "Put a change into practice" : "Your to-do",
      who: t.kind === "regulation_action" ? t.title : t.kind === "overdue_task" ? t.recordTitle || t.recordTitleLive || t.title : t.itemTitle || t.title, detail: t.recommended || t.reason, act: "AuditAgent.openTask('" + t.id + "')", btn: "Open", todo: true }));
  }
  function counts() {
    const o = openTasks();
    const since = Date.now() - 7 * 864e5;
    return {
      handled: data.events.filter((e) => Date.parse(e.at) > since && ["Action taken", "Resolved"].includes(e.state) && !/^You /.test(e.summary)).length,
      waitingOthers: o.filter((t) => t.state === "waiting" && t.assigneeId).length,
      decisions: o.filter((t) => t.state === "owner_review").length,
      yours: todoTasks().length,
      lastRun: data.lastRun && data.lastRun.at,
    };
  }
  function score() {
    const list = typeof items !== "undefined" ? items : [];
    const c = { compliant: 0, under_review: 0, missing: 0 };
    list.forEach((x) => c[reqOf(x).status]++);
    const total = list.length || 1;
    return { pct: Math.round((100 * (c.compliant + 0.5 * c.under_review)) / total), c, total: list.length };
  }
  // Ranked gaps with the reason and the next step: the answer to "What is stopping us from being audit ready?"
  function blockers() {
    const list = (typeof items !== "undefined" ? items : []).filter((x) => reqOf(x).status !== "compliant" || reqOf(x).flags.length);
    return list.map((x) => {
      const r = reqOf(x), sc = score();
      const cost = r.status === "missing" ? 1 : r.status === "under_review" ? 0.5 : 0;
      return { x, r, cost: Math.round((100 * cost) / (sc.total || 1)) };
    }).sort((a, b) => prioRank(b.r.priority) - prioRank(a.r.priority) || b.cost - a.cost || a.x.title.localeCompare(b.x.title));
  }
  function itemAction(x) {
    const r = reqOf(x), key = keyOf(x), m = meta(x);
    if (r.pendingEvidenceId) return { label: "Verify", act: "AuditAgent.openEvidence('" + r.pendingEvidenceId + "')" };
    if (r.flags.includes("review_required")) return { label: "Review", act: "go('updates')" };
    if (m.kind === "certificates" && r.status !== "compliant") return { label: "Open", act: "go('staff')" };
    if (m.kind === "medical" && r.status !== "compliant") return { label: "Review", act: "reviewFamilyUpdate()" };
    return { label: "Open", act: "openItem('" + x.id + "')" };
  }

  // =====================================================================================
  // Presentation
  // =====================================================================================
  const statusTagHtml = (s) => '<span class="status ' + STATUS_CLASS[s] + '">' + LABEL[s] + "</span>";
  const prioTag = (p) => { const q = PRIO[p] || PRIO.low; return '<span class="status ' + q[0] + '">' + q[1] + "</span>"; };
  const flagChips = (flags) => (flags || []).map((f) => '<span class="flagChip ' + (["overdue", "task_overdue"].includes(f) ? "bad" : "") + '">' + E(FLAG[f] || f) + "</span>").join("");
  const taskStateTag = (t) => '<span class="status ' + ({ owner_review: "crit", waiting: "medium", monitoring: "monitor", resolved: "green" }[t.state]) + '">' + (t.state === "waiting" && !t.assigneeId ? "Waiting on you" : TASK_STATE[t.state]) + "</span>";

  function readinessBlock() {
    const s = score();
    return (
      '<div class="readinessBlock"><div class="readinessFigure"><b>' + s.pct + '%</b><span>audit-ready</span></div>' +
      '<div class="segBar" role="img" aria-label="' + s.c.compliant + " compliant, " + s.c.under_review + " under review, " + s.c.missing + ' missing"><i class="green" style="width:' + (100 * s.c.compliant) / (s.total || 1) + '%"></i><i class="yellow" style="width:' + (100 * s.c.under_review) / (s.total || 1) + '%"></i><i class="red" style="width:' + (100 * s.c.missing) / (s.total || 1) + '%"></i></div>' +
      '<div class="summaryLine" style="border:0;margin:0;padding:12px 0 0">' + stat(s.c.compliant, "compliant", "green") + stat(s.c.under_review, "under review", "yellow") + stat(s.c.missing, "missing", "red") + "</div>" +
      '<p class="method">How it’s worked out: compliant counts 1, under review ½, missing 0, across your ' + s.total + " approved requirements. (" + s.c.compliant + " + " + s.c.under_review + "×½) ÷ " + s.total + " = " + s.pct + "%. Only verified evidence counts as compliant.</p></div>"
    );
  }
  function blockerList(max, compact) {
    const b = blockers().filter((y) => y.r.status !== "compliant" || compact === "all");
    if (!b.length) return '<p class="empty">Nothing is stopping you. Every requirement has current, verified evidence.</p>';
    return b.slice(0, max).map(({ x, r, cost }) => {
      const a = itemAction(x);
      return (
        '<div class="blocker"><b class="blockerTitle">' + E(x.title) + '</b><div class="blockerHead">' + prioTag(r.priority) + statusTagHtml(r.status) + (cost ? '<span class="muted num">costs ' + cost + "% of readiness</span>" : "") + "</div>" +
        "<p>" + E(r.reason) + "</p>" +
        (compact ? "" : '<p class="why"><b>Why it matters:</b> ' + E(r.why) + " " + E(r.priorityReason) + "</p>") +
        '<p class="next"><b>Next:</b> ' + E(r.nextAction) + "</p>" +
        '<div class="buttonRow"><button class="button small" onclick="closeModal();' + a.act + '">' + a.label + "</button>" +
        (a.label !== "Open" ? '<button class="textButton" onclick="closeModal();openItem(\'' + x.id + '\')">Requirement</button>' : "") + "</div></div>"
      );
    }).join("");
  }
  function blockersSummaryText() {
    const b = blockers().filter((y) => y.r.status !== "compliant");
    const s = score();
    if (!b.length) return "Nothing. All " + s.total + " requirements have current, verified evidence.";
    const crit = b.filter((y) => y.r.priority === "critical").length;
    return "You’re " + s.pct + "% audit-ready. " + b.length + " requirement" + (b.length === 1 ? " isn’t" : "s aren’t") + " compliant" + (crit ? ", " + crit + " of them critical" : "") + ".";
  }
  function openBlockers() {
    const ov = openTasks().filter((t) => t.kind === "overdue_task");
    openModal(
      '<div class="modalHead"><div><h2>What’s stopping us from being audit ready?</h2><p>' + E(blockersSummaryText()) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      blockerList(20) +
      (ov.length ? '<div class="modalSection"><h3>Overdue scheduled tasks</h3>' + ov.map((t) => '<button class="row" onclick="closeModal();go(\'compliance\')"><span class="rowMain"><b>' + E(t.recordTitle || t.title) + "</b><small>" + E(t.reason) + "</small></span>" + prioTag(t.priority) + "</button>").join("") + "</div>" : "") +
      '<p class="footnote">Ranked by priority, then by how much each gap costs your readiness score. Built from your requirements, evidence and tasks as they are now.</p>',
      "wide",
    );
  }

  // ---------- Audit readiness page ----------
  const ATT = [["verify", "To verify"], ["overdue", "Overdue"], ["upcoming", "Upcoming"], ["actions", "Open actions"]];
  function attention() {
    const o = openTasks();
    const verify = o.filter((t) => t.state === "owner_review");
    const overdue = (typeof items !== "undefined" ? items : []).filter((x) => reqOf(x).flags.some((f) => f === "overdue" || f === "task_overdue"));
    const upcoming = (typeof items !== "undefined" ? items : []).filter((x) => reqOf(x).status === "compliant" && reqOf(x).flags.some((f) => f === "review_due" || f === "expiring"))
      .concat([]).sort((a, b) => String(reqOf(a).evidenceExpires || "9").localeCompare(String(reqOf(b).evidenceExpires || "9")));
    const actions = o.filter((t) => t.state !== "owner_review");
    return { verify, overdue, upcoming, actions };
  }
  function taskRow(t) {
    const who = t.assigneeId ? (t.assigneeName || "staff") : "you";
    const sub = t.state === "owner_review" ? t.reason : t.assigneeId ? "Asked " + first(who) + (t.lastMessageAt ? " " + relTime(t.lastMessageAt).toLowerCase() : "") + (t.nextFollowUp ? ". Follow-up " + fmtDate(t.nextFollowUp) : "") : t.recommended || t.reason;
    return '<button class="row agentRow" onclick="AuditAgent.openTask(\'' + t.id + '\')"><span class="rowMain"><b>' + E(t.title) + "</b><small>" + E(sub) + '</small></span><span class="rowEnd">' + prioTag(t.priority) + taskStateTag(t) + "</span></button>";
  }
  function itemRowSmall(x) {
    const r = reqOf(x), a = itemAction(x);
    return '<button class="row agentRow" onclick="' + a.act + '"><span class="rowMain"><b>' + E(x.title) + "</b><small>" + E(r.reason) + '</small></span><span class="rowEnd">' + flagChips(r.flags.filter((f) => f !== "awaiting_verification")) + statusTagHtml(r.status) + "</span></button>";
  }
  function attentionSection() {
    const a = attention();
    const n = { verify: a.verify.length, overdue: a.overdue.length, upcoming: a.upcoming.length, actions: a.actions.length };
    const body = attentionTab === "verify" ? a.verify.map(taskRow).join("") : attentionTab === "overdue" ? a.overdue.map(itemRowSmall).join("") : attentionTab === "upcoming" ? a.upcoming.map(itemRowSmall).join("") : a.actions.map(taskRow).join("");
    return (
      '<section class="section"><div class="sectionHead"><h2>Needs attention</h2><p>' + (data.lastRun ? "Checked " + E(relTime(data.lastRun.at).toLowerCase()) : "") + "</p></div>" +
      '<div class="tabs" role="tablist">' + ATT.map(([k, l]) => '<button class="tab' + (k === attentionTab ? " active" : "") + '" role="tab" aria-selected="' + (k === attentionTab) + '" onclick="AuditAgent.tab(\'' + k + '\')">' + l + ' <span class="muted num">' + n[k] + "</span></button>").join("") + "</div>" +
      (body || '<p class="empty">' + (attentionTab === "verify" ? "Nothing waiting for your verification or decision." : "Nothing here.") + "</p>") + "</section>"
    );
  }
  function tab(k) { attentionTab = k; render(); }
  function requirementRow(x) {
    const r = reqOf(x);
    return (
      '<div class="checkRow reqRow"><button onclick="openItem(\'' + x.id + '\')"><span class="rowMain"><b>' + E(x.title) + "</b><small>" + E(r.nextAction || x.evidence) + "</small></span>" +
      '<span class="rowEnd">' + flagChips(r.flags.filter((f) => f !== "awaiting_verification")) + prioTag(r.priority) + statusTagHtml(r.status) + '<span class="chev">' + ico("chevron") + "</span></span></button></div>"
    );
  }
  function auditPageHtml() {
    const areas = typeof AREAS !== "undefined" ? AREAS : [];
    const filterTabs = ["All areas"].concat(areas).map((a) => '<button class="filterButton ' + (activeFilter === a ? "active" : "") + '" onclick="filterArea(\'' + a.replace(/’/g, "\\u2019") + "')\">" + (a === "All areas" ? "All" : a) + "</button>").join("");
    const list = activeFilter === "All areas" ? areas : [activeFilter];
    return (
      header("Audit readiness", "beehive checks every requirement against its evidence, explains each gap and chases what’s missing. You verify.",
        '<button class="button primary" onclick="AuditAgent.openBlockers()">What’s stopping us?</button><button class="button" onclick="StaffAgent.runNow()"><span data-icon="refresh"></span>Check now</button><button class="button" onclick="editBaseline()">Edit checklist</button><button class="button" onclick="exportReport()"><span data-icon="download"></span>Export</button>') +
      '<div class="auditTop"><div>' + readinessBlock() + attentionSection() + "</div>" +
      '<section class="gapList blockersPanel"><div class="sectionHead"><h2>What’s stopping us from being audit ready?</h2></div><p class="muted blockerLead">' + E(blockersSummaryText()) + "</p>" + blockerList(3, true) +
      '<button class="textButton" onclick="AuditAgent.openBlockers()">The full answer</button></section></div>' +
      '<section class="section"><div class="sectionHead"><h2>Requirements</h2><p>Description, source, evidence, status, priority and next action for each</p></div>' +
      '<div class="areaFilters" role="tablist">' + filterTabs + "</div>" +
      list.map((a) => {
        const l = items.filter((x) => x.area === a);
        return l.length ? '<section class="areaBlock"><h3>' + E(a) + '<span class="count">' + l.length + "</span></h3>" + l.map(requirementRow).join("") + "</section>" : "";
      }).join("") + "</section>" +
      '<p class="footnote">' + (isLive() ? "Saved to your centre’s records. " : "Offline demo: the agent runs in this browser. ") + "Uploads count only after you verify them. Requests to staff are simulated email or SMS.</p>"
    );
  }

  // ---------- requirement drawer ----------
  function evidenceRow(e) {
    const tag = e.status === "verified" ? '<span class="status green">Verified</span>' : e.status === "pending" ? '<span class="status medium">Awaiting verification</span>' : e.status === "rejected" ? '<span class="status crit">Rejected</span>' : '<span class="status neutral">Replaced</span>';
    return (
      '<div class="evRow"><div><b>' + E(e.title) + "</b><small>" + (e.recordedOn ? "Dated " + E(fmtDate(e.recordedOn)) + ". " : "") +
      (e.status === "verified" ? (e.source === "owner_record" ? "Recorded by the owner " : "Verified ") + E(e.verifiedAt ? fmtDate(String(e.verifiedAt).slice(0, 10)) : "") : "Uploaded " + E(fmtDate(String(e.createdAt).slice(0, 10)))) +
      (e.reviewNote ? ". " + E(e.reviewNote) : "") + "</small></div>" + tag +
      (e.status === "pending" && leader() ? '<button class="button small" onclick="AuditAgent.openEvidence(\'' + e.id + '\')">Review</button>' : "") + "</div>"
    );
  }
  function openItem(id) {
    const x = itemById(id);
    if (!x) return;
    const r = reqOf(x), m = meta(x);
    const evs = data.evidence.filter((e) => e.itemId === id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6);
    const ts = openTasks().filter((t) => t.itemId === id);
    const revs = data.reviews.filter((v) => v.itemId === id && (!v.decision || (v.decision === "update_needed" && !v.completedAt)));
    const g = typeof Library !== "undefined" ? Library.itemSection(keyOf(x)) : "";
    const uploadable = m.kind === "document";
    openModal(
      '<div class="modalHead"><div><p style="margin:0 0 4px">' + E(x.area) + "</p><h2>" + E(x.title) + '</h2></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<p class="modalSection tagLine">' + statusTagHtml(r.status) + prioTag(r.priority) + flagChips(r.flags) + "</p>" +
      '<div class="modalSection"><h3>Why it’s ' + E(LABEL[r.status].toLowerCase()) + "</h3><p>" + E(r.reason) + '</p><p class="muted small">' + E(r.priorityReason) + "</p></div>" +
      '<div class="nextBox"><b>Next action</b><p>' + E(r.nextAction) + "</p></div>" +
      '<div class="reqMeta"><div class="modalMeta"><span>Requirement</span><b>' + E(x.summary) + "</b></div>" +
      '<div class="modalMeta"><span>Regulatory source</span><b>' + E(x.source) + "</b></div>" +
      '<div class="modalMeta"><span>Required evidence</span><b>' + E(m.hint || "") + (m.kind === "document" ? " (valid for " + m.months + " month" + (m.months === 1 ? "" : "s") + ")" : "") + "</b></div>" +
      '<div class="modalMeta"><span>Current evidence</span><b>' + E(r.currentEvidence || "None") + "</b></div>" +
      '<div class="modalMeta"><span>Last reviewed</span><b>' + E(r.lastReviewed ? fmtDate(String(r.lastReviewed).slice(0, 10)) : "Never") + "</b></div>" +
      '<div class="modalMeta"><span>Why it matters</span><b>' + E(r.why) + "</b></div></div>" +
      (revs.length ? '<div class="modalSection"><h3>Guidance change</h3>' + revs.map((v) => { const u = data.updates.find((y) => y.id === v.updateId) || {}; return '<p>' + E(u.title || "") + ": " + E(v.decision === "update_needed" ? "you decided the policy needs updating. Upload and verify the new version." : v.reason) + ' <button class="textButton" onclick="closeModal();go(\'updates\')">Open the update</button></p>'; }).join("") + "</div>" : "") +
      (ts.length ? '<div class="modalSection"><h3>Open actions</h3>' + ts.map(taskRow).join("") + "</div>" : "") +
      (m.kind === "certificates" ? renewalsFor(m) : "") +
      (evs.length ? '<div class="modalSection"><h3>Evidence</h3>' + evs.map(evidenceRow).join("") + "</div>" : "") +
      (uploadable ? '<div class="modalSection"><h3>Add evidence</h3>' + uploadWidget(id) + "</div>" : "") +
      (g ? '<details class="more"><summary>How to comply</summary>' + g + "</details>" : "") +
      '<div class="modalActions"><button class="button" onclick="closeModal()">Close</button>' +
      (keyOf(x) === "evacuation" && leader() ? '<button class="button" onclick="AuditAgent.openDrillForm(\'' + id + '\')">Log a drill you ran</button>' : "") +
      (m.kind === "certificates" ? '<button class="button primary" onclick="closeModal();go(\'staff\')">Staff certifications</button>' : "") +
      (uploadable ? '<button class="button primary" id="submitEvidence" onclick="AuditAgent.submitFromDrawer(\'' + id + '\')">Submit for verification</button>' : "") + "</div>",
      "wide",
    );
  }

  // the staff agent's renewals behind a credential requirement (one workflow, linked both ways)
  function renewalsFor(m) {
    if (typeof StaffAgent === "undefined" || !StaffAgent.active()) return "";
    const list = StaffAgent.data().tasks.filter((t) => t.state !== "resolved" && (m.codes || []).includes(t.code));
    return '<div class="modalSection"><h3>Renewals beehive is handling</h3>' +
      (list.length ? list.sort((a, b) => StaffAgent.PRIO[b.priority].rank - StaffAgent.PRIO[a.priority].rank).map((t) =>
        '<button class="row agentRow" onclick="closeModal();StaffAgent.openTask(\'' + t.id + '\')"><span class="rowMain"><b>' + E(t.staffName) + ' <span class="muted">· ' + E(StaffAgent.SHORT[t.code]) + "</span></b><small>" + E(t.reason) + '</small></span><span class="rowEnd">' + StaffAgent.prioTag(t.priority) + StaffAgent.stateTag(t.state) + "</span></button>").join("")
        : '<p class="muted">None. Every credential behind this requirement is current.</p>') +
      '<p class="footnote">This requirement is worked out from the staff register. Renewing a credential updates it automatically.</p></div>';
  }
  // which audit requirement a credential counts towards
  function requirementForCode(code) {
    if (typeof items === "undefined") return null;
    return items.find((x) => meta(x).kind === "certificates" && (meta(x).codes || []).includes(code)) || null;
  }

  // ---------- upload + reading (documents) ----------
  let pending = null; // { itemId, file, analysis }
  function uploadWidget(itemId) {
    return (
      '<label class="fileDrop"><b>Upload a photo or PDF</b>beehive reads the date and checks it fits this requirement. It counts only after verification.<input id="evFile" type="file" accept=".pdf,image/*" onchange="AuditAgent.fileChosen(this.files[0],\'' + itemId + '\')"><small id="evFileName">No file selected</small></label>' +
      '<div class="sampleLine"><span class="muted">Demo samples:</span>' + [["current", "Current"], ["old", "Out of date"], ["undated", "No date"], ["unreadable", "Unreadable"]].map(([v, l]) => '<button class="chip" type="button" onclick="AuditAgent.useSample(\'' + itemId + "','" + v + '\')">' + l + "</button>").join("") + "</div>" +
      '<div id="evRead" class="readResult"><small class="muted">Nothing changes until the evidence is verified.</small></div>' +
      '<label class="formLabel" for="evDate">Date of the document</label><input class="formControl" type="date" id="evDate">'
    );
  }
  // the requirement being uploaded for (on the secure link page the app's checklist isn't loaded)
  function resolveItem(itemId) {
    return itemById(itemId) || (link && link.info && link.info.item_id === itemId
      ? { id: link.info.item_id, key: link.info.item_key, title: link.info.title, months: link.info.review_months, hint: link.info.evidence_hint, kind: "document", source: link.info.source_ref }
      : { id: itemId, title: "Policy" });
  }
  async function sampleFile(itemId, variant) {
    const x = resolveItem(itemId);
    const c = document.createElement("canvas"); c.width = 1240; c.height = 1754;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    if (variant === "unreadable") { for (let i = 0; i < 9000; i++) { g.fillStyle = "rgba(60,50,40," + Math.random() * 0.5 + ")"; g.fillRect(Math.random() * 1240, Math.random() * 1754, 6 + Math.random() * 30, 2 + Math.random() * 8); } g.filter = "blur(14px)"; }
    const m = meta(x);
    const date = variant === "old" ? addMonths(today(), -(m.months + 2)) : addDays(today(), -1);
    const [y, mo, d] = date.split("-");
    const titles = { evacuation: "Emergency Evacuation Drill Record", premises: "Premises Safety Checklist", emergency: "Emergency Procedures and Contacts", sun: "Sun Protection Policy", sleep: "Sleep and Rest Policy", authorisations: "Authorised Nominee and Collection Register" };
    g.fillStyle = "#1d1b17"; g.textAlign = "left";
    g.font = "600 30px Arial"; g.fillText("SAMPLE ONLY - DEMO DOCUMENT - NOT A REAL RECORD", 90, 120);
    g.font = "700 56px Georgia"; g.fillText(titles[keyOf(x)] || x.title, 90, 240);
    g.font = "34px Arial"; g.fillText(typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "Beehive Early Learning", 90, 310);
    if (variant !== "undated") g.fillText((keyOf(x) === "evacuation" ? "Date of drill: " : "Date reviewed: ") + d + "/" + mo + "/" + y, 90, 400);
    const lines = keyOf(x) === "evacuation" ? ["Rooms: Wattle, Banksia, Gumtree", "Children evacuated: 46   Staff: 9", "Time to assembly point: 3 min 55 s", "Issues: none. Next drill in 3 months."]
      : ["1. Purpose", "2. Procedures staff follow", "3. Responsibilities", "4. Review: at least every 12 months"];
    lines.forEach((l, i) => g.fillText(l, 90, 500 + i * 60));
    g.font = "28px Arial"; g.fillText("Approved by: Sara Williams, Approved Provider", 90, 900);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
    const f = new File([blob], "sample-" + keyOf(x) + "-" + variant + ".png", { type: "image/png" });
    f.__demo = true;
    return f;
  }
  async function useSample(itemId, variant) { fileChosen(await sampleFile(itemId, variant), itemId); }
  function documentFields(text, conf, x) {
    const f = Extract.parse(text, conf, null);
    const re = TOPIC[keyOf(x)];
    const out = { readable: f.readable, topic_match: f.readable ? (re ? re.test(text) : true) : null, document_date: null, uncertain: [], confidence: f.confidence, demo: false };
    if (!f.readable) return out;
    // the most relevant date: labelled review/drill/approval date, else the latest date in the document
    const dates = (Extract.dates ? Extract.dates(text) : []);
    const labelled = Extract.labelled ? Extract.labelled(text, dates, /(date reviewed|reviewed|review date|date of drill|drill date|date of review|approved on|date approved|effective|dated|date)/) : null;
    const today_ = today();
    const past = dates.map((d) => d.value).filter((v) => v <= today_).sort();
    out.document_date = labelled || past[past.length - 1] || null;
    if (!labelled && out.document_date) out.uncertain.push("The document date wasn’t labelled. beehive used the latest date it found (" + out.document_date + ").");
    if (f.confidence && f.confidence < 60) out.uncertain.push("The scan quality is low (" + f.confidence + "% confidence). Compare it with the file.");
    return out;
  }
  async function fileChosen(file, itemId) {
    if (!file) return;
    if (!document.getElementById("evRead")) openItem(itemId);
    const x = resolveItem(itemId);
    pending = { itemId, file, analysis: null, x };
    const nameEl = document.getElementById("evFileName"); if (nameEl) nameEl.textContent = (file.__demo ? "Demo sample: " : "Selected: ") + file.name;
    const out = document.getElementById("evRead");
    if (out) out.innerHTML = '<small class="reading"><span class="hx"></span>Reading the document… <span id="evPct"></span></small>';
    let hash = "", dataUrl = null, fields;
    try {
      const a = await Extract.analyse(file, null, (p) => { const el = document.getElementById("evPct"); if (el) el.textContent = p + "%"; });
      hash = a.hash; dataUrl = a.dataUrl;
      fields = documentFields(a.text || "", a.fields.confidence, x);
      if (!a.fields.readable) fields.readable = false;
    } catch (e) { fields = { readable: false, uncertain: [e.message] }; }
    if (file.__demo) fields.demo = true;
    if (!pending || pending.file !== file) return;
    pending.analysis = { hash, dataUrl, fields };
    const de = document.getElementById("evDate"); if (de && fields.document_date) de.value = fields.document_date;
    const m = meta(x), flags = [];
    if (!fields.readable) flags.push("beehive couldn’t read this file.");
    else {
      if (fields.topic_match === false) flags.push("This doesn’t look like " + lc(m.hint) + ".");
      if (!fields.document_date) flags.push("No date found.");
      else if (addMonths(fields.document_date, m.months) < today()) flags.push("Dated " + fmtDate(fields.document_date) + ": out of date for this requirement.");
    }
    (fields.uncertain || []).forEach((u) => flags.push(u));
    if (out) out.innerHTML = '<div class="readGrid"><span>Topic</span><b>' + (fields.readable ? (fields.topic_match === false ? "Doesn’t match" : "Matches " + E(x.title.toLowerCase())) : "Unreadable") + "</b><span>Date</span><b>" + E(fields.document_date ? fmtDate(fields.document_date) : "Not found") + "</b></div>" +
      (flags.length ? '<ul class="readFlags">' + flags.map((f) => "<li>" + E(f) + "</li>").join("") + '</ul><small class="muted">You can still submit. It stays under review until it’s verified.</small>'
        : '<small class="okText"><span class="status green">Looks current</span> It counts once it’s verified.</small>');
  }
  async function submitFromDrawer(itemId) {
    if (!pending || pending.itemId !== itemId || !pending.file) return toast("Choose a file or a demo sample first.");
    if (!pending.analysis) return toast("Still reading the document. One moment.");
    const a = pending.analysis, date = (document.getElementById("evDate") || {}).value || null, x = itemById(itemId);
    const btn = document.getElementById("submitEvidence"); if (btn) btn.disabled = true;
    try {
      const r = isLive()
        ? await rpc("submit_evidence", { p_item: itemId, p_title: x.title + ": " + pending.file.name, p_file_name: pending.file.name, p_file_data: a.dataUrl, p_file_path: null, p_hash: a.hash || null, p_extracted: a.fields, p_date: date })
        : Engine.submit(itemId, { title: x.title + ": " + pending.file.name, fileName: pending.file.name, fileData: a.dataUrl, hash: a.hash, extracted: a.fields, date, source: "owner" });
      pending = null;
      toast(r.resolves ? "Uploaded. It would close the gap once you verify it." : "Uploaded and flagged: " + ((r.checks || [])[0] || {}).message);
      closeModal(); await refresh(); openEvidence(r.id);
    } catch (e) { toast(e.message || String(e)); if (btn) btn.disabled = false; }
  }

  // ---------- evidence review (verify / reject) ----------
  function openEvidence(evId) {
    const e = data.evidence.find((y) => y.id === evId);
    if (!e) return toast("This evidence has already been dealt with.");
    const x = itemById(e.itemId), m = meta(x), r = reqOf(x);
    const href = e.fileData || "";
    const isImg = /^data:image\//.test(href);
    const exp = e.recordedOn ? addMonths(String(e.recordedOn).slice(0, 10), m.months) : null;
    const resolves = e.flag === "clear" && exp && exp >= today();
    openModal(
      '<div class="modalHead"><div><h2>Verify evidence</h2><p>' + E(x.title) + ", uploaded " + E(relTime(e.createdAt).toLowerCase()) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      (e.flag === "clear" ? '<p class="okLine"><span class="status green">Looks right</span> beehive found a matching document dated ' + E(fmtDate(e.recordedOn)) + ". Verifying it would make this requirement compliant until " + E(fmtDate(exp)) + ".</p>"
        : '<div class="flagBox"><b>' + (e.flag === "unreadable" ? "beehive couldn’t read this file" : "Check these before deciding") + "</b><ul>" + (e.checks || []).map((c) => "<li>" + E(c.message) + "</li>").join("") + "</ul></div>") +
      (href ? (isImg ? '<a class="certPreview" href="' + href + '" target="_blank" rel="noopener"><img src="' + href + '" alt="Uploaded evidence"></a>' : '<p><a href="' + E(href) + '" target="_blank" rel="noopener">Open the uploaded file</a> (' + E(e.fileName) + ")</p>") : '<p class="muted">' + E(e.fileName || e.title) + "</p>") +
      (e.extracted && e.extracted.demo ? '<p class="demoNote">Demo: sample document generated for this prototype.</p>' : "") +
      '<div class="modalMeta"><span>Requirement</span><b>' + E(x.title) + " (" + E(x.source) + ")</b></div>" +
      '<div class="modalMeta"><span>Required evidence</span><b>' + E(m.hint) + "</b></div>" +
      '<div class="modalMeta"><span>Currently</span><b>' + E(LABEL[r.status]) + ": " + E(r.currentEvidence) + "</b></div>" +
      '<div class="modalMeta"><span>Would it close the gap?</span><b>' + (resolves ? "Yes, once verified" : "Not as it stands") + "</b></div>" +
      (leader()
        ? '<label class="formLabel" for="evConfirmDate">Confirmed document date</label><input class="formControl" type="date" id="evConfirmDate" value="' + E(e.recordedOn ? String(e.recordedOn).slice(0, 10) : "") + '">' +
          (e.flag !== "clear" ? '<label class="checkLine"><input type="checkbox" id="evConfirm"> I’ve checked the flagged points against the document and it meets the requirement.</label>' : "") +
          '<p class="footnote">Verifying records today as the verification date, updates the requirement and readiness, closes the open action and completes any linked scheduled task. Rejecting keeps the current status and asks for a corrected version.</p>' +
          '<details class="more rejectBox"><summary>Reject this evidence</summary><div class="chips">' +
          ["It’s out of date", "Wrong document", "Can’t be read", "Missing signatures or details"].map((t) => '<button class="chip" onclick="document.getElementById(\'evReason\').value=this.textContent">' + t + "</button>").join("") +
          '</div><label class="formLabel" for="evReason">Reason</label><textarea id="evReason" rows="2"></textarea><div class="buttonRow" style="margin-top:8px"><button class="button danger" onclick="AuditAgent.decideEvidence(\'' + e.id + '\',false)">Reject and ask again</button></div></details>' +
          '<div class="modalActions"><button class="button" onclick="closeModal()">Later</button><button class="button primary" id="evApprove" onclick="AuditAgent.decideEvidence(\'' + e.id + '\',true)">Verify and update requirement</button></div>'
        : ""),
      "wide",
    );
  }
  async function decideEvidence(evId, approve) {
    const e = data.evidence.find((y) => y.id === evId);
    if (!e) return;
    const x = itemById(e.itemId);
    try {
      let r;
      if (approve) {
        const c = document.getElementById("evConfirm");
        if (e.flag !== "clear" && c && !c.checked) return toast("Tick the box to confirm you’ve checked the flagged points.");
        const date = (document.getElementById("evConfirmDate") || {}).value || null;
        r = isLive() ? await rpc("verify_evidence", { p_evidence: evId, p_approve: true, p_date: date, p_reason: "" }) : Engine.verify(evId, true, date, "");
        toast(x.title + ": " + LABEL[r.before] + " → " + LABEL[r.after] + ". Verified today; readiness updated.");
      } else {
        const reason = ((document.getElementById("evReason") || {}).value || "").trim();
        if (!reason) return toast("Add a reason so the right version gets uploaded.");
        r = isLive() ? await rpc("verify_evidence", { p_evidence: evId, p_approve: false, p_date: null, p_reason: reason }) : Engine.verify(evId, false, null, reason);
        toast("Evidence rejected. The requirement is unchanged" + (openTasks().some((t) => t.itemId === e.itemId && t.assigneeId) ? " and beehive asked for a corrected version (simulated)." : "."));
      }
      closeModal(); await refresh();
    } catch (err) { toast(err.message || String(err)); }
  }

  // ---------- owner-attested drill log ----------
  function openDrillForm(itemId) {
    openModal(
      '<div class="modalHead"><div><h2>Log a drill you ran</h2><p>Your own record, attested by you. Uploads from staff are verified separately.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<label class="formLabel" for="drDate">Date of the drill</label><input class="formControl" type="date" id="drDate" value="' + today() + '">' +
      '<label class="formLabel" for="drRooms">Rooms and people</label><input class="formControl" id="drRooms" placeholder="All rooms, 46 children, 9 staff">' +
      '<label class="formLabel" for="drTime">Time to the assembly point</label><input class="formControl" id="drTime" placeholder="3 min 55 s">' +
      '<label class="formLabel" for="drIssues">Issues and improvements</label><input class="formControl" id="drIssues" placeholder="None">' +
      '<div class="modalActions"><button class="button" onclick="closeModal()">Cancel</button><button class="button primary" onclick="AuditAgent.saveDrill(\'' + itemId + '\')">Record drill</button></div>',
    );
  }
  async function saveDrill(itemId) {
    const v = (id) => ((document.getElementById(id) || {}).value || "").trim();
    const details = { rooms: v("drRooms"), time: v("drTime"), issues: v("drIssues") };
    if (!details.rooms || !details.time) return toast("Add the rooms and the time taken, so the record is complete.");
    const title = "Evacuation drill: " + details.rooms + ", " + details.time;
    try {
      if (isLive()) await rpc("record_evidence", { p_item: itemId, p_title: title, p_date: v("drDate"), p_details: details });
      else Engine.record(itemId, title, v("drDate"), details);
      toast("Drill recorded. The rehearsal task is complete and readiness is updated.");
      closeModal(); await refresh();
    } catch (e) { toast(e.message || String(e)); }
  }

  // ---------- task drawer ----------
  function openTask(id) {
    const t = data.tasks.find((y) => y.id === id);
    if (!t) return;
    const msgs = data.messages.filter((m) => m.taskId === id);
    const evs = data.events.filter((e) => e.taskId === id).slice().reverse();
    const staff = isLive() ? data.staff : (typeof educators !== "undefined" ? educators : []).map((e) => ({ id: e.id, name: e.name, role: e.role }));
    const canAssign = t.kind === "evidence" && t.state !== "resolved" && leader();
    openModal(
      '<div class="modalHead"><div><h2>' + E(t.title) + "</h2><p>" + E(t.itemTitle || t.updateTitle || "") + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<p class="modalSection tagLine">' + prioTag(t.priority) + taskStateTag(t) + "</p>" +
      '<div class="modalSection"><h3>Why</h3><p>' + E(t.reason) + "</p></div>" +
      '<div class="nextBox"><b>Recommended</b><p>' + E(t.recommended) + "</p></div>" +
      (t.evidenceId ? '<div class="callout"><span class="hx lg"></span><div><b>Evidence waiting for you</b><p>Check it and verify or reject it.</p></div><span class="rowEnd"><button class="button primary small" onclick="AuditAgent.openEvidence(\'' + t.evidenceId + '\')">Review</button></span></div>' : "") +
      '<div class="modalMeta"><span>Assigned to</span><b>' + E(t.assigneeId ? t.assigneeName : "You") + "</b></div>" +
      (t.dueDate ? '<div class="modalMeta"><span>Due</span><b>' + E(fmtDate(t.dueDate)) + "</b></div>" : "") +
      (t.kind === "regulation_action" && t.state !== "resolved" && leader() ? '<label class="formLabel" for="doneNote">What you changed (optional)</label><input class="formControl" id="doneNote" placeholder="For example: register checked, new course code noted">' : "") +
      (t.requestsSent ? '<div class="modalMeta"><span>Requests sent</span><b>' + t.requestsSent + (t.nextFollowUp ? ", next follow-up " + E(fmtDate(t.nextFollowUp)) : "") + "</b></div>" : "") +
      (canAssign ? '<label class="formLabel" for="assignTo">Ask someone for this evidence</label><div class="assignLine"><select class="formControl" id="assignTo"><option value="">Me (the owner)</option>' +
        staff.map((s) => '<option value="' + E(s.id) + '"' + (s.id === t.assigneeId ? " selected" : "") + ">" + E(s.name) + (s.role ? ", " + E(s.role) : "") + "</option>").join("") +
        '</select><button class="button" onclick="AuditAgent.assign(\'' + t.id + '\')">Assign</button></div>' : "") +
      (msgs.length ? '<div class="modalSection"><h3>Messages</h3>' + msgs.map(messageHtml).join("") + "</div>" : "") +
      (evs.length ? '<div class="modalSection"><h3>What beehive did</h3><ol class="timeline">' + evs.map((e) => '<li class="tlItem ' + (StaffAgent.FEED_CLASS[e.state] || "watch") + '"><span class="tlMark"></span><span class="tlText"><b>' + E(e.summary) + "</b><small>" + E(line(e)) + "</small></span><time>" + E(relTime(e.at)) + "</time></li>").join("") + "</ol></div>" : "") +
      '<div class="modalActions">' + (t.itemId ? '<button class="button" onclick="closeModal();openItem(\'' + t.itemId + '\')">Requirement</button>' : "") +
      (t.kind === "regulation_review" ? '<button class="button primary" onclick="closeModal();go(\'updates\')">Review the update</button>' : "") +
      (t.kind === "overdue_task" ? '<button class="button primary" onclick="closeModal();go(\'compliance\')">Compliance tasks</button>' : "") +
      (t.kind === "regulation_action" && t.state !== "resolved" && meta(itemById(t.itemId)).kind === "certificates" ? '<button class="button" onclick="closeModal();go(\'staff\')">Staff certifications</button>' : "") +
      (t.kind === "regulation_action" && t.state !== "resolved" && leader() ? '<button class="button primary" onclick="AuditAgent.completeTask(\'' + t.id + '\')">Mark done</button>' : "") +
      (t.kind === "evidence" && t.assigneeId && t.state !== "resolved" && leader() ? '<button class="button" onclick="AuditAgent.sendNow(\'' + t.id + '\')">Send reminder now</button>' : "") + "</div>",
      "wide",
    );
  }
  function messageHtml(m) {
    return (
      '<div class="msgItem"><div class="msgHead"><b>' + E(m.subject) + "</b><time>" + E(new Date(m.at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })) + "</time></div>" +
      '<small class="msgTo">' + (m.outcome === "no_contact" ? "Not sent: no email or mobile on file" : "Simulated " + (m.channel === "sms" ? "SMS" : "email") + " to " + E(m.recipient) + " · not actually delivered") + "</small><p>" + E(m.body) + "</p>" +
      (m.link ? '<a class="msgLink" href="' + E(StaffAgent.uploadUrl(m.link)) + '" target="_blank" rel="noopener" onclick="return AuditAgent.openLink(\'' + E(m.link) + '\')">Open the upload link (demo)</a>' : "") +
      (m.nextFollowUp ? '<small class="muted">Next follow-up ' + E(fmtDate(m.nextFollowUp)) + "</small>" : "") + "</div>"
    );
  }
  const DEMO_UPDATES = [
    { title: "First aid qualification changes", summary: "Updated first aid course requirements for education and care services. Check that every educator’s first aid and CPR certificates meet the new course requirements.", terms: ["firstaid"] },
    { title: "Sun protection guidance refreshed", summary: "Cancer Council has refreshed its sun protection guidance for early childhood services, including UV thresholds for outdoor play.", terms: ["sun"] },
  ];
  function addDemoUpdate(o) {
    if (isLive()) return;
    const next = o || DEMO_UPDATES.find((d) => !data.updates.some((u) => u.title === d.title));
    if (!next) return toast("No more demo updates to add.");
    Engine.load(); Engine.addUpdate(next); applyOffline(); render();
    toast("Demo update added. beehive assessed it against your requirements.");
  }
  async function completeTask(taskId) {
    const note = ((document.getElementById("doneNote") || {}).value || "").trim();
    try {
      if (isLive()) await rpc("complete_audit_task", { p_task: taskId, p_note: note });
      else Engine.complete(taskId, note);
      toast("Recorded. The review is complete and the requirement is updated.");
      closeModal(); await refresh();
    } catch (e) { toast(e.message || String(e)); }
  }
  async function assign(taskId) {
    const staffId = (document.getElementById("assignTo") || {}).value || null;
    try {
      if (isLive()) await rpc("assign_audit_task", { p_task: taskId, p_staff: staffId });
      else Engine.assign(taskId, staffId);
      toast(staffId ? "Assigned. beehive sent the request (simulated) and will follow up." : "Assigned to you.");
      closeModal(); await refresh(); openTask(taskId);
    } catch (e) { toast(e.message || String(e)); }
  }
  async function sendNow(taskId) {
    try { if (isLive()) await rpc("audit_send_now", { p_task: taskId }); else Engine.sendNow(taskId); toast("Reminder recorded as sent (simulated)."); closeModal(); await refresh(); openTask(taskId); }
    catch (e) { toast(e.message || String(e)); }
  }

  // ---------- regulation updates page ----------
  const IMPACT = { likely: ["crit", "Likely affected"], possible: ["medium", "Possibly affected"], unclear: ["monitor", "Impact unclear"] };
  function updatesPageHtml() {
    const ups = data.updates;
    if (!ups.length) return header("Regulation updates", "Changes that may affect your requirements.") + '<p class="empty">No updates. When guidance changes, beehive assesses which requirements it may affect and lists it here.</p>';
    return header("Regulation updates", "beehive assesses each change against your requirements. It flags what may be affected; you decide whether anything needs to change.",
        isLive() ? "" : '<button class="button" onclick="AuditAgent.addDemoUpdate()">Add a demo update</button>') +
      ups.map((u) => {
        const revs = data.reviews.filter((r) => r.updateId === u.id);
        const updating = revs.some((r) => r.decision === "update_needed" && !r.completedAt);
        const state = u.status === "reviewed" ? (updating ? '<span class="status medium">Reviewed, policy update in progress</span>' : '<span class="status green">Reviewed</span>') : u.status === "new" ? '<span class="status neutral">New, not yet assessed</span>' : '<span class="status crit">Review required</span>';
        return (
          '<article class="update"><p class="updateMeta">' + state + "<span>Published " + E(fmtDate(u.published)) + "</span>" + (u.demo ? '<span class="demoTag">Demo update</span>' : "") + "</p><h2>" + E(u.title) + "</h2><p>" + E(u.summary) + "</p>" +
          (u.assessment ? '<div class="nextBox"><b>What beehive found</b><p>' + E(u.assessment) + "</p></div>" : "") +
          (u.source ? '<p class="small"><a href="' + E(u.source) + '" target="_blank" rel="noopener">Official source</a></p>' : "") +
          revs.map((r) => reviewBlock(r, u)).join("") + "</article>"
        );
      }).join("") +
      '<p class="footnote">Identifying a potentially relevant change isn’t the same as confirming your policy must change. beehive never rewrites a policy or marks a requirement non-compliant from an update alone. Summaries are guidance, not legal advice.</p>';
  }
  function reviewBlock(r, u) {
    const x = r.itemId ? itemById(r.itemId) : null;
    const imp = IMPACT[r.impact] || IMPACT.unclear;
    const dec = { no_change: "No change needed", update_needed: "Policy needs updating", not_applicable: "Doesn’t apply to us" };
    return (
      '<div class="reviewItem"><div class="reviewHead"><span class="status ' + imp[0] + '">' + imp[1] + "</span><b>" + E(x ? x.title : "No requirement clearly matches") + "</b>" + (x ? statusTagHtml(reqOf(x).status) : "") + "</div>" +
      "<p>" + E(r.reason) + "</p><p class=\"muted small\"><b>Recommended:</b> " + E(r.recommended) + "</p>" +
      (r.decision
        ? '<p class="decisionDone"><span class="status ' + (r.decision === "update_needed" && !r.completedAt ? "medium" : "green") + '">' + dec[r.decision] + "</span>" + E(r.decidedAt ? " Recorded " + fmtDate(String(r.decidedAt).slice(0, 10)) : "") + (r.note ? ". " + E(r.note) : "") +
          (r.decision === "update_needed" ? (r.completedAt ? ". Change in place." : (x && meta(x).kind !== "document" ? '. Waiting for you to put it into practice. <button class="textButton" onclick="AuditAgent.openActionFor(\'' + r.updateId + "','" + r.itemId + '\')">Open the task</button>' : '. Waiting for the updated policy. <button class="textButton" onclick="openItem(\'' + r.itemId + '\')">Upload it</button>')) : "") + "</p>"
        : leader()
        ? '<label class="formLabel" for="rn-' + r.id + '">Your note (optional)</label><input class="formControl" id="rn-' + r.id + '" placeholder="What you checked">' +
          '<div class="buttonRow decisionBtns">' +
          '<button class="button" onclick="AuditAgent.decide(\'' + r.id + "','no_change')\">No change needed</button>" +
          '<button class="button" onclick="AuditAgent.decide(\'' + r.id + "','update_needed')\">Policy needs updating</button>" +
          '<button class="button" onclick="AuditAgent.decide(\'' + r.id + "','not_applicable')\">Doesn’t apply to us</button>" +
          (x ? '<button class="textButton" onclick="openItem(\'' + x.id + '\')">See current evidence</button>' : "") + "</div>"
        : "") + "</div>"
    );
  }
  function openActionFor(updateId, itemId) {
    const t = data.tasks.find((y) => y.kind === "regulation_action" && y.updateId === updateId && y.itemId === itemId && y.state !== "resolved");
    if (t) openTask(t.id); else openItem(itemId);
  }
  async function decide(reviewId, decision) {
    const note = ((document.getElementById("rn-" + reviewId) || {}).value || "").trim();
    try {
      if (isLive()) await rpc("decide_regulation_review", { p_review: reviewId, p_decision: decision, p_note: note });
      else Engine.decide(reviewId, decision, note);
      toast(decision === "update_needed" ? "Decision recorded. The requirement stays under review until you upload and verify the updated policy." : decision === "no_change" ? "Decision recorded. The review flag is cleared and today is recorded as the review date." : "Decision recorded. The review flag is cleared.");
      await refresh();
    } catch (e) { toast(e.message || String(e)); }
  }

  // ---------- shared activity feed ----------
  function line(e) {
    const d = e.detail || {};
    if (/evidence_requested|evidence_follow_up|evidence_correction/.test(e.kind)) return d.channel === "none" ? "No email or mobile on file" : "Simulated " + (d.channel === "sms" ? "SMS" : "email") + " to " + (d.recipient || "") + (d.next_follow_up ? ". Follow-up " + fmtDate(d.next_follow_up) : "");
    if (e.kind === "gap_detected") return (d.reason || "") + (d.priority_reason ? " " + d.priority_reason : "");
    if (e.kind === "status_changed") return d.reason || "";
    if (e.kind === "evidence_assessed") return (d.checks || []).length ? d.checks.map((c) => c.message).slice(0, 2).join(" ") : d.expires ? "Matches the requirement; current until " + fmtDate(d.expires) : "";
    if (e.kind === "evidence_verified") return d.valid_until ? "Counts until " + fmtDate(d.valid_until) : "";
    if (e.kind === "evidence_rejected") return d.reason || "";
    if (e.kind === "review_required") return (d.reason || "") + " Flagged for review only; nothing has been changed.";
    if (e.kind === "regulation_assessed") return d.affected ? "May affect: " + d.items : "No requirement clearly matches. Flagged for your review.";
    if (e.kind === "regulation_decision") return d.note || "";
    if (e.kind === "task_overdue") return d.due_date ? "Was due " + fmtDate(d.due_date) : "";
    if (e.kind === "action_proposed") return d.next_action || d.reason || "";
    if (e.kind === "escalated") return d.reason || "";
    if (e.kind === "evidence_recorded") return d.details && d.details.time ? (d.details.rooms || "") + ", " + d.details.time : "";
    return d.reason || "";
  }
  function feedRows() {
    return data.events.map((e) => {
      const t = e.taskId ? data.tasks.find((y) => y.id === e.taskId) : null;
      let act = "", actLabel = "";
      if (t && t.state === "owner_review") { act = t.evidenceId ? "AuditAgent.openEvidence('" + t.evidenceId + "')" : t.kind === "regulation_review" ? "go('updates')" : "AuditAgent.openTask('" + t.id + "')"; actLabel = t.evidenceId ? "Verify" : "Decide"; }
      else if (t && t.state !== "resolved") act = "AuditAgent.openTask('" + t.id + "')";
      else if (e.itemId) act = "openItem('" + e.itemId + "')";
      else if (e.updateId) act = "go('updates')";
      else if (t) act = "AuditAgent.openTask('" + t.id + "')";
      const x = e.itemId ? itemById(e.itemId) : null;
      const d = e.detail || {};
      const subject = e.staffName ? e.staffName + (e.code && typeof StaffAgent !== "undefined" ? ", " + StaffAgent.SHORT[e.code] : "") : t && t.assigneeName && /evidence_requested|evidence_follow_up|evidence_correction/.test(e.kind) ? t.assigneeName : "";
      return { at: e.at, state: e.state, summary: e.summary, subject, line: (d.cause ? d.cause + ". " : "") + line(e), act, actLabel, demo: e.demo, agent: "audit",
               simulated: !!d.simulated, proposed: !!d.proposed && t && t.state !== "resolved",
               now: t && t.state !== "resolved" && TASK_STATE[t.state] !== e.state ? taskStateTag(t) : "", itemTitle: x ? x.title : e.itemTitle };
    });
  }

  // ---------- decisions for the Overview ----------
  function decisions() {
    return openTasks().filter((t) => t.state === "owner_review").sort((a, b) => prioRank(b.priority) - prioRank(a.priority)).map((t) => {
      if (t.evidenceId) {
        const e = data.evidence.find((y) => y.id === t.evidenceId);
        return { kind: e && e.flag !== "clear" ? "Check flagged evidence" : "Verify evidence", who: t.itemTitle, detail: e && (e.checks || [])[0] ? e.checks[0].message : "Looks current. Verify it to close the gap.", act: "AuditAgent.openEvidence('" + t.evidenceId + "')", btn: "Review", urgent: e && e.flag !== "clear" };
      }
      if (t.kind === "regulation_review") return { kind: "Regulation review", who: t.itemTitle || t.updateTitle, detail: t.reason + " Decide whether anything needs to change.", act: "go('updates')", btn: "Review" };
      return { kind: "Escalated", who: t.itemTitle, detail: t.recommended, act: "AuditAgent.openTask('" + t.id + "')", btn: "Decide", urgent: true };
    });
  }
  function overviewRow() {
    const b = blockers().filter((y) => y.r.status !== "compliant");
    const top = b[0];
    return (
      '<button class="row" onclick="go(\'audit\')"><span class="rowMain"><b>Audit readiness</b><small>' + E(blockersSummaryText()) + (top ? " Top gap: " + E(top.x.title) + "." : "") + '</small></span><span class="rowMeta num">' + score().pct + "%</span></button>" +
      '<button class="row" onclick="AuditAgent.openBlockers()"><span class="rowMain"><b>What’s stopping us from being audit ready?</b><small>The highest-priority gaps, why they matter and what to do next</small></span><span class="chev">' + ico("chevron") + "</span></button>"
    );
  }
  // for Ask beehive
  function blockersAnswer() {
    const b = blockers().filter((y) => y.r.status !== "compliant").slice(0, 4);
    return E(blockersSummaryText()) + (b.length ? "<ol>" + b.map(({ x, r }) => "<li><b>" + E(x.title) + "</b> " + prioTag(r.priority) + "<br><small>" + E(r.reason) + " <b>Next:</b> " + E(r.nextAction) + '</small><br><button class="textButton" onclick="Assistant.toggle(false);' + itemAction(x).act + '">' + itemAction(x).label + "</button></li>").join("") + "</ol>" : "") +
      '<button class="textButton" onclick="Assistant.toggle(false);AuditAgent.openBlockers()">The full answer</button>';
  }

  // ---------- staff: evidence requests (My certificates page) ----------
  function educatorRequests() {
    if (!data.available || !isLive() || !ME || ME.role !== "educator") return "";
    const mine = openTasks().filter((t) => t.kind === "evidence" && t.assigneeId && data.staff.some((s) => s.id === t.assigneeId && s.userId === ME.id));
    if (!mine.length) return "";
    return '<section class="section"><div class="sectionHead"><h2>Evidence the centre needs from you</h2></div>' + mine.map((t) => {
      const m = data.messages.find((y) => y.taskId === t.id);
      return '<div class="row"><span class="rowMain"><b>' + E(t.itemTitle) + "</b><small>" + E(m ? m.body : t.recommended) + '</small></span><span class="rowEnd">' + (t.evidenceId ? '<span class="status medium">Waiting for verification</span>' : '<a class="button small" href="#evidence/' + E(t.token) + '" onclick="AuditAgent.showLinkPage(\'' + E(t.token) + '\', true);return false">Upload</a>') + "</span></div>";
    }).join("") + "</section>";
  }

  // ---------- secure evidence link (#evidence/<token>) ----------
  let linkRoot = null, linkInApp = false;
  function linkToken() { const m = location.hash.match(/^#evidence\/([\w-]+)/); return m ? m[1] : null; }
  function openLink(l) { if (!isLive()) { closeModal(); showLinkPage(l.replace(/^#?evidence\//, ""), true); return false; } return true; }
  async function showLinkPage(token, inApp) {
    linkInApp = !!inApp;
    linkRoot = document.getElementById("linkRoot");
    if (!linkRoot) { linkRoot = document.createElement("div"); linkRoot.id = "linkRoot"; document.body.appendChild(linkRoot); }
    linkRoot.classList.remove("hidden");
    linkRoot.innerHTML = '<div class="linkPage"><p class="muted">Opening your upload link…</p></div>';
    let info = null, err = "";
    try {
      if (String(token).startsWith("demo-")) { Engine.load(); info = Engine.linkInfo(token); }
      else { const r = await Live.client().rpc("evidence_request_info", { p_token: token }); if (r.error) throw new Error(Live.explain(r.error)); info = r.data; }
    } catch (e) { err = e.message; }
    if (!info) { linkRoot.innerHTML = '<div class="linkPage">' + StaffAgent.brand() + "<h1>This link has expired</h1><p class=\"muted\">" + E(err || "The evidence has already been verified, or the request was replaced. Ask the centre for a new link.") + "</p>" + closeBtn() + "</div>"; return; }
    link = { token, info };
    const id = info.item_id;
    linkRoot.innerHTML =
      '<div class="linkPage">' + StaffAgent.brand() + '<p class="linkCentre">' + E(info.centre) + "</p>" +
      "<h1>Hi " + E(info.first_name) + ", please upload " + E(lc(info.evidence_hint)) + "</h1>" +
      '<p class="muted">For “' + E(info.title) + "” (" + E(info.source_ref) + ")" + (info.due_date ? ", by " + E(fmtDate(info.due_date)) : "") + ". The centre checks it before it counts.</p>" +
      (info.pending ? '<p class="notice">Something is already waiting to be checked. A new upload replaces it.</p>' : "") +
      uploadWidget(id).replace(/AuditAgent\.fileChosen\(this\.files\[0\],'[^']*'\)/, "AuditAgent.fileChosen(this.files[0],'" + id + "')") +
      '<div class="formActions" style="justify-content:flex-start"><button class="button primary" id="linkSubmit" onclick="AuditAgent.submitLink()">Send to the centre</button></div>' +
      '<p class="footnote">Demo prototype: this page stands in for the link in the (simulated) email or SMS. Use invented details only.</p>' + closeBtn() + "</div>";
  }
  function closeBtn() { return linkInApp ? '<button class="textButton" style="margin-top:24px" onclick="AuditAgent.closeLinkPage()">Back</button>' : ""; }
  async function submitLink() {
    if (!pending || !pending.file) return toast("Choose a file or a demo sample first.");
    if (!pending.analysis) return toast("Still reading the document. One moment.");
    const a = pending.analysis, date = (document.getElementById("evDate") || {}).value || null;
    const btn = document.getElementById("linkSubmit"); if (btn) btn.disabled = true;
    try {
      const title = link.info.title + ": " + pending.file.name;
      const r = String(link.token).startsWith("demo-")
        ? Engine.submit(link.info.item_id, { title, fileName: pending.file.name, fileData: a.dataUrl, hash: a.hash, extracted: a.fields, date, source: "link" })
        : await (async () => { const x = await Live.client().rpc("submit_evidence_by_token", { p_token: link.token, p_title: title, p_file_name: pending.file.name, p_file_data: a.dataUrl, p_hash: a.hash || null, p_extracted: a.fields, p_date: date }); if (x.error) throw new Error(Live.explain(x.error)); return x.data; })();
      pending = null;
      linkRoot.innerHTML = '<div class="linkPage">' + StaffAgent.brand() + "<h1>Thanks, it’s with the centre</h1><p class=\"muted\">" +
        (r.resolves ? "beehive checked it and it looks current. The centre will verify it shortly." : "beehive couldn’t confirm everything, so the centre will check it: " + E(((r.checks || [])[0] || {}).message || "")) + "</p>" + closeBtn() + "</div>";
      if (!isLive()) applyOffline();
    } catch (e) { toast(e.message || String(e)); if (btn) btn.disabled = false; }
  }
  function closeLinkPage() {
    if (linkRoot) { linkRoot.classList.add("hidden"); linkRoot.innerHTML = ""; }
    link = null;
    if (location.hash.startsWith("#evidence/")) history.replaceState(null, "", location.pathname);
    refresh();
  }

  // ---------- plumbing ----------
  const rpc = async (name, args) => { const r = await Live.client().rpc(name, args); if (r.error) throw new Error(Live.explain(r.error)); return r.data; };
  async function refresh() {
    if (isLive()) await Live.reload();
    else { Engine.load(); applyOffline(); render(); }
  }
  function onApproved() { if (!isLive()) { Engine.load(); const r = Engine.approvedRun(); applyOffline(); return r; } return null; }
  function setupNote() {
    if (data.error === "setup") return '<div class="callout quiet"><span class="hx lg"></span><div><b>The audit agent isn’t set up in this database yet</b><p>Run supabase/migrations/20261029090000_audit_agent.sql, then supabase/seed_demo.sql, in the Supabase SQL Editor.</p></div></div>';
    return "";
  }

  return {
    active, data: () => data, counts, score, blockers, decisions, feedRows, loadOffline, loadLive, runRemote, runOffline, onApproved, reset: () => Engine.reset(), applyOffline,
    auditPageHtml, updatesPageHtml, overviewRow, blockersAnswer, blockersSummaryText, educatorRequests, setupNote, readinessBlock,
    openItem, openBlockers, openEvidence, openTask, openDrillForm, saveDrill, decideEvidence, fileChosen, useSample, submitFromDrawer, assign, sendNow, decide, tab,
    linkToken, showLinkPage, submitLink, closeLinkPage, openLink, LABEL,
    todoItems, completeTask, openActionFor, addDemoUpdate, requirementForCode, reqOf, meta, prioTag, statusTagHtml: (st) => statusTagHtml(st),
  };
})();
