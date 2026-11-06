// beehive Overview canvas: the daily sheet plus a handful of things to handle, as cards the owner can
// move around, open and tick off. Only the few most important items are shown, never every record.
// Card positions and ticked-off items are remembered in this browser (ticked items for today only).
const Canvas = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-canvas-v1";
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

  // Default spots (percent of the canvas): the daily sheet on the left, things to handle in two columns on the right.
  const SLOTS = [[57, 0], [79, 0], [57, 34], [79, 34], [57, 68], [79, 68]];
  function card(c, i, pos) {
    const p = pos[c.id] || { x: SLOTS[i % SLOTS.length][0], y: SLOTS[i % SLOTS.length][1] };
    return (
      '<article class="canvasCard ' + c.tone + '" id="cc-' + c.id + '" style="left:' + p.x + "%;top:" + p.y + '%">' +
      '<header onpointerdown="Canvas.drag(event,\'' + c.id + '\')"><span class="cardLabel">' + E(c.label) + '</span><button class="tick" title="Done for today" aria-label="Done for today" onclick="Canvas.done(\'' + c.id + '\')">✓</button></header>' +
      "<h3>" + E(c.title) + "</h3><p>" + E(c.detail) + '</p><button class="button small primary" onclick="' + c.act + '">' + E(c.btn) + "</button></article>"
    );
  }
  function sheetCard(pos) {
    const p = pos.sheet || { x: 0, y: 0 };
    return '<article class="canvasCard sheet" id="cc-sheet" style="left:' + p.x + "%;top:" + p.y + '%"><header onpointerdown="Canvas.drag(event,\'sheet\')"><span class="cardLabel">Daily sheet</span></header>' +
      (typeof Centre !== "undefined" ? Centre.overviewSection() : "") + "</article>";
  }
  function page() {
    const s = load(), list = items();
    const n = list.length;
    return (
      header(greeting() + ", " + E(firstName(OWNER_NAME)),
        new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }) + ". " + (n ? n + (n === 1 ? " thing" : " things") + " to handle. beehive is taking care of the rest." : "Nothing to handle. beehive is taking care of everything."),
        (Object.keys(s.pos).length || s.done.length ? '<button class="button" onclick="Canvas.reset()">Reset canvas</button>' : "")) +
      '<div class="canvas" id="canvas">' + sheetCard(s.pos) + list.map((c, i) => card(c, i, s.pos)).join("") +
      (n ? "" : '<div class="canvasCard calm" style="left:57%;top:0"><h3>All clear</h3><p>Every credential, requirement and roster is in order. Enjoy your day.</p></div>') +
      "</div>" +
      '<p class="footnote">Drag cards by their top bar to arrange your canvas. Tick a card when it’s handled for today.</p>'
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
      el.style.left = (x / b.width) * 100 + "%"; el.style.top = (y / b.height) * 100 + "%";
    };
    const up = () => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up);
      el.classList.remove("dragging");
      const s = load(); s.pos[id] = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }; save(s);
    };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  }
  function done(id) { const s = load(); if (!s.done.includes(id)) s.done.push(id); save(s); render(); toast("Ticked off for today."); }
  function reset() { try { localStorage.removeItem(STORE); } catch (e) {} render(); }

  return { page, drag, done, reset, items };
})();
