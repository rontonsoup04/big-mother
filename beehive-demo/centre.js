// beehive Centre section: policies and procedures, contracts, the child list and the daily sheet.
//
// Daily sheet agent: every morning beehive assembles one printable page for each room: the children
// booked in today with their medical alerts and emergency contacts, the educators rostered on, and the
// child-to-educator ratio. It flags anything to sort out before the doors open (a room under ratio, a room
// with a child who has an allergy action plan but no educator with current anaphylaxis training, and so on).
// The owner prints it or saves it as a PDF from the print dialog.
//
// The offline demo uses sample children and contracts (invented). Signed in, the child list comes from
// beehive's records.
const Centre = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ALL_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  // NSW educator-to-child ratios for centre-based care (National Regulations, Regs 123 and 271):
  // birth to 24 months 1:4, over 24 months to under 36 months 1:5, 36 months to preschool age 1:10.
  const RATIO = [{ maxMonths: 24, per: 4, label: "Birth to 24 months" }, { maxMonths: 36, per: 5, label: "24 to 36 months" }, { maxMonths: 999, per: 10, label: "36 months to preschool age" }];

  let tab = "children";
  let roomFilter = "All rooms";
  let childQuery = "";
  let sheetDay = null; // ISO date the daily sheet is for (defaults to the next weekday)

  // ---------- sample data (offline demo only; names and details invented) ----------
  const iso = (d) => d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const daysAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const kid = (first, last, ageDays, room, days, contact, extra) =>
    Object.assign({ id: (first + "-" + last).toLowerCase(), first, last, dob: daysAgo(ageDays), room, days, contact, allergies: "", conditions: "", medication: "", dietary: "", missing: [] }, extra || {});
  const SAMPLE_CHILDREN = [
    kid("Oscar", "Nguyen", 900, "Wattle Room", ALL_WEEK, "Linh Nguyen · 04 0000 3141", { allergies: "Egg", conditions: "Anaphylaxis", medication: "EpiPen Jr 0.15 mg (Wattle Room kit)", dietary: "Egg-free meals", plan: true }),
    kid("Noah", "Kaur", 820, "Wattle Room", ["Mon", "Tue", "Wed"], "Harpreet Kaur · 04 0000 1414"),
    kid("Mila", "Rossi", 760, "Wattle Room", ["Wed", "Thu", "Fri"], "Marco Rossi · 04 0000 2645", { dietary: "Vegetarian" }),
    kid("Arjun", "Mehta", 980, "Wattle Room", ALL_WEEK, "Neha Mehta · 04 0000 1958"),
    kid("Hazel", "Okafor", 850, "Wattle Room", ["Mon", "Wed", "Fri"], "Chidi Okafor · 04 0000 4410", { missing: ["Immunisation history statement"] }),
    kid("Theo", "Lambert", 800, "Wattle Room", ALL_WEEK, "Claire Lambert · 04 0000 4471"),
    kid("Aria", "Kim", 930, "Wattle Room", ["Tue", "Thu"], "Jun Kim · 04 0000 4502", { allergies: "Cow’s milk", dietary: "Dairy-free" }),
    kid("Finn", "Murphy", 870, "Wattle Room", ALL_WEEK, "Siobhan Murphy · 04 0000 4533"),
    kid("Lily", "Tran", 790, "Wattle Room", ["Mon", "Tue", "Thu", "Fri"], "Hoa Tran · 04 0000 4564"),
    kid("Eli", "Cohen", 950, "Wattle Room", ALL_WEEK, "Dana Cohen · 04 0000 4595", { missing: ["Authorised nominee for collection"] }),
    kid("Maya", "Patel", 1100, "Banksia Room", ALL_WEEK, "Priya Patel · 04 0000 2468", { allergies: "Peanuts", conditions: "Asthma", medication: "Ventolin inhaler (as needed)", dietary: "Peanut-free meals", plan: true }),
    kid("Ruby", "Chen", 1300, "Banksia Room", ALL_WEEK, "Grace Chen · 04 0000 1618"),
    kid("Ava", "Hassan", 1010, "Banksia Room", ["Mon", "Tue", "Wed", "Thu"], "Omar Hassan · 04 0000 1732", { dietary: "Halal" }),
    kid("Zoe", "Wilson", 1180, "Banksia Room", ALL_WEEK, "Ben Wilson · 04 0000 1123"),
    kid("Harvey", "Ng", 1220, "Banksia Room", ["Mon", "Wed", "Fri"], "Wei Ng · 04 0000 4626"),
    kid("Olive", "Barker", 1150, "Banksia Room", ALL_WEEK, "Sam Barker · 04 0000 4657", { conditions: "Eczema", medication: "Moisturiser after water play" }),
    kid("Kai", "Fernando", 1260, "Banksia Room", ["Tue", "Wed", "Thu", "Fri"], "Nadia Fernando · 04 0000 4688"),
    kid("Isla", "Brown", 1500, "Gumtree Room", ALL_WEEK, "Tom Brown · 04 0000 2718", { dietary: "Dairy-free" }),
    kid("Leo", "Petrovic", 1400, "Gumtree Room", ALL_WEEK, "Ana Petrovic · 04 0000 2236"),
    kid("Jayden", "Smith", 1550, "Gumtree Room", ["Mon", "Tue", "Wed"], "Kate Smith · 04 0000 3316"),
    kid("Sophie", "Taylor", 1450, "Gumtree Room", ALL_WEEK, "Emma Taylor · 04 0000 2584"),
    kid("Ethan", "Walsh", 1600, "Gumtree Room", ALL_WEEK, "Megan Walsh · 04 0000 4719", { allergies: "Tree nuts", conditions: "Anaphylaxis", medication: "EpiPen 0.3 mg (Gumtree Room kit)", dietary: "Nut-free meals", plan: true }),
    kid("Matilda", "Green", 1480, "Gumtree Room", ["Wed", "Thu", "Fri"], "Rose Green · 04 0000 4740"),
    kid("Ollie", "Singh", 1520, "Gumtree Room", ALL_WEEK, "Gurpreet Singh · 04 0000 4771", { missing: ["Signed enrolment agreement"] }),
    kid("Grace", "Lee", 1420, "Gumtree Room", ["Mon", "Tue", "Thu", "Fri"], "Hannah Lee · 04 0000 4802"),
    kid("Billy", "Evans", 1580, "Gumtree Room", ALL_WEEK, "Rhys Evans · 04 0000 4833"),
  ];
  const SAMPLE_CONTRACTS = [
    { name: "Premises lease", party: "Liverpool Commercial Properties", kind: "Lease", ends: daysAhead(420), notice: 180, owner: "Sara Williams" },
    { name: "Public liability insurance", party: "Sample Mutual Insurance", kind: "Insurance", ends: daysAhead(38), notice: 30, owner: "Sara Williams" },
    { name: "Workers compensation insurance", party: "icare NSW", kind: "Insurance", ends: daysAhead(212), notice: 30, owner: "Sara Williams" },
    { name: "Catering and food supply", party: "Fresh Start Kitchens (sample)", kind: "Supplier", ends: daysAhead(19), notice: 30, owner: "Sara Williams" },
    { name: "Childcare management software", party: "OWNA", kind: "Supplier", ends: daysAhead(260), notice: 30, owner: "Sara Williams" },
    { name: "Fire safety maintenance", party: "Westside Fire Services (sample)", kind: "Supplier", ends: daysAhead(95), notice: 60, owner: "Sara Williams" },
    { name: "Cleaning services", party: "Sparkle Commercial Cleaning (sample)", kind: "Supplier", ends: daysAhead(-6), notice: 30, owner: "Sara Williams" },
    { name: "Enrolment agreement template", party: "Families (all enrolments)", kind: "Family", ends: daysAhead(140), notice: 14, owner: "Sara Williams", note: "Fee schedule changes need 14 days’ notice to families (Reg 172)." },
  ];

  // ---------- data access ----------
  function children() {
    if (typeof LIVE !== "undefined" && LIVE && typeof Live !== "undefined" && Live.children) {
      return (Live.children() || []).map((k) => ({ id: k.id, first: k.first_name, last: k.last_name, dob: k.date_of_birth || "", room: k.room || "", days: ALL_WEEK, contact: k.emergency_contact || "",
        allergies: "", conditions: "", medication: "", dietary: "", missing: [], live: true }));
    }
    return SAMPLE_CHILDREN;
  }
  const months = (dob) => { if (!dob) return null; const a = new Date(dob + "T00:00:00"), b = new Date(); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0); };
  const ageLabel = (dob) => { const m = months(dob); if (m == null) return "—"; return m < 24 ? m + " months" : Math.floor(m / 12) + " yrs " + (m % 12) + " mths"; };
  const ratioFor = (m) => RATIO.find((r) => (m == null ? 999 : m) < r.maxMonths) || RATIO[RATIO.length - 1];
  const alertText = (k) => [k.allergies && "Allergy: " + k.allergies, k.conditions && k.conditions !== "None" && k.conditions, k.dietary && "Diet: " + k.dietary].filter(Boolean).join(" · ");
  const hasPlan = (k) => !!k.plan;
  const rooms = () => Array.from(new Set(children().map((k) => k.room).filter(Boolean)));
  const nextWeekday = () => { const d = new Date(); if (d.getHours() >= 18) d.setDate(d.getDate() + 1); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return iso(d); };
  const dayName = (isoDate) => DAYS[new Date(isoDate + "T00:00:00").getDay()];
  const fmtDay = (isoDate) => new Date(isoDate + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtDate = (isoDate) => new Date(isoDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  const daysTo = (isoDate) => Math.round((Date.parse(isoDate + "T00:00:00") - Date.parse(iso(new Date()) + "T00:00:00")) / 864e5);

  // ---------- the daily sheet agent ----------
  // Builds the sheet for one day: per room, the children booked in, the educators on shift and what to fix.
  function buildSheet(day) {
    const dn = dayName(day);
    const staffToday = typeof Roster !== "undefined" ? Roster.forDay(day) : [];
    const out = { day, rooms: [], flags: [] };
    rooms().forEach((room) => {
      const kids = children().filter((k) => k.room === room && k.days.includes(dn));
      const eds = staffToday.filter((r) => r.room === room);
      const working = eds.filter((r) => r.wwcc);
      const youngest = kids.reduce((m, k) => Math.min(m, months(k.dob) == null ? 999 : months(k.dob)), 999);
      const rule = ratioFor(youngest === 999 ? null : youngest);
      const needed = Math.ceil(kids.length / rule.per);
      const anaKids = kids.filter((k) => /anaphyla/i.test(k.conditions));
      const asthmaKids = kids.filter((k) => /asthma/i.test(k.conditions));
      const hasCert = (r, t) => { const c = r.e.certs.find((x) => x.type === t); return !!c && c.days >= 0; };
      const r = { room, kids, eds, needed, rule, flags: [] };
      if (working.length < needed) r.flags.push(room + ": " + kids.length + " children need " + needed + " educator" + (needed === 1 ? "" : "s") + " at 1:" + rule.per + ", only " + working.length + " rostered.");
      if (!eds.some((x) => x.firstAid && x.wwcc)) r.flags.push(room + ": no educator on shift with current first aid, CPR, anaphylaxis and asthma training (Reg 136).");
      if (anaKids.length && !eds.some((x) => x.wwcc && hasCert(x, "Anaphylaxis"))) r.flags.push(room + ": " + anaKids.map((k) => k.first).join(", ") + " has an anaphylaxis plan but no rostered educator has current anaphylaxis training.");
      if (asthmaKids.length && !eds.some((x) => x.wwcc && hasCert(x, "Asthma"))) r.flags.push(room + ": " + asthmaKids.map((k) => k.first).join(", ") + " has asthma but no rostered educator has current asthma training.");
      eds.filter((x) => !x.wwcc).forEach((x) => r.flags.push(room + ": " + x.e.name + " has no current WWCC and can’t work with children today."));
      kids.filter((k) => k.missing.length).forEach((k) => r.flags.push(room + ": " + k.first + " " + k.last + "’s enrolment record is missing " + k.missing.join(", ").toLowerCase() + "."));
      if (!staffToday.length) r.flags = [];
      out.rooms.push(r);
      out.flags = out.flags.concat(r.flags);
    });
    if (!staffToday.length) out.flags = ["No roster for " + fmtDay(day) + " yet. Create one on the Roster page so beehive can check ratios and first aid cover."];
    return out;
  }

  // ---------- tabs ----------
  function tabs() {
    const kids = children();
    const missing = kids.filter((k) => k.missing.length).length;
    const ending = SAMPLE_CONTRACTS.filter((c) => daysTo(c.ends) <= c.notice).length;
    const t = (id, label, badge) => '<button class="filterButton ' + (tab === id ? "active" : "") + '" onclick="Centre.setTab(\'' + id + '\')">' + label + (badge ? ' <b class="tabBadge">' + badge + "</b>" : "") + "</button>";
    return '<div class="areaFilters" role="tablist">' + t("children", "Children", missing) + t("daily", "Daily sheet") + t("policies", "Policies and procedures") + t("contracts", "Contracts", typeof LIVE !== "undefined" && LIVE ? 0 : ending) + "</div>";
  }
  function setTab(k) { tab = k; render(); window.scrollTo(0, 0); }

  // Child list
  function childrenPage() {
    const all = children();
    const q = childQuery.toLowerCase();
    const list = all.filter((k) => (roomFilter === "All rooms" || k.room === roomFilter) && (!q || (k.first + " " + k.last + " " + k.room + " " + alertText(k)).toLowerCase().includes(q)));
    const alerts = all.filter((k) => alertText(k)).length, missing = all.filter((k) => k.missing.length).length;
    const roomBtns = ["All rooms"].concat(rooms()).map((r) => '<button class="chip ' + (roomFilter === r ? "active" : "") + '" onclick="Centre.room(\'' + r + '\')">' + E(r) + (r === "All rooms" ? "" : " " + all.filter((k) => k.room === r).length) + "</button>").join("");
    return (
      header("Children", all.length + " children enrolled across " + rooms().length + " rooms. " + alerts + " with medical or dietary alerts" + (missing ? ", " + missing + " with incomplete enrolment records." : ".") + " Click a child to open their contracts.",
        "") +
      '<div class="childToolbar"><div class="chips">' + roomBtns + '</div><input class="formControl childSearch" type="search" placeholder="Search children, rooms or allergies" value="' + E(childQuery) + '" oninput="Centre.search(this.value)" aria-label="Search children"></div>' +
      '<div class="tableWrap"><table class="staffTable childTable"><thead><tr><th>Child</th><th>Age</th><th>Days</th><th>Medical and dietary</th><th>Emergency contact</th><th>Contracts</th></tr></thead><tbody>' +
      (list.map((k) =>
        '<tr onclick="Centre.openChild(\'' + E(k.id) + '\')"><td><div class="staffPerson"><b>' + E(k.first + " " + k.last) + "</b><small>" + E(k.room) + "</small></div></td>" +
        '<td data-label="Age" class="num">' + E(ageLabel(k.dob)) + "</td>" +
        '<td data-label="Days">' + (k.days.length === 5 ? "Mon–Fri" : E(k.days.join(", "))) + "</td>" +
        '<td data-label="Medical">' + (alertText(k) ? '<span class="status ' + (hasPlan(k) ? "crit" : "medium") + '">' + E(alertText(k)) + "</span>" + (hasPlan(k) ? "<small class=\"days\">Action plan on file</small>" : "") : '<span class="alertState">None recorded</span>') + "</td>" +
        '<td data-label="Contact">' + E(k.contact) + "</td>" +
        '<td data-label="Contracts">' + (CONTRACTS.some((c) => unsigned(k, c.id)) ? '<span class="status crit">Awaiting signature</span>' : '<span class="status green">3 signed</span>') + (k.missing.filter((m) => !/enrolment agreement/i.test(m)).length ? '<small class="days">Missing ' + E(k.missing.filter((m) => !/enrolment agreement/i.test(m))[0].toLowerCase()) + "</small>" : "") + "</td></tr>").join("") ||
        '<tr><td colspan="6"><p class="empty">No children match.</p></td></tr>') +
      "</tbody></table></div>" +
      '<p class="footnote">' + (typeof LIVE !== "undefined" && LIVE ? "From beehive’s enrolment records. Medical details show once the centre has approved a family’s update." : "Offline demo: sample children with invented details.") + " Enrolment records must include the details in Regs 160–162 and be kept for 3 years after the child leaves.</p>"
    );
  }
  // ---------- a child's record and contracts ----------
  const CONTRACTS = [
    { id: "enrolment", title: "Enrolment agreement", why: "Care arrangements, fees, notice and the centre’s policies (Regs 160–162, 168)" },
    { id: "fees", title: "Fee schedule and payment agreement", why: "Daily fee, Child Care Subsidy, payment terms (Reg 168(2)(n))" },
    { id: "consent", title: "Medical and authorisations consent", why: "Medication, emergency treatment, excursions and collection (Regs 92–102, 161)" },
  ];
  const parentOf = (k) => String(k.contact || "").split("·")[0].trim() || "Parent";
  const signedDate = (k) => { const d = new Date(); d.setDate(d.getDate() - 40 - (k.first.length * 9)); return d; };
  const unsigned = (k, c) => c === "enrolment" && k.missing.some((m) => /enrolment agreement/i.test(m));
  function openChild(id) {
    const k = children().find((x) => x.id === id);
    if (!k) return;
    const row = (label, value) => '<div class="modalMeta"><span>' + label + "</span><b>" + E(value || "None recorded") + "</b></div>";
    openModal(
      '<div class="modalHead"><div><h2>' + E(k.first + " " + k.last) + "</h2><p>" + E(k.room) + ", " + E(ageLabel(k.dob)) + ", " + (k.days.length === 5 ? "Mon–Fri" : E(k.days.join(", "))) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection"><h3>Contracts</h3><div class="contractList">' +
        CONTRACTS.map((c) => {
          const open = unsigned(k, c.id);
          return '<button class="contractRow" onclick="Centre.openContract(\'' + E(k.id) + "','" + c.id + '\')"><span class="pdfIcon">PDF</span><span class="rowMain"><b>' + E(c.title) + "</b><small>" +
            (open ? "Sent to " + E(parentOf(k)) + ", waiting for their signature" : "Signed by " + E(typeof OWNER_NAME !== "undefined" ? OWNER_NAME : "the centre") + " and " + E(parentOf(k)) + ", " + signedDate(k).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })) +
            '</small></span><span class="status ' + (open ? "crit" : "green") + '">' + (open ? "Awaiting signature" : "Signed") + "</span></button>";
        }).join("") + "</div></div>" +
      '<div class="modalSection"><h3>Record</h3>' + row("Allergies", k.allergies) + row("Medical conditions", k.conditions) + row("Medication", k.medication) + row("Dietary needs", k.dietary) + row("Emergency contact", k.contact) +
      row("Enrolment record", k.missing.length ? "Missing: " + k.missing.join(", ") : "Complete") + "</div>", "wide"
    );
  }

  // Builds the agreement as a real PDF in the browser (jsPDF), so it can be viewed and downloaded.
  function contractPdf(k, cid) {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) return null;
    const c = CONTRACTS.find((x) => x.id === cid);
    const doc = new J({ unit: "mm", format: "a4" });
    const centre = typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "Beehive Early Learning";
    const owner = typeof OWNER_NAME !== "undefined" ? OWNER_NAME : "Sara Williams";
    const parent = parentOf(k), open = unsigned(k, cid), when = signedDate(k).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    let y = 22;
    const line = (t, size, bold, gap) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size || 10); doc.splitTextToSize(t, 174).forEach((l) => { if (y > 278) { doc.addPage(); y = 20; } doc.text(l, 18, y); y += (size || 10) * 0.48; }); y += gap == null ? 2 : gap; };
    doc.setDrawColor(192, 138, 34); doc.setLineWidth(0.8); doc.line(18, 14, 192, 14);
    line(centre, 9, true, 0); line("Long day care, Liverpool NSW · ABN 00 000 000 000 (sample)", 8, false, 6);
    line(c.title, 18, true, 4);
    line("This agreement is between " + centre + " (the Service), represented by " + owner + ", Approved Provider, and " + parent + " (the Parent), for the care of:", 10, false, 3);
    line("Child: " + k.first + " " + k.last + "    Date of birth: " + (k.dob ? new Date(k.dob + "T00:00:00").toLocaleDateString("en-AU") : "—") + "    Room: " + k.room, 10, true, 1);
    line("Days of care: " + k.days.join(", ") + "    Hours: 6:30 am to 6:30 pm", 10, true, 5);
    const clauses = cid === "enrolment" ? [
      ["1. Care", "The Service will provide education and care in line with the Education and Care Services National Law and Regulations, the National Quality Framework and the Service’s policies, which the Parent has been given access to."],
      ["2. Booked days", "Fees apply to booked days, including public holidays and absences, unless the Service closes. Changes to booked days need 2 weeks’ written notice."],
      ["3. Health and wellbeing", "The Parent will keep the child’s medical, allergy and immunisation details current and tell the Service of any change straight away. Medical details recorded: " + ([k.allergies && "allergy to " + k.allergies.toLowerCase(), k.conditions, k.dietary && k.dietary.toLowerCase()].filter(Boolean).join("; ") || "none") + "."],
      ["4. Collection", "Only the Parent or an authorised nominee recorded on the enrolment form may collect the child. Photo ID may be requested."],
      ["5. Policies", "The Service will give at least 14 days’ notice of any change to a policy that affects fees or the way fees are collected (Reg 172)."],
      ["6. Ending care", "Either party may end this agreement with 2 weeks’ written notice."],
    ] : cid === "fees" ? [
      ["1. Daily fee", "$148.00 per day (sample). Fees are reviewed each July with at least 14 days’ notice."],
      ["2. Child Care Subsidy", "The Service will report attendance to Services Australia. The gap fee is the daily fee less any Child Care Subsidy received for the child."],
      ["3. Payment", "Fees are charged fortnightly in advance by direct debit. Statements are issued each fortnight."],
      ["4. Late payment", "Fees more than 14 days overdue may lead to care being suspended after written notice."],
      ["5. Late collection", "A late fee of $1 per minute applies after 6:30 pm."],
    ] : [
      ["1. Medication", "Educators may give medication only with the Parent’s written authorisation for each dose, as recorded in the medication record (Regs 92–93)." + (k.medication ? " Current medication: " + k.medication + "." : "")],
      ["2. Emergency treatment", "The Parent consents to the Service seeking medical treatment, ambulance transport and hospital care for the child in an emergency (Reg 161)."],
      ["3. Excursions", "Regular outings within the local area are authorised; other excursions will be authorised separately (Regs 100–102)."],
      ["4. Collection", "Authorised nominees: as listed on the enrolment record (Reg 160)."],
      ["5. Photos", "Photos of the child may be shared privately with the family through the beehive family app only."],
    ];
    clauses.forEach(([h, t]) => { line(h, 11, true, 1); line(t, 10, false, 4); });
    y = Math.max(y + 6, 236);
    if (y > 250) { doc.addPage(); y = 30; }
    doc.setDrawColor(150); doc.setLineWidth(0.3);
    const sig = (x, who, role, name, signed) => {
      doc.line(x, y + 12, x + 76, y + 12);
      doc.setFont("helvetica", "italic"); doc.setFontSize(13);
      if (signed) doc.text(name, x + 2, y + 9);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(who + " (" + role + ")", x, y + 17);
      doc.text(signed ? "Signed electronically " + when : "Not yet signed", x, y + 22);
    };
    sig(18, owner, "for the Service", owner, true);
    sig(114, parent, "Parent", parent, !open);
    doc.setFontSize(7); doc.setTextColor(120);
    doc.text("Sample document generated by beehive for the demo. Not a real contract.", 18, 290);
    return doc;
  }
  function openContract(kidId, cid) {
    const k = children().find((x) => x.id === kidId), c = CONTRACTS.find((x) => x.id === cid);
    const doc = k && contractPdf(k, cid);
    if (!doc) return toast("Couldn’t build the PDF. Check your internet connection and try again.");
    const url = URL.createObjectURL(doc.output("blob"));
    const file = (k.first + "-" + k.last + "-" + c.title).toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";
    openModal(
      '<div class="modalHead"><div><h2>' + E(c.title) + "</h2><p>" + E(k.first + " " + k.last) + " · " + E(c.why) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<iframe class="pdfFrame" src="' + url + '" title="' + E(c.title) + '"></iframe>' +
      '<div class="formActions"><button class="button" onclick="Centre.openChild(\'' + E(k.id) + '\')">Back to ' + E(k.first) + '</button><a class="button primary" href="' + url + '" download="' + file + '"><span data-icon="download"></span>Download PDF</a></div>', "wide"
    );
  }
  function room(r) { roomFilter = r; render(); }
  function search(v) { childQuery = v; render(); const el = document.querySelector(".childSearch"); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }

  // Daily sheet
  function sheetHtml(s, forPrint) {
    const centre = typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "the centre";
    return (
      (forPrint ? "<h1>" + E(centre) + ": daily sheet</h1><p>" + E(fmtDay(s.day)) + ". Prepared by beehive " + E(new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })) + ".</p>" : "") +
      (s.flags.length
        ? '<div class="' + (forPrint ? "printFlags" : "callout") + '"><div><b>Sort out before the doors open (' + s.flags.length + ")</b><ul class=\"rosterGapList\">" + s.flags.map((f) => "<li>" + E(f) + "</li>").join("") + "</ul></div></div>"
        : '<p class="' + (forPrint ? "" : "muted") + '">Nothing to fix: every room is in ratio with trained educators on shift.</p>') +
      s.rooms.map((r) =>
        '<section class="' + (forPrint ? "printRoom" : "section") + '"><div class="sectionHead"><h2>' + E(r.room) + '<span class="count">' + r.kids.length + " children · " + r.eds.length + " educators</span></h2><p>Ratio 1:" + r.rule.per + " (" + E(r.rule.label) + "), needs " + r.needed + "</p></div>" +
        '<div class="sheetCols"><div><h3>Children</h3><table class="staffTable sheetTable"><tbody>' +
          (r.kids.map((k) => "<tr><td><b>" + E(k.first + " " + k.last) + "</b>" + (alertText(k) ? '<br><small class="sheetAlert">' + E(alertText(k)) + (k.medication ? " · " + E(k.medication) : "") + "</small>" : "") + "</td><td class=\"sheetSign\">In ____ Out ____</td></tr>").join("") || '<tr><td colspan="2">No children booked.</td></tr>') +
        '</tbody></table></div><div><h3>Educators</h3><table class="staffTable sheetTable"><tbody>' +
          (r.eds.map((x) => "<tr><td><b>" + E(x.e.name) + "</b><br><small>" + E(x.start + " – " + x.end) + (x.firstAid && x.wwcc ? " · first aid cover" : "") + (!x.wwcc ? " · WWCC not current" : "") + "</small></td></tr>").join("") || "<tr><td>No educators rostered.</td></tr>") +
        "</tbody></table></div></div></section>").join("") +
      (forPrint ? '<p class="printDisclaimer">Generated from beehive records. Keep the signed sheet with your attendance records (Reg 158).</p>' : "")
    );
  }
  function dailyPage() {
    const day = sheetDay || nextWeekday();
    const s = buildSheet(day);
    const total = s.rooms.reduce((n, r) => n + r.kids.length, 0);
    return (
      header("Daily sheet", "beehive prepares this every morning: who’s booked in, who’s on shift, medical alerts and ratios for " + fmtDay(day) + ".",
        '<input class="formControl sheetDate" type="date" value="' + day + '" onchange="Centre.setDay(this.value)" aria-label="Day"><button class="button primary" onclick="Centre.print()"><span data-icon="download"></span>Print or save as PDF</button>') +
      '<div class="rosterSummary"><div><b class="num">' + total + "</b><small>Children booked</small></div><div><b class=\"num\">" + s.rooms.reduce((n, r) => n + r.eds.length, 0) + "</b><small>Educators on shift</small></div>" +
      '<div><b class="num">' + s.rooms.reduce((n, r) => n + r.kids.filter((k) => alertText(k)).length, 0) + "</b><small>Medical or dietary alerts</small></div><div><b class=\"num " + (s.flags.length ? "bad" : "") + '">' + s.flags.length + "</b><small>To sort out</small></div></div>" +
      sheetHtml(s, false) +
      '<p class="footnote">' + (typeof LIVE !== "undefined" && LIVE ? "" : "Offline demo: sample children and shifts. ") + "Ratios follow the NSW educator-to-child ratios (Regs 123 and 271): 1:4 under 2, 1:5 from 2 to 3, 1:10 from 3 to preschool age. The youngest child in the room sets the ratio.</p>"
    );
  }
  function setDay(v) { sheetDay = v || null; render(); }
  function print() {
    const s = buildSheet(sheetDay || nextWeekday());
    let el = document.getElementById("dailySheetPrint");
    if (!el) { el = document.createElement("section"); el.id = "dailySheetPrint"; el.className = "dailySheetPrint"; document.body.appendChild(el); }
    el.innerHTML = sheetHtml(s, true);
    document.body.classList.add("printingDaily");
    const done = () => { document.body.classList.remove("printingDaily"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  }

  // Contracts
  function contractsPage() {
    if (typeof LIVE !== "undefined" && LIVE)
      return header("Contracts", "Leases, insurance, suppliers and family agreements.") + '<p class="empty">No contracts recorded yet. Contracts are in the offline demo for now.</p>';
    const list = SAMPLE_CONTRACTS.slice().sort((a, b) => daysTo(a.ends) - daysTo(b.ends));
    const state = (c) => { const d = daysTo(c.ends); return d < 0 ? ["crit", "Expired " + (-d) + " days ago"] : d <= c.notice ? ["medium", "Renew within " + d + " days"] : ["green", "Current"]; };
    const due = list.filter((c) => state(c)[0] !== "green").length;
    return (
      header("Contracts", due ? due + " contract" + (due === 1 ? "" : "s") + " need attention. beehive flags each one when it enters its notice period." : "Every contract is current.") +
      '<div class="tableWrap"><table class="staffTable"><thead><tr><th>Contract</th><th>Type</th><th>Ends</th><th>Notice</th><th>Status</th></tr></thead><tbody>' +
      list.map((c) => { const s = state(c); return "<tr><td><div class=\"staffPerson\"><b>" + E(c.name) + "</b><small>" + E(c.party) + (c.note ? " · " + E(c.note) : "") + '</small></div></td><td data-label="Type">' + E(c.kind) + '</td><td data-label="Ends" class="num">' + E(fmtDate(c.ends)) + '</td><td data-label="Notice">' + c.notice + ' days</td><td data-label="Status"><span class="status ' + s[0] + '">' + E(s[1]) + "</span></td></tr>"; }).join("") +
      "</tbody></table></div>" +
      '<p class="footnote">Offline demo: sample contracts. Public liability insurance is a condition of service approval; keep the certificate of currency on file.</p>'
    );
  }

  // Policies and procedures: beehive's compliance library and recurring tasks, under the Centre heading.
  function policiesPage() {
    return typeof Library !== "undefined" ? Library.page().replace(/<h1>Compliance<\/h1>/, "<h1>Policies and procedures</h1>") : "";
  }

  function page() { return childrenPage(); }

  // ---------- Overview ----------
  function stats() {
    const kids = children();
    return { children: kids.length, incomplete: kids.filter((k) => k.missing.length).length,
      contractsDue: typeof LIVE !== "undefined" && LIVE ? 0 : SAMPLE_CONTRACTS.filter((c) => daysTo(c.ends) <= c.notice).length };
  }
  function sheetSummary(s) {
    return '<div class="sheetRooms">' + s.rooms.map((r) =>
      '<div class="sheetRoom"><b>' + E(r.room) + "</b><small>" + r.kids.length + " children · " + r.eds.length + " educators · 1:" + r.rule.per + "</small>" +
      (r.kids.filter((k) => alertText(k)).length ? '<small class="sheetAlert">' + r.kids.filter((k) => alertText(k)).map((k) => k.first + " (" + (k.allergies || k.conditions || k.dietary) + ")").join(", ") + "</small>" : "") + "</div>").join("") + "</div>" +
      (s.flags.length ? '<ul class="rosterGapList sheetFlags">' + s.flags.slice(0, 2).map((f) => "<li>" + E(f) + "</li>").join("") + (s.flags.length > 2 ? "<li>" + (s.flags.length - 2) + " more on the full sheet</li>" : "") + "</ul>" : '<p class="muted small">Nothing to sort out: every room is in ratio with trained educators on shift.</p>');
  }
  function overviewSection() {
    const day = nextWeekday(), s = buildSheet(day);
    return '<section class="section dailyOverview"><div class="sectionHead"><h2>' + E(fmtDay(day)) + "</h2>" +
      '<div class="buttonRow"><button class="textButton" onclick="Centre.openFull()">Full sheet</button><button class="button small" onclick="Centre.printDay(\'' + day + '\')"><span data-icon="download"></span>Print or save as PDF</button></div></div>' +
      sheetSummary(s) + "</section>";
  }
  // Shown on sign-in: today's sheet, ready to print.
  function popup() {
    const day = nextWeekday(), s = buildSheet(day);
    const total = s.rooms.reduce((n, r) => n + r.kids.length, 0);
    openModal(
      '<div class="modalHead"><div><h2>Your daily sheet</h2><p>' + E(fmtDay(day)) + ". " + total + " children booked, " + s.flags.length + " thing" + (s.flags.length === 1 ? "" : "s") + ' to sort out.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection">' + sheetSummary(s) + "</div>" +
      '<div class="formActions"><button class="button" onclick="closeModal();Centre.openFull()">See the full sheet</button><button class="button primary" onclick="Centre.printDay(\'' + day + '\')"><span data-icon="download"></span>Print or save as PDF</button></div>' +
      '<p class="footnote">beehive shows this each time you sign in. It’s also on your Overview.</p>', "wide");
    if (typeof fillIcons === "function") fillIcons(document.getElementById("modalRoot"));
  }
  function openFull() {
    const s = buildSheet(nextWeekday());
    openModal('<div class="modalHead"><div><h2>Daily sheet</h2><p>' + E(fmtDay(s.day)) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' + sheetHtml(s, false) +
      '<div class="formActions"><button class="button primary" onclick="Centre.printDay(\'' + s.day + '\')"><span data-icon="download"></span>Print or save as PDF</button></div>', "wide");
  }
  function printDay(day) { sheetDay = day; print(); }

  return { page, openContract, setTab, room, search, openChild, setDay, print, buildSheet, children, stats, overviewSection, popup, openFull, printDay };
})();
