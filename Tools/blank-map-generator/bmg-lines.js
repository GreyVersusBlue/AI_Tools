// bmg-lines.js — freehand line/arrow annotations (trade routes, migration
// paths, borders) drawn point-by-point like bmg-regions.js's shaded
// shapes, but as an open polyline instead of a closed filled polygon, with
// an optional arrowhead at the final point. Lives inside #stage in
// map-pixel coordinates (same as regions) so panning/zooming the map moves
// and scales them for free via the stage's own CSS transform; only each
// line's small delete chip needs screen-space treatment to stay a
// constant, tappable size.

import { PALETTE, colorHex } from "./bmg-colors.js";

export const LINE_COLORS = PALETTE;
export const lineColorHex = colorHex;
export const LINE_STYLES = [
  { key: "solid", label: "Solid" },
  { key: "dashed", label: "Dashed" },
];

export function lineSwatchSvg(color, size = 16, style = "solid") {
  const hex = lineColorHex(color);
  const dash = style === "dashed" ? ' stroke-dasharray="4 3"' : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"><line x1="2" y1="13" x2="14" y2="3" stroke="${hex}" stroke-width="2.2" stroke-linecap="round"${dash}/></svg>`;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function pointsAttr(points) { return points.map(p => `${p.x},${p.y}`).join(" "); }

function ensureArrowMarker(defsEl, colorKey) {
  const id = `bmg-arrowhead-${colorKey}`;
  if (defsEl.querySelector(`#${id}`)) return id;
  const marker = document.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", id);
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M0,0 L10,5 L0,10 z");
  path.setAttribute("fill", colorHex(colorKey));
  marker.appendChild(path);
  defsEl.appendChild(marker);
  return id;
}

export function createLineLayer(svgEl, chipLayerEl, viewer, { onChange, onDelete } = {}) {
  let lines = [];
  let draft = null; // { color, style, arrow, points: [{x,y}] } — the in-progress line being clicked out
  const chips = new Map(); // id -> element

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `line_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /** Matches the SVG's coordinate space to the map's natural pixel size. */
  function setSize(w, h) {
    if (!w || !h) return;
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svgEl.setAttribute("width", w);
    svgEl.setAttribute("height", h);
  }

  function setLines(list) {
    lines = list;
    draft = null;
    renderAll();
  }

  function getLines() { return lines; }

  function isDrafting() { return !!draft; }
  function draftPointCount() { return draft ? draft.points.length : 0; }

  function startDraft(color, style, arrow) { draft = { color, style, arrow, points: [] }; }

  function addDraftPoint(x, y) {
    if (!draft) return;
    draft.points.push({ x, y });
    renderAll();
  }

  /** Drops the most recent point without ending the draft — used to discard the phantom second click of a finishing double-click. */
  function popLastDraftPoint() {
    if (draft && draft.points.length) { draft.points.pop(); renderAll(); }
  }

  function cancelDraft() {
    draft = null;
    renderAll();
  }

  function finishDraft() {
    if (!draft || draft.points.length < 2) return null;
    const line = { id: newId(), color: draft.color, style: draft.style, arrow: draft.arrow, points: draft.points };
    lines.push(line);
    draft = null;
    renderAll();
    onChange?.(lines);
    return line;
  }

  function remove(id) {
    const removed = lines.find(l => l.id === id);
    lines = lines.filter(l => l.id !== id);
    renderAll();
    onChange?.(lines);
    if (removed) onDelete?.(removed);
  }

  /** Re-adds a previously removed line (used to undo a delete). */
  function restore(line) {
    lines.push(line);
    renderAll();
    onChange?.(lines);
  }

  function midpoint(points) {
    return points[Math.floor((points.length - 1) / 2)];
  }

  function renderAll() {
    renderSvg();
    renderChips();
  }

  function renderSvg() {
    svgEl.innerHTML = "";
    const defsEl = document.createElementNS(SVG_NS, "defs");
    svgEl.appendChild(defsEl);
    lines.forEach(l => {
      const hex = lineColorHex(l.color);
      const poly = document.createElementNS(SVG_NS, "polyline");
      poly.setAttribute("points", pointsAttr(l.points));
      poly.setAttribute("fill", "none");
      poly.setAttribute("stroke", hex);
      poly.setAttribute("stroke-width", "3.5");
      poly.setAttribute("stroke-linecap", "round");
      poly.setAttribute("stroke-linejoin", "round");
      if (l.style === "dashed") poly.setAttribute("stroke-dasharray", "10 7");
      if (l.arrow) poly.setAttribute("marker-end", `url(#${ensureArrowMarker(defsEl, l.color)})`);
      svgEl.appendChild(poly);
    });
    if (draft) {
      const hex = lineColorHex(draft.color);
      if (draft.points.length >= 2) {
        const poly = document.createElementNS(SVG_NS, "polyline");
        poly.setAttribute("points", pointsAttr(draft.points));
        poly.setAttribute("fill", "none");
        poly.setAttribute("stroke", hex);
        poly.setAttribute("stroke-width", "3");
        poly.setAttribute("stroke-dasharray", "6 4");
        poly.setAttribute("opacity", "0.7");
        svgEl.appendChild(poly);
      }
      draft.points.forEach(p => {
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", p.x);
        dot.setAttribute("cy", p.y);
        dot.setAttribute("r", 4);
        dot.setAttribute("fill", "#fff");
        dot.setAttribute("stroke", hex);
        dot.setAttribute("stroke-width", "2");
        svgEl.appendChild(dot);
      });
    }
  }

  function renderChips() {
    for (const [id, node] of chips) {
      if (!lines.some(l => l.id === id)) { node.remove(); chips.delete(id); }
    }
    lines.forEach(l => {
      if (!chips.has(l.id)) {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "rgn-del";
        node.title = "Delete line";
        node.innerHTML = "&times;";
        node.setAttribute("data-no-pan", "");
        node.addEventListener("click", e => { e.stopPropagation(); remove(l.id); });
        chips.set(l.id, node);
        chipLayerEl.appendChild(node);
      }
    });
    reposition();
  }

  function reposition() {
    lines.forEach(l => {
      const node = chips.get(l.id);
      if (!node) return;
      const m = midpoint(l.points);
      const pt = viewer.stageToScreen(m.x, m.y);
      node.style.left = `${pt.x}px`;
      node.style.top = `${pt.y}px`;
    });
  }

  return {
    setSize, setLines, getLines, startDraft, addDraftPoint, popLastDraftPoint,
    cancelDraft, finishDraft, isDrafting, draftPointCount, remove, restore, reposition,
  };
}
