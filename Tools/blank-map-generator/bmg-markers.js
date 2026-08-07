// bmg-markers.js — draggable map markers (pin/star/dot/flag). Anchored to
// stage (map-pixel) coordinates and repositioned in screen space on every
// pan/zoom, same approach as bmg-labels.js's text labels, so the icon size
// stays constant on screen rather than scaling with the map. Each marker
// also carries its own color and size (from the shared bmg-colors.js
// palette / MARKER_SIZE_PX below) rather than every marker of a style
// sharing one fixed look, so e.g. two colors of star can mean two
// different things on the same map's legend.

import { PALETTE, colorHex } from "./bmg-colors.js";

export const MARKER_STYLES = ["pin", "star", "dot", "flag", "number"];
export const MARKER_COLORS = PALETTE;
export const markerColorHex = colorHex;
export const DEFAULT_MARKER_COLOR = "blue";
export const DEFAULT_MARKER_SIZE = "medium";

export const MARKER_SIZES = [
  { key: "small", label: "Small", px: 18 },
  { key: "medium", label: "Medium", px: 26 },
  { key: "large", label: "Large", px: 34 },
];

export function markerSizePx(size) {
  return (MARKER_SIZES.find(s => s.key === size) || MARKER_SIZES[1]).px;
}

// Where the icon's "point" sits relative to its own box, so the marker's
// (x, y) lands on the actual location rather than the icon's center.
const ANCHOR = { pin: "bottom", star: "center", dot: "center", flag: "bottom", number: "center" };

export function markerAnchor(style) { return ANCHOR[style] || "center"; }

// `number` is only meaningful for style "number" — the marker's position in
// the placement order among number-style markers (1, 2, 3…), computed by
// the caller (see numberedOrder() below) since a single marker doesn't know
// where it falls among its siblings.
export function markerIconSvg(style, size = 22, color = colorHex(DEFAULT_MARKER_COLOR), number = null) {
  switch (style) {
    case "star":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" fill="${color}" stroke="#fff" stroke-width="1"/></svg>`;
    case "dot":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`;
    case "flag":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2v20" stroke="${color}" stroke-width="2"/><path d="M6 3h12l-3 4 3 4H6z" fill="${color}"/></svg>`;
    case "number": {
      const label = number != null ? String(number) : "?";
      const fontSize = label.length > 2 ? 9 : 12;
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${color}" stroke="#fff" stroke-width="2"/><text x="12" y="16" text-anchor="middle" font-size="${fontSize}" font-weight="700" font-family="sans-serif" fill="#fff">${label}</text></svg>`;
    }
    case "pin":
    default:
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z" fill="${color}" stroke="#fff" stroke-width="1"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>`;
  }
}

/** Number-style markers among `list`, in placement order — index+1 is each one's displayed number. Shared by the marker layer, the legend, and PNG export so all three agree on the same numbering. */
export function numberedOrder(list) {
  return list.filter(m => m.style === "number");
}

