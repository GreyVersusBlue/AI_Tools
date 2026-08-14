/* Timeline Builder — places, map extent math, and the base-map render call.

   Every historical event has a where as well as a when. This module is the
   "where" half: a built-in gazetteer so a teacher picks "Philadelphia,
   Pennsylvania" from a list instead of hunting down 39.95 / -75.17, plus the
   pure geometry that turns a set of placed events into a map extent and then
   into pin positions on that map.

   THE BASE MAP IS NOT RENDERED HERE. It is rendered by
   Tools/blank-map-generator/bmg-vector.js, which was read first (per this
   round's assignment) and found to be genuinely standalone: renderBaseMapCanvas
   reads only `preset.bounds` / `preset.dataset` and a style, touches no map-tool
   state, and resolves its own data directory from `import.meta.url` — so it
   renders correctly when called from a different tool's page. Re-deriving its
   antimeridian handling (unwrapRing/drawableRings — the reason a naive plate
   carrée render of this data draws stray full-width lines across the South
   Pacific and northern Siberia) would have been the only real content of a
   hand-rolled renderer, and getting it subtly wrong is the kind of bug that
   ships. So this module calls it instead, and vendors no new data or library.

   The coupling that buys is worth recording: this tool now has a runtime
   dependency on another tool's module. It is guarded (a dynamic import inside
   a try/catch, with a plain-language failure message rather than a broken
   page), and both bmg-vector.js and its data/ files are already in sw.js
   PRECACHE_URLS, so offline is unaffected.

   Plain global script (window.TimelinePlaces), matching tlb-layout.js /
   tlb-store.js and the classic <script> tags on 015-timeline-builder.html. */
