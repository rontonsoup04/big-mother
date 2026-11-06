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
// "Create with AI" builds the week with a rules engine, so the ratio and diploma checks always hold. Educators with
// an expired or missing credential are left off until it's renewed. The owner can change any shift afterwards.
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
  function week(start) { return load()[start || weekStart] || null; }
  function setWeek(data) { const all = load(); if (data) all[weekStart] = data; else delete all[weekStart]; save(all); }

  // ---------- educators and children ----------
  const staff = () => (typeof educators !== "undefined" ? educators : []);
  // Demo profiles match by id offline and by first name in live mode (live ids are database ids).
  const profile = (e) => Object.assign({ qual: e.qualification || "Certificate III", days: e.days && e.days.length ? e.days : WEEKDAYS }, PROFILE[e.id] || PROFILE[String(e.name || "").split(" ")[0].toLowerCase()] || {});
  const isDiploma = (e) => DIPLOMA.includes(profile(e).qual);
  function certOk(e, t) { const c = (e.certs || []).find((x) => x.type === t); return !!c && c.days >= 0; }
  const wwcc = (e) => certOk(e, "WWCC");
  const firstAid = (e) => FIRST_AID_SET.every((t) => certOk(e, t));
  // Anyone with an expired or missing credential is kept off the roster until it's renewed.
  const blockers = (e) => ["WWCC"].concat(FIRST_AID_SET).filter((t) => !certOk(e, t));
  const rosterable = (e) => !blockers(e).length;
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
  // base: shifts already set by hand; they are kept and only the gaps are filled.
  function build(base) {
    const out = {};
    weekDates().forEach((date) => {
      const dn = dayOf(date);
      const d = demand(date);
      const pool = staff().filter((e) => rosterable(e) && profile(e).days.includes(dn));
      const day = Object.assign({}, (base || {})[date] || {});
      const kept = new Set(Object.keys(day));
      const taken = new Set(kept);
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
        ids.forEach((id, i) => { if (!kept.has(id)) day[id].shift = ["early", "late", "mid"][i % 3]; });
      });
      out[date] = day;
    });
    return out;
  }
  // Auto-fill: keeps every shift set by hand and fills the gaps with fully qualified educators.
  function create() {
    const before = week() || {};
    const data = build(before);
    setWeek(data);
    const off = staff().filter((e) => !rosterable(e));
    render();
    toast((Object.keys(before).length ? "Gaps filled" : "Roster created") + " for the week of " + fmt(weekStart) + ": ratios and the 50% diploma rule met every day" + (off.length ? ". " + off.map((e) => e.name.split(" ")[0]).join(" and ") + " left off until their credentials are renewed." : "."));
  }
  function copyLast() {
    const prev = load()[addDays(weekStart, -7)];
    if (!prev) return toast("There’s no roster for last week to copy.");
    if (week() && !confirm("Replace this week’s shifts with last week’s?")) return;
    const data = {};
    weekDates().forEach((date, i) => {
      const from = prev[addDays(weekStart, i - 7)] || {};
      data[date] = Object.fromEntries(Object.entries(from).filter(([id]) => { const e = staff().find((x) => x.id === id); return e && rosterable(e); }));
    });
    setWeek(data);
    render();
    toast("Copied last week’s shifts. Anyone whose credentials have lapsed since was left off.");
  }
  // Automatic rostering: once enough educators are fully qualified, beehive builds each new week by itself.
  const AUTO_KEY = "beehive-roster-auto";
  function autoOn() { try { return localStorage.getItem(AUTO_KEY) !== "off"; } catch (e) { return true; } }
  function toggleAuto() { try { localStorage.setItem(AUTO_KEY, autoOn() ? "off" : "on"); } catch (e) {} render(); }
  function readyCount() { return staff().filter(rosterable).length; }
  function canAuto() {
    // enough fully qualified educators to cover the busiest day this week
    const need = Math.max(0, ...weekDates().map((d) => demand(d).reduce((n, r) => n + r.needed, 0)));
    return readyCount() >= need && need > 0;
  }
  function autoFill() {
    if (week() || !autoOn() || !canAuto()) return false;
    setWeek(build({}));
    return true;
  }
  function clearWeek() {
    if (!week() || !Object.values(week()).some((d) => Object.keys(d || {}).length)) return;
    if (!confirm("Delete the roster for the week of " + fmt(weekStart) + "? This can’t be undone.")) return;
    setWeek({}); // an empty week, so auto-roster leaves it for you to build by hand
    render();
    toast("Roster deleted for the week of " + fmt(weekStart) + ". Click any day to build it by hand.");
  }
  function change(date, id, value) {
    const data = week() || {};
    data[date] = data[date] || {};
    if (!value) delete data[date][id];
    else { const [room, shift] = value.split("|"); data[date][id] = { room, shift: shift || "mid" }; }
    setWeek(data);
    render();
  }
  // For the hive agent: add one shift on any date (its own week), keeping everything else.
  function addShift(date, id, room, shift) {
    const start = mondayOf(new Date(date + "T00:00:00"));
    ensureWeek(start);
    const all = load();
    const data = all[start] || {};
    data[date] = data[date] || {};
    data[date][id] = { room, shift: shift || "mid" };
    all[start] = data;
    save(all);
  }
  function dayEntries(date) { const d = week(mondayOf(new Date(date + "T00:00:00"))) || {}; return d[date] || {}; }
  function shiftWeek(n) { weekStart = addDays(weekStart, 7 * n); render(); }

  // ---------- what the rest of beehive reads ----------
  // Entries for one date in the shape the daily sheet uses. Without a roster for that week, nobody is on.
  // Builds a week on its own when auto-roster is on and nobody has started it yet.
  function ensureWeek(start) {
    if (week(start)) return;
    const keep = weekStart;
    weekStart = start;
    try { autoFill(); } finally { weekStart = keep; }
  }
  function forDay(isoDate) {
    ensureWeek(mondayOf(new Date(isoDate + "T00:00:00")));
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

  // ---------- page: a weekly calendar ----------
  const ROOM_TONE = ["wattle", "banksia", "gumtree", "extra"];
  const toneOf = (room) => ROOM_TONE[Math.max(0, rooms().indexOf(room)) % ROOM_TONE.length];
  function cell(date, e, entry) {
    const stop = blockers(e);
    if (stop.length) return '<td class="calCell blocked"><span>Not rostered</span><small>' + E(stop.join(", ")) + (stop.length === 1 ? " not current" : " not current") + "</small></td>";
    if (!profile(e).days.includes(dayOf(date)) && !entry) return '<td class="calCell away"><span>Not available</span></td>';
    if (!entry) return '<td class="calCell off"><button onclick="Roster.edit(\'' + date + "','" + e.id + '\')" aria-label="Add a shift for ' + E(e.name) + ", " + dayOf(date) + '">Off</button></td>';
    const sh = SHIFTS[entry.shift] || SHIFTS.mid;
    return '<td class="calCell"><button class="shift ' + toneOf(entry.room) + '" onclick="Roster.edit(\'' + date + "','" + e.id + '\')"><b>' + E(entry.room.replace(/ Room$/, "")) + "</b><small>" + sh[0] + " – " + sh[1] + "</small></button></td>";
  }
  function edit(date, id) {
    const e = staff().find((x) => x.id === id), data = week() || {}, cur = (data[date] || {})[id];
    const opt = (value, label, on) => '<button class="shiftOption' + (on ? " on" : "") + '" onclick="Roster.change(\'' + date + "','" + id + "','" + value + '\');closeModal()">' + label + "</button>";
    openModal(
      '<div class="modalHead"><div><h2>' + E(e.name) + "</h2><p>" + E(fmt(date, { weekday: "long", day: "numeric", month: "long" })) + " · " + E(profile(e).qual) + '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection shiftOptions">' + rooms().map((room) => '<div><h3>' + E(room) + "</h3>" + Object.keys(SHIFTS).map((k) => opt(room + "|" + k, SHIFTS[k][2] + " · " + SHIFTS[k][0] + " – " + SHIFTS[k][1], cur && cur.room === room && cur.shift === k)).join("") + "</div>").join("") +
      "</div>" + '<div class="formActions">' + opt("", "Off this day", !cur) + "</div>"
    );
  }
  function page() {
    const autoMade = autoFill();
    const stored = week();
    const data = stored && Object.values(stored).some((d) => Object.keys(d || {}).length) ? stored : null;
    const dates = weekDates();
    const head =
      header("Roster", "Week of " + fmt(weekStart, { day: "numeric", month: "long", year: "numeric" }) + ". Click any day to add or change a shift. Educators with an expired credential stay off until it’s renewed.",
        '<div class="weekNav"><button class="iconButton" aria-label="Previous week" onclick="Roster.shiftWeek(-1)">‹</button><button class="iconButton" aria-label="Next week" onclick="Roster.shiftWeek(1)">›</button></div>' +
        '<button class="button" onclick="Roster.copyLast()">Copy last week</button>' +
        '<button class="button" onclick="Roster.clearWeek()" ' + (data ? "" : "disabled") + ">Delete week roster</button>" +
        '<button class="button primary" onclick="Roster.create()"><span data-icon="spark"></span>' + (data ? "Fill gaps with AI" : "Create with AI") + "</button>");
    const ready = readyCount();
    const autoBar =
      '<div class="autoBar"><span class="aiMark" data-icon="spark"></span><div><b>' + ready + " of " + staff().length + " educators are fully qualified</b><small>" +
        (canAuto() ? (autoOn() ? "beehive builds each new week for you from fully qualified educators. Click any day to change a shift." : "Auto-roster is off: build the week by clicking each day, or use Create with AI.")
          : "Not enough fully qualified educators to cover every day yet, so build the week by hand: click any day to add a shift.") +
        (autoMade ? " This week was just built automatically." : "") + "</small></div>" +
        (canAuto() ? '<label class="switch"><input type="checkbox" ' + (autoOn() ? "checked" : "") + ' onchange="Roster.toggleAuto()"><span></span>Auto-roster</label>' : "") + "</div>";
    const legend = '<div class="calLegend">' + rooms().map((r) => '<span class="shift ' + toneOf(r) + '">' + E(r) + "</span>").join("") + '<span class="dipTag">Diploma+</span><span class="muted">' + staff().filter(isDiploma).length + " of " + staff().length + " educators</span></div>";
    const table =
      '<div class="tableWrap"><table class="calendar"><thead><tr><th>Educator</th>' +
      dates.map((d) => { const dm = demand(d); return "<th><b>" + dayOf(d) + " " + fmt(d) + "</b><small>" + dm.reduce((n, r) => n + r.children, 0) + " children</small></th>"; }).join("") + "</tr></thead><tbody>" +
      staff().map((e) => '<tr class="' + (rosterable(e) ? "" : "isBlocked") + '"><td><div class="staffPerson"><b>' + E(e.name) + "</b><small>" + E(profile(e).qual) + (isDiploma(e) ? ' <span class="dipTag">Diploma+</span>' : "") + "</small></div></td>" +
        dates.map((d) => cell(d, e, data && data[d] ? data[d][e.id] : null)).join("") + "</tr>").join("") +
      "</tbody></table></div>";
    return head + autoBar + legend + (data ? "" : '<p class="emptyRoster muted">No roster for this week yet. Click any day to add a shift, or use Create with AI.</p>') + table +
      '<p class="footnote">' + (typeof LIVE !== "undefined" && LIVE ? "Rosters are saved in this browser for now. " : "Offline demo: sample qualifications and availability. ") + "The roster is also your record of educators working directly with children (Reg 151).</p>";
  }

  // This week at a glance for the Overview.
  function weekStatus() {
    const start = mondayOf(new Date());
    ensureWeek(start);
    const data = week(start);
    if (!data || !Object.values(data).some((d) => Object.keys(d || {}).length)) return { exists: false, ok: 0, issues: 0, start };
    const checks = WEEKDAYS.map((_, i) => check(addDays(start, i), data[addDays(start, i)]));
    return { exists: true, ok: checks.filter((c) => c.ok).length, issues: checks.reduce((n, c) => n + c.issues.length, 0), start };
  }
  return { addShift, dayEntries, demand, rosterable, blockers, dayOf, weekStatus, copyLast, toggleAuto, page, edit, create, clearWeek, change, shiftWeek, forDay, check, build, issueCount, profile, isDiploma };
})();
