// sv-playback.js — the School Layout Visualizer's playback renderer: one
// animated frame of a mod transition on the visualize canvas, the R50/R53/R54
// collision simulation that holds groups at occupied squares, and the R57/R58
// staircase portal effects.
//
// Path 11 P2 increment 6 (BACKLOG.md, "Path 11", the P2 bullet). Moved from
// 035's classic script with their rules unchanged. What drawPlaybackFrame
// read from the page is now its arguments: the 2D context it draws on (the
// page's vizCtx, or the PNG export's offscreen context), and a view object
// holding the cell size, zoom, constant-width flag, settings, the two lane
// constants, the page's floorOffsetY and offsetPolyline, the travel-time
// panel callback, the reduced-motion test and the clock. PlaybackController
// (the play bar, its buttons and the animation loop) and the travel-time
// panel stay on the page: they are the DOM. The page keeps one wrapper per
// old name in its BRIDGE section and puts this module on window.SVPlayback.
// Nothing here touches the DOM, AppState or storage.
//
// view = { cellSize, zoom, constantWidth, settings, baseStroke, baseLane,
//          floorOffsetY(floorId), offsetPolyline(poly, entry, laneSpace, cx, cy, floorId),
//          onTravel(activeEntries, segForEntry, collisionMap, step, progress, rtCycleMs),
//          reducedMotion() → boolean, now() → ms }
//
// Its suite is test/playback.test.mjs (npm run test:schedule-visualizer-playback).

import { floorCellKey } from './sv-graph.js';

/**
 * buildTeleportLegs(pts, segLens, legBreak)
 * R58: Collects endpoint metadata for each teleport (staircase) leg so the
 * playback renderer can key localized portal effects (R57 pulse rings, R58
 * sequential dwell arc) to the paired tiles. The R33-era quadratic-bezier
 * control point (cx/cy) was dead weight after the R57 pulse-ring rewrite —
 * nothing consumed it — and has been removed.
 * Returns an array of leg descriptors: { i, ax, ay, bx, by }
 * where i is the segment index of the break, (ax, ay) the entry tile center,
 * and (bx, by) the exit tile center.
 */
export function buildTeleportLegs(pts, segLens, legBreak) {
  const legs = [];
  for (let i = 0; i < legBreak.length; i++) {
    if (!legBreak[i]) continue;
    legs.push({
      i,                              // index of the break
      ax: pts[i].x,   ay: pts[i].y,   // entry tile center
      bx: pts[i+1].x, by: pts[i+1].y, // exit tile center
    });
  }
  return legs;
}

/* ── R58: Sequential staircase dwell ────────────────────────────
   In sequential playback each group owns a 1/N time slice and the head used
   to sweep it length-linearly — staircase legs are zero-length, so dwell time
   was invisible. mapSequentialDwell converts the slice's time fraction into a
   piecewise drawn-length: the head walks, PAUSES at each staircase entry for
   a dwell share (stairSec expressed in walk-speed pixel-equivalents), then
   resumes. drawPortalDwellArc renders the pause as a clock-fill ring sweep
   (Option C1) in the group's color, matching the R57 pulse-ring language. */

/**
 * mapSequentialDwell(t01, totalLen, stairLegs, prefix, dwellPx)
 * Piecewise time→length mapping for sequential mode with staircase pauses.
 * t01       — 0..1 time fraction through the group's slice
 * totalLen  — geometric path length (walkable px; teleports are zero)
 * stairLegs — buildTeleportLegs output (ascending leg index order)
 * prefix    — cumulative drawn-length at each point (prefix[leg.i] = entry)
 * dwellPx   — pause size in pixel-equivalents (stairSec ÷ walkSec × cellSize)
 * Returns { drawnLen, dwellLeg, dwellFrac } — dwellLeg is non-null (with
 * dwellFrac 0..1) only while the head is paused at that leg's entry tile.
 */
export function mapSequentialDwell(t01, totalLen, stairLegs, prefix, dwellPx) {
  const clamped = Math.max(0, Math.min(1, t01));
  if (!stairLegs.length || dwellPx <= 0 || totalLen <= 0) {
    return { drawnLen: totalLen * clamped, dwellLeg: null, dwellFrac: 0 };
  }
  const timeLen = totalLen + stairLegs.length * dwellPx;
  let t = clamped * timeLen;
  for (const leg of stairLegs) {
    const entry = prefix[leg.i];
    if (t <= entry) return { drawnLen: t, dwellLeg: null, dwellFrac: 0 };
    if (t <= entry + dwellPx) {
      return { drawnLen: entry, dwellLeg: leg, dwellFrac: (t - entry) / dwellPx };
    }
    t -= dwellPx;   // consume this pause and keep walking
  }
  return { drawnLen: Math.min(t, totalLen), dwellLeg: null, dwellFrac: 0 };
}

