// beehive Roster: a simple weekly roster with an AI builder.
//
// Each weekday, every educator is either Off or on a shift. The centre is one group (no rooms). beehive checks each day against:
//   - ratios: enough educators on shift for the children booked that day (NSW, Regs 123 and 271:
//     1:4 under 2, 1:5 from 2 to 3, 1:10 from 3 to preschool age; each child counts towards their own age group's ratio)
//   - the 50% diploma rule (Reg 126): at least half of the educators needed to meet ratio hold, or are
//     actively working towards, a diploma-level qualification (an early childhood teacher counts)
//   - WWCC: an educator without a current WWCC can't work with children, so isn't counted
//   - first aid cover (Reg 136): someone on shift with current first aid, CPR, anaphylaxis and asthma training
//
// Each week starts empty. "Fill gaps with AI" fills only the week on screen, with a rules engine, so the ratio and
// diploma checks always hold; shifts set by hand are kept. Educators with an expired or missing credential are left
// off until it's renewed.
const Roster = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-roster-v2"; // v2: weeks start empty (v1 held weeks the old auto-roster built)
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const SHIFTS = { early: ["6:30 am", "3:00 pm", "Early"], mid: ["8:00 am", "4:30 pm", "Middle"], late: ["10:00 am", "6:30 pm", "Late"] };
  const FIRST_AID_SET = ["First Aid", "CPR", "Anaphylaxis", "Asthma"];
  const DIPLOMA = ["Early childhood teacher", "Diploma", "Working towards diploma"];
  // Qualifications and usual days for the demo educators (invented). Anyone else defaults to Certificate III, Mon–Fri.
  const PROFILE = {
    mia: { qual: "Early childhood teacher", days: WEEKDAYS },
    noah: { qual: "Diploma", days: WEEKDAYS },
    ava: { qual: "Diploma", days: ["Mon", "Tue", "Wed", "Thu"] },
    luca: { qual: "Working towards Certificate III", days: WEEKDAYS },
    ella: { qual: "Diploma", days: WEEKDAYS },
    oliver: { qual: "Diploma", days: WEEKDAYS },
    zara: { qual: "Diploma", days: ["Wed", "Thu", "Fri"] },
    leo: { qual: "Certificate III", days: ["Mon", "Tue", "Wed"] },
    amara: { qual: "Diploma", days: WEEKDAYS },
    jack: { qual: "Certificate III", days: ["Mon", "Tue", "Thu", "Fri"] },
  };

  let weekStart = mondayOf(new Date());

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
  function week(start) {
    const w = load()[start || weekStart] || null;
    const ids = new Set(staff().map((e) => e.id));
    if (!w || !ids.size) return w;
    // drop shifts for anyone who isn't a current educator: they'd count as cover that isn't there
    return Object.fromEntries(Object.entries(w).map(([d, day]) => [d, Object.fromEntries(Object.entries(day || {}).filter(([id]) => ids.has(id)))]));
  }
  function setWeek(data) { const all = load(); if (data) all[weekStart] = data; else delete all[weekStart]; save(all); }
  // ---------- educators and children ----------
  const staff = () => (typeof educators !== "undefined" ? educators : []);
  // Demo profiles match by id offline and by first name in live mode (live ids are database ids).
  // Days come from Availability when the owner or the educator has set them, otherwise from the usual days on file.
  const profile = (e) => {
    const p = Object.assign({ qual: e.qualification || "Certificate III", days: e.days && e.days.length ? e.days : WEEKDAYS }, PROFILE[e.id] || PROFILE[String(e.name || "").split(" ")[0].toLowerCase()] || {});
    const set = typeof Availability !== "undefined" ? Availability.days(e.id) : null;
    return set ? Object.assign({}, p, { days: set }) : p;
  };
  const isDiploma = (e) => DIPLOMA.includes(profile(e).qual);
  function certOk(e, t) { const c = (e.certs || []).find((x) => x.type === t); return !!c && c.days >= 0; }
  const wwcc = (e) => certOk(e, "WWCC");
  const firstAid = (e) => FIRST_AID_SET.every((t) => certOk(e, t));
  // Anyone with an expired or missing credential is kept off the roster until it's renewed.
  const blockers = (e) => ["WWCC"].concat(FIRST_AID_SET).filter((t) => !certOk(e, t));
  const rosterable = (e) => !blockers(e).length;

  function months(dob) { if (!dob) return null; const a = new Date(dob + "T00:00:00"), b = new Date(); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0); }
  const ratioFor = (m) => (m == null ? 10 : m < 24 ? 4 : m < 36 ? 5 : 10);
  // Children booked across the centre on a date, and how many educators that needs: each age group's ratio
  // (1:4, 1:5, 1:10) applied to the children in it, added up and rounded up.
  function demand(isoDate) {
    const dn = dayOf(isoDate);
    const kids = (typeof Centre !== "undefined" ? Centre.children() : []).filter((k) => (k.days || WEEKDAYS).includes(dn));
    const load = kids.reduce((n, k) => n + 1 / ratioFor(months(k.dob)), 0);
    return { children: kids.length, needed: Math.ceil(load - 1e-9) };
  }

  // ---------- checks ----------
  // One day's shifts -> what beehive found. entries: { [educatorId]: { shift } }
  function check(isoDate, entries) {
    const d = demand(isoDate);
    const on = Object.entries(entries || {}).map(([id, s]) => ({ e: staff().find((x) => x.id === id), s })).filter((x) => x.e && x.s);
    const needed = d.needed;
    const counted = on.filter((x) => wwcc(x.e));
    const diplomas = counted.filter((x) => isDiploma(x.e)).length;
    const diplomaNeeded = Math.ceil(needed / 2);
    const issues = [];
    if (counted.length < needed) issues.push("The centre needs " + needed + " educator" + (needed === 1 ? "" : "s") + " for " + d.children + " children, has " + counted.length + ".");
    if (d.children && !counted.some((x) => firstAid(x.e))) issues.push("No educator on shift has current first aid, CPR, anaphylaxis and asthma training.");
    on.filter((x) => !wwcc(x.e)).forEach((x) => issues.push(x.e.name + " is rostered but has no current WWCC, so can’t work with children."));
    on.filter((x) => !profile(x.e).days.includes(dayOf(isoDate))).forEach((x) => issues.push(x.e.name + " isn’t available on " + dayOf(isoDate) + "days."));
    if (needed && diplomas < diplomaNeeded) issues.push("Only " + diplomas + " of the " + needed + " educators needed hold a diploma (or above); the 50% rule needs " + diplomaNeeded + ".");
    return { date: isoDate, needed, children: d.children, rostered: counted.length, diplomas, diplomaNeeded, diplomaOk: !needed || diplomas >= diplomaNeeded, issues, ok: !issues.length && !!on.length };
  }

  // ---------- the builder (rules engine) ----------
  // Fills each day: first aid cover first, then diploma holders until the 50% rule is met, then anyone to reach
  // ratio, plus one spare for breaks where staff allow. Shifts are staggered early, late and middle.
  // base: shifts already set by hand; they are kept and only the gaps are filled.
  // A repeatable shuffle per week, so each week gets a different mix (and the same week fills the same way twice).
  function seeded(key) { let h = 2166136261; for (const c of key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }
  function build(base) {
    const out = {};
    const shiftsThisWeek = {}; // spread the week fairly: whoever has worked least so far goes first
    Object.values(base || {}).forEach((day) => Object.keys(day || {}).forEach((id) => { shiftsThisWeek[id] = (shiftsThisWeek[id] || 0) + 1; }));
    const weekNo = Math.round(Date.parse(weekStart + "T00:00:00Z") / (7 * 864e5));
    weekDates().forEach((date, di) => {
      const dn = dayOf(date);
      const d = demand(date);
      const pool = staff().filter((e) => rosterable(e) && profile(e).days.includes(dn))
        .sort((a, b) => (shiftsThisWeek[a.id] || 0) - (shiftsThisWeek[b.id] || 0) || seeded(weekStart + date + a.id) - seeded(weekStart + date + b.id));
      const day = Object.assign({}, (base || {})[date] || {});
      const kept = new Set(Object.keys(day));
      const taken = new Set(kept);
      const count = () => Object.keys(day).length;
      const place = (e) => { day[e.id] = { shift: "" }; taken.add(e.id); shiftsThisWeek[e.id] = (shiftsThisWeek[e.id] || 0) + 1; };
      const pick = (filter) => pool.find((e) => !taken.has(e.id) && filter(e));
      if (d.children) {
        // 1. first aid cover, preferring a diploma holder
        if (!Object.keys(day).some((id) => firstAid(staff().find((x) => x.id === id) || {}))) { const e = pick((x) => firstAid(x) && isDiploma(x)) || pick(firstAid); if (e) place(e); }
        // 2. diploma holders until the 50% rule is met
        const dips = () => Object.keys(day).filter((id) => isDiploma(staff().find((x) => x.id === id) || {})).length;
        while (count() < d.needed && dips() < Math.ceil(d.needed / 2)) { const e = pick(isDiploma); if (!e) break; place(e); }
        // 3. anyone to reach ratio
        while (count() < d.needed) { const e = pick(() => true); if (!e) break; place(e); }
        // 4. one spare for breaks
        if (count() <= d.needed) { const e = pick(() => true); if (e) place(e); }
      }
      // stagger shifts
      Object.keys(day).filter((id) => !kept.has(id)).forEach((id, i) => { day[id].shift = ["early", "late", "mid"][(i + weekNo + di) % 3]; });
      out[date] = day;
    });
    return out;
  }
  // Fill gaps: only the week on screen. Keeps every shift set by hand and fills the gaps with fully qualified educators.
  function create() {
    const before = week() || {};
    const data = build(before);
    setWeek(data);
    const off = staff().filter((e) => !rosterable(e));
    const short = weekDates().map((d) => check(d, data[d])).filter((c) => c.rostered < c.needed);
    render();
    toast("Gaps filled for the week of " + fmt(weekStart) + (short.length ? ". Not enough educators on " + short.map((c) => dayOf(c.date)).join(", ") + ": add shifts by hand." : ": ratios and the 50% diploma rule met every day.") +
      (off.length ? " " + off.map((e) => e.name.split(" ")[0]).join(" and ") + " left off until their credentials are renewed." : ""));
  }

  function ask(title, text, okLabel, act) {
    openModal('<div class="modalHead"><div><h2>' + E(title) + "</h2><p>" + E(text) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="formActions"><button class="button" onclick="closeModal()">Cancel</button><button class="button primary" onclick="closeModal();' + act + '">' + E(okLabel) + "</button></div>");
  }
  function copyLast(sure) {
    const prev = load()[addDays(weekStart, -7)];
    if (!prev || !Object.values(prev).some((d) => Object.keys(d || {}).length)) return toast("There’s no roster for last week to copy.");
    if (!sure && hasShifts()) return ask("Copy last week?", "This replaces this week’s shifts with last week’s.", "Replace with last week", "Roster.copyLast(true)");
    const data = {};
    weekDates().forEach((date, i) => {
      const from = prev[addDays(weekStart, i - 7)] || {};
      data[date] = Object.fromEntries(Object.entries(from).filter(([id]) => { const e = staff().find((x) => x.id === id); return e && rosterable(e); }));
    });
    setWeek(data);
    render();
    toast("Copied last week’s shifts. Anyone whose credentials have lapsed was left off.");
  }
  const hasShifts = () => { const w = week(); return !!w && Object.values(w).some((d) => Object.keys(d || {}).length); };
  function clearWeek(sure) {
    if (!hasShifts()) return toast("This week has no shifts to clear.");
    if (!sure) return ask("Clear the week of " + fmt(weekStart) + "?", "Every shift this week is removed.", "Clear the week", "Roster.clearWeek(true)");
    setWeek({});
    render();
    toast("Week of " + fmt(weekStart) + " cleared. Click any day to add a shift, or use Fill gaps with AI.");
  }
  function change(date, id, value) {
    const data = week() || {};
    data[date] = data[date] || {};
    if (!value) delete data[date][id];
    else data[date][id] = { shift: value || "mid" };
    setWeek(data);
    render();
  }
  // For the hive agent: add one shift on any date (its own week), keeping everything else.
  function addShift(date, id, shift) {
    const start = mondayOf(new Date(date + "T00:00:00"));
    const all = load();
    const data = all[start] || {};
    data[date] = data[date] || {};
    data[date][id] = { shift: SHIFTS[shift] ? shift : "mid" };
    all[start] = data;
    save(all);
  }
  function dayEntries(date) { const d = week(mondayOf(new Date(date + "T00:00:00"))) || {}; return d[date] || {}; }
  function shiftWeek(n) { weekStart = addDays(weekStart, 7 * n); render(); }
  function thisWeek() { weekStart = mondayOf(new Date()); render(); }
  const ARROW_L = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ARROW_R = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- what the rest of beehive reads ----------
  // Entries for one date in the shape the daily sheet uses. Without a roster for that week, nobody is on.
  function forDay(isoDate) {
    const data = week(mondayOf(new Date(isoDate + "T00:00:00"))) || {};
    return Object.entries(data[isoDate] || {}).map(([id, s]) => {
      const e = staff().find((x) => x.id === id);
      if (!e) return null;
      const sh = SHIFTS[s.shift] || SHIFTS.mid;
      return { e, start: sh[0], end: sh[1], wwcc: wwcc(e), firstAid: firstAid(e), diploma: isDiploma(e), lapsed: FIRST_AID_SET.filter((t) => !certOk(e, t)) };
    }).filter(Boolean);
  }
  function issueCount() {
    const today = iso(new Date());
    if (!WEEKDAYS.includes(dayOf(today))) return 0;
    const data = week(mondayOf(new Date()));
    return data ? check(today, data[today]).issues.length : 0;
  }

  // ---------- page: a weekly calendar ----------
  function cell(date, e, entry) {
    const stop = blockers(e);
    if (stop.length) return '<td class="calCell blocked"><span>Not rostered</span><small>' + E(stop.join(", ")) + (stop.length === 1 ? " not current" : " not current") + "</small></td>";
    if (!profile(e).days.includes(dayOf(date)) && !entry) return '<td class="calCell away"><span>Not available</span></td>';
    if (!entry) return '<td class="calCell off"><button onclick="Roster.edit(\'' + date + "','" + e.id + '\')" aria-label="Add a shift for ' + E(e.name) + ", " + dayOf(date) + '">Off</button></td>';
    const sh = SHIFTS[entry.shift] || SHIFTS.mid;
    const key = SHIFTS[entry.shift] ? entry.shift : "mid";
    return '<td class="calCell"><button class="shift ' + key + '" onclick="Roster.edit(\'' + date + "','" + e.id + '\')"><b>' + sh[2] + "</b><small>" + sh[0] + " – " + sh[1] + "</small></button></td>";
  }
  function edit(date, id) {
    const e = staff().find((x) => x.id === id), data = week() || {}, cur = (data[date] || {})[id];
    const opt = (value, label, on) => '<button class="shiftOption' + (on ? " on" : "") + '" onclick="Roster.change(\'' + date + "','" + id + "','" + value + '\');closeModal()">' + label + "</button>";
    openModal(
      '<div class="modalHead"><div><h2>' + E(e.name) + "</h2><p>" + E(fmt(date, { weekday: "long", day: "numeric", month: "long" })) + " · " + E(profile(e).qual) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection shiftOptions">' + Object.keys(SHIFTS).map((k) => opt(k, SHIFTS[k][2] + " · " + SHIFTS[k][0] + " – " + SHIFTS[k][1], cur && cur.shift === k)).join("") +
      "</div>" + '<div class="formActions">' + opt("", "Off this day", !cur) + "</div>"
    );
  }
  function page() {
    const stored = week();
    const data = stored && Object.values(stored).some((d) => Object.keys(d || {}).length) ? stored : null;
    const dates = weekDates();
    const head =
      header("Roster", "Week of " + fmt(weekStart, { day: "numeric", month: "long", year: "numeric" }),
        '<div class="weekNav" role="group" aria-label="Choose week"><button class="weekArrow" aria-label="Previous week" onclick="Roster.shiftWeek(-1)">' + ARROW_L + "</button>" +
          '<button class="weekToday" onclick="Roster.thisWeek()"' + (weekStart === mondayOf(new Date()) ? " disabled" : "") + ">This week</button>" +
          '<button class="weekArrow" aria-label="Next week" onclick="Roster.shiftWeek(1)">' + ARROW_R + "</button></div>" +
        '<button class="button" onclick="Availability.openAll()">Availability</button>' +
        '<button class="button" onclick="Roster.copyLast()">Copy last week</button>' +
        '<button class="button" onclick="Roster.clearWeek()" ' + (data ? "" : "disabled") + ">Clear week</button>" +
        '<button class="button primary" onclick="Roster.create()"><span data-icon="spark"></span>Fill gaps with AI</button>');
    const table =
      '<div class="tableWrap"><table class="calendar compact"><thead><tr><th>Educator</th>' +
      dates.map((d) => { const dm = demand(d); return "<th><b>" + dayOf(d) + " " + fmt(d) + "</b><small>" + dm.children + " children · " + dm.needed + " needed</small></th>"; }).join("") + "</tr></thead><tbody>" +
      staff().map((e) => '<tr class="' + (rosterable(e) ? "" : "isBlocked") + '"><td><div class="staffPerson"><b>' + E(e.name) + (isDiploma(e) ? ' <span class="dipTag">Diploma+</span>' : "") + "</b>" +
        "<small>" + E(profile(e).qual) + "</small>" +
        '<button type="button" class="availButton" onclick="Availability.open(\'' + E(e.id) + '\')" aria-label="Change ' + E(e.name) + '’s availability">Available ' + E(typeof Availability !== "undefined" ? Availability.summary(profile(e).days) : profile(e).days.join(", ")) + "</button></div></td>" +
        dates.map((d) => cell(d, e, data && data[d] ? data[d][e.id] : null)).join("") + "</tr>").join("") +
      "</tbody></table></div>";
    return head + (data ? "" : '<p class="emptyRoster muted">This week is empty. Click any day to add a shift, or use Fill gaps with AI.</p>') + table +
      '<p class="footnote">' + (typeof LIVE !== "undefined" && LIVE ? "Rosters are saved in this browser for now. " : "") + "The roster is also your record of educators working directly with children (Reg 151).</p>";
  }

  // This week at a glance for the Overview.
  function weekStatus() {
    const start = mondayOf(new Date());
    const data = week(start);
    if (!data || !Object.values(data).some((d) => Object.keys(d || {}).length)) return { exists: false, ok: 0, issues: 0, start };
    const checks = WEEKDAYS.map((_, i) => check(addDays(start, i), data[addDays(start, i)]));
    return { exists: true, ok: checks.filter((c) => c.ok).length, issues: checks.reduce((n, c) => n + c.issues.length, 0), start };
  }
  return { SHIFTS, addShift, dayEntries, demand, rosterable, blockers, dayOf, weekStatus, copyLast, page, edit, create, clearWeek, change, shiftWeek, thisWeek, forDay, check, build, issueCount, profile, isDiploma };
})();
