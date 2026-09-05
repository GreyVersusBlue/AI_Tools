// Service worker for the AsPerMyLessonPlan.com toolkit — enables a full
// offline install (PWA). Static, no build step: this file is hand-maintained
// like everything else in the repo.
//
// Strategy:
//   - PRECACHE_URLS below is a hand-curated list of every page + JS/CSS/font
//     asset the site currently ships (index.html, every Tools/*.html file,
//     and their vendored scripts/styles/fonts). It is cached in TWO TIERS:
//       * SHELL_URLS — a subset of PRECACHE_URLS — is cached at install: the
//         landing page, everything under _shared/, the icons and manifest, and
//         the ten tools a teacher reaches for standing in the room, with their
//         support files. This is what "installed" means: 82 of 257 entries,
//         ~2.6 of ~10.9 MB (measured 2026-09-05).
//         A vendored library belongs here only when a shell tool loads it with
//         a plain <script src> — jsqr, qrcode.js and jszip do. jsPDF (+
//         AutoTable) and SheetJS do not: no shell tool references jsPDF at
//         all, and the three that touch SheetJS (001, 006, 032) inject it on
//         demand behind an explicit "import a spreadsheet" click, already
//         handling the load failing. They were 1.23 MB — a third of the whole
//         install — bought for a keystroke nobody makes in the first seconds
//         after install, so as of v151 they arrive with the deferred pass
//         instead. Anything eagerly loaded by a shell page must stay here.
//       * Everything else in PRECACHE_URLS is fetched by a second, deferred
//         pass that never blocks install. _shared/sw-register.js posts
//         PRECACHE_REST once the page has been idle for a few seconds; the
//         handler below fills in whatever the precache does not hold yet. It
//         is idempotent (skips what is cached, runs once at a time) and it
//         reports progress to every open page as PRECACHE_PROGRESS, which
//         index.html shows as "N of M tools ready".
//     Until 2026-09-03 (CACHE_VERSION v137) install fetched all ~11 MB up
//     front, so a first visit on the school network paid the whole cost before
//     the worker settled. The offline promise after the deferred pass is the
//     same as before; the promise during it is narrower ("the shell and the
//     ten tools, and every tool you have already opened"), which is why the
//     readout exists.
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
//
// CACHE NAMES. The precache and the same-origin runtime cache carry the
// version, so a deploy evicts every same-origin byte the old worker served —
// that is the point of a bump. The Wikimedia cache does NOT: it holds map
// images a teacher waited on the school network for, none of which change
// when this site does, and until v138 every bump threw them away. It has a
// stable name and is trimmed by count instead.
//
// UPDATES. This worker deliberately does NOT call skipWaiting() at install. A
// new version installs and then waits, and _shared/sw-register.js offers the
// teacher a "new version is ready" bar; only when they accept does it post
// SKIP_WAITING, handled below. The reason is that install-time skipWaiting()
// plus clients.claim() at activate means a deploy takes effect inside an
// already-open tab — a teacher three minutes into a timer, or mid-way through a
// projected activity, gets a different version's assets under their feet with
// no notice and no way back. clients.claim() stays: once a worker HAS been
// accepted (or is the first one, with no page to disrupt), it should control
// the page immediately.

const CACHE_VERSION = 'v154';
const PRECACHE = `aplp-precache-${CACHE_VERSION}`;
const RUNTIME = `aplp-runtime-${CACHE_VERSION}`;
const WIKI_CACHE = 'aplp-wiki';   // stable across versions — see CACHE NAMES above
const WIKI_CACHE_MAX_ENTRIES = 50;
const SHARE_CACHE = 'aplp-share'; // the hand-off slot for the manifest share_target — see SHARE below
const CURRENT_CACHES = [PRECACHE, RUNTIME, WIKI_CACHE, SHARE_CACHE];

// SHARE. manifest.json declares a share_target: on a phone or Chromebook where
// the toolkit is installed, "Share" from a spreadsheet app or a mail client
// can send a CSV/TSV/text file to Class Roster Hub. The OS delivers it as a
// multipart POST to Tools/006-class-roster-hub.html — and there is no server
// to receive it, so this worker does. It reads the form, parks the text in
// SHARE_CACHE under one fixed key, and answers 303 to the same page with
// ?shared=roster; the page collects the text from the cache on load, deletes
// it, and opens its own column-mapping import dialog. Nothing leaves the
// device. The slot holds one share at a time and is cleared once consumed.
const SHARE_TARGET_PAGE = /\/Tools\/006-class-roster-hub\.html$/;
const SHARE_KEY = 'share/roster';

