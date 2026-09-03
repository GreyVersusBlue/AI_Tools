// bmg-locator.js — small "map in a map" inset showing where the current
// pan/zoom view sits within the full image. The inset box is sized to
// match the image's own aspect ratio (capped to MAX_DIM), so the image
// fills it edge-to-edge with no letterboxing — that keeps the
// viewport-rectangle math a single uniform scale factor instead of having
// to account for object-fit letterboxing offsets.

const MAX_DIM = 150;

export function createLocatorInset(containerEl, imgEl, rectEl, viewport, viewer) {
  let naturalW = 0;

  function setImage(objectUrl, w, h) {
    naturalW = w;
    imgEl.src = objectUrl;
    const s = MAX_DIM / Math.max(w, h);
    containerEl.style.width = `${Math.round(w * s)}px`;
    containerEl.style.height = `${Math.round(h * s)}px`;
    updateRect();
  }

  function updateRect() {
    if (!naturalW || !containerEl.clientWidth) return;
    const insetScale = containerEl.clientWidth / naturalW;
    const { x, y, scale } = viewer.getView();
    const vp = viewport.getBoundingClientRect();
    const left = -x / scale;
    const top = -y / scale;
    const width = vp.width / scale;
    const height = vp.height / scale;
    rectEl.style.left = `${left * insetScale}px`;
    rectEl.style.top = `${top * insetScale}px`;
    rectEl.style.width = `${width * insetScale}px`;
    rectEl.style.height = `${height * insetScale}px`;
  }

  return { setImage, updateRect };
}
