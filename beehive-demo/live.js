// beehive live mode: connects the screens in app.js to Supabase.
// app.js keeps working on its own as the offline demo; when someone signs in, LIVE = true
// and the functions below load real records and save every action to the database.
const Live = (() => {
  const cfg = window.BEEHIVE_CONFIG || {};
  const TZ = "Australia/Sydney";
  const AREA = {
    staff_records: "Staff Records",
    childrens_records: "Children’s Records",
    safety_premises: "Safety & Premises",
    policies_procedures: "Policies & Procedures",
  };
  const CERT_LABEL = { WWCC: "WWCC", FIRST_AID: "First Aid", CPR: "CPR", ANAPHYLAXIS: "Anaphylaxis", ASTHMA: "Asthma" };
  const CERT_ORDER = ["WWCC", "FIRST_AID", "CPR", "ANAPHYLAXIS", "ASTHMA"];
  const TRIGGER_LABEL = { manual: "Message", incident: "Incident", daily_summary: "Daily summary", medical: "Medical", document_request: "Document request" };
  let sb = null;
  let children = [];
  let parentChildId = null;
  let channel = null;
  let reloadTimer = null;
  let searchTimer = null;
  let libraryRequested = false;
  let lastResults = [];

  // ---------- helpers ----------
  const fmtDate = (d) =>
    d ? new Date(String(d).length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }) : "";
  const fmtDT = (ts) =>
    ts ? new Date(ts).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }) : "";
  const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const shorten = (t) => {
    const parts = String(t || "").split("; ");
    return parts.length > 2 ? parts.slice(0, 2).join("; ") + " and " + (parts.length - 2) + " more." : t;
  };
  const baseName = (p) => (p ? String(p).split("/").pop().replace(/^\d+-/, "") : "");
  const isLeader = () => ME && (ME.role === "owner" || ME.role === "director");

  function client() {
    if (!sb && window.supabase && cfg.supabaseUrl && cfg.supabaseKey) sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    return sb;
  }
  function explain(error) {
    const m = (error && (error.message || error.error_description)) || String(error);
    if (/relation .* does not exist|Could not find the (table|function)|schema cache/i.test(m))
      return "The database isn't set up yet. Run the files in supabase/migrations, then supabase/seed_demo.sql, in the Supabase SQL Editor.";
    if (/Invalid login credentials/i.test(m)) return "That email and password don't match. Check them and try again.";
    if (/Email not confirmed/i.test(m)) return "Confirm your email first, or turn off 'Confirm email' in Supabase → Authentication.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Can't reach Supabase. Check your internet connection.";
    return m;
  }
  async function q(promise) {
    const { data, error } = await promise;
    if (error) throw new Error(explain(error));
    return data;
  }
  async function busy(fn, okMessage) {
    try {
      const r = await fn();
      if (okMessage) toast(typeof okMessage === "function" ? okMessage(r) : okMessage);
      return r;
    } catch (e) {
      toast(e.message || String(e));
      throw e;
    }
  }
  async function upload(folder, file) {
    const name = file.name.replace(/[^\w.-]+/g, "_");
    const path = `${ME.centre.id}/${folder}/${Date.now()}-${name}`;
    await q(sb.storage.from("beehive").upload(path, file, { contentType: file.type || "application/octet-stream" }));
    return path;
  }
  async function signedUrl(path) {
    if (!path) return "";
    try { const d = await q(sb.storage.from("beehive").createSignedUrl(path, 600)); return d.signedUrl; } catch (e) { return ""; }
  }

  // ---------- boot, login, logout ----------
  async function boot() {
    // An educator's secure upload or availability link works without signing in.
    if (typeof Availability !== "undefined" && Availability.linkToken()) { Availability.showPage(Availability.linkToken()); return; }
    if (typeof StaffAgent !== "undefined" && StaffAgent.linkToken()) { client(); StaffAgent.showUploadPage(StaffAgent.linkToken()); return; }
    if (typeof AuditAgent !== "undefined" && AuditAgent.linkToken()) { client(); AuditAgent.showLinkPage(AuditAgent.linkToken()); return; }
    if (!client()) { offline(); return; }
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
    sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") { stopRealtime(); LIVE = false; showLogin(); } });
    if (session) {
      try { await startLive(); } catch (e) { showLogin(e.message); }
    } else showLogin();
  }

  // Sample data in this browser. Only used when Supabase isn't configured (and by developers testing locally
  // with Live.goOffline() in the console); the sign-in page has no way into it.
  function offline() {
    if (ME) { location.reload(); return; }
    LIVE = false;
    hideLogin();
    document.body.classList.remove("educatorMode", "liveMode");
    if (typeof StaffRecords !== "undefined") StaffRecords.applyOffline();
    if (typeof StaffAgent !== "undefined") StaffAgent.loadOffline();
    if (typeof AuditAgent !== "undefined") AuditAgent.loadOffline();
    render();
    typeof Assistant !== "undefined" && Assistant.refresh();
  }
  function showLogin(message) {
    closeModal && closeModal();
    let root = document.getElementById("authRoot");
    root.innerHTML =
      '<div class="authShade"><div class="authCard">' +
      '<div class="authLogo"><img src="./brand/animated/beehive-arrive-trail.svg" alt="beehive"></div>' +
      '<p class="authTagline">We are the buzz in the background</p>' +
      '<h1>Welcome back</h1><p class="authLede">Sign in to your centre.</p>' +
      // name + autocomplete let the browser's saved email and password fill in.
      '<form id="authForm" method="post" action="#" onsubmit="event.preventDefault();Live.signIn()">' +
      '<label class="formLabel" for="authEmail">Email</label><input class="formControl" id="authEmail" name="email" type="email" autocomplete="username" required>' +
      '<label class="formLabel" for="authPassword">Password</label><input class="formControl" id="authPassword" name="password" type="password" autocomplete="current-password" required>' +
      '<p class="authError" id="authError" role="alert">' + (message ? esc(message) : "") + "</p>" +
      '<button class="button primary authSubmit" id="authSubmit">Sign in</button></form>' +
      "</div></div>";
    root.classList.remove("hidden");
  }
  function hideLogin() {
    const root = document.getElementById("authRoot");
    root.innerHTML = "";
    root.classList.add("hidden");
  }
  async function signIn() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const btn = document.getElementById("authSubmit");
    const err = document.getElementById("authError");
    btn.disabled = true; btn.textContent = "Signing in…"; err.textContent = "";
    try {
      await q(sb.auth.signInWithPassword({ email, password }));
      await startLive();
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false; btn.textContent = "Sign in";
    }
  }
  async function signOut() {
    closeModal();
    try { localStorage.removeItem("beehive-mode"); } catch (e) {}
    await sb.auth.signOut();
  }
  function goOffline() { offline(); }

  // ---------- load everything for the signed-in person ----------
  async function startLive() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error("Please sign in.");
    const me = await q(sb.from("users").select("id, email, full_name, role, centre_id").eq("id", user.id).maybeSingle());
    if (!me || !me.centre_id) throw new Error("This account isn't linked to a centre yet. Ask the centre owner for a join code.");
    me.centre = await q(sb.from("centres").select("id, name, staff_code, family_code").eq("id", me.centre_id).single());
    ME = me;
    LIVE = true;
    CENTRE_NAME = me.centre.name;
    document.body.classList.add("liveMode");
    document.body.classList.toggle("educatorMode", me.role === "educator");
    if (me.role === "parent") { PARENT_NAME = me.full_name || me.email; current = "family"; }
    else { OWNER_NAME = me.full_name || me.email; }
    await load({ runAgent: true });
    if (me.role === "educator") current = "staff-upload";
    else if (me.role !== "parent") current = "overview";
    if (location.hash === "#upload" && me.role !== "parent") current = "staff-upload";
    hideLogin();
    render();
    startRealtime();
    typeof Assistant !== "undefined" && Assistant.refresh();
  }

  async function load(opts) {
    if (ME.role === "parent") return loadParent();
    // The agents: the owner's first load runs both loops (staff first, so the audit agent sees current credentials),
    // then every load reads their records.
    let staffRun = null, auditRun = null;
    if (opts && opts.runAgent && isLeader()) {
      try { const r = await sb.rpc("run_staff_agent"); staffRun = r.error ? null : r.data; } catch (e) {}
      if (typeof AuditAgent !== "undefined") auditRun = await AuditAgent.runRemote(true);
    }
    const agentP = typeof StaffAgent !== "undefined" ? StaffAgent.loadLive(sb, { staffRun, auditRun, announce: !!staffRun || !!auditRun }) : Promise.resolve();
    const auditP = typeof AuditAgent !== "undefined" ? AuditAgent.loadLive(sb) : Promise.resolve();
    if (!libraryRequested && typeof Library !== "undefined") { libraryRequested = true; Library.loadFrom(sb); }
    const tasksP = typeof Library !== "undefined" ? Library.loadTasks(sb) : null;
    const leader = isLeader();
    // Recent activity for the Overview timeline (owner/director can read the audit log).
    const feedP = leader
      ? sb.from("audit_log").select("action, entity_id, detail, created_at").order("created_at", { ascending: false }).limit(30)
          .then((r) => (r.error ? [] : r.data || []), () => [])
      : Promise.resolve([]);
    const [rows, kids, staffRows, certRows, subs, meds, thread, regs, drafts] = await Promise.all([
      q(sb.from("v_checklist_status").select("*")),
      // enrolment holds the full enrolment record (20261114100000_child_enrolment.sql); read without it until that's run
      q(sb.from("children").select("id, first_name, last_name, date_of_birth, emergency_contact, enrolment").eq("is_active", true).order("first_name"))
        .catch(() => q(sb.from("children").select("id, first_name, last_name, date_of_birth, emergency_contact").eq("is_active", true).order("first_name"))),
      q(sb.from("staff").select("*").order("full_name")),
      q(sb.from("v_certificate_reminders").select("*")),
      leader ? q(sb.from("certificate_submissions").select("*, staff(full_name), certificate_types(code)").eq("status", "pending").order("submitted_at"))
             : q(sb.from("certificate_submissions").select("*, staff(full_name), certificate_types(code)").eq("status", "pending").order("submitted_at")),
      q(sb.from("medical_updates").select("*, children(first_name, last_name)").eq("status", "pending").order("submitted_at")),
      q(sb.from("v_family_thread").select("*").order("sent_at", { ascending: false }).limit(200)),
      leader ? q(sb.from("regulation_updates").select("*").order("published_on", { ascending: false })) : Promise.resolve([]),
      q(sb.from("parent_messages").select("*, children(first_name, last_name)").eq("status", "draft").order("created_at")),
    ]);
    // Latest approved medical profile per child, for the child list and the daily sheet.
    const approvedMeds = await q(sb.from("medical_updates").select("child_id, allergies, conditions, dietary, medications, approved_at").eq("status", "approved").order("approved_at")).catch(() => []);
    kids.forEach((k) => { const m = (approvedMeds || []).filter((x) => x.child_id === k.id).pop(); if (m) k.medical = m; });
    children = kids;
    childIndex = Object.fromEntries(kids.map((k) => [k.id, `${k.first_name} ${k.last_name}`.trim()]));
    const kidName = (id) => { const k = kids.find((x) => x.id === id); return k ? `${k.first_name} ${k.last_name}`.trim() : "Child"; };

    // Checklist (approved baseline, or the AI-suggested draft waiting for approval)
    approved = rows.some((r) => r.approved);
    items = rows
      .filter((r) => (approved ? r.approved : true))
      .sort((a, b) => Object.keys(AREA).indexOf(a.area) - Object.keys(AREA).indexOf(b.area) || a.title.localeCompare(b.title))
      .map((r) => ({
        id: r.id,
        key: r.item_key,
        title: r.title,
        area: AREA[r.area] || r.area,
        status: r.status,
        source: r.source_ref,
        evidence: r.evidence_text || r.evidence_hint,
        updated: r.last_updated ? "Updated " + fmtDate(r.last_updated) : "No evidence recorded yet",
        summary: r.summary || r.evidence_hint,
        risk: shorten(r.reason),
        icon: r.icon,
        file: r.evidence_file,
        hint: r.evidence_hint,
        kind: r.evidence_kind,
        months: r.review_months,
        req: r.req_status ? {
          status: r.req_status, flags: r.flags || [], priority: r.priority, priorityReason: r.priority_reason, why: r.why, nextAction: r.next_action,
          reason: r.reason, currentEvidence: r.evidence_text, lastReviewed: r.last_updated, evidenceDate: r.evidence_date, evidenceExpires: r.evidence_expires,
          pendingEvidenceId: r.pending_evidence_id, openTaskId: r.open_task_id,
        } : null,
      }));

    // Staff certification register
    // Every document on each educator's file (qualifications, training, other documents), for the Staff page.
    const docRows = await q(sb.from("staff_certificates").select("*, certificate_types(code, name)")).catch(() => []);
    const docsFor = (sid) => (docRows || []).filter((d) => d.staff_id === sid).map((d) => ({ id: d.id, code: d.certificate_types && d.certificate_types.code, kind: d.certificate_types && d.certificate_types.name,
      title: d.title || "", number: d.certificate_number || "", issued: d.issue_date || "", expires: d.expiry_date || "", fileName: d.document_url ? String(d.document_url).split("/").pop().replace(/^\d+-/, "") : "", filePath: d.document_url || "" }));
    const extra = (s) => ({ email: s.email || "", phone: s.phone || "", qualification: s.qualification || "", days: s.work_days || undefined, startedOn: s.started_on || "", leftOn: s.left_on || "", docs: docsFor(s.id) });
    formerEducators = staffRows.filter((s) => !s.is_active && !/owner/i.test(s.position || ""))
      .map((s) => Object.assign({ id: s.id, name: s.full_name, role: s.position, certs: [] }, extra(s)));
    educators = staffRows
      .filter((s) => s.is_active && !/owner/i.test(s.position || "") && s.user_id !== ME.id)
      .map((s) => {
        const mine = certRows.filter((c) => c.staff_id === s.id);
        const certs = CERT_ORDER.map((code) => {
          const c = mine.find((x) => x.code === code);
          if (!c) return { type: CERT_LABEL[code], code, expiry: "Not on file", days: -1, missing: true };
          return { type: CERT_LABEL[code], code, certId: c.id, expiry: fmtDate(c.expiry_date), expiryISO: String(c.expiry_date).slice(0, 10), days: c.days_until_expiry, approvedAt: c.verified_at ? fmtDT(c.verified_at) : "" };
        });
        const states = mine.map((c) => c.alert_state).filter(Boolean);
        const pick = states.find((x) => x.startsWith("Renewal submitted")) || states.find((x) => x.startsWith("Follow up")) ||
          states.find((x) => x.startsWith("Renewal prompt")) || states.find((x) => x.startsWith("Approved")) || "";
        return Object.assign({ id: s.id, userId: s.user_id, name: s.full_name, initials: initials(s.full_name), role: s.position, alertState: pick, certs }, extra(s));
      });

    // Certificate waiting for approval
    const sub = subs[0];
    pendingSubmission = sub
      ? {
          id: sub.id,
          staffId: sub.staff_id,
          staffName: sub.staff ? sub.staff.full_name : "Staff member",
          type: CERT_LABEL[sub.certificate_types && sub.certificate_types.code] || "Certificate",
          fileName: baseName(sub.file_path) || "No file attached",
          fileUrl: await signedUrl(sub.file_path),
          expiry: fmtDate(sub.expiry_date),
          expiryISO: sub.expiry_date ? String(sub.expiry_date).slice(0, 10) : "",
          submittedAt: fmtDT(sub.submitted_at),
        }
      : null;

    // Parent medical update waiting for review
    const med = meds.find((m) => !m.category) || meds[0];
    medicalSubmission = med
      ? {
          id: med.id,
          childName: med.children ? `${med.children.first_name} ${med.children.last_name}` : "Child",
          allergies: med.allergies || med.condition || "",
          conditions: med.conditions || "",
          dietary: med.dietary || "",
          medications: med.medications || med.instructions || "",
          notes: med.care_notes || "",
          emergency: med.emergency_contact || "",
          signer: med.signer_name || "Parent",
          fileName: baseName(med.attachment_path),
          fileUrl: await signedUrl(med.attachment_path),
          submittedAt: fmtDT(med.submitted_at),
          status: "pending",
        }
      : null;

    // Family thread the owner should look at: the child whose family wrote most recently
    const latestParent = thread.find((t) => t.sender === "parent");
    const threadChild = latestParent ? latestParent.child_id : thread[0] && thread[0].child_id;
    if (threadChild) {
      const k = kids.find((x) => x.id === threadChild) || {};
      const answered = latestParent && thread.some((x) => x.child_id === threadChild && x.sender === "centre" && !["receipt", "reminder"].includes(x.kind) && x.sent_at > latestParent.sent_at);
      ownerThread = {
        childId: threadChild, childName: kidName(threadChild),
        parentName: latestParent ? latestParent.sender_name : "",
        unanswered: !!latestParent && !answered, lastParentText: latestParent ? latestParent.body : "",
      };
      familyMessages = thread.filter((t) => t.child_id === threadChild).reverse().map((t) => ({ from: t.sender, text: t.body, time: fmtDT(t.sent_at) }));
      familyMedical = Object.assign({}, familyMedical, { childName: ownerThread.childName });
    } else {
      ownerThread = null;
      familyMessages = [];
    }

    // Regulation update and AI drafts
    const reg = regs.find((r) => r.status !== "reviewed") || regs[0];
    regUpdate = reg ? { id: reg.id, title: reg.title, summary: reg.summary, published: fmtDate(reg.published_on), status: reg.status, terms: reg.match_terms || [] } : null;
    saved.updateAccepted = !!(reg && reg.status === "accepted");
    aiDrafts = drafts.map((d) => ({
      id: d.id,
      childName: d.children ? d.children.first_name : "Child",
      trigger: TRIGGER_LABEL[d.trigger] || "Message",
      body: d.body,
    }));
    if (tasksP) await tasksP;
    auditFeed = await feedP;
    await agentP;
    await auditP;
    if (typeof StaffAgent !== "undefined" && StaffAgent.active()) pendingSubmission = null;
  }

  async function loadParent() {
    const kids = await q(sb.from("children").select("id, first_name, last_name").order("first_name"));
    children = kids;
    if (!kids.length) {
      familyMedical = { childName: "your child", allergies: "", conditions: "", dietary: "", medications: "", notes: "", emergency: "", reviewedAt: "Not yet linked" };
      familyMessages = [{ from: "centre", text: "Welcome to beehive. The centre will link your account to your child shortly.", time: "" }];
      medicalSubmission = null;
      return;
    }
    const kid = kids[0];
    parentChildId = kid.id;
    const [profile, mine, thread] = await Promise.all([
      q(sb.from("v_child_medical_profile").select("*").eq("child_id", kid.id).maybeSingle()),
      q(sb.from("medical_updates").select("*").eq("child_id", kid.id).eq("submitted_by", ME.id).is("category", null).order("submitted_at", { ascending: false }).limit(1)),
      q(sb.from("v_family_thread").select("*").eq("child_id", kid.id).order("sent_at")),
    ]);
    const p = profile || {};
    familyMedical = {
      childName: `${kid.first_name} ${kid.last_name}`.trim(),
      allergies: p.allergies || "",
      conditions: p.conditions || "",
      dietary: p.dietary || "",
      medications: p.medications || "",
      notes: p.care_notes || "",
      emergency: p.emergency_contact || "",
      reviewedAt: p.reviewed_at ? fmtDate(p.reviewed_at) : "Not yet reviewed",
    };
    const m = mine[0];
    const recent = m && new Date(m.submitted_at) > new Date(Date.now() - 14 * 86400000);
    medicalSubmission = m && (m.status === "pending" || recent)
      ? {
          id: m.id, childName: familyMedical.childName,
          allergies: m.allergies, conditions: m.conditions, dietary: m.dietary, medications: m.medications, notes: m.care_notes,
          emergency: m.emergency_contact, signer: m.signer_name, submittedAt: fmtDT(m.submitted_at),
          status: m.status === "pending" ? "pending" : "reviewed", reviewedAt: m.approved_at ? fmtDT(m.approved_at) : "",
        }
      : null;
    familyMessages = thread.map((t) => ({ from: t.sender, text: t.body, time: fmtDT(t.sent_at) }));
    sb.rpc("mark_parent_messages_read", { p_child: kid.id }).then(() => {});
    sb.rpc("mark_thread_read", { p_child: kid.id }).then(() => {});
  }

  async function reload(page) {
    await load();
    if (page) current = page;
    render();
    typeof Assistant !== "undefined" && Assistant.refresh();
  }

  // ---------- realtime: owner sees parent updates, parent sees replies, without refreshing ----------
  // Coming back to the tab (for example after opening an educator's upload link) refreshes the agent's view.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && LIVE && ME && isLeader() && !document.querySelector(".modalShade")) reload().catch(() => {});
  });
  function startRealtime() {
    stopRealtime();
    const bump = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => { if (!document.querySelector(".modalShade")) reload().catch(() => {}); }, 600);
    };
    channel = sb.channel("beehive-live");
    ["medical_updates", "certificate_submissions", "parent_messages", "messages"].forEach((t) =>
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, bump));
    channel.subscribe();
  }
  function stopRealtime() { if (channel) { sb.removeChannel(channel); channel = null; } }

  // ---------- actions (called from app.js when LIVE) ----------
  async function approveChecklist() {
    const titles = [...document.querySelectorAll('.checkRow input[type="checkbox"]:checked')].map((x) => x.getAttribute("aria-label").replace(/^Include /, ""));
    if (titles.length < 4) return toast("Keep at least four items in your centre baseline.");
    const ids = items.filter((x) => titles.includes(x.title)).map((x) => x.id);
    await busy(() => q(sb.rpc("approve_checklist_selection", { p_keep: ids })), "Checklist approved. beehive is checking every requirement now.");
    await load({ runAgent: true });
    current = "audit";
    render();
  }
  async function editBaseline() {
    await busy(() => q(sb.rpc("reopen_checklist")), "Edit the selected items, then approve the baseline again.");
    await reload("audit");
  }
  async function uploadEvidence(id, input) {
    if (!input.files || !input.files.length) return;
    if (typeof AuditAgent !== "undefined" && AuditAgent.active()) return AuditAgent.fileChosen(input.files[0], id);
    const file = input.files[0];
    await busy(async () => {
      const path = await upload("evidence", file);
      await q(sb.from("evidence").insert({ centre_id: ME.centre.id, checklist_item_id: id, title: file.name, file_path: path, uploaded_by: ME.id }));
    }, "Evidence uploaded and logged. Readiness updated.");
    closeModal();
    await reload();
  }
  // ---------- staff records: add educators, documents, and record a leaving date ----------
  const CODE_BY_KIND = { WWCC: "WWCC", "First aid": "FIRST_AID", CPR: "CPR", Anaphylaxis: "ANAPHYLAXIS", Asthma: "ASTHMA", Qualification: "QUALIFICATION", "Child protection training": "CHILD_PROTECTION", Other: "OTHER" };
  // Optional columns from the staff_records migration: if it hasn't been run yet, save without them.
  async function tolerant(run, rowWith, rowWithout) {
    try { return await q(run(rowWith)); } catch (e) { if (/column|schema cache/i.test(e.message || "")) return q(run(rowWithout)); throw e; }
  }
  async function addEducator(e) {
    const base = { centre_id: ME.centre.id, full_name: e.name, email: e.email || "", phone: e.phone || "", position: e.role };
    const row = await busy(() => tolerant((r) => sb.from("staff").insert(r).select("id").single(),
      Object.assign({}, base, { qualification: e.qualification || "", work_days: e.days, started_on: e.startedOn || null }), base), e.name + " added. beehive will ask them for their credentials.");
    await reload();
    return row && row.id;
  }
  async function saveDocument(staffId, d, file) {
    const types = await q(sb.from("certificate_types").select("id, code"));
    const code = CODE_BY_KIND[d.kind] || "OTHER";
    const type = types.find((t) => t.code === code) || types.find((t) => t.code === "OTHER");
    if (!type) throw new Error("This document type isn't set up yet. Run the latest live_setup.sql.");
    const path = file ? await upload("staff", file) : null;
    const base = { staff_id: staffId, certificate_type_id: type.id, certificate_number: d.number || "", issue_date: d.issued || null, expiry_date: d.expires || null };
    if (path) base.document_url = path;
    // a required credential replaces the one on file; anything else is added alongside
    const required = ["WWCC", "FIRST_AID", "CPR", "ANAPHYLAXIS", "ASTHMA"].includes(type.code);
    const existing = required ? (await q(sb.from("staff_certificates").select("id").eq("staff_id", staffId).eq("certificate_type_id", type.id)))[0] : null;
    await busy(() => existing
      ? tolerant((r) => sb.from("staff_certificates").update(r).eq("id", existing.id), Object.assign({}, base, { title: d.title || "" }), base)
      : tolerant((r) => sb.from("staff_certificates").insert(r), Object.assign({}, base, { title: d.title || "" }), base), "Saved to the staff record.");
    if (code === "QUALIFICATION" && d.title) await tolerant((r) => sb.from("staff").update(r).eq("id", staffId), { qualification: d.title }, {}).catch(() => {});
    await reload();
  }
  async function markLeft(staffId, date) {
    await busy(() => tolerant((r) => sb.from("staff").update(r).eq("id", staffId), { is_active: false, left_on: date }, { is_active: false }),
      "Moved to former educators. Their records stay on file for 3 years.");
    await reload();
  }
  async function docUrl(path) { return signedUrl(path); }

  // ---------- children: enrol a child, and the documents drafted for them ----------
  async function addChild(rec) {
    const base = { centre_id: ME.centre.id, first_name: rec.first, last_name: rec.last, date_of_birth: rec.dob || null, emergency_contact: rec.contact || "" };
    const row = await busy(() => tolerant((r) => sb.from("children").insert(r).select("id").single(), Object.assign({}, base, { enrolment: rec.enrolment || {} }), base),
      rec.first + " " + rec.last + " is enrolled.");
    await reload();
    return row && row.id;
  }
  async function childDocuments(childId) {
    try { return await q(sb.from("child_documents").select("id, title, body, created_at, drafted_by_ai").eq("child_id", childId).order("created_at", { ascending: false })); }
    catch (e) { return []; }
  }
  async function saveChildDocument(childId, d) {
    return busy(() => q(sb.from("child_documents").insert({ centre_id: ME.centre.id, child_id: childId, title: d.title, body: d.body, prompt: d.prompt || "", drafted_by_ai: !!d.ai, created_by: ME.id }).select("id").single()),
      "Saved to the child’s file.");
  }

  async function logDrill(id) {
    if (typeof AuditAgent !== "undefined" && AuditAgent.active()) return AuditAgent.openDrillForm(id);
    await busy(() => q(sb.from("evidence").insert({ centre_id: ME.centre.id, checklist_item_id: id, title: "Evacuation drill logged", recorded_on: todayISO(), uploaded_by: ME.id })),
      "Drill logged. The readiness score updated and a timestamp was recorded.");
    closeModal();
    await reload();
  }
  async function completeTask(recordId) {
    await busy(() => q(sb.rpc("complete_compliance_task", { p_record: recordId, p_notes: "" })),
      (r) => r && r.next_due ? "Done. Next due " + fmtDate(r.next_due) + "." : "Done. This one-off task is complete.");
    await reload();
  }
  async function acceptUpdate() {
    if (!regUpdate) return;
    await busy(() => q(sb.rpc("accept_regulation_update", { p_update: regUpdate.id })), (n) => `Update accepted. ${n} checklist item${n === 1 ? " is" : "s are"} flagged for review.`);
    await reload();
  }
  async function markUpdateReviewed() {
    if (!regUpdate) return;
    await busy(async () => {
      const flagged = items.filter((x) => (regUpdate.terms || []).some((t) => x.key === t || x.title.toLowerCase().includes(String(t).toLowerCase())));
      for (const x of flagged)
        await q(sb.from("evidence").insert({ centre_id: ME.centre.id, checklist_item_id: x.id, title: x.title + " · owner review completed", recorded_on: todayISO(), uploaded_by: ME.id, note: "Reviewed after: " + regUpdate.title }));
      await q(sb.rpc("complete_regulation_review", { p_update: regUpdate.id }));
    }, "Policy review recorded. Checklist status is current.");
    await reload();
  }
  async function runExpiryCheck() {
    const r = await busy(() => q(sb.rpc("run_expiry_check")),
      (r) => `Expiry check complete. ${r.sent} reminder${r.sent === 1 ? "" : "s"} sent to ${r.staff} staff (email and SMS are simulated).`);
    await reload();
    return r;
  }
  async function submitCertificate() {
    const fileInput = document.getElementById("certFile");
    if (!fileInput || !fileInput.files || !fileInput.files.length) return toast("Select a certificate photo or PDF first.");
    const staffId = document.getElementById("uploadStaff").value;
    const typeLabel = document.getElementById("uploadCertType").value;
    const expiry = (document.getElementById("uploadExpiry") || {}).value;
    if (!expiry) return toast("Enter the expiry date shown on the certificate.");
    await busy(async () => {
      const path = await upload("certificates", fileInput.files[0]);
      await q(sb.rpc("submit_certificate", {
        p_type_code: typeLabel, p_expiry: expiry, p_file_path: path, p_number: "", p_issue: null, p_extracted_by_ai: false,
        p_staff_id: isLeader() ? staffId : null,
      }));
    }, ME.role === "educator" ? "Certificate submitted. The centre owner has been notified." : "Certificate submitted for approval.");
    await reload(ME.role === "educator" ? "staff-upload" : "staff");
  }
  async function approveCertificate() {
    if (!pendingSubmission) return;
    const expiry = (document.getElementById("reviewExpiry") || {}).value || pendingSubmission.expiryISO;
    const who = pendingSubmission.staffName;
    await busy(() => q(sb.rpc("review_certificate", { p_submission: pendingSubmission.id, p_approve: true, p_expiry: expiry, p_note: "" })),
      `${who}’s certificate is approved. Status is green, the audit timestamp is recorded and the next reminder is scheduled.`);
    closeModal();
    await reload("staff");
  }
  async function submitFamilyUpdate() {
    const signer = document.getElementById("familySigner").value.trim();
    if (!signer) return toast("Enter the parent or guardian name to acknowledge this update.");
    if (!document.getElementById("familyConsent").checked) return toast("Please confirm the acknowledgement before submitting.");
    if (!parentChildId) return toast("Your account isn't linked to a child yet.");
    const fileInput = document.querySelector('.familyFile input[type="file"]');
    await busy(async () => {
      let path = null;
      if (fileInput && fileInput.files && fileInput.files.length) path = await upload("medical/" + parentChildId, fileInput.files[0]);
      await q(sb.from("medical_updates").insert({
        centre_id: ME.centre.id, child_id: parentChildId, submitted_by: ME.id, parent_confirmed: true, signer_name: signer,
        allergies: document.getElementById("familyAllergies").value.trim(),
        conditions: document.getElementById("familyConditions").value.trim(),
        dietary: document.getElementById("familyDietary").value.trim(),
        medications: document.getElementById("familyMedications").value.trim(),
        care_notes: document.getElementById("familyNotes").value.trim(),
        emergency_contact: familyMedical.emergency || "",
        attachment_path: path,
      }));
    }, "Update received. A receipt is now in your messages and medical profile.");
    familyFile = "";
    await reload("family-medical");
  }
  async function sendOwnerReply() {
    const input = document.getElementById("ownerReplyInput");
    const text = input.value.trim();
    if (!text) return toast("Write a reply first.");
    if (!ownerThread) return toast("No family conversation selected.");
    await busy(async () => {
      if (pendingDraftId) await q(sb.rpc("approve_parent_message", { p_message: pendingDraftId, p_body: text, p_channel: null }));
      else await q(sb.from("messages").insert({ centre_id: ME.centre.id, child_id: ownerThread.childId, sender_id: ME.id, body: text }));
    }, pendingDraftId ? "AI-drafted message approved and sent to the family." : "Reply sent to the family.");
    pendingDraftId = null;
    closeModal();
    await reload();
  }
  async function acknowledgeFamilyUpdate() {
    if (!medicalSubmission) return;
    await busy(() => q(sb.rpc("review_medical_update", { p_update: medicalSubmission.id, p_approve: true, p_note: "" })),
      "Update acknowledged. The record is locked, educators have the new details and the family has been told.");
    closeModal();
    await reload();
  }
  async function approveDraft(id) {
    const el = document.getElementById("draft-" + id);
    const text = el ? el.value.trim() : "";
    if (!text) return toast("The message is empty.");
    await busy(() => q(sb.rpc("approve_parent_message", { p_message: id, p_body: text, p_channel: null })), "Approved and sent to the family.");
    await reload();
    refreshDraftsDrawer();
  }
  // Keep the drafts panel in step: show what's left, or close it when nothing is.
  function refreshDraftsDrawer() {
    if (!document.querySelector("#modalRoot .modal")) return;
    closeModal();
    if (aiDrafts.length && typeof openDraftsDrawer === "function") openDraftsDrawer();
  }
  async function discardDraft(id) {
    await busy(() => q(sb.from("parent_messages").update({ status: "cancelled" }).eq("id", id)), "Draft discarded.");
    await reload();
    refreshDraftsDrawer();
  }
  async function createDraft(childId, body, note, trigger) {
    const row = await q(sb.from("parent_messages").insert({
      centre_id: ME.centre.id, child_id: childId, created_by: ME.id, body, staff_note: note || "", trigger: trigger || "manual", drafted_by_ai: true,
    }).select("id").single());
    return row.id;
  }

  // ---------- search (spot check) ----------
  function searchEvidence(value) {
    const box = document.getElementById("searchResults");
    const text = value.trim();
    clearTimeout(searchTimer);
    if (!text) { box.classList.add("hidden"); return; }
    searchTimer = setTimeout(async () => {
      try {
        lastResults = await q(sb.rpc("spot_check_search", { p_query: text }));
      } catch (e) { lastResults = []; }
      const label = { certificate: "Staff certificate", incident: "Incident record", checklist: "Checklist item", medical: "Medical profile" };
      const status = (s) => ({ green: "Current", valid: "Active", yellow: "Review due", expiring_soon: "Expiring", red: "Missing", expired: "Expired" }[s] || s);
      box.innerHTML =
        '<div class="resultHeading">' + (lastResults.length ? "Matching records" : "No matching records") +
        '<button class="resultClose" aria-label="Close search results" onclick="event.stopPropagation();document.getElementById(\'searchResults\').classList.add(\'hidden\')">×</button></div>' +
        (lastResults.length
          ? lastResults.slice(0, 8).map((r, i) =>
              '<button class="searchResult" onclick="Live.openResult(' + i + ')"><b>' + esc(r.title) + "</b><small>" + esc(label[r.kind] || r.kind) + ", " + esc(status(r.status)) +
              ", " + esc(r.detail || "") + (r.last_updated ? ", updated " + esc(fmtDate(r.last_updated)) : "") + "</small></button>").join("")
          : '<div class="emptyState">Try “WWCC”, “incident records”, “first aid” or “policy”.</div>') +
        (typeof Library !== "undefined" ? Library.searchHtml(text) : "");
      box.classList.remove("hidden");
    }, 250);
  }
  function openResult(i) {
    const r = lastResults[i];
    document.getElementById("searchResults").classList.add("hidden");
    if (!r) return;
    if (r.kind === "checklist") return openItem(r.ref_id);
    openModal(
      '<div class="modalHead"><div><h2>' + esc(r.title) +
      '</h2><p>Spot check record, ready to show an authorised officer</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalMeta"><span>Details</span><b>' + esc(r.detail || "") + '</b></div><div class="modalMeta"><span>Status</span><b>' + esc(r.status) +
      '</b></div><div class="modalMeta"><span>Last updated</span><b>' + esc(r.last_updated ? fmtDT(r.last_updated) : "—") + "</b></div>" +
      '<div class="modalActions"><button class="button" onclick="closeModal()">Close</button>' +
      (r.kind === "certificate" ? '<button class="button primary" onclick="closeModal();go(\'staff\')">Open staff register</button>' : "") + "</div>"
    );
  }

  return {
    children: () => children, addEducator, saveDocument, markLeft, docUrl, addChild, childDocuments, saveChildDocument,
    boot, signIn, signOut, goOffline, showLogin, reload,
    completeTask, approveChecklist, editBaseline, uploadEvidence, logDrill, acceptUpdate, markUpdateReviewed, runExpiryCheck,
    submitCertificate, approveCertificate, submitFamilyUpdate, sendOwnerReply, acknowledgeFamilyUpdate,
    approveDraft, discardDraft, createDraft, searchEvidence, openResult,
    client: () => client(), config: cfg, q, explain, todayISO, signedUrl,
  };
})();
