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
    id: "child_protection",
    title: "Child protection and child safe practice",
    area: "Staff Records",
    status: "yellow",
    source: "National Law s162A · National Regulations · Reg. 84, 168",
    evidence: "Training records · 2 staff not yet briefed this year",
    updated: "Checked 30 Oct 2026",
    summary:
      "Staff must know current child protection law and their obligations, including mandatory reporting, and follow the child safe environment policy.",
    risk: "Two staff members have no child protection briefing recorded this year.",
    icon: "♙",
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
    id: "medication",
    title: "Medication records and authorisations",
    area: "Children’s Records",
    status: "green",
    source: "National Regulations · Reg. 92–96",
    evidence: "Medication record · 3 children with authorisations",
    updated: "Reviewed 22 Oct 2026",
    summary:
      "Give medication only with written parent authorisation and record every dose, who gave it and who checked it.",
    risk: "Keep the medication record with each child’s current authorisation.",
    icon: "＋",
  },
  {
    id: "authorisations",
    title: "Authorised nominees and child collection records",
    area: "Children’s Records",
    status: "green",
    source: "National Regulations · Reg. 99, 160–161",
    evidence: "Authorised nominee records",
    updated: "Reviewed 11 Oct 2026",
    summary:
      "Keep records of authorisations and collection arrangements required for each child.",
    risk: "Confirm staff can find the current authorised nominee information.",
    icon: "⌂",
  },
  {
    id: "evacuation",
    title: "Emergency and evacuation rehearsal this quarter",
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
    id: "excursions",
    title: "Excursion risk assessments and authorisations",
    area: "Safety & Premises",
    status: "green",
    source: "National Regulations · Reg. 100–102",
    evidence: "Regular outing risk assessment · reviewed Aug 2026",
    updated: "Reviewed 12 Aug 2026",
    summary:
      "Do a risk assessment before each excursion and get written authorisation for every child who goes.",
    risk: "Update the risk assessment if the route, location or group size changes.",
    icon: "⌁",
  },
  {
    id: "food",
    title: "Food safety, nutrition and weekly menu",
    area: "Safety & Premises",
    status: "green",
    source: "National Regulations · Reg. 77–80",
    evidence: "Weekly menu on display",
    updated: "Updated 10 Nov 2026",
    summary:
      "Provide nutritious food that suits each child’s dietary needs, follow safe food handling and display the weekly menu.",
    risk: "Check this week’s menu against children’s allergies.",
    icon: "☕",
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
  {
    id: "policies",
    title: "Required policies and procedures in place",
    area: "Policies & Procedures",
    status: "green",
    source: "National Regulations · Reg. 168–172",
    evidence: "Policy folder · 24 policies",
    updated: "Reviewed 01 Sep 2026",
    summary:
      "Have every policy the Regulations require, follow them, keep them available and give families notice of changes.",
    risk: "Keep each policy’s review date current.",
    icon: "▤",
  },
  {
    id: "digital",
    title: "Safe use of digital technology and images",
    area: "Policies & Procedures",
    status: "red",
    source: "National Regulations · Reg. 168",
    evidence: "No current policy attached",
    updated: "Not yet recorded",
    summary:
      "Have a policy on the safe use of digital technologies and online environments, including taking and storing images of children.",
    risk: "Upload the centre’s digital technology and images policy.",
    icon: "▣",
  },
  {
    id: "program",
    title: "Educational program and documentation",
    area: "Policies & Procedures",
    status: "green",
    source: "National Law s168 · National Regulations · Reg. 73–76",
    evidence: "Program and learning records",
    updated: "Reviewed 03 Nov 2026",
    summary:
      "Base the program on the approved learning framework, document each child’s learning and share it with families.",
    risk: "Keep each child’s documentation up to date.",
    icon: "✎",
  },
  {
    id: "qip",
    title: "Quality Improvement Plan reviewed",
    area: "Policies & Procedures",
    status: "green",
    source: "National Regulations · Reg. 31, 55, 56",
    evidence: "QIP · reviewed Mar 2026",
    updated: "Reviewed 14 Mar 2026",
    summary:
      "Keep a Quality Improvement Plan with a self-assessment against the NQS and review it at least once a year.",
    risk: "Next annual review due March 2027.",
    icon: "★",
  },
  {
    id: "notifications",
    title: "Notifications to the regulator",
    area: "Policies & Procedures",
    status: "green",
    source: "National Law s174 · National Regulations · Reg. 175–176",
    evidence: "No notifications due",
    updated: "Checked 18 Oct 2026",
    summary:
      "Notify serious incidents and complaints alleging a serious incident or a breach within 24 hours.",
    risk: "Keep a copy of every notification with the incident record.",
    icon: "!",
  },
];
const AREAS = [
  "Staff Records",
  "Children’s Records",
  "Safety & Premises",
  "Policies & Procedures",
];
const BASE_EDUCATORS = [
  {
    id: "mia",
    name: "Mia Chen",
    initials: "MC",
    role: "Lead educator",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "14 Jun 2028", days: 597 },
      { type: "First Aid", expiry: "02 Jul 2027", days: 250 },
      { type: "CPR", expiry: "02 Jul 2027", days: 250 },
      { type: "Anaphylaxis", expiry: "08 May 2027", days: 195 },
      { type: "Asthma", expiry: "17 Apr 2028", days: 540 },
    ],
  },
  {
    id: "noah",
    name: "Noah Williams",
    initials: "NW",
    role: "Educator",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "03 Feb 2028", days: 466 },
      { type: "First Aid", expiry: "12 Apr 2027", days: 169 },
      { type: "CPR", expiry: "12 Apr 2027", days: 169 },
      { type: "Anaphylaxis", expiry: "10 Sep 2027", days: 320 },
      { type: "Asthma", expiry: "09 Dec 2027", days: 410 },
    ],
  },
  {
    id: "ava",
    name: "Ava Patel",
    initials: "AP",
    role: "Educator",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "24 Sep 2028", days: 700 },
      { type: "First Aid", expiry: "16 Mar 2027", days: 142 },
      { type: "CPR", expiry: "16 Mar 2027", days: 142 },
      { type: "Anaphylaxis", expiry: "20 Aug 2027", days: 299 },
      { type: "Asthma", expiry: "29 Dec 2027", days: 430 },
    ],
  },
  {
    id: "luca",
    name: "Luca Martin",
    initials: "LM",
    role: "Assistant educator",
    alertState: "Follow up required",
    certs: [
      { type: "WWCC", expiry: "09 Jan 2028", days: 441 },
      { type: "First Aid", expiry: "09 Sep 2026", days: -46 },
      { type: "CPR", expiry: "22 Jun 2027", days: 240 },
      { type: "Anaphylaxis", expiry: "21 Apr 2027", days: 178 },
      { type: "Asthma", expiry: "25 Oct 2027", days: 365 },
    ],
  },
  {
    id: "ella",
    name: "Ella Brooks",
    initials: "EB",
    role: "Educator",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "01 Jul 2028", days: 615 },
      { type: "First Aid", expiry: "14 May 2027", days: 201 },
      { type: "CPR", expiry: "14 May 2027", days: 201 },
      { type: "Anaphylaxis", expiry: "06 Feb 2027", days: 104 },
      { type: "Asthma", expiry: "09 Nov 2027", days: 380 },
    ],
  },
  {
    id: "oliver",
    name: "Oliver King",
    initials: "OK",
    role: "Educator",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "16 Sep 2027", days: 326 },
      { type: "First Aid", expiry: "23 May 2027", days: 210 },
      { type: "CPR", expiry: "23 May 2027", days: 210 },
      { type: "Anaphylaxis", expiry: "02 Jun 2027", days: 220 },
      { type: "Asthma", expiry: "21 Aug 2027", days: 300 },
    ],
  },
  {
    id: "zara",
    name: "Zara Ali",
    initials: "ZA",
    role: "Educator",
    alertState: "",
    certs: [
      { type: "WWCC", expiry: "12 Apr 2028", days: 534 },
      { type: "First Aid", expiry: "21 Aug 2027", days: 300 },
      { type: "CPR", expiry: "21 Aug 2027", days: 300 },
      { type: "Anaphylaxis", expiry: "01 Aug 2027", days: 280 },
      { type: "Asthma", expiry: "25 Feb 2028", days: 488 },
    ],
  },
  {
    id: "leo",
    name: "Leo Thompson",
    initials: "LT",
    role: "Assistant educator",
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
// Educators who have left: kept on file for 3 years after their last day (Reg 183(2)(f)). Filled by staffrec.js or live.js.
let formerEducators = [];
let familyMedical = saved.familyMedical || {
  childName: "Maya Patel",
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
let current = "overview";
let activeFilter = "All areas";
let query = "";
let toastTimer;
// ---- Live mode (Supabase). The offline demo keeps everything in this browser. ----
let LIVE = false; // true when signed in to Supabase
let ME = null; // { id, email, role, full_name, centre }
let CENTRE_NAME = "Beehive Early Learning";
let OWNER_NAME = "Sara Williams";
let PARENT_NAME = "Priya Patel";
let ownerThread = null; // { childId, childName } the owner is replying to
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
    return JSON.parse(localStorage.getItem("beehive-audit-flow-v4") || "{}");
  } catch (e) {
    return {};
  }
}
function persist() {
  if (LIVE) return;
  localStorage.setItem(
    "beehive-audit-flow-v4",
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
// A signed-in parent account. There is no family view to switch to: the owner sees one centre view,
// with Medical and Messages in the dock (offline demo), and a parent account sees their child's pages.
function isFamily() {
  return !!(LIVE && ME && ME.role === "parent");
}
function setNav() {
  let parent = isFamily(),
    navCurrent =
      current === "staff-upload"
        ? "staff"
        : current === "audit" || current === "legal"
        ? "legal"
        : current === "compliance"
        ? "centre"
        : current === "family-form"
          ? "family-medical"
          : current;
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
  document.getElementById("topAvatar").textContent = initials(parent ? PARENT_NAME : OWNER_NAME);
  document.getElementById("workspaceProfile").innerHTML = parent
    ? '<span class="avatar">' + initials(PARENT_NAME) + '</span><span><b>' + esc(PARENT_NAME) + '</b><small>' + CF() + '’s parent</small></span><button aria-label="Profile menu" onclick="openProfileMenu()">···</button>'
    : '<span class="avatar">' + initials(OWNER_NAME) + '</span><span><b>' + esc(OWNER_NAME) + '</b><small>' + (ME && ME.role === "director" ? "Centre director" : "Centre owner") + '</small></span><button aria-label="Profile menu" onclick="openProfileMenu()">···</button>';
  if (isEducator()) document.querySelector("#workspaceProfile small").textContent = "Educator";
  document.querySelectorAll(".centreName").forEach((e) => (e.textContent = CENTRE_NAME));
  let crumb = {
    overview: "Overview",
    legal: "Legal",
    compliance: "Centre",
    roster: "Roster",
    staff: "Staff",
    "staff-upload": isEducator() ? "My certificates" : "Upload a certificate",
    audit: "Legal",
    family: "Home",
    "family-medical": "Medical profile",
    "family-form": "Update medical details",
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
    let due = typeof Centre !== "undefined" ? Centre.children().filter((k) => k.missing.length).length : 0;
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
        ? '<div class="modalMeta"><span>Staff join code</span><b>' + esc(ME.centre.staff_code) + '</b></div><div class="modalMeta"><span>Family join code</span><b>' + esc(ME.centre.family_code) + '</b></div><div class="modalActions"><button class="button primary" onclick="Live.signOut()">Sign out</button></div>'
        : '<div class="modalActions"><button class="button primary" onclick="Live.signOut()">Sign out</button></div>')
    : '<p class="modalSection">Not signed in. Changes stay in this browser.</p><div class="modalActions"><button class="button primary" onclick="Live.showLogin()">Sign in to beehive</button></div>';
  openModal('<div class="modalHead"><div><h2>' + esc(who) + "</h2><p>" + CN() + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' + rows);
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
    d.push({ kind: "Approve medical update", who: medicalSubmission.childName, detail: "From " + (medicalSubmission.signer || "parent"), act: "reviewFamilyUpdate()", btn: "Review", urgent: true });
  if (!agentOn()) certRows().filter((x) => x.c.days < 0).forEach((x) =>
    d.push({ kind: "Expired credential", who: x.e.name, detail: x.c.type + " expired " + x.c.expiry + ". Decide on rostering.", act: "openStaffDetail('" + x.e.id + "')", btn: "Open", urgent: true }));
  let regPending = LIVE ? regUpdate && regUpdate.status !== "reviewed" : !saved.updateReviewed;
  if (regPending && !(auditOn() && approved))
    d.push({ kind: (LIVE ? regUpdate.status === "accepted" : saved.updateAccepted) ? "Finish policy review" : "Review regulation change", who: regUpdate ? regUpdate.title : "Safe sleep guidance review", detail: "May affect your Sleep and rest policy", act: "Legal.reviewUpdates()", btn: "Review" });
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
  else if (d.title) { who = d.title; act = "Legal.reviewUpdates()"; }
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
    familyHeading(greeting() + ", " + esc(firstName(PARENT_NAME)), CF() + "’s care information from " + CN() + ".", '<button class="button primary" onclick="go(\'family-form\')">Update medical details</button>') +
    (pending ? '<div class="callout quiet"><span class="hx lg"></span><div><b>Your update has been received</b><p>The centre is reviewing it. You’ll get a message when it’s done.</p></div></div>' : "") +
    '<div class="childLine"><span class="avatar">' + initials(familyMedical.childName) + '</span><div><b>' + esc(familyMedical.childName) + '</b></div><span style="margin-left:auto">' + familyStatus() + "</span></div>" +
    '<button class="row" onclick="go(\'family-medical\')"><span class="rowMain"><b>Medical profile</b><small>' + esc(familyMedical.allergies || "No allergies listed") + ", " + esc(familyMedical.conditions || "no conditions listed") + '</small></span><span class="chev">' + ico("chevron") + "</span></button>" +
    '<button class="row" onclick="go(\'family-form\')"><span class="rowMain"><b>Update medical details</b><small>Tell the centre about a new allergy, medication or action plan</small></span><span class="chev">' + ico("chevron") + "</span></button>" +
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
  // Medical alerts (allergies, conditions, medication or action plans) are the loudest thing on the page.
  let v = String(value || "").trim(), real = v && !/^(none|nil|no|n\/a|not provided)\b/i.test(v);
  let cls = real && /allerg|condition/i.test(label) ? " alert" + (/anaphyla|epipen|adrenaline/i.test(v) ? " critical" : "") : real && /medication/i.test(label) ? " plan" : "";
  return '<div class="familyData' + cls + '"><small>' + label + "</small><b>" + esc(value || "Not provided") + "</b></div>";
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
    '<aside><h3 style="margin-bottom:12px">What happens next</h3><ol class="steps"><li><b>You submit</b>You get a receipt straight away.</li><li><b>The centre reviews</b>It checks the details against your plan.</li><li><b>Educators are updated</b>Once approved, educators see the new details.</li></ol></aside></div>'
  );
}
function aiDraftsCard() {
  if (!aiDrafts.length) return '<p class="empty">No drafts waiting.</p>';
  return (
    aiDrafts
      .map((d) => '<div class="agentItem"><small>To ' + esc(d.childName) + "’s family, " + esc(d.trigger) + '</small><textarea id="draft-' + d.id + '" rows="3" aria-label="Draft message">' + esc(d.body) + '</textarea><div class="draftActions"><button class="button small" onclick="Live.discardDraft(\'' + d.id + '\')">Discard</button><button class="button primary small" onclick="Live.approveDraft(\'' + d.id + '\')">Approve & send</button></div></div>')
      .join("")
  );
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
    '<div class="modalHead"><div><h2>' + esc(medicalSubmission.childName) + "’s medical update</h2><p>Submitted " + esc(medicalSubmission.submittedAt) + " by " + esc(medicalSubmission.signer) +
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
      '<p class="footnote">' + (LIVE ? "Acknowledging locks this record, updates the child’s medical record and tells the family. beehive doesn’t give medical advice." : "Check the details with your usual process. The offline demo doesn’t store attachments.") +
      '</p><div class="modalActions"><button class="button" onclick="closeModal()">Close</button><button class="button primary" onclick="acknowledgeFamilyUpdate()">Acknowledge update</button></div>',
  );
}

// ---------- staff certifications ----------
function certificateCell(c, label) {
  let s = certStatus(c);
  return (
    '<td data-label="' + (label || c.type) + '"><div class="certCell"><span class="certState ' + PRIO_CLASS[certPrio(c)] + '" title="' + certPrioLabel(c) + '">' + (certPrio(c) === "critical" ? (c.missing ? "Missing" : "Expired") : certPrioLabel(c)) + '</span><small class="num">' + esc(c.expiry) +
    (c.days >= 0 && c.days <= 60 ? ' <span class="days">' + c.days + " days</span>" : "") + "</small>" +
    (c.approvedAt ? '<small class="days">Verified ' + esc(c.approvedAt) + "</small>" : "") + "</div></td>"
  );
}
function staffRows() {
  return (
    filteredEducators()
      .map((e) =>
        '<tr onclick="staffDetail(\'' + e.id + '\')"><td><div class="staffPerson"><b>' + esc(e.name) + "</b><small>" + esc(e.role) + "</small></div></td>" +
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
      header("Staff", "Every educator’s credentials. beehive chases renewals for you.", '<button class="button" onclick="go(\'staff-upload\')"><span data-icon="upload"></span>Upload a certificate</button><button class="button primary" onclick="StaffRecords.openAdd()">Add educator</button>') +
      // One view: the educators table on the left, follow-ups and former educators beside it.
      '<div class="splitView"><div class="splitMain">' +
      '<section class="section"><div class="sectionHead"><h2>All educators<span class="count">' + educators.length + "</span></h2>" +
      '<input id="staffSearch" class="staffSearch" type="search" placeholder="Search educators or credentials" aria-label="Search staff" oninput="searchStaff(this.value)"></div>' +
      '<div class="tableWrap"><table class="staffTable"><thead><tr><th>Educator</th><th>WWCC</th><th>First Aid</th><th>CPR</th><th>Anaphylaxis</th><th>Asthma</th><th>Follow-up</th></tr></thead><tbody id="staffRows">' +
      staffRows() + "</tbody></table></div></section>" +
      '</div><aside class="splitSide">' + followUpsCard() +
      (typeof StaffRecords !== "undefined" ? StaffRecords.formerSection() : "") + "</aside></div>" +
      '<p class="footnote">' + (LIVE ? "" : "Offline demo: sample educators. ") + "Email and SMS are simulated: messages are recorded with recipient and time but not delivered.</p>"
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
// The AI follow-ups on the Staff page: what beehive sends on its own, the latest messages, and what needs the owner.
function followUpsCard() {
  let d = StaffAgent.data(), msgs = (d.messages || []).slice(0, 4);
  let nameOf = (id) => { let e = educators.find((x) => x.id === id); return e ? e.name : "Educator"; };
  let waiting = (d.tasks || []).filter((t) => t.state === "waiting").length;
  let decide = (StaffAgent.decisions ? StaffAgent.decisions() : []).length;
  return (
    '<section class="followUps"><div class="followHead"><span class="aiMark" data-icon="spark"></span><div><h2>Automated follow-ups</h2>' +
      "<p>beehive emails each educator a secure upload link 60, 30 and 7 days before a credential expires, follows up until it’s renewed, and only brings you the decisions.</p></div>" +
      '<button class="button small" onclick="StaffAgent.runNow()"><span data-icon="refresh"></span>Send follow-ups now</button></div>' +
    '<div class="followStats"><span><b class="num">' + waiting + "</b> waiting on educators</span>" +
      (decide ? '<button class="textButton" onclick="StaffAgent.nextDecision()">' + decide + " need" + (decide === 1 ? "s" : "") + " your decision</button>" : "<span>Nothing needs you</span>") + "</div>" +
    (msgs.length ? '<div class="followList">' + msgs.map((m) =>
      '<button class="followMsg" onclick="showFollowUp(\'' + esc(m.id) + '\')"><b>' + esc(nameOf(m.staffId)) + "</b><small>" + esc(m.subject || (m.kind === "follow_up" ? "Follow-up" : "Renewal request")) + "</small><small>" + (m.channel === "sms" ? "SMS" : "Email") + " · " + esc(relTime(m.at)) + "</small></button>").join("") + "</div>" : "") +
    "</section>"
  );
}
function showFollowUp(id) {
  let m = (StaffAgent.data().messages || []).find((x) => String(x.id) === String(id));
  if (!m) return;
  openModal('<div class="modalHead"><div><h2>' + esc(m.subject || "Message") + "</h2><p>To " + esc(m.recipient || "educator") + " · " + (m.channel === "sms" ? "SMS" : "Email") + " · " + esc(relTime(m.at)) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
    '<div class="modalSection"><p style="white-space:pre-wrap">' + esc(m.body || "") + "</p></div>" +
    '<p class="footnote">Simulated: recorded in beehive, not actually delivered.' + (m.nextFollowUp ? " Next follow-up " + esc(m.nextFollowUp) + "." : "") + "</p>");
}
function staffUploadPage() {
  let options = educators.map((e) => '<option value="' + e.id + '" ' + (e.id === defaultUploadStaff() ? "selected" : "") + ">" + esc(e.name) + "</option>").join("");
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
    '<div class="modalHead"><div><h2>' + esc(e.name) + "</h2><p>" + esc(e.role) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<p class="modalSection">' + statusTag(staffStatus(e), staffStatus(e) === "green" ? "All credentials current" : staffStatus(e) === "yellow" ? "Renewal coming up" : "Expired or missing credential") + (agentOn() ? "" : '<span class="muted" style="margin-left:12px">' + esc(e.alertState || "No reminder sent") + "</span>") + "</p>" +
      rows + pending +
      (typeof StaffRecords !== "undefined" ? StaffRecords.detailExtras(e) : "") +
      '<div class="modalActions"><button class="button" onclick="closeModal()">Close</button></div>',
    "wide",
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
  let flow = (title, lede, steps) => '<section class="guideFlow"><h3>' + title + "</h3><p>" + lede + '</p><ol class="guideSteps2">' + steps.join("") + "</ol></section>";
  openModal(
    '<div class="modalHead"><div><h2>Your hive guide</h2><p>What each part of beehive does for you, and when it needs you.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      flow("Staff", "Every educator’s WWCC, first aid, CPR, anaphylaxis and asthma, with their documents on file.", [
        step("auto", "Credentials watched", "Every credential, every day. Critical: expired or missing. High: 7 days. Medium: 30 days. Monitor: within 60 days."),
        step("auto", "Renewals chased", "Each educator gets a request with a secure upload link (simulated email or SMS), then follow-ups. Anything ignored or critical comes to you."),
        step("you", "Uploads verified", "beehive reads the certificate and flags anything that doesn’t match. Nothing counts until you approve it."),
        step("you", "Educators added or leaving", "Add educator for someone new. When someone leaves, their file moves to Former educators (the button beside the list) and is kept for 3 years (Reg 183)."),
      ]) +
      flow("Legal", "Spot checks, your ACECQA requirements and new regulations, on one page.", [
        step("auto", "Spot checks", "What an officer can ask to see on an unannounced visit, checked against today’s roster and records: ratios, diplomas, an early childhood teacher, first aid cover, WWCCs and medical plans."),
        step("auto", "ACECQA requirements", "20 requirements across staff records, children’s records, safety and premises, and policies (including medication, excursions, food, child protection, digital technology, the program, the QIP and notifications). Gaps are prioritised with the next step."),
        step("auto", "New regulation flagged", "A new regulation stays at the top of Legal until you review it. Review opens a side panel: what changed, the requirements it touches and how to comply."),
        step("you", "Decision recorded", "For each requirement: no change needed, policy needs updating, or doesn’t apply. Then the change joins your requirement list under Regulation changes."),
      ]) +
      flow("Centre", "Your children’s records, agreements and documents.", [
        step("you", "Add a child", "Add a child records the full enrolment: parents, emergency contact, nominees, health, immunisation and consents (Regs 160–162). beehive tells you what’s still missing."),
        step("auto", "Documents drafted", "In a child’s record, Create a document with AI drafts an agreement, consent, medical plan or welcome letter from instructions you can edit."),
        step("you", "Checked and saved", "Edit the draft, then save it to the child’s file or download it as a PDF. Nothing is sent to the family."),
      ]) +
      flow("Roster", "One week at a time. Each week starts empty.", [
        step("auto", "Fill gaps with AI", "Fills only the week on screen: first aid cover, the 50% diploma rule and ratios, keeping every shift you set and mixing who works each week. Educators with lapsed credentials are left off."),
        step("you", "Availability", "Click an educator’s Available button, or Availability for everyone, to change the days they can work. You can also send them a link to update it themselves."),
      ]) +
      '<div class="guideKey"><span><i class="hx" style="color:var(--honey)"></i>beehive does this</span><span><i class="hx" style="color:var(--ink)"></i>You decide</span></div>' +
      '<div class="modalActions"><button class="button" onclick="closeModal();go(\'staff\')">Staff</button><button class="button" onclick="closeModal();go(\'roster\')">Roster</button><button class="button primary" onclick="closeModal();go(\'legal\')">Legal</button></div>',
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
      ? Canvas.page()
      : current === "roster"
      ? rosterPage()
      : (current === "legal" || current === "audit") && approved
      ? Legal.page()
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
                  : auditPage();
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
  if (typeof closeCommand === "function") closeCommand();
  openItem(id);
}
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeModal();
    document.getElementById("searchResults").classList.add("hidden");
    if (typeof closeCommand === "function") closeCommand();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (typeof openCommand === "function") openCommand();
    else document.getElementById("globalSearch").focus();
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
// Legal: spot checks, ACECQA requirements and new regulations on one page (legal.js).

// ---------------------------------------------------------------------------------------------
// Roster: weekly roster with an AI builder (roster.js).
function rosterGaps() { return []; }
function rosterPage() { return Roster.page(); }
