// Service worker for the AsPerMyLessonPlan.com toolkit — enables a full
// offline install (PWA). Static, no build step: this file is hand-maintained
// like everything else in the repo.
//
// Strategy:
//   - PRECACHE_URLS below is a hand-curated list of every page + JS/CSS/font
//     asset the site currently ships (index.html, every Tools/*.html file,
//     and their vendored scripts/styles/fonts). It's installed cache-first
//     up front so a first visit makes the whole toolkit available offline.
//   - Any same-origin GET request that lands anyway (a file missed above, or
//     one added later without updating this list) is cached opportunistically
//     the first time it succeeds online, so it still works offline next time.
//   - Requests to the small CDN allowlist (cdnjs) get the same
//     cache-first-then-network treatment. Legacy: as of v45 no shipping tool
//     hotlinks a library any more — every vendored library lives under
//     _shared/vendor/. Kept as a safety net, but don't add to it.
//   - Blank Map Generator downloads map images from Wikimedia at runtime.
//     Those are NOT precached (that would mean trying to cache the whole
//     internet) — instead they land in a capped runtime cache as they're
//     viewed, oldest evicted first once the cap is hit. (The tool itself
//     also keeps a full-quality copy in IndexedDB — see bmg-map-cache.js —
//     this is just an extra safety net at the network layer.)
//
// Bump CACHE_VERSION any time PRECACHE_URLS changes, so the old cache gets
// cleaned up on activate instead of lingering forever.

const CACHE_VERSION = 'v113';
const PRECACHE = `aplp-precache-${CACHE_VERSION}`;
const RUNTIME = `aplp-runtime-${CACHE_VERSION}`;
const WIKI_CACHE = `aplp-wiki-${CACHE_VERSION}`;
const WIKI_CACHE_MAX_ENTRIES = 50;
const CURRENT_CACHES = [PRECACHE, RUNTIME, WIKI_CACHE];

const WIKI_HOSTS = ['upload.wikimedia.org', 'commons.wikimedia.org'];
const CDN_ALLOWLIST = ['cdnjs.cloudflare.com'];

