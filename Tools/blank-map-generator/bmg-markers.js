// bmg-markers.js — draggable map markers (pin/star/dot/flag). Anchored to
// stage (map-pixel) coordinates and repositioned in screen space on every
// pan/zoom, same approach as bmg-labels.js's text labels, so the icon size
// stays constant on screen rather than scaling with the map.

export const MARKER_STYLES = ["pin", "star", "dot", "flag"];

// Where the icon's "point" sits relative to its own box, so the marker's
// (x, y) lands on the actual location rather than the icon's center.
const ANCHOR = { pin: "bottom", star: "center", dot: "center", flag: "bottom" };

export function markerAnchor(style) { return ANCHOR[style] || "center"; }

export function markerIconSvg(style, size = 22) {
  const color = "#2e6b8f";
  switch (style) {
    case "star":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" fill="${color}" stroke="#fff" stroke-width="1"/></svg>`;
    case "dot":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`;
    case "flag":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2v20" stroke="${color}" stroke-width="2"/><path d="M6 3h12l-3 4 3 4H6z" fill="${color}"/></svg>`;
    case "pin":
    default:
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z" fill="${color}" stroke="#fff" stroke-width="1"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>`;
  }
}

export function createMarkerLayer(layerEl, viewer, { onChange } = {}) {
  let markers = [];
  const nodes = new Map(); // id -> element

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `mkr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function setMarkers(list) {
    markers = list;
    reconcile();
  }

  function getMarkers() { return markers; }

  function addAt(stageX, stageY, style) {
    const marker = { id: newId(), x: stageX, y: stageY, style };
    markers.push(marker);
    reconcile();
    onChange?.(markers);
    return marker;
  }

  function remove(id) {
    markers = markers.filter(m => m.id !== id);
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

  function reconcile() {
    for (const [id, node] of nodes) {
      if (!markers.some(m => m.id === id)) { node.remove(); nodes.delete(id); }
    }
    markers.forEach(m => {
      if (!nodes.has(m.id)) {
        const node = buildNode(m);
        nodes.set(m.id, node);
        layerEl.appendChild(node);
      }
    });
    reposition();
  }

  function buildNode(marker) {
    const node = document.createElement("div");
    node.className = `bmg-marker anchor-${markerAnchor(marker.style)}`;
    node.dataset.id = marker.id;
    node.setAttribute("data-no-pan", "");
    node.innerHTML = `
      <span class="mkr-icon">${markerIconSvg(marker.style)}</span>
      <button class="mkr-del" type="button" title="Delete marker" data-no-pan>&times;</button>
    `;
    wireDrag(node, marker);
    node.querySelector(".mkr-del").addEventListener("click", e => {
      e.stopPropagation();
      remove(marker.id);
    });
    return node;
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
    function end() {
      if (!dragging) return;
      dragging = false;
      node.classList.remove("dragging");
      onChange?.(markers);
    }
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
  }

  return { setMarkers, getMarkers, addAt, remove, reposition };
}
