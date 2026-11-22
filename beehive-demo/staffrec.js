// beehive staff records: add educators, keep every document on their file, and keep former educators.
//
// - Add educator: name, role, contact, qualification and usual days. beehive's staff agent then asks
//   them for any required credential that isn't on file.
// - Documents: required credentials (WWCC, first aid, CPR, anaphylaxis, asthma) replace the one on file and
//   update the register; qualifications, child protection training and any other document are added alongside.
// - Former educators: when someone leaves, their record moves to Former educators and stays on file for
//   3 years after their last day (Education and Care Services National Regulations, Reg 183(2)(f)).
//
// Offline, records live in this browser (with the sample educators). Signed in, they're saved to Supabase.
const StaffRecords = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-staff-records-v1";
  const KINDS = ["WWCC", "First aid", "CPR", "Anaphylaxis", "Asthma", "Qualification", "Child protection training", "Other"];
  const REQUIRED_CODE = { WWCC: "WWCC", "First aid": "FIRST_AID", CPR: "CPR", Anaphylaxis: "ANAPHYLAXIS", Asthma: "ASTHMA" };
  const QUALS = ["Early childhood teacher", "Diploma", "Working towards diploma", "Certificate III", "Working towards Certificate III"];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const ROLES = ["Educator", "Lead educator", "Assistant educator", "Early childhood teacher", "Cook"];
  const isLive = () => typeof LIVE !== "undefined" && LIVE;
  const iso = (d) => d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const fmt = (s) => (s ? new Date(String(s).slice(0, 10) + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");
  const keepUntil = (left) => { if (!left) return ""; const d = new Date(String(left).slice(0, 10) + "T00:00:00"); d.setFullYear(d.getFullYear() + 3); return iso(d); };

  // ---------- offline store: documents on each educator, and former educators ----------
  // A sample former educator, so the demo shows how records are kept after someone leaves.
  const SAMPLE_FORMER = [{
    id: "hannah", name: "Hannah Kim", role: "Educator", qualification: "Diploma", email: "hannah@example.com", phone: "",
    startedOn: daysAgo(1180), leftOn: daysAgo(236), leftReason: "Resigned (moved interstate)", certs: [],
    docs: [
      { id: "h1", kind: "WWCC", title: "Working with Children Check", number: "WWC0661204E", issued: daysAgo(1200), expires: daysAgo(-625), fileName: "hannah-wwcc.pdf" },
      { id: "h2", kind: "First aid", title: "HLTAID012 Provide First Aid", number: "HLTAID012", issued: daysAgo(700), expires: daysAgo(-395), fileName: "hannah-first-aid.pdf" },
      { id: "h3", kind: "Qualification", title: "Diploma", number: "CHC50121", issued: daysAgo(1400), expires: "", fileName: "hannah-diploma.pdf" },
      { id: "h4", kind: "Other", title: "Employment contract and separation letter", number: "", issued: daysAgo(236), expires: "", fileName: "hannah-separation.pdf" },
    ],
  }];
  // Documents already on file for the sample educators (qualifications and child protection training).
  const SAMPLE_DOCS = {
    mia: [["Qualification", "Bachelor of Early Childhood Education", "", 2100], ["Child protection training", "Child protection (CHCPRT025)", "CHCPRT025", 300]],
    noah: [["Qualification", "Diploma", "CHC50121", 1500]], ava: [["Qualification", "Diploma", "CHC50121", 900]],
    luca: [["Qualification", "Working towards Certificate III", "CHC30121", 120]], ella: [["Qualification", "Diploma", "CHC50121", 1300]],
    oliver: [["Qualification", "Diploma", "CHC50121", 700]], zara: [["Qualification", "Diploma", "CHC50121", 1000]],
    leo: [["Qualification", "Certificate III", "CHC30121", 600]], amara: [["Qualification", "Diploma", "CHC50121", 800]],
    jack: [["Qualification", "Certificate III", "CHC30121", 1100]],
  };
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) {}
    if (!s) s = { former: SAMPLE_FORMER, added: [], docs: Object.fromEntries(Object.entries(SAMPLE_DOCS).map(([id, list]) => [id, list.map(([kind, title, number, ago], i) => ({ id: id + i, kind, title, number, issued: daysAgo(ago), expires: "", fileName: title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf" }))])) };
    return s;
  }
  function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }
  // Called on load and after every change offline: puts added educators, documents and former educators in place.
  function applyOffline() {
    if (isLive() || typeof educators === "undefined") return;
    const s = load();
    s.added.forEach((a) => { if (!educators.some((e) => e.id === a.id) && !s.former.some((f) => f.id === a.id)) educators.push(Object.assign({ certs: [], alertState: "" }, a)); });
    const gone = new Set(s.former.map((f) => f.id));
    educators = educators.filter((e) => !gone.has(e.id));
    educators.forEach((e) => { e.docs = s.docs[e.id] || []; const q = (e.docs.filter((d) => d.kind === "Qualification").pop() || {}).title; if (q && !e.qualification) e.qualification = q; });
    formerEducators = s.former;
  }

  // ---------- add an educator ----------
  function openAdd() {
    openModal(
      '<div class="modalHead"><div><h2>Add an educator</h2><p>beehive will ask them for any required credential that isn’t on file yet.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="formGrid">' +
        field("Full name", '<input class="formControl" id="neName" autocomplete="off">') +
        field("Role", '<select class="formControl" id="neRole">' + ROLES.map((r) => "<option>" + r + "</option>").join("") + "</select>") +
        field("Qualification", '<select class="formControl" id="neQual">' + QUALS.map((q) => "<option>" + q + "</option>").join("") + "</select>") +
        field("Email", '<input class="formControl" id="neEmail" type="email" autocomplete="off">') +
        field("Mobile", '<input class="formControl" id="nePhone" autocomplete="off">') +
        field("Start date", '<input class="formControl" id="neStart" type="date" value="' + iso(new Date()) + '">') +
        field("Usual days", '<div class="dayPicks">' + DAYS.map((d) => '<label><input type="checkbox" value="' + d + '" checked>' + d + "</label>").join("") + "</div>") +
      "</div>" +
      '<div class="formActions"><button class="button" onclick="closeModal()">Cancel</button><button class="button primary" onclick="StaffRecords.saveNew()">Add educator</button></div>'
    );
  }
  function field(label, control) { return '<label class="formField"><span class="formLabel">' + label + "</span>" + control + "</label>"; }
  async function saveNew() {
    const v = (id) => ((document.getElementById(id) || {}).value || "").trim();
    const e = { name: v("neName"), role: v("neRole"), qualification: v("neQual"), email: v("neEmail"), phone: v("nePhone"), startedOn: v("neStart"),
      days: Array.from(document.querySelectorAll(".dayPicks input:checked")).map((x) => x.value) };
    if (e.name.split(/\s+/).length < 2) return toast("Enter the educator’s full name.");
    if (!e.days.length) return toast("Pick at least one day they usually work.");
    if (e.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email)) return toast("That email address doesn’t look right.");
    closeModal();
    if (isLive()) { await Live.addEducator(e); return; }
    e.id = e.name.toLowerCase().replace(/[^a-z]+/g, "-") + "-" + Date.now().toString(36);
    e.initials = e.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const s = load(); s.added.push(e); save(s);
    applyOffline();
    if (typeof StaffAgent !== "undefined" && StaffAgent.active()) StaffAgent.addEducator(e);
    if (typeof persist === "function") persist();
    render();
    toast(e.name + " added. beehive will email them for their credentials (simulated).");
    setTimeout(() => openStaffDetail(e.id), 300);
  }

  // ---------- documents on an educator's file ----------
  function docsHtml(e, readOnly) {
    const docs = (e.docs || []).slice().sort((a, b) => String(b.issued || "").localeCompare(String(a.issued || "")));
    return '<div class="modalSection"><div class="sectionHead"><h3>Documents on file<span class="count">' + docs.length + "</span></h3>" +
      (readOnly ? "" : '<button class="button small" onclick="StaffRecords.openDoc(\'' + E(e.id) + '\')"><span data-icon="upload"></span>Add document</button>') + "</div>" +
      (docs.length ? '<div class="docList">' + docs.map((d) =>
        '<div class="docRow"><span class="pdfIcon">' + (/\.(png|jpe?g)$/i.test(d.fileName || "") ? "IMG" : "PDF") + '</span><span class="rowMain"><b>' + E(d.title || d.kind) + "</b><small>" + E(d.kind) + (d.number ? " · " + E(d.number) : "") +
          (d.issued ? " · issued " + E(fmt(d.issued)) : "") + (d.expires ? " · expires " + E(fmt(d.expires)) : "") + "</small></span>" +
          (d.filePath && isLive() ? '<button class="textButton" onclick="StaffRecords.view(\'' + E(d.filePath) + '\')">View</button>' : d.fileName ? '<small class="muted">' + E(d.fileName) + "</small>" : "") + "</div>").join("") + "</div>"
        : '<p class="muted small">No documents yet.</p>') + "</div>";
  }
  function openDoc(id) {
    const e = educators.find((x) => x.id === id);
    if (!e) return;
    openModal(
      '<div class="modalHead"><div><h2>Add a document</h2><p>' + E(e.name) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="formGrid">' +
        field("Type", '<select class="formControl" id="ndKind" onchange="StaffRecords.kindChanged(this.value)">' + KINDS.map((k) => "<option>" + k + "</option>").join("") + "</select>") +
        field("Title", '<input class="formControl" id="ndTitle" placeholder="e.g. HLTAID012 Provide First Aid">') +
        field("Number", '<input class="formControl" id="ndNumber" placeholder="Certificate or check number">') +
        field("Issued", '<input class="formControl" id="ndIssued" type="date">') +
        field("Expires", '<input class="formControl" id="ndExpires" type="date">') +
        field("Certificate", '<input class="formControl" id="ndFile" type="file" accept=".pdf,image/*" onchange="StaffRecords.readFile(\'' + E(e.id) + '\')">') +
      "</div>" +
      '<div id="ndRead"><p class="footnote">Add a photo or PDF of the certificate and beehive reads the type, number and dates for you, then checks them against ' + E(e.name.split(" ")[0]) + "’s record." + "</p></div>" +
      '<p class="footnote" id="ndHint">Required credentials replace the one on file and update the staff register straight away.</p>' +
      '<div class="formActions"><button class="button" onclick="openStaffDetail(\'' + E(e.id) + '\')">Back</button><button class="button primary" onclick="StaffRecords.saveDoc(\'' + E(e.id) + '\')">Save to record</button></div>'
    );
  }
  function kindChanged(k) {
    const t = document.getElementById("ndTitle"), x = document.getElementById("ndExpires"), h = document.getElementById("ndHint");
    if (k === "Qualification") { t.outerHTML = '<select class="formControl" id="ndTitle">' + QUALS.map((q) => "<option>" + q + "</option>").join("") + '<option>Bachelor of Early Childhood Education</option></select>'; x.value = ""; }
    else if (t && t.tagName === "SELECT") t.outerHTML = '<input class="formControl" id="ndTitle">';
    if (h) h.textContent = REQUIRED_CODE[k] ? "Required credentials replace the one on file and update the staff register straight away." : k === "Qualification" ? "The qualification also counts towards the 50% diploma rule on the roster." : "Kept on the educator’s file with the rest of their records.";
  }
  async function saveDoc(id) {
    const v = (x) => ((document.getElementById(x) || {}).value || "").trim();
    const file = (document.getElementById("ndFile") || {}).files ? document.getElementById("ndFile").files[0] : null;
    const d = { kind: v("ndKind"), title: v("ndTitle"), number: v("ndNumber"), issued: v("ndIssued"), expires: v("ndExpires"), fileName: file ? file.name : "" };
    if (REQUIRED_CODE[d.kind] && !d.expires) return toast("Enter the expiry date for this credential.");
    if (d.expires && d.issued && d.expires <= d.issued) return toast("The expiry date must be after the issue date.");
    if (!d.title) d.title = d.kind;
    if (isLive()) { closeModal(); await Live.saveDocument(id, d, file); setTimeout(() => openStaffDetail(id), 300); return; }
    const s = load();
    d.id = "d" + Date.now().toString(36);
    s.docs[id] = (s.docs[id] || []).concat([d]);
    const added = s.added.find((a) => a.id === id);
    if (d.kind === "Qualification") { const e = educators.find((x) => x.id === id); if (e) e.qualification = d.title; if (added) added.qualification = d.title; }
    save(s);
    applyOffline();
    if (REQUIRED_CODE[d.kind] && typeof StaffAgent !== "undefined" && StaffAgent.active()) StaffAgent.recordCredential(id, REQUIRED_CODE[d.kind], { expiry: d.expires, issue: d.issued, number: d.number });
    if (typeof persist === "function") persist();
    render();
    toast("Saved to " + (educators.find((x) => x.id === id) || {}).name + "’s record.");
    setTimeout(() => openStaffDetail(id), 200);
  }
  // Read an uploaded certificate in the browser (same reader as the educator upload page) and fill in the form.
  const KIND_OF = { WWCC: "WWCC", FIRST_AID: "First aid", CPR: "CPR", ANAPHYLAXIS: "Anaphylaxis", ASTHMA: "Asthma" };
  async function readFile(id) {
    const e = educators.find((x) => x.id === id), input = document.getElementById("ndFile"), out = document.getElementById("ndRead");
    const file = input && input.files && input.files[0];
    if (!file || !out || typeof Extract === "undefined") return;
    const quick = /^image\//.test(file.type) ? '<div class="certPreview"><img src="' + URL.createObjectURL(file) + '" alt="Uploaded certificate"></div>' : "";
    out.innerHTML = quick + '<p class="okLine"><span class="status neutral">Reading</span> beehive is reading the certificate and checking it against ' + E(e ? e.name.split(" ")[0] : "the") + "’s record…</p>";
    let r;
    try { r = await Extract.analyse(file, { name: e && e.name }); } catch (err) { out.innerHTML = '<p class="footnote">Couldn’t read that file. Enter the details by hand.</p>'; return; }
    const f = r.fields, text = r.text || "";
    const preview = /^data:image\//.test(r.dataUrl || "") ? '<div class="certPreview"><img src="' + r.dataUrl + '" alt="Uploaded certificate"></div>' : '<p class="muted small">' + E(file.name) + "</p>";
    if (!f.readable) { out.innerHTML = preview + '<div class="flagBox"><b>beehive couldn’t read this file clearly</b><ul><li>Enter the details by hand from the certificate.</li></ul></div>'; return; }
    const set = (fid, v) => { const el = document.getElementById(fid); if (el && v) el.value = v; };
    if (f.type_code && KIND_OF[f.type_code]) { set("ndKind", KIND_OF[f.type_code]); kindChanged(KIND_OF[f.type_code]); }
    // course line, e.g. "HLTAID012 Provide First Aid in an education and care setting" (OCR can read 0 as O)
    const cm = text.match(/\b(H\s?[LI1]\s?T\s?A\s?[I1l|]\s?D\s?([0-9Oo]{3,4})|22578VIC|22556VIC)\s*([A-Za-z][^\n]{4,90})/i);
    const code = cm ? (cm[2] ? "HLTAID" + cm[2].replace(/[Oo]/g, "0").slice(-3) : cm[1].toUpperCase()) : "";
    const course = cm ? (code + " " + cm[3]).replace(/\s+/g, " ").trim() : ((Extract.TYPE_NAMES || {})[f.type_code]) || "";
    set("ndTitle", course); set("ndNumber", f.number); set("ndIssued", f.issue_date); set("ndExpires", f.expiry_date);
    // compare with the record
    const kind = (document.getElementById("ndKind") || {}).value || "";
    const onFile = e && (e.certs || []).find((c) => String(c.type).toLowerCase() === kind.toLowerCase());
    const fileExpiry = onFile && typeof onFile.days === "number" ? iso(new Date(Date.now() + onFile.days * 864e5)) : "";
    const today = iso(new Date());
    const nameOk = !!f.name && !!e && f.name.toLowerCase().replace(/\s+/g, " ").trim() === e.name.toLowerCase();
    const typeOk = !!f.type_code && KIND_OF[f.type_code] === kind;
    const expOk = !!f.expiry_date && f.expiry_date > today && (!fileExpiry || f.expiry_date > fileExpiry);
    const ok = (v) => (v ? '<span class="status green">Matches</span>' : '<span class="status crit">Check</span>');
    const problems = [];
    if (!nameOk) problems.push(f.name ? "The name on the certificate (" + f.name + ") doesn’t match " + (e ? e.name : "the record") + "." : "beehive couldn’t find a name on the certificate.");
    if (!typeOk) problems.push("The certificate doesn’t look like a " + kind + " certificate.");
    if (!expOk) problems.push(!f.expiry_date ? "No expiry date was found." : f.expiry_date <= today ? "This certificate has already expired." : "The expiry date isn’t later than the one on file, so this may be the old certificate.");
    (f.uncertain || []).forEach((u) => problems.push(u));
    out.innerHTML = preview +
      (problems.length ? '<div class="flagBox"><b>Check these before saving</b><ul>' + problems.map((x) => "<li>" + E(x) + "</li>").join("") + "</ul></div>"
        : '<p class="okLine"><span class="status green">Looks correct</span> beehive read the certificate: the name, credential and a newer expiry date all check out.</p>') +
      '<table class="compareTable"><thead><tr><th></th><th>On the certificate</th><th>On record</th><th></th></tr></thead><tbody>' +
      "<tr><th>Name</th><td>" + E(f.name || "Not found") + "</td><td>" + E(e ? e.name : "") + "</td><td>" + ok(nameOk) + "</td></tr>" +
      "<tr><th>Credential</th><td>" + E(course || (KIND_OF[f.type_code] || "Not found")) + "</td><td>" + E(kind) + "</td><td>" + ok(typeOk) + "</td></tr>" +
      "<tr><th>Issued</th><td>" + E(f.issue_date ? fmt(f.issue_date) : "Not found") + '</td><td class="muted">—</td><td>' + (f.issue_date ? '<span class="status neutral">Read</span>' : "") + "</td></tr>" +
      "<tr><th>Expiry</th><td>" + E(f.expiry_date ? fmt(f.expiry_date) : "Not found") + "</td><td>" + E(onFile ? onFile.expiry + (onFile.days < 0 ? " (expired)" : "") : "None on file") + "</td><td>" + (expOk ? '<span class="status green">Newer</span>' : '<span class="status crit">Check</span>') + "</td></tr>" +
      (f.number ? "<tr><th>Number</th><td>" + E(f.number) + '</td><td class="muted">—</td><td><span class="status neutral">Read</span></td></tr>' : "") +
      "</tbody></table>" + (file.__demo || f.demo || /^sample-/.test(file.name) ? '<p class="demoNote">Demo: sample certificate generated for this prototype.</p>' : "");
  }
  async function view(path) { const url = await Live.docUrl(path); if (url) window.open(url, "_blank", "noopener"); else toast("Couldn’t open that file."); }

  // ---------- an educator leaves ----------
  function openLeave(id) {
    const e = educators.find((x) => x.id === id);
    if (!e) return;
    openModal(
      '<div class="modalHead"><div><h2>' + E(e.name) + ' is leaving</h2><p>They’ll come off the roster and the reminders stop. Their records stay on file for 3 years after their last day (Reg 183).</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="formGrid">' + field("Last day", '<input class="formControl" id="lvDate" type="date" value="' + iso(new Date()) + '">') +
        field("Reason (optional)", '<input class="formControl" id="lvReason" placeholder="e.g. Resigned">') + "</div>" +
      '<div class="formActions"><button class="button" onclick="openStaffDetail(\'' + E(e.id) + '\')">Cancel</button><button class="button primary" onclick="StaffRecords.saveLeave(\'' + E(e.id) + '\')">Move to former educators</button></div>'
    );
  }
  async function saveLeave(id) {
    const date = ((document.getElementById("lvDate") || {}).value || "").trim(), reason = ((document.getElementById("lvReason") || {}).value || "").trim();
    if (!date) return toast("Enter their last day.");
    closeModal();
    if (isLive()) { await Live.markLeft(id, date); return; }
    const e = educators.find((x) => x.id === id);
    const s = load();
    s.former.unshift(Object.assign({}, e, { leftOn: date, leftReason: reason, docs: (s.docs[id] || []).concat((e.certs || []).filter((c) => !c.missing).map((c, i) => ({ id: "c" + i, kind: c.type, title: c.type, number: "", issued: "", expires: c.expiryISO || "", fileName: "" }))) }));
    save(s);
    if (typeof StaffAgent !== "undefined" && StaffAgent.active()) StaffAgent.removeEducator(id);
    applyOffline();
    if (typeof persist === "function") persist();
    render();
    toast(e.name + " moved to former educators. Records kept until " + fmt(keepUntil(date)) + ".");
  }

  // ---------- Staff page: former educators ----------
  // A button beside the educators; the list opens in a popup so the page stays short.
  function formerSection() {
    const list = typeof formerEducators !== "undefined" ? formerEducators : [];
    if (!list.length) return "";
    return '<button class="formerButton" onclick="StaffRecords.openFormerList()"><span class="rowMain"><b>Former educators <span class="count">' + list.length + "</span></b>" +
      "<small>Records kept for 3 years after their last day (Reg 183)</small></span><span class=\"chev\">" + (typeof ico === "function" ? ico("chevron") : "›") + "</span></button>";
  }
  function openFormerList() {
    const list = typeof formerEducators !== "undefined" ? formerEducators : [];
    openModal(
      '<div class="modalHead"><div><h2>Former educators</h2><p>Records kept for 3 years after their last day (Reg 183). Click someone to see their file.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      (list.length ? '<div class="tableWrap"><table class="staffTable formerTable"><thead><tr><th>Educator</th><th>Started</th><th>Last day</th><th>Keep records until</th><th>Documents</th></tr></thead><tbody>' +
        list.map((f) => '<tr onclick="StaffRecords.openFormer(\'' + E(f.id) + '\')"><td><div class="staffPerson"><b>' + E(f.name) + "</b><small>" + E(f.role) + "</small></div></td>" +
          '<td data-label="Started">' + (f.startedOn ? E(fmt(f.startedOn)) : "—") + '</td><td data-label="Last day">' + (f.leftOn ? E(fmt(f.leftOn)) : "Not recorded") + (f.leftReason ? "<small class=\"days\">" + E(f.leftReason) + "</small>" : "") + "</td>" +
          '<td data-label="Keep until"><span class="status monitor">' + (f.leftOn ? E(fmt(keepUntil(f.leftOn))) : "3 years after last day") + "</span></td>" +
          '<td data-label="Documents">' + (f.docs || []).length + " on file</td></tr>").join("") +
        "</tbody></table></div>" : '<p class="empty">No former educators.</p>'),
      "wide"
    );
  }
  function openFormer(id) {
    const f = (formerEducators || []).find((x) => x.id === id);
    if (!f) return;
    openModal(
      '<div class="modalHead"><div><h2>' + E(f.name) + "</h2><p>Former " + E(String(f.role || "educator").toLowerCase()) + (f.qualification ? " · " + E(f.qualification) : "") + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection">' + meta("Started", fmt(f.startedOn)) + meta("Last day", fmt(f.leftOn) + (f.leftReason ? " · " + f.leftReason : "")) + meta("Keep records until", f.leftOn ? fmt(keepUntil(f.leftOn)) : "3 years after their last day") + meta("Contact", [f.email, f.phone].filter(Boolean).join(" · ")) + "</div>" +
      docsHtml(f, true) + '<p class="footnote">Read only. An authorised officer can ask to see a former educator’s staff record for 3 years after they leave.</p>' +
      '<div class="formActions"><button class="button" onclick="StaffRecords.openFormerList()">Back to former educators</button></div>', "wide"
    );
  }
  function meta(label, value) { return '<div class="modalMeta"><span>' + label + "</span><b>" + E(value || "Not recorded") + "</b></div>"; }

  // Extra parts of the educator dialog: details, documents and the leaving button.
  function detailExtras(e) {
    return '<div class="modalSection">' + meta("Qualification", e.qualification || "Not recorded") + meta("Usual days", (e.days || DAYS).join(", ")) + meta("Contact", [e.email, e.phone].filter(Boolean).join(" · ")) + (e.startedOn ? meta("Started", fmt(e.startedOn)) : "") + "</div>" +
      docsHtml(e) +
      '<div class="modalSection"><button class="textButton dangerText" onclick="StaffRecords.openLeave(\'' + E(e.id) + '\')">This educator is leaving</button></div>';
  }

  return { applyOffline, openAdd, saveNew, docsHtml, openDoc, kindChanged, saveDoc, readFile, view, openLeave, saveLeave, formerSection, openFormerList, openFormer, detailExtras };
})();
