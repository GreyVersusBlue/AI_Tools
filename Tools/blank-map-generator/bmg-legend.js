// bmg-legend.js — auto-built key: one row per marker style currently on
// the map, each with an editable caption ("star = state capital"). The
// panel is draggable in viewport (screen) space, independent of the map's
// own pan/zoom, so moving it out of the way doesn't touch the map itself.

export function createLegendPanel(panelEl, { onTextChange, onMove } = {}) {
  let pos = { x: 12, y: 12 };
  let dragging = false, startX = 0, startY = 0, startPos = null;

  function setPosition(p) { pos = p; apply(); }
  function apply() {
    panelEl.style.left = `${pos.x}px`;
    panelEl.style.top = `${pos.y}px`;
  }

  /** Rebuilds the panel from the current marker set. Hidden when no markers exist. */
  function render(markers, legendText, iconSvg) {
    const styles = [...new Set((markers || []).map(m => m.style))];
    if (!styles.length) { panelEl.hidden = true; return; }
    panelEl.hidden = false;
    panelEl.innerHTML = `<div class="legend-title" data-no-pan>Key</div>`;
    styles.forEach(style => {
      const row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = `
        <span class="legend-icon" data-no-pan>${iconSvg(style, 18)}</span>
        <input type="text" class="legend-input" data-no-pan placeholder="What does this mean?">
      `;
      const input = row.querySelector("input");
      input.value = (legendText && legendText[style]) || "";
      input.addEventListener("input", () => onTextChange?.(style, input.value));
      input.addEventListener("pointerdown", e => e.stopPropagation());
      panelEl.appendChild(row);
    });
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
