// bmg-hittest.js — turn a point on a built-in vector base map into the
// country or state underneath it, and hand back that region's outline in the
// map's own pixel space so it can be shaded.
//
// This module is pure geometry: no DOM, no fetch, no viewer. The host page
// converts a click to stage (map-pixel) coordinates with the viewer it
// already has, calls hitTestRegion(), and gets back a name plus rings. That
// is the entire mechanism behind click-to-shade.
//
// **The projection is not reimplemented here, and that is the point.** The
// base map is a raster that bmg-vector.js drew, so a hit test that computed
// its own longitude/latitude mapping would be a second copy of the same math
// waiting to drift out of step with the picture on screen — and a hit test
// that disagrees with the drawing is worse than no hit test, because it is
// wrong quietly. So `projectPoint` and `drawableRings` are imported from
// bmg-vector.js and used exactly as the renderer uses them, including:
//
//   - the antimeridian unwrapping (Fiji and Chukotka are emitted a second
//     time shifted 360°, so the half that belongs at the far edge of the map
//     is testable there too, exactly where it is drawn);
//   - the polar closure that makes Antarctica a filled cap rather than a
//     sliver (`forStroke = false`, the fill form — a hit test is about what
//     was filled, not what was outlined).
//
// Holes and multi-polygons both fall out of one rule: **even-odd crossing
// counting across every ring of a feature at once.** A point inside South
// Africa's outer ring and also inside its Lesotho-shaped hole crosses two
// boundaries, so it counts as outside South Africa — and Lesotho, a separate
// feature, then claims it. A point on one island of Alaska's hundred-odd
// rings crosses one boundary, so it counts as inside Alaska. Neither case
// needs code of its own.

// The code itself lives in _shared/geo-project.js since Path 20 P1; this file
// keeps its old name and exports so nothing that imports it changes.
export {
  projectFeatureRings, buildRegionIndex, pointInRings, hitTestRegion, largestRing, compactRings,
} from "../../_shared/geo-project.js";
