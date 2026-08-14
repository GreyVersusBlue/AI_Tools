// bmg-legend.js — auto-built key: one row per distinct marker style+color
// combo in use, one row per shaded-region color+pattern combo, and one row
// per line color+style combo, each with an editable caption ("star = state
// capital", "red hatch = deforested area", "blue dashed = trade route").
// Marker rows also carry a color and size <select> so a whole style+color
// group (e.g. "every blue pin") can be recolored or resized after the
// fact, letting two colors of the same style stand for two different
// things. The panel is draggable in viewport (screen) space, independent
// of the map's own pan/zoom, so moving it out of the way doesn't touch the
// map itself. Rows themselves can also be dragged (by their grip handle)
// to reorder the key, independent of first-placed-first-listed order.

// Markers created before per-marker color existed (or placed with the
// default color) keep the plain `style` key so old saved captions aren't
// orphaned; only a non-default color gets a compound key.
export function markerLegendKey(style, color) {
  return color && color !== "blue" ? `${style}::${color}` : style;
}

// Same idea for regions: a plain fill (pattern "solid", the only kind that
// existed before hatching/dots did) keeps the bare color key so existing
// saved captions aren't orphaned; only a non-default pattern compounds it.
export function regionLegendKey(color, pattern) {
  return pattern && pattern !== "solid" ? `${color}::${pattern}` : color;
}

// And for lines: plain solid lines keep the bare color key; dashed/dotted
// compound it, so e.g. a dashed red line and a dotted red line get their
// own rows instead of sharing one "red" caption.
export function lineLegendKey(color, style) {
  return style && style !== "solid" ? `${color}::${style}` : color;
}

// Choropleth class rows are keyed by class index, not by colour: the whole
// point of a sequential ramp is that the colours are positions in an order,
// so "the third band" is the stable thing to hang a caption on. Rebuilding
// the map with a different ramp keeps whatever the teacher typed.
export function choroLegendKey(classIndex) {
  return `choro:${classIndex}`;
}