const WIKI_HOSTS = ['upload.wikimedia.org', 'commons.wikimedia.org'];
const CDN_ALLOWLIST = ['cdnjs.cloudflare.com'];

// The install tier. Every entry here MUST also appear in PRECACHE_URLS —
// check-precache.mjs fails otherwise — because PRECACHE_URLS stays the one
// list of "what works offline"; this is only the order of arrival. Keep it to
// the shell plus the handful of tools used from the front of the room: each
// entry here is downloaded before the worker is considered installed.
const SHELL_URLS = [
  "./",
  "Tools/004-Classroom%20Timer.html",
  "Tools/007-Name%20Picker.html",
  "Tools/032-School%20Calendar%20Visualizer.html",
  "Tools/005-Seating%20Chart%20Generator.html",
  "Tools/044-Sub%20Plan%20Builder.html",
  "Tools/008-behavior-points-tracker.html",
  "Tools/behavior-points-tracker/seating-layout.js",
  "Tools/006-class-roster-hub.html",
  "Tools/classroom-timer/ct-app.js",
  "Tools/classroom-timer/ct-mirror.js",
  "Tools/classroom-timer/ct-sounds.js",
  "Tools/classroom-timer/ct-store.js",
  "Tools/classroom-timer/mirror.html",
  "Tools/010-command-center-dashboard.html",
  "Tools/command-center/cc-remote.js",
  "Tools/command-center/remote.html",
  "Tools/002-group-team-generator.html",
  "Tools/001-hall-pass-log.html",
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
  "Tools/school-calendar/scv-pacing.js",
  "Tools/school-calendar/scv-seed.js",
  "Tools/school-calendar/scv-store.js",
  "Tools/seating-chart/scg-photo.js",
  "Tools/seating-chart/seating.mjs",
  "_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css",
  "_shared/a11y.css",
  "_shared/a11y.js",
  "_shared/base.css",
  "_shared/duplex-print.js",
  "_shared/gvb-save.js",
  "_shared/ink-paper.css",
  "_shared/media-db.js",
  "_shared/print-area.css",
  "_shared/qr-draw.js",
  "_shared/qr-scan.js",
  "_shared/roster.js",
  "_shared/seating-read.js",
  "_shared/share.js",
  "_shared/stage.js",
  "_shared/state-link.js",
  "_shared/store.js",
  "_shared/student-details.js",
  "_shared/sw-register.js",
  "_shared/theme.css",
  "_shared/tool-registry.js",
  "_shared/webrtc-pair.js",
  "_shared/vendor/jsqr/jsqr.js",
  "_shared/vendor/qrcode/qrcode.js",
  "_shared/vendor/jszip/jszip.min.js",
  "_shared/vendor/barlow/barlow.css",
  "_shared/vendor/barlow/barlow-condensed-latin-600-normal.woff2",
  "_shared/vendor/barlow/barlow-condensed-latin-700-normal.woff2",
  "_shared/vendor/barlow/barlow-condensed-latin-ext-600-normal.woff2",
  "_shared/vendor/barlow/barlow-condensed-latin-ext-700-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-400-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-500-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-600-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-700-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-ext-400-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-ext-500-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-ext-600-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-ext-700-normal.woff2",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-192.png",
  "assets/icons/icon-maskable-512.png",
  "index.html",
  "manifest.json",
];

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
  "Tools/blank-map-generator/bmg-choropleth.js",
  "Tools/blank-map-generator/bmg-colors.js",
  "Tools/blank-map-generator/bmg-commons.js",
  "Tools/blank-map-generator/bmg-geography.js",
  "Tools/blank-map-generator/bmg-hittest.js",
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
  "Tools/certificate-award-maker/cam-logo.js",
  "Tools/certificate-award-maker/cam-store.js",
  "Tools/082-citation-generator.html",
  "Tools/050-civics-role-card-generator.html",
  "Tools/civics-role-card-generator/crcg-store.js",
  "Tools/civics-role-card-generator/crcg-templates.js",
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
  "Tools/current-events-discussion-guide-generator/cedg-readability.js",
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
  "Tools/geography-bee-quiz-generator/gbq-map.js",
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
  "Tools/historical-trading-card-maker/htcm-game.js",
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
  "Tools/number-talks-board/dot-images.js",
  "Tools/085-parent-communication-templates.html",
  "Tools/068-parent-contact-log.html",
  "Tools/021-pe-tournament-stations.html",
  "Tools/069-pe-warmup-circuit-generator.html",
  "Tools/070-peer-feedback-checklist-generator.html",
  "Tools/071-picture-prompt-generator.html",
  "Tools/072-plot-diagram-builder.html",
  "Tools/028-primary-source-analysis-generator.html",
  "Tools/029-prompt-builder.html",
  "Tools/083-propaganda-analysis-worksheet-generator.html",
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
  "Tools/seating-chart/scg-photo.js",
  "Tools/seating-chart/seating.mjs",
  "Tools/084-socratic-seminar-prep-organizer.html",
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
  "Tools/timeline-builder/tlb-story.js",
  "Tools/timeline-builder/tlb-worksheet.js",
  "Tools/078-unit-conversion-chart-builder.html",
  "Tools/079-verb-conjugation-poster-generator.html",
  "Tools/080-virtual-manipulatives-board.html",
  "Tools/039-vocab-conjugation-drill.html",
  "Tools/040-vocab-flashcard-generator.html",
  "Tools/vocab-flashcard-generator/vfg-conjdrill-link.js",
  "Tools/vocab-flashcard-generator/vfg-layout.js",
  "Tools/vocab-flashcard-generator/vfg-printables.js",
  "Tools/vocab-flashcard-generator/vfg-store.js",
  "Tools/086-wiki-race.html",
  "Tools/081-word-problem-warmup-generator.html",
  "Tools/025-writing-prompt-generator.html",
  "Tools/writing-prompt-generator/wpg-prompts.js",
  "Tools/writing-prompt-generator/wpg-rubric-link.js",
  "Tools/writing-prompt-generator/wpg-store.js",
  "_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css",
  "_shared/a11y.css",
  "_shared/a11y.js",
  "_shared/base.css",
  "_shared/duplex-print.js",
  "_shared/gvb-save.js",
  "_shared/ink-paper.css",
  "_shared/media-db.js",
  "_shared/print-area.css",
  "_shared/qr-draw.js",
  "_shared/qr-scan.js",
  "_shared/roster.js",
  "_shared/seating-read.js",
  "_shared/share.js",
  "_shared/stage.js",
  "_shared/state-link.js",
  "_shared/store.js",
  "_shared/student-details.js",
  "_shared/sw-register.js",
  "_shared/theme.css",
  "_shared/tool-registry.js",
  "_shared/webrtc-pair.js",
  "_shared/vendor/jspdf/jspdf.umd.min.js",
  "_shared/vendor/jspdf/jspdf.plugin.autotable.min.js",
  "_shared/vendor/xlsx/xlsx.full.min.js",
  "_shared/vendor/jsqr/jsqr.js",
  "_shared/vendor/qrcode/qrcode.js",
  "_shared/vendor/jszip/jszip.min.js",
  "_shared/vendor/barlow/barlow.css",
  "_shared/vendor/barlow/barlow-condensed-latin-600-normal.woff2",
  "_shared/vendor/barlow/barlow-condensed-latin-700-normal.woff2",
  "_shared/vendor/barlow/barlow-condensed-latin-ext-600-normal.woff2",
  "_shared/vendor/barlow/barlow-condensed-latin-ext-700-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-400-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-500-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-600-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-700-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-ext-400-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-ext-500-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-ext-600-normal.woff2",
  "_shared/vendor/barlow/barlow-latin-ext-700-normal.woff2",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-192.png",
  "assets/icons/icon-maskable-512.png",
  "assets/screenshots/landing-wide.png",
  "assets/screenshots/name-picker-narrow.png",
  "ideas-backlog.html",
  "index.html",
  "manifest.json",
  "v1-inbox.html",
  "v2-subplans.html",
  "v3-bellboard.html",
  "v4-riso.html"
];