const PRECACHE_URLS = [
  "./",
  "Tools/004-Classroom%20Timer.html",
  "Tools/007-Name%20Picker.html",
  "Tools/032-School%20Calendar%20Visualizer.html",
  "Tools/005-Seating%20Chart%20Generator.html",
  "Tools/044-Sub%20Plan%20Builder.html",
  "Tools/047-art-critique-worksheet-generator.html",
  "Tools/048-art-portfolio-label-maker.html",
  "Tools/009-backup-restore.html",
  "Tools/backup-restore/br-pair.js",
  "Tools/backup-restore/br-transfer.js",
  "Tools/008-behavior-points-tracker.html",
  "Tools/behavior-points-tracker/seating-layout.js",
  "Tools/046-blank-map-generator.html",
  "Tools/blank-map-generator/bmg-colors.js",
  "Tools/blank-map-generator/bmg-commons.js",
  "Tools/blank-map-generator/bmg-geography.js",
  "Tools/blank-map-generator/bmg-label-sets.js",
  "Tools/blank-map-generator/bmg-labels.js",
  "Tools/blank-map-generator/bmg-latlong.js",
  "Tools/blank-map-generator/bmg-legend.js",
  "Tools/blank-map-generator/bmg-lines.js",
  "Tools/blank-map-generator/bmg-locator.js",
  "Tools/blank-map-generator/bmg-map-cache.js",
  "Tools/blank-map-generator/bmg-markers.js",
  "Tools/blank-map-generator/bmg-regions.js",
  "Tools/blank-map-generator/bmg-store.js",
  "Tools/blank-map-generator/bmg-vector.js",
  "Tools/blank-map-generator/bmg-viewer.js",
  "Tools/blank-map-generator/data/world-land-110m.json",
  "Tools/blank-map-generator/data/world-countries-110m.json",
  "Tools/blank-map-generator/data/us-nation-10m.json",
  "Tools/blank-map-generator/data/us-states-10m.json",
  "Tools/049-book-tasting-menu-generator.html",
  "Tools/020-bracket-tournament-generator.html",
  "Tools/bracket-tournament-generator/bt-store.js",
  "Tools/042-certificate-award-maker.html",
  "Tools/certificate-award-maker/cam-borders.js",
  "Tools/certificate-award-maker/cam-store.js",
  "Tools/050-civics-role-card-generator.html",
  "Tools/006-class-roster-hub.html",
  "Tools/051-classroom-label-maker.html",
  "Tools/classroom-label-maker/speak.html",
  "Tools/classroom-timer/ct-app.js",
  "Tools/classroom-timer/ct-mirror.js",
  "Tools/classroom-timer/ct-sounds.js",
  "Tools/classroom-timer/ct-store.js",
  "Tools/classroom-timer/mirror.html",
  "Tools/052-cognates-false-friends-builder.html",
  "Tools/010-command-center-dashboard.html",
  "Tools/command-center/cc-remote.js",
  "Tools/command-center/remote.html",
  "Tools/053-cultural-trivia-card-generator.html",
  "Tools/054-current-events-discussion-guide-generator.html",
  "Tools/055-daily-editing-warmup-generator.html",
  "Tools/038-data-chart-builder.html",
  "Tools/056-dbq-source-packet-builder.html",
  "Tools/057-dichotomous-key-builder.html",
  "Tools/031-docx-merger.html",
  "Tools/058-duty-roster-builder.html",
  "Tools/019-escape-room-builder.html",
  "Tools/escape-room-builder/er-match.js",
  "Tools/escape-room-builder/lock.html",
  "Tools/escape-room-builder/monitor.html",
  "Tools/023-exit-ticket-generator.html",
  "Tools/exit-ticket-generator/etg-sequence.js",
  "Tools/059-experiment-design-planner.html",
  "Tools/043-field-trip-permission-slip.html",
  "Tools/final-grade-checker/grade-math.mjs",
  "Tools/036-final_grade_checker.html",
  "Tools/060-fitness-skill-assessment-tracker.html",
  "Tools/061-fraction-decimal-percent-drill-generator.html",
  "Tools/041-formula-sheet-builder.html",
  "Tools/formula-sheet-builder/fsb-store.js",
  "Tools/formula-sheet-builder/fsb-templates.js",
  "Tools/017-gallery-walk-qr.html",
  "Tools/062-geography-bee-quiz-generator.html",
  "Tools/037-grade-distribution-visualizer.html",
  "Tools/063-grammar-mad-libs-generator.html",
  "Tools/012-graph-paper-generator.html",
  "Tools/graph-paper-generator/gpg-render.js",
  "Tools/graph-paper-generator/gpg-store.js",
  "Tools/002-group-team-generator.html",
  "Tools/001-hall-pass-log.html",
  "Tools/064-historical-trading-card-maker.html",
  "Tools/historical-trading-card-maker/htcm-store.js",
  "Tools/historical-trading-card-maker/htcm-image.js",
  "Tools/historical-trading-card-maker/htcm-render.js",
  "Tools/historical-trading-card-maker/htcm-frames.js",
  "Tools/historical-trading-card-maker/htcm-themes.js",
  "Tools/historical-trading-card-maker/htcm-photo.js",
  "Tools/historical-trading-card-maker/htcm-export.js",
  "Tools/011-image-to-pdf.html",
  "Tools/022-lab-group-role-randomizer.html",
  "Tools/065-lab-report-template-builder.html",
  "Tools/013-lab-safety-contract-tracker.html",
  "Tools/026-math-drill-generator.html",
  "Tools/math-drill-generator/mdg-generate.js",
  "Tools/math-drill-generator/mdg-selfcheck.js",
  "Tools/math-drill-generator/mdg-store.js",
  "Tools/math-drill-generator/mdg-templates.js",
  "Tools/066-math-find-the-mistake-generator.html",
  "Tools/067-music-sightreading-generator.html",
  "Tools/name-picker/fonts/bungee-latin-400-normal.woff2",
  "Tools/name-picker/fonts/bungee-latin-ext-400-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-400-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-600-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-700-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-ext-400-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-ext-600-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-ext-700-normal.woff2",
  "Tools/name-picker/fonts/press-start-2p-latin-400-normal.woff2",
  "Tools/name-picker/np-details.js",
  "Tools/name-picker/np-equity.js",
  "Tools/name-picker/np-pick.js",
  "Tools/name-picker/np-seat-equity.js",
  "Tools/name-picker/np-store.js",
  "Tools/027-novel-study-circles-manager.html",
  "Tools/024-number-talks-board.html",
  "Tools/068-parent-contact-log.html",
  "Tools/021-pe-tournament-stations.html",
  "Tools/069-pe-warmup-circuit-generator.html",
  "Tools/070-peer-feedback-checklist-generator.html",
  "Tools/071-picture-prompt-generator.html",
  "Tools/072-plot-diagram-builder.html",
  "Tools/028-primary-source-analysis-generator.html",
  "Tools/029-prompt-builder.html",
  "Tools/016-qr-code-generator.html",
  "Tools/018-qr-scavenger-hunt-builder.html",
  "Tools/030-review-game-board.html",
  "Tools/review-game-board/rgb-audio-db.js",
  "Tools/review-game-board/rgb-bank-store.js",
  "Tools/review-game-board/rgb-store.js",
  "Tools/014-roleplay-scenario-generator.html",
  "Tools/003-rubric-builder.html",
  "Tools/rubric-builder/rb-gdv-handoff.js",
  "Tools/rubric-builder/rb-store.js",
  "Tools/rubric-builder/rb-templates.js",
  "Tools/034-schedule-browser.html",
  "Tools/035-schedule-visualizer.html",
  "Tools/schedule-visualizer/sv-handoff.js",
  "Tools/schedule-visualizer/sv-recovery.js",
  "Tools/schedule/fonts/dm-mono-latin-400-normal.woff2",
  "Tools/schedule/fonts/dm-mono-latin-500-normal.woff2",
  "Tools/schedule/fonts/dm-sans-latin-400-normal.woff2",
  "Tools/schedule/fonts/dm-sans-latin-500-normal.woff2",
  "Tools/schedule/fonts/dm-sans-latin-600-normal.woff2",
  "Tools/schedule/fonts/dm-sans-latin-700-normal.woff2",
  "Tools/schedule/fonts/fonts.css",
  "Tools/schedule/fonts/fraunces-latin-600-normal.woff2",
  "Tools/schedule/fonts/public-sans-latin-400-normal.woff2",
  "Tools/schedule/fonts/public-sans-latin-500-normal.woff2",
  "Tools/schedule/fonts/public-sans-latin-600-normal.woff2",
  "Tools/schedule/fonts/public-sans-latin-700-normal.woff2",
  "Tools/schedule/fonts/published-fonts.js",
  "Tools/school-calendar/scv-pacing.js",
  "Tools/school-calendar/scv-seed.js",
  "Tools/school-calendar/scv-store.js",
  "Tools/073-science-fair-project-tracker.html",
  "Tools/074-science-safety-label-maker.html",
  "Tools/seating-chart/seating.mjs",
  "Tools/075-staff-directory-builder.html",
  "Tools/033-ssr-log-tracker.html",
  "Tools/045-sub-binder-generator.html",
  "Tools/076-sub-note-feedback-slip-generator.html",
  "Tools/077-testing-accommodations-card-generator.html",
  "Tools/015-timeline-builder.html",
  "Tools/timeline-builder/tlb-example.js",
  "Tools/timeline-builder/tlb-layout.js",
  "Tools/timeline-builder/tlb-photo.js",
  "Tools/timeline-builder/tlb-places.js",
  "Tools/timeline-builder/tlb-store.js",
  "Tools/078-unit-conversion-chart-builder.html",
  "Tools/079-verb-conjugation-poster-generator.html",
  "Tools/080-virtual-manipulatives-board.html",
  "Tools/039-vocab-conjugation-drill.html",
  "Tools/040-vocab-flashcard-generator.html",
  "Tools/vocab-flashcard-generator/vfg-layout.js",
  "Tools/vocab-flashcard-generator/vfg-printables.js",
  "Tools/vocab-flashcard-generator/vfg-store.js",
  "Tools/081-word-problem-warmup-generator.html",
  "Tools/025-writing-prompt-generator.html",
  "Tools/writing-prompt-generator/wpg-prompts.js",
  "Tools/writing-prompt-generator/wpg-store.js",
  "_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css",
  "_shared/a11y.css",
  "_shared/a11y.js",
  "_shared/base.css",
  "_shared/duplex-print.js",
  "_shared/ink-paper.css",
  "_shared/print-area.css",
  "_shared/qr-scan.js",
  "_shared/state-link.js",
  "_shared/student-details.js",
  "_shared/sw-register.js",
  "_shared/theme.css",
  "_shared/webrtc-pair.js",
  "_shared/vendor/jspdf/jspdf.umd.min.js",
  "_shared/vendor/jspdf/jspdf.plugin.autotable.min.js",
  "_shared/vendor/xlsx/xlsx.full.min.js",
  "_shared/vendor/jsqr/jsqr.js",
  "_shared/vendor/qrcode/qrcode.js",
  "_shared/vendor/jszip/jszip.min.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/js/gvb-save.js",
  "index.html",
  "manifest.json"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => {
      // best-effort: one missing/renamed file shouldn't sink the whole
      // install (cache.addAll is all-or-nothing, so add() individually)
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] precache miss, skipping:', url, err && err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith('aplp-') && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maxEntries) {
    await cache.delete(keys.shift());
  }
}

async function cacheFirst(request, cacheName, { trim } = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
    if (trim) await trimCache(cacheName, trim);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Wikimedia map lookups/images: capped runtime cache, never precached.
  if (WIKI_HOSTS.includes(url.hostname)) {
    event.respondWith(
      cacheFirst(request, WIKI_CACHE, { trim: WIKI_CACHE_MAX_ENTRIES }).catch(() => fetch(request))
    );
    return;
  }

  // Allowlisted CDN libs (jsPDF/JSZip for the few tools without a vendored copy).
  if (CDN_ALLOWLIST.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, RUNTIME).catch(() => fetch(request)));
    return;
  }

  // Everything else this SW should touch is same-origin.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok && (response.type === 'basic' || response.type === 'default')) {
            const copy = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached — for a navigation, fall back to the
          // precached index so the toolkit shell still loads.
          if (request.mode === 'navigate') return caches.match('index.html');
          return Promise.reject(new Error('offline and not cached'));
        });
    })
  );
});
