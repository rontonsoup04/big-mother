// Beehive compliance library: official documents behind each checklist item,
// with a plain-English summary and steps. Offline mode uses LIBRARY_DATA
// (library-data.js); live mode replaces it with the copy in Supabase.

const Library = (() => {
  const AREA_NAMES = {
    staff_records: "Staff Records",
    childrens_records: "Children’s Records",
    safety_premises: "Safety & Premises",
    policies_procedures: "Policies & Procedures",
  };
  let data = typeof LIBRARY_DATA !== "undefined" ? LIBRARY_DATA : { checked: "", general: [], guides: [] };
  let source = "offline";
  let filter = "All";

  const guide = (key) => data.guides.find((g) => g.item_key === key);
  const fmtChecked = () => {
    if (!data.checked) return "";
    const d = new Date(data.checked + "T00:00:00");
    return isNaN(d) ? data.checked : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  };

  // Live mode: read the library from Supabase (falls back to the bundled copy).
  async function loadFrom(sb) {
    try {
      const [g, d] = await Promise.all([
        sb.from("compliance_guides").select("*").order("sort"),
        sb.from("compliance_documents").select("*").order("sort"),
      ]);
      if (g.error || d.error || !g.data || !g.data.length) return;
      const docs = d.data;
      data = {
        checked: g.data.reduce((m, x) => { const c = String(x.checked_on || "").slice(0, 10); return c > m ? c : m; }, ""),
        general: docs.filter((x) => !x.item_key),
        guides: g.data.map((x) => Object.assign({}, x, { documents: docs.filter((y) => y.item_key === x.item_key) })),
      };
      source = "database";
      if (typeof current !== "undefined" && current === "library") render();
    } catch (e) { /* keep bundled copy */ }
  }

  function docRow(d) {
    return (
      '<a class="docRow" href="' + esc(d.url) + '" target="_blank" rel="noopener">' +
      '<span class="docType">' + esc(d.doc_type || d.type || "Document") + "</span>" +
      '<span class="docText"><b>' + esc(d.title) + "</b><small>" + esc(d.issuer) + (d.published ? " · " + esc(d.published) : "") + "</small>" +
      (d.note ? "<em>" + esc(d.note) + "</em>" : "") + "</span>" +
      '<span class="docOpen" aria-hidden="true">↗</span></a>'
    );
  }

  function guideCard(g) {
    const item = typeof findItemByKey === "function" ? findItemByKey(g.item_key) : null;
    const chip = item ? '<span class="status ' + item.status + '">' + statusLabel(item.status) + "</span>" : "";
    return (
      '<article class="card guideCard" id="guide-' + esc(g.item_key) + '">' +
      '<div class="guideHead"><div><div class="eyebrow">' + esc(AREA_NAMES[g.area] || g.area) + "</div><h2>" + esc(g.title) + "</h2>" +
      '<p class="guideRefs">' + esc(g.source_ref) + "</p></div>" + chip + "</div>" +
      '<p class="guideSummary">' + esc(g.summary) + "</p>" +
      '<details class="guideSteps"' + (filter !== "All" ? " open" : "") + "><summary>What to do · " + g.directions.length + " steps</summary><ol>" +
      g.directions.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol></details>" +
      '<div class="guideFacts">' +
      (g.evidence ? '<div><span>Show an officer</span><p>' + esc(g.evidence) + "</p></div>" : "") +
      (g.retention ? '<div><span>Keep records</span><p>' + esc(g.retention) + "</p></div>" : "") +
      "</div>" +
      '<div class="guideDocs"><span class="guideDocsLabel">Official documents</span>' + (g.documents || []).map(docRow).join("") + "</div>" +
      (item ? '<div class="guideActions"><button class="button small" onclick="openItem(\'' + item.id + '\')">Open checklist item</button></div>' : "") +
      "</article>"
    );
  }

  function page() {
    const areas = ["All", "Key references"].concat(Object.values(AREA_NAMES));
    const chips = areas.map((a) =>
      '<button class="filterButton ' + (filter === a ? "active" : "") + '" onclick="Library.setFilter(\'' + a.replace(/’/g, "\\u2019") + '\')">' + esc(a) + "</button>").join("");
    const showRefs = filter === "All" || filter === "Key references";
    const groups = Object.entries(AREA_NAMES)
      .filter(([, name]) => filter === "All" || filter === name)
      .map(([key, name]) => {
        const gs = data.guides.filter((g) => g.area === key);
        return gs.length ? '<section class="libGroup"><h3 class="libGroupTitle">' + esc(name) + "</h3>" + gs.map(guideCard).join("") + "</section>" : "";
      }).join("");
    return (
      header(
        "Compliance library",
        "The official government documents behind every checklist item, with a plain-English summary and what to do.",
        '<button class="button" onclick="go(\'audit\')">Back to checklist</button>',
      ) +
      '<div class="libNote"><b>Sources checked ' + esc(fmtChecked()) + '</b> · ACECQA, NSW Legislation, NSW Department of Education, the NSW Early Learning Commission and the Office of the Children’s Guardian. ' +
      "Summaries are guidance only, not legal advice. Always confirm the current official document." +
      (LIVE ? "" : " <span class=\"libMode\">Offline copy</span>") + "</div>" +
      '<div class="areaFilters libFilters">' + chips + "</div>" +
      (showRefs
        ? '<section class="libGroup"><h3 class="libGroupTitle">Key references</h3><div class="card refCard">' + data.general.map(docRow).join("") + "</div></section>"
        : "") +
      groups
    );
  }

  // Short version inside a checklist item's dialog.
  function itemSection(key) {
    const g = guide(key);
    if (!g) return "";
    return (
      '<div class="modalSection libInModal"><h3>How to comply</h3><ol>' +
      g.directions.slice(0, 3).map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>" +
      (g.retention ? '<p class="libKeep"><b>Keep records:</b> ' + esc(g.retention) + "</p>" : "") +
      '<div class="guideDocs">' + (g.documents || []).slice(0, 2).map(docRow).join("") + "</div>" +
      '<button class="textButton libMore" onclick="Library.focus(\'' + esc(key) + '\')">All ' + g.directions.length + " steps and " + (g.documents || []).length + " official documents →</button></div>"
    );
  }

  function focus(key) {
    closeModal();
    filter = "All";
    go("library");
    setTimeout(() => {
      const el = document.getElementById("guide-" + key);
      if (!el) return;
      const d = el.querySelector("details");
      if (d) d.open = true;
      el.classList.add("guideFocus");
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => el.classList.remove("guideFocus"), 2200);
    }, 30);
  }

  function setFilter(a) { filter = a; render(); }

  // Search results for the top search bar (both modes).
  function searchHtml(value) {
    const terms = String(value || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return "";
    const hits = data.guides.filter((g) => {
      const text = (g.title + " " + g.source_ref + " " + g.summary + " " + (g.documents || []).map((d) => d.title).join(" ")).toLowerCase();
      return terms.every((t) => text.includes(t)) || (terms.join(" ").includes("wwc") && g.item_key === "wwcc");
    }).slice(0, 3);
    if (!hits.length) return "";
    return '<div class="resultHeading libResultHeading">Official guidance</div>' +
      hits.map((g) => '<button class="searchResult" onclick="document.getElementById(\'searchResults\').classList.add(\'hidden\');Library.focus(\'' + g.item_key + '\')"><b>' +
        esc(g.title) + " · guidance</b><small>" + esc(g.source_ref) + " · " + (g.documents || []).length + " official documents</small></button>").join("");
  }

  return { page, itemSection, focus, setFilter, searchHtml, loadFrom, guide, get source() { return source; } };
})();
