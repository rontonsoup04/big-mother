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
    return JSON.parse(localStorage.getItem("beehive-audit-flow-v2") || "{}");
  } catch (e) {
    return {};
  }
}
function persist() {
  if (LIVE) return;
  localStorage.setItem(
    "beehive-audit-flow-v2",
    JSON.stringify({
      items: items,
      approved: approved,
      updateAccepted: !!saved.updateAccepted,
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
    (n, x) => n + (x.status === "green" ? 1 : x.status === "yellow" ? 0.8 : 0),
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
  document.getElementById("perspectiveButton").innerHTML = parent
    ? "Owner view <span>→</span>"
    : "Family view <span>→</span>";
  document.getElementById("topAvatar").textContent = initials(parent ? PARENT_NAME : OWNER_NAME);
  document.getElementById("workspaceProfile").innerHTML = parent
    ? '<span class="avatar">' + initials(PARENT_NAME) + '</span><span><b>' + esc(PARENT_NAME) + '</b><small>' + CF() + '’s parent</small></span><button aria-label="Profile menu" onclick="openProfileMenu()">···</button>'
    : '<span class="avatar">' + initials(OWNER_NAME) + '</span><span><b>' + esc(OWNER_NAME) + '</b><small>' + (ME && ME.role === "director" ? "Centre director" : "Centre owner") + '</small></span><button aria-label="Profile menu" onclick="openProfileMenu()">···</button>';
  if (isEducator()) document.querySelector("#workspaceProfile small").textContent = "Educator";
  document.querySelectorAll(".centreName").forEach((e) => (e.textContent = CENTRE_NAME));
  let dm = document.getElementById("dataModeLabel");
  if (dm) dm.textContent = LIVE ? "Live · " + CENTRE_NAME : "Offline demo · sample records";
  let pb = document.getElementById("perspectiveButton");
  if (pb) pb.style.display = LIVE ? "none" : "";
  let crumb = {
    overview: "Overview",
    updates: "Regulation updates",
    compliance: "Compliance",
    staff: "Staff certifications",
    "staff-upload": "Staff certificate upload",
    audit: "Audit readiness",
    family: "Family home",
    "family-medical": "Medical profile",
    "family-form": "Update medical details",
    "family-messages": "Messages",
  };
  document.getElementById("pageCrumb").textContent =
    crumb[current] || "Audit readiness";
  document.getElementById("gapBadge").textContent =
    countStatus("red") + countStatus("yellow");
  let cb = document.getElementById("complianceBadge");
  if (cb && typeof Library !== "undefined") {
    let due = Library.taskList().filter((t) => t.state === "overdue" || t.state === "due_soon").length;
    cb.textContent = due || "";
    cb.style.display = due ? "" : "none";
  }
  let c = document.getElementById("certAlertBadge");
  if (c) c.textContent = certDueCount() + (pendingSubmission ? 1 : 0);
  let n = document.getElementById("notificationBadge");
  if (n)
    n.textContent =
      (pendingSubmission ? 1 : 0) +
      (medicalSubmission && medicalSubmission.status === "pending" ? 1 : 0) +
      certDueCount();
  let fm = document.getElementById("familyMedicalBadge");
  if (fm)
    fm.textContent =
      medicalSubmission && medicalSubmission.status === "pending" ? "1" : "";
}
function openProfileMenu() {
  let who = isFamily() ? PARENT_NAME : OWNER_NAME;
  let leader = LIVE && (ME.role === "owner" || ME.role === "director");
  let rows = LIVE
    ? '<div class="modalMeta"><span>Signed in as</span><b>' + esc(ME.email) + '</b></div><div class="modalMeta"><span>Role</span><b style="text-transform:capitalize">' + esc(ME.role) + "</b></div>" +
      (leader
        ? '<div class="modalMeta"><span>Staff join code</span><b>' + esc(ME.centre.staff_code) + '</b></div><div class="modalMeta"><span>Family join code</span><b>' + esc(ME.centre.family_code) + '</b></div><div class="modalActions"><button class="button" onclick="Assistant.openConnect()">✦ Connect AI agent</button><button class="button primary" onclick="Live.signOut()">Sign out</button></div>'
        : '<div class="modalActions"><button class="button primary" onclick="Live.signOut()">Sign out</button></div>')
    : '<p class="helpLine">You are exploring the offline demo. Changes stay in this browser.</p><div class="modalActions"><button class="button" onclick="Live.resetOffline()">Reset demo data</button><button class="button primary" onclick="Live.showLogin()">Sign in to Beehive</button></div>';
  openModal('<div class="modalHead"><div><div class="eyebrow">ACCOUNT</div><h2>' + esc(who) + "</h2><p>" + CN() + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' + rows);
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
function header(title, desc, actions) {
  return (
    '<div class="pageHeading"><div><div class="eyebrow">BEEHIVE · ' + (isEducator() ? "MY WORKSPACE" : "OWNER WORKSPACE") + '</div><h1>' +
    title +
    "</h1><p>" +
    desc +
    '</p></div><div class="buttonRow">' +
    (actions || "") +
    "</div></div>"
  );
}
function groupRows(area, setup) {
  let list = items.filter((x) => x.area === area);
  if (!list.length) return "";
  return (
    '<section class="groupCard card"><div class="groupHeader"><div class="groupName"><span class="groupIcon">' +
    ICONS[area] +
    "</span><span><b>" +
    area +
    "</b><small>" +
    list.length +
    ' checklist items</small></span></div><span class="groupCount">' +
    (setup ? "AI-SUGGESTED" : "") +
    "</span></div>" +
    list
      .map(
        (x) =>
          '<div class="checkRow">' +
          (setup
            ? '<input class="includeSwitch" type="checkbox" aria-label="Include ' +
              esc(x.title) +
              '" checked onchange="toggleApplicable(\'' +
              x.id +
              "',this.checked)\">"
            : '<span class="statusDot ' + x.status + '"></span>') +
          '<div class="checkText"><button onclick="openItem(\'' +
          x.id +
          "')\">" +
          esc(x.title) +
          "</button><small>" +
          esc(x.source) +
          " · " +
          esc(x.evidence) +
          '</small></div><span class="status ' +
          x.status +
          '">' +
          statusLabel(x.status) +
          '</span><button class="sourceLink" onclick="openItem(\'' +
          x.id +
          "')\">View source ↗</button></div>",
      )
      .join("") +
    "</section>"
  );
}
function setupPage() {
  let actions =
    '<button class="button soft" onclick="selectAll(false)">Clear selections</button><button class="button" onclick="selectAll(true)">Select all</button>';
  return (
    header(
      "Build your centre checklist",
      "Review the AI-suggested baseline, remove anything that does not apply, then approve it for your centre.",
      '<button class="button" onclick="openSourceInfo()">Source guide</button>',
    ) +
    '<div class="setupHero"><div class="setupHeroContent"><div class="eyebrow">✦ AI-ASSISTED BASELINE · READY FOR YOUR REVIEW</div><h2>A clearer starting point for audit readiness.</h2><p>Beehive has grouped suggested requirements from the National Regulations and NQS into practical evidence checks. Review each item, confirm its source, and tailor this checklist to your centre before approval.</p><div class="setupMeta"><span class="sparkleBadge">✦ 12 suggested items</span><span>4 checklist areas</span><span>Owner approval required</span></div></div></div><div class="notice"><span class="spark">ⓘ</span><span>These are prototype summaries, not legal advice. Check the linked official source and adapt each item to your service and jurisdiction before approval.</span></div><div class="setupToolbar"><div><div class="sectionTitle">Suggested checklist</div><div class="muted" style="margin-top:4px">Switch off any item that does not apply to your centre.</div></div><div class="buttonRow">' +
    actions +
    '</div></div><div class="checkGroups">' +
    AREAS.map((a) => groupRows(a, true)).join("") +
    '</div><div class="setupFooter"><p><b id="selectedCount">12</b> checklist items selected · You can edit this baseline later</p><button class="button primary" onclick="approveChecklist()">Approve checklist <span>→</span></button></div>'
  );
}
function miniCard(number, label, caption) {
  return (
    '<div class="summaryTile"><span>' +
    label +
    "</span><b>" +
    number +
    "</b><small>" +
    caption +
    "</small></div>"
  );
}
function topGaps() {
  let gaps = items
    .filter((x) => x.status !== "green")
    .sort((a, b) => (a.status === "red" ? 0 : 1) - (b.status === "red" ? 0 : 1))
    .slice(0, 4);
  return (
    '<aside class="card topGaps"><div class="cardHead"><h3>Top gaps to close</h3><span class="status red">' +
    gaps.length +
    " to review</span></div>" +
    gaps
      .map(
        (x) =>
          '<div class="gapItem ' +
          x.status +
          '"><span class="gapIcon">' +
          (x.status === "red" ? "!" : "↻") +
          "</span><div><b>" +
          esc(x.title) +
          "</b><small>" +
          esc(x.risk) +
          "</small></div><button onclick=\"openItem('" +
          x.id +
          "')\">Open →</button></div>",
      )
      .join("") +
    '<p class="readinessFoot">Items marked red need evidence. Yellow items have evidence on file but are due for review.</p></aside>'
  );
}
function overviewPage() {
  let actions =
    '<button class="button" onclick="go(\'audit\')">Open checklist</button><button class="button primary" onclick="exportReport()">⇩ Export audit report</button>';
  return (
    header(
      greeting() + ", " + esc(firstName(OWNER_NAME)),
      "Your centre’s evidence and review priorities, all in one place.",
      actions,
    ) +
    '<div class="scoreHero card"><div class="scoreHeroText"><div class="eyebrow">WEEKLY READINESS CHECK</div><h2>' +
    readiness() +
    "% Audit-Ready</h2><p>" +
    countStatus("green") +
    " evidence items are current. " +
    (countStatus("red") + countStatus("yellow")) +
    ' items need attention before an assessment visit.</p><div class="buttonRow" style="margin-top:13px"><button class="button soft small" onclick="go(\'audit\')">Review top gaps →</button></div></div><div class="scoreCircle"><span>' +
    readiness() +
    '%</span></div></div><div class="scoreLayout"><div><div class="scoreMini">' +
    miniCard(countStatus("green"), "Evidence on file", "current") +
    miniCard(countStatus("yellow"), "Review due", "evidence exists") +
    miniCard(countStatus("red"), "Evidence missing", "needs action") +
    '</div><div class="card" style="padding:15px"><div class="cardHead"><h3>Checklist by area</h3><button class="button small" onclick="go(\'audit\')">View all →</button></div>' +
    AREAS.map((a) => {
      let list = items.filter((x) => x.area === a),
        done = list.filter((x) => x.status === "green").length;
      return (
        '<div class="areaProgress"><div><b>' +
        a +
        "</b><small>" +
        done +
        " of " +
        list.length +
        ' current</small></div><div class="progressTrack"><i style="width:' +
        Math.round((done / list.length) * 100) +
        '%"></i></div></div>'
      );
    }).join("") +
    "</div></div>" +
    topGaps() +
    "</div>" +
    medicalOwnerCard() +
    aiDraftsCard() +
    familyInboxCard() +
    (LIVE && (!regUpdate || regUpdate.status === "reviewed") ? "" : '<div class="guidanceBanner"><div><span class="sparkleBadge">✦ GUIDANCE UPDATE</span><h3>' + esc(regUpdate ? regUpdate.title : "Safe sleep guidance") + ' may affect your policy</h3><p>Review the update and confirm whether the affected policy needs changes.</p></div><button class="button soft" onclick="go(\'updates\')">Review update →</button></div>')
  );
}
function auditPage() {
  if (!approved) return setupPage();
  let filterButtons = ["All areas"]
    .concat(AREAS)
    .map(
      (a) =>
        '<button class="filterButton ' +
        (activeFilter === a ? "active" : "") +
        '" onclick="filterArea(\'' +
        a +
        "')\">" +
        a +
        "</button>",
    )
    .join("");
  let list = activeFilter === "All areas" ? AREAS : [activeFilter];
  return (
    header(
      "Audit-readiness checklist",
      "Check the latest evidence, close gaps and prepare to show records in seconds.",
      '<button class="button" onclick="editBaseline()">Edit baseline</button><button class="button primary" onclick="exportReport()">⇩ Export audit report</button>',
    ) +
    '<div class="notice"><span class="spark">●</span><span>Checklist baseline approved · Last checked ' +
    new Date().toLocaleString() +
    '' + (LIVE ? " · Saved to your centre’s records in Beehive." : " · Evidence changes are saved in this browser demo.") + '</span></div><div class="scoreLayout"><div><div class="scoreHero card"><div class="scoreHeroText"><div class="eyebrow">CENTRE READINESS</div><h2>' +
    readiness() +
    "% Audit-Ready</h2><p>" +
    countStatus("green") +
    " of " +
    items.length +
    ' checklist items have current evidence. Select any item to inspect its source and close a gap.</p></div><div class="scoreCircle"><span>' +
    readiness() +
    '%</span></div></div><div class="scoreMini">' +
    miniCard(countStatus("green"), "Ready", "evidence current") +
    miniCard(countStatus("yellow"), "Review due", "check date") +
    miniCard(countStatus("red"), "Missing", "upload or log") +
    '</div><div class="areaFilters">' +
    filterButtons +
    '</div><div class="checkGroups">' +
    list.map((a) => groupRows(a, false)).join("") +
    "</div></div>" +
    topGaps() +
    "</div>"
  );
}
function updatesPage() {
  let accepted = !!saved.updateAccepted;
  if (LIVE && !regUpdate)
    return (
      header("Regulation & guidance updates", "Review changes that could affect your centre’s approved checklist.", '<button class="button" onclick="go(\'audit\')">Back to checklist</button>') +
      '<section class="card regCard"><h2>No new updates</h2><p>When a regulation or guidance change is published, it will appear here for review.</p></section>'
    );
  let reviewed = LIVE && regUpdate.status === "reviewed";
  let sleepId = (findItemByKey("sleep") || {}).id || "sleep";
  return (
    header(
      "Regulation & guidance updates",
      "Review changes that could affect your centre’s approved checklist.",
      '<button class="button" onclick="go(\'audit\')">Back to checklist</button>',
    ) +
    '<div class="regGrid"><section class="card regCard"><div class="eyebrow">' + (reviewed ? "REVIEWED" : "NEW GUIDANCE") + " · " + esc(regUpdate ? regUpdate.published : "18 OCT 2026") + '</div><h2>' + esc(regUpdate ? regUpdate.title : "Safe sleep guidance review") + '</h2><p>' + esc(regUpdate ? regUpdate.summary : "New safe sleep guidance may affect the centre’s Sleep and Rest Policy.") + ' Beehive has flagged the related checklist item for owner review.</p><div class="regItem"><div><b>What changed</b><small>Review current sleep and rest procedures against the latest official guidance and your service’s approved policy.</small></div><span class="status ' +
    (accepted ? "yellow" : "neutral") +
    '">' +
    (accepted ? "Review required" : "New update") +
    '</span></div><div class="regItem"><div><b>Affected checklist item</b><small>Sleep and rest policy review · Policies & Procedures</small></div><button class="button small" onclick="openItem(\'' + sleepId + '\')">Open item</button></div><div class="regItem"><div><b>Official source</b><small>ACECQA guidance and National Regulations. Confirm current guidance for your jurisdiction.</small></div><a class="sourceLink" href="https://www.acecqa.gov.au/nqf/national-law-regulations/national-regulations" target="_blank" rel="noopener">Open ACECQA ↗</a></div><div class="regActions">' +
    (reviewed
      ? '<span class="status green">Review complete</span>'
      : accepted
      ? '<button class="button primary" onclick="markUpdateReviewed()">Mark review complete</button>'
      : '<button class="button primary" onclick="acceptUpdate()">Accept update & flag policy</button>') +
    '</div></section><aside class="card sourcePanel"><h3>How Beehive handles updates</h3><p>1. A guidance change is matched to an affected checklist item.</p><p>2. The owner reviews the summary and official source.</p><p>3. Accepting the update marks the item for review until the centre confirms its policy.</p><ul><li>Update summaries are suggestions.</li><li>Always verify the current official source.</li><li>Accepted changes stay visible in the checklist.</li></ul></aside></div>'
  );
}
function familyHeading(title, desc, action) {
  return (
    '<div class="pageHeading familyHeading"><div><div class="eyebrow">BEEHIVE · FAMILY PORTAL</div><h1>' +
    title +
    "</h1><p>" +
    desc +
    '</p></div><div class="buttonRow">' +
    (action || "") +
    "</div></div>"
  );
}
function familyStatus() {
  if (!medicalSubmission)
    return (
      '<span class="familyStatus current"><i></i>Details last reviewed ' +
      esc(familyMedical.reviewedAt) +
      "</span>"
    );
  return medicalSubmission.status === "pending"
    ? '<span class="familyStatus pending"><i></i>Update received · centre review pending</span>'
    : '<span class="familyStatus current"><i></i>Update reviewed by the centre</span>';
}
function familyHomePage() {
  let alert = medicalSubmission && medicalSubmission.status === "pending";
  let status = alert
    ? '<div class="familyAlert"><span class="familyAlertIcon">✚</span><div><b>Your update has been received</b><p>The centre has your changes and will review them. You can see the submitted details in your medical profile.</p></div><span class="status yellow">In review</span></div>'
    : '<div class="familyWelcome"><div><div class="eyebrow">YOUR FAMILY SPACE</div><h2>' + greeting() + ', ' + esc(firstName(PARENT_NAME)) + '</h2><p>Stay in the loop about ' + CF() + '’s care and keep their important details up to date.</p></div><span class="familyWelcomeMark">♡</span></div>';
  return (
    familyHeading(
      "Family home",
      "A private space for your child’s important care information.",
      '<button class="button" onclick="go(\'family-messages\')">✉ Message the centre</button>',
    ) +
    status +
    '<div class="familyHomeGrid"><section class="familyChildCard card"><div class="familyChildBanner"><span class="childAvatar">' + initials(familyMedical.childName) + '</span><span><small>CHILD PROFILE</small><h2>' +
    esc(familyMedical.childName) +
    "</h2><p>" +
    esc(familyMedical.room) +
    ' · ' + CN() + '</p></span><span class="childSun">✿</span></div><div class="familyChildInfo"><div><small>MEDICAL STATUS</small>' +
    familyStatus() +
    "</div><div><small>LAST CENTRE REVIEW</small><b>" +
    esc(familyMedical.reviewedAt) +
    '</b></div></div><div class="familyCardActions"><button class="button primary" onclick="go(\'family-medical\')">View medical profile →</button><button class="textButton" onclick="go(\'family-form\')">Update details</button></div></section><section class="familySideCard card"><div class="familySectionTop"><div><span class="familyIconBubble">✚</span><h3>Medical details</h3></div><span class="status ' +
    (alert ? "yellow" : "green") +
    '">' +
    (alert ? "Review pending" : "On file") +
    "</span></div><p>" +
    esc(familyMedical.allergies || "No allergies listed") +
    " · " +
    esc(familyMedical.conditions || "No conditions listed") +
    '</p><button class="textButton" onclick="go(\'family-medical\')">See what the centre has on file →</button></section><section class="familySideCard card"><div class="familySectionTop"><div><span class="familyIconBubble lavender">✉</span><h3>Centre messages</h3></div><span class="familyUnread">' +
    familyMessages.length +
    '</span></div><p>Keep questions and centre replies together in one secure-style conversation.</p><button class="textButton" onclick="go(\'family-messages\')">Open conversation →</button></section></div><div class="familyPrivacy"><span>◈</span><div><b>Only your child’s family information appears here.</b><p>' + (LIVE ? "Only your child’s centre team can see these details. Pilot version: please use sample information only." : "This prototype uses sample records stored in this browser. Do not enter real medical information.") + '</p></div></div>'
  );
}
function familyMedicalPage() {
  let values =
    medicalSubmission && medicalSubmission.status === "pending"
      ? medicalSubmission
      : familyMedical;
  return (
    familyHeading(
      CF() + "’s medical profile",
      "Review the information shared with " + CN() + ".",
      '<button class="button primary" onclick="go(\'family-form\')">＋ Update details</button>',
    ) +
    (medicalSubmission
      ? '<div class="familyReceipt ' +
        (medicalSubmission.status === "pending" ? "pending" : "reviewed") +
        '"><span class="receiptIcon">' +
        (medicalSubmission.status === "pending" ? "↗" : "●") +
        "</span><div><b>" +
        (medicalSubmission.status === "pending"
          ? "Update received"
          : "Update reviewed") +
        "</b><p>Submitted " +
        esc(medicalSubmission.submittedAt) +
        (medicalSubmission.reviewedAt
          ? " · Reviewed " + esc(medicalSubmission.reviewedAt)
          : " · Waiting for the centre to confirm") +
        '</p></div><span class="status ' +
        (medicalSubmission.status === "pending" ? "yellow" : "green") +
        '">' +
        (medicalSubmission.status === "pending" ? "In review" : "Reviewed") +
        "</span></div>"
      : "") +
    '<section class="familyProfile card"><div class="familyProfileHead"><div><div class="eyebrow">SHARED WITH YOUR CENTRE</div><h2>Health & care information</h2><p>These details help educators care for ' + CF() + '. Contact the centre if anything changes.</p></div><span class="familyProfileMark">✚</span></div><div class="familyDataGrid">' +
    familyData("Allergies", values.allergies) +
    familyData("Medical conditions", values.conditions) +
    familyData("Dietary needs", values.dietary) +
    familyData("Medication", values.medications) +
    familyData("Care notes", values.notes) +
    familyData("Emergency contact", familyMedical.emergency) +
    '</div><div class="familySignatureNote">Submitted updates are sent to the centre for review. If your child needs urgent support, contact the centre directly.</div></section><div class="familyPrivacy"><span>◈</span><div><b>Keep information current</b><p>Please submit changes as soon as a condition, allergy, medication or dietary need changes.</p></div></div>'
  );
}
function familyData(label, value) {
  return (
    '<div class="familyData"><small>' +
    label +
    "</small><b>" +
    esc(value || "Not provided") +
    "</b></div>"
  );
}
function familyFormPage() {
  let d =
    medicalSubmission && medicalSubmission.status === "pending"
      ? medicalSubmission
      : familyMedical;
  return (
    familyHeading(
      "Update medical details",
      "Tell us what has changed so " + CF() + "’s care record can be reviewed.",
      '<button class="button" onclick="go(\'family-medical\')">← Back to profile</button>',
    ) +
    '<div class="familyFormLayout"><section class="familyFormCard card"><div class="familyFormIntro"><span class="familyIconBubble">✚</span><div><h2>Medical & care update</h2><p>Fields can be left blank if they do not apply. Your update will be sent to the centre for review.</p></div></div><div class="familyFormGrid"><label class="familyField"><span>Allergies</span><textarea id="familyAllergies" rows="2" placeholder="List allergies or write None">' +
    esc(d.allergies || "") +
    '</textarea></label><label class="familyField"><span>Medical conditions</span><textarea id="familyConditions" rows="2" placeholder="Conditions educators should know about">' +
    esc(d.conditions || "") +
    '</textarea></label><label class="familyField"><span>Dietary needs</span><textarea id="familyDietary" rows="2" placeholder="Dietary requirements">' +
    esc(d.dietary || "") +
    '</textarea></label><label class="familyField"><span>Medication / action plan</span><textarea id="familyMedications" rows="2" placeholder="Medication and care instructions">' +
    esc(d.medications || "") +
    '</textarea></label><label class="familyField wide"><span>Care notes for educators</span><textarea id="familyNotes" rows="3" placeholder="Anything else the educators should know">' +
    esc(d.notes || "") +
    '</textarea></label><div class="familyField wide"><span>Attach an updated action plan (optional)</span><label class="familyFile">＋ Choose a sample file<input type="file" accept=".pdf,image/*" onchange="familyFileSelected(this)"><small id="familyFileName">' +
    (familyFile ? esc(familyFile) : "No file selected · demo only") +
    '</small></label></label><label class="familyField wide"><span>Parent / guardian name for acknowledgement</span><input id="familySigner" type="text" placeholder="Type your full name" value="' + esc(PARENT_NAME) + '"></label></div><label class="familyConsent"><input type="checkbox" id="familyConsent"><span>I confirm these details are accurate to the best of my knowledge and consent to sharing them with ' + CF() + '’s care team.</span></label><div class="familyFormFooter"><p>After you submit, you’ll receive an on-screen receipt and the centre will be asked to review the update.</p><button class="button primary" onclick="submitFamilyUpdate()">Submit medical update →</button></div></section><aside class="familyFormAside card"><span class="familyAsideMark">♡</span><h3>What happens next?</h3><div class="stepLine"><span class="stepNumber">1</span><span><b>You submit</b><small>Your update is logged with a time and acknowledgement name.</small></span></div><div class="stepLine"><span class="stepNumber">2</span><span><b>The centre is notified</b><small>A medical flag appears in the owner dashboard.</small></span></div><div class="stepLine"><span class="stepNumber">3</span><span><b>The centre reviews</b><small>You can see when the update has been reviewed.</small></span></div><p class="helpLine">' + (LIVE ? "Your update and any attached plan are stored securely for the centre to review. Pilot version: please use sample information only." : "Prototype only: file selection and submission stay in this browser demo. Do not use real child health data.") + '</p></aside></div>'
  );
}
function familyMessagesPage() {
  let content = familyMessages
    .map(
      (m) =>
        '<div class="messageBubble ' +
        (m.from === "parent" ? "fromParent" : "fromCentre") +
        '"><small>' +
        (m.from === "parent" ? "You" : CN()) +
        " · " +
        esc(m.time) +
        "</small><p>" +
        esc(m.text) +
        "</p></div>",
    )
    .join("");
  return (
    familyHeading(
      "Messages",
      "A private conversation with " + CF() + "’s centre.",
      '<button class="button" onclick="go(\'family\')">Family home</button>',
    ) +
    '<section class="familyThread card"><div class="familyThreadHead"><span class="familyIconBubble lavender">✉</span><div><b>' + CN() + '</b><small>About ' + esc(familyMedical.childName) + ' · ' + esc(familyMedical.room) + '</small></div><span class="threadOnline"><i></i> Centre team</span></div><div class="familyThreadBody" id="familyThreadBody">' +
    content +
    '</div><div class="familyComposer"><textarea id="familyMessageInput" rows="2" placeholder="Write a message to the centre…" aria-label="Write a message to the centre"></textarea><button class="button primary" onclick="sendFamilyMessage()">Send →</button></div><p class="helpLine">' + (LIVE ? "Messages are saved to your child’s record at the centre. For anything urgent, call the centre." : "Messages are sample data in this browser prototype. Do not send urgent medical information here.") + '</p></section>'
  );
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
function medicalOwnerCard() {
  if (!medicalSubmission || medicalSubmission.status !== "pending") return "";
  return (
    '<section class="medicalOwnerCard"><div class="medicalFlagIcon">✚</div><div class="medicalOwnerText"><span class="eyebrow">PARENT MEDICAL UPDATE · NEEDS REVIEW</span><h3>' +
    esc(medicalSubmission.childName) +
    " submitted a medical update</h3><p>" +
    esc(medicalSubmission.room) +
    " · Submitted " +
    esc(medicalSubmission.submittedAt) +
    " · Parent acknowledgement: " +
    esc(medicalSubmission.signer) +
    '</p></div><button class="button primary" onclick="reviewFamilyUpdate()">Review update →</button></section>'
  );
}
function aiDraftsCard() {
  if (!aiDrafts.length) return "";
  return (
    '<section class="aiDraftsCard card"><div class="cardHead"><h3>✦ AI-drafted messages waiting for approval</h3><span class="status yellow">' +
    aiDrafts.length +
    " to review</span></div>" +
    aiDrafts
      .map(
        (d) =>
          '<div class="draftItem"><div class="draftBody"><small>To ' + esc(d.childName) + "’s family · " + esc(d.trigger) + '</small><textarea id="draft-' + d.id + '" rows="3" aria-label="Draft message">' + esc(d.body) + '</textarea></div><div class="draftActions"><button class="button small" onclick="Live.discardDraft(\'' + d.id + '\')">Discard</button><button class="button primary small" onclick="Live.approveDraft(\'' + d.id + '\')">Approve & send</button></div></div>',
      )
      .join("") +
    '<p class="helpLine">Drafted by the Beehive AI agent. Nothing reaches a family until a staff member approves it.</p></section>'
  );
}
function familyInboxCard() {
  let latest = familyMessages[familyMessages.length - 1];
  if (LIVE) {
    if (!ownerThread || !ownerThread.unanswered) return "";
    latest = { from: "parent", text: ownerThread.lastParentText };
  }
  if (!latest || latest.from !== "parent") return "";
  return (
    '<section class="familyInboxCard"><div class="familyInboxIcon">✉</div><div class="familyInboxText"><span class="eyebrow">FAMILY MESSAGE · NEW</span><h3>New message from ' + esc(firstName(ownerThread ? ownerThread.childName : familyMedical.childName)) + '’s family</h3><p>' +
    esc(latest.text) +
    '</p></div><button class="button primary" onclick="replyToFamilyThread()">Open & reply →</button></section>'
  );
}
function replyToFamilyThread() {
  pendingDraftId = null;
  let content = familyMessages
    .map(
      (m) =>
        '<div class="messageBubble ' +
        (m.from === "parent" ? "fromParent" : "fromCentre") +
        '"><small>' +
        (m.from === "parent" ? "Parent" : CN()) +
        " · " +
        esc(m.time) +
        "</small><p>" +
        esc(m.text) +
        "</p></div>",
    )
    .join("");
  openModal(
    '<div class="modalHead"><div><div class="eyebrow">FAMILY THREAD · ' + esc((ownerThread ? ownerThread.childName : familyMedical.childName).toUpperCase()) + '</div><h2>' + CN() + '</h2><p>Parent and centre messages in one conversation.</p></div><button class="closeButton" onclick="closeModal()">×</button></div><div class="familyThreadBody ownerThreadBody">' +
      content +
      '</div><div class="familyComposer"><textarea id="ownerReplyInput" rows="2" placeholder="Reply, or type a short note and tap Draft with AI…" aria-label="Reply to the family"></textarea><div class="composerButtons"><button class="button soft" onclick="Assistant.draftReply()">✦ Draft with AI</button><button class="button primary" onclick="sendOwnerReply()">Send reply →</button></div></div><p class="helpLine" id="draftNote">AI drafts are never sent automatically. You review and send.</p>',
  );
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
function reviewFamilyUpdate() {
  if (!medicalSubmission) return;
  openModal(
    '<div class="modalHead"><div><div class="eyebrow">FAMILY MEDICAL UPDATE · OWNER REVIEW</div><h2>' +
      esc(medicalSubmission.childName) +
      "’s update</h2><p>" +
      esc(medicalSubmission.room) +
      " · Submitted " +
      esc(medicalSubmission.submittedAt) +
      '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div><div class="modalSection"><h3>Parent acknowledgement</h3><p>' +
      esc(medicalSubmission.signer) +
      " confirmed the submitted details.</p></div>" +
      familyData("Allergies", medicalSubmission.allergies) +
      familyData("Medical conditions", medicalSubmission.conditions) +
      familyData("Dietary needs", medicalSubmission.dietary) +
      familyData("Medication / action plan", medicalSubmission.medications) +
      familyData("Care notes", medicalSubmission.notes) +
      (medicalSubmission.fileName
        ? familyData(LIVE ? "Attached plan" : "Selected attachment (demo)", medicalSubmission.fileName) +
          (medicalSubmission.fileUrl ? '<p><a class="sourceLink" href="' + esc(medicalSubmission.fileUrl) + '" target="_blank" rel="noopener">Open the attached plan ↗</a></p>' : "")
        : "") +
      '<p class="helpLine">' + (LIVE ? "Approving locks this record, updates the room’s medical details and tells the family. Beehive does not give medical advice." : "Review the information with your centre’s normal process. This prototype does not verify medical advice or securely store attachments.") + '</p><div class="modalActions"><button class="button" onclick="closeModal()">Close</button><button class="button primary" onclick="acknowledgeFamilyUpdate()">Acknowledge update</button></div>',
  );
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
function certStatus(c) {
  return c.days < 0 ? "red" : c.days <= 60 ? "yellow" : "green";
}
function certStatusLabel(s) {
  return s === "green" ? "Active" : s === "yellow" ? "Expiring" : "Expired";
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
function certificateCell(c) {
  let s = certStatus(c);
  return (
    '<td><div class="certCell"><span class="certState ' +
    s +
    '">' +
    certStatusLabel(s) +
    "</span><small>" +
    esc(c.expiry) +
    (c.days >= 0 && c.days <= 60 ? " · " + c.days + " days" : "") +
    "</small>" +
    (c.approvedAt
      ? '<small class="auditStamp">Verified ' + esc(c.approvedAt) + "</small>"
      : "") +
    "</div></td>"
  );
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
function staffRows() {
  return (
    filteredEducators()
      .map(
        (e) =>
          '<tr><td><div class="staffPerson"><span class="staffInitial">' +
          esc(e.initials) +
          "</span><span><b>" +
          esc(e.name) +
          "</b><small>" +
          esc(e.room) +
          " · " +
          esc(e.role) +
          "</small></span></div></td>" +
          e.certs.map((c) => certificateCell(c)).join("") +
          '<td><span class="alertState ' +
          (e.alertState ? "sent" : "") +
          '">' +
          (e.alertState ? esc(e.alertState) : "No prompt sent") +
          '</span></td><td><button class="button small" onclick="staffDetail(\'' +
          e.id +
          "')\">View</button></td></tr>",
      )
      .join("") ||
    '<tr><td colspan="7"><div class="emptyState">No educators match that search.</div></td></tr>'
  );
}
function staffPortalPage() {
  let due = certDueCount(),
    expired = certExpiredCount(),
    reminderTotal = educators.filter(
      (e) => e.alertState && e.alertState.toLowerCase().includes("prompt"),
    ).length;
  let action =
    '<button class="button soft" onclick="runExpiryCheck()">◷ Run expiry check</button><button class="button primary" onclick="go(\'staff-upload\')">＋ Open staff upload view</button>';
  let pending = pendingSubmission
    ? '<div class="pendingCard"><div class="pendingLeft"><span class="pendingIcon">↥</span><div><h3>1 new staff certificate submitted</h3><p>' +
      esc(pendingSubmission.staffName) +
      " submitted " +
      esc(pendingSubmission.type) +
      " · " +
      esc(pendingSubmission.fileName) +
      '</p></div></div><button class="button primary small" onclick="reviewSubmission()">Review submission →</button></div>'
    : "";
  return (
    header(
      "Central Certification Portal",
      "Track WWCC, First Aid, CPR and Anaphylaxis credentials across your educators.",
      action,
    ) +
    '<div class="staffHero"><div class="staffHeroText"><div class="eyebrow">STAFF COMPLIANCE · LIVE REGISTER</div><h2>Every educator. Every credential.</h2><p>One clear view of certificate status, upcoming expiry windows and renewal prompts. Review a staff member’s full record or launch the mobile upload preview.</p><div class="buttonRow"><span class="sparkleBadge">10 educators in centre</span><span class="muted">Alert windows · 60 / 30 / 7 days</span></div></div><div class="staffEmblem">♙</div></div><div class="staffMetrics"><div class="staffMetric"><strong>' +
    educators.length +
    '</strong><span>Educators in centre</span></div><div class="staffMetric"><strong>' +
    due +
    '</strong><span><i class="metricDot yellow"></i>Credentials due within 60 days</span></div><div class="staffMetric"><strong>' +
    expired +
    '</strong><span><i class="metricDot red"></i>Expired credentials</span></div><div class="staffMetric"><strong>' +
    reminderTotal +
    '</strong><span><i class="metricDot green"></i>Renewal prompts sent</span></div></div>' +
    pending +
    '<section class="card staffPanel"><div class="staffPanelHead"><div><h3>Educator certification register</h3><p>Green · active &nbsp; Yellow · upcoming expiry &nbsp; Red · expired</p></div><div class="staffTools"><input id="staffSearch" class="staffSearch" type="search" placeholder="Search educator or credential…" aria-label="Search staff certifications" oninput="searchStaff(this.value)"></div></div><div class="staffTableScroller"><table class="staffTable"><thead><tr><th>Educator</th><th>WWCC</th><th>First Aid</th><th>CPR</th><th>Anaphylaxis</th><th>Alert state</th><th></th></tr></thead><tbody id="staffRows">' +
    staffRows() +
    '</tbody></table></div></section><div class="infoStrip">' + (LIVE ? "Reminders are scheduled automatically for the 60, 30 and 7 day windows. Email/SMS delivery is simulated in this pilot. Certificate files are stored in your centre’s private storage." : "Prototype mode: expiry scans and SMS/email prompts are simulated. Certificate files stay in this browser demo and are not securely uploaded.") + '</div>'
  );
}
function defaultUploadStaff() {
  if (!LIVE) return "mia";
  // the educator whose next certificate expires soonest (still current)
  let best = null, bestDays = 1e9;
  educators.forEach((e) => e.certs.forEach((c) => { if (c.days >= 0 && c.days < bestDays) { bestDays = c.days; best = e.id; } }));
  return best || (educators[0] && educators[0].id);
}
function staffUploadPage() {
  let options = educators
    .map(
      (e) =>
        '<option value="' +
        e.id +
        '" ' +
        (e.id === defaultUploadStaff() ? "selected" : "") +
        ">" +
        esc(e.name) +
        " · " +
        esc(e.room) +
        "</option>",
    )
    .join("");
  let types = ["First Aid", "CPR", "WWCC", "Anaphylaxis"];
  return (
    header(
      "Staff certificate upload",
      "Mobile-friendly self-service preview for an educator renewing a credential.",
      '<button class="button ownerBack" onclick="go(\'staff\')">← Back to portal</button>',
    ) +
    '<div class="staffUploadLayout"><section class="card uploadPanel"><div class="eyebrow">SECURE UPLOAD LINK · STAFF VIEW</div><h2>Submit a renewed certificate</h2><p>' + (LIVE ? "Choose the certificate type, add a photo or PDF and check the expiry date. It goes to " + esc(ownerFirst()) + " to verify." : "Choose the staff record and certificate type, then select a photo or PDF. This prototype simulates date extraction and sends the submission to " + esc(ownerFirst()) + " for approval.") + '</p><label class="formLabel" for="uploadStaff">Staff member</label><select class="formControl" id="uploadStaff">' +
    options +
    '</select><label class="formLabel" for="uploadCertType">Certificate type</label><select class="formControl" id="uploadCertType">' +
    types.map((t) => "<option>" + t + "</option>").join("") +
    '</select><label class="fileDrop">＋ Add certificate photo or PDF<input id="certFile" type="file" accept=".pdf,image/*" onchange="uploadFileSelected(this)"><small id="uploadFileName">No file selected</small></label><div class="extractionCard"><div><b>Expiry date detected</b><small id="extractPreview">Select a file to simulate certificate reading.</small></div><span class="status yellow">Needs review</span></div><label class="formLabel" for="uploadExpiry">Expiry date on the certificate (check before submitting)</label><input class="formControl" type="date" id="uploadExpiry"><div class="modalActions"><button class="button primary" onclick="submitCertificate()">Submit for owner approval →</button></div><p class="helpLine" style="margin-top:12px">' + (LIVE ? "The file goes to the centre’s private storage. The suggested expiry is a starting point: check it against the certificate." : "In a production version, a signed upload link would send this file to encrypted storage. This demo only reads the selected filename locally.") + '</p></section><aside class="card sideSteps"><h3>What happens next</h3><div class="stepLine"><span class="stepNumber">1</span><span><b>Educator submits</b><small>The renewed certificate is attached to the selected staff record.</small></span></div><div class="stepLine"><span class="stepNumber">2</span><span><b>Expiry is extracted</b><small>The suggested date is shown for ' + esc(ownerFirst()) + ' to verify.</small></span></div><div class="stepLine"><span class="stepNumber">3</span><span><b>Owner approves</b><small>The record turns green and the audit timestamp is logged.</small></span></div></aside></div>'
  );
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
function openStaffDetail(id) {
  let e = educators.find((x) => x.id === id);
  if (!e) return;
  let rows = e.certs
    .map(
      (c) =>
        '<div class="modalMeta"><span>' +
        esc(c.type) +
        "</span><span><b>" +
        esc(certStatusLabel(certStatus(c))) +
        "</b> · " +
        esc(c.expiry) +
        (c.days >= 0 && c.days <= 60 ? " · " + c.days + " days" : "") +
        "</span></div>",
    )
    .join("");
  let pending =
    pendingSubmission && pendingSubmission.staffId === id
      ? '<div class="modalSection"><h3>Certificate waiting for approval</h3><p>' +
        esc(pendingSubmission.type) +
        " · " +
        esc(pendingSubmission.fileName) +
        " · Detected expiry " +
        esc(pendingSubmission.expiry) +
        '</p><div class="modalActions"><button class="button primary" onclick="reviewSubmission()">Review certificate</button></div></div>'
      : "";
  openModal(
    '<div class="modalHead"><div><div class="eyebrow">EDUCATOR CERTIFICATE PROFILE</div><h2>' +
      esc(e.name) +
      "</h2><p>" +
      esc(e.room) +
      " · " +
      esc(e.role) +
      '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div><div class="modalSection"><h3>Credential status</h3><p>Overall status: <b>' +
      certStatusLabel(staffStatus(e)) +
      "</b> · Alert state: " +
      esc(e.alertState || "No reminder sent") +
      "</p></div>" +
      rows +
      pending +
      '<div class="modalActions"><button class="button" onclick="closeModal()">Close</button></div>',
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
function reviewSubmission() {
  if (!pendingSubmission) return;
  let cadence =
    pendingSubmission.type === "First Aid" || pendingSubmission.type === "CPR"
      ? "12–36 months"
      : "12–36 months";
  openModal(
    '<div class="modalHead"><div><div class="eyebrow">OWNER VERIFICATION · NEW SUBMISSION</div><h2>Review certificate</h2><p>Check the file and confirm the detected expiry before approval.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div><div class="reviewFile"><span class="fileIcon">▧</span><span><b>' +
      esc(pendingSubmission.fileName) +
      "</b><small>" +
      esc(pendingSubmission.staffName) +
      " · " +
      esc(pendingSubmission.type) +
      " · Submitted " +
      esc(pendingSubmission.submittedAt) +
      '</small></span></div><div class="modalSection"><h3>Detected certificate details</h3><p>Suggested expiry date: <b>' +
      esc(pendingSubmission.expiry) +
      '</b>. Verify this date against the certificate image before approving.</p>' +
      (LIVE ? '<label class="formLabel" for="reviewExpiry">Confirmed expiry date</label><input class="formControl" type="date" id="reviewExpiry" value="' + esc(pendingSubmission.expiryISO || "") + '">' : "") +
      (pendingSubmission.fileUrl ? '<p style="margin-top:8px"><a class="sourceLink" href="' + esc(pendingSubmission.fileUrl) + '" target="_blank" rel="noopener">Open the uploaded certificate ↗</a></p>' : "") +
      '</div><div class="modalMeta"><span>Next renewal reminder</span><b>60 days before expiry · typical cycle ' +
      cadence +
      '</b></div><p class="helpLine">' + (LIVE ? "Approving updates the staff register, records an audit timestamp and schedules the next reminders." : "Sample file review only. The selected certificate is not stored on a secure server.") + '</p><div class="modalActions"><button class="button" onclick="closeModal()">Back</button><button class="button primary" onclick="approveCertificate()">Approve certificate</button></div>',
  );
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
      : current === "updates"
        ? updatesPage()
        : current === "compliance"
        ? Library.page()
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
                    : auditPage();
  document.getElementById("gapBadge").textContent =
    countStatus("red") + countStatus("yellow");
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
  render();
  toast("Checklist approved. Your centre baseline is ready.");
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
function openItem(id) {
  let x = findItem(id);
  if (!x) return;
  let modal =
    '<div class="modalHead"><div><div class="eyebrow">' +
    esc(x.area) +
    " · CHECKLIST ITEM</div><h2>" +
    esc(x.title) +
    '</h2><p>Evidence and source details for your centre baseline</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div><div class="modalSection"><h3>Plain-English requirement summary</h3><p>' +
    esc(x.summary) +
    '</p></div><div class="modalMeta"><span>Source regulation</span><b><a href="https://legislation.nsw.gov.au/view/html/inforce/current/sl-2011-0653" target="_blank" rel="noopener">' +
    esc(x.source) +
    ' ↗</a></b></div><div class="modalMeta"><span>Evidence source</span><b>' +
    esc(x.evidence) +
    '</b></div><div class="modalMeta"><span>Last updated</span><b>' +
    esc(x.updated) +
    '</b></div><div class="modalMeta"><span>Current status</span><span class="status ' +
    x.status +
    '">' +
    statusLabel(x.status) +
    '</span></div><div class="modalSection"><h3>What needs attention</h3><p>' +
    esc(x.risk) +
    '</p></div>' + Library.itemSection(x.key || x.id) + '<div class="modalActions"><button class="button" onclick="closeModal()">Close</button>' +
    ((x.key || x.id) === "evacuation"
      ? '<button class="button primary" onclick="logDrill(\'' +
        x.id +
        "')\">Log evacuation drill</button>"
      : '<label class="button primary uploadAction">Upload evidence<input type="file" accept=".pdf,image/*" onchange="uploadEvidence(\'' +
        x.id +
        "',this)\" hidden></label>") +
    "</div>";
  openModal(modal);
}
function openModal(html) {
  document.getElementById("modalRoot").innerHTML =
    '<div class="modalShade" onclick="if(event.target===this)closeModal()"><div class="modal">' +
    html +
    "</div></div>";
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
function openHelp() {
  openModal(
    '<div class="modalHead"><div><div class="eyebrow">BEEHIVE QUICK GUIDE</div><h2>Using your owner workspace</h2><p>A quick guide for your centre workflows</p></div><button class="closeButton" onclick="closeModal()">×</button></div><div class="modalSection"><h3>1 · Build your baseline</h3><p>Review AI-suggested checklist items, remove anything that does not apply, then approve your centre baseline.</p></div><div class="modalSection"><h3>2 · Close evidence gaps</h3><p>Open any red or yellow item to see its source and what needs attention. Upload evidence or log a drill to update the status.</p></div><div class="modalSection"><h3>3 · Staff certifications</h3><p>Review certificates, run the demo expiry scan, open the self-service upload preview and approve a submitted renewal.</p></div><div class="modalSection"><h3>4 · Search and export</h3><p>Search for a regulation, record or evidence source from the top bar. Export opens the browser print dialog, where you can save a PDF.</p></div><p class="helpLine">' + (LIVE ? "Signed in to your centre: changes are saved to Beehive and visible to your team." : "Prototype uses local browser storage and sample records. File selection is not uploaded to a secure backend.") + '</p><div class="modalActions"><button class="button primary" onclick="closeModal()">Got it</button></div>',
  );
}
function openSourceInfo() {
  openModal(
    '<div class="modalHead"><div><div class="eyebrow">SOURCE & REVIEW</div><h2>Review the official requirements</h2><p>AI suggestions are a starting point for the owner.</p></div><button class="closeButton" onclick="closeModal()">×</button></div><div class="modalSection"><h3>National Regulations</h3><p>Check the current Education and Care Services National Regulations and any state or territory variations before approving checklist items.</p><p style="margin-top:9px"><a href="https://www.acecqa.gov.au/nqf/national-law-regulations/national-regulations" target="_blank" rel="noopener">Open ACECQA National Regulations ↗</a></p></div><div class="modalSection"><h3>National Quality Standard</h3><p>Review the NQS and the quality areas that apply to your service.</p><p style="margin-top:9px"><a href="https://www.acecqa.gov.au/nqf/national-quality-standard" target="_blank" rel="noopener">Open ACECQA NQS ↗</a></p></div><p class="helpLine">This prototype’s checklist wording and regulation references are examples only. Verify the current source text, amendments and jurisdiction-specific rules.</p><div class="modalActions"><button class="button primary" onclick="closeModal()">Close</button></div>',
  );
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
