// beehive "honey" shell: the bits of the layout that need a little script.
// - Command overlay for search (Ctrl/⌘K) and the mobile "More" sheet
// - A bee that flies across when something is ticked off
// Loads after app.js and only wraps go() and render(); every page and feature works as before.
(function () {
  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- bee ----------
  window.honeyBee = function () {
    if (reduced()) return;
    const b = document.getElementById("flyingBee");
    if (!b) return;
    b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
    setTimeout(() => b.classList.remove("go"), 3400);
  };

  // ---------- command overlay ----------
  window.openCommand = function () {
    if (typeof isFamily === "function" && isFamily()) return;
    document.body.classList.add("commandOpen");
    const i = document.getElementById("globalSearch");
    setTimeout(() => i && i.focus(), 30);
  };
  window.closeCommand = function () {
    document.body.classList.remove("commandOpen");
  };

  // ---------- mobile "More" sheet ----------
  window.toggleMoreSheet = function (force) {
    const sh = document.getElementById("moreSheet"), btn = document.querySelector(".dockMore");
    if (!sh) return;
    const open = typeof force === "boolean" ? force : !sh.classList.contains("open");
    sh.classList.toggle("open", open);
    sh.setAttribute("aria-hidden", open ? "false" : "true");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (typeof fillIcons === "function") fillIcons(sh);
  };
  document.addEventListener("click", (e) => {
    const sh = document.getElementById("moreSheet");
    if (sh && sh.classList.contains("open") && e.target === sh) toggleMoreSheet(false);
  });
  // swipe up on the dock opens the sheet; swipe down on the sheet closes it
  let y0 = null;
  document.addEventListener("touchstart", (e) => { if (e.target.closest(".dock, .moreSheetInner")) y0 = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (dy < -40 && e.target.closest(".dock")) toggleMoreSheet(true);
    if (dy > 40 && e.target.closest(".moreSheetInner")) toggleMoreSheet(false);
  }, { passive: true });

  // ---------- one view ----------
  // On a laptop or tablet in landscape the page sits between the top row and the dock without scrolling:
  // two or more stacked sections are laid side by side, and each long list (a table, a section, a side
  // column) gets a height that ends at the bottom of the screen and scrolls inside itself.
  const oneView = window.matchMedia("(min-width: 900px) and (min-height: 620px)");
  const PANELS = ".tableWrap, .fitColumns > .section, .fitColumns > .areaBlock, .fitColumns > .update, .page > .update, .uploadLayout > *, .splitSide, .thread, [data-fit]";
  function columns(pg) {
    const kids = [...pg.children];
    for (let i = 0; i < kids.length; i++) {
      const kind = ["section.section", "section.areaBlock", "article.update"].find((k) => kids[i].matches(k));
      if (!kind) continue;
      let j = i;
      while (j + 1 < kids.length && kids[j + 1].matches(kind)) j++;
      if (j > i) {
        const wrap = document.createElement("div");
        wrap.className = "fitColumns";
        kids[i].before(wrap);
        kids.slice(i, j + 1).forEach((k) => wrap.appendChild(k));
        i = j;
      }
    }
  }
  // The main panel of a page reaches down to the dock, so short pages don't leave a gap at the bottom.
  const FILL = ".tableWrap, .splitSide, .canvas.hive";
  // The Overview hive: the canvas fills the space and the stage of cells grows with it.
  function fitHive(el, h) {
    el.style.height = h + "px";
    el.setAttribute("data-fitted", "1");
    const stage = el.querySelector(".hiveStage");
    if (!stage) return;
    const k = Math.max(1, Math.min((el.clientWidth - 24) / stage.offsetWidth, (h - 16) / stage.offsetHeight, 1.4));
    stage.style.transform = k > 1.01 ? "scale(" + k.toFixed(3) + ")" : "";
  }
  function fit() {
    const pg = document.getElementById("page");
    if (!pg) return;
    pg.querySelectorAll("[data-fitted]").forEach((el) => { el.style.maxHeight = ""; el.style.minHeight = ""; el.style.height = ""; el.removeAttribute("data-fitted"); });
    pg.querySelectorAll(".hiveStage").forEach((s) => { s.style.transform = ""; });
    if (!oneView.matches) return;
    const pr = pg.getBoundingClientRect(), cs = getComputedStyle(pg);
    const limit = pg.clientHeight - parseFloat(cs.paddingBottom);
    const last = pg.lastElementChild;
    const contentEnd = last ? last.getBoundingClientRect().bottom - pr.top + pg.scrollTop : 0;
    const panels = [...pg.querySelectorAll(PANELS + ", .canvas.hive")].filter((el) => !el.parentElement.closest(PANELS));
    panels.forEach((el) => {
      const r = el.getBoundingClientRect();
      const top = r.top - pr.top + pg.scrollTop;
      let block = el; // the page-level block holding this panel: whatever follows it must also fit
      while (block.parentElement && block.parentElement !== pg) block = block.parentElement;
      // its own column (in side-by-side layouts the neighbouring column's height doesn't count)
      let col = el;
      while (col.parentElement && col.parentElement !== pg && !col.parentElement.matches(".fitColumns, .splitView, .uploadLayout")) col = col.parentElement;
      const trailing = Math.max(0, contentEnd - (block.getBoundingClientRect().bottom - pr.top + pg.scrollTop)) + Math.max(0, col.getBoundingClientRect().bottom - r.bottom);
      const h = Math.max(200, Math.floor(limit - top - trailing - 6));
      if (el.matches(".canvas.hive")) return fitHive(el, Math.max(h, 520));
      // a few pixels over isn't worth a scrollbar (it flickers on and off as buttons lift on hover)
      if (r.height > h + 12) { el.style.maxHeight = h + "px"; el.setAttribute("data-fitted", "1"); }
      else if (r.height < h && el.matches(FILL) && !el.closest(".modal")) { el.style.minHeight = h + "px"; el.setAttribute("data-fitted", "1"); }
    });
  }
  let fitTimer = null;
  window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fit, 120); });

  // ---------- wrap navigation and rendering ----------
  const baseGo = window.go, baseRender = window.render;
  window.go = function () {
    closeCommand();
    toggleMoreSheet(false);
    const r = baseGo.apply(this, arguments);
    const page = document.getElementById("page");
    if (page) page.scrollTop = 0;
    window.scrollTo(0, 0);
    return r;
  };
  window.render = function () {
    const r = baseRender.apply(this, arguments);
    document.body.dataset.page = typeof current !== "undefined" ? current : "";
    const pg = document.getElementById("page");
    if (pg) { columns(pg); fit(); requestAnimationFrame(fit); }
    return r;
  };
  if (document.getElementById("page") && document.getElementById("page").innerHTML) window.render();
})();
