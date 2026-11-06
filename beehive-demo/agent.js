// beehive staff compliance agent (interface + offline engine).
//
// The agent watches every educator's required credentials and works each renewal through:
//   detect -> prioritise -> request (simulated email/SMS) -> wait -> follow up -> upload checked
//   -> owner verifies -> record updated -> task closed, escalating anything that needs judgement.
//
// Signed in, the loop runs in the database (supabase/migrations/20261028090000_staff_agent.sql) and this
// file only reads its tables and calls its functions. In the offline demo the same rules run here, in
// the browser (engine below), so the demo behaves identically without a server.
//
// Priority (one definition, used everywhere): Critical = expired or missing, High = 7 days or less,
// Medium = 30 days or less, Monitor = later (the agent watches from 60 days out).
const StaffAgent = (() => {
  const REQUIRED = ["WWCC", "FIRST_AID", "CPR", "ANAPHYLAXIS", "ASTHMA"];
  const TYPE = { WWCC: "Working with Children Check", FIRST_AID: "First aid", CPR: "CPR", ANAPHYLAXIS: "Anaphylaxis training", ASTHMA: "Emergency asthma management training" };
  const SHORT = { WWCC: "WWCC", FIRST_AID: "First Aid", CPR: "CPR", ANAPHYLAXIS: "Anaphylaxis", ASTHMA: "Asthma" };
  const CODE_OF = { WWCC: "WWCC", "First Aid": "FIRST_AID", CPR: "CPR", Anaphylaxis: "ANAPHYLAXIS", Asthma: "ASTHMA" };
  const WINDOW = 60;
  const PRIO = { critical: { label: "Critical", cls: "crit", rank: 4 }, high: { label: "High", cls: "high", rank: 3 }, medium: { label: "Medium", cls: "medium", rank: 2 }, monitor: { label: "Monitor", cls: "monitor", rank: 1 } };
  const TASK_STATE = { monitoring: "Monitoring", waiting: "Waiting", owner_review: "Owner review", resolved: "Resolved" };
  const FEED_CLASS = { Monitoring: "watch", "Action taken": "progress", Waiting: "waiting", "Owner review": "needs", Resolved: "done" };
  const STATE_CLASS = { Monitoring: "monitor", "Action taken": "action", Waiting: "medium", "Owner review": "crit", Resolved: "green" };
  const FOLLOW_UP = { critical: 1, high: 2, medium: 5, monitor: 14 };
  const STORE = "beehive-agent-v2";

  let data = { available: false, mode: "", error: "", tasks: [], feed: [], messages: [], subs: [], lastRun: null };
  let feedFilter = "All";
  let renewalTab = "owner_review";
  let upload = null; // { file, analysis, staffId, code, token }
  let running = false;

  const isLive = () => typeof LIVE !== "undefined" && LIVE;
  const leader = () => !isLive() || (ME && (ME.role === "owner" || ME.role === "director"));
  const active = () => data.available;
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const daysFrom = (iso, base) => (iso ? Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse((base || today()) + "T00:00:00Z")) / 864e5) : null);
  const addDays = (iso, n) => { const d = new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5); return d.toISOString().slice(0, 10); };
  const fmtDate = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");
  const fmtShort = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "");
  const first = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const priorityOf = (days, missing) => (missing || days == null || days < 0 ? "critical" : days <= 7 ? "high" : days <= 30 ? "medium" : "monitor");
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));

  // =====================================================================================
  // Offline engine: the same rules as the database functions, kept in this browser.
  // =====================================================================================
  const Engine = (() => {
    let S = null;
    let offset = 0; // used once, to give the demo a few days of history
    const now = () => new Date(Date.now() + offset);
    const day = () => now().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
    const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };
    const staff = (id) => S.staff.find((s) => s.id === id);
    const openTask = (sid, code) => S.tasks.find((t) => t.staffId === sid && t.code === code && t.state !== "resolved");
    const pendingSub = (sid, code) => S.subs.find((x) => x.staffId === sid && x.code === code && x.status === "pending");

    function event(t, kind, state, summary, detail) {
      S.events.push({ id: ++S.seq, taskId: t ? t.id : null, staffId: t ? t.staffId : null, code: t ? t.code : null, kind, state, summary, detail: detail || {}, demo: !!S.seeding, at: now().toISOString() });
    }
    function contact(s) { return s.email ? ["email", s.email] : s.phone ? ["sms", s.phone] : ["none", ""]; }
    function send(t, kind, note) {
      const s = staff(t.staffId), name = TYPE[t.code], [channel, recipient] = contact(s);
      const d = day(), exp = t.expiry;
      const deadline = !exp ? "as soon as possible" : exp < d ? "now (it expired on " + fmtDate(exp) + ")" : "before it expires";
      const subject = kind === "request" ? "Please renew your " + name : kind === "follow_up" ? "Reminder: your " + name + " renewal" : "Please upload your " + name + " again";
      const opening =
        kind === "request" ? (!exp ? "we don’t have a " + name + " on file for you." : exp < d ? "your " + name + " expired on " + fmtDate(exp) + "." : "your " + name + " expires on " + fmtDate(exp) + ".") + " Please upload your renewed certificate " + deadline + " using your secure link."
        : kind === "follow_up" ? "we haven’t received your renewed " + name + " yet. Please upload it " + (exp && exp >= d ? "before " + fmtDate(exp) : deadline) + " using your secure link."
        : "we couldn’t accept the certificate you uploaded" + (note ? " (" + note + ")" : "") + ". Please upload a clear copy of your current " + name + " using your secure link.";
      const body = "Hi " + first(s.name) + ", " + opening + " Thanks, " + first(S.owner) + ", " + S.centre + ".";
      const next = addDays(d, FOLLOW_UP[t.priority]);
      const m = { id: uid(), taskId: t.id, staffId: t.staffId, kind, channel, recipient, subject, body, link: "#upload/" + t.token, outcome: channel === "none" ? "no_contact" : "simulated", at: now().toISOString(), nextFollowUp: next };
      S.messages.push(m);
      t.requestsSent++; t.lastRequestAt = m.at; t.nextFollowUp = next; t.updatedAt = m.at;
      if (t.state !== "owner_review") t.state = "waiting";
      event(t, kind === "request" ? "request_sent" : kind === "follow_up" ? "follow_up_sent" : "correction_requested", "Action taken",
        kind === "request" ? "Renewal request sent" : kind === "follow_up" ? "Follow-up sent" : "Corrected upload requested",
        { message_id: m.id, channel, recipient, simulated: true, next_follow_up: next });
      return m;
    }
    function escalate(t, reason, action) {
      t.escalatedAt = now().toISOString(); t.escalationReason = reason; t.recommendedAction = action; t.escalationAckAt = null; t.state = "owner_review";
      event(t, "escalated", "Owner review", "Escalated to you", { reason, recommended_action: action });
    }
    function criticalAction(code, n) {
      return code === "WWCC" ? "Stop " + n + " working with children until a current Check is verified with the Office of the Children’s Guardian."
        : code === "FIRST_AID" ? "Don’t count " + n + " towards first aid cover (Reg. 136). Check the roster has another qualified educator on every shift."
        : code === "CPR" ? "Don’t count " + n + " towards first aid cover until CPR is renewed. Check the roster."
        : "Make sure another educator with current anaphylaxis training is on every shift until " + n + " renews.";
    }

    function run(trigger) {
      const n = { detected: 0, requests: 0, follow_ups: 0, escalated: 0, resolved: 0, reprioritised: 0 };
      const d = day();
      S.staff.filter((s) => !s.owner).forEach((s) => REQUIRED.forEach((code) => {
        const cert = s.certs[code];
        const days = cert ? daysFrom(cert.expiry, d) : null;
        let t = openTask(s.id, code);
        const pending = !!pendingSub(s.id, code);
        if (cert && days > WINDOW) {
          if (t && !pending) { t.state = "resolved"; t.resolvedAt = now().toISOString(); t.resolution = "Credential current"; event(t, "resolved", "Resolved", "Renewal complete", { expiry_date: cert.expiry }); n.resolved++; }
          return;
        }
        const prio = priorityOf(days, !cert);
        const reason = !cert ? "No " + TYPE[code] + " on file" : days < 0 ? "Expired " + fmtDate(cert.expiry) : days === 0 ? "Expires today" : "Expires in " + days + " day" + (days === 1 ? "" : "s") + " (" + fmtDate(cert.expiry) + ")";
        if (!t) {
          t = { id: uid(), staffId: s.id, code, priority: prio, state: pending ? "owner_review" : "monitoring", reason, expiry: cert ? cert.expiry : null, requestsSent: 0, lastRequestAt: null, nextFollowUp: null,
                escalatedAt: null, escalationReason: null, recommendedAction: null, escalationAckAt: null, token: "demo-" + uid(), openedAt: now().toISOString(), updatedAt: now().toISOString(), resolvedAt: null, resolution: null };
          S.tasks.push(t);
          event(t, "detected", "Monitoring", PRIO[prio].label + " priority detected", { priority: prio, reason });
          n.detected++;
        } else {
          if (PRIO[prio].rank > PRIO[t.priority].rank) {
            event(t, "reprioritised", "Monitoring", "Priority raised to " + prio, { from: t.priority, to: prio, reason });
            n.reprioritised++;
            if (t.requestsSent > 0) t.nextFollowUp = t.nextFollowUp && t.nextFollowUp < d ? t.nextFollowUp : d;
          }
          t.priority = prio; t.reason = reason; t.expiry = cert ? cert.expiry : null; t.updatedAt = now().toISOString();
        }
        if (pending) { t.state = "owner_review"; return; }
        if (prio !== "monitor" && t.requestsSent === 0) {
          send(t, "request"); n.requests++;
          if (!s.email && !s.phone && !t.escalatedAt) { escalate(t, "No email or mobile number on file, so " + first(s.name) + " can’t be contacted.", "Add contact details to the staff record, or give " + first(s.name) + " the upload link in person."); n.escalated++; }
        } else if (t.requestsSent > 0 && t.nextFollowUp && t.nextFollowUp <= d) {
          send(t, "follow_up"); n.follow_ups++;
        }
        if (!t.escalatedAt) {
          if (prio === "critical") {
            escalate(t, !cert ? first(s.name) + " has no " + TYPE[code] + " on file." : first(s.name) + "’s " + TYPE[code] + " expired on " + fmtDate(cert.expiry) + ".", criticalAction(code, first(s.name)));
            n.escalated++;
          } else if (t.requestsSent >= 3) {
            escalate(t, first(s.name) + " hasn’t responded to " + t.requestsSent + " requests.", "Speak to " + first(s.name) + " directly and agree a date to renew."); n.escalated++;
          }
        }
        if (t.state === "owner_review" && t.escalationAckAt) t.state = t.requestsSent > 0 ? "waiting" : "monitoring";
        else if (t.state === "monitoring" && t.requestsSent > 0) t.state = "waiting";
      }));
      S.runs.push({ at: now().toISOString(), trigger, summary: n });
      if (S.runs.length > 50) S.runs.shift();
      save();
      return Object.assign({ ran_at: now().toISOString() }, n);
    }

    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z ]+/g, " ").trim();
    function submit(staffId, code, f) {
      const s = staff(staffId);
      if (!s) throw new Error("Staff record not found.");
      const d = day();
      if (f.expiry && f.expiry < d) throw new Error("That expiry date has already passed");
      if (f.hash) {
        const dup = S.subs.filter((x) => x.staffId === staffId && x.hash === f.hash && (x.status === "pending" || x.status === "approved")).pop();
        if (dup) throw new Error("This file was already uploaded on " + fmtDate(dup.submittedAt.slice(0, 10)) + " and is " + (dup.status === "pending" ? "waiting for the centre to check it." : "already approved."));
      }
      const ext = f.extracted || {};
      const checks = [];
      const cur = s.certs[code] ? s.certs[code].expiry : null;
      if (!ext.readable) checks.push({ field: "document", issue: "unreadable", message: "beehive couldn’t read any text on this file. Check it’s a clear photo or PDF of the right certificate." });
      else {
        if (!ext.name) checks.push({ field: "name", issue: "missing", message: "No name found on the certificate." });
        else if (!norm(s.name).split(" ").every((p) => !p || norm(ext.name).includes(p))) checks.push({ field: "name", issue: "mismatch", message: "The name on the certificate (" + ext.name + ") doesn’t match " + s.name + "." });
        if (!ext.type_code) checks.push({ field: "type", issue: "missing", message: "Couldn’t tell which credential this is." });
        else if (ext.type_code !== code) checks.push({ field: "type", issue: "mismatch", message: "This looks like a " + TYPE[ext.type_code] + ", not a " + TYPE[code] + "." });
        if (!ext.expiry_date) checks.push({ field: "expiry_date", issue: "missing", message: "No expiry date found on the certificate." });
        else {
          if (ext.expiry_date < d) checks.push({ field: "expiry_date", issue: "expired", message: "The certificate expired on " + fmtDate(ext.expiry_date) + "." });
          else if (cur && ext.expiry_date <= cur) checks.push({ field: "expiry_date", issue: "not_newer", message: "The expiry date (" + fmtDate(ext.expiry_date) + ") isn’t later than the one on file (" + fmtDate(cur) + "). This may be the old certificate." });
          if (f.expiry && f.expiry !== ext.expiry_date) checks.push({ field: "expiry_date", issue: "differs", message: "The date entered (" + fmtDate(f.expiry) + ") differs from the date read from the certificate (" + fmtDate(ext.expiry_date) + ")." });
        }
        if (ext.issue_date && ext.issue_date > d) checks.push({ field: "issue_date", issue: "future", message: "The issue date is in the future." });
      }
      (ext.uncertain || []).forEach((u) => checks.push({ field: "document", issue: "uncertain", message: u }));
      const flag = !ext.readable ? "unreadable" : checks.length ? "needs_check" : "clear";
      S.subs.filter((x) => x.staffId === staffId && x.code === code && x.status === "pending").forEach((x) => { x.status = "rejected"; x.reviewNote = "Replaced by a newer upload"; x.reviewedAt = now().toISOString(); });
      let t = openTask(staffId, code);
      if (!t) {
        const days = cur ? daysFrom(cur, d) : null;
        t = { id: uid(), staffId, code, priority: priorityOf(days, !cur), state: "owner_review", reason: "Renewal uploaded", expiry: cur, requestsSent: 0, lastRequestAt: null, nextFollowUp: null, escalatedAt: null, escalationReason: null,
              recommendedAction: null, escalationAckAt: null, token: "demo-" + uid(), openedAt: now().toISOString(), updatedAt: now().toISOString(), resolvedAt: null, resolution: null };
        S.tasks.push(t);
      } else t.state = "owner_review";
      const sub = { id: uid(), staffId, code, taskId: t.id, fileName: f.fileName || "", fileData: f.fileData || null, hash: f.hash || "", number: ext.number || "", issue: f.issue || ext.issue_date || null,
                    expiry: f.expiry || ext.expiry_date || null, extracted: ext, checks, flag, status: "pending", source: f.source || "app", submittedAt: now().toISOString() };
      S.subs.push(sub);
      event(t, "upload_received", "Owner review", "Certificate uploaded", { submission_id: sub.id, source: sub.source, file_name: sub.fileName, extracted_expiry: ext.expiry_date || null });
      event(t, "flagged", "Owner review", flag === "unreadable" ? "Upload unreadable: needs checking" : flag === "needs_check" ? "Upload needs checking" : "Ready for your verification", { submission_id: sub.id, checks });
      save();
      return { id: sub.id, flag, checks };
    }

    function verify(subId, approve, expiry, reason) {
      const sub = S.subs.find((x) => x.id === subId);
      if (!sub) throw new Error("Submission not found");
      if (sub.status !== "pending") throw new Error("This upload has already been " + (sub.status === "approved" ? "approved." : "rejected or replaced."));
      const t = S.tasks.find((x) => x.id === sub.taskId) || openTask(sub.staffId, sub.code);
      const s = staff(sub.staffId);
      if (approve) {
        const exp = expiry || sub.expiry;
        if (!exp) throw new Error("Enter the expiry date before approving.");
        if (exp < day()) throw new Error("That expiry date has already passed, so the certificate can’t be approved.");
        s.certs[sub.code] = Object.assign({}, s.certs[sub.code] || {}, { expiry: exp, issue: sub.issue || (s.certs[sub.code] || {}).issue || null, number: sub.number || (s.certs[sub.code] || {}).number || "", verifiedAt: now().toISOString() });
        sub.status = "approved"; sub.expiry = exp; sub.reviewedAt = now().toISOString(); sub.reviewNote = reason || "";
        if (t) {
          event(t, "approved", "Resolved", "Certificate verified", { submission_id: sub.id, expiry_date: exp });
          event(t, "record_updated", "Resolved", "Staff record updated", { expiry_date: exp, verified_at: now().toISOString() });
          t.state = "resolved"; t.resolvedAt = now().toISOString(); t.resolution = "Renewed until " + fmtDate(exp); t.expiry = exp;
          event(t, "resolved", "Resolved", "Renewal task closed", { expiry_date: exp });
        }
        save();
        return { approved: true, expiry_date: exp };
      }
      if (!String(reason || "").trim()) throw new Error("Say why the upload is being rejected, so the educator knows what to fix.");
      sub.status = "rejected"; sub.reviewedAt = now().toISOString(); sub.reviewNote = reason;
      if (t) { t.state = "waiting"; event(t, "rejected", "Action taken", "Upload rejected", { submission_id: sub.id, reason }); send(t, "correction", reason); }
      save();
      return { approved: false };
    }
    function ack(taskId) {
      const t = S.tasks.find((x) => x.id === taskId);
      if (!t || !t.escalatedAt || t.escalationAckAt) throw new Error("There’s nothing to acknowledge on this task.");
      t.escalationAckAt = now().toISOString();
      t.state = S.subs.some((x) => x.taskId === t.id && x.status === "pending") ? "owner_review" : t.requestsSent > 0 ? "waiting" : "monitoring";
      event(t, "escalation_acknowledged", "Waiting", "You acknowledged the escalation", {});
      save();
    }
    function sendNow(taskId) {
      const t = S.tasks.find((x) => x.id === taskId);
      if (!t || t.state === "resolved") throw new Error("This renewal is already complete.");
      const m = send(t, t.requestsSent === 0 ? "request" : "follow_up");
      save();
      return m;
    }
    function uploadInfo(token) {
      const t = S.tasks.find((x) => x.token === token && x.state !== "resolved");
      if (!t) return null;
      const s = staff(t.staffId);
      return { first_name: first(s.name), full_name: s.name, centre: S.centre, credential: TYPE[t.code], type_code: t.code, expiry_date: t.expiry, staff_id: s.id,
               pending: S.subs.some((x) => x.taskId === t.id && x.status === "pending") };
    }

    // Build the offline store from the demo educators, with the same history as supabase/seed_demo.sql.
    function seed(educators) {
      const base = today();
      S = { v: 1, seq: 0, centre: typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "Beehive Early Learning", owner: typeof OWNER_NAME !== "undefined" ? OWNER_NAME : "Sara Williams", staff: [], tasks: [], messages: [], events: [], subs: [], runs: [] };
      educators.forEach((e, i) => {
        const certs = {};
        e.certs.forEach((c) => { const code = CODE_OF[c.type] || c.code; if (code && c.days != null && !c.missing) certs[code] = { expiry: addDays(base, c.days), issue: null, number: "", verifiedAt: null }; });
        S.staff.push({ id: e.id, name: e.name, room: e.room, role: e.role, email: first(e.name).toLowerCase() + "@example.com", phone: "04 0000 " + String(1001 + i), certs });
      });
      const by = (n) => S.staff.find((s) => s.name === n);
      const mia = by("Mia Chen"); if (mia) mia.email = "mia@beehive.demo";
      const leo = by("Leo Thompson"); if (leo) { leo.email = ""; if (leo.certs.CPR) leo.certs.CPR.expiry = addDays(base, 20); }
      const jack = by("Jack Wilson"); if (jack) delete jack.certs.ANAPHYLAXIS;
      const oliver = by("Oliver King");
      // three days ago Oliver's First Aid was still 33 days out, so the agent only watched it
      if (oliver && oliver.certs.FIRST_AID) oliver.certs.FIRST_AID.expiry = addDays(base, 33);
      S.seeding = true;
      run("seed");
      // that run happened three days ago
      const back = (iso) => (iso ? new Date(Date.parse(iso) - 3 * 864e5).toISOString() : iso);
      S.events.forEach((e) => (e.at = back(e.at)));
      S.runs.forEach((r) => (r.at = back(r.at)));
      S.messages.forEach((m) => { m.at = back(m.at); m.nextFollowUp = m.nextFollowUp && addDays(m.nextFollowUp, -3); });
      S.tasks.forEach((t) => { t.openedAt = back(t.openedAt); t.updatedAt = back(t.updatedAt); t.lastRequestAt = back(t.lastRequestAt); t.escalatedAt = back(t.escalatedAt); t.nextFollowUp = t.nextFollowUp && addDays(t.nextFollowUp, -3); });
      if (oliver && oliver.certs.FIRST_AID) oliver.certs.FIRST_AID.expiry = addDays(base, 30);
      // yesterday Amara uploaded her old Working with Children Check
      offset = -1 * 864e5;
      const amara = by("Amara Singh");
      if (amara && amara.certs.WWCC)
        submit(amara.id, "WWCC", { fileName: "amara-wwcc.jpg", hash: "demo-amara-old-wwcc", source: "link",
          extracted: { readable: true, name: "Amara Singh", type_code: "WWCC", number: "WWC0458812E", issue_date: addDays(amara.certs.WWCC.expiry, -1825), expiry_date: amara.certs.WWCC.expiry, demo: true } });
      offset = 0;
      S.seeding = false;
      save();
    }
    function load(educators) {
      try { S = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { S = null; }
      if (!S || S.v !== 1) seed(educators);
      return S;
    }
    function reset() { try { localStorage.removeItem(STORE); } catch (e) {} S = null; }

    // the normalised view the interface reads (same shape as the live mapping)
    function view() {
      const d = today();
      const subsPending = S.subs.filter((x) => x.status === "pending");
      const tasks = S.tasks.map((t) => {
        const s = staff(t.staffId) || {};
        const last = S.messages.filter((m) => m.taskId === t.id).pop();
        const ps = subsPending.filter((x) => x.taskId === t.id).pop();
        return Object.assign({}, t, { staffName: s.name, room: s.room || "—", email: s.email, phone: s.phone, typeName: TYPE[t.code], daysLeft: t.expiry ? daysFrom(t.expiry, d) : null,
          lastChannel: last && last.channel, lastKind: last && last.kind, lastRecipient: last && last.recipient, lastMessageAt: last && last.at, pendingSubId: ps && ps.id, pendingFlag: ps && ps.flag });
      });
      const feed = S.events.slice(-150).reverse().map((e) => {
        const s = staff(e.staffId) || {}, t = S.tasks.find((x) => x.id === e.taskId) || {};
        return Object.assign({}, e, { staffName: s.name, typeName: TYPE[e.code], taskState: t.state, taskPriority: t.priority, nextFollowUp: t.nextFollowUp });
      });
      const messages = S.messages.slice().reverse();
      const subs = subsPending.map((x) => Object.assign({}, x, { staffName: (staff(x.staffId) || {}).name, typeName: TYPE[x.code] }));
      return { tasks, feed, messages, subs, lastRun: S.runs[S.runs.length - 1] || null };
    }
    function certsFor(id) { const s = staff(id); return s ? s.certs : {}; }
    function contactFor(id) { const s = staff(id); return s ? { email: s.email, phone: s.phone } : {}; }
    return { load, run, submit, verify, ack, sendNow, uploadInfo, view, reset, certsFor, contactFor };
  })();

  // =====================================================================================
  // Loading
  // =====================================================================================
  // Offline: build or read the browser store, run the loop, and mirror the credential dates onto the demo educators.
  function loadOffline() {
    Engine.load(typeof educators !== "undefined" ? educators : []);
    const r = Engine.run("app");
    data = Object.assign({ available: true, mode: "offline", error: "" }, Engine.view());
    syncEducators();
    return r;
  }
  function syncEducators() {
    if (isLive() || typeof educators === "undefined") return;
    educators.forEach((e) => {
      const certs = Engine.certsFor(e.id);
      e.certs = REQUIRED.map((code) => {
        const old = e.certs.find((c) => (CODE_OF[c.type] || c.code) === code) || {};
        const c = certs[code];
        if (!c) return { type: SHORT[code], code, expiry: "Not on file", days: -1, missing: true };
        return Object.assign({}, old, { type: SHORT[code], code, missing: false, expiryISO: c.expiry, expiry: fmtDate(c.expiry), days: daysFrom(c.expiry), approvedAt: c.verifiedAt ? new Date(c.verifiedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : old.approvedAt || "" });
      });
      const t = data.tasks.filter((x) => x.staffId === e.id && x.state !== "resolved").sort((a, b) => PRIO[b.priority].rank - PRIO[a.priority].rank)[0];
      e.alertState = t ? TASK_STATE[t.state] + ": " + SHORT[t.code] : "";
    });
    if (typeof pendingSubmission !== "undefined") pendingSubmission = null;
    if (typeof persist === "function") persist();
  }

  // Live: the owner's first load runs the agent; every load reads its tables.
  async function loadLive(sb, opts) {
    const isLead = leader();
    let run = null;
    try {
      if (isLead && opts && opts.run) run = (await sb.rpc("run_staff_agent")).data || null;
      else if (opts && opts.staffRun) run = opts.staffRun;
      const sel = (p) => p.then((r) => { if (r.error) throw r.error; return r.data || []; });
      const [tasks, feed, msgs, subs, runs] = await Promise.all([
        sel(sb.from("v_credential_tasks").select("*").order("opened_at", { ascending: false }).limit(400)),
        isLead ? sel(sb.from("v_agent_feed").select("*").order("id", { ascending: false }).limit(300)).then((r) => r.filter((e) => (e.agent || "staff") === "staff").slice(0, 150)) : Promise.resolve([]),
        sel(sb.from("agent_messages").select("*").order("sent_at", { ascending: false }).limit(300)).then((r) => r.filter((m) => m.task_id)),
        sel(sb.from("certificate_submissions").select("*, staff(full_name), certificate_types(code)").eq("status", "pending").order("submitted_at")),
        isLead ? sel(sb.from("agent_runs").select("*").order("ran_at", { ascending: false }).limit(10)).then((r) => r.filter((x) => (x.agent || "staff") === "staff")) : Promise.resolve([]),
      ]);
      data = {
        available: true, mode: "live", error: "",
        tasks: tasks.map((t) => ({
          id: t.id, staffId: t.staff_id, staffName: t.staff_name, room: t.room, email: t.email, phone: t.phone, code: t.type_code, typeName: TYPE[t.type_code] || t.type_name,
          priority: t.priority, state: t.state, reason: t.reason, expiry: t.expiry_date, daysLeft: t.days_left, requestsSent: t.requests_sent, lastRequestAt: t.last_request_at,
          nextFollowUp: t.next_follow_up, escalatedAt: t.escalated_at, escalationReason: t.escalation_reason, recommendedAction: t.recommended_action, escalationAckAt: t.escalation_ack_at,
          token: t.upload_token, openedAt: t.opened_at, resolvedAt: t.resolved_at, resolution: t.resolution, pendingSubId: t.pending_submission_id, pendingFlag: t.pending_flag,
          lastChannel: t.last_channel, lastKind: t.last_kind, lastRecipient: t.last_recipient, lastMessageAt: t.last_message_at,
        })),
        feed: feed.map((e) => ({ id: e.id, taskId: e.task_id, staffId: e.staff_id, staffName: e.staff_name, code: e.type_code, typeName: TYPE[e.type_code] || e.type_name, kind: e.kind, state: e.state,
          summary: e.summary, detail: e.detail || {}, demo: e.demo, at: e.created_at, taskState: e.task_state, taskPriority: e.task_priority, nextFollowUp: e.next_follow_up })),
        messages: msgs.map((m) => ({ id: m.id, taskId: m.task_id, staffId: m.staff_id, kind: m.kind, channel: m.channel, recipient: m.recipient, subject: m.subject, body: m.body,
          link: m.upload_link ? m.upload_link.replace(/^\/?/, "") : "", outcome: m.outcome, at: m.sent_at, nextFollowUp: m.next_follow_up })),
        subs: subs.map((x) => ({ id: x.id, taskId: x.task_id, staffId: x.staff_id, staffName: x.staff ? x.staff.full_name : "", code: x.certificate_types && x.certificate_types.code,
          typeName: TYPE[x.certificate_types && x.certificate_types.code] || "Certificate", fileName: x.file_name || (x.file_path ? String(x.file_path).split("/").pop().replace(/^\d+-/, "") : ""),
          fileData: x.file_data, filePath: x.file_path, number: x.certificate_number, issue: x.issue_date, expiry: x.expiry_date, extracted: x.extracted || {}, checks: x.checks || [],
          flag: x.review_flag || "needs_check", source: x.source, submittedAt: x.submitted_at })),
        lastRun: runs[0] ? { at: runs[0].ran_at, trigger: runs[0].trigger, summary: runs[0].summary } : run ? { at: run.ran_at, summary: run } : null,
      };
      if (run && opts && opts.announce) announce(run, opts.auditRun);
    } catch (e) {
      const m = (e && e.message) || String(e);
      data = { available: false, mode: "live", error: /does not exist|Could not find|schema cache/i.test(m) ? "setup" : m, tasks: [], feed: [], messages: [], subs: [], lastRun: null };
    }
    return run;
  }

  function announce(r, ra) {
    if (!r && !ra) return;
    r = r || {};
    const parts = [];
    if (r.requests) parts.push(r.requests + " renewal request" + (r.requests === 1 ? "" : "s"));
    if (r.follow_ups) parts.push(r.follow_ups + " follow-up" + (r.follow_ups === 1 ? "" : "s"));
    if (r.escalated) parts.push(r.escalated + " escalation" + (r.escalated === 1 ? "" : "s"));
    if (r.resolved) parts.push(r.resolved + " resolved");
    if (ra && !ra.skipped) {
      if (ra.gaps) parts.push(ra.gaps + " requirement gap" + (ra.gaps === 1 ? "" : "s") + " found");
      if (ra.requests) parts.push(ra.requests + " evidence request" + (ra.requests === 1 ? "" : "s"));
      if (ra.follow_ups) parts.push(ra.follow_ups + " evidence follow-up" + (ra.follow_ups === 1 ? "" : "s"));
      if (ra.regulation_updates) parts.push(ra.regulation_updates + " regulation update assessed");
      if (ra.resolved) parts.push(ra.resolved + " audit action" + (ra.resolved === 1 ? "" : "s") + " closed");
    }
    toast(parts.length ? "beehive checked every credential and requirement: " + parts.join(", ") + ". Messages are simulated." : "beehive checked every credential and requirement. Nothing new needed action.");
  }

  // =====================================================================================
  // Actions
  // =====================================================================================
  let pendingCause = null;
  const causeFor = (staffId, code, what) => ({ text: (staffNameOf(staffId) || "An educator") + "’s " + TYPE[code] + " " + what, staffId, code, staffName: staffNameOf(staffId) });
  async function refresh(page) {
    const cause = pendingCause; pendingCause = null;
    if (isLive()) {
      if (typeof AuditAgent !== "undefined" && AuditAgent.active()) await AuditAgent.runRemote();
      await Live.reload(page);
    } else {
      data = Object.assign({ available: true, mode: "offline", error: "" }, Engine.view()); syncEducators();
      if (typeof AuditAgent !== "undefined" && AuditAgent.active()) AuditAgent.runOffline(cause);
      if (page) current = page;
      render();
    }
  }
  async function guard(fn, ok) {
    try { const r = await fn(); if (ok) toast(typeof ok === "function" ? ok(r) : ok); return r; }
    catch (e) { toast((e && e.message) || String(e)); throw e; }
  }
  const rpc = async (name, args) => { const r = await Live.client().rpc(name, args); if (r.error) throw new Error(Live.explain(r.error)); return r.data; };

  async function runNow() {
    if (running) return;
    running = true;
    try {
      let r;
      let ra = null;
      if (isLive()) {
        r = await guard(() => rpc("run_staff_agent"));
        if (typeof AuditAgent !== "undefined") ra = await AuditAgent.runRemote();
        await Live.reload();
      } else {
        r = Engine.run("app");
        if (typeof AuditAgent !== "undefined") ra = AuditAgent.runOffline();
        await refresh();
      }
      announce(r, ra);
    } finally { running = false; }
  }
  async function sendNow(taskId) {
    await guard(() => (isLive() ? rpc("agent_send_now", { p_task: taskId }) : Engine.sendNow(taskId)), "Reminder recorded as sent (simulated, nothing left beehive).");
    closeModal(); await refresh(); openTask(taskId);
  }
  async function acknowledge(taskId) {
    await guard(() => (isLive() ? rpc("acknowledge_escalation", { p_task: taskId, p_note: "" }) : Engine.ack(taskId)), "Escalation acknowledged. beehive keeps chasing the renewal.");
    closeModal(); await refresh();
  }
  async function decide(subId, approve) {
    const sub = data.subs.find((x) => x.id === subId);
    if (!sub) return toast("This upload has already been dealt with.");
    if (approve) {
      const expiry = (document.getElementById("verifyExpiry") || {}).value || sub.expiry;
      const confirm = document.getElementById("verifyConfirm");
      if (sub.flag !== "clear" && confirm && !confirm.checked) return toast("Tick the box to confirm you’ve checked the flagged details against the certificate.");
      const btn = document.getElementById("verifyApprove"); if (btn) btn.disabled = true;
      try {
        await guard(() => (isLive() ? rpc("verify_certificate", { p_submission: subId, p_approve: true, p_expiry: expiry || null, p_reason: "" }) : Engine.verify(subId, true, expiry, "")),
          sub.staffName + "’s " + sub.typeName + " is verified. The record is updated, the renewal task is closed and compliance is refreshed.");
      } catch (e) { if (btn) btn.disabled = false; return; }
      pendingCause = causeFor(sub.staffId, sub.code, "was verified");
    } else {
      const reason = ((document.getElementById("rejectReason") || {}).value || "").trim();
      if (!reason) { const el = document.getElementById("rejectReason"); if (el) el.focus(); return toast("Add a reason so " + first(sub.staffName) + " knows what to fix."); }
      await guard(() => (isLive() ? rpc("verify_certificate", { p_submission: subId, p_approve: false, p_expiry: null, p_reason: reason }) : Engine.verify(subId, false, null, reason)),
        "Upload rejected. The record is unchanged and beehive asked " + first(sub.staffName) + " for a corrected upload (simulated).");
      pendingCause = causeFor(sub.staffId, sub.code, "upload was rejected");
    }
    closeModal();
    await refresh();
  }

  // =====================================================================================
  // Presentation helpers
  // =====================================================================================
  function prioTag(p) { const x = PRIO[p] || PRIO.monitor; return '<span class="status ' + x.cls + '">' + x.label + "</span>"; }
  function stateTag(s) { const label = TASK_STATE[s] || s; return '<span class="status ' + (STATE_CLASS[label] || "neutral") + '">' + E(label) + "</span>"; }
  const open = () => data.tasks.filter((t) => t.state !== "resolved");
  const byPriority = (a, b) => PRIO[b.priority].rank - PRIO[a.priority].rank || (a.daysLeft == null ? -1 : a.daysLeft) - (b.daysLeft == null ? -1 : b.daysLeft);
  function counts() {
    const o = open();
    const since = Date.now() - 7 * 864e5;
    const handled = data.feed.filter((e) => Date.parse(e.at) > since && ["request_sent", "follow_up_sent", "correction_requested", "detected", "reprioritised", "upload_received", "flagged", "record_updated", "escalated", "resolved"].includes(e.kind)).length;
    return {
      handled, owner: o.filter((t) => t.state === "owner_review").length, waiting: o.filter((t) => t.state === "waiting").length, monitoring: o.filter((t) => t.state === "monitoring").length,
      critical: o.filter((t) => t.priority === "critical").length, high: o.filter((t) => t.priority === "high").length, medium: o.filter((t) => t.priority === "medium").length, monitor: o.filter((t) => t.priority === "monitor").length,
      reviews: data.subs.length,
    };
  }
  function channelLabel(c) { return c === "sms" ? "SMS" : c === "email" ? "email" : "no contact"; }
  function lastAction(t) {
    if (t.pendingSubId) return "Upload received, waiting for your verification";
    if (!t.lastMessageAt) return t.state === "monitoring" ? "Watching. A request goes out at 30 days" : "";
    const what = t.lastKind === "follow_up" ? "Follow-up" : t.lastKind === "correction" ? "Correction request" : "Request";
    return what + " sent " + relTime(t.lastMessageAt).toLowerCase() + " by " + channelLabel(t.lastChannel) + " (simulated)";
  }
  function nextStep(t) {
    if (t.state === "owner_review") return t.pendingSubId ? "Verify the upload" : "Your decision";
    if (t.state === "waiting" && t.nextFollowUp) return t.nextFollowUp <= today() ? "Follow-up due today" : "Follow-up " + fmtShort(t.nextFollowUp);
    if (t.state === "monitoring") return t.daysLeft != null ? "Request at 30 days" : "";
    return t.resolution || "";
  }
  function taskAction(t) {
    if (t.pendingSubId) return { label: "Review", act: "StaffAgent.openReview('" + t.pendingSubId + "')" };
    if (t.escalatedAt && !t.escalationAckAt) return { label: "Decide", act: "StaffAgent.openTask('" + t.id + "')" };
    return { label: "Open", act: "StaffAgent.openTask('" + t.id + "')" };
  }
  function taskRow(t) {
    const a = taskAction(t);
    return (
      '<button class="row agentRow" onclick="' + a.act + '"><span class="rowMain"><b>' + E(t.staffName) + ' <span class="muted">· ' + E(SHORT[t.code]) + "</span></b>" +
      "<small>" + E(t.reason) + (lastAction(t) ? ". " + E(lastAction(t)) : "") + "</small></span>" +
      '<span class="rowMeta">' + E(nextStep(t)) + "</span>" +
      '<span class="rowEnd">' + prioTag(t.priority) + stateTag(t.state) + "</span></button>"
    );
  }

  // ---------- owner decisions (Overview "Needs your decision") ----------
  function decisions() {
    const out = [];
    data.subs.slice().sort((a, b) => (a.flag === "clear") - (b.flag === "clear")).forEach((s) => {
      const first = (s.checks || [])[0];
      out.push({ kind: s.flag === "clear" ? "Verify certificate" : "Check flagged upload", who: s.staffName, detail: s.typeName + ". " + (first ? first.message : "All details match the record. Verify and approve."),
                 act: "StaffAgent.openReview('" + s.id + "')", btn: "Review", urgent: s.flag !== "clear" });
    });
    open().filter((t) => t.escalatedAt && !t.escalationAckAt).sort(byPriority).forEach((t) =>
      out.push({ kind: "Escalated: " + PRIO[t.priority].label.toLowerCase(), who: t.staffName + ", " + SHORT[t.code], detail: t.escalationReason + " " + (t.recommendedAction || ""), act: "StaffAgent.openTask('" + t.id + "')", btn: "Decide", urgent: t.priority === "critical" }));
    return out;
  }

  // ---------- Overview: what the agent has done, is waiting for and needs ----------
  // ---------- Overview: one view of both agents, from the same records every page uses ----------
  const auditOn = () => typeof AuditAgent !== "undefined" && AuditAgent.active() && typeof approved !== "undefined" && approved;
  const RANK = { critical: 4, high: 3, medium: 2, monitor: 1, low: 1 };
  // everything beehive has found that isn't resolved yet, highest priority first
  function detectedItems() {
    const out = [];
    open().forEach((t) => {
      const req = auditOn() ? AuditAgent.requirementForCode(t.code) : null;
      out.push({ rank: RANK[t.priority] || 1, source: "Staff credential", title: t.staffName + " · " + SHORT[t.code], detail: t.reason + (req ? ". Counts towards “" + req.title + "”" : ""),
                 tags: prioTag(t.priority) + stateTag(t.state), act: taskAction(t).act, next: nextStep(t) });
    });
    if (auditOn()) {
      (typeof items !== "undefined" ? items : []).forEach((x) => {
        const r = AuditAgent.reqOf(x), m = AuditAgent.meta(x);
        if (r.status === "compliant" || m.kind === "certificates") return; // credential requirements are the renewals above
        out.push({ rank: RANK[r.priority] || 1, source: "Audit requirement", title: x.title, detail: r.reason, tags: AuditAgent.prioTag(r.priority) + AuditAgent.statusTagHtml(r.status), act: "openItem('" + x.id + "')", next: r.nextAction });
      });
      AuditAgent.data().updates.filter((u) => u.status === "assessed").forEach((u) =>
        out.push({ rank: 2, source: "Regulation change", title: u.title, detail: u.assessment, tags: '<span class="status crit">Owner review</span>', act: "go('updates')", next: "Record whether anything needs to change." }));
    }
    return out.sort((a, b) => b.rank - a.rank);
  }
  // requests beehive sent that are waiting for someone else to respond
  function waitingItems() {
    const out = open().filter((t) => t.state === "waiting").map((t) => ({ who: t.staffName, what: SHORT[t.code] + " renewal", since: t.lastMessageAt, next: t.nextFollowUp, act: "StaffAgent.openTask('" + t.id + "')" }));
    if (auditOn()) AuditAgent.data().tasks.filter((t) => t.state === "waiting" && t.assigneeId).forEach((t) =>
      out.push({ who: t.assigneeName, what: t.itemTitle, since: t.lastMessageAt, next: t.nextFollowUp, act: "AuditAgent.openTask('" + t.id + "')" }));
    return out.sort((a, b) => String(a.next || "9").localeCompare(String(b.next || "9")));
  }
  function doneThisWeek() {
    const since = Date.now() - 7 * 864e5;
    const real = (e) => !e.demo && Date.parse(e.at) > since && ["Action taken", "Resolved"].includes(e.state) && !/^(You |Reminder approved by you)/.test(e.summary);
    return data.feed.filter(real).length + (auditOn() ? AuditAgent.data().events.filter(real).length : 0);
  }
  function overviewSummary() {
    const att = typeof attentionItems === "function" ? attentionItems() : decisions();
    const det = detectedItems(), wait = waitingItems();
    const a = auditOn() ? AuditAgent.counts() : {};
    const last = [data.lastRun && data.lastRun.at, a.lastRun].filter(Boolean).sort().pop();
    const stat2 = (n, label, act, hot) => '<button onclick="' + act + '" class="' + (hot ? "hot" : "") + '"><b>' + n + "</b><span>" + label + "</span></button>";
    return (
      '<div class="agentStrip"><div class="agentStripHead"><span class="hx"></span><b>beehive</b><span class="muted">Watching staff credentials, audit requirements and regulation changes. ' + (last ? "Last checked " + E(relTime(last).toLowerCase()) : "Not checked yet") + "</span>" +
      (leader() ? '<button class="textButton" onclick="StaffAgent.runNow()">Check now</button>' : "") + "</div>" +
      '<div class="agentStats">' +
      stat2(det.length, "open issues detected", "document.getElementById('detected').scrollIntoView({behavior:'smooth'})") +
      stat2(doneThisWeek(), "actions done this week", "StaffAgent.filter('Action taken')") +
      stat2(wait.length, "waiting on staff", "document.getElementById('waiting').scrollIntoView({behavior:'smooth'})") +
      stat2(att.length, "need you", "document.getElementById('attention').scrollIntoView({behavior:'smooth'})", att.length > 0) +
      "</div></div>"
    );
  }
  let detectedAll = false;
  function detectedHtml(max) {
    const list = detectedItems();
    const shown = detectedAll ? list : list.slice(0, max || 6);
    return (
      '<section class="section" id="detected"><div class="sectionHead"><h2>What beehive detected<span class="count">' + list.length + '</span></h2><p>Highest priority first, across staff credentials, audit requirements and regulation changes</p></div>' +
      (shown.length ? shown.map((x) =>
        '<button class="row agentRow detRow" onclick="' + x.act + '"><span class="rowMain"><span class="srcTag">' + E(x.source) + "</span><b>" + E(x.title) + "</b><small>" + E(x.detail) + (x.next ? " <b>Next:</b> " + E(x.next) : "") + '</small></span><span class="rowEnd">' + x.tags + "</span></button>").join("")
        : '<p class="empty">Nothing open. Every credential and requirement is current.</p>') +
      (list.length > shown.length || detectedAll ? '<button class="textButton moreLink" onclick="StaffAgent.toggleDetected()">' + (detectedAll ? "Show fewer" : "Show all " + list.length) + "</button>" : "") + "</section>"
    );
  }
  function toggleDetected() { detectedAll = !detectedAll; render(); }
  function waitingHtml() {
    const list = waitingItems();
    return (
      '<section class="section" id="waiting"><div class="sectionHead"><h2>Waiting on staff<span class="count">' + list.length + "</span></h2><p>beehive follows up automatically</p></div>" +
      (list.length ? list.slice(0, 6).map((x) =>
        '<button class="row" onclick="' + x.act + '"><span class="rowMain"><b>' + E(x.who || "Staff") + "</b><small>" + E(x.what) + (x.since ? ", asked " + E(relTime(x.since).toLowerCase()) : "") + '</small></span><span class="rowMeta">' + (x.next ? (x.next <= today() ? "Follow-up today" : "Follow-up " + E(fmtShort(x.next))) : "") + "</span></button>").join("") +
        (list.length > 6 ? '<p class="muted small">' + (list.length - 6) + " more in Staff certifications and Audit readiness</p>" : "")
        : '<p class="empty">No one owes beehive a response.</p>') + "</section>"
    );
  }
  function renewalsCompact(max) {
    const list = open().sort(byPriority);
    if (!list.length) return '<p class="empty">Every credential is current for at least 60 days.</p>';
    const groups = ["critical", "high", "medium", "monitor"].map((p) => [p, list.filter((t) => t.priority === p)]).filter((g) => g[1].length);
    return groups.map(([p, l]) =>
      '<div class="credGroup"><p class="subhead"><span>' + PRIO[p].label + ' <span class="muted">' + prioRange(p) + '</span></span><span class="muted num">' + l.length + "</span></p>" +
      l.slice(0, max).map((t) =>
        '<button class="row" onclick="' + taskAction(t).act + '"><span class="rowMain"><b>' + E(t.staffName) + "</b><small>" + E(SHORT[t.code]) + ", " + E(t.reason) + "</small></span>" + stateTag(t.state) + "</button>").join("") +
      (l.length > max ? '<button class="textButton moreLink" onclick="go(\'staff\')">' + (l.length - max) + " more in Staff certifications</button>" : "") + "</div>").join("");
  }
  function prioRange(p) { return p === "critical" ? "expired or missing" : p === "high" ? "7 days or less" : p === "medium" ? "30 days or less" : "within 60 days"; }

  // ---------- Agent activity feed ----------
  const FILTERS = ["All", "Owner review", "Action taken", "Waiting", "Monitoring", "Resolved"];
  function feedLine(e) {
    const d = e.detail || {};
    if (e.kind === "request_sent" || e.kind === "follow_up_sent" || e.kind === "correction_requested")
      return d.channel === "none" ? "No email or mobile on file, so nothing could be sent" : "Simulated " + channelLabel(d.channel) + " to " + (d.recipient || "") + (d.next_follow_up ? ". Follow-up " + fmtShort(d.next_follow_up) : "");
    if (e.kind === "detected" || e.kind === "reprioritised") return d.reason || "";
    if (e.kind === "flagged") return (d.checks || []).length ? (d.checks || []).map((c) => c.message).slice(0, 2).join(" ") : "Name, credential and dates match the record";
    if (e.kind === "upload_received") return (d.source === "link" ? "Through the secure upload link" : d.source === "owner" ? "Uploaded by the centre" : "From the educator") + (d.extracted_expiry ? ". Expiry read as " + fmtDate(d.extracted_expiry) : "");
    if (e.kind === "escalated") return (d.reason || "") + " " + (d.recommended_action || "");
    if (e.kind === "rejected") return d.reason || "";
    if (e.kind === "approved" || e.kind === "record_updated" || e.kind === "resolved") return d.expiry_date ? "Now valid until " + fmtDate(d.expiry_date) : "";
    return "";
  }
  function feedAction(e) {
    const t = data.tasks.find((x) => x.id === e.taskId);
    if (t && t.state !== "resolved") {
      if (t.pendingSubId) return { label: "Review", act: "StaffAgent.openReview('" + t.pendingSubId + "')" };
      if (t.escalatedAt && !t.escalationAckAt) return { label: "Decide", act: "StaffAgent.openTask('" + t.id + "')" };
      return { label: "", act: "StaffAgent.openTask('" + t.id + "')" };
    }
    return { label: "", act: e.staffId ? "openStaffDetail('" + e.staffId + "')" : "" };
  }
  // (Earlier versions mixed other app activity into this feed with approximate times. The feed now holds only
  // the agents' own records, each with its real timestamp.)
  function otherActivity() {
    return [];
  }
  function unusedOtherActivity() {
    if (typeof hiveActivity !== "function") return [];
    const map = { done: "Resolved", progress: "Waiting", watch: "Monitoring" };
    const audit = typeof AuditAgent !== "undefined" && AuditAgent.active();
    return hiveActivity()
      .filter((x) => !/certificate|reminder|credential|expiry|escalated|agent/i.test(x.label + " " + (x.who || "")))
      .filter((x) => !audit || !/evidence|regulation|policy review|checklist|compliance task|task due|drill/i.test(x.label))
      .map((x) => ({ other: true, state: map[x.state] || "Monitoring", summary: x.label, subject: x.who, line: x.sub || "", time: x.time || "", act: x.act || "" }));
  }
  // one shape for every agent's entries: { at, state, summary, subject, line, act, actLabel, now, demo, proposed }
  function staffRows() {
    return data.feed.map((e) => {
      const a = feedAction(e), t = data.tasks.find((x) => x.id === e.taskId);
      return {
        at: e.at, state: e.state, summary: e.summary, subject: (e.staffName || "") + (e.typeName ? ", " + (SHORT[e.code] || e.typeName) : ""),
        line: feedLine(e), act: a.act, actLabel: a.label, demo: e.demo, agent: "staff", simulated: !!(e.detail && e.detail.simulated),
        now: t && t.state !== "resolved" && TASK_STATE[t.state] !== e.state ? stateTag(t.state) : "",
      };
    });
  }
  function rowHtml(x) {
    return (
      '<li class="tlItem ' + (FEED_CLASS[x.state] || "watch") + (x.act ? " link" : "") + '"' + (x.act ? ' tabindex="0" role="button" onclick="' + x.act + '" onkeydown="if(event.key===\'Enter\')this.click()"' : "") + '>' +
      '<span class="tlMark"></span><span class="tlText"><b>' + E(x.summary) + "</b>" + (x.subject ? " <span>" + E(x.subject) + "</span>" : "") +
      (x.line ? "<small>" + E(x.line) + "</small>" : "") +
      '<span class="feedMeta"><span class="status ' + (STATE_CLASS[x.state] || "neutral") + '">' + E(x.state) + "</span>" +
      (x.proposed ? '<span class="proposedTag">Proposed</span>' : "") +
      (x.simulated ? '<span class="simTag">Simulated message</span>' : "") +
      (x.now ? '<span class="nowState">Now ' + x.now + "</span>" : "") + (x.demo ? '<span class="demoTag">Demo history</span>' : "") +
      (x.actLabel ? '<span class="feedAct">' + x.actLabel + "</span>" : "") + "</span></span>" +
      "<time>" + E(x.at ? relTime(x.at) : x.time || "") + "</time></li>"
    );
  }
  function feedHtml(limit) {
    const auditRows = typeof AuditAgent !== "undefined" && AuditAgent.active() ? AuditAgent.feedRows() : [];
    const all = staffRows().concat(auditRows).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const rows = all.filter((x) => feedFilter === "All" || x.state === feedFilter);
    const extra = otherActivity().filter((x) => feedFilter === "All" || x.state === feedFilter);
    const max = limit || 12;
    const shown = rows.slice(0, max).concat(rows.length < max ? extra.slice(0, max - rows.length) : []);
    return (
      '<div class="tabs feedTabs" role="tablist">' + FILTERS.map((f) => '<button class="tab' + (f === feedFilter ? " active" : "") + '" role="tab" aria-selected="' + (f === feedFilter) + '" onclick="StaffAgent.filter(\'' + f + '\')">' + f + "</button>").join("") + "</div>" +
      '<ol class="timeline agentFeed">' + (shown.map(rowHtml).join("") || '<li class="empty">Nothing in this state.</li>') + "</ol>" +
      (rows.length + extra.length > max ? '<button class="textButton" onclick="StaffAgent.more()">Show more</button>' : "") +
      '<p class="footnote"><b>Monitoring</b>: beehive is watching. <b>Action taken</b> and <b>Resolved</b>: done. <b>Waiting</b>: for someone to respond. <b>Owner review</b>: needs your decision. <b>Proposed</b>: a suggestion for you. <b>Simulated message</b>: recorded in beehive, not actually delivered. <b>Demo history</b>: seeded example data, not a real action.</p>'
    );
  }
  let feedLimit = 12;
  function filter(f) { feedFilter = f; feedLimit = 12; if (typeof current !== "undefined" && current !== "overview") current = "overview"; render(); }
  function more() { feedLimit += 20; render(); }

  // ---------- Staff page ----------
  const TABS = [["owner_review", "Needs you"], ["waiting", "Waiting on educators"], ["monitoring", "Monitoring"], ["resolved", "Resolved"]];
  function tab(t) { renewalTab = t; if (typeof current !== "undefined" && current === "staff") render(); }
  function staffSection() {
    if (!data.available) return setupNote();
    const c = counts();
    const list = renewalTab === "resolved"
      ? data.tasks.filter((t) => t.state === "resolved").sort((a, b) => String(b.resolvedAt).localeCompare(String(a.resolvedAt))).slice(0, 12)
      : open().filter((t) => t.state === renewalTab).sort(byPriority);
    const n = { owner_review: c.owner, waiting: c.waiting, monitoring: c.monitoring, resolved: data.tasks.filter((t) => t.state === "resolved").length };
    return (
      (c.owner ? '<div class="callout"><span class="hx lg"></span><div><b>' + c.owner + " renewal" + (c.owner === 1 ? " needs" : "s need") + " your decision</b><p>" +
        (c.reviews ? c.reviews + " uploaded certificate" + (c.reviews === 1 ? "" : "s") + " to verify" : "") + (c.reviews && c.owner - c.reviews > 0 ? ", " : "") + (c.owner - c.reviews > 0 ? c.owner - c.reviews + " escalation" + (c.owner - c.reviews === 1 ? "" : "s") : "") +
        '. beehive has already handled the reminders.</p></div><span class="rowEnd"><button class="button primary" onclick="StaffAgent.nextDecision()">Review next</button></span></div>' : "") +
      '<section class="section"><div class="sectionHead"><h2>Renewals<span class="count">' + open().length + '</span></h2><p>' + (data.lastRun ? "Checked " + E(relTime(data.lastRun.at).toLowerCase()) : "") + "</p></div>" +
      '<div class="summaryLine prioLine">' + stat(c.critical, "critical", c.critical ? "red" : "") + stat(c.high, "high", c.high ? "high" : "") + stat(c.medium, "medium", c.medium ? "yellow" : "") + stat(c.monitor, "monitor") + "</div>" +
      '<div class="tabs" role="tablist">' + TABS.map(([k, l]) => '<button class="tab' + (k === renewalTab ? " active" : "") + '" role="tab" aria-selected="' + (k === renewalTab) + '" onclick="StaffAgent.tab(\'' + k + '\')">' + l + ' <span class="muted num">' + n[k] + "</span></button>").join("") + "</div>" +
      (list.length ? list.map((t) => (t.state === "resolved" ? resolvedRow(t) : taskRow(t))).join("") : '<p class="empty">' + (renewalTab === "owner_review" ? "Nothing needs you. beehive is handling the rest." : "Nothing here right now.") + "</p>") +
      "</section>"
    );
  }
  function resolvedRow(t) {
    return '<button class="row agentRow" onclick="StaffAgent.openTask(\'' + t.id + '\')"><span class="rowMain"><b>' + E(t.staffName) + ' <span class="muted">· ' + E(SHORT[t.code]) + "</span></b><small>" + E(t.resolution || "Resolved") + "</small></span>" +
      '<span class="rowMeta">' + E(relTime(t.resolvedAt)) + '</span><span class="rowEnd">' + stateTag("resolved") + "</span></button>";
  }
  function nextDecision() {
    const d = decisions()[0];
    if (d) new Function(d.act)();
  }
  function setupNote() {
    if (data.error === "setup") return '<div class="callout quiet"><span class="hx lg"></span><div><b>The staff agent isn’t set up in this database yet</b><p>Run supabase/migrations/20261028090000_staff_agent.sql, then supabase/seed_demo.sql, in the Supabase SQL Editor.</p></div></div>';
    if (data.error) return '<div class="callout quiet"><span class="hx lg"></span><div><b>Couldn’t load the staff agent</b><p>' + E(data.error) + "</p></div></div>";
    return "";
  }
  // renewal state for one educator (staff table "Renewal" column)
  function staffState(staffId) {
    const t = open().filter((x) => x.staffId === staffId).sort(byPriority)[0];
    if (!t) return "";
    return '<span class="alertState">' + stateTag(t.state) + '<small class="muted">' + E(SHORT[t.code]) + ", " + E(nextStep(t)) + "</small></span>";
  }

  // ---------- drawers ----------
  function messageHtml(m) {
    return (
      '<div class="msgItem"><div class="msgHead"><b>' + E(m.subject) + '</b><time>' + E(new Date(m.at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })) + "</time></div>" +
      '<small class="msgTo">' + (m.outcome === "no_contact" ? "Not sent: no email or mobile on file" : "Simulated " + channelLabel(m.channel) + " to " + E(m.recipient) + " · not actually delivered") + "</small>" +
      "<p>" + E(m.body) + "</p>" +
      (m.link ? '<a class="msgLink" href="' + E(uploadUrl(m.link)) + '" target="_blank" rel="noopener" onclick="return StaffAgent.openLink(\'' + E(m.link) + '\')">Open ' + first(staffNameOf(m.staffId)) + "’s upload link (demo)</a>" : "") +
      (m.nextFollowUp ? '<small class="muted">Next follow-up ' + E(fmtDate(m.nextFollowUp)) + "</small>" : "") + "</div>"
    );
  }
  function staffNameOf(id) { const t = data.tasks.find((x) => x.staffId === id); return t ? t.staffName : ""; }
  function uploadUrl(link) { return location.origin + location.pathname + (link.startsWith("#") ? link : "#" + link.replace(/^#?/, "")); }
  function openLink(link) {
    // Same browser: open the educator's page in a new tab (live) or in place over the app (offline demo).
    if (!isLive()) { closeModal(); showUploadPage(link.replace(/^#?upload\//, ""), true); return false; }
    return true;
  }
  function openTask(id) {
    const t = data.tasks.find((x) => x.id === id);
    if (!t) return;
    const msgs = data.messages.filter((m) => m.taskId === id);
    const events = data.feed.filter((e) => e.taskId === id).slice().reverse();
    const esc8 = t.escalatedAt && !t.escalationAckAt;
    openModal(
      '<div class="modalHead"><div><h2>' + E(t.staffName) + "</h2><p>" + E(t.typeName) + ", " + E(t.room || "") + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<p class="modalSection tagLine">' + prioTag(t.priority) + stateTag(t.state) + '<span class="muted">' + E(t.reason) + "</span></p>" +
      (esc8 ? '<div class="escalationBox"><b>Escalated to you</b><p>' + E(t.escalationReason) + '</p><p><b>Recommended:</b> ' + E(t.recommendedAction) + '</p><div class="buttonRow"><button class="button primary small" onclick="StaffAgent.acknowledge(\'' + t.id + '\')">Acknowledge, keep chasing</button></div></div>' : "") +
      (t.pendingSubId ? '<div class="callout"><span class="hx lg"></span><div><b>Upload waiting for you</b><p>' + (t.pendingFlag === "clear" ? "Details match the record." : "Some details need checking.") + '</p></div><span class="rowEnd"><button class="button primary small" onclick="StaffAgent.openReview(\'' + t.pendingSubId + '\')">Review</button></span></div>' : "") +
      '<div class="modalMeta"><span>Expiry on record</span><b>' + (t.expiry ? E(fmtDate(t.expiry)) + (t.daysLeft != null ? (t.daysLeft < 0 ? ", expired " + -t.daysLeft + " days ago" : ", " + t.daysLeft + " days") : "") : "Not on file") + "</b></div>" +
      '<div class="modalMeta"><span>Requests sent</span><b>' + t.requestsSent + "</b></div>" +
      (t.state !== "resolved" ? '<div class="modalMeta"><span>Next step</span><b>' + E(nextStep(t)) + "</b></div>" : '<div class="modalMeta"><span>Outcome</span><b>' + E(t.resolution || "Resolved") + "</b></div>") +
      '<div class="modalMeta"><span>Contact</span><b>' + E([t.email, t.phone].filter(Boolean).join(", ") || "None on file") + "</b></div>" +
      (function () {
        const req = typeof AuditAgent !== "undefined" && AuditAgent.active() && typeof approved !== "undefined" && approved ? AuditAgent.requirementForCode(t.code) : null;
        return req ? '<div class="modalMeta"><span>Audit requirement</span><b><button class="textButton" onclick="closeModal();openItem(\'' + req.id + '\')">' + E(req.title) + "</button> " + AuditAgent.statusTagHtml(AuditAgent.reqOf(req).status) + "</b></div>" : "";
      })() +
      '<div class="modalSection"><h3>Messages</h3>' + (msgs.length ? msgs.map(messageHtml).join("") : '<p class="muted">None yet. beehive sends the first request at 30 days.</p>') + "</div>" +
      '<div class="modalSection"><h3>What beehive did</h3><ol class="timeline">' + events.map((e) => '<li class="tlItem ' + (FEED_CLASS[e.state] || "watch") + '"><span class="tlMark"></span><span class="tlText"><b>' + E(e.summary) + "</b><small>" + E(feedLine(e)) + "</small></span><time>" + E(relTime(e.at)) + "</time></li>").join("") + "</ol></div>" +
      '<div class="modalActions"><button class="button" onclick="closeModal();openStaffDetail(\'' + t.staffId + '\')">Staff record</button>' +
      (t.state !== "resolved" && leader() ? '<button class="button" onclick="StaffAgent.sendNow(\'' + t.id + '\')">Send reminder now</button>' : "") + "</div>",
      "wide",
    );
  }

  function recordFor(staffId, code) {
    if (typeof educators === "undefined") return null;
    const e = educators.find((x) => x.id === staffId);
    const c = e && e.certs.find((x) => (x.code || CODE_OF[x.type]) === code);
    return { name: e ? e.name : "", expiry: c && !c.missing ? c.expiryISO || null : null, expiryText: c ? c.expiry : "Not on file" };
  }
  async function fileLink(sub) {
    if (sub.fileData) return sub.fileData;
    if (sub.filePath && isLive() && Live.signedUrl) return await Live.signedUrl(sub.filePath);
    return "";
  }
  async function openReview(subId) {
    const s = data.subs.find((x) => x.id === subId);
    if (!s) return toast("This upload has already been dealt with.");
    const rec = recordFor(s.staffId, s.code) || {};
    const x = s.extracted || {};
    const issue = (f) => (s.checks || []).filter((c) => c.field === f);
    const cell = (f, val) => { const bad = issue(f); return '<td class="' + (bad.length ? "flag" : "okCell") + '">' + (val ? E(val) : '<span class="muted">Not found</span>') + (bad.length ? "" : "") + "</td>"; };
    const mark = (f, has) => (issue(f).length ? '<span class="status crit">Check</span>' : has ? '<span class="status green">Matches</span>' : '<span class="status neutral">—</span>');
    const href = await fileLink(s);
    const isImg = /^data:image\//.test(href);
    openModal(
      '<div class="modalHead"><div><h2>Verify certificate</h2><p>' + E(s.staffName) + ", " + E(s.typeName) + ", uploaded " + E(relTime(s.submittedAt).toLowerCase()) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      (s.flag === "clear" ? '<p class="okLine"><span class="status green">Ready to verify</span> beehive found the name, credential and a newer expiry date on the file. Check the file, then approve.</p>'
        : '<div class="flagBox"><b>' + (s.flag === "unreadable" ? "beehive couldn’t read this file" : "Check these before deciding") + "</b><ul>" + (s.checks || []).map((c) => "<li>" + E(c.message) + "</li>").join("") + "</ul></div>") +
      (href ? (isImg ? '<a class="certPreview" href="' + href + '" target="_blank" rel="noopener"><img src="' + href + '" alt="Uploaded certificate"></a>' : '<p><a href="' + E(href) + '" target="_blank" rel="noopener">Open the uploaded file</a> (' + E(s.fileName) + ")</p>") : '<p class="muted">' + E(s.fileName || "No file") + "</p>") +
      (x.demo ? '<p class="demoNote">Demo: sample certificate generated for this prototype.</p>' : "") +
      '<table class="compareTable"><thead><tr><th></th><th>On the certificate</th><th>On record</th><th></th></tr></thead><tbody>' +
      "<tr><th>Name</th>" + cell("name", x.name) + "<td>" + E(rec.name || s.staffName) + "</td><td>" + mark("name", x.name) + "</td></tr>" +
      "<tr><th>Credential</th>" + cell("type", x.type_code ? TYPE[x.type_code] : "") + "<td>" + E(s.typeName) + "</td><td>" + mark("type", x.type_code) + "</td></tr>" +
      "<tr><th>Issued</th>" + cell("issue_date", x.issue_date ? fmtDate(x.issue_date) : "") + '<td class="muted">—</td><td>' + (issue("issue_date").length ? mark("issue_date") : x.issue_date ? '<span class="status neutral">Read</span>' : "") + "</td></tr>" +
      "<tr><th>Expiry</th>" + cell("expiry_date", x.expiry_date ? fmtDate(x.expiry_date) : "") + "<td>" + E(rec.expiryText || "Not on file") + "</td><td>" + mark("expiry_date", x.expiry_date) + "</td></tr>" +
      "<tr><th>Number</th><td>" + (s.number ? E(s.number) : '<span class="muted">Not found</span>') + '</td><td class="muted">—</td><td></td></tr>' +
      "</tbody></table>" +
      (leader()
        ? '<label class="formLabel" for="verifyExpiry">Confirmed expiry date</label><input class="formControl" type="date" id="verifyExpiry" value="' + E(s.expiry ? String(s.expiry).slice(0, 10) : "") + '">' +
          (s.flag !== "clear" ? '<label class="checkLine"><input type="checkbox" id="verifyConfirm"> I’ve checked the flagged details against the certificate and they’re correct.</label>' : "") +
          '<p class="footnote">Approving updates ' + E(first(s.staffName)) + "’s record with this expiry date and today as the verification date, closes the renewal task and refreshes compliance. Rejecting keeps the current record and asks for a corrected upload.</p>" +
          '<details class="more rejectBox"><summary>Reject this upload</summary><div class="chips">' +
          ["The name doesn’t match", "This is the old certificate", "The file can’t be read", "Wrong credential"].map((r) => '<button class="chip" onclick="document.getElementById(\'rejectReason\').value=this.textContent">' + r + "</button>").join("") +
          '</div><label class="formLabel" for="rejectReason">Reason (sent to ' + E(first(s.staffName)) + ')</label><textarea id="rejectReason" rows="2"></textarea>' +
          '<div class="buttonRow" style="margin-top:8px"><button class="button danger" onclick="StaffAgent.decide(\'' + s.id + '\',false)">Reject and ask for a new upload</button></div></details>' +
          '<div class="modalActions"><button class="button" onclick="closeModal()">Later</button><button class="button primary" id="verifyApprove" onclick="StaffAgent.decide(\'' + s.id + '\',true)">Approve and update record</button></div>'
        : '<p class="footnote">The centre owner verifies this upload.</p>'),
      "wide",
    );
  }

  // extra content for the staff record drawer
  function staffDetailHtml(staffId) {
    if (!data.available) return "";
    const tasks = data.tasks.filter((t) => t.staffId === staffId && t.state !== "resolved").sort(byPriority);
    const msgs = data.messages.filter((m) => m.staffId === staffId).slice(0, 3);
    return (
      '<div class="modalSection"><h3>Renewals</h3>' + (tasks.length ? tasks.map((t) => '<button class="row" onclick="' + taskAction(t).act + '"><span class="rowMain"><b>' + E(SHORT[t.code]) + "</b><small>" + E(t.reason) + ". " + E(nextStep(t)) + '</small></span><span class="rowEnd">' + prioTag(t.priority) + stateTag(t.state) + "</span></button>").join("") : '<p class="muted">Nothing outstanding.</p>') + "</div>" +
      (msgs.length ? '<div class="modalSection"><h3>Recent messages</h3>' + msgs.map(messageHtml).join("") + "</div>" : "")
    );
  }

  // =====================================================================================
  // Uploading (shared by the signed-in upload page and the secure link page)
  // =====================================================================================
  function uploadWidget(opts) {
    return (
      '<label class="fileDrop"><b>Add a photo or PDF</b>Take a photo of the certificate or choose a file.<input id="certFile" type="file" accept=".pdf,image/*" onchange="StaffAgent.fileChosen(this.files[0])"><small id="uploadFileName">No file selected</small></label>' +
      '<div class="sampleLine"><span class="muted">No certificate handy? Demo samples:</span>' +
      [["correct", "Renewed"], ["wrong_name", "Wrong name"], ["no_expiry", "No expiry"], ["old", "Old certificate"], ["unreadable", "Unreadable"]].map(([v, l]) => '<button class="chip" type="button" onclick="StaffAgent.useSample(\'' + v + '\')">' + l + "</button>").join("") + "</div>" +
      '<div id="readResult" class="readResult"><small class="muted">beehive reads the name, credential and dates from the file. You confirm them before anything changes.</small></div>' +
      '<label class="formLabel" for="uploadExpiry">Expiry date on the certificate</label><input class="formControl" type="date" id="uploadExpiry">'
    );
  }
  function selected() {
    if (upload && upload.token) return { staffId: upload.staffId, code: upload.code, name: upload.name };
    const sid = (document.getElementById("uploadStaff") || {}).value;
    const label = (document.getElementById("uploadCertType") || {}).value || "First Aid";
    const e = typeof educators !== "undefined" ? educators.find((x) => x.id === sid) : null;
    return { staffId: sid, code: CODE_OF[label] || label, name: e ? e.name : "" };
  }
  async function useSample(variant) {
    const sel = selected();
    const file = await Extract.sample(sel.name || "Educator", sel.code, variant);
    fileChosen(file);
  }
  async function fileChosen(file) {
    if (!file) return;
    const sel = selected();
    const keep = upload && upload.token ? upload : {};
    upload = Object.assign({}, keep, { file, analysis: null, staffId: sel.staffId, code: sel.code });
    const out = document.getElementById("readResult");
    const nameEl = document.getElementById("uploadFileName");
    if (nameEl) nameEl.textContent = (file.__demo ? "Demo sample: " : "Selected: ") + file.name;
    if (out) out.innerHTML = '<small class="reading"><span class="hx"></span>Reading the certificate… <span id="readPct"></span></small>';
    try {
      const a = await Extract.analyse(file, { name: sel.name, type_code: sel.code }, (p) => { const el = document.getElementById("readPct"); if (el) el.textContent = p + "%"; });
      if (upload.file !== file) return;
      upload.analysis = a;
      const f = a.fields;
      const ex = document.getElementById("uploadExpiry");
      if (ex && f.expiry_date) ex.value = f.expiry_date;
      const pre = previewChecks(f, sel);
      if (out) out.innerHTML =
        '<div class="readGrid"><span>Name</span><b>' + E(f.name || "Not found") + "</b><span>Credential</span><b>" + E(f.type_code ? TYPE[f.type_code] : "Not found") + "</b>" +
        "<span>Issued</span><b>" + E(f.issue_date ? fmtDate(f.issue_date) : "Not found") + "</b><span>Expiry</span><b>" + E(f.expiry_date ? fmtDate(f.expiry_date) : "Not found") + "</b></div>" +
        (pre.length ? '<ul class="readFlags">' + pre.map((p) => "<li>" + E(p) + "</li>").join("") + '</ul><small class="muted">You can still submit. The centre will check these before anything changes.</small>'
                    : '<small class="okText"><span class="status green">Details match</span> The centre still verifies it before it counts.</small>');
    } catch (e) {
      if (out) out.innerHTML = '<small class="muted">beehive couldn’t read this file (' + E(e.message) + "). You can still submit it for the centre to check.</small>";
      upload.analysis = { hash: "", dataUrl: null, fields: { readable: false, uncertain: [e.message] } };
    }
  }
  function previewChecks(f, sel) {
    const out = [];
    if (!f.readable) return ["beehive couldn’t read any text on this file."];
    if (!f.name) out.push("No name found."); else if (sel.name && !sel.name.toLowerCase().split(/\s+/).every((p) => f.name.toLowerCase().includes(p))) out.push("The name (" + f.name + ") doesn’t match " + sel.name + ".");
    if (!f.type_code) out.push("Couldn’t tell which credential this is."); else if (f.type_code !== sel.code) out.push("This looks like a " + TYPE[f.type_code] + ".");
    if (!f.expiry_date) out.push("No expiry date found."); else if (f.expiry_date < today()) out.push("It expired on " + fmtDate(f.expiry_date) + ".");
    (f.uncertain || []).forEach((u) => out.push(u));
    return out;
  }
  async function submitUpload() {
    if (!upload || !upload.file) return toast("Choose a photo or PDF of the certificate first.");
    if (!upload.analysis) return toast("Still reading the certificate. One moment.");
    const sel = selected();
    const a = upload.analysis;
    const expiry = (document.getElementById("uploadExpiry") || {}).value || null;
    const btn = document.getElementById("submitUpload"); if (btn) btn.disabled = true;
    try {
      let r;
      if (upload.token) {
        r = isLive() || !String(upload.token).startsWith("demo-")
          ? await rpcAnon("submit_certificate_by_token", { p_token: upload.token, p_file_name: upload.file.name, p_file_data: a.dataUrl, p_file_hash: a.hash || null, p_extracted: a.fields, p_expiry: expiry, p_issue: null })
          : Engine.submit(upload.staffId, upload.code, { fileName: upload.file.name, fileData: a.dataUrl, hash: a.hash, extracted: a.fields, expiry, source: "link" });
      } else if (isLive()) {
        r = await rpc("submit_certificate_checked", { p_type_code: sel.code, p_file_name: upload.file.name, p_file_path: null, p_file_data: a.dataUrl, p_file_hash: a.hash || null,
          p_extracted: a.fields, p_expiry: expiry, p_issue: null, p_staff_id: leader() ? sel.staffId : null });
      } else {
        r = Engine.submit(sel.staffId, sel.code, { fileName: upload.file.name, fileData: a.dataUrl, hash: a.hash, extracted: a.fields, expiry, source: "owner" });
      }
      const token = upload.token;
      pendingCause = causeFor(upload.staffId || sel.staffId, upload.code || sel.code, "renewal was uploaded");
      upload = null;
      if (token) return uploadDone(r);
      toast(r.flag === "clear" ? "Uploaded. It’s waiting for the owner’s verification." : "Uploaded and flagged for the owner to check: " + (r.checks[0] || {}).message);
      await refresh(isLive() && ME.role === "educator" ? "staff-upload" : "staff");
    } catch (e) {
      toast((e && e.message) || String(e));
      if (btn) btn.disabled = false;
    }
  }
  async function rpcAnon(name, args) {
    const sb = Live.client();
    if (!sb) throw new Error("Can’t reach beehive. Check your connection.");
    const r = await sb.rpc(name, args);
    if (r.error) throw new Error(Live.explain(r.error));
    return r.data;
  }

  // ---------- the educator's secure upload page (#upload/<token>), no sign-in ----------
  let linkRoot = null;
  let linkInApp = false;
  async function showUploadPage(token, inApp) {
    linkInApp = !!inApp;
    linkRoot = document.getElementById("linkRoot");
    if (!linkRoot) { linkRoot = document.createElement("div"); linkRoot.id = "linkRoot"; document.body.appendChild(linkRoot); }
    linkRoot.classList.remove("hidden");
    linkRoot.innerHTML = '<div class="linkPage"><p class="muted">Opening your upload link…</p></div>';
    let info = null, err = "";
    try {
      if (String(token).startsWith("demo-")) { Engine.load(typeof educators !== "undefined" ? educators : []); info = Engine.uploadInfo(token); }
      else info = await rpcAnon("upload_request_info", { p_token: token });
    } catch (e) { err = e.message; }
    if (!info) {
      linkRoot.innerHTML = '<div class="linkPage">' + brand() + "<h1>This link has expired</h1><p class=\"muted\">" + E(err || "The renewal is already complete, or the link was replaced by a newer one. Ask the centre for a new link.") + "</p>" + closeLink() + "</div>";
      return;
    }
    upload = { token, staffId: info.staff_id || null, code: info.type_code, name: info.full_name };
    linkRoot.innerHTML =
      '<div class="linkPage">' + brand() + '<p class="linkCentre">' + E(info.centre) + "</p>" +
      "<h1>Hi " + E(info.first_name) + ", upload your renewed " + E(info.credential) + "</h1>" +
      '<p class="muted">' + (info.expiry_date ? (info.expiry_date < today() ? "Your current one expired on " : "Your current one expires on ") + E(fmtDate(info.expiry_date)) + "." : "There isn’t one on file for you yet.") + " The centre checks it before your record changes.</p>" +
      (info.pending ? '<p class="notice">You’ve already uploaded one that’s waiting to be checked. A new upload replaces it.</p>' : "") +
      uploadWidget() +
      '<div class="formActions" style="justify-content:flex-start"><button class="button primary" id="submitUpload" onclick="StaffAgent.submitUpload()">Send to the centre</button></div>' +
      '<p class="footnote">Demo prototype: this page stands in for the link in the (simulated) email or SMS. Use invented details only.</p>' + closeLink() + "</div>";
  }
  function brand() { return '<div class="authBrand"><span class="brandMark">' + (typeof ICON !== "undefined" ? ICON.brand : "") + "</span><strong>beehive</strong></div>"; }
  function closeLink() { return !linkInApp ? "" : '<button class="textButton" style="margin-top:24px" onclick="StaffAgent.closeUploadPage()">Back to the owner view</button>'; }
  function uploadDone(r) {
    linkRoot.innerHTML = '<div class="linkPage">' + brand() + "<h1>Thanks, it’s with the centre</h1><p class=\"muted\">" +
      (r.flag === "clear" ? "beehive read your certificate and the details match. The centre will verify it shortly." : "beehive couldn’t confirm every detail, so the centre will check it: " + E((r.checks[0] || {}).message || "")) +
      "</p>" + closeLink() + "</div>";
    if (!isLive()) { data = Object.assign({ available: true, mode: "offline", error: "" }, Engine.view()); syncEducators(); }
  }
  function closeUploadPage() {
    if (linkRoot) { linkRoot.classList.add("hidden"); linkRoot.innerHTML = ""; }
    upload = null;
    if (location.hash.startsWith("#upload/")) history.replaceState(null, "", location.pathname);
    if (!isLive()) refresh();
  }
  function linkToken() { const m = location.hash.match(/^#upload\/([\w-]+)/); return m ? m[1] : null; }

  // ---------- educator's own requests (My certificates) ----------
  function educatorRequests() {
    if (!data.available || !isLive() || ME.role !== "educator") return "";
    const mine = open().filter((t) => t.requestsSent > 0);
    if (!mine.length) return "";
    return '<section class="section"><div class="sectionHead"><h2>Requests from the centre</h2></div>' + mine.map((t) => {
      const m = data.messages.find((x) => x.taskId === t.id);
      return '<div class="row"><span class="rowMain"><b>' + E(t.typeName) + "</b><small>" + E(t.reason) + (m ? ". " + E(m.body) : "") + '</small></span><span class="rowEnd">' + (t.pendingSubId ? stateTag("owner_review") : '<button class="button small" onclick="document.getElementById(\'uploadCertType\').value=\'' + SHORT[t.code] + '\';document.getElementById(\'certFile\').click()">Upload</button>') + "</span></div>";
    }).join("") + "</section>";
  }

  // priority for a certificate cell (consistent with the agent's thresholds)
  function certPriority(c) {
    if (!c || c.missing || c.days == null || c.days < 0) return "critical";
    if (c.days > WINDOW) return "current";
    return priorityOf(c.days, false);
  }

  return {
    // data
    loadOffline, loadLive, active, data: () => data, counts, decisions, priorityOf, certPriority, PRIO, SHORT, TYPE,
    // rendering
    overviewSummary, renewalsCompact, feedHtml: () => feedHtml(feedLimit), staffSection, staffState, staffDetailHtml, prioTag, stateTag, uploadWidget, educatorRequests, setupNote,
    // actions
    runNow, sendNow, acknowledge, decide, openTask, openReview, nextDecision, filter, more, tab, fileChosen, useSample, submitUpload, openLink,
    showUploadPage, closeUploadPage, linkToken, reset: () => Engine.reset(), contactFor: (id) => Engine.contactFor(id), rowHtml, FEED_CLASS, STATE_CLASS, announce,
    guard, uploadUrl, brand, detectedHtml, waitingHtml, toggleDetected, detectedItems, waitingItems,
  };
})();
