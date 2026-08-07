// bmg-regions.js — shaded polygon regions with a color-keyed legend entry
// (e.g. shading a river basin, a country's territory, a disputed border
// during a labeling activity). Polygons are drawn as SVG children of
// #stage — the same element the map <img> and lat/long grid live in — so
// panning/zooming the map moves and scales them for free via the stage's
// own CSS transform, the same trick bmg's grid overlay already uses.
// That's the opposite approach from bmg-labels.js/bmg-markers.js, whose
// text/icons live in screen space and get explicitly repositioned on every
// view change so their on-screen size stays constant. Only each region's
// small delete chip needs that screen-space treatment here, since it has
// to stay a constant, tappable size regardless of zoom.

export const REGION_COLORS = [
  { key: "red", name: "Red", hex: "#a3372b" },
  { key: "blue", name: "Blue", hex: "#2e6b8f" },
  { key: "green", name: "Green", hex: "#2e6b3e" },
  { key: "gold", name: "Gold", hex: "#b8862b" },
  { key: "purple", name: "Purple", hex: "#6b4c9a" },
  { key: "teal", name: "Teal", hex: "#1f7a72" },
];

export function regionColorHex(key) {
  return (REGION_COLORS.find(c => c.key === key) || REGION_COLORS[0]).hex;
}

export function regionSwatchSvg(key, size = 16) {
  const hex = regionColorHex(key);
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3" fill="${hex}" fill-opacity="0.4" stroke="${hex}" stroke-width="1.5"/></svg>`;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function pointsAttr(points) { return points.map(p => `${p.x},${p.y}`).join(" "); }

export function createRegionLayer(svgEl, chipLayerEl, viewer, { onChange, onDelete } = {}) {
  let regions = [];
  let draft = null; // { color, points: [{x,y}] } — the in-progress shape being clicked out
  const chips = new Map(); // id -> element

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `rgn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /** Matches the SVG's coordinate space to the map's natural pixel size. */
  function setSize(w, h) {
    if (!w || !h) return;
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svgEl.setAttribute("width", w);
    svgEl.setAttribute("height", h);
  }

  function setRegions(list) {
    regions = list;
    draft = null;
    renderAll();
  }

  function getRegions() { return regions; }

  function isDrafting() { return !!draft; }
  function draftPointCount() { return draft ? draft.points.length : 0; }

  function startDraft(color) { draft = { color, points: [] }; }

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
    if (!draft || draft.points.length < 3) return null;
    const region = { id: newId(), color: draft.color, points: draft.points };
    regions.push(region);
    draft = null;
    renderAll();
    onChange?.(regions);
    return region;
  }

  function remove(id) {
    const removed = regions.find(r => r.id === id);
    regions = regions.filter(r => r.id !== id);
    renderAll();
    onChange?.(regions);
    if (removed) onDelete?.(removed);
  }

  /** Re-adds a previously removed region (used to undo a delete). */
  function restore(region) {
    regions.push(region);
    renderAll();
    onChange?.(regions);
  }

  function centroid(points) {
    const n = points.length;
    return {
      x: points.reduce((s, p) => s + p.x, 0) / n,
      y: points.reduce((s, p) => s + p.y, 0) / n,
    };
  }

  function renderAll() {
    renderSvg();
    renderChips();
  }

  function renderSvg() {
    svgEl.innerHTML = "";
    regions.forEach(r => {
      const hex = regionColorHex(r.color);
      const poly = document.createElementNS(SVG_NS, "polygon");
      poly.setAttribute("points", pointsAttr(r.points));
      poly.setAttribute("fill", hex);
      poly.setAttribute("fill-opacity", "0.32");
      poly.setAttribute("stroke", hex);
      poly.setAttribute("stroke-width", "2.5");
      svgEl.appendChild(poly);
    });
    if (draft) {
      const hex = regionColorHex(draft.color);
      if (draft.points.length >= 2) {
        const line = document.createElementNS(SVG_NS, "polyline");
        line.setAttribute("points", pointsAttr(draft.points));
        line.setAttribute("fill", hex);
        line.setAttribute("fill-opacity", "0.18");
        line.setAttribute("stroke", hex);
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-dasharray", "6 4");
        svgEl.appendChild(line);
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
      if (!regions.some(r => r.id === id)) { node.remove(); chips.delete(id); }
    }
    regions.forEach(r => {
      if (!chips.has(r.id)) {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "rgn-del";
        node.title = "Delete shaded region";
        node.innerHTML = "&times;";
        node.setAttribute("data-no-pan", "");
        node.addEventListener("click", e => { e.stopPropagation(); remove(r.id); });
        chips.set(r.id, node);
        chipLayerEl.appendChild(node);
      }
    });
    reposition();
  }

  function reposition() {
    regions.forEach(r => {
      const node = chips.get(r.id);
      if (!node) return;
      const c = centroid(r.points);
      const pt = viewer.stageToScreen(c.x, c.y);
      node.style.left = `${pt.x}px`;
      node.style.top = `${pt.y}px`;
    });
  }

  return {
    setSize, setRegions, getRegions, startDraft, addDraftPoint, popLastDraftPoint,
    cancelDraft, finishDraft, isDrafting, draftPointCount, remove, restore, reposition,
  };
}