/* ── install: the shell tier only ─────────────────────────────────────── */

// Best-effort: one missing/renamed file shouldn't sink the whole install
// (cache.addAll is all-or-nothing, so add() individually).
function addAllSettled(cache, urls, label) {
  return Promise.allSettled(
    urls.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
        console.warn(`[sw] ${label} miss, skipping:`, url, err && err.message);
      })
    )
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) => addAllSettled(cache, SHELL_URLS, 'precache')));
  // No skipWaiting() here — see the UPDATES note at the top of this file. The
  // worker installs, waits, and sw-register.js asks before it takes over.
});

/* ── the deferred tier ────────────────────────────────────────────────── */

const TOOL_PAGE = /^Tools\/\d{3}-[^/]+\.html$/;
const absolute = (url) => new URL(url, self.location.href).href;

/** What the precache holds, as counts a page can show. `tools` counts the
 *  Tools/NNN-*.html pages themselves; a tool whose page is cached but whose
 *  support files are still arriving reads as cached for a few seconds, which
 *  is the honest granularity for a one-line readout. */
async function precacheStatus() {
  const cache = await caches.open(PRECACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const files = { cached: 0, total: PRECACHE_URLS.length };
  const tools = { cached: 0, total: 0 };
  for (const url of PRECACHE_URLS) {
    const hit = have.has(absolute(url));
    if (hit) files.cached++;
    if (TOOL_PAGE.test(url)) { tools.total++; if (hit) tools.cached++; }
  }
  return {
    type: 'PRECACHE_PROGRESS',
    version: CACHE_VERSION,
    files,
    tools,
    inProgress: !!restInFlight,
    done: files.cached >= files.total,
  };
}

function broadcast(message) {
  return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    for (const client of clients) client.postMessage(message);
  });
}

