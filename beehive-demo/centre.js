// beehive Centre section: policies and procedures, contracts, the child list and the daily sheet.
//
// Daily sheet agent: every morning beehive assembles one printable page for the whole centre: the children
// booked in today with their medical alerts and emergency contacts, the educators rostered on, and the
// child-to-educator ratios. It flags anything to sort out before the doors open (not enough educators for the
// children's age-group ratios, a child with an allergy action plan but no educator with current anaphylaxis
// training on shift, and so on).
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
  let childQuery = "";
  let sheetDay = null; // ISO date the daily sheet is for (defaults to the next weekday)

  // ---------- sample data (offline demo only; names and details invented) ----------
  const iso = (d) => d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const daysAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const kid = (first, last, ageDays, days, contact, extra) =>
    Object.assign({ id: (first + "-" + last).toLowerCase(), first, last, dob: daysAgo(ageDays), days, contact, allergies: "", conditions: "", medication: "", dietary: "", missing: [] }, extra || {});
  const SAMPLE_CHILDREN = [
    kid("Oscar", "Nguyen", 900, ALL_WEEK, "Linh Nguyen · 04 0000 3141", { allergies: "Egg", conditions: "Anaphylaxis", medication: "EpiPen Jr 0.15 mg (medication kit)", dietary: "Egg-free meals", plan: true }),
    kid("Noah", "Kaur", 820, ["Mon", "Tue", "Wed"], "Harpreet Kaur · 04 0000 1414"),
    kid("Mila", "Rossi", 760, ["Wed", "Thu", "Fri"], "Marco Rossi · 04 0000 2645", { dietary: "Vegetarian" }),
    kid("Arjun", "Mehta", 980, ALL_WEEK, "Neha Mehta · 04 0000 1958", { allergies: "Cow’s milk", dietary: "Dairy-free (soy milk from home)" }),
    kid("Hazel", "Okafor", 850, ["Mon", "Wed", "Fri"], "Chidi Okafor · 04 0000 4410", { missing: ["Immunisation history statement"] }),
    kid("Theo", "Lambert", 800, ALL_WEEK, "Claire Lambert · 04 0000 4471", { conditions: "Coeliac disease", dietary: "Gluten-free meals" }),
    kid("Aria", "Kim", 930, ["Tue", "Thu"], "Jun Kim · 04 0000 4502", { allergies: "Cow’s milk", dietary: "Dairy-free" }),
    kid("Finn", "Murphy", 870, ALL_WEEK, "Siobhan Murphy · 04 0000 4533"),
    kid("Lily", "Tran", 790, ["Mon", "Tue", "Thu", "Fri"], "Hoa Tran · 04 0000 4564"),
    kid("Eli", "Cohen", 950, ALL_WEEK, "Dana Cohen · 04 0000 4595", { missing: ["Authorised nominee for collection"] }),
    kid("Maya", "Patel", 1100, ALL_WEEK, "Priya Patel · 04 0000 2468", { allergies: "Peanuts", conditions: "Asthma", medication: "Ventolin inhaler (as needed)", dietary: "Peanut-free meals", plan: true }),
    kid("Ruby", "Chen", 1300, ALL_WEEK, "Grace Chen · 04 0000 1618", { dietary: "Vegetarian" }),
    kid("Ava", "Hassan", 1010, ["Mon", "Tue", "Wed", "Thu"], "Omar Hassan · 04 0000 1732", { dietary: "Halal" }),
    kid("Zoe", "Wilson", 1180, ALL_WEEK, "Ben Wilson · 04 0000 1123", { conditions: "Asthma", medication: "Ventolin inhaler (medication kit)", plan: true }),
    kid("Harvey", "Ng", 1220, ["Mon", "Wed", "Fri"], "Wei Ng · 04 0000 4626", { allergies: "Sesame", dietary: "Sesame-free meals" }),
    kid("Olive", "Barker", 1150, ALL_WEEK, "Sam Barker · 04 0000 4657", { conditions: "Eczema", medication: "Moisturiser after water play" }),
    kid("Kai", "Fernando", 1260, ["Tue", "Wed", "Thu", "Fri"], "Nadia Fernando · 04 0000 4688"),
    kid("Isla", "Brown", 1500, ALL_WEEK, "Tom Brown · 04 0000 2718", { dietary: "Dairy-free" }),
    kid("Leo", "Petrovic", 1400, ALL_WEEK, "Ana Petrovic · 04 0000 2236", { dietary: "No pork" }),
    kid("Jayden", "Smith", 1550, ["Mon", "Tue", "Wed"], "Kate Smith · 04 0000 3316"),
    kid("Sophie", "Taylor", 1450, ALL_WEEK, "Emma Taylor · 04 0000 2584", { conditions: "Eczema", medication: "Moisturiser after water play" }),
    kid("Ethan", "Walsh", 1600, ALL_WEEK, "Megan Walsh · 04 0000 4719", { allergies: "Tree nuts", conditions: "Anaphylaxis", medication: "EpiPen 0.3 mg (medication kit)", dietary: "Nut-free meals", plan: true }),
    kid("Matilda", "Green", 1480, ["Wed", "Thu", "Fri"], "Rose Green · 04 0000 4740"),
    kid("Ollie", "Singh", 1520, ALL_WEEK, "Gurpreet Singh · 04 0000 4771", { missing: ["Signed enrolment agreement"] }),
    kid("Grace", "Lee", 1420, ["Mon", "Tue", "Thu", "Fri"], "Hannah Lee · 04 0000 4802", { allergies: "Strawberries", dietary: "No strawberries" }),
    kid("Billy", "Evans", 1580, ALL_WEEK, "Rhys Evans · 04 0000 4833"),
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
  function baseChildren() {
    if (typeof LIVE !== "undefined" && LIVE && typeof Live !== "undefined" && Live.children) {
      // The enrolment form's details, with the latest approved medical update on top of the medical details it recorded.
      return (Live.children() || []).map((k) => {
        const en = k.enrolment || {};
        const med = k.medical ? liveMedical(k.medical) : { allergies: none(en.allergies), conditions: none(en.conditions), dietary: none(en.dietary), medication: none(en.medication), plan: !!en.plan || /anaphyla|asthma/i.test(en.conditions || "") };
        return Object.assign({ id: k.id, first: k.first_name, last: k.last_name, dob: k.date_of_birth || "", days: en.days && en.days.length ? en.days : ALL_WEEK,
          contact: k.emergency_contact || "", nominees: en.nominees || [], enrolment: en, missing: [], live: true }, med);
      });
    }
    // Offline demo: the sample family's medical record (and any update the centre has approved) is that child's record.
    const fm = typeof familyMedical !== "undefined" ? familyMedical : null;
    return SAMPLE_CHILDREN.concat(addedOffline()).map((k) => !fm || fm.childName !== k.first + " " + k.last ? k : Object.assign({}, k, {
      allergies: none(fm.allergies), conditions: none(fm.conditions), medication: none(fm.medications), dietary: none(fm.dietary),
      notes: fm.notes || "", reviewedAt: fm.reviewedAt || "", plan: /anaphyla|asthma/i.test(fm.conditions || ""),
    }));
  }
  // Contract amendments change the child's record: days, medical and dietary needs, nominees.
  const AMEND_STORE = "beehive-contract-amendments-v1";
  const AMEND_FIELDS = ["days", "allergies", "conditions", "medication", "dietary", "nominees"];
  function amendments() { try { return JSON.parse(localStorage.getItem(AMEND_STORE) || "{}"); } catch (e) { return {}; } }
  function saveAmendments(a) { try { localStorage.setItem(AMEND_STORE, JSON.stringify(a)); } catch (e) {} }
  function children() {
    const all = amendments();
    return baseChildren().map((k) => {
      const list = all[k.id] || [];
      if (!list.length) return k;
      const out = Object.assign({}, k, { amendments: list });
      list.forEach((a) => AMEND_FIELDS.forEach((f) => { if (a.changes && a.changes[f] !== undefined) out[f] = a.changes[f]; }));
      out.plan = /anaphyla|asthma/i.test(out.conditions || "") ? (k.plan || list.some((a) => a.changes && a.changes.conditions !== undefined)) : false;
      return out;
    });
  }
  const none = (v) => (!v || /^(none|nil|n\/a|-)$/i.test(String(v).trim()) ? "" : String(v).trim());
  const liveMedical = (m) => {
    m = m || {};
    const conditions = none(m.conditions);
    return { allergies: none(m.allergies), conditions, dietary: none(m.dietary), medication: none(m.medications), plan: /anaphyla|asthma/i.test(conditions) };
  };
  const months = (dob) => { if (!dob) return null; const a = new Date(dob + "T00:00:00"), b = new Date(); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0); };
  const ageLabel = (dob) => { const m = months(dob); if (m == null) return "—"; return m < 24 ? m + " months" : Math.floor(m / 12) + " yrs " + (m % 12) + " mths"; };
  const ratioFor = (m) => RATIO.find((r) => (m == null ? 999 : m) < r.maxMonths) || RATIO[RATIO.length - 1];
  const alertText = (k) => [k.allergies && "Allergy: " + k.allergies, k.conditions && k.conditions !== "None" && k.conditions, k.dietary && "Diet: " + k.dietary].filter(Boolean).join(" · ");
  const hasPlan = (k) => !!k.plan;
  const nextWeekday = () => { const d = new Date(); if (d.getHours() >= 18) d.setDate(d.getDate() + 1); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return iso(d); };
  const dayName = (isoDate) => DAYS[new Date(isoDate + "T00:00:00").getDay()];
  const fmtDay = (isoDate) => new Date(isoDate + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtDate = (isoDate) => new Date(isoDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  const daysTo = (isoDate) => Math.round((Date.parse(isoDate + "T00:00:00") - Date.parse(iso(new Date()) + "T00:00:00")) / 864e5);

  // ---------- the daily sheet agent ----------
  // Builds the sheet for one day across the whole centre: the children booked in, the educators on shift and what to fix.
  function buildSheet(day) {
    const dn = dayName(day);
    const staffToday = typeof Roster !== "undefined" ? Roster.forDay(day) : [];
    const kids = children().filter((k) => k.days.includes(dn));
    const eds = staffToday;
    const working = eds.filter((r) => r.wwcc);
    // each child counts towards their own age group's ratio (1:4, 1:5, 1:10)
    const needed = Math.ceil(kids.reduce((n, k) => n + 1 / ratioFor(months(k.dob)).per, 0) - 1e-9);
    const anaKids = kids.filter((k) => /anaphyla/i.test(k.conditions));
    const asthmaKids = kids.filter((k) => /asthma/i.test(k.conditions));
    const hasCert = (r, t) => { const c = r.e.certs.find((x) => x.type === t); return !!c && c.days >= 0; };
    const flags = [];
    if (working.length < needed) flags.push(kids.length + " children need " + needed + " educator" + (needed === 1 ? "" : "s") + " by their age-group ratios, only " + working.length + " rostered.");
    if (kids.length && !eds.some((x) => x.firstAid && x.wwcc)) flags.push("No educator on shift has current first aid, CPR, anaphylaxis and asthma training (Reg 136).");
    if (anaKids.length && !eds.some((x) => x.wwcc && hasCert(x, "Anaphylaxis"))) flags.push(anaKids.map((k) => k.first).join(", ") + " has an anaphylaxis plan but no rostered educator has current anaphylaxis training.");
    if (asthmaKids.length && !eds.some((x) => x.wwcc && hasCert(x, "Asthma"))) flags.push(asthmaKids.map((k) => k.first).join(", ") + " has asthma but no rostered educator has current asthma training.");
    eds.filter((x) => !x.wwcc).forEach((x) => flags.push(x.e.name + " has no current WWCC and can’t work with children today."));
    kids.filter((k) => k.missing.length).forEach((k) => flags.push(k.first + " " + k.last + "’s enrolment record is missing " + k.missing.join(", ").toLowerCase() + "."));
    return { day, kids, eds, needed, flags: staffToday.length ? flags : ["No roster for " + fmtDay(day) + " yet. Create one on the Roster page so beehive can check ratios and first aid cover."] };
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
    const list = all.filter((k) => (!q || (k.first + " " + k.last + " " + alertText(k)).toLowerCase().includes(q)));
    return (
      header("Children", "", '<button class="button primary" onclick="Centre.openAddChild()">Add a child</button>') +
      '<div class="childToolbar"><input class="formControl childSearch" type="search" placeholder="Search children or allergies" value="' + E(childQuery) + '" oninput="Centre.search(this.value)" aria-label="Search children"></div>' +
      '<div class="tableWrap"><table class="staffTable childTable"><thead><tr><th>Child</th><th>Age</th><th>Days</th><th>Medical and dietary</th><th>Emergency contact</th><th class=\"contractCell\"></th></tr></thead><tbody>' +
      (list.map((k) =>
        '<tr onclick="Centre.openChild(\'' + E(k.id) + '\')"><td><div class="staffPerson"><b>' + E(k.first + " " + k.last) + "</b></div></td>" +
        '<td data-label="Age" class="num">' + E(ageLabel(k.dob)) + "</td>" +
        '<td data-label="Days">' + (k.days.length === 5 ? "Mon–Fri" : E(k.days.join(", "))) + "</td>" +
        '<td data-label="Medical">' + (alertText(k) ? '<span class="status ' + (hasPlan(k) ? "crit" : "medium") + '">' + E(alertText(k)) + "</span>" + (hasPlan(k) ? "<small class=\"days\">Action plan on file</small>" : "") : '<span class="alertState">None recorded</span>') + "</td>" +
        '<td data-label="Contact">' + E(k.contact) + "</td>" +
        '<td data-label="Contracts" class="contractCell"><button class="button small' + (CONTRACTS.some((c) => unsigned(k, c.id)) ? " needsSign" : "") + '" onclick="event.stopPropagation();Centre.openContracts(\'' + E(k.id) + '\')"><span class="pdfMini">PDF</span>Contracts' + (CONTRACTS.some((c) => unsigned(k, c.id)) ? ' <b class="tabBadge">1</b>' : "") + "</button></td></tr>").join("") ||
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
  const pendingAmend = (k, c) => (k.amendments || []).filter((a) => a.contract === c && !a.signedOn);
  const unsigned = (k, c) => (c === "enrolment" && k.missing.some((m) => /enrolment agreement/i.test(m))) || pendingAmend(k, c).length > 0;
  function contractListHtml(k) {
    return '<div class="contractList">' + CONTRACTS.map((c) => {
      const open = unsigned(k, c.id);
      return '<button class="contractRow" onclick="Centre.openContract(\'' + E(k.id) + "','" + c.id + '\')"><span class="pdfIcon">PDF</span><span class="rowMain"><b>' + E(c.title) + "</b><small>" +
        (pendingAmend(k, c.id).length ? "Amended " + fmtDate(pendingAmend(k, c.id).slice(-1)[0].on) + ": sent to " + E(parentOf(k)) + " to sign" : open ? "Sent to " + E(parentOf(k)) + ", waiting for their signature" : ((k.amendments || []).some((a) => a.contract === c.id) ? "Amended and re-signed · " : "") + "Signed by " + E(typeof OWNER_NAME !== "undefined" ? OWNER_NAME : "the centre") + " and " + E(parentOf(k)) + ", " + signedDate(k).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })) +
        '</small></span><span class="status ' + (open ? "crit" : "green") + '">' + (open ? "Awaiting signature" : "Signed") + "</span></button>";
    }).join("") + "</div>";
  }
  function openContracts(id) {
    const k = children().find((x) => x.id === id);
    if (!k) return;
    openModal('<div class="modalHead"><div><h2>' + E(k.first + " " + k.last) + "’s contracts</h2><p>Agreements between " + E(typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "the centre") + " and " + E(parentOf(k)) + '. Click one to view the PDF.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection">' + contractListHtml(k) + "</div>" +
      ((k.amendments || []).length ? '<div class="modalSection"><h3>Changes to the agreements</h3>' + k.amendments.slice().reverse().map((a, i) =>
        '<div class="amendRow"><div><b>' + E(fmtDate(a.on)) + " · " + E((CONTRACTS.find((c) => c.id === a.contract) || {}).title || "") + "</b><small>" + E(describe(a)) + "</small></div>" +
        (a.signedOn ? '<span class="status green">Signed by ' + E(parentOf(k)) + "</span>" : '<button class="button small" onclick="Centre.markSigned(\'' + E(k.id) + "'," + (k.amendments.length - 1 - i) + ')">Mark signed by parent</button>') + "</div>").join("") + "</div>" : "") +
      '<div class="formActions"><button class="button primary" onclick="Centre.openAmend(\'' + E(k.id) + '\')">Change the agreement</button></div>');
  }
  // ---------- change an agreement (and with it, the child's record) ----------
  const LABEL = { room: "Room", days: "Days of care", allergies: "Allergies", conditions: "Medical conditions", medication: "Medication", dietary: "Dietary needs", nominees: "Authorised nominees" };
  function describe(a) {
    const parts = Object.entries(a.changes || {}).map(([f, v]) => LABEL[f] + ": " + (Array.isArray(v) ? v.join(", ") : v || "none"));
    if (a.terms) parts.push("New terms: " + a.terms);
    return parts.join(" · ") || "No changes";
  }
  function openAmend(id) {
    const k = children().find((x) => x.id === id);
    if (!k) return;
    const fieldHtml = (label, control, hint) => '<label class="formField"><span class="formLabel">' + label + "</span>" + control + (hint ? '<small class="muted">' + hint + "</small>" : "") + "</label>";
    const txt = (idn, v, ph) => '<input class="formControl" id="' + idn + '" value="' + E(v || "") + '" placeholder="' + E(ph || "") + '">';
    openModal(
      '<div class="modalHead"><div><h2>Change ' + E(k.first) + "’s agreement</h2><p>Changes update " + E(k.first) + "’s record straight away (child list, daily sheet and roster ratios) and the agreement goes to " + E(parentOf(k)) + ' to sign.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="formGrid">' +
        fieldHtml("Agreement", '<select class="formControl" id="amContract">' + CONTRACTS.map((c) => '<option value="' + c.id + '">' + E(c.title) + "</option>").join("") + "</select>") +
        fieldHtml("Days of care", '<div class="dayPicks" id="amDays">' + ALL_WEEK.map((d) => '<label><input type="checkbox" value="' + d + '"' + (k.days.includes(d) ? " checked" : "") + ">" + d + "</label>").join("") + "</div>") +
        fieldHtml("Allergies", txt("amAllergies", k.allergies, "e.g. Peanuts")) +
        fieldHtml("Medical conditions", txt("amConditions", k.conditions, "e.g. Asthma"), "Anaphylaxis or asthma needs an action plan and a trained educator on every shift.") +
        fieldHtml("Medication", txt("amMedication", k.medication, "e.g. Ventolin inhaler (as needed)")) +
        fieldHtml("Dietary needs", txt("amDietary", k.dietary, "e.g. Dairy-free")) +
        fieldHtml("Authorised nominees for collection", txt("amNominees", (k.nominees || []).join(", "), "Names, separated by commas")) +
      "</div>" +
      '<label class="formField"><span class="formLabel">Other terms (optional)</span><textarea class="formControl" id="amTerms" rows="2" placeholder="e.g. Late pick-up on Thursdays until 6:45 pm"></textarea></label>' +
      '<div class="formActions"><button class="button" onclick="Centre.openContracts(\'' + E(k.id) + '\')">Cancel</button><button class="button primary" onclick="Centre.saveAmend(\'' + E(k.id) + '\')">Save and send to parent</button></div>', "wide");
  }
  function saveAmend(id) {
    const k = children().find((x) => x.id === id);
    if (!k) return;
    const v = (x) => ((document.getElementById(x) || {}).value || "").trim();
    const days = Array.from(document.querySelectorAll("#amDays input:checked")).map((x) => x.value);
    if (!days.length) return toast("Pick at least one day of care.");
    const next = { days, allergies: v("amAllergies"), conditions: v("amConditions"), medication: v("amMedication"), dietary: v("amDietary"),
      nominees: v("amNominees") ? v("amNominees").split(",").map((x) => x.trim()).filter(Boolean) : [] };
    const changes = {};
    Object.keys(next).forEach((f) => { const before = f === "nominees" ? (k.nominees || []).join(",") : f === "days" ? k.days.join(",") : k[f] || ""; const after = Array.isArray(next[f]) ? next[f].join(",") : next[f]; if (before !== after) changes[f] = next[f]; });
    const terms = v("amTerms");
    if (!Object.keys(changes).length && !terms) return toast("Nothing has changed yet.");
    const all = amendments();
    all[id] = (all[id] || []).concat([{ contract: v("amContract"), on: new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" }), changes, terms, signedOn: null }]);
    saveAmendments(all);
    const anaph = /anaphyla|asthma/i.test(next.conditions) && !/anaphyla|asthma/i.test(k.conditions || "");
    render();
    openContracts(id);
    toast(k.first + "’s record is updated and the amended agreement was sent to " + parentOf(k) + " to sign (simulated)." + (anaph ? " Check there is a trained educator on every shift." : ""));
  }
  function markSigned(id, index) {
    const all = amendments();
    if (!all[id] || !all[id][index]) return;
    all[id][index].signedOn = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
    saveAmendments(all);
    render();
    openContracts(id);
    toast("Recorded as signed by the parent.");
  }
  // ---------- a child's medical record (part of each child's record; there is no separate Medical page) ----------
  const fullName = (k) => k.first + " " + k.last;
  // A parent's medical update for this child that is waiting for the centre to review it.
  function pendingUpdate(k) {
    const m = typeof medicalSubmission !== "undefined" ? medicalSubmission : null;
    return m && m.status === "pending" && m.childName === fullName(k) ? m : null;
  }
  function medicalHtml(k) {
    const data = typeof familyData === "function" ? familyData : (label, v) => '<div class="familyData"><small>' + label + "</small><b>" + E(v || "Not provided") + "</b></div>";
    const p = pendingUpdate(k);
    return (
      '<div class="modalSection childMedical"><div class="sectionHead"><h3>Medical record</h3><button class="button small" onclick="Centre.openAmend(\'' + E(k.id) + '\')">Update medical details</button></div>' +
      (p ? '<div class="callout"><span class="hx lg"></span><div><b>' + E(p.signer || "A parent") + " sent a medical update</b><p>Submitted " + E(p.submittedAt) + ". Educators see it once you approve it.</p></div>" +
        '<span class="rowEnd"><button class="button primary small" onclick="reviewFamilyUpdate()">Review update</button></span></div>' : "") +
      '<div class="familyDataGrid">' +
      data("Allergies", k.allergies) + data("Medical conditions", k.conditions) +
      data("Medication or action plan", k.medication ? k.medication + (hasPlan(k) ? " · action plan on file" : "") : "") +
      data("Dietary needs", k.dietary) + data("Care notes", k.notes) + data("Emergency contact", k.contact) +
      "</div>" +
      (k.reviewedAt ? '<p class="footnote">Last reviewed by the centre ' + E(k.reviewedAt) + ".</p>" : "") + "</div>"
    );
  }
  function openChild(id) {
    const k = children().find((x) => x.id === id);
    if (!k) return;
    const row = (label, value) => '<div class="modalMeta"><span>' + label + "</span><b>" + E(value || "None recorded") + "</b></div>";
    openModal(
      '<div class="modalHead"><div><h2>' + E(fullName(k)) + "</h2><p>" + E(ageLabel(k.dob)) + ", " + (k.days.length === 5 ? "Mon–Fri" : E(k.days.join(", "))) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      medicalHtml(k) +
      '<div class="modalSection"><div class="sectionHead"><h3>Contracts</h3><button class="button small" onclick="Centre.openAmend(\'' + E(k.id) + '\')">Change the agreement</button></div>' + contractListHtml(k) + "</div>" +
      '<div class="modalSection"><div class="sectionHead"><h3>Documents</h3><button class="button small primary" onclick="Centre.openAiDoc(\'' + E(k.id) + '\')"><span data-icon="spark"></span>Create a document with AI</button></div>' +
        '<div id="childDocs" class="docList"><p class="muted small">Loading…</p></div></div>' +
      '<div class="modalSection"><h3>Record</h3>' + row("Authorised nominees", (k.nominees || []).join(", ")) +
      enrolmentRows(k, row) +
      row("Enrolment record", k.missing.length ? "Missing: " + k.missing.join(", ") : "Complete") + "</div>", "wide"
    );
    showDocs(k.id);
  }
  // The extra enrolment details recorded when the child was added.
  function enrolmentRows(k, row) {
    const en = k.enrolment || {};
    const parents = (en.parents || []).filter((p) => p && p.name).map((p) => p.name + (p.relationship ? " (" + p.relationship + ")" : "") + [p.phone, p.email].filter(Boolean).map((x) => " · " + x).join(""));
    return (parents.length ? row("Parents and guardians", parents.join("; ")) : "") +
      (en.startDate ? row("Start date", fmtDate(en.startDate)) : "") +
      (en.doctor ? row("Doctor", en.doctor) : "") +
      (en.immunisation ? row("Immunisation", en.immunisation) : "") +
      (en.consents && en.consents.length ? row("Consents given", en.consents.join(", ")) : "");
  }

  // ---------- add a child: every enrolment detail (Regs 160–162) ----------
  const ADDED_STORE = "beehive-added-children-v1";
  function addedOffline() { try { return JSON.parse(localStorage.getItem(ADDED_STORE) || "[]"); } catch (e) { return []; } }
  const CONSENTS = ["Local outings and regular excursions", "Emergency medical treatment and ambulance", "Sunscreen", "Photos shared privately with the family"];
  function openAddChild() {
    const f = (label, control, opt) => '<label class="formField' + (opt && opt.wide ? " wide" : "") + '"><span class="formLabel">' + label + (opt && opt.req ? ' <b class="req">*</b>' : "") + "</span>" + control + (opt && opt.hint ? '<small class="muted">' + opt.hint + "</small>" : "") + "</label>";
    const txt = (id, ph, type) => '<input class="formControl" id="' + id + '" ' + (type ? 'type="' + type + '" ' : "") + 'placeholder="' + E(ph || "") + '" autocomplete="off">';
    const area = (id, ph) => '<textarea class="formControl" id="' + id + '" rows="2" placeholder="' + E(ph || "") + '"></textarea>';
    const group = (title, inner) => '<fieldset class="enrolGroup"><legend>' + title + '</legend><div class="formGrid">' + inner + "</div></fieldset>";
    openModal(
      '<div class="modalHead"><div><h2>Add a child</h2><p>The enrolment record: what Regs 160–162 ask you to keep for every child. Fields marked * are required.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<form id="addChildForm" class="enrolForm" onsubmit="event.preventDefault();Centre.saveChild()">' +
      group("Child",
        f("First name", txt("acFirst"), { req: true }) + f("Last name", txt("acLast"), { req: true }) +
        f("Date of birth", txt("acDob", "", "date"), { req: true }) + f("Start date", '<input class="formControl" id="acStart" type="date" value="' + iso(new Date()) + '">') +
        f("Gender (optional)", txt("acGender")) + f("Language spoken at home (optional)", txt("acLanguage")) +
        f("Days of care", '<div class="dayPicks" id="acDays">' + ALL_WEEK.map((d) => '<label><input type="checkbox" value="' + d + '" checked>' + d + "</label>").join("") + "</div>", { req: true, wide: true })) +
      group("Parents and guardians",
        f("Parent or guardian", txt("acP1Name", "Full name"), { req: true }) + f("Relationship", txt("acP1Rel", "e.g. Mother")) +
        f("Mobile", txt("acP1Phone", "", "tel"), { req: true }) + f("Email", txt("acP1Email", "", "email")) +
        f("Home address", txt("acAddress"), { wide: true }) +
        f("Second parent or guardian (optional)", txt("acP2Name", "Full name")) + f("Relationship", txt("acP2Rel")) +
        f("Mobile", txt("acP2Phone", "", "tel")) + f("Email", txt("acP2Email", "", "email")) +
        f("Court orders or parenting plans (optional)", area("acCourt", "Anything about who can collect or contact the child"), { wide: true })) +
      group("Emergency contact and collection",
        f("Emergency contact", txt("acEmergency", "Name · phone"), { req: true, hint: "Someone other than the parents if possible." }) +
        f("Authorised nominees for collection", txt("acNominees", "Names, separated by commas"), { hint: "Who can collect the child (Reg 160)." })) +
      group("Health",
        f("Doctor or medical service", txt("acDoctor", "Name · phone")) + f("Medicare number (optional)", txt("acMedicare")) +
        f("Allergies", txt("acAllergies", "e.g. Peanuts, or None")) + f("Medical conditions", txt("acConditions", "e.g. Asthma, or None"), { hint: "Anaphylaxis, asthma or diabetes needs a medical management plan (Reg 90)." }) +
        f("Medication", txt("acMedication", "Name, dose and when")) + f("Dietary needs", txt("acDietary", "e.g. Halal, dairy-free")) +
        f("Immunisation", '<select class="formControl" id="acImmunisation"><option>Up to date (history statement sighted)</option><option>Catch-up schedule</option><option>Not yet provided</option></select>') +
        f("Action plan on file", '<label class="checkLine"><input type="checkbox" id="acPlan"> A medical management plan has been provided</label>')) +
      group("Consents",
        '<div class="consentPicks wide">' + CONSENTS.map((c) => '<label class="checkLine"><input type="checkbox" value="' + E(c) + '"> ' + E(c) + "</label>").join("") + "</div>" +
        f("Anything else educators should know (optional)", area("acNotes", "Routines, comfort items, cultural needs"), { wide: true })) +
      '<div class="formActions"><button type="button" class="button" onclick="closeModal()">Cancel</button><button class="button primary" type="submit">Enrol child</button></div></form>',
      "wide"
    );
  }
  async function saveChild() {
    const v = (id) => ((document.getElementById(id) || {}).value || "").trim();
    const days = Array.from(document.querySelectorAll("#acDays input:checked")).map((x) => x.value);
    if (!v("acFirst") || !v("acLast")) return toast("Enter the child’s first and last name.");
    if (!v("acDob")) return toast("Enter the child’s date of birth.");
    if (v("acDob") > iso(new Date())) return toast("The date of birth can’t be in the future.");
    if (!days.length) return toast("Pick at least one day of care.");
    if (!v("acP1Name") || !v("acP1Phone")) return toast("Enter a parent or guardian’s name and mobile.");
    if (!v("acEmergency")) return toast("Enter an emergency contact.");
    for (const id of ["acP1Email", "acP2Email"]) if (v(id) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v(id))) return toast("That email address doesn’t look right.");
    const enrolment = {
      days, startDate: v("acStart"), gender: v("acGender"), language: v("acLanguage"), address: v("acAddress"), courtOrders: v("acCourt"),
      parents: [{ name: v("acP1Name"), relationship: v("acP1Rel"), phone: v("acP1Phone"), email: v("acP1Email") }, { name: v("acP2Name"), relationship: v("acP2Rel"), phone: v("acP2Phone"), email: v("acP2Email") }].filter((p) => p.name),
      nominees: v("acNominees") ? v("acNominees").split(",").map((x) => x.trim()).filter(Boolean) : [],
      doctor: v("acDoctor"), medicare: v("acMedicare"), allergies: v("acAllergies"), conditions: v("acConditions"), medication: v("acMedication"), dietary: v("acDietary"),
      immunisation: v("acImmunisation"), plan: !!(document.getElementById("acPlan") || {}).checked,
      consents: Array.from(document.querySelectorAll(".consentPicks input:checked")).map((x) => x.value), notes: v("acNotes"),
    };
    const rec = { first: v("acFirst"), last: v("acLast"), dob: v("acDob"), contact: v("acEmergency"), enrolment };
    const missing = [];
    if (/not yet/i.test(enrolment.immunisation)) missing.push("Immunisation history statement");
    if (/anaphyla|asthma|diabet/i.test(enrolment.conditions) && !enrolment.plan) missing.push("Medical management plan");
    let id;
    if (typeof LIVE !== "undefined" && LIVE) {
      closeModal();
      try { id = await Live.addChild(rec); } catch (e) { return; }
    } else {
      id = (rec.first + "-" + rec.last).toLowerCase().replace(/[^a-z]+/g, "-") + "-" + Date.now().toString(36);
      const kidRec = Object.assign({ id, first: rec.first, last: rec.last, dob: rec.dob, days, contact: rec.contact, nominees: enrolment.nominees, notes: enrolment.notes,
        allergies: none(enrolment.allergies), conditions: none(enrolment.conditions), medication: none(enrolment.medication), dietary: none(enrolment.dietary),
        plan: enrolment.plan, enrolment, missing });
      const list = addedOffline(); list.push(kidRec);
      try { localStorage.setItem(ADDED_STORE, JSON.stringify(list)); } catch (e) {}
      closeModal();
      render();
      toast(rec.first + " " + rec.last + " is enrolled." + (missing.length ? " Still needed: " + missing.join(", ").toLowerCase() + "." : ""));
    }
    if (id) setTimeout(() => openChild(id), 250);
  }

  // ---------- documents for a child, drafted with AI from an editable prompt ----------
  const DOC_STORE = "beehive-child-docs-v1";
  const offlineDocs = () => { try { return JSON.parse(localStorage.getItem(DOC_STORE) || "{}"); } catch (e) { return {}; } };
  const isLiveMode = () => typeof LIVE !== "undefined" && LIVE;
  const DOC_TYPES = {
    enrolment: ["Enrolment agreement", "Write an enrolment agreement between the centre and the parents for {child}: booked days ({days}), hours 6:30 am to 6:30 pm, fees charged on booked days including absences, 2 weeks’ written notice to change days or end care, the parent keeps medical and contact details current, only the parents or authorised nominees collect the child, and 14 days’ notice of policy or fee changes (Reg 172). Leave blanks for the daily fee."],
    fees: ["Fee schedule and payment agreement", "Write a fee schedule and payment agreement for {child}'s family: daily fee left as a blank, Child Care Subsidy applied to the gap fee, fortnightly direct debit in advance, late payment and late collection terms, and 14 days’ notice before fees change."],
    consent: ["Medical and authorisations consent", "Write a consent form for {child} covering: giving medication only with written authorisation for each dose, emergency medical treatment and ambulance transport, regular local outings, and collection by authorised nominees ({nominees}). Include tick boxes and signature lines."],
    risk: ["Medical risk minimisation plan", "Write a risk minimisation and communication plan for {child}, who has: {medical}. Cover the triggers to avoid at the centre, who on each shift is trained to respond, where the medication and action plan are kept, and how the centre and family will tell each other about changes (Reg 90)."],
    welcome: ["Welcome letter to the family", "Write a warm welcome letter to {parent} for {child}'s first day on {start}: what to bring, drop-off and pick-up, how we'll share their day, and who to contact with questions."],
    custom: ["Custom document", "Describe the document you need for {child}."],
  };
  function fillPrompt(k, tpl) {
    const en = k.enrolment || {};
    const med = [k.allergies && "allergy to " + k.allergies, k.conditions, k.medication && "medication: " + k.medication].filter(Boolean).join("; ") || "no medical needs recorded";
    return tpl.replace(/\{child\}/g, fullName(k)).replace(/\{days\}/g, (k.days || []).join(", ")).replace(/\{nominees\}/g, (k.nominees || []).join(", ") || "as listed on the enrolment record")
      .replace(/\{medical\}/g, med).replace(/\{parent\}/g, ((en.parents || [])[0] || {}).name || parentOf(k)).replace(/\{start\}/g, en.startDate ? fmtDate(en.startDate) : "their start date");
  }
  let docDraft = null; // { childId, type, title, body, prompt, ai }
  function openAiDoc(childId, type) {
    const k = children().find((x) => x.id === childId);
    if (!k) return;
    type = type || (k.conditions ? "risk" : "enrolment");
    const t = DOC_TYPES[type];
    openModal(
      '<div class="modalHead"><div><h2>Create a document for ' + E(k.first) + "</h2><p>Pick a document, change the instructions if you like, then draft it. You can edit the draft before saving.</p></div>" +
        '<button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection"><label class="formLabel" for="adType">Document</label><select class="formControl" id="adType" onchange="Centre.openAiDoc(\'' + E(k.id) + '\', this.value)">' +
        Object.entries(DOC_TYPES).map(([id, d]) => '<option value="' + id + '"' + (id === type ? " selected" : "") + ">" + E(d[0]) + "</option>").join("") + "</select>" +
        '<label class="formLabel" for="adPrompt">Instructions for the AI <small class="muted">(edit freely)</small></label><textarea class="formControl" id="adPrompt" rows="6">' + E(fillPrompt(k, t[1])) + "</textarea>" +
        '<div class="buttonRow" style="margin-top:10px"><button class="button primary" id="adGo" onclick="Centre.draftDoc(\'' + E(k.id) + "','" + type + '\')"><span data-icon="spark"></span>Draft with AI</button>' +
        '<button class="textButton" onclick="Centre.openChild(\'' + E(k.id) + '\')">Back to ' + E(k.first) + "</button></div></div>" +
      '<div id="adResult"></div>' +
      '<p class="footnote">' + (isLiveMode() ? "Claude drafts from the child’s record and your instructions. It leaves blanks rather than guessing; check every detail before you use it." : "Not signed in: beehive fills a built-in template instead of asking Claude.") + " Nothing is sent to the family.</p>",
      "wide"
    );
  }
  function templateDoc(k, type, prompt) {
    const centre = typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "the centre";
    const title = DOC_TYPES[type][0] + ": " + fullName(k);
    return { title, body: title + "\n\n" + centre + "\n\nChild: " + fullName(k) + (k.dob ? " (born " + fmtDate(k.dob) + ")" : "") + "\nDays of care: " + (k.days || []).join(", ") +
      "\n\nInstructions:\n" + prompt + "\n\n[Write the document here. Claude drafts it when you’re signed in.]\n\nSigned for the centre: ____________________   Date: ________\n\nSigned by the parent: ____________________   Date: ________" };
  }
  async function draftDoc(childId, type) {
    const k = children().find((x) => x.id === childId);
    const prompt = ((document.getElementById("adPrompt") || {}).value || "").trim();
    if (!k) return;
    if (prompt.length < 5) return toast("Say what the document should be.");
    const btn = document.getElementById("adGo"), out = document.getElementById("adResult");
    if (btn) { btn.disabled = true; btn.textContent = "Drafting…"; }
    let d, ai = false, note = "";
    try {
      if (typeof Assistant !== "undefined" && Assistant.aiReady()) {
        const en = Object.assign({}, k.enrolment || {}); delete en.medicare; // the AI doesn't need the Medicare number
        d = await Assistant.callAI({ mode: "document", prompt, centre: typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "", owner: typeof OWNER_NAME !== "undefined" ? OWNER_NAME : "",
          child: { name: fullName(k), dateOfBirth: k.dob, days: k.days, allergies: k.allergies, conditions: k.conditions, medication: k.medication, dietary: k.dietary, nominees: k.nominees, emergencyContact: k.contact, enrolment: en } });
        ai = true;
      } else d = templateDoc(k, type, prompt);
    } catch (e) {
      d = templateDoc(k, type, prompt);
      note = (e && e.message ? e.message : "Claude couldn’t answer") + " A blank template is shown instead.";
    }
    docDraft = { childId, type, prompt, ai };
    if (btn) { btn.disabled = false; btn.innerHTML = "Draft again"; }
    if (!out) return;
    out.innerHTML = '<div class="modalSection docDraft">' + (note ? '<p class="authError">' + E(note) + "</p>" : "") +
      '<label class="formLabel" for="adTitle">Title</label><input class="formControl" id="adTitle" value="' + E(d.title || DOC_TYPES[type][0]) + '">' +
      '<label class="formLabel" for="adBody">Document <small class="muted">(edit before saving)</small></label><textarea class="formControl docBody" id="adBody" rows="16">' + E(d.body || "") + "</textarea>" +
      '<div class="formActions"><button class="button" onclick="Centre.downloadDraft()"><span data-icon="download"></span>Download PDF</button><button class="button primary" onclick="Centre.saveDraft()">Save to ' + E(k.first) + "’s file</button></div></div>";
    if (typeof fillIcons === "function") fillIcons(out);
  }
  function currentDraft() {
    return { title: ((document.getElementById("adTitle") || {}).value || "").trim() || "Document", body: (document.getElementById("adBody") || {}).value || "" };
  }
  async function saveDraft() {
    if (!docDraft) return;
    const d = Object.assign(currentDraft(), { prompt: docDraft.prompt, ai: docDraft.ai });
    if (!d.body.trim()) return toast("The document is empty.");
    if (isLiveMode()) { try { await Live.saveChildDocument(docDraft.childId, d); } catch (e) { return; } }
    else {
      const all = offlineDocs();
      all[docDraft.childId] = [Object.assign({ id: "doc" + Date.now().toString(36), created_at: new Date().toISOString() }, d)].concat(all[docDraft.childId] || []);
      try { localStorage.setItem(DOC_STORE, JSON.stringify(all)); } catch (e) {}
      toast("Saved to the child’s file.");
    }
    openChild(docDraft.childId);
  }
  function pdfFor(title, body) {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) return null;
    const doc = new J({ unit: "mm", format: "a4" });
    let y = 20;
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.splitTextToSize(title, 174).forEach((l) => { doc.text(l, 18, y); y += 7; }); y += 3;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    String(body).split("\n").forEach((para) => {
      const ls = para.trim() ? doc.splitTextToSize(para, 174) : [""];
      ls.forEach((l) => { if (y > 280) { doc.addPage(); y = 20; } doc.text(l, 18, y); y += 5; });
    });
    return doc;
  }
  function downloadPdf(title, body) {
    const doc = pdfFor(title, body);
    if (!doc) return toast("Couldn’t build the PDF. Check your internet connection and try again.");
    doc.save(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf");
  }
  function downloadDraft() { const d = currentDraft(); downloadPdf(d.title, d.body); }
  let shownDocs = [], docsChild = null;
  async function showDocs(childId) {
    docsChild = childId;
    const list = isLiveMode() ? await Live.childDocuments(childId) : (offlineDocs()[childId] || []);
    shownDocs = list;
    const el = document.getElementById("childDocs");
    if (!el) return;
    el.innerHTML = list.length ? list.map((d, i) =>
      '<div class="docRow"><span class="pdfIcon">DOC</span><span class="rowMain"><b>' + E(d.title) + "</b><small>" + (d.drafted_by_ai || d.ai ? "Drafted with AI · " : "") + E(new Date(d.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })) + "</small></span>" +
      '<button class="textButton" onclick="Centre.viewDoc(' + i + ')">View</button><button class="textButton" onclick="Centre.downloadDoc(' + i + ')">PDF</button></div>').join("")
      : '<p class="muted small">No documents yet. Create one with AI: an agreement, a consent, a medical plan or a welcome letter.</p>';
  }
  function viewDoc(i) {
    const d = shownDocs[i];
    if (!d) return;
    openModal('<div class="modalHead"><div><h2>' + E(d.title) + '</h2></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection docView">' + E(d.body).replace(/\n/g, "<br>") + "</div>" +
      '<div class="formActions"><button class="button" onclick="Centre.backToChild()">Back</button><button class="button primary" onclick="Centre.downloadDoc(' + i + ')"><span data-icon="download"></span>Download PDF</button></div>', "wide");
  }
  function backToChild() { if (docsChild) openChild(docsChild); else closeModal(); }
  function downloadDoc(i) { const d = shownDocs[i]; if (d) downloadPdf(d.title, d.body); }

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
    line("Child: " + k.first + " " + k.last + "    Date of birth: " + (k.dob ? new Date(k.dob + "T00:00:00").toLocaleDateString("en-AU") : "—"), 10, true, 1);
    line("Days of care: " + k.days.join(", ") + "    Hours: 6:30 am to 6:30 pm", 10, true, 5);
    const clauses = cid === "enrolment" ? [
      ["1. Care", "The Service will provide education and care in line with the Education and Care Services National Law and Regulations, the National Quality Framework and the Service’s policies, which the Parent has been given access to."],
      ["2. Booked days", "Fees apply to booked days, including public holidays and absences, unless the Service closes. Changes to booked days need 2 weeks’ written notice."],
      ["3. Health and wellbeing", "The Parent will keep the child’s medical, allergy and immunisation details current and tell the Service of any change straight away. Medical details recorded: " + ([k.allergies && "allergy to " + k.allergies.toLowerCase(), k.conditions, k.dietary && k.dietary.toLowerCase()].filter(Boolean).join("; ") || "none") + "."],
      ["4. Collection", "Only the Parent or an authorised nominee" + ((k.nominees || []).length ? " (" + k.nominees.join(", ") + ")" : " recorded on the enrolment form") + " may collect the child. Photo ID may be requested."],
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
      ["4. Collection", "Authorised nominees: " + ((k.nominees || []).join(", ") || "as listed on the enrolment record") + " (Reg 160)."],
      ["5. Photos", "Photos of the child may be shared privately with the family through the beehive family app only."],
    ];
    const ams = (k.amendments || []).filter((a) => a.contract === cid);
    if (ams.length) clauses.push(["Amendments", ams.map((a) => fmtDate(a.on) + ": " + describe(a) + (a.signedOn ? " (signed " + fmtDate(a.signedOn) + ")" : " (awaiting the Parent’s signature)")).join("  ")]);
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
      '<div class="formActions"><button class="button" onclick="Centre.openContracts(\'' + E(k.id) + '\')">Back to contracts</button><a class="button primary" href="' + url + '" download="' + file + '"><span data-icon="download"></span>Download PDF</a></div>', "wide"
    );
  }
  function search(v) { childQuery = v; render(); const el = document.querySelector(".childSearch"); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }

  // Daily sheet
  function sheetHtml(s, forPrint) {
    const centre = typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "the centre";
    return (
      (forPrint ? "<h1>" + E(centre) + ": daily sheet</h1><p>" + E(fmtDay(s.day)) + ". Prepared by beehive " + E(new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })) + ".</p>" : "") +
      (s.flags.length
        ? '<div class="' + (forPrint ? "printFlags" : "callout") + '"><div><b>Sort out before the doors open (' + s.flags.length + ")</b><ul class=\"rosterGapList\">" + s.flags.map((f) => "<li>" + E(f) + "</li>").join("") + "</ul></div></div>"
        : '<p class="' + (forPrint ? "" : "muted") + '">Nothing to fix: the centre is in ratio with trained educators on shift.</p>') +
      '<section class="' + (forPrint ? "printRoom" : "section") + '"><div class="sectionHead"><h2>Today<span class="count">' + s.kids.length + " children · " + s.eds.length + " educators</span></h2><p>Ratios by age group need " + s.needed + " educators</p></div>" +
        '<div class="sheetCols"><div><h3>Children</h3><table class="staffTable sheetTable"><tbody>' +
          (s.kids.map((k) => "<tr><td><b>" + E(k.first + " " + k.last) + "</b>" + (alertText(k) ? '<br><small class="sheetAlert">' + E(alertText(k)) + (k.medication ? " · " + E(k.medication) : "") + "</small>" : "") + "</td><td class=\"sheetSign\">In ____ Out ____</td></tr>").join("") || '<tr><td colspan="2">No children booked.</td></tr>') +
        '</tbody></table></div><div><h3>Educators</h3><table class="staffTable sheetTable"><tbody>' +
          (s.eds.map((x) => "<tr><td><b>" + E(x.e.name) + "</b><br><small>" + E(x.start + " – " + x.end) + (x.firstAid && x.wwcc ? " · first aid cover" : "") + (!x.wwcc ? " · WWCC not current" : "") + "</small></td></tr>").join("") || "<tr><td>No educators rostered.</td></tr>") +
        "</tbody></table></div></div></section>" +
      (forPrint ? '<p class="printDisclaimer">Generated from beehive records. Keep the signed sheet with your attendance records (Reg 158).</p>' : "")
    );
  }
  function dailyPage() {
    const day = sheetDay || nextWeekday();
    const s = buildSheet(day);
    return (
      header("Daily sheet", "beehive prepares this every morning: who’s booked in, who’s on shift, medical alerts and ratios for " + fmtDay(day) + ".",
        '<input class="formControl sheetDate" type="date" value="' + day + '" onchange="Centre.setDay(this.value)" aria-label="Day"><button class="button primary" onclick="Centre.print()"><span data-icon="download"></span>Print or save as PDF</button>') +
      '<div class="rosterSummary"><div><b class="num">' + s.kids.length + "</b><small>Children booked</small></div><div><b class=\"num\">" + s.eds.length + "</b><small>Educators on shift</small></div>" +
      '<div><b class="num">' + s.kids.filter((k) => alertText(k)).length + "</b><small>Medical or dietary alerts</small></div><div><b class=\"num " + (s.flags.length ? "bad" : "") + '">' + s.flags.length + "</b><small>To sort out</small></div></div>" +
      sheetHtml(s, false) +
      '<p class="footnote">' + (typeof LIVE !== "undefined" && LIVE ? "" : "Offline demo: sample children and shifts. ") + "Ratios follow the NSW educator-to-child ratios (Regs 123 and 271): 1:4 under 2, 1:5 from 2 to 3, 1:10 from 3 to preschool age. Each child counts towards their own age group.</p>"
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
    const alerts = s.kids.filter((k) => alertText(k));
    return '<div class="sheetRooms"><div class="sheetRoom"><b>Today</b><small>' + s.kids.length + " children · " + s.eds.length + " educators · " + s.needed + " needed by ratio</small>" +
      (alerts.length ? '<small class="sheetAlert">' + alerts.map((k) => k.first + " (" + (k.allergies || k.conditions || k.dietary) + ")").join(", ") + "</small>" : "") + "</div></div>" +
      (s.flags.length ? '<ul class="rosterGapList sheetFlags">' + s.flags.slice(0, 2).map((f) => "<li>" + E(f) + "</li>").join("") + (s.flags.length > 2 ? "<li>" + (s.flags.length - 2) + " more on the full sheet</li>" : "") + "</ul>" : '<p class="muted small">Nothing to sort out: the centre is in ratio with trained educators on shift.</p>');
  }
  // Numbers for the daily sheet cell on the Overview.
  function sheetStats() {
    const day = nextWeekday(), s = buildSheet(day);
    return { day, dayLabel: new Date(day + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }),
      children: s.kids.length, educators: s.eds.length, needed: s.needed,
      alerts: s.kids.filter((k) => alertText(k)).length, flags: s.flags.length };
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
    const total = s.kids.length;
    openModal(
      '<div class="modalHead"><div><h2>Your daily sheet</h2><p>' + E(fmtDay(day)) + ". " + total + " children booked, " + s.flags.length + " thing" + (s.flags.length === 1 ? "" : "s") + ' to sort out.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection">' + sheetSummary(s) + "</div>" +
      '<div class="formActions"><button class="button" onclick="closeModal();Centre.openFull()">See the full sheet</button><button class="button primary" onclick="Centre.printDay(\'' + day + '\')"><span data-icon="download"></span>Print or save as PDF</button></div>' +
      '<p class="footnote">beehive shows this each time you sign in. It’s also on your Overview.</p>', "wide");
    if (typeof fillIcons === "function") fillIcons(document.getElementById("modalRoot"));
  }
  function openFull() { if (typeof Sheet !== "undefined") return Sheet.open(nextWeekday()); return openFullOld(); }
  function openFullOld() {
    const s = buildSheet(nextWeekday());
    openModal('<div class="modalHead"><div><h2>Daily sheet</h2><p>' + E(fmtDay(s.day)) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' + sheetHtml(s, false) +
      '<div class="formActions"><button class="button primary" onclick="Centre.printDay(\'' + s.day + '\')"><span data-icon="download"></span>Print or save as PDF</button></div>', "wide");
  }
  function printDay(day) { if (typeof Sheet !== "undefined") return Sheet.open(day); sheetDay = day; print(); }

  return { openAddChild, saveChild, openAiDoc, draftDoc, saveDraft, downloadDraft, viewDoc, downloadDoc, backToChild,
    sheetStats, page, openContract, openContracts, openAmend, saveAmend, markSigned, setTab, search, openChild, setDay, print, buildSheet, children, stats, overviewSection, popup, openFull, printDay };
})();
