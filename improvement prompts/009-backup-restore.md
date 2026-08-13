# Improvement Prompts — 009 — Backup & Restore

**Tool file:** `Tools/009-backup-restore.html`
**Support folder:** `Tools/backup-restore/` — `br-pair.js` (WebRTC pairing
wrapper) and `br-transfer.js` (chunk/reassemble framing) for the
device-to-device transfer feature, plus `test/` — the browser suites
(`smoke-restore-diff.mjs`, `npm run test:backup`; `smoke-transfer.mjs`, run
directly with `node Tools/backup-restore/test/smoke-transfer.mjs`). The page
itself is still a single file; these are its only support files.

**Current description (from README):** Scans your browser for everything every tool on this site has saved and downloads it as one file, or restores it back on a new computer or after a wiped cache.

---

## Status

### Pass 2 — Round 3 — 2026-08-13

**Shipped direct device-to-device transfer** (the standout unbuilt idea from
Round 2's "where the next round should pick up", backlog P9). Moving a whole
year of work from the old laptop to the new one now needs no file at all: a
"Send this backup to a device…" / "Receive from a device…" pair of buttons on
the card next to the existing download button pairs two browsers over
`_shared/webrtc-pair.js`'s manual QR/paste signaling and streams the same
envelope `buildEnvelope()` builds for a download straight across a WebRTC
data channel.

- **New files:** `Tools/backup-restore/br-pair.js` (a thin host/join wrapper
  around `_shared/webrtc-pair.js`, plus a copy of `ct-mirror.js`'s `drawQR` —
  copied rather than imported, per CLAUDE.md's per-tool-folder guidance) and
  `Tools/backup-restore/br-transfer.js` (frames a JSON string into
  wire-sized chunks with backpressure via `bufferedamountlow`, and a receiver
  state machine that reassembles them by concatenation — safe because
  `RTCDataChannel` is ordered and reliable by default). Both are plain global
  scripts, matching the page's own non-module IIFE.
- **`Tools/009-backup-restore.html` changes:** a new "Send directly to
  another device" card, a modal (`#transferOverlay`) that walks both the
  send and receive roles through pairing, and `loadEnvelopeText()` — the
  file-input JSON-parse/verify/arm-preview logic pulled out of the
  `fileInput` change handler into a standalone function so the transfer path
  calls the exact same code a picked file does. There is exactly one restore
  implementation; device-to-device is only a second way to get the envelope
  bytes onto the machine. New script tags: `_shared/webrtc-pair.js`,
  `_shared/qr-scan.js`, `_shared/vendor/qrcode/qrcode.js`,
  `_shared/vendor/jsqr/jsqr.js` (all already vendored/shared for other
  tools — none of this added a new vendored library or a per-tool copy of
  one; `check:dedupe` stays clean).
- **No new storage.** Nothing about this feature persists anything new in
  `localStorage` — it moves the same envelope bytes a download would produce,
  over a peer connection, instead of through a file.
- **Known limitations**, inherited from `_shared/webrtc-pair.js` by design
  (see that file's header): host-candidates-only, no STUN/TURN, so it only
  works between two devices that can reach each other directly — the same
  classroom Wi-Fi or LAN, never across the open internet. Pairing is manual
  (scan a QR or copy/paste the offer/answer text) since there is no
  signaling server. The payload is chunked to a fixed character size
  (`BRTransfer.CHUNK_CHARS`, 16000) with a small header announcing the chunk
  count up front — there is no resume-after-drop; a connection that closes
  mid-transfer needs the pairing redone from the start, not a rejected
  chunk retried in place.
- Verified by `Tools/backup-restore/test/smoke-transfer.mjs` (19 checks):
  `br-transfer.js`'s chunk/reassemble protocol in isolation (an empty
  payload, an exact chunk-size boundary, a UTF-16 surrogate pair split
  across a chunk boundary, and both receiver error paths), then a *real*
  two-peer `RTCDataChannel` opened between two Playwright pages loading this
  page in the same headless browser, carrying the exact bytes the "Download
  backup" button produces, landing byte-for-byte identical on the other
  side, and finally fed into `#fileInput` on the receiving page to confirm
  the transferred bytes drive the same restore preview and produce the same
  restored `localStorage` a picked file would. `npm run test:backup` (the
  existing `smoke-restore-diff.mjs` suite, 22 checks) still passes unchanged.
- Updated "Where the next round should pick up" and "Major Features" below
  to mark this shipped; renumbered the remaining open items.

### Pass 2 — Round 2 — 2026-08-11 — session `m3r8ro`

**Shipped the record-level restore preview** (backlog rank 7). The preview
answered "how many *files* will be overwritten", which is the wrong unit: a
teacher doesn't have one file called `np_rosters`, they have six rosters, and
what they need before pressing Restore is which of the six get replaced, which
get added, and which are left alone.

- New `recordDiff(mode, key, oldRaw, newRaw)` classifies every named record
  inside a key as **replaced / added / untouched / lost**, reusing the existing
  `parseNamedMap()` so it understands both site conventions (a
  `<prefix>:data:<name>` key per record, and one flat key holding
  `{name: record}`, optionally wrapped in `.sets`). A settings blob has no
  records to speak of, so it falls back to one whole-key outcome — half-merging
  one is how you corrupt it, which `combineValue()` already knew.
- **`lost` is the finding.** "Replace" writes the file's value over the whole
  key, so a roster that exists only on this computer and is absent from the
  backup is *destroyed* — and nothing anywhere said so. The summary now names
  the count in red and points at the two modes that keep them; the row lists
  them by name.
- **The numbers are recomputed when the mode radio changes**, which is the
  point of having modes: the same backup file against the same computer is
  "1 replaced, 1 added, 1 untouched, 2 removed" under Replace and "0 replaced,
  1 added, 4 untouched" under Add-only. Checkbox state is carried across the
  re-render, so changing modes can't silently re-tick a row that was
  deliberately excluded.
- `describeOverwrittenNames()` is gone — `recordDiff()` subsumes it and returns
  the same names in a form that can also say what happens to them.
- Verified by `Tools/backup-restore/test/smoke-restore-diff.mjs` (22 checks):
  a real backup file is fed to the real file input, all three modes are checked
  against a fixture built so every category is non-empty, and the last section
  actually presses Restore and compares `np_rosters` afterwards — so the
  preview's arithmetic is checked against the restore's behaviour, not just
  against itself.

### Pass 2 — Round 1 — 2026-08-10 — session `yjj7k6`

Picked up item 5 from Round 1's "where the next round should pick up" list:
*"Keep `STUDENT_KEYS` and `KNOWN_GROUPS` current."* This round audited both
against every tool actually on the site, not just the ones this page already
knew about.

Method: grepped every `Tools/*.html` and `Tools/*/*.js` for
`localStorage`-key-holding variable declarations (`*_KEY`, `*_PREFIX`,
`STORE_KEY`, etc.), which turned out to be the naming convention nearly
every tool on the site already follows, then cross-checked the resulting
key list against `KNOWN_GROUPS`.

**Found a real gap**: the entire batch of 35 tools added at the Pass 2 reset
(047 through 081) was missing from `KNOWN_GROUPS` outright — every key any
of them writes was showing up in the scan table as unlabeled "Other saved
data" rather than under the tool's name. Also found two older, pre-existing
gaps that had nothing to do with the Pass 2 batch: `br_home_teacher` (East
Middle Schedule Browser, `034-schedule-browser.html`) and
`final-grade-checker:settings-v1` (Final Grade Checker,
`036-final_grade_checker.html`) were never added to `KNOWN_GROUPS` when
those tools shipped their own settings persistence.

Added all of them — 32 new `KNOWN_GROUPS` entries in total. Five tools in
the Pass 2 batch (061 Fraction–Decimal–Percent Drill, 063 Grammar Mad Libs,
067 Music Sight-Reading, 080 Virtual Manipulatives Board, 081 Word Problem
Warm-Up) genuinely write nothing to `localStorage` at all — confirmed by
grep, not assumed — so there was nothing to add for them; they're
stateless generators by design.

Also classified the five new keys that actually hold student names into
`STUDENT_KEYS` (checked each candidate by grepping its file for
roster/student-name fields rather than guessing from the tool's title —
`058-duty-roster-builder.html`'s "roster" is a staff duty roster, for
instance, and correctly stayed out):

- `apl_portfolio_v1` (Student Art Portfolio Label & QR Tag Maker)
- `fsat_tracker_v1` (Fitness & Skill Assessment Tracker)
- `pcl_roster_v1`, `pcl_entries_v1` (Parent/Guardian Contact Log)
- `sfpt_tracker_v1` (Science Fair Project Tracker)
- `tacg_cards_v1` (Testing Accommodations Reference Card Generator)

Everything else stayed classified as settings (the conservative default),
including template/content-bank tools like DBQ Source Packet Builder or
Verb Conjugation Poster Generator that hold no per-student data.

Verified the file's inline scripts still parse cleanly and the page loads
with no console errors in a headless-browser smoke test. Did not attempt a
full Playwright pass reproducing this round's own 39-check suite — this was
a data-table addition, not a logic change, and the existing `classifyKey`/
`labelFor` functions were not touched.

**Where the next round should pick up**: this audit is a snapshot, not a
standing guarantee — any tool that starts writing a new `localStorage` key
after this round still needs a manual add to `KNOWN_GROUPS` (and
`STUDENT_KEYS` if it's student data), per the existing "Threads left open"
note in `_tools-touched.md`. The rest of this tool's Round 1 backlog
(device-to-device transfer, scheduled reminders, per-tool restore, per-record
conflict resolution, the encrypted-backup question) is unchanged.

### Round 1 (Pass 1) — 2026-08-10 — The versioned format, merge restore, IndexedDB coverage, and
the year-end archive-and-clear workflow all shipped**, along with the quota
readout, named backups, file verification, the harder first-run nag, and
selective export. Verified with a 39-check Playwright pass over the page plus
a separate 13-check IndexedDB round-trip that seeds a real `Blob`, backs it
up, deletes the database and restores it byte-for-byte.

What shipped, against the backlog below:

- **Versioned, self-describing backup format (Major Feature, P8)** — files now
  carry `format: "aspermylessonplan-backup"`, `formatVersion: 2`, an optional
  `label`, and a `meta` block describing its own contents (item count, byte
  count, per-tool group with its kind). **Every backup ever downloaded from
  the old build still restores**: `readEnvelope()` recognises a file with no
  version stamp by its `source` string, treats it as version 1, and hands back
  the same shape. A file written by a *newer* version than this page
  understands is accepted with a stated warning rather than refused.
- **Merge restore (Major Feature)** — three modes, chosen before restoring:
  **Replace** (the old behaviour), **Add only what is missing** (keeps this
  computer's copy of everything and brings in only what is not here — the safe
  answer for school-desktop-plus-home-laptop), and **Combine, file wins on a
  clash**. Merging is record-level, not key-level, for the two named-record
  shapes this site uses (`{name: data}` and `{sets: {name: data}}`), so two
  machines with different rosters end up with the union rather than one
  clobbering the other. The `.sets` wrapper's `current` pointer is kept from
  *this* machine unless it points at a record that no longer exists.
- **IndexedDB coverage (Quick Win — the correctness one)** — the page now
  enumerates IndexedDB, lists every database, store and record count in the
  scan table, and can export and rebuild them, including object-store schema
  (keyPath, autoIncrement, indexes) and `Blob`/`ArrayBuffer`/`Date` values,
  which JSON cannot hold and which are tagged and rebuilt on the way back.
  Databases are **unchecked by default**, with the reason stated in the row:
  the only one on this site today is the Blank Map Generator's image cache,
  which re-downloads on demand and would balloon the file for data that costs
  nothing to lose. Where a browser refuses to list its databases
  (`indexedDB.databases()` is not universal) the page **says so in the scan
  table** instead of quietly omitting them — a backup that silently drops data
  is the failure this was about.
- **Archive-and-clear for a school year (Major Feature, P14)** — one button
  that downloads a full archive and *then* clears student data, keeping every
  rubric, template, calendar and setting. It shows exactly which tools fall on
  each side of that line before you press it, and asks a second time after the
  file has downloaded, because that is the irreversible half. Pairs with Class
  Roster Hub's own "start a new school year".
- **Student data vs settings, per key (the enabling classification)** — the
  scan table now has one row per tool *and kind*, so "Name Picker — student
  data" and "Name Picker — settings & templates" are separately selectable.
  That one change is what makes selective export, the year-end clear, and the
  restore preview all exact instead of approximate.
- **Selective export (Quick Win)** — "Only student data" / "Only settings &
  templates" / "Select everything" one-click filters over that classification.
- **Quota readout (Quick Win, P12)** — bytes used against the ~5 MB
  `localStorage` ceiling with a meter, the three biggest consumers named, and
  a warning above 70%. `navigator.storage.estimate()` is reported *separately*
  underneath rather than merged, because it measures a different thing (it
  includes IndexedDB, cached images and the offline copy of the site).
- **Verify a backup without restoring (Quick Win)** — dropping a file in now
  produces a report before anything is armed: format version, when it was
  taken, its label, what it contains, its size, and flags for the things worth
  knowing (no version stamp and no mention of this site; an item count that
  disagrees with the contents; values that are not text). It ends with
  "Nothing has been changed yet" in green, because the whole problem with
  restore is that it asks for trust.
- **Named backups (Quick Win)** — a label field, sanitised into the filename,
  with a live filename preview.
- **Backup age nag with teeth (Quick Win)** — the never-backed-up state is now
  a red, bold banner that names the amount at risk: "You have never downloaded
  a backup, and there is 412 KB of work saved in this browser across 23 items."

**Challenges hit:**

- **Merging cannot be done blindly on any object.** The first cut merged every
  key that parsed as an object, which would have silently corrupted settings
  blobs — a flat `{sound: true, speed: 130}` is not a set of named records, and
  merging it name-by-name produces nonsense. `parseNamedMap` now requires every
  value in the object to itself be an object before treating it as a record
  set, and falls back to a whole-key decision otherwise.
- **`indexedDB.databases()` is not universally supported.** Rather than
  pretend, the page detects the gap and states it in the UI. This is the one
  place where the tool cannot keep its promise, and saying so is the only
  honest option.
- Blobs cost roughly 33% extra as base64 and the whole file is held in memory
  as a JSON string. Fine for the map cache; a tool that put a hundred photos
  in IndexedDB would need streaming, which this format cannot do.
- The 5 MB `localStorage` figure is a convention, not something the browser
  reports. It is used only to draw a meter and warn early, never to block.
- The year-end clear only ever removes keys it has explicitly been told are
  student data. Anything unrecognised is classified as settings and is never
  touched — the conservative direction, but it does mean **`STUDENT_KEYS` has
  to be updated when a new tool starts storing student names**, or that tool's
  data will survive a year-end clear.

**Where the next round should pick up:**

1. **Scheduled reminder (Major)** — still unbuilt. The banner nags when you
   visit; nothing brings you here.
2. **Per-tool restore from the tool itself (Major)** — a shared mountable
   control. `readEnvelope` and `combineValue` are the reusable pieces; they
   currently live inside this page and would need extracting to `_shared/`.
3. **Per-record conflict resolution** — the three modes are whole-file. "Keep
   the newer of each" is impossible without per-record timestamps, which no
   tool writes; that is a P8 convention question worth deciding before
   building anything on it.
4. **Keep `STUDENT_KEYS` and `KNOWN_GROUPS` current.** Both grew this round
   (Class Roster Hub, Hall Pass, Novel Circles, Command Center and a dozen
   others were missing from the group list entirely and were showing up as
   "Other saved data"). This is the maintenance cost of the friendlier answer
   to the first Open Question below — worth it, but real.
5. The **encrypted-backup question** below is untouched and still needs
   Devon's call.
6. **Resume-after-drop for device-to-device transfer.** Round 3 shipped the
   happy path only — a connection that drops mid-transfer needs pairing
   redone from scratch, not a resumed send. Worth doing only if teachers
   actually hit it in practice; the file-download path is always the
   fallback.

## What it does today

- Scans `localStorage` for every key the site's tools write, groups them, and
  labels them for a human (`scanGroups`, `labelFor`, `isInternalKey`)
- Shows size per group, and a **record-level preview of the restore**
  (`recordDiff`, `renderRestorePreview`): per group and in total, how many
  named records would be replaced, added, left untouched, and — under
  "Replace" — how many that exist only on this computer would be removed.
  Recomputed live when the restore mode changes
- Downloads a single `.json` backup; restores selected items with checkboxes
- Remembers when you last backed up (`br_last_backup_at`) and shows a banner
- Rescan button

## Quick Wins

- **Done —** **It doesn't cover IndexedDB.** `blank-map-generator` keeps its cached maps
  in IndexedDB (`bmg-map-cache.js`), and any tool that follows that pattern
  for images (P12) will be invisible to this tool. A backup that silently
  omits data is worse than no backup. *(Shipped — the page now enumerates
  IndexedDB and can export/rebuild it, including schema and Blob/ArrayBuffer/
  Date values.)*
- **Done —** **Backup age nag with teeth.** The banner is good; a hard "you have never
  backed up and you have 2.1 MB of work here" state on first visit is better.
  *(Shipped — a red, bold banner naming the exact amount at risk.)*
- **Restore preview / diff.** Show what changes: "3 rosters will be replaced,
  2 new ones added, 1 left alone." Restoring is the scary operation and it
  currently asks for trust. *(Not shipped this round — "Verify a backup"
  below shows what a file contains before arming it, but not a per-record
  diff of what restoring it would change.)*
- **Done —** **Selective export**, not just selective restore — "just my rosters", "just
  this year's grade data". *(Shipped — "Only student data" / "Only settings &
  templates" / "Select everything" one-click filters.)*
- **Done —** **Quota readout.** Total bytes used against the ~5 MB `localStorage` ceiling,
  with the biggest offenders listed. This is the natural home for the
  storage-pressure warning the whole site needs (P12). *(Shipped — a meter,
  the three biggest consumers, and a warning above 70%.)*
- **Done —** **A named backup.** Filename with date and, optionally, a label
  ("end-of-Q2") instead of a generic name. *(Shipped — a label field,
  sanitised into the filename, with a live preview.)*
- **Done —** **Verify a backup file** without restoring it — open it, list contents,
  confirm it isn't truncated or from a different site. *(Shipped — dropping a
  file produces a report before anything is armed, ending in "Nothing has
  been changed yet".)*

## Major Features

- **Done —** **Versioned, self-describing backup format.** Stamp a schema version and a
  per-tool version into the file, and ship migrations so a backup taken in
  September still restores in May after three tools changed shape (P8). This
  is the feature that makes this tool trustworthy rather than hopeful.
  *(Shipped — `formatVersion`, a `meta` block, and backward-compatible
  reading of every pre-existing unversioned backup.)*
- **Done — whole-file modes only.** **Merge restore, not just overwrite.** Two computers (school desktop and
  home laptop) is the normal case. "Combine, keeping the newer of each" and
  per-item conflict resolution would make the two-machine workflow actually
  work. *(Shipped three whole-file modes — Replace, Add only what's missing,
  Combine with file-wins-on-clash. Per-record conflict resolution ("keep the
  newer of each") is still open — it needs per-record timestamps no tool
  currently writes; see Where the next round should pick up.)*
- **Scheduled reminder.** A local, opt-in reminder — end of each grading
  period, or every N days — surfaced on the site rather than emailed.
- **Done —** **Direct device-to-device transfer** (P9). `_shared/webrtc-pair.js`
  already did serverless peer-to-peer with QR pairing; `br-pair.js` and
  `br-transfer.js` (Round 3) put it to work moving a whole year's work from
  the old laptop to the new one without producing a file at all. *(Shipped —
  same-Wi-Fi/LAN only, no STUN/TURN by design; see Round 3's Status entry
  for the chunking approach and its limitations.)*
- **Done —** **Archive-and-clear for a school year** (P14). "Save last year to a file,
  then clear last year's student data but keep my templates, rubrics, and
  standing details." Right now backup and rollover are unrelated ideas; they
  are really one workflow. *(Shipped — one button downloads a full archive,
  shows which tools fall on which side of the line, then clears student
  data.)*
- **Per-tool restore from the tool itself.** A small shared control any tool
  can mount — "restore just this tool's data from a backup file" — so a
  teacher who breaks one tool doesn't have to reason about all of them.

## Moonshot / North Star

**Nobody ever loses a year of work to a cleared cache.** The failure mode this
whole site is exposed to is a browser wipe, a district-imaged laptop, or a new
computer in August. This tool should make that a non-event: continuous
awareness of what's stored, a trustworthy versioned archive, a one-tap
transfer to another device, and a restore that shows exactly what it will do
before it does it — all with nothing ever leaving the machine.

## Platform themes that matter here

- **P8 (keys, versioning, migration)** — this tool is the one that pays the
  cost of the site's inconsistent key naming, and the natural place to define
  the convention.
- **P12 (storage quota / IndexedDB)** — must learn to see IndexedDB.
- **P14 (year lifecycle)** — archive-and-roll-forward belongs here.
- **P9 (device pairing)** — device-to-device migration is the standout idea.

## Open Questions

- Should this tool know the *list* of tools explicitly (so it can report
  "Rubric Builder: no data saved"), or stay purely heuristic over whatever
  keys it finds? Explicit is friendlier and is one more thing to maintain.
- Is there appetite for an optional encrypted backup (passphrase, WebCrypto,
  entirely local) given these files can contain student names?
