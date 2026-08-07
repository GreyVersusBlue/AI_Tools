// bmg-legend.js — auto-built key: one row per distinct marker style+color
// combo in use, one row per shaded-region color, and one row per line
// color, each with an editable caption ("star = state capital", "red =
// deforested area", "blue = trade route"). Marker rows also carry a color
// and size <select> so a whole style+color group (e.g. "every blue pin")
// can be recolored or resized after the fact, letting two colors of the
// same style stand for two different things. The panel is draggable in
// viewport (screen) space, independent of the map's own pan/zoom, so
// moving it out of the way doesn't touch the map itself.

// Markers created before per-marker color existed (or placed with the
// default color) keep the plain `style` key so old saved captions aren't
// orphaned; only a non-default color gets a compound key.
export function markerLegendKey(style, color) {
  return color && color !== "blue" ? `${style}::${color}` : style;
}

export function createLegendPanel(panelEl, {
  onMarkerTextChange, onRegionTextChange, onLineTextChange,
  onMarkerColorChange, onMarkerSizeChange, onMove,
  onNumberedTextChange, onNumberedColorChange, onNumberedSizeChange,
} = {}) {
  let pos = { x: 12, y: 12 };
  let dragging = false, startX = 0, startY = 0, startPos = null;

  function setPosition(p) { pos = p; apply(); }
  function apply() {
    panelEl.style.left = `${pos.x}px`;
    panelEl.style.top = `${pos.y}px`;
  }

  function addCaptionRow(key, legendText, iconHtml, placeholder, onInput) {
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

  function addMarkerRow(group, legendText, iconSvg, markerColorHex, colorOptions, sizeOptions) {
    const { style, color, size } = group;
    const key = markerLegendKey(style, color);
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-icon" data-no-pan>${iconSvg(style, 18, markerColorHex(color))}</span>
      <input type="text" class="legend-input compact" data-no-pan placeholder="What does this mean?">
      <select class="legend-select" data-no-pan title="Marker color"></select>
      <select class="legend-select" data-no-pan title="Marker size"></select>
    `;
    const [input, colorSelect, sizeSelect] = row.querySelectorAll("input, select");

    input.value = (legendText && legendText[key]) || "";
    input.addEventListener("input", () => onMarkerTextChange?.(key, input.value));
    input.addEventListener("pointerdown", e => e.stopPropagation());

    colorSelect.innerHTML = colorOptions.map(c => `<option value="${c.key}"${c.key === color ? " selected" : ""}>${c.name}</option>`).join("");
    colorSelect.addEventListener("pointerdown", e => e.stopPropagation());
    colorSelect.addEventListener("change", () => onMarkerColorChange?.(style, color, colorSelect.value));

    sizeSelect.innerHTML = sizeOptions.map(s => `<option value="${s.key}"${s.key === size ? " selected" : ""}>${s.label}</option>`).join("");
    sizeSelect.addEventListener("pointerdown", e => e.stopPropagation());
    sizeSelect.addEventListener("change", () => onMarkerSizeChange?.(style, color, sizeSelect.value));

    panelEl.appendChild(row);
  }

  // Numbered markers (style "number") each mean something different by
  // design — unlike other marker styles, they don't share one legend row
  // per style+color group. Each gets its own row instead, keyed by the
  // marker's own id (not a style::color key) so its caption stays attached
  // to that specific pin even if its color changes or other numbered pins
  // are added/removed around it.
  function addNumberedRow(marker, number, legendText, iconSvg, markerColorHex, colorOptions, sizeOptions) {
    const key = marker.id;
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-icon" data-no-pan>${iconSvg("number", 18, markerColorHex(marker.color), number)}</span>
      <input type="text" class="legend-input compact" data-no-pan placeholder="What is #${number}?">
      <select class="legend-select" data-no-pan title="Marker color"></select>
      <select class="legend-select" data-no-pan title="Marker size"></select>
    `;
    const [input, colorSelect, sizeSelect] = row.querySelectorAll("input, select");

    input.value = (legendText && legendText[key]) || "";
    input.addEventListener("input", () => onNumberedTextChange?.(key, input.value));
    input.addEventListener("pointerdown", e => e.stopPropagation());

    colorSelect.innerHTML = colorOptions.map(c => `<option value="${c.key}"${c.key === marker.color ? " selected" : ""}>${c.name}</option>`).join("");
    colorSelect.addEventListener("pointerdown", e => e.stopPropagation());
    colorSelect.addEventListener("change", () => onNumberedColorChange?.(key, colorSelect.value));

    sizeSelect.innerHTML = sizeOptions.map(s => `<option value="${s.key}"${s.key === marker.size ? " selected" : ""}>${s.label}</option>`).join("");
    sizeSelect.addEventListener("pointerdown", e => e.stopPropagation());
    sizeSelect.addEventListener("change", () => onNumberedSizeChange?.(key, sizeSelect.value));

    panelEl.appendChild(row);
  }

  /**
   * Rebuilds the panel from the current marker/region/line sets. Hidden
   * when all three are empty. Takes a single options bag since it threads
   * together three annotation types' worth of data plus the marker-only
   * color/size editing controls.
   */
  function render({
    markers, legendText, iconSvg, markerColorHex, colorOptions = [], sizeOptions = [],
    regions, regionLegendText, swatchSvg,
    lines, lineLegendText, lineSwatchSvg: lineSwatch,
  } = {}) {
    const groups = [];
    const seenGroup = new Set();
    const numbered = [];
    (markers || []).forEach(m => {
      if (m.style === "number") { numbered.push(m); return; }
      const gkey = `${m.style}::${m.color}`;
      if (seenGroup.has(gkey)) return;
      seenGroup.add(gkey);
      groups.push({ style: m.style, color: m.color, size: m.size });
    });
    const regionColors = [...new Set((regions || []).map(r => r.color))];
    const lineColors = [...new Set((lines || []).map(l => l.color))];
    if (!groups.length && !numbered.length && !regionColors.length && !lineColors.length) { panelEl.hidden = true; return; }
    panelEl.hidden = false;
    panelEl.innerHTML = `<div class="legend-title" data-no-pan>Key</div>`;
    groups.forEach(g => addMarkerRow(g, legendText, iconSvg, markerColorHex, colorOptions, sizeOptions));
    numbered.forEach((m, i) => addNumberedRow(m, i + 1, legendText, iconSvg, markerColorHex, colorOptions, sizeOptions));
    regionColors.forEach(color => addCaptionRow(color, regionLegendText, swatchSvg(color, 18), "What does this shading mean?", onRegionTextChange));
    lineColors.forEach(color => {
      const rep = (lines || []).find(l => l.color === color);
      addCaptionRow(color, lineLegendText, lineSwatch(color, 18, rep?.style), "What does this line mean?", onLineTextChange);
    });
    apply();
  }

  function pointerDown(e) {
    if (e.target.closest("input, select")) return;
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
