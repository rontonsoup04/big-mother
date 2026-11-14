// beehive Overview canvas: the daily sheet plus a handful of things to handle, as cards the owner can
// move around, open and tick off. Only the few most important items are shown, never every record.
// Card positions and ticked-off items are remembered in this browser (ticked items for today only).
const Canvas = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-canvas-v3"; // v3: smaller cells, so positions saved for the old size are dropped
  const MAX = 4; // things to handle at once
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  function load() { try { const s = JSON.parse(localStorage.getItem(STORE) || "{}"); if (s.day !== today()) s.done = []; return Object.assign({ pos: {}, done: [], day: today() }, s); } catch (e) { return { pos: {}, done: [], day: today() }; } }
  function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }

  // Everything that could need the owner, most important first. Each: id, tone, title, detail, action.
  function candidates() {
    const out = [];
    const sa = typeof StaffAgent !== "undefined" && StaffAgent.active() ? StaffAgent.decisions() : [];
    if (sa.length) out.push({ id: "staff", tone: "bad", label: "Staff", title: sa.length + " credential" + (sa.length === 1 ? "" : "s") + " need your decision",
      detail: sa.slice(0, 2).map((d) => d.who).filter(Boolean).join(" · ") || "Expired or missing training, or an upload to verify.", act: "StaffAgent.nextDecision()", btn: "Decide" });
    if (typeof medicalSubmission !== "undefined" && medicalSubmission && medicalSubmission.status === "pending")
      out.push({ id: "medical", tone: "bad", label: "Children", title: "Medical update to approve", detail: medicalSubmission.childName + ", sent by " + (medicalSubmission.signer || "a parent") + ". Educators see it once you approve.", act: "reviewFamilyUpdate()", btn: "Review" });
    if (typeof approved !== "undefined" && !approved)
      out.push({ id: "checklist", tone: "warn", label: "Legal", title: "Approve your requirements checklist", detail: "beehive drafted it from the National Regulations. Once approved, it checks every requirement for you.", act: "go('audit')", btn: "Review" });
    const reg = typeof Legal !== "undefined" ? Legal.openCount() : 0;
    if (reg) out.push({ id: "reg", tone: "warn", label: "Legal", title: "A regulation change may affect your policies", detail: "beehive matched it to " + reg + " requirement" + (reg === 1 ? "" : "s") + ". Record whether anything needs to change.", act: "go('updates')", btn: "Review" });
    const rs = typeof Roster !== "undefined" ? Roster.weekStatus() : { exists: true };
    if (!rs.exists) out.push({ id: "roster", tone: "warn", label: "Roster", title: "No roster for this week", detail: "Create with AI builds one that meets ratios and the 50% diploma rule.", act: "go('roster')", btn: "Create" });
    const kids = typeof Centre !== "undefined" ? Centre.children() : [];
    const unsigned = kids.filter((k) => k.missing.some((m) => /enrolment agreement/i.test(m)));
    if (unsigned.length) out.push({ id: "contracts", tone: "warn", label: "Centre", title: unsigned.length + " enrolment agreement" + (unsigned.length === 1 ? "" : "s") + " not signed", detail: unsigned.map((k) => k.first + " " + k.last).join(", ") + ". The family has been sent the agreement.", act: "Centre.openChild('" + unsigned[0].id + "')", btn: "Open" });
    const spot = typeof Legal !== "undefined" && approved ? Legal.spotChecks().filter((r) => r.tone === "red") : [];
    if (spot.length) out.push({ id: "spot", tone: "bad", label: "Legal", title: spot.length + " spot check item" + (spot.length === 1 ? "" : "s") + " not ready", detail: spot.map((r) => r.label).slice(0, 2).join(" · "), act: "go('legal')", btn: "Open" });
    const kidsMissing = kids.filter((k) => k.missing.some((m) => !/enrolment agreement/i.test(m)));
    if (kidsMissing.length) out.push({ id: "records", tone: "warn", label: "Centre", title: kidsMissing.length + " enrolment record" + (kidsMissing.length === 1 ? "" : "s") + " incomplete", detail: kidsMissing.map((k) => k.first + ": " + k.missing[0].toLowerCase()).join(" · "), act: "go('compliance')", btn: "Open" });
    return out;
  }
  // The agent's proposals come first; the rest of the hive fills any space left.
  function items() {
    const s = load();
    const agent = typeof Hive !== "undefined" ? Hive.cells() : [];
    return agent.slice(0, 4).concat(candidates().filter((c) => !s.done.includes(c.id))).slice(0, 5);
  }

  // Honeycomb layout (px from the canvas's top-left): the daily sheet as a big cell, things to handle around it.
  // Sized so the whole hive fits on one screen next to the area tiles (see .hexCard in beehive.css).
  const W = 166, H = 192; // a pointy-top hexagon: height = width × 1.155
  const X0 = 300; // just right of the daily sheet cell (276 px wide)
  const SLOTS = [[X0, 10], [X0 + W + 8, 10], [X0 + (W + 8) / 2, 10 + H * 0.75 + 6], [X0 + (W + 8) * 1.5, 10 + H * 0.75 + 6], [X0, 10 + (H * 0.75 + 6) * 2], [X0 + W + 8, 10 + (H * 0.75 + 6) * 2]];
  const hex = (id, cls, pos, inner, i) =>
    '<article class="hexCard ' + cls + '" id="cc-' + id + '" style="left:' + pos.x + "px;top:" + pos.y + "px;--i:" + (i || 0) + '" onpointerdown="Canvas.drag(event,\'' + id + '\')"><div class="hexBorder"><div class="hexInner">' + inner + "</div></div></article>";
  // Cells the owner moved keep their spot; every other cell takes the next free slot, so none overlap.
  function placeAll(list, pos) {
    const used = Object.entries(pos).filter(([id]) => list.some((c) => c.id === id) || id === "sheet").map(([, p]) => p);
    const free = SLOTS.filter(([x, y]) => !used.some((p) => Math.abs(p.x - x) < W * 0.8 && Math.abs(p.y - y) < H * 0.6));
    const out = {};
    list.forEach((c) => { out[c.id] = pos[c.id] || (free.length ? (([x, y]) => ({ x, y }))(free.shift()) : { x: SLOTS[0][0], y: SLOTS[0][1] }); });
    return out;
  }
  function card(c, i, pos) {
    const p = pos[c.id];
    return hex(c.id, c.tone, p,
      '<span class="cardLabel">' + E(c.label) + "</span>" + (c.openAct ? '<button class="hexTitle" onclick="' + c.openAct + '">' + E(c.title) + "</button>" : "<h3>" + E(c.title) + "</h3>") + "<p>" + E(c.detail) + "</p>" +
      '<div class="hexActions"><button class="button small primary" onclick="' + (c.review ? c.openAct : c.act) + '">' + E(c.btn) + "</button>" +
        (c.altAct ? '<button class="tick no" title="Not now" aria-label="Not now" onclick="' + c.altAct + '">×</button>' : '<button class="tick" title="Done for today" aria-label="Done for today" onclick="Canvas.done(\'' + c.id + '\')">✓</button>') + "</div>",
      i + 1);
  }
  function sheetCard(pos) {
    const p = pos.sheet || { x: 10, y: 92 };
    const st = typeof Centre !== "undefined" ? Centre.sheetStats() : null;
    const inner = !st ? "" :
      '<span class="cardLabel">Daily sheet</span><h2>' + E(st.dayLabel) + "</h2>" +
      '<div class="hexRooms"><div><b>Children</b><span>' + st.children + " booked</span></div><div><b>Educators</b><span>" + st.educators + " on shift · " + st.needed + " needed</span></div></div>" +
      '<p class="hexNote">' + (st.alerts ? st.alerts + " children with allergies or medical needs" : "No medical alerts") + (st.flags ? " · " + st.flags + " to sort out" : " · all set") + "</p>" +
      '<div class="hexActions"><button class="button small primary" onclick="Sheet.open(\'' + st.day + '\')"><span data-icon="spark"></span>Open the sheet</button></div>';
    return hex("sheet", "sheet", p, inner);
  }
  const BEE = '<svg class="bee" viewBox="0 0 40 32" aria-hidden="true"><ellipse cx="13" cy="9" rx="8" ry="6" fill="#fff" opacity=".85" stroke="#c9b98f"/><ellipse cx="24" cy="8" rx="7" ry="5" fill="#fff" opacity=".85" stroke="#c9b98f"/><ellipse cx="20" cy="20" rx="12" ry="9" fill="#f2b632"/><path d="M15 12.5v15M21 11v18M27 12.5v15" stroke="#3b2f1e" stroke-width="3"/><circle cx="31" cy="18" r="1.4" fill="#3b2f1e"/></svg>';
  function page() {
    if (typeof Hive !== "undefined" && !Hive.isRunning()) setTimeout(() => Hive.run(false), 0);
    const s = load(), list = items();
    const n = list.length;
    // Full width: the morning check, then the hive filling the page. The cells sit on a fixed-size stage
    // (#canvas) centred in the full-width honeycomb, so dragging and saved positions work at any width.
    // Section links live in the bottom dock only.
    return (
      // beehive's main tagline is the Overview's heading; the greeting and the day sit under it.
      header('<span class="mainTagline">we are the buzz in the background</span>',
        "<b>" + greeting() + ", " + E(firstName(OWNER_NAME)) + ".</b> " + new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }) + ". " + (n ? n + (n === 1 ? " thing" : " things") + " to handle in the hive. beehive is taking care of the rest." : "The hive is calm. Nothing needs you today."),
        (Object.keys(s.pos).length || s.done.length ? '<button class="button" onclick="Canvas.reset()">Tidy the hive</button>' : "") +
        '<button class="button" onclick="exportReport()"><span data-icon="download"></span>Audit report</button>') +
      '<div class="overviewHive">' +
      (typeof Hive !== "undefined" ? Hive.statusBar() : "") +
      '<div class="canvas hive" title="Drag a cell to rearrange your hive. Tick it when it’s handled and it flies off for the day."><div class="beePath">' + BEE + '</div><div class="hiveStage" id="canvas">' + sheetCard(s.pos) + (() => { const placed = placeAll(list, s.pos); return list.map((c, i) => card(c, i, placed)).join(""); })() +
      (n ? "" : hex("calm", "calm", { x: SLOTS[0][0], y: SLOTS[0][1] }, '<span class="cardLabel">All clear</span><h3>Nothing to handle</h3><p>Every credential, requirement and roster is in order.</p>')) +
      "</div></div></div>"
    );
  }

  // ---------- interactions ----------
  function drag(ev, id) {
    if (ev.target.closest("button") || window.matchMedia("(max-width: 680px)").matches) return;
    const el = document.getElementById("cc-" + id), box = document.getElementById("canvas");
    if (!el || !box) return;
    ev.preventDefault();
    const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    el.classList.add("dragging");
    const move = (e) => {
      const x = Math.min(Math.max(e.clientX - b.left - dx, 0), b.width - r.width), y = Math.min(Math.max(e.clientY - b.top - dy, 0), b.height - r.height);
      el.style.left = x + "px"; el.style.top = y + "px";
    };
    const up = () => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up);
      el.classList.remove("dragging");
      const s = load(); s.pos[id] = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }; save(s);
    };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  }
  function done(id) {
    const s = load(); if (!s.done.includes(id)) s.done.push(id); save(s);
    const el = document.getElementById("cc-" + id);
    if (el) { el.classList.add("flyAway"); setTimeout(render, 450); } else render();
    toast("Nice work. Ticked off for today.");
    if (typeof honeyBee === "function") honeyBee();
  }
  function reset() { try { localStorage.removeItem(STORE); } catch (e) {} render(); }

  return { page, drag, done, reset, items };
})();
