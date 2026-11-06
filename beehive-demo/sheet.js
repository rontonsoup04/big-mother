// beehive daily sheet (Claude): today's children with their needs, today's educators, meals and activities,
// as a PDF the owner can read, change by asking Claude, and print.
//
// The children and educators come from beehive's records (Centre and Roster). Claude (api/sheet.js) writes the
// meals, with a safe alternative for each child whose allergy or diet rules a dish out, the activities for each
// room and the reminders. If Claude can't be reached, a built-in menu and activity plan is used instead.
// The sheet for each day is kept in this browser, so changes stay until the owner regenerates it.
const Sheet = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-daily-sheet-v1";
  let busy = false, note = "", day = null, lastUrl = "";

  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } };
  const saveAll = (all) => { try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) {} };
  const months = (dob) => { if (!dob) return null; const a = new Date(dob + "T00:00:00"), b = new Date(); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0); };
  const age = (dob) => { const m = months(dob); return m == null ? "" : m < 24 ? m + " months" : Math.floor(m / 12) + " yrs " + (m % 12) + " m"; };
  const fmtDay = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ---------- the day, from beehive's records ----------
  function dayData(d) {
    const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(d + "T00:00:00").getDay()];
    const kids = Centre.children().filter((k) => k.days.includes(dn));
    const eds = Roster.forDay(d);
    const rooms = Array.from(new Set(kids.map((k) => k.room).concat(eds.map((e) => e.room)))).filter(Boolean);
    return {
      day: d, weekday: dn, centre: typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "",
      rooms: rooms.map((room) => ({
        room,
        children: kids.filter((k) => k.room === room).map((k) => ({ id: k.id, name: k.first + " " + k.last, age: age(k.dob), age_months: months(k.dob),
          allergies: k.allergies || "", conditions: k.conditions || "", medication: k.medication || "", dietary: k.dietary || "", action_plan: !!k.plan,
          emergency_contact: k.contact || "", nominees: (k.nominees || []).join(", ") })),
        educators: eds.filter((e) => e.room === room).map((e) => ({ name: e.e.name, shift: e.start + " – " + e.end, first_aid: e.firstAid, qualification: Roster.profile(e.e).qual })),
      })),
    };
  }

  // ---------- built-in sheet (no AI) ----------
  const MENUS = {
    Mon: ["Banana and oat muffins, milk", "Chicken and vegetable risotto, cucumber sticks", "Fruit platter with cheese and crackers"],
    Tue: ["Wholemeal toast with avocado", "Beef and lentil bolognese with pasta, green beans", "Yoghurt with berries"],
    Wed: ["Pikelets with ricotta and fruit", "Fish and vegetable bake, rice", "Vegetable sticks with hummus"],
    Thu: ["Porridge with stewed apple", "Chicken, pumpkin and chickpea curry with rice", "Pear slices and wholemeal crackers"],
    Fri: ["Scrambled eggs on toast", "Vegetable fried rice with tofu", "Watermelon and cheese cubes"],
  };
  const SWAP = [[/egg/i, "egg-free version"], [/dairy|milk|cow/i, "dairy-free version with soy milk"], [/gluten|coeliac/i, "gluten-free version"], [/peanut|tree nut|nut/i, "nut-free (whole centre is nut-free)"], [/sesame/i, "no sesame or hummus"], [/vegetarian/i, "vegetarian option"], [/halal/i, "halal option"], [/pork/i, "no pork"], [/strawberr/i, "no strawberries"]];
  function builtin(dd) {
    const menu = MENUS[dd.weekday] || MENUS.Mon;
    const kids = dd.rooms.flatMap((r) => r.children);
    const alt = () => kids.filter((k) => k.allergies || k.dietary || /coeliac/i.test(k.conditions)).map((k) => {
      const t = [k.allergies, k.dietary, k.conditions].join(" ");
      return { child_id: k.id, swap: SWAP.filter(([re]) => re.test(t)).map(([, s]) => s).join(", ") || "check against their needs" };
    });
    const acts = (r) => {
      const young = r.children.some((k) => (k.age_months || 40) < 36);
      return young
        ? [["Morning", "Sensory water play", "Pouring, scooping and splashing with cups and funnels.", "Outcome 4: children are confident and involved learners"],
           ["After rest", "Story and song time", "Picture books and action songs about animals.", "Outcome 5: children are effective communicators"],
           ["Late afternoon", "Outdoor play", "Sandpit and ball games in the shade.", "Outcome 3: children have a strong sense of wellbeing"]]
        : [["Morning", "Building with blocks", "Small groups build a bridge and test it with toy cars.", "Outcome 4: children are confident and involved learners"],
           ["After rest", "Painting our families", "Children paint a picture of their family and tell the group about it.", "Outcome 1: children have a strong sense of identity"],
           ["Late afternoon", "Obstacle course", "Climbing, balancing and jumping outdoors.", "Outcome 3: children have a strong sense of wellbeing"]];
    };
    return {
      headline: kids.length + " children booked across " + dd.rooms.length + " rooms.",
      meals: [["Morning tea", "9:30 am"], ["Lunch", "11:30 am"], ["Afternoon tea", "2:30 pm"]].map(([meal, time], i) => ({ meal, time, menu: menu[i], alternatives: alt() })),
      activities: dd.rooms.flatMap((r) => acts(r).map(([time, title, description, learning_focus]) => ({ room: r.room, time, title, description, learning_focus }))),
      reminders: kids.filter((k) => k.medication).map((k) => k.name.split(" ")[0] + ": " + k.medication + (k.action_plan ? ". Action plan on the room wall." : ".")).concat(["Sun safety: hats and sunscreen before outdoor play."]),
      child_notes: [],
    };
  }

  // ---------- Claude ----------
  async function callClaude(body) {
    const res = await fetch("api/sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 404) throw Object.assign(new Error("Claude isn’t available on this copy of beehive."), { quiet: true });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Claude couldn’t answer (" + res.status + ").");
    return out;
  }
  async function generate(d) {
    const dd = dayData(d);
    const all = load();
    busy = true; note = ""; draw();
    let rec = { day: d, sheet: builtin(dd), source: "builtin", at: new Date().toISOString(), changes: [] };
    try { const r = await callClaude({ day: dd }); rec = { day: d, sheet: r.sheet, source: "claude", model: r.model, at: new Date().toISOString(), changes: [] }; }
    catch (e) { note = e.quiet ? "Built-in menu and activities (Claude isn’t available here)." : e.message + " Showing a built-in sheet instead."; }
    all[d] = rec; saveAll(all);
    busy = false; draw();
  }
  async function ask() {
    const box = document.getElementById("sheetAsk");
    const instruction = ((box || {}).value || "").trim();
    if (!instruction) return toast("Type what you’d like to change.");
    const all = load(), rec = all[day];
    if (!rec) return;
    busy = true; note = ""; draw();
    try {
      const r = await callClaude({ mode: "revise", day: dayData(day), sheet: rec.sheet, instruction });
      rec.sheet = r.sheet; rec.source = "claude"; rec.changes = (rec.changes || []).concat([{ at: new Date().toISOString(), instruction }]);
      all[day] = rec; saveAll(all);
      toast("Updated by Claude.");
    } catch (e) { note = "Couldn’t make that change: " + (e.message || e); }
    busy = false; draw();
  }

  // ---------- the PDF ----------
  function pdf(rec, dd) {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) return null;
    const s = rec.sheet;
    const doc = new J({ unit: "mm", format: "a4" });
    const kidById = Object.fromEntries(dd.rooms.flatMap((r) => r.children).map((k) => [k.id, k]));
    const first = (id) => (kidById[id] ? kidById[id].name.split(" ")[0] : id);
    let y = 16;
    const L = 14, W = 182;
    const page = (need) => { if (y + (need || 10) > 284) { doc.addPage(); y = 16; } };
    const text = (t, size, style, color, indent, gap) => {
      doc.setFont("helvetica", style || "normal"); doc.setFontSize(size || 9); doc.setTextColor.apply(doc, color || [30, 30, 30]);
      doc.splitTextToSize(String(t || ""), W - (indent || 0)).forEach((l) => { page(5); doc.text(l, L + (indent || 0), y); y += (size || 9) * 0.44; });
      y += gap == null ? 1.2 : gap;
    };
    const heading = (t) => { page(14); y += 2; doc.setFillColor(253, 243, 214); doc.rect(L, y - 4.5, W, 7, "F"); text(t, 11, "bold", [70, 50, 10], 2, 2.5); };
    const rule = () => { doc.setDrawColor(220); doc.line(L, y - 1, L + W, y - 1); };

    // header
    doc.setFillColor(192, 138, 34); doc.rect(0, 0, 210, 5, "F");
    text((dd.centre || "beehive") + " · Daily sheet", 16, "bold", [30, 30, 30], 0, 0.5);
    text(fmtDay(dd.day) + (s.headline ? "  ·  " + s.headline : ""), 9.5, "normal", [90, 90, 90], 0, 0.5);
    text("Prepared " + new Date(rec.at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) + " by " + (rec.source === "claude" ? "Claude for beehive" : "beehive") + ". Check against each child’s record and action plan.", 7.5, "italic", [130, 130, 130], 0, 3);

    if ((s.reminders || []).length) { heading("Reminders"); s.reminders.forEach((r) => text("•  " + r, 9, "normal", null, 2, 0.6)); y += 1; }

    heading("Meals");
    s.meals.forEach((m) => {
      page(12);
      text(m.meal + "  ·  " + m.time, 9.5, "bold", null, 2, 0.4);
      text(m.menu, 9, "normal", null, 2, 0.8);
      if (m.alternatives.length) text("Alternatives: " + m.alternatives.map((a) => first(a.child_id) + ": " + a.swap).join("   ·   "), 8, "normal", [150, 40, 30], 2, 1.6);
    });

    dd.rooms.forEach((r) => {
      heading(r.room + "  ·  " + r.children.length + " children  ·  " + r.educators.length + " educators");
      text("Educators: " + (r.educators.map((e) => e.name + " (" + e.shift + (e.first_aid ? ", first aid" : "") + ")").join(";  ") || "none rostered"), 8.5, "normal", [60, 60, 60], 2, 2);
      // children table
      page(10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(120);
      [["Child", 0], ["Age", 44], ["Allergies, medical and diet", 66], ["In", 158], ["Out", 171]].forEach(([h, x]) => doc.text(h, L + 2 + x, y));
      y += 2; rule(); y += 2.5;
      r.children.forEach((k) => {
        const needs = [k.allergies && "Allergy: " + k.allergies, k.conditions, k.dietary, k.medication && "Meds: " + k.medication].filter(Boolean).join(" · ");
        const n = (s.child_notes || []).filter((c) => c.child_id === k.id).map((c) => c.note).join(" ");
        const lines = doc.splitTextToSize((needs || "—") + (n ? "  Note: " + n : ""), 88);
        page(lines.length * 3.6 + 3);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(30); doc.text(k.name, L + 2, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80); doc.text(k.age || "", L + 46, y);
        doc.setTextColor.apply(doc, needs ? [150, 40, 30] : [140, 140, 140]); doc.text(lines, L + 68, y);
        doc.setDrawColor(190); doc.line(L + 160, y + 0.8, L + 169, y + 0.8); doc.line(L + 173, y + 0.8, L + 182, y + 0.8);
        y += Math.max(1, lines.length) * 3.6 + 1.6; rule(); y += 2.2;
      });
      // activities
      const acts = (s.activities || []).filter((a) => a.room === r.room);
      if (acts.length) {
        y += 1; text("Activities", 9, "bold", [70, 50, 10], 2, 0.6);
        acts.forEach((a) => { page(10); text(a.time + ": " + a.title, 8.8, "bold", null, 4, 0.3); text(a.description + (a.learning_focus ? "  (" + a.learning_focus + ")" : ""), 8, "normal", [80, 80, 80], 4, 1.2); });
      }
    });
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150); doc.text("Keep the signed sheet with your attendance records (Reg 158). Page " + i + " of " + n, L, 292); }
    return doc;
  }

  // ---------- the viewer ----------
  function open(d) {
    day = d || Centre.sheetStats().day;
    note = "";
    const rec = load()[day];
    draw();
    if (!rec) generate(day);
  }
  function draw() {
    const rec = load()[day];
    const dd = dayData(day);
    let frame = '<div class="sheetLoading"><span class="hx"></span>' + (busy ? (rec ? "Claude is updating the sheet…" : "Claude is writing today’s sheet…") : "Preparing…") + "</div>";
    if (rec && !busy) {
      const doc = pdf(rec, dd);
      if (doc) { if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(doc.output("blob")); frame = '<iframe class="pdfFrame sheetFrame" src="' + lastUrl + '#view=FitH" title="Daily sheet"></iframe>'; }
      else frame = '<p class="empty">Couldn’t build the PDF here.</p>';
    }
    const changes = rec && rec.changes && rec.changes.length ? '<div class="sheetChanges">' + rec.changes.slice(-3).map((c) => "<span>“" + E(c.instruction) + "”</span>").join("") + "</div>" : "";
    openModal(
      '<div class="modalHead"><div><h2>Daily sheet</h2><p>' + E(fmtDay(day)) + " · " + (rec ? (rec.source === "claude" ? "written by Claude" : "built-in") : "…") + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      frame +
      (note ? '<p class="muted small sheetNote">' + E(note) + "</p>" : "") + changes +
      '<form class="sheetAskForm" onsubmit="event.preventDefault();Sheet.ask()"><span class="aiMark" data-icon="spark"></span>' +
        '<input class="formControl" id="sheetAsk" placeholder="Ask Claude to change something, e.g. “make Friday lunch pasta” or “add that Leo goes home at 2 pm”" autocomplete="off"' + (busy || !rec ? " disabled" : "") + ">" +
        '<button class="button primary" ' + (busy || !rec ? "disabled" : "") + ">Change</button></form>" +
      '<div class="formActions"><button class="button" onclick="Sheet.regenerate()"' + (busy ? " disabled" : "") + '>Start again</button>' +
        (rec && !busy ? '<a class="button" href="' + lastUrl + '" download="daily-sheet-' + day + '.pdf"><span data-icon="download"></span>Download</a><button class="button primary" onclick="Sheet.print()">Print</button>' : "") + "</div>", "wide sheetModal"
    );
  }
  function regenerate() { if (!confirm("Write a fresh sheet? Your changes to this one will be lost.")) return; generate(day); }
  function print() {
    const rec = load()[day];
    const doc = rec && pdf(rec, dayData(day));
    if (!doc) return;
    doc.autoPrint();
    const w = window.open(URL.createObjectURL(doc.output("blob")), "_blank");
    if (!w) toast("Your browser blocked the print window. Use Download, then print the PDF.");
  }

  return { open, ask, regenerate, print, dayData, builtin, pdf };
})();
