# Improvement Prompts — Backup & Restore

**Tool file:** `Tools/backup-restore.html`
**Support folder:** none — single file

**Current description (from README):** Scans your browser for everything every tool on this site has saved and downloads it as one file, or restores it back on a new computer or after a wiped cache.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Scans `localStorage` for every key the site's tools write, groups them, and
  labels them for a human (`scanGroups`, `labelFor`, `isInternalKey`)
- Shows size per group and describes what would be overwritten on restore
  (`describeOverwrittenNames`)
- Downloads a single `.json` backup; restores selected items with checkboxes
- Remembers when you last backed up (`br_last_backup_at`) and shows a banner
- Rescan button

## Quick Wins

- **It doesn't cover IndexedDB.** `blank-map-generator` keeps its cached maps
  in IndexedDB (`bmg-map-cache.js`), and any tool that follows that pattern
  for images (P12) will be invisible to this tool. A backup that silently
  omits data is worse than no backup.
- **Backup age nag with teeth.** The banner is good; a hard "you have never
  backed up and you have 2.1 MB of work here" state on first visit is better.
- **Restore preview / diff.** Show what changes: "3 rosters will be replaced,
  2 new ones added, 1 left alone." Restoring is the scary operation and it
  currently asks for trust.
- **Selective export**, not just selective restore — "just my rosters", "just
  this year's grade data".
- **Quota readout.** Total bytes used against the ~5 MB `localStorage` ceiling,
  with the biggest offenders listed. This is the natural home for the
  storage-pressure warning the whole site needs (P12).
- **A named backup.** Filename with date and, optionally, a label
  ("end-of-Q2") instead of a generic name.
- **Verify a backup file** without restoring it — open it, list contents,
  confirm it isn't truncated or from a different site.

## Major Features

- **Versioned, self-describing backup format.** Stamp a schema version and a
  per-tool version into the file, and ship migrations so a backup taken in
  September still restores in May after three tools changed shape (P8). This
  is the feature that makes this tool trustworthy rather than hopeful.
- **Merge restore, not just overwrite.** Two computers (school desktop and
  home laptop) is the normal case. "Combine, keeping the newer of each" and
  per-item conflict resolution would make the two-machine workflow actually
  work.
- **Scheduled reminder.** A local, opt-in reminder — end of each grading
  period, or every N days — surfaced on the site rather than emailed.
- **Direct device-to-device transfer** (P9). `_shared/webrtc-pair.js` already
  does serverless peer-to-peer with QR pairing. Moving a whole year's work
  from the old laptop to the new one without producing a file at all is a
  genuinely delightful, genuinely private answer to the migration problem.
- **Archive-and-clear for a school year** (P14). "Save last year to a file,
  then clear last year's student data but keep my templates, rubrics, and
  standing details." Right now backup and rollover are unrelated ideas; they
  are really one workflow.
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
