// beehive Overview canvas: the daily sheet plus a handful of things to handle, as cards the owner can
// move around, open and tick off. Only the few most important items are shown, never every record.
// Card positions and ticked-off items are remembered in this browser (ticked items for today only).
const Canvas = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-canvas-v2";
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
  function items() { const s = load(); return candidates().filter((c) => !s.done.includes(c.id)).slice(0, MAX); }

  // Honeycomb layout (px from the canvas's top-left): the daily sheet as a big cell, things to handle around it.
  const W = 210, H = 242; // a pointy-top hexagon: height = width × 1.155
  const SLOTS = [[452, 14], [452 + W + 10, 14], [452 + (W + 10) / 2, 14 + H * 0.75 + 8], [452 + (W + 10) * 1.5, 14 + H * 0.75 + 8], [452, 14 + (H * 0.75 + 8) * 2], [452 + W + 10, 14 + (H * 0.75 + 8) * 2]];
  const hex = (id, cls, pos, inner, i) =>
    '<article class="hexCard ' + cls + '" id="cc-' + id + '" style="left:' + pos.x + "px;top:" + pos.y + "px;--i:" + (i || 0) + '" onpointerdown="Canvas.drag(event,\'' + id + '\')"><div class="hexBorder"><div class="hexInner">' + inner + "</div></div></article>";
  function card(c, i, pos) {
    const p = pos[c.id] || { x: SLOTS[i % SLOTS.length][0], y: SLOTS[i % SLOTS.length][1] };
    return hex(c.id, c.tone, p,
      '<span class="cardLabel">' + E(c.label) + "</span><h3>" + E(c.title) + "</h3><p>" + E(c.detail) + "</p>" +
      '<div class="hexActions"><button class="button small primary" onclick="' + c.act + '">' + E(c.btn) + '</button><button class="tick" title="Done for today" aria-label="Done for today" onclick="Canvas.done(\'' + c.id + '\')">✓</button></div>',
      i + 1);
  }
  function sheetCard(pos) {
    const p = pos.sheet || { x: 14, y: 14 };
    const st = typeof Centre !== "undefined" ? Centre.sheetStats() : null;
    const inner = !st ? "" :
      '<span class="cardLabel">Daily sheet</span><h2>' + E(st.dayLabel) + "</h2>" +
      '<div class="hexRooms">' + st.rooms.map((r) => '<div><b>' + E(r.room.replace(/ Room$/, "")) + "</b><span>" + r.children + " kids · " + r.educators + " educators</span></div>").join("") + "</div>" +
      '<p class="hexNote">' + (st.alerts ? st.alerts + " children with allergies or medical needs" : "No medical alerts") + (st.flags ? " · " + st.flags + " to sort out" : " · all set") + "</p>" +
      '<div class="hexActions"><button class="button small" onclick="Centre.openFull()">Full sheet</button><button class="button small primary" onclick="Centre.printDay(\'' + st.day + '\')"><span data-icon="download"></span>PDF</button></div>';
    return hex("sheet", "sheet", p, inner);
  }
  const BEE = '<svg class="bee" viewBox="0 0 40 32" aria-hidden="true"><ellipse cx="13" cy="9" rx="8" ry="6" fill="#fff" opacity=".85" stroke="#c9b98f"/><ellipse cx="24" cy="8" rx="7" ry="5" fill="#fff" opacity=".85" stroke="#c9b98f"/><ellipse cx="20" cy="20" rx="12" ry="9" fill="#f2b632"/><path d="M15 12.5v15M21 11v18M27 12.5v15" stroke="#3b2f1e" stroke-width="3"/><circle cx="31" cy="18" r="1.4" fill="#3b2f1e"/></svg>';
  function page() {
    const s = load(), list = items();
    const n = list.length;
    return (
      header(greeting() + ", " + E(firstName(OWNER_NAME)),
        new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }) + ". " + (n ? n + (n === 1 ? " thing" : " things") + " to handle in the hive. beehive is taking care of the rest." : "The hive is calm. Nothing needs you today."),
        (Object.keys(s.pos).length || s.done.length ? '<button class="button" onclick="Canvas.reset()">Tidy the hive</button>' : "")) +
      '<div class="canvas hive" id="canvas"><div class="beePath">' + BEE + "</div>" + sheetCard(s.pos) + list.map((c, i) => card(c, i, s.pos)).join("") +
      (n ? "" : hex("calm", "calm", { x: SLOTS[0][0], y: SLOTS[0][1] }, '<span class="cardLabel">All clear</span><h3>Nothing to handle</h3><p>Every credential, requirement and roster is in order.</p>')) +
      "</div>" +
      '<p class="footnote">Drag any cell to rearrange your hive. Tick a cell when it’s handled and it flies off for the day.</p>'
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
  }
  function reset() { try { localStorage.removeItem(STORE); } catch (e) {} render(); }

  return { page, drag, done, reset, items };
})();
