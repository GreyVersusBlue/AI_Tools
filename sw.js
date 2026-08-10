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
//   - Requests to the small CDN allowlist (cdnjs, for the couple of tools
//     that load jsPDF/JSZip from a CDN instead of a vendored copy) get the
//     same cache-first-then-network treatment.
//   - Blank Map Generator downloads map images from Wikimedia at runtime.
//     Those are NOT precached (that would mean trying to cache the whole
//     internet) — instead they land in a capped runtime cache as they're
//     viewed, oldest evicted first once the cap is hit. (The tool itself
//     also keeps a full-quality copy in IndexedDB — see bmg-map-cache.js —
//     this is just an extra safety net at the network layer.)
//
// Bump CACHE_VERSION any time PRECACHE_URLS changes, so the old cache gets
// cleaned up on activate instead of lingering forever.

const CACHE_VERSION = 'v22';
const PRECACHE = `aplp-precache-${CACHE_VERSION}`;
const RUNTIME = `aplp-runtime-${CACHE_VERSION}`;
const WIKI_CACHE = `aplp-wiki-${CACHE_VERSION}`;
const WIKI_CACHE_MAX_ENTRIES = 50;
const CURRENT_CACHES = [PRECACHE, RUNTIME, WIKI_CACHE];

const WIKI_HOSTS = ['upload.wikimedia.org', 'commons.wikimedia.org'];
const CDN_ALLOWLIST = ['cdnjs.cloudflare.com'];