export function createMarkerLayer(layerEl, viewer, { onChange, onDelete } = {}) {
  let markers = [];
  const nodes = new Map(); // id -> element
  let selectedId = null; // for keyboard-nudge — see select()/nudge()

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `mkr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function setMarkers(list) {
    markers = list;
    selectedId = null;
    reconcile();
  }

  function getMarkers() { return markers; }

  /** Selects a marker (highlighting it and making it the keyboard-nudge target), or clears selection if id is null/missing. Only one label or marker can be selected at a time — the main script coordinates that across layers. */
  function select(id) {
    if (selectedId === id) return;
    const prevNode = nodes.get(selectedId);
    if (prevNode) prevNode.classList.remove("selected");
    selectedId = markers.some(m => m.id === id) ? id : null;
    const node = nodes.get(selectedId);
    if (node) node.classList.add("selected");
  }

  function deselect() { select(null); }
  function getSelectedId() { return selectedId; }

  /** Nudges a marker's position by a stage-space (dx, dy) — used for arrow-key nudging of the selected marker. */
  function nudge(id, dx, dy) {
    const marker = markers.find(m => m.id === id);
    if (!marker) return;
    marker.x += dx;
    marker.y += dy;
    reposition();
    onChange?.(markers);
  }

  function addAt(stageX, stageY, style, color = DEFAULT_MARKER_COLOR, size = DEFAULT_MARKER_SIZE) {
    const marker = { id: newId(), x: stageX, y: stageY, style, color, size };
    markers.push(marker);
    reconcile();
    onChange?.(markers);
    return marker;
  }

  function remove(id) {
    const removed = markers.find(m => m.id === id);
    markers = markers.filter(m => m.id !== id);
    if (selectedId === id) selectedId = null;
    reconcile();
    onChange?.(markers);
    if (removed) onDelete?.(removed);
  }

  /** Re-adds a previously removed marker (used to undo a delete). */
  function restore(marker) {
    markers.push(marker);
    reconcile();
    onChange?.(markers);
  }

  function reposition() {
    markers.forEach(m => {
      const node = nodes.get(m.id);
      if (!node) return;
      const pt = viewer.stageToScreen(m.x, m.y);
      node.style.left = `${pt.x}px`;
      node.style.top = `${pt.y}px`;
    });
  }

  /** Maps each number-style marker's id to its displayed number (1-based placement order). Recomputed on every reconcile so deletions renumber the rest automatically. */
  function numberMap() {
    const map = new Map();
    numberedOrder(markers).forEach((m, i) => map.set(m.id, i + 1));
    return map;
  }

  function reconcile() {
    for (const [id, node] of nodes) {
      if (!markers.some(m => m.id === id)) { node.remove(); nodes.delete(id); }
    }
    const numbers = numberMap();
    markers.forEach(m => {
      if (!nodes.has(m.id)) {
        const node = buildNode(m, numbers);
        nodes.set(m.id, node);
        layerEl.appendChild(node);
      } else if (m.style === "number") {
        nodes.get(m.id).querySelector(".mkr-icon").innerHTML =
          markerIconSvg(m.style, markerSizePx(m.size), markerColorHex(m.color), numbers.get(m.id));
      }
    });
    reposition();
  }

  function buildNode(marker, numbers) {
    const node = document.createElement("div");
    node.className = `bmg-marker anchor-${markerAnchor(marker.style)}`;
    node.dataset.id = marker.id;
    node.setAttribute("data-no-pan", "");
    const number = marker.style === "number" ? numbers.get(marker.id) : null;
    node.innerHTML = `
      <span class="mkr-icon">${markerIconSvg(marker.style, markerSizePx(marker.size), markerColorHex(marker.color), number)}</span>
      <button class="mkr-del" type="button" title="Delete marker" data-no-pan>&times;</button>
    `;
    wireDrag(node, marker);
    node.querySelector(".mkr-del").addEventListener("click", e => {
      e.stopPropagation();
      remove(marker.id);
    });
    return node;
  }

  /** Re-renders every existing marker's icon in place (color/size changed from the legend), without rebuilding drag listeners. */
  function refreshIcons() {
    const numbers = numberMap();
    markers.forEach(m => {
      const node = nodes.get(m.id);
      if (!node) return;
      node.className = `bmg-marker anchor-${markerAnchor(m.style)}`;
      node.querySelector(".mkr-icon").innerHTML =
        markerIconSvg(m.style, markerSizePx(m.size), markerColorHex(m.color), m.style === "number" ? numbers.get(m.id) : null);
    });
    reposition();
  }

  function wireDrag(node, marker) {
    let dragging = false, startX = 0, startY = 0, startStage = null;
    node.addEventListener("pointerdown", e => {
      if (e.target.closest(".mkr-del")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startStage = { x: marker.x, y: marker.y };
      node.setPointerCapture(e.pointerId);
      node.classList.add("dragging");
      e.stopPropagation();
    });
    node.addEventListener("pointermove", e => {
      if (!dragging) return;
      const scale = viewer.getView().scale;
      marker.x = startStage.x + (e.clientX - startX) / scale;
      marker.y = startStage.y + (e.clientY - startY) / scale;
      reposition();
      e.stopPropagation();
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      node.classList.remove("dragging");
      // A pointerdown+up with barely any movement is a click, not a drag —
      // select this marker (for keyboard nudging) rather than treat it as
      // having been dragged in place.
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < 4) select(marker.id);
      onChange?.(markers);
    }
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
  }

  return { setMarkers, getMarkers, addAt, remove, restore, reposition, refreshIcons, select, deselect, getSelectedId, nudge };
}
