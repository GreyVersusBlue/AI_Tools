// bmg-lines.js — freehand line/arrow annotations (trade routes, migration
// paths, borders) drawn point-by-point like bmg-regions.js's shaded
// shapes, but as an open polyline instead of a closed filled polygon, with
// an optional arrowhead at the final point. Lives inside #stage in
// map-pixel coordinates (same as regions) so panning/zooming the map moves
// and scales them for free via the stage's own CSS transform; only each
// line's small delete chip needs screen-space treatment to stay a
// constant, tappable size.

import { PALETTE, colorHex } from "./bmg-colors.js";
import { computeDistance } from "./bmg-latlong.js";

export const LINE_COLORS = PALETTE;
export const lineColorHex = colorHex;
export const LINE_STYLES = [
  { key: "solid", label: "Solid" },
  { key: "dashed", label: "Dashed" },
  { key: "dotted", label: "Dotted" },
];

// Semantic line types. A drawn line is geometry plus a color and a dash
// style, which leaves the teacher to remember that "gold dashed means trade
// route" and to type that into the key by hand for every map. A type picks
// the color/style/arrowhead conventionally used for that kind of feature
// *and* supplies the caption, so choosing "Trade route" before drawing
// makes the legend write itself. Every type's color+style pair is distinct,
// so two types never collapse into one shared legend row (see
// lineLegendKey() in bmg-legend.js). "Custom" keeps the old
// pick-your-own-color behavior and writes no caption.
export const LINE_TYPES = [
  { key: "custom", label: "Custom line", caption: "" },
  { key: "river", label: "River", color: "blue", style: "solid", arrow: false, caption: "River" },
  { key: "border", label: "Border", color: "purple", style: "dashed", arrow: false, caption: "Border" },
  { key: "disputed", label: "Disputed boundary", color: "red", style: "dotted", arrow: false, caption: "Disputed boundary" },
  { key: "route", label: "Trade route", color: "gold", style: "dashed", arrow: true, caption: "Trade route" },
  { key: "migration", label: "Migration path", color: "red", style: "solid", arrow: true, caption: "Migration path" },
  { key: "invasion", label: "Invasion / campaign", color: "red", style: "dashed", arrow: true, caption: "Invasion route" },
  { key: "transport", label: "Railroad / road", color: "teal", style: "dotted", arrow: false, caption: "Railroad or road" },
  { key: "expedition", label: "Exploration route", color: "green", style: "dashed", arrow: true, caption: "Exploration route" },
];

export function findLineType(key) {
  return LINE_TYPES.find(t => t.key === key) || null;
}

const DASH_ARRAYS = { dashed: "4 3", dotted: "0.5 3.5" };

export function lineSwatchSvg(color, size = 16, style = "solid") {
  const hex = lineColorHex(color);
  const dash = DASH_ARRAYS[style] ? ` stroke-dasharray="${DASH_ARRAYS[style]}"` : "";
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

export function createLineLayer(svgEl, chipLayerEl, viewer, { onChange } = {}) {
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

  function startDraft(color, style, arrow, type = null) { draft = { color, style, arrow, type, points: [] }; }

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
    const line = { id: newId(), color: draft.color, style: draft.style, arrow: draft.arrow, type: draft.type, points: draft.points };
    lines.push(line);
    draft = null;
    renderAll();
    onChange?.(lines);
    return line;
  }

  function remove(id) {
    lines = lines.filter(l => l.id !== id);
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
      if (l.style === "dotted") poly.setAttribute("stroke-dasharray", "0.5 6");
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
    cancelDraft, finishDraft, isDrafting, draftPointCount, remove, reposition,
  };
}