const PRECACHE_URLS = [
  "./",
  "Tools/Classroom%20Timer.html",
  "Tools/Name%20Picker.html",
  "Tools/School%20Calendar%20Visualizer.html",
  "Tools/Seating%20Chart%20Generator.html",
  "Tools/Sub%20Plan%20Builder.html",
  "Tools/art-critique-worksheet-generator.html",
  "Tools/backup-restore.html",
  "Tools/behavior-points-tracker.html",
  "Tools/blank-map-generator.html",
  "Tools/blank-map-generator/bmg-colors.js",
  "Tools/blank-map-generator/bmg-commons.js",
  "Tools/blank-map-generator/bmg-geography.js",
  "Tools/blank-map-generator/bmg-labels.js",
  "Tools/blank-map-generator/bmg-latlong.js",
  "Tools/blank-map-generator/bmg-legend.js",
  "Tools/blank-map-generator/bmg-lines.js",
  "Tools/blank-map-generator/bmg-locator.js",
  "Tools/blank-map-generator/bmg-map-cache.js",
  "Tools/blank-map-generator/bmg-markers.js",
  "Tools/blank-map-generator/bmg-regions.js",
  "Tools/blank-map-generator/bmg-store.js",
  "Tools/blank-map-generator/bmg-viewer.js",
  "Tools/bracket-tournament-generator.html",
  "Tools/bracket-tournament-generator/bt-store.js",
  "Tools/bracket-tournament-generator/lib/qrcode.js",
  "Tools/certificate-award-maker.html",
  "Tools/certificate-award-maker/cam-borders.js",
  "Tools/certificate-award-maker/cam-store.js",
  "Tools/class-roster-hub.html",
  "Tools/class-roster-hub/lib/qrcode.js",
  "Tools/classroom-timer/ct-app.js",
  "Tools/classroom-timer/ct-mirror.js",
  "Tools/classroom-timer/ct-sounds.js",
  "Tools/classroom-timer/ct-store.js",
  "Tools/classroom-timer/lib/jsqr.js",
  "Tools/classroom-timer/lib/qrcode.js",
  "Tools/classroom-timer/mirror.html",
  "Tools/command-center-dashboard.html",
  "Tools/current-events-discussion-guide-generator.html",
  "Tools/daily-editing-warmup-generator.html",
  "Tools/data-chart-builder.html",
  "Tools/docx-merger.html",
  "Tools/duty-roster-builder.html",
  "Tools/escape-room-builder.html",
  "Tools/escape-room-builder/lib/jsqr.js",
  "Tools/escape-room-builder/lib/qrcode.js",
  "Tools/escape-room-builder/lock.html",
  "Tools/escape-room-builder/monitor.html",
  "Tools/exit-ticket-generator.html",
  "Tools/field-trip-permission-slip.html",
  "Tools/field-trip-permission-slip/lib/qrcode.js",
  "Tools/final-grade-checker/grade-math.mjs",
  "Tools/final-grade-checker/libs/jspdf.plugin.autotable.min.js",
  "Tools/final-grade-checker/libs/jspdf.umd.min.js",
  "Tools/final-grade-checker/libs/xlsx.full.min.js",
  "Tools/final_grade_checker.html",
  "Tools/formula-sheet-builder.html",
  "Tools/formula-sheet-builder/fsb-store.js",
  "Tools/formula-sheet-builder/fsb-templates.js",
  "Tools/gallery-walk-qr.html",
  "Tools/gallery-walk-qr/lib/qrcode.js",
  "Tools/grade-distribution-visualizer.html",
  "Tools/graph-paper-generator.html",
  "Tools/graph-paper-generator/gpg-render.js",
  "Tools/graph-paper-generator/gpg-store.js",
  "Tools/group-team-generator.html",
  "Tools/hall-pass-log.html",
  "Tools/image-to-pdf.html",
  "Tools/image-to-pdf/lib/jspdf.umd.min.js",
  "Tools/lab-group-role-randomizer.html",
  "Tools/lab-report-template-builder.html",
  "Tools/lab-safety-contract-tracker.html",
  "Tools/math-drill-generator.html",
  "Tools/math-drill-generator/mdg-generate.js",
  "Tools/math-drill-generator/mdg-store.js",
  "Tools/math-drill-generator/mdg-templates.js",
  "Tools/math-find-the-mistake-generator.html",
  "Tools/name-picker/fonts/bungee-latin-400-normal.woff2",
  "Tools/name-picker/fonts/bungee-latin-ext-400-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-400-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-600-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-700-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-ext-400-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-ext-600-normal.woff2",
  "Tools/name-picker/fonts/outfit-latin-ext-700-normal.woff2",
  "Tools/name-picker/fonts/press-start-2p-latin-400-normal.woff2",
  "Tools/name-picker/lib/qrcode.js",
  "Tools/name-picker/np-pick.js",
  "Tools/name-picker/np-store.js",
  "Tools/novel-study-circles-manager.html",
  "Tools/number-talks-board.html",
  "Tools/parent-contact-log.html",
  "Tools/pe-tournament-stations.html",
  "Tools/peer-feedback-checklist-generator.html",
  "Tools/primary-source-analysis-generator.html",
  "Tools/prompt-builder.html",
  "Tools/qr-code-generator.html",
  "Tools/qr-code-generator/lib/jsqr.js",
  "Tools/qr-code-generator/lib/qrcode.js",
  "Tools/qr-scavenger-hunt-builder.html",
  "Tools/qr-scavenger-hunt-builder/lib/qrcode.js",
  "Tools/review-game-board.html",
  "Tools/review-game-board/libs/xlsx.full.min.js",
  "Tools/review-game-board/rgb-store.js",
  "Tools/roleplay-scenario-generator.html",
  "Tools/rubric-builder.html",
  "Tools/rubric-builder/rb-store.js",
  "Tools/rubric-builder/rb-templates.js",
  "Tools/schedule-browser.html",
  "Tools/schedule-visualizer.html",
  "Tools/schedule-visualizer/lib/jsqr.js",
  "Tools/schedule-visualizer/lib/qrcode.js",
  "Tools/schedule-visualizer/sv-handoff.js",
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
  "Tools/schedule/libs/jspdf/jspdf.umd.min.js",
  "Tools/school-calendar/scv-seed.js",
  "Tools/school-calendar/scv-store.js",
  "Tools/seating-chart/seating.mjs",
  "Tools/staff-directory-builder.html",
  "Tools/ssr-log-tracker.html",
  "Tools/sub-binder-generator.html",
  "Tools/sub-note-feedback-slip-generator.html",
  "Tools/testing-accommodations-card-generator.html",
  "Tools/timeline-builder.html",
  "Tools/timeline-builder/tlb-layout.js",
  "Tools/timeline-builder/tlb-photo.js",
  "Tools/timeline-builder/tlb-store.js",
  "Tools/unit-conversion-chart-builder.html",
  "Tools/verb-conjugation-poster-generator.html",
  "Tools/virtual-manipulatives-board.html",
  "Tools/vocab-conjugation-drill.html",
  "Tools/vocab-flashcard-generator.html",
  "Tools/vocab-flashcard-generator/vfg-layout.js",
  "Tools/vocab-flashcard-generator/vfg-store.js",
  "Tools/word-problem-warmup-generator.html",
  "Tools/writing-prompt-generator.html",
  "Tools/writing-prompt-generator/wpg-prompts.js",
  "Tools/writing-prompt-generator/wpg-store.js",
  "_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css",
  "_shared/a11y.css",
  "_shared/a11y.js",
  "_shared/qr-scan.js",
  "_shared/state-link.js",
  "_shared/theme.css",
  "_shared/webrtc-pair.js",
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
