// bmg-legend.js — auto-built key: one row per marker style, plus one row
// per shaded-region color, currently on the map, each with an editable
// caption ("star = state capital", "red = deforested area"). The panel is
// draggable in viewport (screen) space, independent of the map's own
// pan/zoom, so moving it out of the way doesn't touch the map itself.

export function createLegendPanel(panelEl, { onMarkerTextChange, onRegionTextChange, onMove } = {}) {
  let pos = { x: 12, y: 12 };
  let dragging = false, startX = 0, startY = 0, startPos = null;

  function setPosition(p) { pos = p; apply(); }
  function apply() {
    panelEl.style.left = `${pos.x}px`;
    panelEl.style.top = `${pos.y}px`;
  }

  function addRow(key, legendText, iconHtml, placeholder, onInput) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-icon" data-no-pan>${iconHtml}</span>
      <input type="text" class="legend-input" data-no-pan placeholder="${placeholder}">
    `;
    const input = row.querySelector("input");
    input.value = (legendText && legendText[key]) || "";
    input.addEventListener("input", () => onInput?.(key, input.value));
    input.addEventListener("pointerdown", e => e.stopPropagation());
    panelEl.appendChild(row);
  }

  /** Rebuilds the panel from the current marker/region sets. Hidden when both are empty. */
  function render(markers, legendText, iconSvg, regions, regionLegendText, swatchSvg) {
    const styles = [...new Set((markers || []).map(m => m.style))];
    const colors = [...new Set((regions || []).map(r => r.color))];
    if (!styles.length && !colors.length) { panelEl.hidden = true; return; }
    panelEl.hidden = false;
    panelEl.innerHTML = `<div class="legend-title" data-no-pan>Key</div>`;
    styles.forEach(style => addRow(style, legendText, iconSvg(style, 18), "What does this mean?", onMarkerTextChange));
    colors.forEach(color => addRow(color, regionLegendText, swatchSvg(color, 18), "What does this shading mean?", onRegionTextChange));
    apply();
  }

  function pointerDown(e) {
    if (e.target.closest("input")) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startPos = { ...pos };
    panelEl.setPointerCapture(e.pointerId);
    panelEl.classList.add("dragging");
  }

  function pointerMove(e) {
    if (!dragging) return;
    pos = { x: startPos.x + (e.clientX - startX), y: startPos.y + (e.clientY - startY) };
    apply();
  }

  function pointerEnd() {
    if (!dragging) return;
    dragging = false;
    panelEl.classList.remove("dragging");
    onMove?.(pos);
  }

  panelEl.setAttribute("data-no-pan", "");
  panelEl.addEventListener("pointerdown", pointerDown);
  panelEl.addEventListener("pointermove", pointerMove);
  panelEl.addEventListener("pointerup", pointerEnd);
  panelEl.addEventListener("pointercancel", pointerEnd);

  return { setPosition, render };
}