// --- Point-to-point distance measuring --------------------------------
// A lightweight two-click tool, structurally a stripped-down sibling of
// createLineLayer() above (same SVG-in-#stage + screen-space chip split,
// same reposition() convention) but capped at two points and never
// persisted to project data: unlike a drawn line, a measurement isn't an
// annotation a teacher is building up — it's a one-off "how far is it from
// here to there" question, answered fresh each time from whatever the map's
// calibration says (via bmg-latlong.js's computeDistance(), which itself
// just reuses the exact same toLatLon() math the lat/long readout and grid
// already rely on — nothing here re-derives its own calibration).
export function createMeasureLayer(svgEl, chipLayerEl, viewer) {
  let points = []; // 0, 1 (waiting for 2nd click), or 2 (measured) stage points
  let calibration = null;
  let imgW = 0, imgH = 0;
  let unit = "km";
  let result = null; // computeDistance()'s return value once 2 points are set, else null
  let readoutNode = null;

  function recompute() {
    result = points.length === 2
      ? computeDistance(calibration, imgW, imgH, points[0].x, points[0].y, points[1].x, points[1].y, unit)
      : null;
  }

  function setSize(w, h) { imgW = w; imgH = h; recompute(); renderChip(); }
  function setCalibration(c) { calibration = c; recompute(); renderChip(); }
  function setUnit(u) { unit = u; recompute(); renderChip(); }

  function isActive() { return points.length > 0; }
  function pointCount() { return points.length; }
  function getResult() { return result; }

  /** Places the next click's point. A completed (2-point) measurement is cleared first, so a third click always starts a fresh measurement instead of adding a third point to the old one. */
  function addPoint(x, y) {
    if (points.length >= 2) points = [];
    points.push({ x, y });
    recompute();
    renderAll();
  }

  function reset() {
    points = [];
    result = null;
    renderAll();
  }

  function renderAll() {
    renderSvg();
    renderChip();
  }

  function renderSvg() {
    svgEl.innerHTML = "";
    if (!points.length) return;
    if (points.length === 2) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", points[0].x);
      line.setAttribute("y1", points[0].y);
      line.setAttribute("x2", points[1].x);
      line.setAttribute("y2", points[1].y);
      line.setAttribute("stroke", "#a3372b");
      line.setAttribute("stroke-width", "2.5");
      line.setAttribute("stroke-dasharray", "8 5");
      svgEl.appendChild(line);
    }
    points.forEach(p => {
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", p.x);
      dot.setAttribute("cy", p.y);
      dot.setAttribute("r", 5);
      dot.setAttribute("fill", "#a3372b");
      dot.setAttribute("stroke", "#fff");
      dot.setAttribute("stroke-width", "2");
      svgEl.appendChild(dot);
    });
  }

  function ensureReadoutNode() {
    if (readoutNode) return readoutNode;
    readoutNode = document.createElement("div");
    readoutNode.className = "measure-readout";
    readoutNode.setAttribute("data-no-pan", "");
    readoutNode.innerHTML = `<span class="measure-readout-text"></span><button type="button" class="measure-clear" title="Clear measurement">&times;</button>`;
    readoutNode.querySelector(".measure-clear").addEventListener("click", e => { e.stopPropagation(); reset(); });
    chipLayerEl.appendChild(readoutNode);
    return readoutNode;
  }

  function renderChip() {
    if (!points.length) {
      if (readoutNode) { readoutNode.remove(); readoutNode = null; }
      return;
    }
    const node = ensureReadoutNode();
    node.querySelector(".measure-readout-text").textContent = points.length < 2
      ? "Click a second point…"
      : (result ? result.label : "Map isn't calibrated.");
    reposition();
  }

  function reposition() {
    if (!readoutNode || !points.length) return;
    const anchor = points.length === 2
      ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      : points[0];
    const pt = viewer.stageToScreen(anchor.x, anchor.y);
    readoutNode.style.left = `${pt.x}px`;
    readoutNode.style.top = `${pt.y}px`;
  }

  return { setSize, setCalibration, setUnit, addPoint, reset, isActive, pointCount, getResult, reposition };
}
