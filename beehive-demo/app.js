const BASE_ITEMS = [
  {
    id: "wwcc",
    title: "Current WWCC register",
    area: "Staff Records",
    status: "green",
    source: "National Regulations · Reg. 145, 146",
    evidence: "Staff register · 10 educator records",
    updated: "Reviewed 14 Oct 2026",
    summary:
      "Keep staff records current, including each educator’s Working With Children Check details and relevant record dates.",
    risk: "An officer may ask to verify the current status of staff checks.",
    icon: "♙",
  },
  {
    id: "firstaid",
    title: "First Aid and CPR evidence",
    area: "Staff Records",
    status: "yellow",
    source: "National Regulations · Reg. 136",
    evidence: "8 current records · 1 due for review",
    updated: "Checked 21 Oct 2026",
    summary:
      "Maintain current first-aid qualifications for the required number of educators and keep evidence available.",
    risk: "One record is approaching its review date. Confirm the certificate remains current.",
    icon: "✚",
  },
  {
    id: "training",
    title: "Staff qualification and training records",
    area: "Staff Records",
    status: "green",
    source: "National Regulations · Reg. 145–147",
    evidence: "Staff qualification register",
    updated: "Reviewed 09 Oct 2026",
    summary:
      "Keep the required staff records and evidence of qualifications and relevant training accessible.",
    risk: "Check that staff files and role details match the centre’s current roster.",
    icon: "▤",
  },
  {
    id: "enrolment",
    title: "Children’s enrolment and contact records",
    area: "Children’s Records",
    status: "green",
    source: "National Regulations · Reg. 160–162",
    evidence: "42 active child records",
    updated: "Reviewed 02 Oct 2026",
    summary:
      "Keep each child’s enrolment, parent contact and authorised nominee information up to date.",
    risk: "Confirm records reflect recent family changes.",
    icon: "♡",
  },
  {
    id: "incidents",
    title: "Incident, injury, trauma and illness records",
    area: "Children’s Records",
    status: "green",
    source: "National Regulations · Reg. 87",
    evidence: "Incident register · updated 18 Oct 2026",
    updated: "Updated 18 Oct 2026",
    summary:
      "Maintain records of incidents, injuries, trauma and illness, including the required details and notifications.",
    risk: "Be ready to show the records and associated follow-up.",
    icon: "✎",
  },
  {
    id: "medical",
    title: "Medical management and risk minimisation records",
    area: "Children’s Records",
    status: "green",
    source: "National Regulations · Reg. 90–91",
    evidence: "Children’s records · medical plans",
    updated: "Reviewed 16 Oct 2026",
    summary:
      "Keep current medical management plans and risk minimisation plans where applicable.",
    risk: "Check that plans and supporting records are current.",
    icon: "＋",
  },
  {
    id: "authorisations",
    title: "Authorisations and child collection records",
    area: "Children’s Records",
    status: "green",
    source: "National Regulations · Reg. 99–102",
    evidence: "Authorised nominee records",
    updated: "Reviewed 11 Oct 2026",
    summary:
      "Keep records of authorisations and collection arrangements required for each child.",
    risk: "Confirm staff can find the current authorised nominee information.",
    icon: "⌂",
  },
  {
    id: "evacuation",
    title: "Emergency evacuation drill logged this quarter",
    area: "Safety & Premises",
    status: "yellow",
    source: "National Regulations · Reg. 97",
    evidence: "Previous drill · 18 Jul 2026",
    updated: "Last log 18 Jul 2026",
    summary:
      "Keep a record of emergency and evacuation rehearsals, including the date and relevant details.",
    risk: "The current quarter’s drill needs to be logged before the next visit.",
    icon: "⌁",
  },
  {
    id: "premises",
    title: "Premises and safety checks",
    area: "Safety & Premises",
    status: "green",
    source: "National Regulations · Reg. 103–115",
    evidence: "Premises checklist · 20 Oct 2026",
    updated: "Updated 20 Oct 2026",
    summary:
      "Maintain safe premises, equipment and facilities, with records of relevant checks and maintenance.",
    risk: "Keep the latest checks easy to retrieve.",
    icon: "⌂",
  },
  {
    id: "emergency",
    title: "Emergency contacts and procedures",
    area: "Safety & Premises",
    status: "green",
    source: "National Regulations · Reg. 168, 170",
    evidence: "Emergency procedure folder",
    updated: "Reviewed 13 Oct 2026",
    summary:
      "Keep required policies and procedures available and ensure staff know where to find them.",
    risk: "Confirm the displayed emergency information is still current.",
    icon: "!",
  },
  {
    id: "sun",
    title: "Sun Protection Policy reviewed and current",
    area: "Policies & Procedures",
    status: "red",
    source: "National Regulations · Reg. 168 · NQS QA2",
    evidence: "No current reviewed policy attached",
    updated: "Last review 2023",
    summary:
      "A current policy should be in place for the service’s relevant health and safety practices. The centre should review its sun protection procedures against current guidance.",
    risk: "A reviewed policy is not attached. Upload the current approved document and record its review date.",
    icon: "☼",
  },
  {
    id: "sleep",
    title: "Sleep and rest policy review",
    area: "Policies & Procedures",
    status: "green",
    source: "National Regulations · Reg. 84A–84D · NQS QA2",
    evidence: "Sleep and rest policy · reviewed 21 Aug 2026",
    updated: "Reviewed 21 Aug 2026",
    summary:
      "Maintain sleep and rest policies and practices that reflect current requirements and guidance.",
    risk: "A recent guidance update may mean this policy needs another review.",
    icon: "☾",
  },
];
const AREAS = [
  "Staff Records",
  "Children’s Records",
  "Safety & Premises",
  "Policies & Procedures",
];
const ICONS = {
  "Staff Records": "♙",
  "Children’s Records": "♡",
  "Safety & Premises": "⌂",
  "Policies & Procedures": "▤",
};
const BASE_EDUCATORS = [
  {
    id: "mia",
    name: "Mia Chen",
    initials: "MC",
    role: "Lead educator",
    room: "Wattle Room",
    alertState: "Renewal prompt sent · 30 days",
    certs: [
      { type: "WWCC", expiry: "14 Jun 2028", days: 597 },
      { type: "First Aid", expiry: "24 Nov 2026", days: 30 },
      { type: "CPR", expiry: "24 Nov 2026", days: 30 },
      { type: "Anaphylaxis", expiry: "08 May 2027", days: 195 },
      { type: "Asthma", expiry: "17 Apr 2028", days: 540 },
    ],
  },
  {
    id: "noah",
    name: "Noah Williams",
    initials: "NW",
    role: "Educator",
    room: "Banksia Room",
    alertState: "Renewal prompt sent · 7 days",
    certs: [
      { type: "WWCC", expiry: "03 Feb 2028", days: 466 },
      { type: "First Aid", expiry: "12 Apr 2027", days: 169 },
      { type: "CPR", expiry: "12 Apr 2027", days: 169 },
      { type: "Anaphylaxis", expiry: "01 Nov 2026", days: 7 },
      { type: "Asthma", expiry: "09 Dec 2027", days: 410 },
    ],
  },
  {
    id: "ava",
    name: "Ava Patel",
    initials: "AP",
    role: "Educator",
    room: "Gumtree Room",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "24 Dec 2026", days: 60 },
      { type: "First Aid", expiry: "16 Mar 2027", days: 142 },
      { type: "CPR", expiry: "16 Mar 2027", days: 142 },
      { type: "Anaphylaxis", expiry: "20 Aug 2027", days: 299 },
      { type: "Asthma", expiry: "17 Nov 2026", days: 23 },
    ],
  },
  {
    id: "luca",
    name: "Luca Martin",
    initials: "LM",
    role: "Assistant educator",
    room: "Wattle Room",
    alertState: "Follow up required",
    certs: [
      { type: "WWCC", expiry: "09 Jan 2028", days: 441 },
      { type: "First Aid", expiry: "09 Sep 2026", days: -46 },
      { type: "CPR", expiry: "11 Nov 2026", days: 17 },
      { type: "Anaphylaxis", expiry: "21 Apr 2027", days: 178 },
      { type: "Asthma", expiry: "25 Oct 2027", days: 365 },
    ],
  },
  {
    id: "ella",
    name: "Ella Brooks",
    initials: "EB",
    role: "Educator",
    room: "Banksia Room",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "01 Jul 2028", days: 615 },
      { type: "First Aid", expiry: "14 May 2027", days: 201 },
      { type: "CPR", expiry: "14 May 2027", days: 201 },
      { type: "Anaphylaxis", expiry: "06 Feb 2027", days: 104 },
      { type: "Asthma", expiry: "06 Nov 2026", days: 12 },
    ],
  },
  {
    id: "oliver",
    name: "Oliver King",
    initials: "OK",
    role: "Educator",
    room: "Gumtree Room",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "16 Sep 2027", days: 326 },
      { type: "First Aid", expiry: "24 Nov 2026", days: 30 },
      { type: "CPR", expiry: "29 Nov 2026", days: 35 },
      { type: "Anaphylaxis", expiry: "02 Jun 2027", days: 220 },
      { type: "Asthma", expiry: "21 Aug 2027", days: 300 },
    ],
  },
  {
    id: "zara",
    name: "Zara Ali",
    initials: "ZA",
    role: "Educator",
    room: "Wattle Room",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "12 Apr 2028", days: 534 },
      { type: "First Aid", expiry: "24 Dec 2026", days: 60 },
      { type: "CPR", expiry: "12 Dec 2026", days: 48 },
      { type: "Anaphylaxis", expiry: "19 Jan 2027", days: 86 },
      { type: "Asthma", expiry: "25 Feb 2028", days: 488 },
    ],
  },
  {
    id: "leo",
    name: "Leo Thompson",
    initials: "LT",
    role: "Assistant educator",
    room: "Banksia Room",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "07 Aug 2027", days: 286 },
      { type: "First Aid", expiry: "09 Feb 2027", days: 107 },
      { type: "CPR", expiry: "09 Feb 2027", days: 107 },
      { type: "Anaphylaxis", expiry: "09 Feb 2027", days: 107 },
      { type: "Asthma", expiry: "24 Mar 2027", days: 150 },
    ],
  },
  {
    id: "amara",
    name: "Amara Singh",
    initials: "AS",
    role: "Educator",
    room: "Gumtree Room",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "01 Nov 2026", days: 7 },
      { type: "First Aid", expiry: "05 May 2027", days: 192 },
      { type: "CPR", expiry: "05 May 2027", days: 192 },
      { type: "Anaphylaxis", expiry: "15 May 2027", days: 202 },
      { type: "Asthma", expiry: "12 Jul 2027", days: 260 },
    ],
  },
  {
    id: "jack",
    name: "Jack Wilson",
    initials: "JW",
    role: "Educator",
    room: "Wattle Room",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "21 Jan 2028", days: 453 },
      { type: "First Aid", expiry: "21 Jan 2027", days: 88 },
      { type: "CPR", expiry: "21 Jan 2027", days: 88 },
      { type: "Anaphylaxis", expiry: "15 Jun 2027", days: 233 },
      { type: "Asthma", expiry: "28 Jan 2027", days: 95 },
    ],
  },
];
let saved = loadState();
let items = saved.items || BASE_ITEMS.map((x) => ({ ...x }));
let approved = !!saved.approved;
let educators =
  saved.educators ||
  BASE_EDUCATORS.map((e) => ({ ...e, certs: e.certs.map((c) => ({ ...c })) }));
