// beehive Legal page: spot check requirements, ACECQA requirements and new regulations, on one page.
//
// - Spot checks: what an authorised officer can ask to see on an unannounced visit, checked against today.
// - ACECQA requirements: the centre's approved requirement list (from the audit agent), grouped by area.
// - New regulations: when a regulation or guidance change comes in, it sits at the top of the page until the
//   owner reviews it. "Review" opens a side panel with what changed, which requirements it touches, how to
//   comply and the decision buttons. Once every decision is recorded, the change moves into the requirement
//   list under "Regulation changes".
// beehive never changes a policy or a requirement's status from a change on its own: it explains, the owner decides.
const Legal = (() => {
  const E = (s) => (typeof esc === "function" ? esc(s == null ? "" : s) : String(s == null ? "" : s));
  const reqItems = () => (typeof items !== "undefined" ? items.filter((x) => !x.omitted) : []);
  const reqStatus = (x) => {
    const r = x.req && x.req.status;
    if (r) return r === "compliant" ? ["green", "On track"] : r === "under_review" ? ["yellow", "Under review"] : ["red", "Gap"];
    return x.status === "green" ? ["green", "On track"] : x.status === "yellow" ? ["yellow", "Review due"] : ["red", "Gap"];
  };
  const fmtDate = (d) => {
    if (!d) return "";
    const t = new Date(String(d).length === 10 ? d + "T00:00:00" : d);
    return isNaN(t) ? String(d) : t.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  };
  const DECISION = { no_change: "No change needed", update_needed: "Policy needs updating", not_applicable: "Doesn’t apply to us" };

  // ---------- regulation changes, in one shape whichever agent holds them ----------
  // { id, title, summary, published, source, assessment, open, inProgress, reviews: [...], legacy }
  function updates() {
    if (typeof auditOn === "function" && auditOn()) {
      const d = AuditAgent.data();
      return d.updates.map((u) => {
        const reviews = d.reviews.filter((r) => r.updateId === u.id);
        return {
          id: u.id, title: u.title, summary: u.summary, published: u.published, source: u.source, assessment: u.assessment, demo: u.demo,
          open: u.status !== "reviewed" || reviews.some((r) => !r.decision),
          inProgress: reviews.some((r) => r.decision === "update_needed" && !r.completedAt),
          reviews,
        };
      });
    }
    // Before the audit agent is set up: the single regulation update from the older tables (or the sample one offline).
    const live = typeof LIVE !== "undefined" && LIVE;
    if (live && !regUpdate) return [];
    const reviewed = live ? regUpdate.status === "reviewed" : !!saved.updateReviewed;
    const accepted = live ? regUpdate.status === "accepted" : !!saved.updateAccepted;
    return [{
      id: "legacy", legacy: true, accepted,
      title: regUpdate ? regUpdate.title : "Safe sleep guidance review",
      summary: regUpdate ? regUpdate.summary : "New safe sleep guidance may affect the centre’s Sleep and Rest Policy.",
      published: regUpdate ? regUpdate.published : "",
      source: "https://www.acecqa.gov.au/QA2-information-sheet-sleep-and-rest-legislative-requirements",
      open: !reviewed, inProgress: false, reviews: [],
    }];
  }
  const openUpdates = () => updates().filter((u) => u.open);
  function openCount() { return openUpdates().length; }

  // ---------- the review side panel ----------
  function reviewHtml(r, u) {
    const x = r.itemId && typeof findItem === "function" ? findItem(r.itemId) : null;
    const s = x ? reqStatus(x) : null;
    const key = x ? x.key || x.id : "";
    const guide = key && typeof Library !== "undefined" ? Library.itemSection(key) : "";
    return (
      '<div class="regReview">' +
      '<div class="regReviewHead"><b>' + E(x ? x.title : "No requirement clearly matches") + "</b>" + (s ? '<span class="status ' + s[0] + '">' + s[1] + "</span>" : "") + "</div>" +
      (r.reason ? "<p>" + E(r.reason) + "</p>" : "") +
      (r.recommended ? '<div class="nextBox"><b>How to comply</b><p>' + E(r.recommended) + "</p></div>" : "") +
      (guide ? '<details class="more"><summary>Official guidance for this requirement</summary>' + guide + "</details>" : "") +
      (r.decision
        ? '<p class="decisionDone"><span class="status ' + (r.decision === "update_needed" && !r.completedAt ? "medium" : "green") + '">' + DECISION[r.decision] + "</span>" +
          (r.decidedAt ? " Recorded " + E(fmtDate(String(r.decidedAt).slice(0, 10))) : "") + (r.note ? ". " + E(r.note) : "") +
          (r.decision === "update_needed" && !r.completedAt && x ? ' <button class="textButton" onclick="AuditAgent.openActionFor(\'' + E(u.id) + "','" + E(x.id) + '\')">Open the task</button>' : "") + "</p>"
        : '<label class="formLabel" for="rn-' + E(r.id) + '">Your note (optional)</label><input class="formControl" id="rn-' + E(r.id) + '" placeholder="What you checked">' +
          '<div class="buttonRow decisionBtns">' +
          ["no_change", "update_needed", "not_applicable"].map((d) => '<button class="button' + (d === "no_change" ? " primary" : "") + '" onclick="Legal.decide(\'' + E(r.id) + "','" + d + "','" + E(u.id) + '\')">' + DECISION[d] + "</button>").join("") +
          "</div>") +
      "</div>"
    );
  }
  function openUpdate(id) {
    const u = updates().find((y) => y.id === id);
    if (!u) return closeModal();
    const pending = u.reviews.filter((r) => !r.decision).length;
    const body = u.legacy
      ? '<div class="nextBox"><b>How to comply</b><p>Check your sleep and rest procedures against the latest guidance and your approved policy, then record the review.</p></div>' +
        (typeof Library !== "undefined" ? '<details class="more"><summary>Official guidance: sleep and rest</summary>' + Library.itemSection("sleep") + "</details>" : "") +
        '<div class="formActions">' + (!u.open ? '<span class="status green">Reviewed</span>'
          : u.accepted ? '<button class="button primary" onclick="Legal.legacyStep(\'reviewed\')">Mark review complete</button>'
          : '<button class="button primary" onclick="Legal.legacyStep(\'accept\')">Accept and flag the policy for review</button>') + "</div>"
      : (u.reviews.length ? '<h3 class="regH">Requirements it touches</h3>' + u.reviews.map((r) => reviewHtml(r, u)).join("")
          : '<p class="muted">beehive hasn’t matched this change to a requirement yet. Read the official source and confirm whether it applies.</p>');
    openModal(
      '<div class="modalHead"><div><p class="regKicker">' + (u.open ? "New regulation · needs your review" : u.inProgress ? "Reviewed · policy update in progress" : "Reviewed") + "</p><h2>" + E(u.title) + "</h2>" +
        (u.published ? "<p>Published " + E(fmtDate(u.published)) + "</p>" : "") + '</div><button class="closeButton" aria-label="Close" onclick="closeModal()">×</button></div>' +
      '<div class="modalSection"><h3>What changed</h3><p>' + E(u.summary) + "</p>" + (u.assessment ? '<p class="muted small" style="margin-top:8px">' + E(u.assessment) + "</p>" : "") +
        (u.source ? '<p class="small" style="margin-top:8px"><a href="' + E(u.source) + '" target="_blank" rel="noopener">Read the official source</a></p>' : "") + "</div>" +
      body +
      (pending ? '<p class="footnote">Record a decision for each requirement. Once they’re all recorded, this change moves into your requirement list.</p>' : "") +
      '<p class="footnote">Guidance, not legal advice. beehive flags what a change may affect; it never rewrites a policy on its own.</p>',
      "wide"
    );
  }
  async function decide(reviewId, decision, updateId) {
    await AuditAgent.decide(reviewId, decision);
    const u = updates().find((y) => y.id === updateId);
    if (u && u.open) return openUpdate(updateId);
    closeModal();
    toast("Review recorded. “" + (u ? u.title : "The change") + "” is now in your requirement list under Regulation changes.");
  }
  async function legacyStep(step) {
    if (step === "accept") await acceptUpdate(); else await markUpdateReviewed();
    const u = updates()[0];
    if (u && u.open) openUpdate(u.id); else closeModal();
  }
  // From anywhere in beehive: open Legal and the first change that needs the owner.
  function reviewUpdates() {
    if (typeof current === "undefined" || current !== "legal") go("legal");
    const u = openUpdates()[0];
    if (u) openUpdate(u.id);
  }

  // ---------- spot check requirements ----------
  function today() { const d = new Date(); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" }); }
  // What an authorised officer can ask to see on an unannounced visit, and whether beehive's records show it.
  function spotChecks() {
    const day = today();
    const hasRoster = typeof Roster !== "undefined";
    const on = hasRoster ? Roster.forDay(day) : [];
    const c = hasRoster ? Roster.check(day, Object.fromEntries(on.map((r) => [r.e.id, { shift: "mid" }]))) : null;
    const ed = typeof educators !== "undefined" ? educators : [];
    const noWwcc = ed.filter((e) => !(e.certs || []).some((k) => k.type === "WWCC" && k.days >= 0));
    const kids = typeof Centre !== "undefined" ? Centre.children() : [];
    const plans = kids.filter((k) => /anaphyla|asthma/i.test(k.conditions || ""));
    const ect = hasRoster && on.some((r) => Roster.profile(r.e).qual === "Early childhood teacher");
    const noRoster = !on.length;
    return [
      { label: "Provider and service approvals on display", why: "Reg 173", tone: "green", status: "On display" },
      { label: "Quality rating, nominated supervisor and responsible person on display", why: "Regs 173, 150", tone: "green", status: "On display" },
      { label: "Every educator working today has a current WWCC", why: "Regs 145–147",
        tone: noWwcc.length ? "yellow" : "green", status: noWwcc.length ? noWwcc.length + " not current, kept off the roster" : "All current", act: "go('staff')" },
      { label: "Educator-to-child ratios met today", why: "Regs 123, 271",
        tone: noRoster || (c && c.issues.length) ? "red" : "green", status: noRoster ? "No roster today" : c && c.issues.length ? "Under ratio" : "Met", act: "go('roster')" },
      { label: "At least 50% of educators hold a diploma today", why: "Reg 126",
        tone: noRoster || !(c && c.diplomaOk) ? "red" : "green", status: noRoster ? "No roster today" : c ? c.diplomas + " with a diploma, " + c.diplomaNeeded + " needed" : "", act: "go('roster')" },
      { label: "Early childhood teacher on site today", why: "Regs 130–134",
        tone: noRoster ? "red" : ect ? "green" : "yellow", status: noRoster ? "No roster today" : ect ? "Rostered" : "Not rostered today", act: "go('roster')" },
      { label: "First aid, anaphylaxis and asthma-trained educator on site", why: "Reg 136",
        tone: on.some((r) => r.firstAid) ? "green" : "red", status: on.some((r) => r.firstAid) ? "Covered" : noRoster ? "No roster today" : "Not covered", act: "go('roster')" },
      { label: "Children’s attendance signed in and out", why: "Reg 158", tone: "green", status: "Daily sheet ready", act: "Centre.openFull()" },
      { label: "Medical management plans for children who need them", why: "Regs 90–91",
        tone: plans.every((k) => k.plan) ? "green" : "red", status: plans.length ? plans.filter((k) => k.plan).length + " of " + plans.length + " on file" : "None needed", act: "go('compliance')" },
      // also ACECQA requirements, but an officer asks for them on the day, so they're here too
      itemRow("evacuation", "Emergency evacuation rehearsed this quarter", "Regs 97, 98"),
      itemRow("incidents", "Incident, injury, trauma and illness records", "Regs 85–87"),
      itemRow("premises", "Premises and safety checks", "Regs 103–115"),
    ].filter(Boolean);
  }
  function itemRow(id, label, why) {
    const x = reqItems().find((y) => y.id === id || y.key === id);
    if (!x) return null;
    const s = reqStatus(x);
    return { label, why, tone: s[0], status: s[1], act: "openItem('" + x.id + "')" };
  }
  function row(r) {
    return '<div class="checkRow"><button ' + (r.act ? 'onclick="' + r.act + '"' : "disabled") + '><span class="rowMain"><b>' + E(r.label) + "</b><small>" + E(r.why) + '</small></span><span class="rowEnd"><span class="status ' + r.tone + '">' + E(r.status) + "</span>" + (r.act ? '<span class="chev">' + ico("chevron") + "</span>" : "") + "</span></button></div>";
  }

  // ---------- the page ----------
  function alerts(list) {
    if (!list.length) return "";
    return '<section class="regAlerts" aria-label="New regulations">' + list.map((u) =>
      '<div class="regAlert"><span class="hx lg"></span><div class="rowMain"><small>New regulation · needs your review</small><b>' + E(u.title) + "</b><p>" + E(u.summary) + "</p></div>" +
      '<button class="button primary" onclick="Legal.openUpdate(\'' + E(u.id) + '\')">Review</button></div>').join("") + "</section>";
  }
  function page() {
    const spots = spotChecks();
    const spotGaps = spots.filter((r) => r.tone !== "green").length;
    const list = reqItems();
    const areas = Array.from(new Set(list.map((x) => x.area)));
    const gaps = list.filter((x) => reqStatus(x)[0] !== "green").length;
    const ups = updates(), open = ups.filter((u) => u.open), done = ups.filter((u) => !u.open);
    return (
      header("Legal", (spotGaps ? spotGaps + " spot check item" + (spotGaps === 1 ? "" : "s") + " to fix" : "Ready for a spot check") + " · " + (list.length - gaps) + " of " + list.length + " ACECQA requirements on track" + (open.length ? " · " + open.length + " new regulation" + (open.length === 1 ? "" : "s") + " to review" : "") + ".",
        '<button class="button" onclick="exportReport()"><span data-icon="download"></span>Export audit report</button>') +
      alerts(open) +
      '<section class="section"><div class="sectionHead"><h2>Spot check requirements<span class="count">' + spots.length + "</span></h2><p>What an authorised officer can ask to see on an unannounced visit, checked against today</p></div>" +
        '<section class="areaBlock">' + spots.map(row).join("") + "</section></section>" +
      '<section class="section"><div class="sectionHead"><h2>ACECQA requirements<span class="count">' + (list.length + done.length) + "</span></h2><p>The National Law and Regulations your centre is assessed against</p></div>" +
        areas.map((a) => '<section class="areaBlock"><h3>' + E(a) + '<span class="count">' + list.filter((x) => x.area === a).length + "</span></h3>" +
          list.filter((x) => x.area === a).map((x) => { const s = reqStatus(x); return row({ label: x.title, why: x.source || "", tone: s[0], status: s[1], act: "openItem('" + x.id + "')" }); }).join("") + "</section>").join("") +
        (done.length ? '<section class="areaBlock"><h3>Regulation changes<span class="count">' + done.length + "</span></h3>" +
          done.map((u) => row({ label: u.title, why: "Reviewed" + (u.published ? " · published " + fmtDate(u.published) : ""), tone: u.inProgress ? "medium" : "green", status: u.inProgress ? "Policy update in progress" : "Reviewed", act: "Legal.openUpdate('" + E(u.id) + "')" })).join("") + "</section>" : "") +
      "</section>" +
      '<p class="footnote">Guidance, not legal advice. Open any requirement to see its evidence, upload a document or assign it.</p>'
    );
  }
  return { page, spotChecks, openCount, openUpdate, decide, legacyStep, reviewUpdates };
})();