/**
 * drawPortalDwellArc — Option C1 clock-fill sweep at a staircase entry tile.
 * A faint full-circle track plus a group-colored arc that sweeps clockwise
 * from 12 o'clock, filling in proportion to dwellFrac (0..1). Under
 * prefers-reduced-motion the sweep is replaced by a static ring for the
 * whole dwell so the pause still reads without animated geometry.
 */
export function drawPortalDwellArc(ctx, leg, dwellFrac, baseR, color, alphaScale, reducedMotion) {
  const r = baseR * 1.5;
  const w = Math.max(1.5, baseR * 0.45);
  ctx.save();
  ctx.lineCap = 'round';
  if (reducedMotion) {
    ctx.globalAlpha = 0.6 * alphaScale;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(leg.ax, leg.ay, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Track ring (subtle, full circle)
  ctx.globalAlpha = 0.18 * alphaScale;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(leg.ax, leg.ay, r, 0, Math.PI * 2);
  ctx.stroke();
  // Progress sweep from 12 o'clock, clockwise
  const start = -Math.PI / 2;
  ctx.globalAlpha = 0.85 * alphaScale;
  ctx.beginPath();
  ctx.arc(leg.ax, leg.ay, r, start, start + Math.PI * 2 * Math.max(0, Math.min(1, dwellFrac)));
  ctx.stroke();
  ctx.restore();
}

/**
 * R57: drawPortalPulse — elegant staircase teleport rendering.
 * Replaces the old map-spanning dashed bezier arcs. For each staircase
 * (teleport) leg we draw a localized, group-colored pulse at the two paired
 * tiles, keyed statelessly to how far the animated head (drawnLen) is from the
 * leg's entry point (legDist = geometric path length up to the entry tile):
 *   • Approaching the entry tile (descent): a ring CONTRACTS into it.
 *   • Just after teleporting out the exit tile (ascent): a ring EXPANDS from it
 *     with a brief inner core flash at the moment of emergence.
 * Outside a short window on either side nothing is drawn, so passed/arrived
 * groups leave no persistent artifact — the map stays quiet.
 *
 * leg:     { ax,ay, bx,by } endpoint screen coords from buildTeleportLegs.
 * legDist: cumulative drawn-length at the entry endpoint (ax,ay).
 * drawnLen: current animated head length along the path.
 * baseR:   ring radius unit (px); alphaScale: arrival tail-fade multiplier.
 */
export function drawPortalPulse(ctx, leg, legDist, drawnLen, baseR, color, alphaScale) {
  const W = baseR * 3.2;          // descent/ascent window length (px along path)
  const d = drawnLen - legDist;   // <0 approaching entry, >0 past exit
  if (d < -W || d > W) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, baseR * 0.5);

  if (d <= 0) {
    // Descent — ring contracts into the ENTRY tile as the head nears it.
    const p = 1 + d / W;                          // 0 (far) → 1 (at portal)
    const r = baseR * (1.9 - 1.5 * p);            // shrinks inward
    ctx.globalAlpha = Math.max(0, Math.sin(p * Math.PI) * 0.55 * alphaScale);
    ctx.beginPath(); ctx.arc(leg.ax, leg.ay, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke();
  } else {
    // Ascent — ring expands out of the EXIT tile just after emergence.
    const q = d / W;                              // 0 (just emerged) → 1 (gone)
    const r = baseR * (0.4 + 1.6 * q);            // grows outward
    ctx.globalAlpha = Math.max(0, (1 - q) * 0.6 * alphaScale);
    ctx.beginPath(); ctx.arc(leg.bx, leg.by, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke();
    if (q < 0.5) {                                // soft core flash at emergence
      ctx.globalAlpha = Math.max(0, (1 - q * 2) * 0.5 * alphaScale);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(leg.bx, leg.by, baseR * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * R50: buildCollisionSimulation(activeEntries, segForEntry, cellSize, walkSec, stairSec)
 *
 * Pre-computes per-entry cell-occupancy timelines so drawPlaybackFrame can:
 *   1. Hold groups at cell boundaries when a tile is occupied — R53 quadrant
 *      rules: each cell is split into 4 quadrants and a group reserves only
 *      the right half of the cell relative to its heading (entry + exit
 *      quadrants). Opposing flows occupy disjoint halves and never block;
 *      same-direction followers need 50% leader clearance on their shared
 *      quadrants; perpendicular crossings overlap one quadrant (75% rule).
 *      R54: reservations are JUST-IN-TIME per square — a slot only blocks
 *      while its group physically occupies the square; groups freely pass
 *      ahead of others that haven't arrived yet, and a waiting group keeps
 *      holding its current square so followers queue behind it.
 *   2. Return per-entry arrival times for the travel-time panel.
 *
 * Returns: Map<entry, { timelineMs: [{cellIdx, enterMs, exitMs}], totalMs, arrivedMs, waitEvents }>
 * waitEvents: [{cellIdx, waitMs}] for visual wait indicators.
 */
export function buildCollisionSimulation(activeEntries, segForEntry, walkSec, stairSec) {
  // Build per-entry ordered hallway cell arrays (de-duplicated).
  const entryPaths = new Map();
  for (const e of activeEntries) {
    const s = segForEntry(e);
    if (!s) continue;
    const cells = [];
    const seen  = new Set();
    for (const c of (s.hallwayCells || [])) {
      const k = `${c.floorId}:${c.x},${c.y}`;
      if (!seen.has(k)) { seen.add(k); cells.push({ x: c.x, y: c.y, floorId: c.floorId }); }
    }
    entryPaths.set(e, cells);
  }

  // Per-cell occupancy slots: Map<"fid:x,y", [{entry, enterMs, exitMs}]>
  const occupancy = new Map();
  const result    = new Map();

  // Priority order: alphabetical by group.id (or name as fallback).
  const sorted = [...activeEntries].sort((a, b) =>
    (a.group.id || a.group.name || '').localeCompare(b.group.id || b.group.name || ''));

  // R53: Quadrant occupancy — clearance applies only on quadrant overlap.
  //   • Opposite direction: disjoint right-lane halves, mask overlap = 0 →
  //     NO wait. The head-to-head right-side nudge handles the visual pass.
  //   • Same direction (dot > 0): both quadrants shared — follow like trains
  //     in successive block sections; leader only needs 50% slot clearance.
  //   • Crossing / turning / unknown (dot <= 0 with overlap): cautious 75%.
  const SAME_DIR_FRAC = 0.50;
  const CROSS_FRAC    = 0.75;
  const durMs         = walkSec * 1000;

  // Direction of travel through cell i (unit-ish grid vector toward next cell;
  // last cell inherits the approach direction). Cross-floor hops yield {0,0}.
  const dirAt = (cells, i) => {
    const a = cells[i];
    const b = (i + 1 < cells.length) ? cells[i + 1] : null;
    const p = (i > 0) ? cells[i - 1] : null;
    if (b && b.floorId === a.floorId) return { dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
    if (p && p.floorId === a.floorId) return { dx: Math.sign(a.x - p.x), dy: Math.sign(a.y - p.y) };
    return { dx: 0, dy: 0 };
  };

  // R53: Quadrant occupancy — each hallway cell is split into 4 quadrants
  // (NW=1, NE=2, SW=4, SE=8 bitmask). A travelling group keeps to the RIGHT
  // half of the cell (American traffic rules): it reserves the quadrant it
  // enters through (right side of its incoming heading) plus the quadrant it
  // exits through (right side of its outgoing heading). Example: heading
  // north, a group enters via the SE quadrant and reserves SE+NE. Heading
  // east, it enters via SW and reserves SW+SE. Opposing straight-line traffic
  // therefore occupies the disjoint other half and never conflicts; turns
  // reserve the true corner crossed (a left turn cuts the oncoming lane and
  // correctly blocks against it).
  // Screen coords: y grows downward, so right-perp of heading (dx,dy) = (-dy, dx).
  const quadBit = (qx, qy) => (qy < 0 ? (qx < 0 ? 1 : 2) : (qx < 0 ? 4 : 8));
  const quadMaskAt = (cells, i) => {
    const a  = cells[i];
    const nb = (i + 1 < cells.length) ? cells[i + 1] : null;
    const pv = (i > 0) ? cells[i - 1] : null;
    const adj = (o) => o && o.floorId === a.floorId &&
                       (Math.abs(o.x - a.x) + Math.abs(o.y - a.y)) === 1;
    const inDir  = adj(pv) ? { dx: a.x - pv.x,  dy: a.y - pv.y  } : null;
    const outDir = adj(nb) ? { dx: nb.x - a.x,  dy: nb.y - a.y  } : null;
    const dIn  = inDir  || outDir;
    const dOut = outDir || inDir;
    if (!dIn) return 15;   // teleport hop / isolated cell — reserve all 4 quadrants
    let mask = 0;
    // Entry quadrant: right side of incoming heading, back half of the cell.
    mask |= quadBit(-dIn.dy  - dIn.dx,   dIn.dx  - dIn.dy);
    // Exit quadrant: right side of outgoing heading, front half of the cell.
    mask |= quadBit(-dOut.dy + dOut.dx,  dOut.dx + dOut.dy);
    return mask;
  };

  for (const e of sorted) {
    const cells = entryPaths.get(e);
    if (!cells || cells.length === 0) {
      result.set(e, { timelineMs: [], cellCount: 0, totalMs: 0, arrivedMs: 0, waitMs: 0 });
      continue;
    }

    const timeline  = [];
    let curMs       = 0;
    let totalWaitMs = 0;
    let prevOcc     = null;   // R54: this group's occupancy record for the square it last entered

    for (let i = 0; i < cells.length; i++) {
      const c    = cells[i];
      const k    = `${c.floorId}:${c.x},${c.y}`;
      const dir  = dirAt(cells, i);
      const mask = quadMaskAt(cells, i);   // R53: right-lane quadrant footprint

      // Find earliest entry time respecting quadrant-overlap block rules.
      // R54: JUST-IN-TIME reservation — a square is only blocked while a
      // conflicting group is PHYSICALLY inside it. A booked slot whose
      // enterMs lies in the future does NOT block: if this group can fully
      // transit the square before that group arrives (enterMs + durMs <=
      // slot.enterMs) it passes ahead freely, regardless of priority order.
      // Otherwise it waits for that slot's clearance fraction:
      //   • disjoint quadrant masks → never a conflict (opposing right-lane
      //     halves pass freely);
      //   • same direction (dot > 0) → train-block 50% leader clearance;
      //   • crossing / turning (dot <= 0 with overlap) → cautious 75%.
      // Delaying enterMs can create conflicts with slots already examined,
      // so we iterate to a fixed point (enterMs is monotonically increasing
      // and bounded by the max clearance time, so this always terminates;
      // the guard is belt-and-braces).
      const slots  = occupancy.get(k) || [];
      let enterMs  = curMs;

      let _jitGuard = 0, _jitChanged = true;
      while (_jitChanged && _jitGuard++ < 64) {
        _jitChanged = false;
        for (const slot of slots) {
          if ((mask & slot.mask) === 0) continue;          // disjoint quadrants — no block
          if (enterMs + durMs <= slot.enterMs) continue;   // we fully clear before they arrive
          const dot     = dir.dx * slot.dir.dx + dir.dy * slot.dir.dy;
          const frac    = (dot > 0) ? SAME_DIR_FRAC : CROSS_FRAC;
          const clearMs = slot.enterMs + (slot.exitMs - slot.enterMs) * frac;
          if (enterMs < clearMs) { enterMs = clearMs; _jitChanged = true; }
        }
      }
      totalWaitMs += enterMs - curMs;

      // R54: hold-current-square — while this group waits at the boundary it
      // is still standing in its PREVIOUS square, so extend that occupancy
      // record through the wait. Followers behind it queue realistically.
      // (The timeline entry keeps its walk-time exitMs so the renderer still
      // freezes the comet hard at the cell boundary during the wait.)
      if (prevOcc && enterMs > curMs) prevOcc.exitMs = enterMs;

      const exitMs = enterMs + durMs;
      if (!occupancy.has(k)) occupancy.set(k, []);
      const occRec = { entry: e, enterMs, exitMs, dir, mask };
      occupancy.get(k).push(occRec);
      prevOcc = occRec;

      // cumCells = 1-based count of cells completed when this slot exits
      timeline.push({ cellIdx: i, cell: c, enterMs, exitMs, cumCells: i + 1 });
      curMs = exitMs;
    }

    result.set(e, {
      timelineMs: timeline,
      cellCount:  cells.length,
      totalMs:    curMs,
      arrivedMs:  curMs,
      waitMs:     totalWaitMs,
    });
  }

  return result;
}

/**
 * drawPlaybackFrame(data, pb)
 * Draws only the current transition's paths, each "drawing itself" up to
 * pb.progress (0..1). Simultaneous mode advances all groups together;
 * sequential mode gives each group a 1/N slice of the cycle.
 *
 * R50 additions:
 *   • Per-group real-time localProgress derived from collision simulation timelines.
 *   • Groups wait at cell boundaries per occupancy rules; tail fades after arrival.
 * R54: groups always render on the right half of each square relative to
 *   their travel direction (keep-right bias inside offsetPolyline); the old
 *   R50 head-to-head nudge and getHeadToHeadNudge helper were removed.
 *
 * Coordinate system matches drawVizPaths: cell (c,r) center = ((c+0.5)*cellSize,(r+0.5)*cellSize).
 * The blueprint veil is already applied by drawVizBlueprint() (Step 4).
 * R57/R58: Teleport (staircase) legs render as localized portal effects at the
 *   paired tiles — contracting/expanding pulse rings (drawPortalPulse), plus a
 *   sweeping dwell arc at the entry tile in sequential mode (drawPortalDwellArc).
 */
export function drawPlaybackFrame(ctx, data, pb, view) {
  if (!data || !data.entries.length) return;
  const step     = pb.currentStep;
  const progress = pb.progress;
  const cellSize = view.cellSize;
  // R52: group icon size multiplier (comet head/tail + trail head dots)
  const iconScale = (typeof pb.cometScale === 'number' && pb.cometScale > 0) ? pb.cometScale : 1.5;
  const modIdx   = step + 1;

  const segForEntry = (entry) =>
    (entry.rawSegments || []).find(s => s.fromMod === modIdx && s.path && s.path.length > 1);

  const activeEntries = data.entries.filter(e => !!segForEntry(e));
  if (!activeEntries.length) return;

  // R53: Live head-cell registry for the hover tooltip. Rebuilt every frame;
  // maps "floorId:x,y" → [{name, color}] for each comet HEAD currently inside
  // that grid cell (tails never count). Cleared by PlaybackController.close().
  const liveHeads = new Map();
  pb._liveHeads = liveHeads;

  const isSeq      = pb.mode === 'sequential';
  const entryCount = activeEntries.length;

  // Adaptive lane/stroke sizing matching drawVizPaths
  const z = view.zoom;
  const scaleComp = view.constantWidth ? (1 / z) : 1;
  const sizeFactor = cellSize / 40;
  const maxConc_pb = (data && data.stats && data.stats.maxConcurrency) ? data.stats.maxConcurrency : 1;
  let laneSpace, strokeW;
  if (maxConc_pb <= 1) {
    strokeW   = view.baseStroke * sizeFactor * scaleComp;
    laneSpace = view.baseLane   * sizeFactor * scaleComp;
  } else {
    const budgetPx_pb  = cellSize * 0.65;
    const maxStroke_pb = budgetPx_pb / (maxConc_pb + 0.5);
    strokeW   = Math.min(view.baseStroke * sizeFactor, maxStroke_pb) * scaleComp;
    const pitch_pb = Math.min(strokeW + Math.max(1, strokeW * 0.3), budgetPx_pb / Math.max(maxConc_pb - 1, 1));
    laneSpace = pitch_pb * scaleComp;
  }

  // R56: Head-dot radius base. The per-lane strokeW above is squeezed hard when
  // many groups share a corridor (budget / (maxConc + 0.5)), which collapsed the
  // comet head/travel dots to a couple of pixels at 30+ groups. The dots are
  // position markers, not lanes, so we floor their base to a cell-relative size
  // that survives the squeeze. At low concurrency strokeW already exceeds the
  // floor, so the look there is unchanged. The size slider (iconScale) then
  // multiplies this for a much more aggressive top end.
  const dotStroke = Math.max(strokeW, cellSize * 0.10 * scaleComp);

  const cxFn = (c) => (c + 0.5) * cellSize;

  // R50: Collision-aware simulation
  const rtWalkSec  = (view.settings.tileWalkTime  != null) ? view.settings.tileWalkTime  : 3;
  const rtStairSec = (view.settings.staircaseTime != null) ? view.settings.staircaseTime : 8;

  let collisionMap = null;
  let rtCycleMs = 1000;

  if (!isSeq) {
    collisionMap = buildCollisionSimulation(activeEntries, segForEntry, rtWalkSec, rtStairSec);
    for (const [, sim] of collisionMap) {
      if (sim.arrivedMs > rtCycleMs) rtCycleMs = sim.arrivedMs;
    }
    pb._r50CycleMs = rtCycleMs;
  }

  // Update the travel-time side panel every frame
  view.onTravel(activeEntries, segForEntry, collisionMap, step, progress, rtCycleMs);

  activeEntries.forEach((entry, entryIdx) => {
    const seg = segForEntry(entry);
    if (!seg) return;

    // R50: Derive position directly from collision-simulation timeline.
    // elapsedMs = how many ms have elapsed since this transition started.
    // For collision mode: walk the timeline to find which cell we're in and
    // interpolate fractionally within it. This produces hard stops at cell
    // boundaries during wait intervals — the group truly freezes.
    const sim = collisionMap && collisionMap.get(entry);
    const elapsedMs = progress * rtCycleMs;

    // isArrived: the group has finished its last scheduled cell.
    let isArrived = false;
    // localProgress: 0..1 fraction of the full path for sequential/fallback use.
    let localProgress;
    // drawnLenOverride: when set, overrides the localProgress→drawnLen pipeline.
    let drawnLenOverride = null;

    if (isSeq) {
      const sliceStart = entryIdx / entryCount;
      const sliceEnd   = (entryIdx + 1) / entryCount;
      localProgress = Math.max(0, Math.min(1, (progress - sliceStart) / (sliceEnd - sliceStart)));
      isArrived = localProgress >= 1.0;
    } else if (sim && sim.timelineMs.length > 0) {
      const tl = sim.timelineMs;
      if (elapsedMs >= sim.arrivedMs) {
        // Group has finished — fully arrived.
        isArrived     = true;
        localProgress = 1.0;
        drawnLenOverride = Infinity;  // draw full path (tail fade will clip it)
      } else {
        // Find which cell slot we are currently inside.
        let activeCellIdx = -1;
        let cellFrac      = 0;   // 0..1 fraction through this cell's own slot

        for (let ti = 0; ti < tl.length; ti++) {
          const slot = tl[ti];
          if (elapsedMs < slot.enterMs) {
            // We are waiting BEFORE this cell — freeze at end of previous cell.
            activeCellIdx = ti - 1;
            cellFrac      = 1.0;   // fully through previous cell (held at exit)
            break;
          } else if (elapsedMs <= slot.exitMs) {
            // We are INSIDE this cell — interpolate.
            activeCellIdx = ti;
            cellFrac      = (elapsedMs - slot.enterMs) / (slot.exitMs - slot.enterMs);
            break;
          }
        }
        if (activeCellIdx === -1 && elapsedMs < tl[0].enterMs) {
          // Before the very first cell — waiting at the origin.
          activeCellIdx = -1;
          cellFrac      = 0;
        }

        // Convert (activeCellIdx, cellFrac) to a fraction of the full cellCount.
        const cellCount  = sim.cellCount || tl.length;
        const cellsDrawn = (activeCellIdx < 0) ? 0 : (activeCellIdx + cellFrac);
        localProgress    = cellsDrawn / cellCount;
        // drawnLenOverride will be computed from localProgress after totalLen is known.
        // We set a marker so the code below uses cell-linear interpolation not stair-phase logic.
        drawnLenOverride = null;   // computed below from localProgress once totalLen known
      }
    } else {
      // No collision data (sequential or no sim) — original linear progress.
      localProgress = Math.min(1, progress);
      isArrived     = localProgress >= 1.0;
    }

    // R50: Tail fade after arrival
    let tailAlphaScale  = 1.0;
    let tailFadeProgress = 0;
    if (isArrived && sim) {
      const FADE_MS    = Math.min(rtCycleMs * 0.15, 1800);
      const fadedSince = elapsedMs - sim.arrivedMs;
      tailFadeProgress = Math.min(1, fadedSince / FADE_MS);
      tailAlphaScale   = 1 - tailFadeProgress;
      if (tailAlphaScale <= 0) return;
    }

    // R54: the R50 head-to-head nudge (first-cell-only detection, whole-path
    // uniform offset) is removed — superseded by the per-point keep-right
    // bias now applied inside offsetPolyline for every group, every cell.

    const rawCells = seg.path.map(p => ({ x: p.x, y: p.y, floorId: p.floorId }));
    if (rawCells.length < 2) return;

    const segFloorId = rawCells[0].floorId;
    const offY = view.floorOffsetY(segFloorId);
    const cyFn = (r) => (r + 0.5) * cellSize + offY;

    let offsetPts = view.offsetPolyline(rawCells, entry, laneSpace, cxFn, cyFn, segFloorId);

    const annotatedPts = offsetPts.map((op, i) => ({
      x: op.x, y: op.y,
      floorId: rawCells[i].floorId,
      gx: rawCells[i].x,
      gy: rawCells[i].y,
    }));
    if (annotatedPts.length < 2) return;

    let totalLen = 0;
    const segLens = [];
    const legBreak = [];
    for (let i = 1; i < annotatedPts.length; i++) {
      const sameFloor = annotatedPts[i].floorId === annotatedPts[i-1].floorId;
      const gd = sameFloor ? (Math.abs(annotatedPts[i].gx - annotatedPts[i-1].gx) + Math.abs(annotatedPts[i].gy - annotatedPts[i-1].gy)) : 99;
      const teleport = !sameFloor || gd > 1;
      const dx = annotatedPts[i].x - annotatedPts[i-1].x;
      const dy = annotatedPts[i].y - annotatedPts[i-1].y;
      const l = teleport ? 0 : Math.sqrt(dx*dx + dy*dy);
      segLens.push(l);
      legBreak.push(teleport);
      totalLen += l;
    }

    const stairLegs = buildTeleportLegs(annotatedPts, segLens, legBreak);
    // R57: cumulative drawn-length up to each point — used to key portal pulses
    // to the head's distance from each staircase entry tile (_prefix[i] = drawn
    // length when the head reaches annotatedPts[i]).
    const _prefix = [0];
    for (let i = 0; i < segLens.length; i++) _prefix.push(_prefix[i] + segLens[i]);

    // R57: drawnLen is length-linear with progress. Staircase hops are
    // zero-length teleport legs; descent/ascent is shown locally at the
    // paired tiles by drawPortalPulse instead of map-spanning geometry.
    // R58: in SEQUENTIAL mode the slice's time fraction is now routed through
    // mapSequentialDwell, which pauses the head at each staircase entry for a
    // dwell share (stairSec in walk-speed pixel-equivalents) while a clock-fill
    // arc sweeps at the portal tile — restoring visible dwell time.
    // drawnLenOverride=Infinity means fully arrived (draw entire path for tail-fade).
    const clampedLP = Math.min(localProgress, 1);
    let drawnLen, dwellLeg = null, dwellFrac = 0;
    if (drawnLenOverride === Infinity) {
      drawnLen = totalLen;
    } else if (isSeq && stairLegs.length && !isArrived) {
      const dwellPx = (rtWalkSec > 0 ? (rtStairSec / rtWalkSec) : 2) * cellSize;
      const m = mapSequentialDwell(clampedLP, totalLen, stairLegs, _prefix, dwellPx);
      drawnLen = m.drawnLen; dwellLeg = m.dwellLeg; dwellFrac = m.dwellFrac;
    } else {
      drawnLen = Math.min(totalLen * clampedLP, totalLen);
    }

    const color = entry.group.color || '#3b82f6';
    const isComet = pb.animStyle === 'comet';

    // Trail mode drawing (with arrival tail-fade)
    if (!isComet) {
      const trailAlpha  = isArrived ? (0.92 * tailAlphaScale) : 0.92;
      // Arrived tail: clip from origin side proportional to fade progress
      const revealFrom  = isArrived ? (totalLen * tailFadeProgress * 0.85) : 0;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = strokeW;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = trailAlpha;
      ctx.beginPath();

      let accumulated = 0;
      let penDown = false;
      for (let i = 0; i < segLens.length; i++) {
        if (legBreak[i]) {
          penDown = false;
          ctx.moveTo(annotatedPts[i+1].x, annotatedPts[i+1].y);
          continue;
        }
        const segStart = accumulated;
        const segEnd   = accumulated + segLens[i];
        const remaining = drawnLen - accumulated;
        if (remaining <= 0) break;

        const frac = Math.min(remaining / segLens[i], 1);
        const tx = annotatedPts[i].x + (annotatedPts[i+1].x - annotatedPts[i].x) * frac;
        const ty = annotatedPts[i].y + (annotatedPts[i+1].y - annotatedPts[i].y) * frac;

        if (segEnd <= revealFrom) {
          ctx.moveTo(tx, ty);
          penDown = false;
        } else if (segStart < revealFrom) {
          const sf = (revealFrom - segStart) / segLens[i];
          const sx = annotatedPts[i].x + (annotatedPts[i+1].x - annotatedPts[i].x) * sf;
          const sy = annotatedPts[i].y + (annotatedPts[i+1].y - annotatedPts[i].y) * sf;
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          penDown = true;
        } else {
          if (!penDown) { ctx.moveTo(annotatedPts[i].x, annotatedPts[i].y); penDown = true; }
          ctx.lineTo(tx, ty);
        }
        accumulated += segLens[i];
        if (accumulated >= drawnLen) break;
      }
      ctx.stroke();
      ctx.restore();
    }

    // Comet mode drawing
    if (isComet && clampedLP > 0) {
      const TAIL_TILES = 2;
      const tailLen = TAIL_TILES * cellSize;
      const tailStart = Math.max(0, drawnLen - tailLen);
      const TAIL_SEGMENTS = 18;
      const tailPoints = [];
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        if (legBreak[i]) { acc += 0; continue; }
        const segStart = acc, segEnd = acc + segLens[i];
        if (segEnd < tailStart) { acc = segEnd; continue; }
        if (segStart > drawnLen) break;
        const clampA = Math.max(segStart, tailStart);
        const clampB = Math.min(segEnd, drawnLen);
        if (segLens[i] === 0) { acc = segEnd; continue; }
        const steps = Math.max(2, Math.ceil(TAIL_SEGMENTS * (clampB - clampA) / tailLen));
        for (let s = 0; s <= steps; s++) {
          const d = clampA + (clampB - clampA) * (s / steps);
          const f = (d - segStart) / segLens[i];
          tailPoints.push({
            x: annotatedPts[i].x + (annotatedPts[i+1].x - annotatedPts[i].x) * f,
            y: annotatedPts[i].y + (annotatedPts[i+1].y - annotatedPts[i].y) * f,
            t: (d - tailStart) / Math.max(drawnLen - tailStart, 1),
          });
        }
        acc = segEnd;
      }
      if (tailPoints.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 1; i < tailPoints.length; i++) {
          const tMid = (tailPoints[i-1].t + tailPoints[i].t) * 0.5;
          ctx.globalAlpha = Math.pow(tMid, 1.4) * 0.88 * tailAlphaScale;
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeW * (0.3 + 0.7 * tMid) * iconScale;
          ctx.beginPath();
          ctx.moveTo(tailPoints[i-1].x, tailPoints[i-1].y);
          ctx.lineTo(tailPoints[i].x,   tailPoints[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // R57: Staircase teleports — localized descend/emerge pulses at the paired
    // tiles instead of map-spanning bezier arcs. portalR tracks the head-dot
    // size so the pulse reads at any zoom / icon-size setting. Nothing is drawn
    // outside the head's approach/emerge window, so the map stays quiet.
    const portalR = dotStroke * 2.4 * iconScale;
    for (const leg of stairLegs) {
      drawPortalPulse(ctx, leg, _prefix[leg.i], drawnLen, portalR, color, tailAlphaScale);
    }
    // R58: sequential dwell — clock-fill sweep at the entry tile while the
    // head is paused there (dwellLeg is only ever set in sequential mode).
    if (dwellLeg) {
      drawPortalDwellArc(ctx, dwellLeg, dwellFrac, portalR, color, tailAlphaScale, view.reducedMotion());
    }

    // Head position — always interpolated along the hallway. Staircase hops are
    // instantaneous teleports (the pulse above conveys the descent/ascent).
    let headX = annotatedPts[0].x, headY = annotatedPts[0].y;
    {
      let acc2 = 0;
      let headCell = annotatedPts[0];                                   // R53
      for (let i = 0; i < segLens.length; i++) {
        if (legBreak[i]) { headX = annotatedPts[i+1].x; headY = annotatedPts[i+1].y; headCell = annotatedPts[i+1]; continue; }
        const rem = drawnLen - acc2;
        if (rem <= 0) break;
        const frac = Math.min(rem / segLens[i], 1);
        headX = annotatedPts[i].x + (annotatedPts[i+1].x - annotatedPts[i].x) * frac;
        headY = annotatedPts[i].y + (annotatedPts[i+1].y - annotatedPts[i].y) * frac;
        headCell = (frac < 0.5) ? annotatedPts[i] : annotatedPts[i+1];  // R53: nearest grid cell
        acc2 += segLens[i];
        if (acc2 >= drawnLen) break;
      }
      // R53: register this group's head cell for the hover tooltip. Arrived
      // groups are excluded (they're inside their room — only travelling
      // heads occupy hallway squares), and the fading tail never counts.
      if (!isArrived && clampedLP > 0 && headCell && headCell.gx != null) {
        const hk = floorCellKey(headCell.floorId, headCell.gx, headCell.gy);
        if (!liveHeads.has(hk)) liveHeads.set(hk, []);
        liveHeads.get(hk).push({ name: entry.group.name, color: entry.group.color || '#3b82f6' });
      }
    }

    // Head dot — only while travelling, not after arrival
    if (!isArrived && clampedLP > 0) {
      if (isComet) {
        ctx.save();
        ctx.globalAlpha = 0.25; ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(headX, headY, dotStroke * 2.2 * iconScale, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(headX, headY, dotStroke * 1.2 * iconScale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(headX, headY, dotStroke * 0.7 * iconScale, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(headX, headY, dotStroke * 0.9 * iconScale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(headX, headY, dotStroke * 0.55 * iconScale, 0, Math.PI * 2); ctx.fill();
      }
    }

    // R50: Amber waiting ring when held at a cell boundary
    if (!isArrived && !isComet && sim && sim.timelineMs.length > 0 && clampedLP > 0.01) {
      const elapsedMs = progress * rtCycleMs;
      let isWaiting = false;
      for (let ti = 0; ti < sim.timelineMs.length; ti++) {
        const slot = sim.timelineMs[ti];
        const prevExit = ti > 0 ? sim.timelineMs[ti-1].exitMs : 0;
        if (elapsedMs < slot.enterMs - 10 && elapsedMs >= prevExit) {
          isWaiting = true; break;
        }
      }
      if (isWaiting) {
        const pulsePhase = (view.now() % 900) / 900;
        const pulseR = (dotStroke * 1.6 + dotStroke * 0.5 * Math.sin(pulsePhase * Math.PI * 2)) * iconScale;
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(headX, headY, pulseR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

  });

  // Origin dots (trail mode)
  if (pb.animStyle !== 'comet') {
    activeEntries.forEach(entry => {
      const seg = segForEntry(entry);
      if (!seg || !seg.path.length) return;
      const rawCells0 = seg.path.map(p => ({ x: p.x, y: p.y, floorId: p.floorId }));
      const segFloorId0 = rawCells0[0].floorId;
      const offY0 = view.floorOffsetY(segFloorId0);
      const cyFn0 = (r) => (r + 0.5) * cellSize + offY0;
      const offsetPts0 = view.offsetPolyline(rawCells0, entry, laneSpace, cxFn, cyFn0, segFloorId0);
      const px = offsetPts0.length ? offsetPts0[0].x : (rawCells0[0].x + 0.5) * cellSize;
      const py = offsetPts0.length ? offsetPts0[0].y : (rawCells0[0].y + 0.5) * cellSize + offY0;
      const dotR = strokeW * 1.1;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, dotR + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = entry.group.color || '#3b82f6';
      ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }
}