(function (global) {
  'use strict';

  /* ---------- the gazetteer ----------
     Well-known cities, countries, and all 50 US states, chosen for a middle
     school social studies course rather than for coverage: the places that
     actually turn up in a 7th grade timeline. Coordinates are a representative
     point (a city's centre, a country's or state's rough geographic middle) —
     precise enough to land a pin in the right place on a classroom map, and
     not pretending to be more than that.

     Typing a place that isn't on this list is fully supported: the name is
     free text and the lat/lon boxes stay editable, so "Lexington and Concord,
     Massachusetts" works exactly as well as a listed entry. */
  var GAZETTEER = [
    /* United States — cities and historic sites */
    { name: 'Washington, D.C.', lat: 38.91, lon: -77.04 },
    { name: 'New York City, New York', lat: 40.71, lon: -74.01 },
    { name: 'Boston, Massachusetts', lat: 42.36, lon: -71.06 },
    { name: 'Philadelphia, Pennsylvania', lat: 39.95, lon: -75.17 },
    { name: 'Baltimore, Maryland', lat: 39.29, lon: -76.61 },
    { name: 'Chicago, Illinois', lat: 41.88, lon: -87.63 },
    { name: 'Detroit, Michigan', lat: 42.33, lon: -83.05 },
    { name: 'St. Louis, Missouri', lat: 38.63, lon: -90.20 },
    { name: 'New Orleans, Louisiana', lat: 29.95, lon: -90.07 },
    { name: 'Atlanta, Georgia', lat: 33.75, lon: -84.39 },
    { name: 'Charleston, South Carolina', lat: 32.78, lon: -79.93 },
    { name: 'Miami, Florida', lat: 25.77, lon: -80.19 },
    { name: 'Houston, Texas', lat: 29.76, lon: -95.37 },
    { name: 'Denver, Colorado', lat: 39.74, lon: -104.99 },
    { name: 'Los Angeles, California', lat: 34.05, lon: -118.24 },
    { name: 'San Francisco, California', lat: 37.77, lon: -122.42 },
    { name: 'Seattle, Washington', lat: 47.61, lon: -122.33 },
    { name: 'Jamestown, Virginia', lat: 37.21, lon: -76.78 },
    { name: 'Williamsburg, Virginia', lat: 37.27, lon: -76.71 },
    { name: 'Yorktown, Virginia', lat: 37.24, lon: -76.51 },
    { name: 'Trenton, New Jersey', lat: 40.22, lon: -74.74 },
    { name: 'Saratoga Springs, New York', lat: 43.08, lon: -73.78 },
    { name: 'Valley Forge, Pennsylvania', lat: 40.10, lon: -75.45 },
    { name: 'Gettysburg, Pennsylvania', lat: 39.83, lon: -77.23 },
    { name: 'Appomattox, Virginia', lat: 37.36, lon: -78.83 },
    { name: 'Montgomery, Alabama', lat: 32.38, lon: -86.30 },
    { name: 'Selma, Alabama', lat: 32.41, lon: -87.02 },
    { name: 'Little Rock, Arkansas', lat: 34.75, lon: -92.29 },
    { name: 'Pearl Harbor, Hawaii', lat: 21.36, lon: -157.97 },
    { name: 'Ellis Island, New York', lat: 40.70, lon: -74.04 },

    /* United States — all 50 states, at a representative centre */
    { name: 'Alabama', lat: 32.8, lon: -86.8 },
    { name: 'Alaska', lat: 64.0, lon: -152.0 },
    { name: 'Arizona', lat: 34.3, lon: -111.7 },
    { name: 'Arkansas', lat: 34.9, lon: -92.4 },
    { name: 'California', lat: 37.2, lon: -119.5 },
    { name: 'Colorado', lat: 39.0, lon: -105.5 },
    { name: 'Connecticut', lat: 41.6, lon: -72.7 },
    { name: 'Delaware', lat: 39.0, lon: -75.5 },
    { name: 'Florida', lat: 28.6, lon: -82.4 },
    { name: 'Georgia', lat: 32.6, lon: -83.4 },
    { name: 'Hawaii', lat: 20.3, lon: -156.4 },
    { name: 'Idaho', lat: 44.4, lon: -114.6 },
    { name: 'Illinois', lat: 40.0, lon: -89.2 },
    { name: 'Indiana', lat: 39.9, lon: -86.3 },
    { name: 'Iowa', lat: 42.1, lon: -93.5 },
    { name: 'Kansas', lat: 38.5, lon: -98.4 },
    { name: 'Kentucky', lat: 37.5, lon: -85.3 },
    { name: 'Louisiana', lat: 31.1, lon: -92.0 },
    { name: 'Maine', lat: 45.4, lon: -69.2 },
    { name: 'Maryland', lat: 39.0, lon: -76.8 },
    { name: 'Massachusetts', lat: 42.3, lon: -71.8 },
    { name: 'Michigan', lat: 44.3, lon: -85.4 },
    { name: 'Minnesota', lat: 46.3, lon: -94.3 },
    { name: 'Mississippi', lat: 32.7, lon: -89.7 },
    { name: 'Missouri', lat: 38.4, lon: -92.5 },
    { name: 'Montana', lat: 47.0, lon: -109.6 },
    { name: 'Nebraska', lat: 41.5, lon: -99.8 },
    { name: 'Nevada', lat: 39.3, lon: -116.6 },
    { name: 'New Hampshire', lat: 43.7, lon: -71.6 },
    { name: 'New Jersey', lat: 40.2, lon: -74.7 },
    { name: 'New Mexico', lat: 34.4, lon: -106.1 },
    { name: 'New York', lat: 42.9, lon: -75.5 },
    { name: 'North Carolina', lat: 35.5, lon: -79.4 },
    { name: 'North Dakota', lat: 47.4, lon: -100.5 },
    { name: 'Ohio', lat: 40.3, lon: -82.8 },
    { name: 'Oklahoma', lat: 35.6, lon: -97.5 },
    { name: 'Oregon', lat: 43.9, lon: -120.6 },
    { name: 'Pennsylvania', lat: 40.9, lon: -77.8 },
    { name: 'Rhode Island', lat: 41.7, lon: -71.6 },
    { name: 'South Carolina', lat: 33.9, lon: -80.9 },
    { name: 'South Dakota', lat: 44.4, lon: -100.2 },
    { name: 'Tennessee', lat: 35.9, lon: -86.4 },
    { name: 'Texas', lat: 31.5, lon: -99.3 },
    { name: 'Utah', lat: 39.3, lon: -111.7 },
    { name: 'Vermont', lat: 44.1, lon: -72.7 },
    { name: 'Virginia', lat: 37.5, lon: -78.9 },
    { name: 'Washington', lat: 47.4, lon: -120.5 },
    { name: 'West Virginia', lat: 38.6, lon: -80.6 },
    { name: 'Wisconsin', lat: 44.6, lon: -89.7 },
    { name: 'Wyoming', lat: 43.0, lon: -107.6 },

    /* World cities */
    { name: 'London, England', lat: 51.51, lon: -0.13 },
    { name: 'Paris, France', lat: 48.86, lon: 2.35 },
    { name: 'Rome, Italy', lat: 41.90, lon: 12.50 },
    { name: 'Venice, Italy', lat: 45.44, lon: 12.32 },
    { name: 'Athens, Greece', lat: 37.98, lon: 23.73 },
    { name: 'Berlin, Germany', lat: 52.52, lon: 13.40 },
    { name: 'Vienna, Austria', lat: 48.21, lon: 16.37 },
    { name: 'Amsterdam, Netherlands', lat: 52.37, lon: 4.90 },
    { name: 'Madrid, Spain', lat: 40.42, lon: -3.70 },
    { name: 'Lisbon, Portugal', lat: 38.72, lon: -9.14 },
    { name: 'Moscow, Russia', lat: 55.76, lon: 37.62 },
    { name: 'Istanbul, Turkey', lat: 41.01, lon: 28.98 },
    { name: 'Jerusalem', lat: 31.78, lon: 35.22 },
    { name: 'Cairo, Egypt', lat: 30.04, lon: 31.24 },
    { name: 'Baghdad, Iraq', lat: 33.31, lon: 44.37 },
    { name: 'Mecca, Saudi Arabia', lat: 21.39, lon: 39.86 },
    { name: 'Timbuktu, Mali', lat: 16.77, lon: -3.01 },
    { name: 'Lagos, Nigeria', lat: 6.52, lon: 3.38 },
    { name: 'Nairobi, Kenya', lat: -1.29, lon: 36.82 },
    { name: 'Cape Town, South Africa', lat: -33.92, lon: 18.42 },
    { name: 'Delhi, India', lat: 28.61, lon: 77.21 },
    { name: 'Mumbai, India', lat: 19.08, lon: 72.88 },
    { name: 'Beijing, China', lat: 39.90, lon: 116.41 },
    { name: 'Shanghai, China', lat: 31.23, lon: 121.47 },
    { name: 'Hong Kong', lat: 22.32, lon: 114.17 },
    { name: 'Tokyo, Japan', lat: 35.68, lon: 139.69 },
    { name: 'Seoul, South Korea', lat: 37.57, lon: 126.98 },
    { name: 'Bangkok, Thailand', lat: 13.76, lon: 100.50 },
    { name: 'Sydney, Australia', lat: -33.87, lon: 151.21 },
    { name: 'Mexico City, Mexico', lat: 19.43, lon: -99.13 },
    { name: 'Havana, Cuba', lat: 23.11, lon: -82.37 },
    { name: 'Lima, Peru', lat: -12.05, lon: -77.04 },
    { name: 'Cusco, Peru', lat: -13.53, lon: -71.97 },
    { name: 'Rio de Janeiro, Brazil', lat: -22.91, lon: -43.17 },
    { name: 'Buenos Aires, Argentina', lat: -34.60, lon: -58.38 },
    { name: 'Ottawa, Canada', lat: 45.42, lon: -75.70 },

    /* Countries */
    { name: 'United States', lat: 39.8, lon: -98.6 },
    { name: 'Canada', lat: 56.1, lon: -106.3 },
    { name: 'Mexico', lat: 23.6, lon: -102.6 },
    { name: 'Brazil', lat: -14.2, lon: -51.9 },
    { name: 'Argentina', lat: -38.4, lon: -63.6 },
    { name: 'United Kingdom', lat: 54.0, lon: -2.0 },
    { name: 'France', lat: 46.6, lon: 2.2 },
    { name: 'Germany', lat: 51.2, lon: 10.4 },
    { name: 'Italy', lat: 41.9, lon: 12.6 },
    { name: 'Spain', lat: 40.5, lon: -3.7 },
    { name: 'Portugal', lat: 39.4, lon: -8.2 },
    { name: 'Greece', lat: 39.1, lon: 21.8 },
    { name: 'Poland', lat: 51.9, lon: 19.1 },
    { name: 'Netherlands', lat: 52.1, lon: 5.3 },
    { name: 'Russia', lat: 61.5, lon: 105.3 },
    { name: 'Egypt', lat: 26.8, lon: 30.8 },
    { name: 'Nigeria', lat: 9.1, lon: 8.7 },
    { name: 'Ghana', lat: 7.9, lon: -1.0 },
    { name: 'Mali', lat: 17.6, lon: -4.0 },
    { name: 'Ethiopia', lat: 9.1, lon: 40.5 },
    { name: 'Kenya', lat: 0.2, lon: 37.9 },
    { name: 'South Africa', lat: -30.6, lon: 22.9 },
    { name: 'Turkey', lat: 39.0, lon: 35.2 },
    { name: 'Israel', lat: 31.0, lon: 34.9 },
    { name: 'Saudi Arabia', lat: 23.9, lon: 45.1 },
    { name: 'Iran', lat: 32.4, lon: 53.7 },
    { name: 'Iraq', lat: 33.2, lon: 43.7 },
    { name: 'India', lat: 20.6, lon: 79.0 },
    { name: 'Pakistan', lat: 30.4, lon: 69.3 },
    { name: 'China', lat: 35.9, lon: 104.2 },
    { name: 'Japan', lat: 36.2, lon: 138.3 },
    { name: 'South Korea', lat: 35.9, lon: 127.8 },
    { name: 'Vietnam', lat: 14.1, lon: 108.3 },
    { name: 'Indonesia', lat: -0.8, lon: 113.9 },
    { name: 'Australia', lat: -25.3, lon: 133.8 }
  ];

  function normalizeName(s) {
    return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  var byName = {};
  GAZETTEER.forEach(function (p) { byName[normalizeName(p.name)] = p; });

  /** Exact (case- and whitespace-insensitive) gazetteer lookup, or null. A
   *  typed place that isn't listed is not an error — it just needs its own
   *  lat/lon, which the form leaves editable. */
  function lookup(name) {
    return byName[normalizeName(name)] || null;
  }

  function names() { return GAZETTEER.map(function (p) { return p.name; }); }

  /** True when a value is a usable coordinate pair. Guards every consumer:
   *  an event whose place has no numeric lat/lon simply isn't on the map. */
  function hasCoords(place) {
    return !!place && typeof place.lat === 'number' && typeof place.lon === 'number' &&
      isFinite(place.lat) && isFinite(place.lon) &&
      place.lat >= -90 && place.lat <= 90 && place.lon >= -180 && place.lon <= 180;
  }

  /* ---------- map extent ----------
     bmg-vector renders plate carrée: one degree of longitude and one of
     latitude occupy the same number of pixels, so a rendered map's pixel
     aspect ratio is exactly its degree extent's aspect ratio. That is what
     lets the extent be fitted to the *page box* here: match the bounds'
     lon:lat ratio to the box's width:height and the rendered map drops into
     the box with no letterboxing and no stretching, and pin placement stays a
     straight linear mapping. */

  // Matches bmg-vector's own world preset: its data is clipped near the poles,
  // and -90..84 is the range that renders without a blank strip on top.
  var MAX_N = 84, MIN_S = -90;

  function worldBounds(aspect) {
    var h = Math.min(360 / aspect, MAX_N - MIN_S);
    // Centred a little north of the equator: that is where most of the world's
    // land (and most of a 7th grade curriculum) is.
    var north = Math.min(MAX_N, 12 + h / 2);
    var south = north - h;
    if (south < MIN_S) { south = MIN_S; north = Math.min(MAX_N, south + h); }
    return { north: north, south: south, west: -180, east: 180 };
  }

  /** Grows the shorter axis (never shrinks either) until the extent matches
   *  `aspect`, then slides it back inside the world rather than squashing it.
   *  Anything that still won't fit is the whole world, so say so. */
  function matchAspect(b, aspect) {
    var north = b.north, south = b.south, west = b.west, east = b.east;
    var lonSpan = east - west, latSpan = north - south;
    if (lonSpan / latSpan < aspect) {
      var grow = (latSpan * aspect - lonSpan) / 2;
      west -= grow; east += grow;
    } else {
      var growLat = (lonSpan / aspect - latSpan) / 2;
      north += growLat; south -= growLat;
    }
    if ((east - west) >= 360 || (north - south) >= (MAX_N - MIN_S)) return worldBounds(aspect);
    if (west < -180) { east += (-180 - west); west = -180; }
    if (east > 180) { west -= (east - 180); east = 180; }
    if (north > MAX_N) { south -= (north - MAX_N); north = MAX_N; }
    if (south < MIN_S) { north += (MIN_S - south); south = MIN_S; }
    // A slide on one axis can push the opposite edge back out. Clamping again
    // would shrink the box and skew the aspect (a stretched map), so fall back
    // to the honest whole-world view instead.
    if (west < -180 || east > 180 || north > MAX_N || south < MIN_S) return worldBounds(aspect);
    return { north: north, south: south, west: west, east: east };
  }

  /**
   * The extent that shows every placed event with room to breathe, shaped to
   * fit a box of the given width:height ratio. No points (or none with usable
   * coordinates) falls back to the whole world.
   */
  function fitBounds(points, aspect) {
    var usable = (points || []).filter(hasCoords);
    if (!usable.length) return worldBounds(aspect);
    var north = -Infinity, south = Infinity, west = Infinity, east = -Infinity;
    usable.forEach(function (p) {
      if (p.lat > north) north = p.lat;
      if (p.lat < south) south = p.lat;
      if (p.lon < west) west = p.lon;
      if (p.lon > east) east = p.lon;
    });
    // 18% of the span as padding, with a 2.5° floor so a single pin (or a
    // tight cluster of them) still gets a map around it instead of a
    // zero-width box.
    var padLat = Math.max((north - south) * 0.18, 2.5);
    var padLon = Math.max((east - west) * 0.18, 2.5);
    return matchAspect({
      north: north + padLat, south: south - padLat,
      west: west - padLon, east: east + padLon
    }, aspect);
  }

  /**
   * Which vendored dataset to draw. State outlines are far more useful than a
   * bare coastline for a US history timeline — but only when the map really is
   * a map of the United States, since the US files contain nothing else and
   * Canada/Mexico would render as blank. So: every pin inside the 50-state
   * box, and a window still narrow enough to read as North America.
   */
  function chooseDataset(points, bounds) {
    var usable = (points || []).filter(hasCoords);
    if (!usable.length) return 'world';
    var allUs = usable.every(function (p) {
      return p.lat >= 18 && p.lat <= 72 && p.lon >= -172 && p.lon <= -66;
    });
    return (allUs && (bounds.east - bounds.west) <= 60) ? 'us' : 'world';
  }

  /** Where a coordinate lands inside a bounds box, as 0..100 percentages of
   *  the box's width and height. The inverse of bmg-vector's own `project`. */
  function projectPct(bounds, lat, lon) {
    return {
      x: ((lon - bounds.west) / (bounds.east - bounds.west)) * 100,
      y: ((bounds.north - lat) / (bounds.north - bounds.south)) * 100
    };
  }

  /**
   * Merges pins that land on effectively the same spot into one pin carrying
   * several numbers. Two events in the same town (a Boston Massacre and a
   * Boston Tea Party) are the normal case, not an edge case, and two circles
   * a pixel apart is just an unreadable blob.
   *
   * The radius is deliberately SMALL — enough to catch "same place" and not
   * much more. An earlier, roomier radius (about one badge wide) quietly
   * swallowed Philadelphia, Trenton and Valley Forge into a single mid-
   * Atlantic pin, which is exactly the distinction a student is meant to read
   * off the map. Places that are close but distinct stay distinct here and get
   * nudged apart by spreadPins() below instead.
   *
   * Greedy, in chronological order, against each cluster's first member — so
   * the numbers inside a cluster stay in order and the clustering is stable
   * (it can't depend on which pin happened to be compared first).
   */
  function clusterPins(pins, radiusPx) {
    var clusters = [];
    (pins || []).forEach(function (pin) {
      for (var i = 0; i < clusters.length; i++) {
        var c = clusters[i];
        var dx = pin.xPx - c.xPx, dy = pin.yPx - c.yPx;
        if (Math.sqrt(dx * dx + dy * dy) <= radiusPx) {
          c.numbers.push(pin.number);
          if (c.places.indexOf(pin.placeName) === -1) c.places.push(pin.placeName);
          return;
        }
      }
      clusters.push({ xPx: pin.xPx, yPx: pin.yPx, numbers: [pin.number], places: [pin.placeName] });
    });
    return clusters;
  }

  /**
   * Gives every cluster a *label* position at least `minSepPx` from every
   * other, by pushing overlapping pairs apart a few times. `xPx`/`yPx` — the
   * true location — are never modified; the caller draws a small dot there and
   * puts the numbered badge at `labelX`/`labelY`, so the map stays honest
   * about where the event happened while the numbers stay readable.
   *
   * Places 15 miles apart are a few pixels apart on a classroom-sized map, so
   * without this the badges for Philadelphia and Valley Forge simply cover
   * each other. The nudge is bounded (it stops as soon as nothing overlaps,
   * and at 40 rounds regardless) and clamped to the box, so a dense cluster
   * degrades into a tight ring rather than flinging pins off the paper.
   *
   * Clusters are never coincident by construction — clusterPins has already
   * merged anything within its radius — so there is always a real direction to
   * push along, and no jitter hack is needed.
   */
  function spreadPins(clusters, minSepPx, boxW, boxH) {
    clusters.forEach(function (c) { c.labelX = c.xPx; c.labelY = c.yPx; });
    for (var round = 0; round < 40; round++) {
      var moved = false;
      for (var i = 0; i < clusters.length; i++) {
        for (var j = i + 1; j < clusters.length; j++) {
          var a = clusters[i], b = clusters[j];
          var dx = b.labelX - a.labelX, dy = b.labelY - a.labelY;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d >= minSepPx || d === 0) continue;
          var push = (minSepPx - d) / 2;
          a.labelX -= (dx / d) * push; a.labelY -= (dy / d) * push;
          b.labelX += (dx / d) * push; b.labelY += (dy / d) * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    var m = minSepPx / 2;
    clusters.forEach(function (c) {
      c.labelX = Math.min(boxW - m, Math.max(m, c.labelX));
      c.labelY = Math.min(boxH - m, Math.max(m, c.labelY));
    });
    return clusters;
  }

  /* ---------- base map render (delegated to bmg-vector.js) ---------- */

  // Resolved from this script's own URL, not the document's, so it stays
  // correct no matter which page loads the module.
  var VECTOR_MODULE_URL = (function () {
    var s = document.currentScript;
    var base = (s && s.src) ? s.src : global.location.href;
    return new URL('../blank-map-generator/bmg-vector.js', base).href;
  })();

  // One rendered map is kept, keyed by everything that changes a pixel.
  // Re-printing the same timeline (the normal case: print, adjust, print
  // again) then skips a full vector render.
  var mapCache = { key: null, url: null };

  /**
   * Renders the base map for `bounds` and returns a PNG data URL sized for the
   * printed box.
   *
   * bmg-vector always renders at a 4000px long side — right for its own
   * poster exports, more than a timeline's map panel needs. The result is
   * downscaled here to twice the print box (≈192 dpi on paper), which keeps
   * the printed page light and, more to the point, releases the 4000px buffer
   * immediately instead of holding tens of megabytes of pixels on a
   * Chromebook.
   */
  function renderMapImage(bounds, opts) {
    opts = opts || {};
    var style = opts.style === 'land' ? 'land' : 'outline';
    var dataset = opts.dataset === 'us' ? 'us' : 'world';
    var outW = Math.max(2, Math.round(opts.outWidth || 1920));
    var outH = Math.max(2, Math.round(opts.outHeight || 800));
    var key = JSON.stringify([bounds, style, dataset, outW, outH]);
    if (mapCache.key === key) return Promise.resolve(mapCache.url);

    return import(VECTOR_MODULE_URL).then(function (mod) {
      return mod.renderBaseMapCanvas(
        { key: 'tlb-fit', label: 'Timeline map', dataset: dataset, bounds: bounds },
        { style: style, borders: true }
      );
    }).then(function (res) {
      var out = document.createElement('canvas');
      out.width = outW; out.height = outH;
      var ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(res.canvas, 0, 0, outW, outH);
      res.canvas.width = 1; res.canvas.height = 1; // free the big buffer now, not at GC's convenience
      var url = out.toDataURL('image/png');
      mapCache.key = key; mapCache.url = url;
      return url;
    });
  }

  global.TimelinePlaces = {
    GAZETTEER: GAZETTEER,
    names: names,
    lookup: lookup,
    hasCoords: hasCoords,
    worldBounds: worldBounds,
    fitBounds: fitBounds,
    chooseDataset: chooseDataset,
    projectPct: projectPct,
    clusterPins: clusterPins,
    spreadPins: spreadPins,
    renderMapImage: renderMapImage
  };
})(window);