// One pass at a time. Every open page posts PRECACHE_REST a few seconds after
// it loads, so with three tabs open the second and third requests join the
// pass already running instead of starting their own. The worker can be shut
// down between messages; the next request simply resumes with whatever is
// still missing, because the pass starts from what the cache already holds.
let restInFlight = null;

function precacheRest() {
  if (restInFlight) return restInFlight;
  restInFlight = (async () => {
    const cache = await caches.open(PRECACHE);
    const have = new Set((await cache.keys()).map((r) => r.url));
    const todo = PRECACHE_URLS.filter((url) => !have.has(absolute(url)));
    if (!todo.length) return;
    let fetched = 0;
    // A few at a time: enough to finish in a minute or so on a school
    // connection, not so many that the page the teacher is actually using
    // has to compete for the socket pool.
    const lanes = Array.from({ length: 4 }, async () => {
      while (todo.length) {
        const url = todo.shift();
        try {
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (err) {
          console.warn('[sw] deferred precache miss, skipping:', url, err && err.message);
        }
        fetched++;
        if (fetched % 12 === 0) await broadcast(await precacheStatus());
      }
    });
    await Promise.all(lanes);
  })().catch((err) => {
    console.warn('[sw] deferred precache pass stopped:', err && err.message);
  }).then(async () => {
    restInFlight = null;
    await broadcast(await precacheStatus());
  });
  return restInFlight;
}

/* ── messages from sw-register.js ─────────────────────────────────────── */

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  // The other half of the update contract. sw-register.js posts this when the
  // teacher accepts the update; nothing else sends it.
  if (type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (type === 'PRECACHE_REST') { event.waitUntil(precacheRest()); return; }
  if (type === 'PRECACHE_STATUS') {
    event.waitUntil(precacheStatus().then((status) => {
      if (event.source) event.source.postMessage(status);
    }));
  }
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

/** The share_target POST (see SHARE above): stash the shared text, redirect
 *  to the page as a plain GET. Anything unreadable falls through to the page
 *  with ?shared=roster and nothing in the slot, which it treats as "no share". */
async function receiveShare(request) {
  try {
    const form = await request.formData();
    const file = form.get('roster');
    let text = '';
    let name = '';
    if (file && typeof file.text === 'function') {
      text = await file.text();
      name = file.name || '';
    }
    if (!text) text = String(form.get('text') || '');
    if (!name) name = String(form.get('title') || 'shared roster');
    if (text) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        new Request(new URL(SHARE_KEY, self.registration.scope).href),
        new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Share-Name': encodeURIComponent(name), 'X-Share-At': String(Date.now()) } })
      );
    }
  } catch (err) {
    console.warn('[sw] could not read shared file:', err && err.message);
  }
  const target = new URL(request.url);
  target.search = '?shared=roster';
  return Response.redirect(target.href, 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'POST' && url.origin === self.location.origin && SHARE_TARGET_PAGE.test(url.pathname)) {
    event.respondWith(receiveShare(request));
    return;
  }
  if (request.method !== 'GET') return;

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
