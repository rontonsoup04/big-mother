// beehive line icons (24px grid, stroke = currentColor) and the hexagon brand mark.
const ICON = (() => {
  const svg = (body, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + body + "</svg>";
  return {
    overview: svg('<path d="M4 13h6V4H4z"/><path d="M14 20h6v-9h-6z"/><path d="M14 8h6V4h-6z"/><path d="M4 20h6v-3H4z"/>'),
    audit: svg('<path d="M9 4h6v3H9z"/><path d="M15 5.5h2.5A1.5 1.5 0 0 1 19 7v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V7a1.5 1.5 0 0 1 1.5-1.5H9"/><path d="m9 14 2 2 4-4.5"/>'),
    staff: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8"/><path d="M17.5 14.8c1.6.6 2.7 2.2 3 4.7"/>'),
    updates: svg('<path d="M5 4.5h10l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z"/><path d="M14.5 4.5V9H19"/><path d="M8 13h8M8 16.5h5"/>'),
    compliance: svg('<path d="M12 3 5 6v5.5c0 4.3 3 7.6 7 9.5 4-1.9 7-5.2 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
    home: svg('<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9v10.5h12V9"/><path d="M10 19.5v-5h4v5"/>'),
    medical: svg('<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>'),
    messages: svg('<path d="M5 5h14a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-8l-4.5 3.5v-3.5H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
    certificate: svg('<rect x="4" y="4.5" width="16" height="11" rx="1"/><path d="M8 9h8M8 12h5"/><path d="m10 15.5-1 4.5 3-1.6 3 1.6-1-4.5"/>'),
    search: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.3-4.3"/>'),
    bell: svg('<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
    spark: svg('<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8-5.7-1.9L10.2 9z"/>'),
    chevron: svg('<path d="m9 6 6 6-6 6"/>'),
    upload: svg('<path d="M12 15.5V4.5"/><path d="m7.5 9 4.5-4.5L16.5 9"/><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>'),
    download: svg('<path d="M12 4.5v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>'),
    refresh: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.5H15"/>'),
    external: svg('<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10"/>'),
    // hexagon brand mark: outer cell with a smaller inner cell
    brand: '<svg viewBox="0 0 28 32" aria-hidden="true"><path d="M14 1.5 26 8.5v15L14 30.5 2 23.5v-15z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M14 10.5 19.5 13.7v6.6L14 23.5 8.5 20.3v-6.6z" fill="currentColor"/></svg>',
  };
})();
function fillIcons(root) {
  (root || document).querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.dataset.filled && ICON[el.dataset.icon]) { el.innerHTML = ICON[el.dataset.icon]; el.dataset.filled = "1"; }
  });
}
