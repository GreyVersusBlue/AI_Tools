// bmg-viewer.js — pan/zoom controller for the map stage.
//
// `viewport` is the fixed-size, overflow-hidden container; `stage` is the
// element transformed inside it (translate + scale). Kept as plain
// translate/scale math (not a vendored map library) so later phases can
// place labels/markers in the same stage coordinate space via
// screenToStage().

export function createViewer(viewport, stage, { minScale = 0.05, maxScale = 12, onChange } = {}) {
  let x = 0, y = 0, scale = 1;
  let dragging = false, lastX = 0, lastY = 0;
  const pointers = new Map();
  let lastPinchDist = null;

  function apply() {
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    onChange?.({ x, y, scale });
  }

  function getView() { return { x, y, scale }; }
  function setView(v) { x = v.x; y = v.y; scale = v.scale; apply(); }

  function clampScale(s) { return Math.min(maxScale, Math.max(minScale, s)); }

  /** Zooms by `factor`, keeping the point under (clientX, clientY) fixed. */
  function zoomAt(clientX, clientY, factor) {
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const newScale = clampScale(scale * factor);
    x = px - ((px - x) / scale) * newScale;
    y = py - ((py - y) / scale) * newScale;
    scale = newScale;
    apply();
  }

  /** Centers and scales the stage's natural content size to fill the viewport. */
  function fit(contentW, contentH) {
    const rect = viewport.getBoundingClientRect();
    if (!contentW || !contentH || !rect.width || !rect.height) return;
    scale = clampScale(Math.min(rect.width / contentW, rect.height / contentH) * 0.96);
    x = (rect.width - contentW * scale) / 2;
    y = (rect.height - contentH * scale) / 2;
    apply();
  }

  /** Converts viewport-relative screen coordinates into stage coordinates. */
  function screenToStage(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - x) / scale,
      y: (clientY - rect.top - y) / scale,
    };
  }

  function pointerDown(e) {
    if (e.target.closest("[data-no-pan]")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.setPointerCapture(e.pointerId);
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
  }

  function pointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinchDist) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / lastPinchDist);
      lastPinchDist = dist;
      return;
    }
    if (dragging) {
      x += e.clientX - lastX;
      y += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      apply();
    }
  }

  function pointerEnd(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinchDist = null;
    if (pointers.size === 0) dragging = false;
  }

  viewport.addEventListener("pointerdown", pointerDown);
  viewport.addEventListener("pointermove", pointerMove);
  viewport.addEventListener("pointerup", pointerEnd);
  viewport.addEventListener("pointercancel", pointerEnd);
  viewport.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  return { getView, setView, zoomAt, fit, screenToStage, apply };
}
