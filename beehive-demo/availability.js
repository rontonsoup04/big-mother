// beehive educator availability: which weekdays each educator can work, plus a note ("no early shifts").
//
// - The owner sets it by hand from the Roster (each educator's name, or the Availability button).
// - Or the owner sends the educator a personal link (#availability/<token>); the educator picks their days
//   on their phone without signing in, and the roster uses them straight away.
// The roster checks and "Fill gaps with AI" read these days (Roster.profile). Like the roster itself, availability
// is kept in this browser for now; email and SMS sending is simulated, as elsewhere in beehive.
const Availability = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const STORE = "beehive-availability-v1";
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const DAY_NAME = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday" };

  function load() { try { return Object.assign({ people: {}, links: {} }, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch (e) { return { people: {}, links: {} }; } }
  function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }
  const staff = () => (typeof educators !== "undefined" ? educators : []);
  const person = (id) => staff().find((x) => x.id === id);
  const first = (name) => String(name || "").split(" ")[0];
  const ago = (iso) => (typeof relTime === "function" ? relTime(iso) : new Date(iso).toLocaleString("en-AU"));

  // ---------- what the roster reads ----------
  function record(id) { return load().people[id] || null; }
  function days(id) { const r = record(id); return r ? r.days.slice() : null; }
  function summary(list) {
    if (!list || !list.length) return "No days";
    if (list.length === 5) return "Mon–Fri";
    return DAYS.filter((d) => list.includes(d)).join(", ");
  }

  // ---------- links ----------
  function tokenFor(id) {
    const s = load();
    let t = Object.keys(s.links).find((k) => s.links[k].id === id);
    if (!t) {
      t = "av-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      const e = person(id);
      s.links[t] = { id, name: e ? e.name : "", created: new Date().toISOString() };
      save(s);
    }
    return t;
  }
  const urlFor = (id) => location.origin + location.pathname + "#availability/" + tokenFor(id);
  function linkToken() { const m = location.hash.match(/^#availability\/([\w-]+)/); return m ? m[1] : null; }
  function contact(id) {
    // The staff agent's offline store only exists in the offline demo; signed in, its lookup throws, which used to
    // stop the availability popup opening. The educator record has the same details.
    let c = null;
    try { c = typeof StaffAgent !== "undefined" && StaffAgent.contactFor ? StaffAgent.contactFor(id) : null; } catch (e) { c = null; }
    const e = person(id) || {};
    return { email: (c && c.email) || e.email || "", mobile: (c && (c.mobile || c.phone)) || e.mobile || e.phone || "" };
  }

  // ---------- owner: one educator ----------
  function dayPicker(list) {
    return '<div class="availDays" role="group" aria-label="Days available">' +
      DAYS.map((d) => '<label class="availDay"><input type="checkbox" name="availDay" value="' + d + '"' + (list.includes(d) ? " checked" : "") + "><span>" + d + "</span></label>").join("") + "</div>";
  }
  function open(id) {
    const e = person(id);
    if (!e) return;
    const rec = record(id), list = rec ? rec.days : (typeof Roster !== "undefined" ? Roster.profile(e).days : DAYS);
    const s = load(), sent = Object.values(s.links).filter((l) => l.id === id && l.sentAt).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))[0];
    const c = contact(id);
    openModal(
      '<div class="modalHead"><div><h2>' + E(e.name) + "’s availability</h2><p>" +
        (rec ? "Updated by " + (rec.by === "educator" ? E(first(e.name)) : "you") + " · " + E(ago(rec.at)) : "Usual days on file. Change them here, or ask " + E(first(e.name)) + " to.") +
      '</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection"><h3>Days ' + E(first(e.name)) + " can work</h3>" + dayPicker(list) +
      '<label class="formLabel" for="availNote">Note for the roster</label><textarea id="availNote" rows="2" placeholder="For example: no early shifts on Fridays">' + E(rec ? rec.note : "") + "</textarea>" +
      '<div class="formActions" style="justify-content:flex-start"><button class="button primary" onclick="Availability.saveOwner(\'' + id + '\')">Save availability</button></div></div>' +
      '<div class="modalSection availLink"><h3>Or let ' + E(first(e.name)) + " update it</h3>" +
      '<p class="muted small">A personal link: ' + E(first(e.name)) + " picks their days on their phone, no sign-in needed. The roster updates as soon as they save.</p>" +
      '<div class="keyBox"><code class="copyable" id="availUrl">' + E(urlFor(id)) + '</code><button class="button small" onclick="Availability.copy(\'' + id + '\')">Copy</button></div>' +
      '<div class="buttonRow" style="margin-top:10px">' +
        '<button class="button small" onclick="Availability.send(\'' + id + '\',\'email\')"' + (c.email ? "" : " disabled") + ">Email link" + (c.email ? "" : " (no email)") + "</button>" +
        '<button class="button small" onclick="Availability.send(\'' + id + '\',\'sms\')"' + (c.mobile ? "" : " disabled") + ">SMS link" + (c.mobile ? "" : " (no mobile)") + "</button>" +
        '<button class="button small" onclick="Availability.preview(\'' + id + '\')">Open link (demo)</button></div>' +
      (sent ? '<p class="muted small" style="margin-top:8px">Last sent by ' + (sent.channel === "sms" ? "SMS" : "email") + " " + E(ago(sent.sentAt)) + " · simulated, not actually delivered</p>" : "") +
      "</div>"
    );
  }
  function picked() { return [...document.querySelectorAll('input[name="availDay"]:checked')].map((x) => x.value); }
  function saveOwner(id) {
    const s = load(), e = person(id);
    s.people[id] = { days: picked(), note: ((document.getElementById("availNote") || {}).value || "").trim(), by: "owner", at: new Date().toISOString() };
    save(s);
    closeModal();
    if (typeof render === "function") render();
    toast(first(e && e.name) + " is available " + summary(s.people[id].days) + ". The roster checks use this now.");
  }
  function copy(id) {
    const url = urlFor(id);
    const done = () => toast("Link copied. Paste it into a message to " + first((person(id) || {}).name) + ".");
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url)); else toast(url);
  }
  function send(id, channel) {
    const t = tokenFor(id), e = person(id), c = contact(id);
    const s = load(); s.links[t] = Object.assign(s.links[t] || { id }, { sentAt: new Date().toISOString(), channel }); save(s);
    toast("Availability link sent to " + first(e && e.name) + " by " + (channel === "sms" ? "SMS to " + c.mobile : "email to " + c.email) + " (simulated).");
    if (document.querySelector(".availLink")) open(id);
  }
  function sendAll() {
    const list = staff().filter((e) => contact(e.id).email || contact(e.id).mobile);
    list.forEach((e) => { const c = contact(e.id); const t = tokenFor(e.id); const s = load(); s.links[t] = Object.assign(s.links[t], { sentAt: new Date().toISOString(), channel: c.email ? "email" : "sms" }); save(s); });
    toast("Availability links sent to " + list.length + " educator" + (list.length === 1 ? "" : "s") + " (simulated).");
    openAll();
  }

  // ---------- owner: everyone ----------
  // Every educator's days in one place: tick or untick days, then save. A name opens their full availability.
  function openAll() {
    const s = load();
    const rows = staff().map((e) => {
      const rec = s.people[e.id], list = rec ? rec.days : (typeof Roster !== "undefined" ? Roster.profile(e).days : DAYS);
      const sent = Object.values(s.links).some((l) => l.id === e.id && l.sentAt);
      return '<div class="availRow" data-id="' + E(e.id) + '"><button type="button" class="availName" onclick="Availability.open(\'' + E(e.id) + '\')"><b>' + E(e.name) + "</b><small>" +
        (rec ? "Updated by " + (rec.by === "educator" ? E(first(e.name)) : "you") + " " + E(ago(rec.at)) + (rec.note ? " · " + E(rec.note) : "") : sent ? "Link sent, waiting for " + E(first(e.name)) : "Usual days on file") + "</small></button>" +
        '<span class="availToggles">' + DAYS.map((d) => '<label class="availDay mini" title="' + DAY_NAME[d] + '"><input type="checkbox" value="' + d + '"' + (list.includes(d) ? " checked" : "") + "><span>" + d + "</span></label>").join("") + "</span></div>";
    }).join("");
    openModal(
      '<div class="modalHead"><div><h2>Availability</h2><p>Which days each educator can work. Tick or untick days and save; the roster and Fill gaps with AI use these days.</p></div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="availList">' + rows + "</div>" +
      '<div class="formActions"><button class="button" onclick="Availability.sendAll()">Ask everyone to update theirs</button><button class="button primary" onclick="Availability.saveAll()">Save availability</button></div>' +
      '<p class="footnote">Click a name for notes and their personal update link. Email and SMS are simulated. Availability is kept in this browser, like the roster.</p>', "wide"
    );
  }
  function saveAll() {
    const s = load();
    let changed = 0;
    document.querySelectorAll(".availRow").forEach((row) => {
      const id = row.dataset.id, e = person(id);
      if (!e) return;
      const days = [...row.querySelectorAll("input:checked")].map((x) => x.value);
      const before = s.people[id] ? s.people[id].days : (typeof Roster !== "undefined" ? Roster.profile(e).days : DAYS);
      if (days.join() === DAYS.filter((d) => before.includes(d)).join()) return;
      s.people[id] = { days, note: s.people[id] ? s.people[id].note : "", by: "owner", at: new Date().toISOString() };
      changed++;
    });
    save(s);
    closeModal();
    if (typeof render === "function") render();
    toast(changed ? "Availability saved for " + changed + " educator" + (changed === 1 ? "" : "s") + ". The roster checks use it now." : "No changes to save.");
  }

  // ---------- educator: the link page ----------
  let linkRoot = null, inApp = false, current = null;
  function showPage(token, fromApp) {
    inApp = !!fromApp;
    linkRoot = document.getElementById("linkRoot");
    if (!linkRoot) { linkRoot = document.createElement("div"); linkRoot.id = "linkRoot"; document.body.appendChild(linkRoot); }
    linkRoot.classList.remove("hidden");
    const s = load(), link = s.links[token];
    const brand = typeof StaffAgent !== "undefined" ? StaffAgent.brand() : "<b>beehive</b>";
    const back = inApp ? '<button class="textButton" style="margin-top:24px" onclick="Availability.closePage()">Back to the owner view</button>' : "";
    if (!link) { linkRoot.innerHTML = '<div class="linkPage">' + brand + '<h1>This link isn’t valid</h1><p class="muted">Ask the centre to send you a new availability link.</p>' + back + "</div>"; return; }
    current = { token, id: link.id, name: link.name || ((person(link.id) || {}).name) || "" };
    const rec = s.people[link.id], list = rec ? rec.days : (typeof Roster !== "undefined" && person(link.id) ? Roster.profile(person(link.id)).days : DAYS);
    linkRoot.innerHTML =
      '<div class="linkPage availPage">' + brand + '<p class="linkCentre">' + E(typeof CENTRE_NAME !== "undefined" ? CENTRE_NAME : "") + "</p>" +
      "<h1>Hi " + E(first(current.name)) + ", which days can you work?</h1>" +
      '<p class="muted">Tick every day you’re available. The centre builds the roster from this.</p>' + dayPicker(list) +
      '<label class="formLabel" for="availNote">Anything the centre should know? (optional)</label><textarea id="availNote" rows="3" placeholder="For example: I can’t start before 8 am">' + E(rec ? rec.note : "") + "</textarea>" +
      '<div class="formActions" style="justify-content:flex-start"><button class="button primary" onclick="Availability.saveEducator()">Send to the centre</button></div>' +
      '<p class="footnote">Demo prototype: this page stands in for the link in the (simulated) email or SMS.</p>' + back + "</div>";
  }
  function saveEducator() {
    if (!current) return;
    const list = picked();
    const s = load();
    s.people[current.id] = { days: list, note: ((document.getElementById("availNote") || {}).value || "").trim(), by: "educator", at: new Date().toISOString() };
    save(s);
    const brand = typeof StaffAgent !== "undefined" ? StaffAgent.brand() : "<b>beehive</b>";
    linkRoot.innerHTML = '<div class="linkPage">' + brand + "<h1>Thanks, " + E(first(current.name)) + "</h1><p class=\"muted\">The centre now has you down for " + E(summary(list)) + ". Open this link again any time your availability changes.</p>" +
      (inApp ? '<button class="textButton" style="margin-top:24px" onclick="Availability.closePage()">Back to the owner view</button>' : "") + "</div>";
  }
  function preview(id) { closeModal(); showPage(tokenFor(id), true); }
  function closePage() {
    if (linkRoot) { linkRoot.classList.add("hidden"); linkRoot.innerHTML = ""; }
    current = null;
    if (location.hash.startsWith("#availability/")) history.replaceState(null, "", location.pathname);
    if (typeof render === "function") render();
  }

  return { days, record, summary, open, openAll, saveAll, saveOwner, saveEducator, copy, send, sendAll, preview, linkToken, showPage, closePage };
})();
