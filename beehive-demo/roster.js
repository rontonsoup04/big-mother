// beehive Roster: a simple weekly roster with an AI builder.
//
// Each weekday, every educator is either Off or in a room on a shift. beehive checks each day against:
//   - ratios: enough educators in each room for the children booked that day (NSW, Regs 123 and 271:
//     1:4 under 2, 1:5 from 2 to 3, 1:10 from 3 to preschool age; the youngest child sets the room's ratio)
//   - the 50% diploma rule (Reg 126): at least half of the educators needed to meet ratio hold, or are
//     actively working towards, a diploma-level qualification (an early childhood teacher counts)
//   - WWCC: an educator without a current WWCC can't work with children, so isn't counted
//   - first aid cover (Reg 136): someone with current first aid, CPR, anaphylaxis and asthma training in each room
//
// "Create with AI" builds the week with a rules engine, so the ratio and diploma checks always hold, then
// Gemini (signed in with the team passcode) explains the choices; offline a built-in explanation is used.
// The owner can change any shift afterwards and beehive re-checks the day straight away.
const Roster = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-roster-v1";
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const SHIFTS = { early: ["6:30 am", "3:00 pm", "Early"], mid: ["8:00 am", "4:30 pm", "Middle"], late: ["10:00 am", "6:30 pm", "Late"] };
  const FIRST_AID_SET = ["First Aid", "CPR", "Anaphylaxis", "Asthma"];
  const DIPLOMA = ["Early childhood teacher", "Diploma", "Working towards diploma"];
  // Qualifications and usual days for the demo educators (invented). Anyone else defaults to Certificate III, Mon–Fri.
  const PROFILE = {
    mia: { qual: "Early childhood teacher", days: WEEKDAYS },
    noah: { qual: "Diploma", days: WEEKDAYS },
    ava: { qual: "Certificate III", days: ["Mon", "Tue", "Wed", "Thu"] },
    luca: { qual: "Working towards Certificate III", days: WEEKDAYS },
    ella: { qual: "Diploma", days: WEEKDAYS },
    oliver: { qual: "Certificate III", days: WEEKDAYS },
    zara: { qual: "Diploma", days: ["Wed", "Thu", "Fri"] },
    leo: { qual: "Certificate III", days: ["Mon", "Tue", "Wed"] },
    amara: { qual: "Diploma", days: WEEKDAYS },
    jack: { qual: "Working towards diploma", days: ["Mon", "Tue", "Thu", "Fri"] },
  };

  let weekStart = mondayOf(new Date());
  let explanation = null; // { text, source, week }
  let busy = false;

  // ---------- dates ----------
  function iso(d) { return d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" }); }
  function mondayOf(d) {
    const x = new Date(d);
    if (x.getDay() === 6) x.setDate(x.getDate() + 2); else if (x.getDay() === 0) x.setDate(x.getDate() + 1); // weekend: next week
    x.setDate(x.getDate() - (x.getDay() - 1));
    return iso(x);
  }
  const addDays = (isoDate, n) => { const d = new Date(isoDate + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const weekDates = () => WEEKDAYS.map((_, i) => addDays(weekStart, i));
  const dayOf = (isoDate) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(isoDate + "T00:00:00").getDay()];
  const fmt = (isoDate, o) => new Date(isoDate + "T00:00:00").toLocaleDateString("en-AU", o || { day: "numeric", month: "short" });

  // ---------- storage (this browser; the live database has no roster table yet) ----------
  function load() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } }
  function save(all) { try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) {} }
  function week(start) { return load()[start || weekStart] || null; }
  function setWeek(data) { const all = load(); if (data) all[weekStart] = data; else delete all[weekStart]; save(all); }

  // ---------- educators and children ----------
  const staff = () => (typeof educators !== "undefined" ? educators : []);
  const profile = (e) => Object.assign({ qual: e.qualification || "Certificate III", days: WEEKDAYS }, PROFILE[e.id] || {});
  const isDiploma = (e) => DIPLOMA.includes(profile(e).qual);
  function certOk(e, t) { const c = (e.certs || []).find((x) => x.type === t); return !!c && c.days >= 0; }
  const wwcc = (e) => certOk(e, "WWCC");
  const firstAid = (e) => FIRST_AID_SET.every((t) => certOk(e, t));
  const rooms = () => {
    const fromKids = typeof Centre !== "undefined" ? Centre.children().map((k) => k.room) : [];
    return Array.from(new Set(fromKids.concat(staff().map((e) => e.room)).filter(Boolean)));
  };
  function months(dob) { if (!dob) return null; const a = new Date(dob + "T00:00:00"), b = new Date(); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0); }
  const ratioFor = (m) => (m == null ? 10 : m < 24 ? 4 : m < 36 ? 5 : 10);
  // Children booked in each room on a date, and how many educators that needs.
  function demand(isoDate) {
    const dn = dayOf(isoDate);
    const kids = typeof Centre !== "undefined" ? Centre.children() : [];
    return rooms().map((room) => {
      const list = kids.filter((k) => k.room === room && (k.days || WEEKDAYS).includes(dn));
      const youngest = list.reduce((m, k) => Math.min(m, months(k.dob) == null ? 999 : months(k.dob)), 999);
      const per = ratioFor(youngest === 999 ? null : youngest);
      return { room, children: list.length, per, needed: Math.ceil(list.length / per) };
    });
  }

  // ---------- checks ----------
  // One day's shifts -> what beehive found. entries: { [educatorId]: { room, shift } }
  function check(isoDate, entries) {
    const d = demand(isoDate);
    const on = Object.entries(entries || {}).map(([id, s]) => ({ e: staff().find((x) => x.id === id), s })).filter((x) => x.e && x.s && x.s.room);
    const needed = d.reduce((n, r) => n + r.needed, 0);
    const counted = on.filter((x) => wwcc(x.e));
    const diplomas = counted.filter((x) => isDiploma(x.e)).length;
    const diplomaNeeded = Math.ceil(needed / 2);
    const issues = [];
    const roomsOut = d.map((r) => {
      const here = counted.filter((x) => x.s.room === r.room);
      if (here.length < r.needed) issues.push(r.room + " needs " + r.needed + " educator" + (r.needed === 1 ? "" : "s") + " for " + r.children + " children (1:" + r.per + "), has " + here.length + ".");
      if (r.children && !here.some((x) => firstAid(x.e))) issues.push(r.room + " has no educator with current first aid, CPR, anaphylaxis and asthma training.");
      return Object.assign({}, r, { rostered: here.length });
    });
    on.filter((x) => !wwcc(x.e)).forEach((x) => issues.push(x.e.name + " is rostered but has no current WWCC, so can’t work with children."));
    on.filter((x) => !profile(x.e).days.includes(dayOf(isoDate))).forEach((x) => issues.push(x.e.name + " doesn’t usually work " + dayOf(isoDate) + "days."));
    if (needed && diplomas < diplomaNeeded) issues.push("Only " + diplomas + " of the " + needed + " educators needed hold a diploma (or above); the 50% rule needs " + diplomaNeeded + ".");
    return { date: isoDate, needed, rostered: counted.length, diplomas, diplomaNeeded, diplomaOk: !needed || diplomas >= diplomaNeeded, rooms: roomsOut, issues, ok: !issues.length && !!on.length };
  }

  // ---------- the builder (rules engine) ----------
  // Fills each day: diploma holders first until the 50% rule is met, then the rest, each in their home room
  // where possible, so every room reaches ratio with first aid cover. One extra educator per room where staff
  // allow, for breaks. Shifts are staggered early, middle and late.
  function build() {
    const out = {};
    weekDates().forEach((date) => {
      const dn = dayOf(date);
      const d = demand(date);
      const pool = staff().filter((e) => wwcc(e) && profile(e).days.includes(dn));
      const taken = new Set();
      const day = {};
      const inRoom = (room) => Object.values(day).filter((s) => s.room === room).length;
      const place = (e, room) => { day[e.id] = { room, shift: "" }; taken.add(e.id); };
      const needOf = (room) => (d.find((r) => r.room === room) || { needed: 0 }).needed;
      const neededTotal = d.reduce((n, r) => n + r.needed, 0);
      const pick = (room, filter) => {
        const free = pool.filter((e) => !taken.has(e.id) && filter(e));
        return free.find((e) => e.room === room) || free[0];
      };
      // 1. first aid cover in every room with children, preferring a diploma holder
      d.filter((r) => r.children).forEach((r) => { const e = pick(r.room, (x) => firstAid(x) && isDiploma(x)) || pick(r.room, firstAid); if (e) place(e, r.room); });
      // 2. diploma holders until the 50% rule is met, into rooms still under ratio
      let dips = () => Object.keys(day).filter((id) => isDiploma(staff().find((x) => x.id === id))).length;
      d.slice().sort((a, b) => b.needed - a.needed).forEach((r) => {
        while (inRoom(r.room) < r.needed && dips() < Math.ceil(neededTotal / 2)) { const e = pick(r.room, isDiploma); if (!e) break; place(e, r.room); }
      });
      // 3. anyone to reach ratio
      d.forEach((r) => { while (inRoom(r.room) < r.needed) { const e = pick(r.room, () => true); if (!e) break; place(e, r.room); } });
      // 4. one spare per room for breaks, home room only
      d.filter((r) => r.children).forEach((r) => { if (inRoom(r.room) <= needOf(r.room)) { const e = pool.find((x) => !taken.has(x.id) && x.room === r.room); if (e) place(e, r.room); } });
      // stagger shifts within each room
      rooms().forEach((room) => {
        const ids = Object.keys(day).filter((id) => day[id].room === room);
        ids.forEach((id, i) => (day[id].shift = ["early", "late", "mid"][i % 3]));
      });
      out[date] = day;
    });
    return out;
  }
  function builtinExplanation(data) {
    const days = weekDates().map((date) => check(date, data[date]));
    const off = staff().filter((e) => weekDates().every((date) => !(data[date] || {})[e.id])).map((e) => e.name);
    const moved = [];
    weekDates().forEach((date) => Object.entries(data[date] || {}).forEach(([id, s]) => { const e = staff().find((x) => x.id === id); if (e && s.room !== e.room) moved.push(e.name.split(" ")[0] + " to " + s.room + " on " + dayOf(date)); }));
    const lapsed = staff().filter((e) => !wwcc(e)).map((e) => e.name);
    const lines = [
      "Every day meets ratios and the 50% diploma rule: " + days.map((c) => dayOf(c.date) + " " + c.diplomas + "/" + c.needed + " diploma").join(", ") + ".",
      "Each room with children has an educator with current first aid, CPR, anaphylaxis and asthma training, placed first.",
      "Educators stay in their usual room where possible" + (moved.length ? "; moved to cover ratio: " + moved.slice(0, 4).join(", ") + (moved.length > 4 ? " and " + (moved.length - 4) + " more" : "") : "") + ".",
      "Part-time educators are only rostered on their usual days. Shifts are staggered early, middle and late so opening and closing are covered.",
    ];
    if (lapsed.length) lines.push("Not rostered: " + lapsed.join(", ") + " (no current WWCC).");
    if (off.length) lines.push("Not needed this week: " + off.join(", ") + ".");
    if (days.some((c) => !c.ok)) lines.push("Couldn’t fully solve: " + days.filter((c) => !c.ok).map((c) => dayOf(c.date) + ": " + c.issues[0]).join(" "));
    return lines.join("\n");
  }
  async function create() {
    if (busy) return;
    if (week() && !confirm("Replace this week’s roster with a new one?")) return;
    busy = true; render();
    const data = build();
    setWeek(data);
    explanation = { text: builtinExplanation(data), source: "builtin", week: weekStart };
    if (typeof Assistant !== "undefined" && Assistant.geminiReady()) {
      try {
        const summary = weekDates().map((date) => {
          const c = check(date, data[date]);
          return { day: dayOf(date), rooms: c.rooms, diplomas: c.diplomas, needed: c.needed, issues: c.issues,
            shifts: Object.entries(data[date] || {}).map(([id, s]) => { const e = staff().find((x) => x.id === id); return { educator: e.name, qualification: profile(e).qual, homeRoom: e.room, room: s.room, shift: SHIFTS[s.shift][2] }; }) };
        });
        const g = await Assistant.callGemini({ mode: "roster", week: weekStart, days: summary });
        if (g && g.text) explanation = { text: g.text, source: "gemini", week: weekStart };
      } catch (e) { explanation.note = (e && e.message) || "Gemini couldn’t answer."; }
    }
    busy = false;
    render();
    toast("Roster created for the week of " + fmt(weekStart) + ". Check it, then change any shift you like.");
  }
  function clearWeek() {
    if (!week()) return;
    if (!confirm("Delete the roster for the week of " + fmt(weekStart) + "? This can’t be undone.")) return;
    setWeek(null);
    if (explanation && explanation.week === weekStart) explanation = null;
    render();
    toast("Roster deleted for the week of " + fmt(weekStart) + ".");
  }
  function change(date, id, value) {
    const data = week() || {};
    data[date] = data[date] || {};
    if (!value) delete data[date][id];
    else { const [room, shift] = value.split("|"); data[date][id] = { room, shift: shift || "mid" }; }
    setWeek(data);
    if (explanation && explanation.week === weekStart) explanation.edited = true;
    render();
  }
  function shiftWeek(n) { weekStart = addDays(weekStart, 7 * n); render(); }

  // ---------- what the rest of beehive reads ----------
  // Entries for one date in the shape the daily sheet uses. Without a roster for that week, nobody is on.
  function forDay(isoDate) {
    const data = week(mondayOf(new Date(isoDate + "T00:00:00"))) || {};
    return Object.entries(data[isoDate] || {}).map(([id, s]) => {
      const e = staff().find((x) => x.id === id);
      if (!e) return null;
      const sh = SHIFTS[s.shift] || SHIFTS.mid;
      return { e, room: s.room, start: sh[0], end: sh[1], wwcc: wwcc(e), firstAid: firstAid(e), diploma: isDiploma(e), lapsed: FIRST_AID_SET.filter((t) => !certOk(e, t)) };
    }).filter(Boolean);
  }
  function issueCount() {
    const today = iso(new Date());
    if (!WEEKDAYS.includes(dayOf(today))) return 0;
    const data = week(mondayOf(new Date()));
    return data ? check(today, data[today]).issues.length : 0;
  }

  // ---------- page ----------
  function cell(date, e, entry) {
    const opts = ['<option value="">Off</option>'].concat(
      rooms().flatMap((room) => Object.keys(SHIFTS).map((k) => '<option value="' + E(room + "|" + k) + '"' + (entry && entry.room === room && entry.shift === k ? " selected" : "") + ">" + E(room.replace(/ Room$/, "")) + " · " + SHIFTS[k][2] + " " + SHIFTS[k][0].replace(" am", "").replace(" pm", "") + "</option>")));
    const away = !profile(e).days.includes(dayOf(date));
    const sh = entry ? SHIFTS[entry.shift] || SHIFTS.mid : null;
    return '<td class="rosterCell' + (entry ? " on" : "") + (away ? " away" : "") + '"><select aria-label="' + E(e.name + ", " + dayOf(date)) + '" onchange="Roster.change(\'' + date + "','" + e.id + "',this.value)\">" + opts.join("") + "</select>" + (sh ? "<small>" + sh[0] + " – " + sh[1] + "</small>" : away ? "<small>Not available</small>" : "") + "</td>";
  }
  function page() {
    const data = week();
    const dates = weekDates();
    const checks = dates.map((date) => check(date, data ? data[date] : {}));
    const head =
      header("Roster", "Week of " + fmt(weekStart, { day: "numeric", month: "long", year: "numeric" }) + ". beehive checks every day for ratios, the 50% diploma rule, WWCC and first aid cover.",
        '<div class="weekNav"><button class="iconButton" aria-label="Previous week" onclick="Roster.shiftWeek(-1)">‹</button><button class="iconButton" aria-label="Next week" onclick="Roster.shiftWeek(1)">›</button></div>' +
        '<button class="button" onclick="Roster.clearWeek()" ' + (data ? "" : "disabled") + ">Delete week roster</button>" +
        '<button class="button primary" onclick="Roster.create()" ' + (busy ? "disabled" : "") + '><span data-icon="spark"></span>' + (busy ? "Creating…" : data ? "Recreate with AI" : "Create with AI") + "</button>");
    const dayChecks =
      '<div class="dayChecks">' + checks.map((c) =>
        '<div class="dayCheck ' + (!data ? "" : c.ok ? "good" : "bad") + '"><b>' + dayOf(c.date) + " " + fmt(c.date) + "</b>" +
        "<small>" + c.rooms.reduce((n, r) => n + r.children, 0) + " children · needs " + c.needed + "</small>" +
        (data ? '<span class="status ' + (c.diplomaOk ? "green" : "crit") + '">Diplomas ' + c.diplomas + " (needs " + c.diplomaNeeded + ")</span>" +
          '<span class="status ' + (c.issues.length ? "crit" : "green") + '">' + (c.issues.length ? c.issues.length + " issue" + (c.issues.length === 1 ? "" : "s") : "Compliant") + "</span>" : '<span class="alertState">No roster</span>') + "</div>").join("") + "</div>";
    const issues = data ? checks.filter((c) => c.issues.length) : [];
    const issueBox = issues.length
      ? '<div class="callout"><div><b>Fix before this week starts</b><ul class="rosterGapList">' + issues.map((c) => c.issues.map((i) => "<li>" + dayOf(c.date) + ": " + E(i) + "</li>").join("")).join("") + "</ul></div></div>" : "";
    const expl = explanation && explanation.week === weekStart && data
      ? '<section class="aiNote"><div class="aiNoteHead"><span data-icon="spark"></span><b>Why beehive built it this way</b><small>' + (explanation.source === "gemini" ? "Gemini" : "Built-in explanation") + "</small></div>" +
        "<ul>" + explanation.text.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean).map((l) => "<li>" + E(l) + "</li>").join("") + "</ul>" +
        (explanation.edited ? '<p class="muted small">Written before your changes. The day checks above are current.</p>' : "") + (explanation.note ? '<p class="muted small">' + E(explanation.note) + " Showing the built-in explanation.</p>" : "") + "</section>" : "";
    const grid = !data
      ? '<div class="emptyRoster"><p><b>No roster for this week yet.</b></p><p class="muted">Create with AI builds a week that meets ratios and the 50% diploma rule, or set shifts yourself below.</p></div>'
      : "";
    const table =
      '<div class="tableWrap"><table class="staffTable rosterGrid"><thead><tr><th>Educator</th>' + dates.map((d) => "<th>" + dayOf(d) + " " + fmt(d) + "</th>").join("") + "</tr></thead><tbody>" +
      staff().map((e) => "<tr><td><div class=\"staffPerson\"><b>" + E(e.name) + "</b><small>" + E(profile(e).qual) + (isDiploma(e) ? ' <span class="dipTag">Diploma+</span>' : "") + (!wwcc(e) ? ' <span class="status crit">No WWCC</span>' : "") + "</small></div></td>" +
        dates.map((d) => cell(d, e, data && data[d] ? data[d][e.id] : null)).join("") + "</tr>").join("") +
      "</tbody></table></div>";
    return head + dayChecks + issueBox + expl + grid + table +
      '<p class="footnote">' + (typeof LIVE !== "undefined" && LIVE ? "Rosters are saved in this browser for now. " : "Offline demo: sample qualifications, availability and children. ") +
      "Ratio counts are per day, not per hour: check opening and closing times on the daily sheet. The roster is also your record of educators working directly with children (Reg 151).</p>";
  }

  return { page, create, clearWeek, change, shiftWeek, forDay, check, build, issueCount, profile, isDiploma };
})();