export function createLegendPanel(panelEl, {
  onMarkerTextChange, onRegionTextChange, onLineTextChange, onChoroTextChange,
  onMarkerColorChange, onMarkerSizeChange, onMove, onReorder,
  onNumberedTextChange, onNumberedColorChange, onNumberedSizeChange,
} = {}) {
  let pos = { x: 12, y: 12 };
  let dragging = false, startX = 0, startY = 0, startPos = null;

  function setPosition(p) { pos = p; apply(); }
  function apply() {
    panelEl.style.left = `${pos.x}px`;
    panelEl.style.top = `${pos.y}px`;
  }

  /** Adds a small drag handle to a built row and wires native HTML5 drag-and-drop to reorder rows — independent of the panel's own pointer-based whole-panel drag, and of each row's input/select controls (which stop pointer propagation so they don't fight the panel drag). */
  function makeRowDraggable(row, key) {
    row.dataset.legendKey = key;
    const handle = document.createElement("span");
    handle.className = "legend-grip";
    handle.setAttribute("data-no-pan", "");
    handle.title = "Drag to reorder";
    handle.textContent = "⋮⋮";
    handle.draggable = true;
    row.prepend(handle);
    handle.addEventListener("pointerdown", e => e.stopPropagation());
    handle.addEventListener("dragstart", e => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", key);
      row.classList.add("dragging-row");
    });
    handle.addEventListener("dragend", () => row.classList.remove("dragging-row"));
    row.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
    row.addEventListener("drop", e => {
      e.preventDefault();
      const draggedKey = e.dataTransfer.getData("text/plain");
      if (!draggedKey || draggedKey === key) return;
      onReorder?.(draggedKey, key);
    });
  }

  function buildCaptionRow(key, legendText, iconHtml, placeholder, onInput) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-icon" data-no-pan>${iconHtml}</span>
      <input type="text" class="legend-input" data-no-pan>
    `;
    const input = row.querySelector("input");
    // Set as a property, not in the markup: a choropleth row's placeholder is
    // its generated numeric range, which is data rather than a literal.
    input.placeholder = placeholder;
    input.value = (legendText && legendText[key]) || "";
    input.addEventListener("input", () => onInput?.(key, input.value));
    input.addEventListener("pointerdown", e => e.stopPropagation());
    return row;
  }

  function buildMarkerRow(group, legendText, iconSvg, markerColorHex, colorOptions, sizeOptions) {
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

    return { row, key };
  }

  // Numbered markers (style "number") each mean something different by
  // design — unlike other marker styles, they don't share one legend row
  // per style+color group. Each gets its own row instead, keyed by the
  // marker's own id (not a style::color key) so its caption stays attached
  // to that specific pin even if its color changes or other numbered pins
  // are added/removed around it.
  function buildNumberedRow(marker, number, legendText, iconSvg, markerColorHex, colorOptions, sizeOptions) {
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

    return { row, key };
  }

  /** Sorts row descriptors per a saved key order — keys not yet in `order` keep their original (natural grouping) relative order, appended after any explicitly-ordered ones, so newly-added annotations show up without needing a manual reorder first. */
  function applyOrder(items, order) {
    const orderIndex = new Map((order || []).map((k, i) => [k, i]));
    return items
      .map((item, i) => ({ item, i, o: orderIndex.has(item.key) ? orderIndex.get(item.key) : Infinity }))
      .sort((a, b) => (a.o - b.o) || (a.i - b.i))
      .map(x => x.item);
  }

  /**
   * Rebuilds the panel from the current marker/region/line sets. Hidden
   * when all three are empty. Takes a single options bag since it threads
   * together three annotation types' worth of data plus the marker-only
   * color/size editing controls. `order` is the saved row order (array of
   * legend keys); rows render in that sequence with any new/unordered rows
   * appended at the end.
   */
  function render({
    markers, legendText, iconSvg, markerColorHex, colorOptions = [], sizeOptions = [],
    regions, regionLegendText, swatchSvg,
    lines, lineLegendText, lineSwatchSvg: lineSwatch,
    choroRows, choroLegendText, choroSwatchSvg: choroSwatch,
    order,
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
    const regionGroups = [];
    const seenRegionGroup = new Set();
    (regions || []).forEach(r => {
      const gkey = regionLegendKey(r.color, r.pattern);
      if (seenRegionGroup.has(gkey)) return;
      seenRegionGroup.add(gkey);
      regionGroups.push({ color: r.color, pattern: r.pattern });
    });
    const lineGroups = [];
    const seenLineGroup = new Set();
    (lines || []).forEach(l => {
      const gkey = lineLegendKey(l.color, l.style);
      if (seenLineGroup.has(gkey)) return;
      seenLineGroup.add(gkey);
      lineGroups.push({ color: l.color, style: l.style });
    });
    const choro = (choroRows || []).filter(r => r && r.hex);
    if (!groups.length && !numbered.length && !regionGroups.length && !lineGroups.length && !choro.length) { panelEl.hidden = true; return; }
    panelEl.hidden = false;

    const items = [];
    // Data-shading classes lead the key by default: on a shaded map they are
    // what the reader has to decode before anything else means much. They are
    // still ordinary draggable rows, so a teacher can reorder them.
    choro.forEach(r => items.push({
      row: buildCaptionRow(r.key, choroLegendText, choroSwatch(r.hex, 18), r.label, onChoroTextChange),
      key: r.key,
    }));
    groups.forEach(g => items.push(buildMarkerRow(g, legendText, iconSvg, markerColorHex, colorOptions, sizeOptions)));
    numbered.forEach((m, i) => items.push(buildNumberedRow(m, i + 1, legendText, iconSvg, markerColorHex, colorOptions, sizeOptions)));
    regionGroups.forEach(g => {
      const key = regionLegendKey(g.color, g.pattern);
      items.push({ row: buildCaptionRow(key, regionLegendText, swatchSvg(g.color, 18, g.pattern), "What does this shading mean?", onRegionTextChange), key });
    });
    lineGroups.forEach(g => {
      const key = lineLegendKey(g.color, g.style);
      items.push({ row: buildCaptionRow(key, lineLegendText, lineSwatch(g.color, 18, g.style), "What does this line mean?", onLineTextChange), key });
    });

    panelEl.innerHTML = `<div class="legend-title" data-no-pan>Key</div>`;
    applyOrder(items, order).forEach(({ row, key }) => {
      makeRowDraggable(row, key);
      panelEl.appendChild(row);
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
