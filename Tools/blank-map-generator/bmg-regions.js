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

import { PALETTE, colorHex } from "./bmg-colors.js";

export const REGION_COLORS = PALETTE;
export const regionColorHex = colorHex;

// A fill pattern is a second, color-independent way to tell regions apart
// (in addition to color itself), so a shaded map still reads correctly for
// colorblind students or on a grayscale printout.
export const REGION_PATTERNS = [
  { key: "solid", label: "Solid" },
  { key: "hatch", label: "Hatched" },
  { key: "dots", label: "Dotted" },
];
export const DEFAULT_REGION_PATTERN = "solid";

let swatchIdCounter = 0;

export function regionSwatchSvg(key, size = 16, pattern = DEFAULT_REGION_PATTERN) {
  const hex = regionColorHex(key);
  if (pattern === "hatch") {
    const id = `bmg-swatch-hatch-${swatchIdCounter++}`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">
      <defs><pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" fill="${hex}" fill-opacity="0.15"/>
        <line x1="0" y1="0" x2="0" y2="4" stroke="${hex}" stroke-width="2"/>
      </pattern></defs>
      <rect x="1" y="1" width="14" height="14" rx="3" fill="url(#${id})" stroke="${hex}" stroke-width="1.5"/>
    </svg>`;
  }
  if (pattern === "dots") {
    const id = `bmg-swatch-dots-${swatchIdCounter++}`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">
      <defs><pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" fill="${hex}" fill-opacity="0.15"/>
        <circle cx="2.5" cy="2.5" r="1.1" fill="${hex}"/>
      </pattern></defs>
      <rect x="1" y="1" width="14" height="14" rx="3" fill="url(#${id})" stroke="${hex}" stroke-width="1.5"/>
    </svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3" fill="${hex}" fill-opacity="0.4" stroke="${hex}" stroke-width="1.5"/></svg>`;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function pointsAttr(points) { return points.map(p => `${p.x},${p.y}`).join(" "); }

// --- One shape or many -------------------------------------------------
//
// A hand-drawn region is one simple polygon: `points`, clicked out by the
// teacher. A click-to-shade region (see bmg-hittest.js) is whatever shape
// the real country or state is, which routinely means several — Alaska's
// mainland plus a hundred islands, Greece plus its archipelago — and
// sometimes a hole, where one country encloses another.
//
// Rather than teach the whole tool a second kind of region, such a region
// carries an extra `rings` array and keeps `points` set to its largest ring.
// The rule everywhere is the same: **if `rings` is present, use it and
// ignore `points`; otherwise use `points`.** `points` is then a working
// fallback rather than dead weight — any path that hasn't learned about
// rings draws the region's main body instead of nothing at all, which is a
// much kinder failure than an invisible shape.

/** Every ring of a region, in draw order: its `rings` if it has them, otherwise its single `points` outline. */
export function regionRings(r) {
  if (r && Array.isArray(r.rings) && r.rings.length) return r.rings;
  return r && Array.isArray(r.points) && r.points.length ? [r.points] : [];
}

/** An SVG path `d` for a region's rings, each subpath closed — filled with `evenodd` so enclosed rings punch holes. */
export function regionPathD(r) {
  return regionRings(r)
    .map(ring => `M${ring.map(p => `${p.x},${p.y}`).join("L")}Z`)
    .join(" ");
}

/** The ring with the most points — the main body of a multi-part region, and what a single-outline consumer should fall back to. */
export function largestRegionRing(r) {
  let best = null;
  for (const ring of regionRings(r)) if (!best || ring.length > best.length) best = ring;
  return best || [];
}

/** Lazily creates (and de-dupes) the <pattern> def a color+pattern combo needs, sized in stage/map-pixel units so it scales and pans with the map for free via the stage's own transform, same as everything else in this layer. Returns null for "solid" — callers fall back to a flat semi-transparent fill. */
function ensureFillPattern(defsEl, colorKey, pattern) {
  if (!pattern || pattern === "solid") return null;
  const id = `bmg-region-fill-${colorKey}-${pattern}`;
  if (defsEl.querySelector(`#${id}`)) return id;
  const hex = regionColorHex(colorKey);
  const pat = document.createElementNS(SVG_NS, "pattern");
  pat.setAttribute("id", id);
  pat.setAttribute("width", "14");
  pat.setAttribute("height", "14");
  pat.setAttribute("patternUnits", "userSpaceOnUse");
  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("width", "14");
  bg.setAttribute("height", "14");
  bg.setAttribute("fill", hex);
  bg.setAttribute("fill-opacity", "0.12");
  pat.appendChild(bg);
  if (pattern === "hatch") {
    pat.setAttribute("patternTransform", "rotate(45)");
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "0");
    line.setAttribute("y2", "14");
    line.setAttribute("stroke", hex);
    line.setAttribute("stroke-width", "5");
    pat.appendChild(line);
  } else if (pattern === "dots") {
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", "7");
    dot.setAttribute("cy", "7");
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", hex);
    pat.appendChild(dot);
  }
  defsEl.appendChild(pat);
  return id;
}

export function createRegionLayer(svgEl, chipLayerEl, viewer, { onChange } = {}) {
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

  function startDraft(color, pattern = DEFAULT_REGION_PATTERN) { draft = { color, pattern, points: [] }; }

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
    const region = { id: newId(), color: draft.color, pattern: draft.pattern, points: draft.points };
    regions.push(region);
    draft = null;
    renderAll();
    onChange?.(regions);
    return region;
  }

  function remove(id) {
    regions = regions.filter(r => r.id !== id);
    renderAll();
    onChange?.(regions);
  }

  /**
   * Replaces the whole set and reports it as one edit — what click-to-shade
   * uses, since a click there is a change to a specific region rather than an
   * append. Going through onChange (rather than setRegions, which is the
   * silent load path) is what puts each click on the undo stack.
   */
  function commit(list) {
    regions = list;
    draft = null;
    renderAll();
    onChange?.(regions);
  }

  /** The named region the click-to-shade layer has already shaded under this name, or undefined. */
  function findNamed(name) {
    return regions.find(r => r.name === name);
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
    const defsEl = document.createElementNS(SVG_NS, "defs");
    svgEl.appendChild(defsEl);
    regions.forEach(r => {
      const hex = regionColorHex(r.color);
      const multi = Array.isArray(r.rings) && r.rings.length;
      const poly = document.createElementNS(SVG_NS, multi ? "path" : "polygon");
      if (multi) {
        poly.setAttribute("d", regionPathD(r));
        poly.setAttribute("fill-rule", "evenodd");
      } else {
        poly.setAttribute("points", pointsAttr(r.points));
      }
      const patternId = ensureFillPattern(defsEl, r.color, r.pattern);
      if (patternId) {
        poly.setAttribute("fill", `url(#${patternId})`);
      } else {
        poly.setAttribute("fill", hex);
        poly.setAttribute("fill-opacity", "0.32");
      }
      poly.setAttribute("stroke", hex);
      poly.setAttribute("stroke-width", "2.5");
      svgEl.appendChild(poly);
    });
    if (draft) {
      const hex = regionColorHex(draft.color);
      if (draft.points.length >= 2) {
        const line = document.createElementNS(SVG_NS, "polyline");
        line.setAttribute("points", pointsAttr(draft.points));
        const patternId = ensureFillPattern(defsEl, draft.color, draft.pattern);
        line.setAttribute("fill", patternId ? `url(#${patternId})` : hex);
        line.setAttribute("fill-opacity", patternId ? "1" : "0.18");
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

  // A hand-drawn region gets a small delete chip at its centre, because
  // there is otherwise no way to get rid of a shape you clicked out by hand.
  //
  // A click-shaded region deliberately gets none. The chip would sit at the
  // middle of the country — exactly where a teacher clicks to change its
  // colour — so it would swallow that click and delete the region instead.
  // (Found by the smoke suite doing precisely that.) Click-shading already
  // has three ways out that a chip would only get in the way of: cycling
  // past the last colour, Ctrl- or right-clicking, and "Clear
  // click-shading". A map with fifteen shaded states also has fifteen chips,
  // which is not a map anyone wants to look at.
  function chipWanted(r) { return !r.name; }

  function renderChips() {
    for (const [id, node] of chips) {
      if (!regions.some(r => r.id === id && chipWanted(r))) { node.remove(); chips.delete(id); }
    }
    regions.forEach(r => {
      if (!chips.has(r.id) && chipWanted(r)) {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "rgn-del";
        node.title = r.name ? `Remove shading from ${r.name}` : "Delete shaded region";
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
      const c = centroid(largestRegionRing(r));
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) { node.hidden = true; return; }
      node.hidden = false;
      const pt = viewer.stageToScreen(c.x, c.y);
      node.style.left = `${pt.x}px`;
      node.style.top = `${pt.y}px`;
    });
  }

  return {
    setSize, setRegions, getRegions, startDraft, addDraftPoint, popLastDraftPoint,
    cancelDraft, finishDraft, isDrafting, draftPointCount, remove, reposition,
    commit, findNamed,
  };
}