let pendingSubmission = saved.pendingSubmission || null;
let familyMedical = saved.familyMedical || {
  childName: "Maya Patel",
  room: "Banksia Room",
  allergies: "Peanuts",
  conditions: "Asthma",
  dietary: "Peanut-free meals",
  medications: "Ventolin inhaler (as needed)",
  notes: "Please contact me if Maya has breathing symptoms.",
  emergency: "Priya Patel · 04 0000 2468",
  reviewedAt: "18 Oct 2026",
};
let medicalSubmission = saved.medicalSubmission || null;
let familyMessages = saved.familyMessages || [
  {
    from: "centre",
    text: "Hi Priya, it’s time to review Maya’s medical details. Please check the information in the family portal and send us any changes.",
    time: "Today · 9:15 am",
  },
];
let familyFile = "";
let uploadName = "";
let extractedExpiryDate = "";
let staffQuery = "";
let alertScanDone = false;
let current = approved ? "overview" : "audit";
let activeFilter = "All areas";
let query = "";
let toastTimer;
// ---- Live mode (Supabase). The offline demo keeps everything in this browser. ----
let LIVE = false; // true when signed in to Supabase
let ME = null; // { id, email, role, full_name, centre }
let CENTRE_NAME = "Beehive Early Learning";
let OWNER_NAME = "Sara Williams";
let PARENT_NAME = "Priya Patel";
let ownerThread = null; // { childId, childName, room } the owner is replying to
let aiDrafts = []; // AI-drafted parent messages waiting for staff approval
let regUpdate = null; // current regulation update (live mode)
let pendingDraftId = null; // AI draft being edited in the reply box
let auditFeed = []; // recent audit log entries (live mode) for the Overview timeline
let childIndex = {}; // child id -> name (live mode)
function firstName(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
function initials(n) { return String(n || "").trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase(); }
function CN() { return esc(CENTRE_NAME); }
function CF() { return esc(firstName(familyMedical.childName)); }
function greeting() { let h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function syncLibrarySources() {
  if (typeof Library === "undefined") return;
  items.forEach((x) => { let g = Library.guide(x.key || x.id); if (g) x.source = g.source_ref; });
}
function findItemByKey(k) { return items.find((x) => (x.key || x.id) === k); }
function loadState() {
  try {
    return JSON.parse(localStorage.getItem("beehive-audit-flow-v3") || "{}");
  } catch (e) {
    return {};
  }
}
function persist() {
  if (LIVE) return;
  localStorage.setItem(
    "beehive-audit-flow-v3",
    JSON.stringify({
      items: items,
      approved: approved,
      updateAccepted: !!saved.updateAccepted,
      updateReviewed: !!saved.updateReviewed,
      educators: educators,
      pendingSubmission: pendingSubmission,
      familyMedical: familyMedical,
      medicalSubmission: medicalSubmission,
      familyMessages: familyMessages,
    }),
  );
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}
function statusLabel(s) {
  return s === "green"
    ? "Evidence on file"
    : s === "yellow"
      ? "Review due"
      : "Evidence missing";
}
function readiness() {
  if (!items.length) return 0;
  let score = items.reduce(
    (n, x) => n + (x.status === "green" ? 1 : x.status === "yellow" ? 0.5 : 0),
    0,
  );
  return Math.round((score / items.length) * 100);
}
function countStatus(s) {
  return items.filter((x) => x.status === s).length;
}
function findItem(id) {
  return items.find((x) => x.id === id);
}
function go(page) {
  current = page;
  query = "";
  document.getElementById("globalSearch").value = "";
  document.getElementById("searchResults").classList.add("hidden");
  render();
}
function isFamily() {
  return current.indexOf("family") === 0;
}
function setNav() {
  let parent = isFamily(),
    navCurrent =
      current === "staff-upload"
        ? "staff"
        : current === "audit" || current === "updates" || current === "legal" || current === "legal-safety"
        ? "legal"
        : current === "compliance"
        ? "centre"
        : current === "family-form"
          ? "family-medical"
          : current;
  document.body.classList.toggle("familyMode", parent);
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => b.classList.toggle("active", b.dataset.nav === navCurrent));
  document
    .querySelectorAll(".ownerOnly")
    .forEach((e) => (e.style.display = parent ? "none" : ""));
  document
    .querySelectorAll(".parentOnly")
    .forEach((e) => (e.style.display = parent ? "" : "none"));
  document.querySelector(".globalSearch").style.display = parent ? "none" : "";
  document.getElementById("perspectiveButton").textContent = parent ? "Owner view" : "Family view";
  document.getElementById("topAvatar").textContent = initials(parent ? PARENT_NAME : OWNER_NAME);
  document.getElementById("workspaceProfile").innerHTML = parent
    ? '<span class="avatar">' + initials(PARENT_NAME) + '</span><span><b>' + esc(PARENT_NAME) + '</b><small>' + CF() + '’s parent</small></span><button aria-label="Profile menu" onclick="openProfileMenu()">···</button>'
    : '<span class="avatar">' + initials(OWNER_NAME) + '</span><span><b>' + esc(OWNER_NAME) + '</b><small>' + (ME && ME.role === "director" ? "Centre director" : "Centre owner") + '</small></span><button aria-label="Profile menu" onclick="openProfileMenu()">···</button>';
  if (isEducator()) document.querySelector("#workspaceProfile small").textContent = "Educator";
  document.querySelectorAll(".centreName").forEach((e) => (e.textContent = CENTRE_NAME));
  let dm = document.getElementById("dataModeLabel");
  if (dm) dm.textContent = LIVE ? "Live data" : "Offline demo";
  let pb = document.getElementById("perspectiveButton");
  if (pb) pb.style.display = LIVE ? "none" : "";
  let crumb = {
    overview: "Overview",
    updates: "Legal",
    legal: "Legal",
    "legal-safety": "Legal",
    compliance: "Centre",
    roster: "Roster",
    staff: "Staff",
    "staff-upload": isEducator() ? "My certificates" : "Upload a certificate",
    audit: "Legal",
    family: "Home",
    "family-medical": "Medical profile",
    "family-form": "Update medical details",
    "family-messages": "Messages",
  };
  document.getElementById("pageCrumb").textContent =
    crumb[current] || "Audit readiness";
  let badge = (id, n, alert) => { let el = typeof id === "string" ? document.getElementById(id) : id; if (!el) return; el.textContent = n ? n : ""; el.classList.toggle("alert", !!alert); };
  badge("gapBadge", approved ? countStatus("red") + countStatus("yellow") : "", auditOn() && items.some((x) => x.req && x.req.priority === "critical"));
  let regOpen = auditOn() ? AuditAgent.data().updates.filter((u) => u.status !== "reviewed").length : LIVE ? regUpdate && regUpdate.status !== "reviewed" : !saved.updateReviewed;
  document.querySelectorAll(".updateBadge").forEach((el) => badge(el, regOpen ? 1 : 0));
  let cb = document.getElementById("complianceBadge");
  let rb = document.getElementById("rosterBadge");
  if (rb) { let gaps = rosterGaps().length; rb.textContent = gaps || ""; rb.classList.toggle("alert", gaps > 0); }
  if (cb && typeof Library !== "undefined") {
    let due = Library.taskList().filter((t) => t.state === "overdue" || t.state === "due_soon").length + Library.agentDraftCount();
    cb.textContent = due || "";
    cb.style.display = due ? "" : "none";
  }
  if (agentOn()) {
    let ac = StaffAgent.counts();
    badge("certAlertBadge", ac.owner, ac.critical > 0);
    badge("notificationBadge", attentionItems().length);
  } else {
    badge("certAlertBadge", certDueCount() + certExpiredCount() + (pendingSubmission ? 1 : 0), certExpiredCount() > 0);
    badge("notificationBadge", (pendingSubmission ? 1 : 0) + (medicalSubmission && medicalSubmission.status === "pending" ? 1 : 0) + certDueCount());
  }
  let fm = document.getElementById("familyMedicalBadge");
  if (fm)
    fm.textContent =
      medicalSubmission && medicalSubmission.status === "pending" ? "1" : "";
}
function familyFileSelected(input) {
  familyFile = input.files && input.files.length ? input.files[0].name : "";
  document.getElementById("familyFileName").textContent =
    familyFile || "No file selected · demo only";
}
function submitFamilyUpdate() {
  if (LIVE) return Live.submitFamilyUpdate();
  let signer = document.getElementById("familySigner").value.trim();
  if (!signer) {
    toast("Enter the parent or guardian name to acknowledge this update.");
    return;
  }
  if (!document.getElementById("familyConsent").checked) {
    toast("Please confirm the acknowledgement before submitting.");
    return;
  }
  medicalSubmission = {
    childName: familyMedical.childName,
    room: familyMedical.room,
    allergies: document.getElementById("familyAllergies").value.trim(),
    conditions: document.getElementById("familyConditions").value.trim(),
    dietary: document.getElementById("familyDietary").value.trim(),
    medications: document.getElementById("familyMedications").value.trim(),
    notes: document.getElementById("familyNotes").value.trim(),
    emergency: familyMedical.emergency,
    signer: signer,
    fileName: familyFile,
    submittedAt: new Date().toLocaleString(),
    status: "pending",
  };
  familyMessages.push({
    from: "centre",
    text:
      "Thanks, " +
      signer +
      ". We’ve received " + firstName(familyMedical.childName) + "’s medical update and sent it to the centre team for review.",
    time: "Just now",
  });
  familyFile = "";
  persist();
  go("family-medical");
  toast("Update received. A receipt is now in " + firstName(familyMedical.childName) + "’s medical profile.");
}
function sendFamilyMessage() {
  if (LIVE) return Live.sendFamilyMessage();
  let input = document.getElementById("familyMessageInput"),
    text = input.value.trim();
  if (!text) {
    toast("Write a message first.");
    return;
  }
  familyMessages.push({ from: "parent", text: text, time: "Just now" });
  persist();
  go("family-messages");
  toast("Message added to the demo conversation.");
}
function sendOwnerReply() {
  if (LIVE) return Live.sendOwnerReply();
  let input = document.getElementById("ownerReplyInput"),
    text = input.value.trim();
  if (!text) {
    toast("Write a reply first.");
    return;
  }
  familyMessages.push({ from: "centre", text: text, time: "Just now" });
  persist();
  closeModal();
  render();
  toast("Reply added to the family conversation.");
}
function acknowledgeFamilyUpdate() {
  if (LIVE) return Live.acknowledgeFamilyUpdate();
  if (!medicalSubmission) return;
  familyMedical = {
    childName: medicalSubmission.childName,
    room: medicalSubmission.room,
    allergies: medicalSubmission.allergies,
    conditions: medicalSubmission.conditions,
    dietary: medicalSubmission.dietary,
    medications: medicalSubmission.medications,
    notes: medicalSubmission.notes,
    emergency: medicalSubmission.emergency,
    reviewedAt: new Date().toLocaleDateString("en-AU"),
  };
  medicalSubmission.status = "reviewed";
  medicalSubmission.reviewedAt = new Date().toLocaleString();
  familyMessages.push({
    from: "centre",
    text: "The centre has reviewed and acknowledged " + firstName(familyMedical.childName) + "’s medical update. Please message us if anything changes.",
    time: "Just now",
  });
  persist();
  closeModal();
  render();
  toast("Update acknowledged. The parent profile now shows the review status.");
}
function openProfileMenu() {
  let who = isFamily() ? PARENT_NAME : OWNER_NAME;
  let leader = LIVE && (ME.role === "owner" || ME.role === "director");
  let rows = LIVE
    ? '<div class="modalMeta"><span>Signed in as</span><b>' + esc(ME.email) + '</b></div><div class="modalMeta"><span>Role</span><b style="text-transform:capitalize">' + esc(ME.role) + "</b></div>" +
      (leader
        ? '<div class="modalMeta"><span>Staff join code</span><b>' + esc(ME.centre.staff_code) + '</b></div><div class="modalMeta"><span>Family join code</span><b>' + esc(ME.centre.family_code) + '</b></div><div class="modalActions"><button class="button" onclick="Assistant.openSettings()">AI settings</button><button class="button primary" onclick="Live.signOut()">Sign out</button></div>'
        : '<div class="modalActions"><button class="button primary" onclick="Live.signOut()">Sign out</button></div>')
    : '<p class="modalSection">You’re using the offline demo. Changes stay in this browser.</p><div class="modalActions"><button class="button" onclick="Live.resetOffline()">Reset demo data</button><button class="button primary" onclick="Live.showLogin()">Sign in to beehive</button></div>';
  openModal('<div class="modalHead"><div><h2>' + esc(who) + "</h2><p>" + CN() + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' + rows);
}
function togglePerspective() {
  if (LIVE) return;
  go(isFamily() ? "overview" : "family");
}
function demoNote(text) {
  return LIVE ? "" : text;
}
function isEducator() {
  return LIVE && ME && ME.role === "educator";
}
function ownerFirst() {
  return isEducator() ? "the centre owner" : firstName(OWNER_NAME);
}
function ico(name) {
  return typeof ICON !== "undefined" && ICON[name] ? ICON[name] : "";
}
function relTime(iso) {
  if (!iso) return "";
  let d = new Date(iso);
  if (isNaN(d)) return String(iso);
  let mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + " min ago";
  let hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + " h ago";
  let days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return days + " days ago";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
function header(title, desc, actions) {
  return (
    '<div class="pageHead"><div><h1>' + title + "</h1>" + (desc ? '<p class="lede">' + desc + "</p>" : "") +
    '</div><div class="pageActions">' + (actions || "") + "</div></div>"
  );
}
function statusTag(s, label) {
  return '<span class="status ' + s + '">' + esc(label || statusLabel(s)) + "</span>";
}
function groupRows(area, setup) {
  let list = items.filter((x) => x.area === area);
  if (!list.length) return "";
  return (
    '<section class="areaBlock"><h3>' + area + '<span class="count">' + list.length + "</span></h3>" +
    list
      .map((x) =>
        setup
          ? '<div class="checkRow"><input class="includeSwitch" type="checkbox" aria-label="Include ' + esc(x.title) + '" checked onchange="toggleApplicable(\'' + x.id + "',this.checked);this.closest('.checkRow').classList.toggle('off',!this.checked)\">" +
            '<button onclick="openItem(\'' + x.id + '\')"><span class="rowMain"><b>' + esc(x.title) + "</b><small>" + esc(x.source) + "</small></span>" + '<span class="chev">' + ico("chevron") + "</span></button></div>"
          : '<div class="checkRow"><button onclick="openItem(\'' + x.id + '\')"><span class="rowMain"><b>' + esc(x.title) + "</b><small>" + esc(x.evidence) + '</small></span><span class="rowEnd">' + statusTag(x.status) + '<span class="chev">' + ico("chevron") + "</span></span></button></div>",
      )
      .join("") +
    "</section>"
  );
}
function setupPage() {
  return (
    header(
      "Review your checklist",
      "beehive drafted these checks from the National Regulations and the NQS. Untick anything that doesn’t apply to your centre, then approve.",
      '<button class="button" onclick="openSourceInfo()">Official sources</button>',
    ) +
    '<p class="notice">Plain-English summaries, not legal advice. Check the linked source before you approve.</p>' +
    '<div class="tableTools"><span class="muted">' + items.length + ' suggested checks in 4 areas</span><span class="buttonRow"><button class="textButton" onclick="selectAll(true)">Select all</button><button class="textButton" onclick="selectAll(false)">Clear</button></span></div>' +
    AREAS.map((a) => groupRows(a, true)).join("") +
    '<div class="stickyBar"><p><b id="selectedCount">' + items.length + "</b> of " + items.length + ' checks selected. You can change this later.</p><button class="button primary" onclick="approveChecklist()">Approve checklist</button></div>'
  );
}
function miniCard(number, label, caption) {
  return '<div class="summaryTile"><span>' + label + "</span><b>" + number + "</b><small>" + caption + "</small></div>";
}
function stat(n, label, cls) {
  return '<span class="stat ' + (cls || "") + '"><b>' + n + "</b><span>" + label + "</span></span>";
}
function topGaps() {
  let gaps = items
    .filter((x) => x.status !== "green")
    .sort((a, b) => (a.status === "red" ? 0 : 1) - (b.status === "red" ? 0 : 1))
    .slice(0, 4);
  return (
    '<section class="gapList"><div class="sectionHead"><h2>Top gaps<span class="count">' + gaps.length + "</span></h2></div>" +
    (gaps.length
      ? gaps.map((x) => '<button class="row" onclick="openItem(\'' + x.id + '\')"><span class="rowMain"><b>' + esc(x.title) + "</b><small>" + esc(x.risk) + "</small></span>" + statusTag(x.status) + "</button>").join("")
      : '<p class="empty">No gaps. Every item has current evidence.</p>') +
    "</section>"
  );
}
function readinessSummary() {
  let g = countStatus("green"), y = countStatus("yellow"), r = countStatus("red"), t = items.length || 1;
  return (
    '<div><div class="readinessFigure"><b>' + readiness() + '%</b><span>audit-ready</span></div>' +
    '<div class="segBar" role="img" aria-label="' + g + " current, " + y + " due for review, " + r + ' missing"><i class="green" style="width:' + (g / t) * 100 + '%"></i><i class="yellow" style="width:' + (y / t) * 100 + '%"></i><i class="red" style="width:' + (r / t) * 100 + '%"></i></div>' +
    '<div class="summaryLine" style="border:0;margin:0;padding:12px 0 0">' + stat(g, "evidence on file", "green") + stat(y, "due for review", "yellow") + stat(r, "missing", "red") + "</div></div>"
  );
}

// ---------- Overview: what needs Sara, what is happening, what beehive is watching ----------
function certRows() {
  let out = [];
  educators.forEach((e) => e.certs.forEach((c) => { if (c.days <= 60) out.push({ e, c }); }));
  return out.sort((a, b) => a.c.days - b.c.days);
}
// Everything that needs the owner, from both agents and the rest of beehive: decisions first, then the to-dos
// beehive proposed. The Overview list, its count, the summary strip and the bell all use this one list.
function attentionItems() {
  return decisionItems().concat(auditOn() && approved ? AuditAgent.todoItems() : []);
}
function decisionItems() {
  let d = (agentOn() ? StaffAgent.decisions() : []).concat(auditOn() && approved ? AuditAgent.decisions() : []);
  if (pendingSubmission && !agentOn())
    d.push({ kind: "Verify certificate", who: pendingSubmission.staffName, detail: pendingSubmission.type + ", uploaded " + (pendingSubmission.submittedAt || ""), act: "reviewSubmission()", btn: "Review" });
  if (medicalSubmission && medicalSubmission.status === "pending")
    d.push({ kind: "Approve medical update", who: medicalSubmission.childName, detail: medicalSubmission.room + ", from " + (medicalSubmission.signer || "parent"), act: "reviewFamilyUpdate()", btn: "Review", urgent: true });
  if (!agentOn()) certRows().filter((x) => x.c.days < 0).forEach((x) =>
    d.push({ kind: "Expired credential", who: x.e.name, detail: x.c.type + " expired " + x.c.expiry + ". Decide on rostering.", act: "openStaffDetail('" + x.e.id + "')", btn: "Open", urgent: true }));
  let regPending = LIVE ? regUpdate && regUpdate.status !== "reviewed" : !saved.updateReviewed;
  if (regPending && !(auditOn() && approved))
    d.push({ kind: (LIVE ? regUpdate.status === "accepted" : saved.updateAccepted) ? "Finish policy review" : "Review regulation change", who: regUpdate ? regUpdate.title : "Safe sleep guidance review", detail: "May affect your Sleep and rest policy", act: "go('updates')", btn: "Review" });
  if (aiDrafts.length)
    d.push({ kind: "Approve family messages", who: aiDrafts.length + " draft" + (aiDrafts.length === 1 ? "" : "s"), detail: "Written by the AI agent", act: "openDraftsDrawer()", btn: "Review" });
  let agentDrafts = typeof Library !== "undefined" ? Library.agentDraftCount() : 0;
  if (agentDrafts)
    d.push({ kind: "Approve renewal reminders", who: agentDrafts + " item" + (agentDrafts === 1 ? "" : "s"), detail: "Drafted by the compliance agent", act: "go('compliance')", btn: "Open" });
  let inbox = familyInboxItem();
  if (inbox) d.push(inbox);
  return d;
}
function familyInboxItem() {
  let latest = familyMessages[familyMessages.length - 1];
  if (LIVE) {
    if (!ownerThread || !ownerThread.unanswered) return null;
    latest = { from: "parent", text: ownerThread.lastParentText };
  }
  if (!latest || latest.from !== "parent") return null;
  let child = firstName(ownerThread ? ownerThread.childName : familyMedical.childName);
  return { kind: "Reply to family", who: child + "’s family", detail: latest.text, act: "replyToFamilyThread()", btn: "Reply" };
}
function decisionRow(x) {
  return (
    '<button class="row" onclick="' + x.act + '"><span class="decisionKind' + (x.urgent ? " urgent" : "") + '"><span class="hx"></span>' + esc(x.kind) + "</span>" +
    '<span class="rowMain"><b>' + esc(x.who) + "</b><small>" + esc(x.detail) + '</small></span><span class="rowEnd"><span class="button small">' + x.btn + "</span></span></button>"
  );
}
const AUDIT_LABELS = {
  "certificate.approved": "Certificate verified",
  "certificate.submitted": "Certificate uploaded",
  "certificate.rejected": "Certificate returned",
  "reminders.expiry_check": "Expiry check ran",
  "staff_reminder.sent": "Renewal reminder sent",
  "agent.reminder_drafted": "Reminder drafted by agent",
  "agent.escalated": "Escalated to you",
  "evidence.added": "Evidence added",
  "checklist.approved": "Checklist approved",
  "checklist.generated": "Checklist drafted",
  "medical_update.submitted": "Medical update received",
  "medical_update.approved": "Medical update approved",
  "regulation_update.accepted": "Regulation change accepted",
  "regulation_update.reviewed": "Policy review completed",
  "regulation_update.ai_added": "Regulation change found",
  "compliance_record.completed": "Compliance task completed",
  "parent_message.approved_and_sent": "Message sent to family",
  "parent_message.ai_drafted": "Message drafted by agent",
  "parent_message.auto_sent": "Receipt sent to family",
  "incident.logged": "Incident logged",
  "incident.parent_notified": "Parent notified of incident",
};
function staffName(id) {
  let e = educators.find((x) => x.id === id);
  return e ? e.name : "";
}
function certOwner(certId) {
  for (let e of educators) for (let c of e.certs) if (c.certId === certId) return { e, c };
  return null;
}
function auditEntry(a) {
  let label = AUDIT_LABELS[a.action];
  if (!label) return null;
  let d = a.detail || {}, who = "", act = "";
  if (a.action === "certificate.approved") { let o = certOwner(d.staff_certificate_id); if (o) { who = o.e.name + ", " + o.c.type; act = "openStaffDetail('" + o.e.id + "')"; } }
  else if (d.staff_id) { who = staffName(d.staff_id) + (d.certificate || d.type ? ", " + String(d.certificate || d.type).replace("_", " ") : ""); act = "openStaffDetail('" + d.staff_id + "')"; }
  else if (d.child_id) who = childIndex[d.child_id] || "";
  else if (d.checklist_item_id) { let it = items.find((x) => x.id === d.checklist_item_id); if (it) { who = it.title; act = "openItem('" + it.id + "')"; } }
  else if (d.title) { who = d.title; act = "go('updates')"; }
  if (a.action === "reminders.expiry_check") who = (d.sent || 0) + " reminders to " + (d.staff || 0) + " staff";
  if (a.action === "checklist.approved" && d.items) who = d.items + " checks in your baseline";
  if (a.action.indexOf("compliance_record") === 0) act = "go('compliance')";
  return { state: "done", label, who, time: relTime(a.created_at), act };
}
function hiveActivity() {
  let out = [];
  let agent = agentOn();
  // in progress: reminders sent, waiting for a renewed certificate
  if (!agent) educators.forEach((e) => {
    let due = e.certs.filter((c) => c.days <= 60).sort((a, b) => a.days - b.days)[0];
    if (!due) return;
    let st = (e.alertState || "").toLowerCase();
    if (st.indexOf("awaiting approval") >= 0) return;
    if (st.indexOf("prompt sent") >= 0 || st.indexOf("follow up") >= 0)
      out.push({ state: "progress", label: st.indexOf("follow up") >= 0 ? "Follow-up needed" : "Awaiting certificate", who: e.name + ", " + due.type, sub: due.days < 0 ? "Expired " + due.expiry : "Expires in " + due.days + " days", act: "openStaffDetail('" + e.id + "')" });
    else if (due.days >= 0)
      out.push({ state: "watch", label: "Watching expiry", who: e.name + ", " + due.type, sub: "Expires in " + due.days + " days", act: "openStaffDetail('" + e.id + "')" });
  });
  if (typeof Library !== "undefined")
    Library.taskList().filter((t) => t.state === "due_soon").slice(0, 2).forEach((t) =>
      out.push({ state: "watch", label: "Task due soon", who: t.title, sub: t.days === 0 ? "Due today" : "Due in " + t.days + " days", act: "go('compliance')" }));
  // completed
  if (LIVE) auditFeed.filter((a) => !agent || !/^(agent\.|certificate\.|reminders\.)/.test(a.action)).map(auditEntry).filter(Boolean).slice(0, 8).forEach((x) => out.push(x));
  else {
    if (approved) out.push({ state: "done", label: "Checklist approved", who: items.length + " checks in your baseline", time: "This week", act: "go('audit')" });
    items.filter((x) => /^Logged|^Uploaded|^Reviewed/.test(x.updated || "")).forEach((x) => out.push({ state: "done", label: "Evidence added", who: x.title, time: "Today", act: "openItem('" + x.id + "')" }));
    if (!agent) educators.forEach((e) => e.certs.filter((c) => c.approvedAt).forEach((c) => out.push({ state: "done", label: "Certificate verified", who: e.name + ", " + c.type, time: c.approvedAt, act: "openStaffDetail('" + e.id + "')" })));
    if (!agent) educators.filter((e) => /prompt sent/i.test(e.alertState || "")).forEach((e) => out.push({ state: "done", label: "Renewal reminder sent", who: e.name, sub: e.alertState.replace(/^Renewal prompt sent · /, "") + " before expiry", time: "This week", act: "openStaffDetail('" + e.id + "')" }));
  }
  return out;
}
let activityExpanded = false;
function timelineHtml() {
  let all = hiveActivity();
  let order = { progress: 0, watch: 1, done: 2 };
  all.sort((a, b) => order[a.state] - order[b.state]);
  let shown = activityExpanded ? all : all.slice(0, 8);
  return (
    '<ol class="timeline">' +
    (shown.length
      ? shown.map((x) =>
          '<li class="tlItem ' + x.state + (x.act ? " link" : "") + '"' + (x.act ? ' tabindex="0" role="button" onclick="' + x.act + '" onkeydown="if(event.key===\'Enter\')this.click()"' : "") + '><span class="tlMark"></span><span class="tlText"><b>' + esc(x.label) + "</b>" +
          (x.who ? " <span>" + esc(x.who) + "</span>" : "") + (x.sub ? "<small>" + esc(x.sub) + "</small>" : "") + "</span><time>" + esc(x.time || "") + "</time></li>").join("")
      : '<li class="empty">No activity yet.</li>') +
    "</ol>" +
    (all.length > 8 ? '<button class="textButton" onclick="activityExpanded=!activityExpanded;render()">' + (activityExpanded ? "Show less" : "Show all " + all.length) + "</button>" : "") +
    '<div class="tlLegend"><span><i class="hx" style="color:var(--green)"></i>Done</span><span><i class="hx" style="color:#d9a54a"></i>In progress</span><span><i class="hx" style="color:var(--line-2)"></i>Monitoring</span></div>'
  );
}
function overviewPage() {
  let decisions = decisionItems();
  let creds = certRows();
  let expired = creds.filter((x) => x.c.days < 0), soon = creds.filter((x) => x.c.days >= 0 && x.c.days <= 14), later = creds.filter((x) => x.c.days > 14);
  let credRow = (x) =>
    '<button class="row" onclick="openStaffDetail(\'' + x.e.id + '\')"><span class="rowMain"><b>' + esc(x.e.name) + "</b><small>" + esc(x.c.type) + ", " + esc(x.e.room) + '</small></span><span class="rowMeta num">' + (x.c.days < 0 ? "Expired " + esc(x.c.expiry) : x.c.days + " days") + "</span>" + statusTag(certStatus(x.c), x.c.days < 0 ? "Expired" : x.e.alertState && /prompt sent/i.test(x.e.alertState) ? "Reminder sent" : "No reminder yet") + "</button>";
  let group = (title, list, max) => (list.length ? '<div class="credGroup"><p class="subhead"><span>' + title + '</span><span class="muted num">' + list.length + "</span></p>" + list.slice(0, max).map(credRow).join("") + (list.length > max ? '<button class="textButton moreLink" onclick="go(\'staff\')">' + (list.length - max) + " more in Staff certifications</button>" : "") + "</div>" : "");
  let regPending = LIVE ? regUpdate && regUpdate.status !== "reviewed" : !saved.updateReviewed;
  let tasks = typeof Library !== "undefined" ? Library.taskList() : [];
  let overdue = tasks.filter((t) => t.state === "overdue").length, dueSoon = tasks.filter((t) => t.state === "due_soon").length;
  let today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  if (agentOn()) {
    let att = attentionItems(), dec = att.filter((x) => !x.todo), todo = att.filter((x) => x.todo);
    let auditReady = auditOn() && approved;
    return (
      header(
        greeting() + ", " + esc(firstName(OWNER_NAME)),
        today + ". " + (att.length ? att.length + (att.length === 1 ? " thing needs" : " things need") + " you; beehive is handling the rest." : "Nothing needs you right now; beehive is handling the rest."),
        '<button class="button" onclick="exportReport()"><span data-icon="download"></span>Export audit report</button>',
      ) +
      StaffAgent.overviewSummary() +
      '<section class="section decisions" id="attention"><div class="sectionHead"><h2>Needs your attention<span class="count">' + att.length + "</span></h2><p>Decisions first, then to-dos beehive proposed</p></div>" +
      (dec.length ? dec.map(decisionRow).join("") : "") +
      (todo.length ? '<p class="subhead">Your to-do, proposed by beehive</p>' + todo.map(decisionRow).join("") : "") +
      (att.length ? "" : '<p class="empty">You’re all caught up. beehive will bring you anything that needs your judgement.</p>') +
      "</section>" +
      '<div class="twoCol"><div>' + StaffAgent.detectedHtml(7) + "</div><div>" +
      '<section class="section"><div class="sectionHead"><h2>Audit readiness</h2><button class="textButton" onclick="go(\'audit\')">Open</button></div>' +
      (auditReady ? AuditAgent.overviewRow()
        : '<button class="row" onclick="go(\'audit\')"><span class="rowMain"><b>Approve your checklist</b><small>Once approved, beehive checks every requirement against its evidence.</small></span><span class="rowMeta">Draft</span></button>') +
      '<button class="row" onclick="go(\'compliance\')"><span class="rowMain"><b>Compliance tasks</b><small>Drills, safety checks and policy reviews</small></span>' + (overdue ? statusTag("red", overdue + " overdue") : dueSoon ? statusTag("yellow", dueSoon + " due soon") : statusTag("green", "On track")) + "</button>" +
      (regPending && !auditReady ? '<button class="row" onclick="go(\'updates\')"><span class="rowMain"><b>' + esc(regUpdate ? regUpdate.title : "Safe sleep guidance review") + "</b><small>New guidance that may affect your Sleep and rest policy</small></span>" + statusTag("yellow", "Needs review") + "</button>" : "") +
      "</section>" + StaffAgent.waitingHtml() + "</div></div>" +
      '<section class="section" id="agentActivity"><div class="sectionHead"><h2>Agent activity</h2><p>Everything beehive did, in order, with what happens next</p></div>' + StaffAgent.feedHtml() + "</section>"
    );
  }
  return (
    header(
      greeting() + ", " + esc(firstName(OWNER_NAME)),
      today + ". " + (decisions.length ? decisions.length + (decisions.length === 1 ? " decision is" : " decisions are") + " waiting for you." : "Nothing needs your decision right now."),
      '<button class="button" onclick="exportReport()"><span data-icon="download"></span>Export audit report</button>',
    ) +
    '<section class="section decisions"><div class="sectionHead"><h2>Needs your decision<span class="count">' + decisions.length + "</span></h2></div>" +
    (decisions.length ? decisions.map(decisionRow).join("") : '<p class="empty">You’re all caught up. beehive will flag anything that needs you.</p>') +
    "</section>" +
    ('<div class="twoCol"><div>' +
        '<section class="section"><div class="sectionHead"><h2>Staff credentials<span class="count">' + creds.length + '</span></h2><button class="textButton" onclick="go(\'staff\')">All staff</button></div>' +
        (creds.length ? group("Expired", expired, 4) + group("Due within 14 days", soon, 4) + group("Due within 60 days", later, 3) : '<p class="empty">Every credential is current for at least 60 days.</p>') +
        "</section>" +
        '<section class="section"><div class="sectionHead"><h2>Regulations and compliance</h2><button class="textButton" onclick="go(\'compliance\')">Compliance</button></div>' +
        (regPending ? '<button class="row" onclick="go(\'updates\')"><span class="rowMain"><b>' + esc(regUpdate ? regUpdate.title : "Safe sleep guidance review") + "</b><small>New guidance that may affect your Sleep and rest policy</small></span>" + statusTag("yellow", "Needs review") + "</button>" : "") +
        '<button class="row" onclick="go(\'compliance\')"><span class="rowMain"><b>Compliance tasks</b><small>Drills, safety checks and policy reviews</small></span>' + (overdue ? statusTag("red", overdue + " overdue") : dueSoon ? statusTag("yellow", dueSoon + " due soon") : statusTag("green", "On track")) + "</button>" +
        '<button class="row" onclick="go(\'audit\')"><span class="rowMain"><b>Audit readiness</b><small>' + (approved ? countStatus("red") + " missing, " + countStatus("yellow") + " due for review" : "Checklist waiting for your approval") + '</small></span><span class="rowMeta num">' + (approved ? readiness() + "%" : "Draft") + "</span></button>" +
        "</section></div>" +
        '<section class="section"><div class="sectionHead"><h2>Hive activity</h2></div>' + timelineHtml() + "</section></div>")
  );
}
function openDraftsDrawer() {
  openModal('<div class="modalHead"><div><h2>Family messages to approve</h2><p>Drafted by the AI agent. Nothing reaches a family until you approve it.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' + aiDraftsCard(), "wide");
}

function auditPage() {
  if (!approved) return setupPage();
  if (auditOn()) return AuditAgent.auditPageHtml();
  if (LIVE && typeof AuditAgent !== "undefined" && AuditAgent.data().error === "setup") return AuditAgent.setupNote() + auditPageClassic();
  return auditPageClassic();
}
function auditPageClassic() {
  let tabs = ["All areas"].concat(AREAS).map((a) => '<button class="filterButton ' + (activeFilter === a ? "active" : "") + '" onclick="filterArea(\'' + a + "')\">" + (a === "All areas" ? "All" : a) + "</button>").join("");
  let list = activeFilter === "All areas" ? AREAS : [activeFilter];
  return (
    header("Audit readiness", "", '<button class="button" onclick="editBaseline()">Edit checklist</button><button class="button primary" onclick="exportReport()"><span data-icon="download"></span>Export audit report</button>') +
    '<div class="auditTop">' + readinessSummary() + topGaps() + "</div>" +
    '<div class="areaFilters" role="tablist">' + tabs + "</div>" +
    list.map((a) => groupRows(a, false)).join("") +
    '<p class="footnote">Checked ' + new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) + (LIVE ? ". Saved to your centre’s records." : ". Offline demo: changes stay in this browser.") + "</p>"
  );
}
function updatesPage() {
  if (auditOn() && approved) return AuditAgent.updatesPageHtml();
  let accepted = !!saved.updateAccepted;
  if (LIVE && !regUpdate)
    return header("Regulation updates", "Changes that may affect your approved checklist.") + '<p class="empty">No new updates. When guidance changes, beehive will match it to your checklist and list it here.</p>';
  let reviewed = LIVE ? regUpdate.status === "reviewed" : !!saved.updateReviewed;
  if (LIVE) accepted = regUpdate.status === "accepted";
  let sleepId = (findItemByKey("sleep") || {}).id || "sleep";
  let state = reviewed ? statusTag("green", "Reviewed") : accepted ? statusTag("yellow", "Review required") : statusTag("neutral", "New");
  return (
    header("Regulation updates", "Changes that may affect your approved checklist.") +
    '<article class="update"><p class="updateMeta">' + state + "<span>Published " + esc(regUpdate ? regUpdate.published : "18 Oct 2026") + "</span></p>" +
    "<h2>" + esc(regUpdate ? regUpdate.title : "Safe sleep guidance review") + "</h2><p>" + esc(regUpdate ? regUpdate.summary : "New safe sleep guidance may affect the centre’s Sleep and Rest Policy.") + "</p>" +
    '<dl class="kv"><dt>What to do</dt><dd>Check your sleep and rest procedures against the latest guidance and your approved policy.</dd>' +
    '<dt>Affected item</dt><dd><button class="textButton" onclick="openItem(\'' + sleepId + '\')">Sleep and rest policy review</button></dd>' +
    '<dt>Source</dt><dd><a href="https://www.acecqa.gov.au/QA2-information-sheet-sleep-and-rest-legislative-requirements" target="_blank" rel="noopener">ACECQA: Sleep and rest legislative requirements</a></dd></dl>' +
    '<div class="formActions" style="justify-content:flex-start">' +
    (reviewed ? statusTag("green", "Review complete. Your checklist reflects this guidance.") : accepted ? '<button class="button primary" onclick="markUpdateReviewed()">Mark review complete</button>' : '<button class="button primary" onclick="acceptUpdate()">Accept update & flag policy</button>') +
    "</div></article>" +
    '<p class="footnote">Accepting flags the affected checklist item for review until you confirm the policy. Summaries are guidance, not legal advice.</p>'
  );
}

// ---------- family (parent-facing) ----------
function familyHeading(title, desc, action) {
  return header(title, desc, action);
}
function familyStatus() {
  if (!medicalSubmission) return statusTag("green", "Reviewed " + familyMedical.reviewedAt);
  return medicalSubmission.status === "pending" ? statusTag("yellow", "Update in review") : statusTag("green", "Update reviewed");
}
function familyHomePage() {
  let pending = medicalSubmission && medicalSubmission.status === "pending";
  return (
    familyHeading(greeting() + ", " + esc(firstName(PARENT_NAME)), CF() + "’s care information and messages from " + CN() + ".", '<button class="button primary" onclick="go(\'family-messages\')">Message the centre</button>') +
    (pending ? '<div class="callout quiet"><span class="hx lg"></span><div><b>Your update has been received</b><p>The centre is reviewing it. You’ll get a message when it’s done.</p></div></div>' : "") +
    '<div class="childLine"><span class="avatar">' + initials(familyMedical.childName) + '</span><div><b>' + esc(familyMedical.childName) + "</b><small>" + esc(familyMedical.room) + '</small></div><span style="margin-left:auto">' + familyStatus() + "</span></div>" +
    '<button class="row" onclick="go(\'family-medical\')"><span class="rowMain"><b>Medical profile</b><small>' + esc(familyMedical.allergies || "No allergies listed") + ", " + esc(familyMedical.conditions || "no conditions listed") + '</small></span><span class="chev">' + ico("chevron") + "</span></button>" +
    '<button class="row" onclick="go(\'family-form\')"><span class="rowMain"><b>Update medical details</b><small>Tell the centre about a new allergy, medication or action plan</small></span><span class="chev">' + ico("chevron") + "</span></button>" +
    '<button class="row" onclick="go(\'family-messages\')"><span class="rowMain"><b>Messages</b><small>' + familyMessages.length + " in your conversation with the centre</small></span>" + '<span class="chev">' + ico("chevron") + "</span></button>" +
    '<p class="footnote">' + (LIVE ? "Only your child’s centre team can see these details. Pilot: please use sample information only." : "Offline demo: sample records stored in this browser. Don’t enter real medical information.") + "</p>"
  );
}
function familyMedicalPage() {
  let values = medicalSubmission && medicalSubmission.status === "pending" ? medicalSubmission : familyMedical;
  return (
    familyHeading(CF() + "’s medical profile", "Shared with " + CN() + ".", '<button class="button primary" onclick="go(\'family-form\')">Update details</button>') +
    (medicalSubmission
      ? '<div class="callout ' + (medicalSubmission.status === "pending" ? "" : "quiet") + '"><span class="hx lg"></span><div><b>' + (medicalSubmission.status === "pending" ? "Update received" : "Update reviewed") + "</b><p>Submitted " + esc(medicalSubmission.submittedAt) + (medicalSubmission.reviewedAt ? ". Reviewed " + esc(medicalSubmission.reviewedAt) + "." : ". Waiting for the centre to review.") + "</p></div>" + (medicalSubmission.status === "pending" ? statusTag("yellow", "In review") : statusTag("green", "Reviewed")) + "</div>"
      : "") +
    '<div class="familyDataGrid">' +
    familyData("Allergies", values.allergies) +
    familyData("Medical conditions", values.conditions) +
    familyData("Dietary needs", values.dietary) +
    familyData("Medication", values.medications) +
    familyData("Care notes", values.notes) +
    familyData("Emergency contact", familyMedical.emergency) +
    '</div><p class="footnote">Updates go to the centre for review. If your child needs urgent support, call the centre.</p>'
  );
}
function familyData(label, value) {
  return '<div class="familyData"><small>' + label + "</small><b>" + esc(value || "Not provided") + "</b></div>";
}
function familyFormPage() {
  let d = medicalSubmission && medicalSubmission.status === "pending" ? medicalSubmission : familyMedical;
  let field = (id, label, value, ph, wide) => '<label class="field' + (wide ? " wide" : "") + '"><span>' + label + '</span><textarea id="' + id + '" rows="2" placeholder="' + ph + '">' + esc(value || "") + "</textarea></label>";
  return (
    familyHeading("Update medical details", "Tell us what has changed. Leave a field blank if it doesn’t apply.", '<button class="button" onclick="go(\'family-medical\')">Back to profile</button>') +
    '<div class="uploadLayout"><div><div class="familyFormGrid">' +
    field("familyAllergies", "Allergies", d.allergies, "List allergies, or write None") +
    field("familyConditions", "Medical conditions", d.conditions, "Conditions educators should know about") +
    field("familyDietary", "Dietary needs", d.dietary, "Dietary requirements") +
    field("familyMedications", "Medication or action plan", d.medications, "Medication, dose and instructions") +
    field("familyNotes", "Care notes for educators", d.notes, "Anything else educators should know", true) +
    '</div><label class="familyFile"><b>Attach an updated action plan</b>Optional. A photo or PDF from your doctor.<input type="file" accept=".pdf,image/*" onchange="familyFileSelected(this)"><small id="familyFileName">' + (familyFile ? esc(familyFile) : "No file selected") + "</small></label>" +
    '<label class="field"><span>Your name, to confirm this update</span><input id="familySigner" type="text" placeholder="Full name" value="' + esc(PARENT_NAME) + '"></label>' +
    '<label class="familyConsent"><input type="checkbox" id="familyConsent"><span>I confirm these details are accurate and I consent to sharing them with ' + CF() + "’s care team.</span></label>" +
    '<div class="formActions" style="justify-content:flex-start"><button class="button primary" onclick="submitFamilyUpdate()">Submit medical update</button></div></div>' +
    '<aside><h3 style="margin-bottom:12px">What happens next</h3><ol class="steps"><li><b>You submit</b>You get a receipt straight away.</li><li><b>The centre reviews</b>It checks the details against your plan.</li><li><b>Educators are updated</b>Once approved, the room team sees the new details.</li></ol></aside></div>'
  );
}
function familyMessagesPage() {
  let content = familyMessages
    .map((m) => '<div class="messageBubble ' + (m.from === "parent" ? "fromParent" : "fromCentre") + '"><small>' + (m.from === "parent" ? "You" : CN()) + (m.time ? ", " + esc(m.time) : "") + "</small><p>" + esc(m.text) + "</p></div>")
    .join("");
  return (
    familyHeading("Messages", "Your conversation with " + CN() + " about " + CF() + ".") +
    '<div class="thread familyThreadBody" id="familyThreadBody">' + content + "</div>" +
    '<div class="familyComposer"><textarea id="familyMessageInput" rows="2" placeholder="Write a message" aria-label="Write a message to the centre"></textarea><button class="button primary" onclick="sendFamilyMessage()">Send message</button></div>' +
    '<p class="footnote">' + (LIVE ? "Saved to your child’s record. For anything urgent, call the centre." : "Offline demo: messages stay in this browser.") + "</p>"
  );
}
function medicalOwnerCard() {
  return "";
}
function aiDraftsCard() {
  if (!aiDrafts.length) return '<p class="empty">No drafts waiting.</p>';
  return (
    aiDrafts
      .map((d) => '<div class="agentItem"><small>To ' + esc(d.childName) + "’s family, " + esc(d.trigger) + '</small><textarea id="draft-' + d.id + '" rows="3" aria-label="Draft message">' + esc(d.body) + '</textarea><div class="draftActions"><button class="button small" onclick="Live.discardDraft(\'' + d.id + '\')">Discard</button><button class="button primary small" onclick="Live.approveDraft(\'' + d.id + '\')">Approve & send</button></div></div>')
      .join("")
  );
}
function familyInboxCard() {
  return "";
}
function replyToFamilyThread() {
  pendingDraftId = null;
  let content = familyMessages
    .map((m) => '<div class="messageBubble ' + (m.from === "parent" ? "fromParent" : "fromCentre") + '"><small>' + (m.from === "parent" ? "Parent" : CN()) + (m.time ? ", " + esc(m.time) : "") + "</small><p>" + esc(m.text) + "</p></div>")
    .join("");
  openModal(
    '<div class="modalHead"><div><h2>' + esc(ownerThread ? ownerThread.childName : familyMedical.childName) + "’s family</h2><p>" + CN() + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div><div class="thread familyThreadBody ownerThreadBody">' +
      content +
      '</div><div class="familyComposer"><textarea id="ownerReplyInput" rows="3" placeholder="Reply, or type a short note and choose Draft with AI" aria-label="Reply to the family"></textarea></div><div class="formActions"><button class="button" onclick="Assistant.draftReply()"><span data-icon="spark"></span>Draft with AI</button><button class="button primary" onclick="sendOwnerReply()">Send reply</button></div><p class="footnote" id="draftNote">AI drafts are never sent automatically. You review and send.</p>',
    "wide",
  );
}
function reviewFamilyUpdate() {
  if (!medicalSubmission) return;
  openModal(
    '<div class="modalHead"><div><h2>' + esc(medicalSubmission.childName) + "’s medical update</h2><p>" + esc(medicalSubmission.room) + ", submitted " + esc(medicalSubmission.submittedAt) + " by " + esc(medicalSubmission.signer) +
      '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      (medicalSubmission.fileName
        ? '<div class="reviewFile"><span class="hx lg" style="color:var(--honey)"></span><span><b>' + esc(medicalSubmission.fileName) + "</b><small>" + (LIVE ? "Attached plan" : "Selected attachment (demo)") + "</small>" +
          (medicalSubmission.fileUrl ? '<br><a href="' + esc(medicalSubmission.fileUrl) + '" target="_blank" rel="noopener">Open the attached plan</a>' : "") + "</span></div>"
        : "") +
      familyData("Allergies", medicalSubmission.allergies) +
      familyData("Medical conditions", medicalSubmission.conditions) +
      familyData("Dietary needs", medicalSubmission.dietary) +
      familyData("Medication or action plan", medicalSubmission.medications) +
      familyData("Care notes", medicalSubmission.notes) +
      '<p class="footnote">' + (LIVE ? "Acknowledging locks this record, updates the room’s medical details and tells the family. beehive doesn’t give medical advice." : "Check the details with your usual process. The offline demo doesn’t store attachments.") +
      '</p><div class="modalActions"><button class="button" onclick="closeModal()">Close</button><button class="button primary" onclick="acknowledgeFamilyUpdate()">Acknowledge update</button></div>',
  );
}

// ---------- staff certifications ----------
function certificateCell(c, label) {
  let s = certStatus(c);
  return (
    '<td data-label="' + (label || c.type) + '"><div class="certCell"><span class="certState ' + PRIO_CLASS[certPrio(c)] + '">' + certPrioLabel(c) + '</span><small class="num">' + esc(c.expiry) +
    (c.days >= 0 && c.days <= 60 ? ' <span class="days">' + c.days + " days</span>" : "") + "</small>" +
    (c.approvedAt ? '<small class="days">Verified ' + esc(c.approvedAt) + "</small>" : "") + "</div></td>"
  );
}
function staffRows() {
  return (
    filteredEducators()
      .map((e) =>
        '<tr onclick="staffDetail(\'' + e.id + '\')"><td><div class="staffPerson"><b>' + esc(e.name) + "</b><small>" + esc(e.room) + ", " + esc(e.role) + "</small></div></td>" +
        e.certs.map((c) => certificateCell(c)).join("") +
        '<td data-label="Renewal">' + (agentOn() ? StaffAgent.staffState(e.id) || '<span class="alertState">Nothing due</span>' : '<span class="alertState ' + (e.alertState ? "sent" : "") + '">' + (e.alertState ? esc(e.alertState) : "No prompt sent") + "</span>") + "</td></tr>")
      .join("") || '<tr><td colspan="7"><p class="empty">No educators match that search.</p></td></tr>'
  );
}
function staffPortalPage() {
  let due = certDueCount(),
    expired = certExpiredCount(),
    reminderTotal = educators.filter((e) => e.alertState && /prompt/i.test(e.alertState)).length;
  if (agentOn() || (LIVE && typeof StaffAgent !== "undefined" && StaffAgent.data().error))
    return (
      header("Staff records", "beehive watches every credential, chases renewals and brings you only the decisions.", '<button class="button" onclick="StaffAgent.runNow()"><span data-icon="refresh"></span>Check now</button><button class="button primary" onclick="go(\'staff-upload\')"><span data-icon="upload"></span>Upload a certificate</button>') +
      StaffAgent.staffSection() +
      '<section class="section"><div class="sectionHead"><h2>All educators<span class="count">' + educators.length + "</span></h2></div>" +
      '<div class="tableTools"><div class="legend"><span class="certState crit">Critical: expired or missing</span><span class="certState high">High: 7 days</span><span class="certState medium">Medium: 30 days</span><span class="certState monitor">Monitor: 60 days</span><span class="certState current">Current</span></div>' +
      '<input id="staffSearch" class="staffSearch" type="search" placeholder="Search educators or credentials" aria-label="Search staff certifications" oninput="searchStaff(this.value)"></div>' +
      '<div class="tableWrap"><table class="staffTable"><thead><tr><th>Educator</th><th>WWCC</th><th>First Aid</th><th>CPR</th><th>Anaphylaxis</th><th>Asthma</th><th>Renewal</th></tr></thead><tbody id="staffRows">' +
      staffRows() + "</tbody></table></div></section>" +
      '<p class="footnote">' + (LIVE ? "The agent checks every credential when you open beehive and each morning. " : "Offline demo: the agent runs in this browser with sample educators. ") + "Email and SMS are simulated: messages are recorded with recipient and time but not delivered.</p>"
    );
  return (
    header("Staff records", "", '<button class="button" onclick="runExpiryCheck()"><span data-icon="refresh"></span>Run expiry check</button><button class="button primary" onclick="go(\'staff-upload\')"><span data-icon="upload"></span>Upload a certificate</button>') +
    (pendingSubmission
      ? '<div class="callout"><span class="hx lg"></span><div><b>1 new staff certificate submitted</b><p>' + esc(pendingSubmission.staffName) + ", " + esc(pendingSubmission.type) + ". Check the file and confirm the expiry date.</p></div>" +
        '<span class="rowEnd"><button class="button primary" onclick="reviewSubmission()">Review submission</button></span></div>'
      : "") +
    '<div class="summaryLine">' + stat(educators.length, "educators") + stat(expired, "expired", expired ? "red" : "") + stat(due, "due within 60 days", due ? "yellow" : "") + stat(reminderTotal, "reminders sent") + "</div>" +
    '<div class="tableTools"><div class="legend"><span class="certState green">Active</span><span class="certState yellow">Due within 60 days</span><span class="certState red">Expired</span></div>' +
    '<input id="staffSearch" class="staffSearch" type="search" placeholder="Search educators or credentials" aria-label="Search staff certifications" oninput="searchStaff(this.value)"></div>' +
    '<div class="tableWrap"><table class="staffTable"><thead><tr><th>Educator</th><th>WWCC</th><th>First Aid</th><th>CPR</th><th>Anaphylaxis</th><th>Asthma</th><th>Renewal</th></tr></thead><tbody id="staffRows">' +
    staffRows() +
    "</tbody></table></div>" +
    '<p class="footnote">' + (LIVE ? "Reminders go out 60, 30 and 7 days before expiry. Email and SMS are simulated in this pilot; certificates are stored in your centre’s private storage." : "Offline demo: expiry checks and reminders are simulated. Files stay in this browser.") + "</p>"
  );
}
function staffUploadPage() {
  let options = educators.map((e) => '<option value="' + e.id + '" ' + (e.id === defaultUploadStaff() ? "selected" : "") + ">" + esc(e.name) + ", " + esc(e.room) + "</option>").join("");
  let types = ["First Aid", "CPR", "WWCC", "Anaphylaxis", "Asthma"];
  return (
    header(isEducator() ? "My certificates" : "Upload a certificate", isEducator() ? "Upload a renewed certificate. " + esc(ownerFirst().replace(/^the/, "The")) + " checks it before it counts." : "Upload on an educator’s behalf. This is the same page educators open from their reminder.", '<button class="button ownerBack" onclick="go(\'staff\')">Back to staff</button>') +
    (typeof Library !== "undefined" ? Library.educatorReminders() : "") +
    (agentOn() ? StaffAgent.educatorRequests() : "") +
    (auditOn() ? AuditAgent.educatorRequests() : "") +
    '<div class="uploadLayout"><div><h2>Submit a renewed certificate</h2>' +
    '<div class="ownerField"><label class="formLabel" for="uploadStaff">Educator</label><select class="formControl" id="uploadStaff">' + options + "</select></div>" +
    '<label class="formLabel" for="uploadCertType">Certificate</label><select class="formControl" id="uploadCertType">' + types.map((t) => "<option>" + t + "</option>").join("") + "</select>" +
    (agentOn()
      ? StaffAgent.uploadWidget() + '<div class="formActions" style="justify-content:flex-start"><button class="button primary" id="submitUpload" onclick="StaffAgent.submitUpload()">Submit for owner approval</button></div>'
      : '<label class="fileDrop"><b>Add a photo or PDF</b>Take a photo of the certificate or choose a file.<input id="certFile" type="file" accept=".pdf,image/*" onchange="uploadFileSelected(this)"><small id="uploadFileName">No file selected</small></label>' +
        '<div class="extracted"><div><b>Suggested date</b><small id="extractPreview">Add a file and beehive suggests the expiry date.</small></div>' + statusTag("yellow", "Check before submitting") + "</div>" +
        '<label class="formLabel" for="uploadExpiry">Expiry date on the certificate</label><input class="formControl" type="date" id="uploadExpiry">' +
        '<div class="formActions" style="justify-content:flex-start"><button class="button primary" onclick="submitCertificate()">Submit for owner approval</button></div>') +
    '<p class="footnote">' + (LIVE ? "Your file goes to the centre’s private storage." : "Offline demo: the file stays in this browser and the date is simulated.") + "</p></div>" +
    '<aside><h3 style="margin-bottom:12px">What happens next</h3><ol class="steps"><li><b>You submit</b>beehive reads the name, credential and dates, and flags anything that doesn’t match the record.</li><li><b>' + esc(ownerFirst().replace(/^the/, "The")) + ' checks it</b>Nothing changes until the file is verified.</li><li><b>You’re up to date</b>Your record turns green and your next reminder is set.</li></ol></aside></div>'
  );
}
function openStaffDetail(id) {
  let e = educators.find((x) => x.id === id);
  if (!e) return;
  let rows = e.certs
    .map((c) => '<div class="modalMeta"><span>' + esc(c.type) + '</span><span class="rowEnd"><span class="num">' + esc(c.expiry) + (c.days >= 0 && c.days <= 60 ? ", " + c.days + " days" : "") + "</span>" + statusTag(PRIO_CLASS[certPrio(c)], certPrioLabel(c)) + "</span></div>")
    .join("");
  let pending = agentOn() ? StaffAgent.staffDetailHtml(id) :
    pendingSubmission && pendingSubmission.staffId === id
      ? '<div class="callout" style="margin-top:16px"><span class="hx lg"></span><div><b>Certificate waiting for you</b><p>' + esc(pendingSubmission.type) + ", " + esc(pendingSubmission.fileName) + '</p></div><span class="rowEnd"><button class="button primary small" onclick="reviewSubmission()">Review</button></span></div>'
      : "";
  openModal(
    '<div class="modalHead"><div><h2>' + esc(e.name) + "</h2><p>" + esc(e.room) + ", " + esc(e.role) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<p class="modalSection">' + statusTag(staffStatus(e), staffStatus(e) === "green" ? "All credentials current" : staffStatus(e) === "yellow" ? "Renewal coming up" : "Expired or missing credential") + (agentOn() ? "" : '<span class="muted" style="margin-left:12px">' + esc(e.alertState || "No reminder sent") + "</span>") + "</p>" +
      rows + pending +
      '<div class="modalActions"><button class="button" onclick="closeModal()">Close</button></div>',
  );
}
function reviewSubmission() {
  if (!pendingSubmission) return;
  openModal(
    '<div class="modalHead"><div><h2>Review certificate</h2><p>' + esc(pendingSubmission.staffName) + ", " + esc(pendingSubmission.type) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="reviewFile"><span class="hx lg" style="color:var(--honey)"></span><span><b>' + esc(pendingSubmission.fileName) + "</b><small>Submitted " + esc(pendingSubmission.submittedAt) + "</small>" +
      (pendingSubmission.fileUrl ? '<br><a href="' + esc(pendingSubmission.fileUrl) + '" target="_blank" rel="noopener">Open the uploaded certificate</a>' : "") + "</span></div>" +
      '<div class="modalSection"><h3>Expiry date</h3><p>Suggested: <b>' + esc(pendingSubmission.expiry) + "</b>. Check it against the certificate before approving.</p>" +
      (LIVE ? '<label class="formLabel" for="reviewExpiry">Confirmed expiry date</label><input class="formControl" type="date" id="reviewExpiry" value="' + esc(pendingSubmission.expiryISO || "") + '">' : "") +
      '</div><div class="modalMeta"><span>Next reminder</span><b>60 days before the new expiry</b></div>' +
      '<p class="footnote">' + (LIVE ? "Approving updates the staff register, records an audit timestamp and schedules the next reminders." : "Offline demo: the file isn’t stored.") + '</p><div class="modalActions"><button class="button" onclick="closeModal()">Back</button><button class="button primary" onclick="approveCertificate()">Approve certificate</button></div>',
  );
}
function openItem(id) {
  if (auditOn() && approved) return AuditAgent.openItem(id);
  let x = findItem(id);
  if (!x) return;
  let action =
    (x.key || x.id) === "evacuation"
      ? '<button class="button primary" onclick="logDrill(\'' + x.id + "')\">Log evacuation drill</button>"
      : '<label class="button primary uploadAction"><span data-icon="upload"></span>Upload evidence<input type="file" accept=".pdf,image/*" onchange="uploadEvidence(\'' + x.id + "',this)\" hidden></label>";
  let modal =
    '<div class="modalHead"><div><p style="margin:0 0 4px">' + esc(x.area) + "</p><h2>" + esc(x.title) + '</h2></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
    '<p class="modalSection">' + statusTag(x.status) + '<span class="muted" style="margin-left:12px">' + esc(x.updated) + "</span></p>" +
    '<div class="modalSection"><h3>What needs attention</h3><p>' + esc(x.risk) + "</p></div>" +
    '<div class="modalSection"><h3>What the regulation requires</h3><p>' + esc(x.summary) + "</p></div>" +
    '<div class="modalMeta"><span>Source</span><b><a href="https://legislation.nsw.gov.au/view/html/inforce/current/sl-2011-0653" target="_blank" rel="noopener">' + esc(x.source) + '</a></b></div><div class="modalMeta"><span>Evidence</span><b>' + esc(x.evidence) + "</b></div>" +
    '<details class="more"><summary>How to comply</summary>' + Library.itemSection(x.key || x.id) + "</details>" +
    '<div class="modalActions"><button class="button" onclick="closeModal()">Close</button>' + action + "</div>";
  openModal(modal);
}
function openHelp() {
  let step = (who, title, text) => '<li class="' + who + '"><span class="hx"></span><span><b>' + title + "</b><small>" + text + '</small></span><span class="who ' + who + '">' + (who === "auto" ? "beehive" : "You") + "</span></li>";
  openModal(
    '<div class="modalHead"><div><h2>Your hive guide</h2><p>How beehive keeps your centre compliant, and when it needs you.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<section class="guideFlow"><h3>Staff compliance</h3><p>Every educator’s WWCC, first aid, CPR and anaphylaxis.</p><ol class="guideSteps2">' +
      step("auto", "Detected and prioritised", "Every credential, every day. Critical: expired or missing. High: 7 days. Medium: 30 days. Monitor: later.") +
      step("auto", "Educator asked to renew", "A personal request with the deadline and a secure upload link (simulated email or SMS).") +
      step("auto", "Followed up", "If nothing arrives by the follow-up date, beehive asks again. Critical or ignored requests are escalated to you with a recommended action.") +
      step("auto", "Upload checked", "beehive reads the name, credential and dates and flags anything that doesn’t match.") +
      step("you", "Verified", "You approve or reject. Nothing counts until you do.") +
      step("auto", "Record updated", "The credential, verification date and compliance status update and the task closes.") +
      "</ol></section>" +
      '<section class="guideFlow"><h3>Audit readiness</h3><p>Your approved checklist, mapped to the regulations.</p><ol class="guideSteps2">' +
      step("auto", "Requirement monitored", "Each requirement is checked against its verified evidence, due dates and compliance tasks.") +
      step("auto", "Gap explained", "Missing, out-of-date or unverified evidence is prioritised, with why it matters and the next action.") +
      step("auto", "Evidence requested", "beehive asks whoever holds it, with an upload link, and follows up (simulated). Credential gaps go to the staff agent.") +
      step("auto", "Regulation changes assessed", "Possibly affected requirements are flagged Review required, with a task for you.") +
      step("you", "Verified or decided", "You verify the evidence and record regulation decisions. Uploading alone never makes anything compliant.") +
      step("auto", "Readiness updated", "Status, verification date and readiness update, and every step is in the activity feed.") +
      "</ol></section>" +
      '<div class="guideKey"><span><i class="hx" style="color:var(--honey)"></i>beehive does this</span><span><i class="hx" style="color:var(--ink)"></i>You decide</span></div>' +
      '<div class="modalActions"><button class="button" onclick="closeModal();go(\'staff\')">Staff certifications</button><button class="button primary" onclick="closeModal();go(\'audit\')">Audit readiness</button></div>',
  );
}
function openSourceInfo() {
  openModal(
    '<div class="modalHead"><div><h2>Official sources</h2><p>Check these before you approve your checklist.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection"><h3>Education and Care Services National Regulations</h3><p>The legal requirements behind every check. <a href="https://legislation.nsw.gov.au/view/html/inforce/current/sl-2011-0653" target="_blank" rel="noopener">Open the current version</a></p></div>' +
      '<div class="modalSection"><h3>National Quality Standard</h3><p>The 7 quality areas services are assessed against. <a href="https://www.acecqa.gov.au/nqf/national-quality-standard" target="_blank" rel="noopener">Open ACECQA</a></p></div>' +
      '<p class="footnote">Checklist wording is a plain-English summary. Check amendments and NSW-specific rules in the Compliance library.</p><div class="modalActions"><button class="button" onclick="closeModal();go(\'compliance\');Library.setTab(\'guidance\')">Compliance library</button><button class="button primary" onclick="closeModal()">Done</button></div>',
  );
}

function auditOn() {
  return typeof AuditAgent !== "undefined" && AuditAgent.active();
}
function agentOn() {
  return typeof StaffAgent !== "undefined" && StaffAgent.active();
}
// One priority scale everywhere: Critical = expired or missing, High = 7 days or less, Medium = 30 days or less,
// Monitor = within 60 days (the agent is watching), Current = later.
function certPrio(c) {
  if (!c || c.missing || c.days < 0) return "critical";
  return c.days <= 7 ? "high" : c.days <= 30 ? "medium" : c.days <= 60 ? "monitor" : "current";
}
const PRIO_CLASS = { critical: "crit", high: "high", medium: "medium", monitor: "monitor", current: "current" };
function certPrioLabel(c) {
  let p = certPrio(c);
  return p === "critical" ? (c.missing ? "Critical · missing" : "Critical · expired") : p === "current" ? "Current" : p.charAt(0).toUpperCase() + p.slice(1);
}
function certStatus(c) {
  let p = certPrio(c);
  return p === "critical" ? "red" : p === "current" ? "green" : "yellow";
}
function certStatusLabel(s) {
  return s === "green" ? "Current" : s === "yellow" ? "Expiring" : "Expired";
}
function certDueCount() {
  return educators.reduce(
    (n, e) => n + e.certs.filter((c) => c.days >= 0 && c.days <= 60).length,
    0,
  );
}
function certExpiredCount() {
  return educators.reduce(
    (n, e) => n + e.certs.filter((c) => c.days < 0).length,
    0,
  );
}
function staffStatus(e) {
  let s = e.certs.map(certStatus);
  return s.includes("red") ? "red" : s.includes("yellow") ? "yellow" : "green";
}
function filteredEducators() {
  let q = staffQuery.trim().toLowerCase();
  return educators.filter(
    (e) =>
      !q ||
      (
        e.name +
        " " +
        e.room +
        " " +
        e.role +
        " " +
        e.certs
          .map(
            (c) =>
              c.type + " " + c.expiry + " " + certStatusLabel(certStatus(c)),
          )
          .join(" ")
      )
        .toLowerCase()
        .includes(q),
  );
}
function defaultUploadStaff() {
  if (!LIVE) return "mia";
  if (isEducator()) { let me = educators.find((e) => e.userId === ME.id); if (me) return me.id; }
  // the educator whose next certificate expires soonest (still current)
  let best = null, bestDays = 1e9;
  educators.forEach((e) => e.certs.forEach((c) => { if (c.days >= 0 && c.days < bestDays) { bestDays = c.days; best = e.id; } }));
  return best || (educators[0] && educators[0].id);
}
function searchStaff(value) {
  staffQuery = value;
  let tbody = document.getElementById("staffRows");
  if (tbody) tbody.innerHTML = staffRows();
}
function runExpiryCheck() {
  if (LIVE) return Live.runExpiryCheck();
  let due = [];
  let targets = new Set();
  educators.forEach((e) =>
    e.certs.forEach((c) => {
      if ([60, 30, 7].includes(c.days)) {
        due.push({ e: e, c: c });
        targets.add(e.id);
        e.alertState = "Renewal prompt sent · " + c.days + " days";
      }
    }),
  );
  alertScanDone = true;
  persist();
  render();
  toast(
    "Daily expiry scan complete · " +
      targets.size +
      " staff targeted; SMS/email reminders are simulated for the 60, 30 and 7 day windows.",
  );
}
function staffDetail(id) {
  openStaffDetail(id);
}
function uploadFileSelected(input) {
  if (!input.files || !input.files.length) return;
  uploadName = input.files[0].name;
  let staff = document.getElementById("uploadStaff");
  let type = document.getElementById("uploadCertType").value;
  let person = educators.find((e) => e.id === staff.value);
  let d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  extractedExpiryDate = d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  document.getElementById("uploadFileName").textContent =
    "Selected: " + uploadName;
  let ex = document.getElementById("uploadExpiry");
  if (ex && !ex.value) ex.value = d.toLocaleDateString("en-CA");
  document.getElementById("extractPreview").textContent =
    person.name +
    " · " +
    type +
    " · suggested expiry " +
    extractedExpiryDate +
    " (demo extraction)";
}
function submitCertificate() {
  if (LIVE) return Live.submitCertificate();
  let file = document.getElementById("certFile");
  if (!file || !file.files || !file.files.length) {
    toast("Select a certificate photo or PDF first.");
    return;
  }
  let staff = educators.find(
    (e) => e.id === document.getElementById("uploadStaff").value,
  );
  let type = document.getElementById("uploadCertType").value;
  pendingSubmission = {
    staffId: staff.id,
    staffName: staff.name,
    type: type,
    fileName: file.files[0].name,
    expiry: extractedExpiryDate || "25 Oct 2028",
    submittedAt: new Date().toLocaleString(),
  };
  persist();
  current = "staff";
  render();
  toast("Certificate submitted. " + firstName(OWNER_NAME) + " has been notified in the demo portal.");
}
function approveCertificate() {
  if (LIVE) return Live.approveCertificate();
  if (!pendingSubmission) return;
  let e = educators.find((x) => x.id === pendingSubmission.staffId);
  if (!e) return;
  let c = e.certs.find((x) => x.type === pendingSubmission.type);
  if (c) {
    c.expiry = pendingSubmission.expiry;
    c.days = 730;
    c.approvedAt = new Date().toLocaleString();
  }
  e.alertState = "Approved · next reminder 60 days before expiry";
  let who = e.name;
  pendingSubmission = null;
  persist();
  closeModal();
  current = "staff";
  render();
  toast(
    who +
      "’s certificate is approved. Status is green and the audit timestamp is recorded.",
  );
}
function handleNotifications() {
  if (agentOn()) {
    let first = attentionItems()[0];
    if (!first) return go("overview");
    if (current !== "overview") go("overview");
    new Function(first.act)();
    return;
  }
  if (pendingSubmission) {
    current = "staff";
    render();
    reviewSubmission();
    return;
  }
  go("staff");
  toast(
    certDueCount() +
      " certificate expiries are in the 60 / 30 / 7 day demo alert windows.",
  );
}

function render() {
  if (!LIVE) syncLibrarySources();
  setNav();
  let baselineLabel = document.getElementById("baselineLabel");
  if (baselineLabel)
    baselineLabel.textContent = approved
      ? "Approved for this centre · evidence review"
      : "AI-suggested draft · owner review required";
  let root = document.getElementById("page");
  root.innerHTML =
    current === "overview"
      ? overviewPage()
      : current === "roster"
      ? rosterPage()
      : current === "legal"
      ? Legal.tabs() + Legal.briefingPage()
      : current === "legal-safety"
      ? Legal.tabs() + Legal.safetyPage()
      : current === "updates"
        ? Legal.tabs() + updatesPage()
        : current === "compliance"
        ? Centre.page()
        : current === "staff"
          ? staffPortalPage()
          : current === "staff-upload"
            ? staffUploadPage()
            : current === "family"
              ? familyHomePage()
              : current === "family-medical"
                ? familyMedicalPage()
                : current === "family-form"
                  ? familyFormPage()
                  : current === "family-messages"
                    ? familyMessagesPage()
                    : Legal.tabs() + auditPage();
  if (typeof fillIcons === "function") fillIcons(document);
  if (typeof Assistant !== "undefined") Assistant.refresh();
  if (document.getElementById("selectedCount"))
    document.getElementById("selectedCount").textContent =
      document.querySelectorAll(
        '.checkRow input[type="checkbox"]:checked',
      ).length;
}
function toggleApplicable(id, on) {
  let x = findItem(id);
  if (!x) return;
  if (!on) {
    x.omitted = true;
  } else {
    x.omitted = false;
  }
  document.getElementById("selectedCount").textContent =
    document.querySelectorAll(
      '.checkRow input[type="checkbox"]:checked',
    ).length;
}
function selectAll(on) {
  document
    .querySelectorAll('.checkRow input[type="checkbox"]')
    .forEach((c) => (c.checked = on));
  document.getElementById("selectedCount").textContent =
    document.querySelectorAll(
      '.checkRow input[type="checkbox"]:checked',
    ).length;
}
function approveChecklist() {
  if (LIVE) return Live.approveChecklist();
  let selected = [
    ...document.querySelectorAll('.checkRow input[type="checkbox"]:checked'),
  ].map((x) => x.getAttribute("aria-label").replace(/^Include /, ""));
  if (selected.length < 4) {
    toast("Keep at least four items in your centre baseline.");
    return;
  }
  let checkedIds = [];
  document
    .querySelectorAll('.checkRow input[type="checkbox"]:checked')
    .forEach((c) => {
      let title = c.getAttribute("aria-label").replace(/^Include /, "");
      let found = items.find((x) => x.title === title);
      if (found) checkedIds.push(found.id);
    });
  items = items.filter((x) => checkedIds.includes(x.id));
  approved = true;
  persist();
  current = "audit";
  let r = typeof AuditAgent !== "undefined" ? AuditAgent.onApproved() : null;
  render();
  if (r && typeof StaffAgent !== "undefined") StaffAgent.announce(null, r);
  else toast("Checklist approved. Your centre baseline is ready.");
}
function editBaseline() {
  if (LIVE) return Live.editBaseline();
  current = "audit";
  approved = false;
  render();
  toast("Edit the selected items, then approve the baseline again.");
}
function filterArea(a) {
  activeFilter = a;
  render();
}
function openModal(html, size) {
  let root = document.getElementById("modalRoot");
  root.innerHTML = '<div class="modalShade" onclick="if(event.target===this)closeModal()"><div class="modal' + (size ? " " + size : "") + '" role="dialog" aria-modal="true">' + html + "</div></div>";
  if (typeof fillIcons === "function") fillIcons(root);
  let first = root.querySelector(".closeButton");
  if (first) first.focus({ preventScroll: true });
}
function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}
function uploadEvidence(id, input) {
  if (LIVE) return Live.uploadEvidence(id, input);
  if (!input.files || !input.files.length) return;
  let x = findItem(id);
  if (!x) return;
  x.status = "green";
  x.evidence = input.files[0].name;
  x.updated = "Uploaded and logged " + new Date().toLocaleString();
  persist();
  closeModal();
  render();
  toast("Evidence added to the demo record. Readiness updated.");
}
function logDrill(id) {
  if (LIVE) return Live.logDrill(id);
  let x = findItem(id);
  x.status = "green";
  x.evidence = "Evacuation drill logged · " + new Date().toLocaleDateString();
  x.updated = "Logged " + new Date().toLocaleString();
  if (typeof Library !== "undefined") Library.drillLogged();
  persist();
  closeModal();
  render();
  toast(
    "Drill logged. The readiness score updated and a timestamp was recorded.",
  );
}
function acceptUpdate() {
  if (LIVE) return Live.acceptUpdate();
  saved.updateAccepted = true;
  let x = findItem("sleep");
  if (x) {
    x.status = "yellow";
    x.updated = "Review required · " + new Date().toLocaleDateString();
    x.risk =
      "Review the current policy against the newly flagged guidance, then record the review.";
    x.evidence = "Sleep and rest policy · review required";
  }
  persist();
  render();
  toast("Update accepted. The Sleep and Rest Policy is flagged for review.");
}
function markUpdateReviewed() {
  if (LIVE) return Live.markUpdateReviewed();
  let x = findItem("sleep");
  if (x) {
    x.status = "green";
    x.updated = "Reviewed " + new Date().toLocaleString();
    x.evidence = "Sleep and rest policy · owner review completed";
    x.risk = "No outstanding review flagged.";
  }
  saved.updateAccepted = false;
  saved.updateReviewed = true;
  persist();
  render();
  toast("Policy review recorded. Checklist status is current.");
}
function exportReport() {
  if (!approved) {
    toast("Approve the checklist before exporting an audit report.");
    return;
  }
  document.getElementById("printDate").textContent =
    "Generated " + new Date().toLocaleString() + " · " + CENTRE_NAME;
  let body = document.getElementById("printRows");
  body.innerHTML = AREAS.map(
    (a) =>
      "<h2>" +
      a +
      "</h2>" +
      items
        .filter((x) => x.area === a)
        .map(
          (x) =>
            '<div class="printRow"><b>' +
            esc(x.title) +
            "</b><span>" +
            statusLabel(x.status) +
            "</span><p>" +
            esc(x.source) +
            " · " +
            esc(x.evidence) +
            " · " +
            esc(x.updated) +
            "</p></div>",
        )
        .join(""),
  ).join("");
  window.print();
}
function searchEvidence(value) {
  if (LIVE) return Live.searchEvidence(value);
  query = value.trim().toLowerCase();
  let box = document.getElementById("searchResults");
  if (!query) {
    box.classList.add("hidden");
    return;
  }
  let terms = query.split(/\s+/).filter(Boolean);
  let results = items
    .filter((x) => {
      let text = (
        x.title +
        " " +
        x.area +
        " " +
        x.source +
        " " +
        x.evidence +
        " " +
        x.status
      ).toLowerCase();
      return terms.every((term) => text.includes(term));
    })
    .slice(0, 6);
  box.innerHTML =
    '<div class="resultHeading">' +
    (results.length ? "Matching evidence" : "No matching evidence") +
    "</div>" +
    (results.length
      ? results
          .map(
            (x) =>
              '<button class="searchResult" onclick="searchOpen(\'' +
              x.id +
              "')\"><b>" +
              esc(x.title) +
              "</b><small>" +
              esc(x.area) +
              " · " +
              statusLabel(x.status) +
              " · " +
              esc(x.updated) +
              "</small></button>",
          )
          .join("")
      : '<div class="emptyState">Try “WWCC”, “incident records” or “policy”.</div>') +
    Library.searchHtml(query);
  box.classList.remove("hidden");
}
function submitSearch(value) {
  searchEvidence(value);
  let box = document.getElementById("searchResults");
  let first = box.querySelector(".searchResult");
  if (first) first.click();
}
function searchOpen(id) {
  document.getElementById("searchResults").classList.add("hidden");
  openItem(id);
}
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeModal();
    document.getElementById("searchResults").classList.add("hidden");
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    document.getElementById("globalSearch").focus();
  }
});
document.addEventListener("click", function (e) {
  let results = document.getElementById("searchResults"),
    search = document.querySelector(".globalSearch");
  if (results && !search.contains(e.target)) results.classList.add("hidden");
});
function toast(message) {
  let t = document.getElementById("toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
Live.boot();

// ---------------------------------------------------------------------------------------------
// Legal: Briefing, ACECQA requirements, Safety and premises and Regulation updates (tabs in legal.js).

// ---------------------------------------------------------------------------------------------
// Roster: who is in each room today, and whether their credentials let them count.
// Shifts are sample data in the offline demo. Reg 151 requires a record of the rooms and times
// each educator works directly with children, with their WWCC number.
var ROSTER_SHIFTS = [["6:30 am", "3:00 pm"], ["7:30 am", "4:00 pm"], ["9:00 am", "5:30 pm"], ["10:00 am", "6:30 pm"]];
var FIRST_AID_SET = ["First Aid", "CPR", "Anaphylaxis", "Asthma"];
function rosterToday() {
  if (!ROSTER_SHIFTS) return [];
  return educators.map((e, i) => {
    let cert = (t) => e.certs.find((c) => c.type === t);
    let ok = (t) => { let c = cert(t); return !!c && c.days >= 0; };
    let shift = ROSTER_SHIFTS[i % ROSTER_SHIFTS.length];
    return { e, start: shift[0], end: shift[1], wwcc: ok("WWCC"), firstAid: FIRST_AID_SET.every(ok), lapsed: FIRST_AID_SET.filter((t) => !ok(t)) };
  });
}
function rosterRooms() {
  let rooms = {};
  rosterToday().forEach((r) => (rooms[r.e.room] = rooms[r.e.room] || []).push(r));
  return rooms;
}
function rosterGaps() {
  let gaps = [];
  rosterToday().forEach((r) => { if (!r.wwcc) gaps.push({ room: r.e.room, text: r.e.name + " has no current WWCC and can’t work with children." }); });
  Object.entries(rosterRooms()).forEach(([room, list]) => {
    if (!list.some((r) => r.firstAid && r.wwcc)) gaps.push({ room, text: room + " has no educator with current first aid, CPR, anaphylaxis and asthma training on shift (Reg 136)." });
  });
  return gaps;
}
function rosterPage() {
  let rooms = rosterRooms(), gaps = rosterGaps(), today = rosterToday();
  let counted = today.filter((r) => r.firstAid && r.wwcc).length;
  let summary =
    '<div class="rosterSummary"><div><b class="num">' + today.length + "</b><small>Educators on today</small></div>" +
    '<div><b class="num">' + Object.keys(rooms).length + "</b><small>Rooms</small></div>" +
    '<div><b class="num">' + counted + "</b><small>Count towards first aid cover</small></div>" +
    '<div><b class="num ' + (gaps.length ? "bad" : "") + '">' + gaps.length + "</b><small>Gaps to fix</small></div></div>";
  let callout = gaps.length
    ? '<div class="callout"><div><b>Fix before the shift starts</b><ul class="rosterGapList">' + gaps.map((g) => "<li>" + esc(g.text) + "</li>").join("") + "</ul></div></div>"
    : "";
  let roomBlocks = Object.entries(rooms)
    .map(([room, list]) => {
      let covered = list.some((r) => r.firstAid && r.wwcc);
      return (
        '<section class="section"><div class="sectionHead"><h2>' + esc(room) + '<span class="count">' + list.length + "</span></h2>" +
        statusTag(covered ? "green" : "red", covered ? "First aid covered" : "No first aid cover") + "</div>" +
        '<table class="staffTable rosterTable"><thead><tr><th>Educator</th><th>Shift</th><th>WWCC</th><th>First aid cover</th></tr></thead><tbody>' +
        list
          .map((r) =>
            '<tr onclick="staffDetail(\'' + r.e.id + '\')"><td><div class="staffPerson"><b>' + esc(r.e.name) + "</b><small>" + esc(r.e.role) + "</small></div></td>" +
            '<td data-label="Shift" class="num">' + r.start + " – " + r.end + "</td>" +
            '<td data-label="WWCC">' + statusTag(r.wwcc ? "green" : "red", r.wwcc ? "Current" : "Not current") + "</td>" +
            '<td data-label="First aid cover">' + statusTag(r.firstAid ? "green" : "yellow", r.firstAid ? "Counts" : "Doesn’t count: " + r.lapsed.join(", ") + " lapsed") + "</td></tr>")
          .join("") +
        "</tbody></table></section>"
      );
    })
    .join("");
  return (
    header("Roster", "Who is in each room today, and whether their credentials let them count.") +
    summary + callout + roomBlocks +
    '<p class="footnote">' + (LIVE ? "" : "Offline demo: shifts are sample data. ") + "This roster doubles as your record of educators working directly with children (Reg 151): rooms, times and WWCC for each educator.</p>"
  );
}
