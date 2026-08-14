/* Timeline Builder — story mode (projector playthrough) math.

   Story mode steps through a timeline one event at a time on the projector,
   documentary style, with the map panning and zooming from each event's place
   to the next. Everything in here is pure: no DOM, no state, so the parts that
   are easy to get silently wrong (which step follows which, where the map is
   pointed, what the context strip looks like) can be asserted directly.

   Design decisions worth stating, because they constrain the UI code:

   - **One base map, moved by CSS, rather than one render per step.** The
     existing renderer (`TimelinePlaces.renderMapImage`, which delegates to the
     Blank Map Generator's vector renderer) takes real time and real memory per
     render — fine once per print, not fine between every click on a projector
     while a class waits. So story mode renders the *whole* pinned extent once
     and then treats that single image as a viewport to pan and zoom inside.
     `viewTransform` below is the entire mechanism. It also means the animation
     between two events is a plain interpolation of two numbers plus a scale,
     which is what makes smooth motion cheap enough to be worth having.
   - **A view is (centre, zoom), not a bounds box.** Interpolating two centre
     points and a zoom factor is stable; interpolating two bounds boxes is not
     (the aspect ratio wanders mid-flight and the map appears to squash).
   - **Zoom interpolates geometrically, not linearly.** Going 1x → 4x linearly
     spends most of the animation already zoomed in and then crawls; the
     geometric path is what reads as a steady approach. */
(function (global) {
  'use strict';

  /** Same rule as TimelinePlaces.hasCoords, restated here so story mode's math
      can be reasoned about (and unit-driven) without the gazetteer module
      needing to be loaded first. */
  function hasCoords(place) {
    return !!place && typeof place.lat === 'number' && typeof place.lon === 'number' &&
      isFinite(place.lat) && isFinite(place.lon);
  }

  function sortedEvents(events) {
    return (events || []).slice().sort(function (a, b) { return a.yearStart - b.yearStart; });
  }

  /**
   * The playthrough order: every event, chronological, one step each —
   * including events on other tracks, since a projector audience is watching
   * one story, not several lanes.
   */
  function buildSteps(events) {
    return sortedEvents(events).map(function (ev, i) {
      return { event: ev, index: i, placed: hasCoords(ev.place) };
    });
  }

  /** The view story mode starts from and returns to: the whole pinned extent,
      unzoomed. Entering the first step then animates *in* from the overview,
      which is what tells a class where in the world they are before it tells
      them where in the world this particular event is. */
  function overviewView() {
    return { cx: 50, cy: 50, zoom: 1, dim: false };
  }

  /**
   * One view per step. `project(lat, lon)` returns {x, y} as 0..100
   * percentages of the base map (i.e. TimelinePlaces.projectPct bound to the
   * story's bounds) — passed in rather than imported so this stays pure.
   *
   * An event with no place **keeps the previous view and dims the map**: the
   * class stays looking at wherever the story last was rather than being
   * yanked back to a world view, and the dimming is what says "this one isn't
   * on the map" without a sentence of apology on screen. Before any placed
   * event has been reached, "the previous view" is the overview.
   */
  function resolveViews(steps, project, zoom) {
    var z = zoom || 2.6;
    var last = overviewView();
    return (steps || []).map(function (s) {
      if (s.placed) {
        var p = project(s.event.place.lat, s.event.place.lon);
        last = { cx: p.x, cy: p.y, zoom: z, dim: false };
        return { cx: last.cx, cy: last.cy, zoom: last.zoom, dim: false };
      }
      return { cx: last.cx, cy: last.cy, zoom: last.zoom, dim: true };
    });
  }

  /**
   * Turns a view into the CSS transform that shows it inside a `vw` x `vh`
   * viewport, for a base map image drawn at exactly that size (so zoom 1 is
   * the whole map, edge to edge).
   *
   * Clamped so the map can never be dragged off its own edges — a pin near a
   * corner would otherwise put half the panel on blank background, which on a
   * projector reads as a broken tool rather than as an edge. The clamp is what
   * makes a coastal or border event look deliberate.
   */
  function viewTransform(view, vw, vh) {
    var z = Math.max(1, (view && view.zoom) || 1);
    var cx = (view && view.cx) || 0, cy = (view && view.cy) || 0;
    var tx = vw / 2 - (cx / 100) * vw * z;
    var ty = vh / 2 - (cy / 100) * vh * z;
    tx = Math.min(0, Math.max(vw - vw * z, tx));
    ty = Math.min(0, Math.max(vh - vh * z, ty));
    return { tx: tx, ty: ty, scale: z };
  }

  /** Standard ease-in-out: the pan starts and lands gently instead of
      snapping, which is the difference between "the map moved" and "the map
      was yanked". */
  function easeInOut(t) {
    var x = Math.min(1, Math.max(0, t));
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }

  /** Interpolates two views. Centre moves linearly; zoom moves geometrically
      (see the header note) so a 1x → 4x flight approaches at a steady
      apparent rate rather than arriving early and then creeping. */
  function lerpView(a, b, t) {
    var e = easeInOut(t);
    var za = Math.max(0.01, a.zoom || 1), zb = Math.max(0.01, b.zoom || 1);
    return {
      cx: a.cx + (b.cx - a.cx) * e,
      cy: a.cy + (b.cy - a.cy) * e,
      zoom: za * Math.pow(zb / za, e)
    };
  }

  /**
   * Where each event sits along the context strip at the bottom of the screen,
   * as a 0..100 percentage. Uses the same `yearToUnit` the real timeline does,
   * so the strip honours the timeline's own scale mode (linear or compressed)
   * and cannot disagree with the printed or on-screen views about where a year
   * falls.
   *
   * A timeline whose events all share one year has no span to spread across;
   * everything sits at the middle rather than piling up at the left edge,
   * which is what `yearToUnit` returns for a zero span.
   */
  function stripPositions(events, scaleMode) {
    var TL = global.TimelineLayout;
    var list = sortedEvents(events);
    if (!list.length || !TL) return [];
    var range = TL.yearRangeOf(list);
    if (!(range.max > range.min)) {
      return list.map(function (ev) { return { id: ev.id, pct: 50 }; });
    }
    return list.map(function (ev) {
      return { id: ev.id, pct: TL.yearToUnit(ev.yearStart, range.min, range.max, scaleMode) * 100 };
    });
  }

  /** Clamps a step index into range, so "next" on the last step and "previous"
      on the first are no-ops rather than errors. */
  function clampStep(i, total) {
    if (!total) return 0;
    return Math.min(total - 1, Math.max(0, i));
  }

  global.TimelineStory = {
    hasCoords: hasCoords,
    buildSteps: buildSteps,
    overviewView: overviewView,
    resolveViews: resolveViews,
    viewTransform: viewTransform,
    easeInOut: easeInOut,
    lerpView: lerpView,
    stripPositions: stripPositions,
    clampStep: clampStep
  };
})(typeof window !== 'undefined' ? window : global);
