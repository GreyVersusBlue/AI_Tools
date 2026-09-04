/* tool-registry.js — the one machine-checked record of what every tool on this
   site saves, and where.

   Why this exists. Until now the only site-wide record lived inside 009 Backup
   & Restore as two hand-maintained arrays: KNOWN_GROUPS (76 rows, keyed on a
   display label and nothing else) and STUDENT_KEYS/STUDENT_PREFIXES (30 keys
   and 5 prefixes). Nothing checked either one, and both failed silently. A key
   the lists had never heard of showed up in a teacher's backup as "Other saved
   data" — unnamed — and, because anything unrecognised is treated as settings,
   the end-of-year rollover kept last year's students instead of clearing them.
   Four tools' keys had already been found missing after the fact.

   `Tools/board-check/check-registry.mjs` (npm run check:registry) resolves
   every localStorage call site in the tree back to a literal key or prefix and
   fails if this file does not declare it. The same script emits this data with
   --json, so the measurement and the guard are one code path rather than two
   that drift.

   WHAT A ROW MEANS.

     slug, title, file, category   from index.html, which is the only source on
                                   the site that carries all four.
     backupLabel                   present only where 009's teacher-facing name
                                   differs from the title, so the backup table
                                   keeps the wording teachers already know.
     keys      [{k, student?, transient?}]
     prefixes  [{p, student?}]     a family of keys built as PREFIX + something.

   `student` is per key, NOT per tool, and that is deliberate: the Name Picker's
   np_rosters is student data and its np_theme is not; 010's :excluded: is and
   its :settings is not. A per-tool boolean cannot express either, and the
   end-of-year rollover — "keep my rubrics, drop last year's kids" — is exactly
   the question it has to answer. Anything not marked is settings, which is the
   conservative direction: the rollover never deletes a key it was not told
   about.

   `transient` marks a key that only ever exists for a moment — the write probes
   that ask whether storage works at all. It is real, it is written, and it must
   never appear in a backup.

   `legacy` marks a key or prefix nothing writes any more, kept so that a
   teacher who has used this site for a year still sees their leftover data
   under a name instead of under "Other saved data". Most of them are the old
   broad prefixes (gvb-review-board:, gtg:, …) that KNOWN_GROUPS used; the rows
   below declare the precise keys instead, because a broad prefix silently
   absorbs anything a tool adds later and leaves the guard with nothing to see.
   check-registry.mjs therefore does NOT count a legacy entry as coverage: a new
   key under an old prefix still has to be declared.

     idb       [{name, note?}]     IndexedDB databases. Declared rather than
                                   discovered because indexedDB.databases() does
                                   not exist in Firefox, where enumeration
                                   silently returns nothing at all.
     reads / readPrefixes          another tool's keys this tool only reads.
                                   TWENTY-FIVE rows read np_rosters (28 tool
                                   pages mention the key at all, counting its
                                   owner 007, its writer 006 and 009, which
                                   backs up every key generically). This said
                                   "twelve" until 2026-09-04 and was never
                                   right; it is one node -e away from checkable,
                                   so check it rather than carrying it forward.
                                   Two rows WRITE another tool's key: 010 writes
                                   hall-pass-log-sections, and `shared` writes
                                   np_rosters + crh_students_v1 on a tool's
                                   behalf via _shared/roster.js. Ownership is
                                   decided by who writes.
     dynamic                       a call site the extractor could not resolve
                                   to a literal, acknowledged here so that a
                                   human has looked at it once. Currently empty
                                   across all 86 tools.

   One thing to know before the storage rollout reaches them: 028 and 039 each
   define a PRIVATE object called `Store` (their own save/load/remove over a
   data prefix). Those are not _shared/store.js, and both will have to rename
   theirs before they can adopt the shared one.

   Plain global script, not an ES module, and the data is inline rather than
   fetched JSON: half this site's tools use classic scripts, and the offline
   copy runs from file://, where a fetch of a sibling JSON file is blocked.

*/
(function (global) {
  'use strict';

  var TOOLS = [
    {
      slug: 'shared',
      title: 'Shared — accessibility and theme preference',
      file: '_shared/a11y.js',
      category: 'platform',
      backupLabel: 'Shared — theme preference',
      keys: [
        { k: '__gvb_store_probe__', transient: true },
        { k: 'gvb-a11y-prefs' },
        { k: 'gvb-home-cats' },
        { k: 'gvb-tools-theme', legacy: true },
      ],
      /* _shared/roster.js writes both of these on a tool's behalf, so a
         call-site scan now attributes them here rather than to 006. Neither is
         OWNED here — np_rosters belongs to the Name Picker's row and
         crh_students_v1 to Class Roster Hub's, which is what decides how a
         backup labels them and whether the year-end clear takes them. */
      writes: [
        'np_rosters',
        'crh_students_v1',
      ],
    },
    {
      slug: 'name-picker',
      title: 'Name Picker',
      file: 'Tools/007-Name%20Picker.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'np_absent', student: true },
        { k: 'np_crazy' },
        { k: 'np_current', student: true },
        { k: 'np_history', student: true },
        { k: 'np_hof', student: true },
        { k: 'np_lucky', student: true },
        { k: 'np_lucky_enabled' },
        { k: 'np_options' },
        { k: 'np_prompts' },
        { k: 'np_retro_active' },
        { k: 'np_retro_unlocked' },
        { k: 'np_rosters', student: true },
        { k: 'np_stats', student: true },
        { k: 'np_theme' },
      ],
    },
    {
      slug: 'seating-chart',
      title: 'Seating Chart Generator',
      file: 'Tools/005-Seating%20Chart%20Generator.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'seating-chart-v1', student: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'classroom-timer',
      title: 'Classroom Timer',
      file: 'Tools/004-Classroom%20Timer.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'ct_prefs' },
        { k: 'ct_running_v1' },
      ],
    },
    {
      slug: 'group-team-generator',
      title: 'Group / Team Generator',
      file: 'Tools/002-group-team-generator.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'gtg-settings', student: true },
        { k: 'gtg:current', student: true },
        { k: 'gtg:list', student: true },
      ],
      prefixes: [
        { p: 'gtg:', student: true, legacy: true },
        { p: 'gtg:data:', student: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'behavior-points-tracker',
      title: 'Behavior & Points Tracker',
      file: 'Tools/008-behavior-points-tracker.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'behavior-points-tracker-sections', student: true },
      ],
      reads: [
        'np_rosters',
        'seating-chart-v1',
      ],
    },
    {
      slug: 'hall-pass-log',
      title: 'Digital Hall Pass / Sign-Out Log',
      file: 'Tools/001-hall-pass-log.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'hall-pass-log-sections', student: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'class-roster-hub',
      title: 'Class Roster Hub',
      file: 'Tools/006-class-roster-hub.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'crh_archive_v1', student: true },
        { k: 'crh_archived_students', student: true },
        { k: 'crh_students_v1', student: true },
      ],
      /* Still the tool that puts rosters on disk, but it does it through
         _shared/roster.js now, so the scan sees the write on the shared row
         above rather than here. Kept because ownership of the ACT is what this
         column records, and a reader asking "which tool writes my rosters"
         wants this answer, not "_shared/". */
      writes: [
        'np_rosters',
      ],
      reads: [
        'seating-chart-v1',
      ],
    },
    {
      slug: 'command-center-dashboard',
      title: 'Command Center (Daily Dashboard)',
      file: 'Tools/010-command-center-dashboard.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'gvb-command-center:settings' },
      ],
      prefixes: [
        { p: 'gvb-command-center:', legacy: true },
      ],
      writes: [
        'hall-pass-log-sections',
      ],
      reads: [
        'ct_prefs',
        'ct_running_v1',
        'np_rosters',
        'scv_calendar_v1',
        'seating-chart-v1',
      ],
    },
    {
      slug: 'duty-roster-builder',
      title: 'Duty Roster Builder',
      file: 'Tools/058-duty-roster-builder.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'drb_roster_v1' },
      ],
    },
    {
      slug: 'socratic-seminar-prep-organizer',
      title: 'Socratic Seminar Prep & Tracker',
      file: 'Tools/084-socratic-seminar-prep-organizer.html',
      category: 'classroom-mgmt',
      keys: [
        { k: 'socsem:current' },
        { k: 'socsem:list' },
      ],
      prefixes: [
        { p: 'socsem:data:' },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'schedule-browser',
      title: 'Schedule Browser',
      file: 'Tools/034-schedule-browser.html',
      category: 'scheduling-subs',
      backupLabel: 'East Middle Schedule Browser',
      keys: [
        { k: 'br_home_teacher' },
        { k: 'br_personal_notes_v1' },
      ],
    },
    {
      slug: 'layout-visualizer',
      title: 'School Layout Visualizer',
      file: 'Tools/035-schedule-visualizer.html',
      category: 'scheduling-subs',
      keys: [
        { k: 'stviz_blueprint' },
        { k: 'stviz_onboarded' },
        { k: 'stviz_schedules' },
        { k: 'STVIZ_SESSION_OPEN_v1' },
        { k: 'stviz_settings' },
        { k: 'stviz_viz_prefs' },
        { k: 'stviz_whatif' },
      ],
      prefixes: [
        { p: 'stviz_', legacy: true },
        { p: 'stviz_blueprint' },
        { p: 'stviz_settings' },
        { p: 'STVIZ_SNAPSHOT_' },
      ],
      idb: [
        { name: 'stviz-recovery' },
      ],
    },
    {
      slug: 'school-calendar-visualizer',
      title: 'School Calendar Visualizer',
      file: 'Tools/032-School%20Calendar%20Visualizer.html',
      category: 'scheduling-subs',
      keys: [
        { k: '__scv_probe__', transient: true },
        { k: 'scv_calendar_v1' },
        { k: 'scv_view_cols' },
      ],
    },
    {
      slug: 'sub-plan-builder',
      title: 'Sub Plan Builder',
      file: 'Tools/044-Sub%20Plan%20Builder.html',
      category: 'scheduling-subs',
      keys: [
        { k: 'subPlanBuilder.history.v1' },
        { k: 'subPlanBuilder.lastAbsence.v1' },
        { k: 'subPlanBuilder.standingDetails.v1' },
      ],
    },
    {
      slug: 'sub-binder-generator',
      title: 'Sub Binder / Day Bundle Generator',
      file: 'Tools/045-sub-binder-generator.html',
      category: 'scheduling-subs',
      keys: [
        { k: 'gvb-sub-binder:included-sections.v1' },
        { k: 'gvb-sub-binder:today-lesson' },
      ],
      reads: [
        'behavior-points-tracker-sections',
        'gvb-exit-ticket:customPrompts',
        'hall-pass-log-sections',
        'scv_calendar_v1',
        'seating-chart-v1',
        'subPlanBuilder.history.v1',
        'subPlanBuilder.lastAbsence.v1',
        'subPlanBuilder.standingDetails.v1',
      ],
    },
    {
      slug: 'sub-note-feedback-slip',
      title: 'Sub Note / Feedback Slip Generator',
      file: 'Tools/076-sub-note-feedback-slip-generator.html',
      category: 'scheduling-subs',
      keys: [
        { k: 'snfs_slip_v1' },
      ],
    },
    {
      slug: 'staff-directory-builder',
      title: 'Staff Directory / Quick-Reference Builder',
      file: 'Tools/075-staff-directory-builder.html',
      category: 'scheduling-subs',
      keys: [
        { k: 'sdb_directory_v1' },
        { k: 'sdb_prefs_v1' },
      ],
    },
    {
      slug: 'grade-checker',
      title: 'Final Grade Checker',
      file: 'Tools/036-final_grade_checker.html',
      category: 'assessment-grading',
      keys: [
        { k: 'final-grade-checker:settings-v1' },
      ],
    },
    {
      slug: 'rubric-builder',
      title: 'Rubric Builder',
      file: 'Tools/003-rubric-builder.html',
      category: 'assessment-grading',
      keys: [
        { k: 'gvb-rubric-builder:current' },
        { k: 'gvb-rubric-builder:list' },
      ],
      prefixes: [
        { p: 'gvb-rubric-builder:', legacy: true },
        { p: 'gvb-rubric-builder:data:' },
        { p: 'gvb-rubric-builder:scores:' },
      ],
      writes: [
        'gvb-grade-distribution:current',
        'gvb-grade-distribution:data:',
        'gvb-grade-distribution:list',
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'grade-distribution-visualizer',
      title: 'Grade Distribution Visualizer',
      file: 'Tools/037-grade-distribution-visualizer.html',
      category: 'assessment-grading',
      keys: [
        { k: 'gvb-grade-distribution:current', student: true },
        { k: 'gvb-grade-distribution:list', student: true },
      ],
      prefixes: [
        { p: 'gvb-grade-distribution:', student: true, legacy: true },
        { p: 'gvb-grade-distribution:data:', student: true },
      ],
    },
    {
      slug: 'exit-ticket-generator',
      title: 'Exit Ticket / Bell Ringer Generator',
      file: 'Tools/023-exit-ticket-generator.html',
      category: 'assessment-grading',
      keys: [
        { k: 'gvb-exit-ticket:activeSet' },
        { k: 'gvb-exit-ticket:categoryTally' },
        { k: 'gvb-exit-ticket:customPrompts' },
        { k: 'gvb-exit-ticket:discussion' },
        { k: 'gvb-exit-ticket:sets' },
        { k: 'gvb-exit-ticket:settings' },
        { k: 'gvb-exit-ticket:tally', student: true },
        { k: 'gvb-exit-ticket:triage' },
      ],
      prefixes: [
        { p: 'gvb-exit-ticket:', legacy: true },
        /* 009's old list held this as a PREFIX, not a key, so a leftover
           gvb-exit-ticket:tally<something> counted as student data. Only the
           exact key exists today, but the family is kept so the year-end clear
           still removes an older one. */
        { p: 'gvb-exit-ticket:tally', student: true, legacy: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'testing-accommodations-card-generator',
      title: 'Testing Accommodations Reference Card Generator',
      file: 'Tools/077-testing-accommodations-card-generator.html',
      category: 'assessment-grading',
      keys: [
        { k: 'tacg_cards_v1', student: true },
      ],
    },
    {
      slug: 'bracket-tournament-generator',
      title: 'Bracket / Tournament Generator',
      file: 'Tools/020-bracket-tournament-generator.html',
      category: 'games-rewards',
      keys: [
        { k: 'gvb-bracket:current', student: true },
        { k: 'gvb-bracket:list', student: true },
      ],
      prefixes: [
        { p: 'gvb-bracket:', student: true, legacy: true },
        { p: 'gvb-bracket:data:', student: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'review-game-board',
      title: 'Quiz / Review Game Board',
      file: 'Tools/030-review-game-board.html',
      category: 'games-rewards',
      keys: [
        { k: 'gvb-review-board-bank:entries' },
        { k: 'gvb-review-board:__probe' },
        { k: 'gvb-review-board:current' },
        { k: 'gvb-review-board:list' },
      ],
      prefixes: [
        { p: 'gvb-review-board:', legacy: true },
        { p: 'gvb-review-board:data:' },
      ],
      idb: [
        { name: 'rgb-audio' },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'qr-scavenger-hunt-builder',
      title: 'QR Scavenger Hunt Builder',
      file: 'Tools/018-qr-scavenger-hunt-builder.html',
      category: 'games-rewards',
      keys: [
        { k: 'qr-scavenger-hunt-sets' },
        { k: 'qr-scavenger-hunt-settings' },
      ],
    },
    {
      slug: 'escape-room-builder',
      title: 'Digital Escape Room / Puzzle Lock Builder',
      file: 'Tools/019-escape-room-builder.html',
      category: 'games-rewards',
      keys: [
        { k: 'escape-room-builder:rooms' },
        { k: 'escape-room-progress:' },
      ],
      prefixes: [
        { p: 'escape-room-builder:', legacy: true },
      ],
    },
    {
      slug: 'qr-code-generator',
      title: 'QR Code Generator',
      file: 'Tools/016-qr-code-generator.html',
      category: 'games-rewards',
      keys: [
        { k: 'qr-code-generator-inventory' },
        { k: 'qr-code-generator-recent' },
        { k: 'qr-code-generator-settings' },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'certificate-award-maker',
      title: 'Certificate & Award Maker',
      file: 'Tools/042-certificate-award-maker.html',
      category: 'games-rewards',
      keys: [
        { k: 'gvb-certificate-maker:current' },
        { k: 'gvb-certificate-maker:list' },
      ],
      prefixes: [
        { p: 'gvb-certificate-maker:', legacy: true },
        { p: 'gvb-certificate-maker:data:' },
      ],
      reads: [
        'gvb-certificate-maker:last',
        'np_rosters',
      ],
    },
    {
      slug: 'image-to-pdf',
      title: 'Image → PDF Assembler',
      file: 'Tools/011-image-to-pdf.html',
      category: 'docs-comm',
      keys: [
        { k: 'image-to-pdf-settings' },
      ],
    },
    {
      slug: 'docx-merger',
      title: 'Word Doc Merger',
      file: 'Tools/031-docx-merger.html',
      category: 'docs-comm',
      keys: [
        { k: 'docx-merger-last-filelist' },
        { k: 'docx-merger-options' },
      ],
    },
    {
      slug: 'prompt-builder',
      title: 'Prompt Builder',
      file: 'Tools/029-prompt-builder.html',
      category: 'docs-comm',
      keys: [
        { k: 'promptBuilderCustomPresets_v1' },
        { k: 'promptBuilderDraft_v2' },
        { k: 'promptBuilderHistory_v1' },
        { k: 'promptBuilderMode_v1' },
      ],
      prefixes: [
        { p: 'promptBuilder', legacy: true },
      ],
    },
    {
      slug: 'field-trip-permission-slip',
      title: 'Field Trip Permission Slip Generator',
      file: 'Tools/043-field-trip-permission-slip.html',
      category: 'docs-comm',
      keys: [
        { k: 'gvb-field-trip:current' },
        { k: 'gvb-field-trip:list' },
      ],
      prefixes: [
        { p: 'gvb-field-trip:', legacy: true },
        { p: 'gvb-field-trip:data:' },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'parent-contact-log',
      title: 'Parent/Guardian Contact Log',
      file: 'Tools/068-parent-contact-log.html',
      category: 'docs-comm',
      keys: [
        { k: 'pcl_entries_v1', student: true },
        { k: 'pcl_roster_v1', student: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'parent-communication-templates',
      title: 'Parent Communication Template Generator',
      file: 'Tools/085-parent-communication-templates.html',
      category: 'docs-comm',
      keys: [
        { k: 'pct:custom' },
        { k: 'pct:lastValues' },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'citation-generator',
      title: 'Citation Generator',
      file: 'Tools/082-citation-generator.html',
      category: 'docs-comm',
      keys: [
        { k: 'citegen:current' },
        { k: 'citegen:list' },
      ],
      prefixes: [
        { p: 'citegen:data:' },
      ],
    },
    {
      slug: 'graph-paper-generator',
      title: 'Graph Paper & Number Line Generator',
      file: 'Tools/012-graph-paper-generator.html',
      category: 'math',
      keys: [
        { k: 'gvb-graph-paper:current' },
        { k: 'gvb-graph-paper:list' },
      ],
      prefixes: [
        { p: 'gvb-graph-paper:', legacy: true },
        { p: 'gvb-graph-paper:data:' },
      ],
      reads: [
        'gvb-graph-paper:settings',
      ],
    },
    {
      slug: 'math-drill-generator',
      title: 'Math Fact Drill Sheet Generator',
      file: 'Tools/026-math-drill-generator.html',
      category: 'math',
      keys: [
        { k: 'gvb-math-drill:settings' },
      ],
    },
    {
      slug: 'formula-sheet-builder',
      title: 'Formula Reference Sheet Builder',
      file: 'Tools/041-formula-sheet-builder.html',
      category: 'math',
      keys: [
        { k: 'gvb-formula-sheet:current' },
        { k: 'gvb-formula-sheet:list' },
      ],
      prefixes: [
        { p: 'gvb-formula-sheet:', legacy: true },
        { p: 'gvb-formula-sheet:data:' },
      ],
    },
    {
      slug: 'number-talks-board',
      title: 'Number Talks / Mental Math Routine Board',
      file: 'Tools/024-number-talks-board.html',
      category: 'math',
      keys: [
        { k: 'gvb-number-talks:myBank' },
        { k: 'gvb-number-talks:settings' },
        { k: 'gvb-number-talks:strategyLibrary' },
        { k: 'gvb-number-talks:stringHistory' },
      ],
      prefixes: [
        { p: 'gvb-number-talks:', legacy: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'virtual-manipulatives-board',
      title: 'Virtual Manipulatives Board',
      file: 'Tools/080-virtual-manipulatives-board.html',
      category: 'math',
      keys: [
        { k: 'vmb_boards_v1' },
        { k: 'vmb_snap_v1' },
        { k: 'vmb_working_v1' },
      ],
    },
    {
      slug: 'word-problem-warmup-generator',
      title: 'Word Problem Warm-Up Generator',
      file: 'Tools/081-word-problem-warmup-generator.html',
      category: 'math',
      keys: [
        { k: 'wpwg_settings_v1' },
      ],
    },
    {
      slug: 'unit-conversion-chart-builder',
      title: 'Unit Conversion Reference Chart Builder',
      file: 'Tools/078-unit-conversion-chart-builder.html',
      category: 'math',
      keys: [
        { k: 'ucb_chart_v1' },
      ],
    },
    {
      slug: 'math-find-the-mistake-generator',
      title: 'Math “Find the Mistake” Warm-Up Generator',
      file: 'Tools/066-math-find-the-mistake-generator.html',
      category: 'math',
      keys: [
        { k: 'mftm_custom_v1' },
        { k: 'mftm_disabled_builtins_v1' },
      ],
    },
    {
      slug: 'fraction-decimal-percent-drill-generator',
      title: 'Fraction–Decimal–Percent Conversion Drill Generator',
      file: 'Tools/061-fraction-decimal-percent-drill-generator.html',
      category: 'math',
      keys: [
        { k: 'fdp_settings_v1' },
      ],
    },
    {
      slug: 'vocab-flashcard-generator',
      title: 'Vocabulary Flashcard & Word Wall Generator',
      file: 'Tools/040-vocab-flashcard-generator.html',
      category: 'ela',
      keys: [
        { k: 'gvb-vocab-flashcards:current' },
        { k: 'gvb-vocab-flashcards:list' },
      ],
      prefixes: [
        { p: 'gvb-vocab-flashcards:', legacy: true },
        { p: 'gvb-vocab-flashcards:data:' },
      ],
      reads: [
        'gvb-vocab-conj:list',
      ],
      readPrefixes: [
        'gvb-vocab-conj:data:',
      ],
    },
    {
      slug: 'writing-prompt-generator',
      title: 'Writing Prompt Generator',
      file: 'Tools/025-writing-prompt-generator.html',
      category: 'ela',
      keys: [
        { k: 'gvb-writing-prompts:activeSet' },
        { k: 'gvb-writing-prompts:custom' },
        { k: 'gvb-writing-prompts:history' },
        { k: 'gvb-writing-prompts:record' },
        { k: 'gvb-writing-prompts:sets' },
        { k: 'gvb-writing-prompts:settings' },
      ],
      prefixes: [
        { p: 'gvb-writing-prompts:', legacy: true },
      ],
      writes: [
        'gvb-rubric-builder:current',
      ],
      reads: [
        'gvb-rubric-builder:list',
        'np_rosters',
      ],
      readPrefixes: [
        'gvb-rubric-builder:data:',
      ],
    },
    {
      slug: 'ssr-log-tracker',
      title: 'Silent Reading (SSR) Log Tracker',
      file: 'Tools/033-ssr-log-tracker.html',
      category: 'ela',
      keys: [
        { k: 'sslt_current_v1', student: true },
        { k: 'sslt_sections_v1', student: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'novel-study-reading-circles',
      title: 'Novel Study / Reading Circles Manager',
      file: 'Tools/027-novel-study-circles-manager.html',
      category: 'ela',
      keys: [
        { k: 'novel-study-circles', student: true },
        { k: 'novel-study-circles-current', student: true },
        { k: 'novel-study-units' },
        { k: 'novel-study-units-current' },
      ],
      writes: [
        'gvb-review-board:current',
        'gvb-review-board:data:',
        'gvb-review-board:list',
        'gvb-vocab-flashcards:current',
        'gvb-vocab-flashcards:data:',
        'gvb-vocab-flashcards:list',
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'daily-editing-warmup-generator',
      title: 'Daily Editing / DOL Warm-Up Generator',
      file: 'Tools/055-daily-editing-warmup-generator.html',
      category: 'ela',
      keys: [
        { k: 'deg_custom_v1' },
        { k: 'deg_hidden_v1' },
        { k: 'deg_settings_v1' },
      ],
    },
    {
      slug: 'peer-feedback-checklist-generator',
      title: 'Peer Feedback / Editing Checklist Generator',
      file: 'Tools/070-peer-feedback-checklist-generator.html',
      category: 'ela',
      keys: [
        { k: 'pfc_checklist_v1' },
      ],
    },
    {
      slug: 'book-tasting-menu-generator',
      title: 'Book Tasting Menu Generator',
      file: 'Tools/049-book-tasting-menu-generator.html',
      category: 'ela',
      keys: [
        { k: 'btmg_books_v1' },
        { k: 'btmg_slips_v1' },
      ],
    },
    {
      slug: 'grammar-mad-libs-generator',
      title: 'Grammar Mad Libs Generator',
      file: 'Tools/063-grammar-mad-libs-generator.html',
      category: 'ela',
      keys: [
        { k: 'gmlg_custom_banks_v1' },
        { k: 'gmlg_custom_story_v1' },
      ],
    },
    {
      slug: 'plot-diagram-builder',
      title: 'Story Elements / Plot Diagram Builder',
      file: 'Tools/072-plot-diagram-builder.html',
      category: 'ela',
      keys: [
        { k: 'pdb_current_v1' },
        { k: 'pdb_diagram_v1', legacy: true },
        { k: 'pdb_list_v1' },
      ],
      prefixes: [
        { p: 'pdb_data_v1:' },
      ],
      reads: [
        'pdb_diagram_v1',
      ],
    },
    {
      slug: 'lab-group-role-randomizer',
      title: 'Lab Group & Role Randomizer',
      file: 'Tools/022-lab-group-role-randomizer.html',
      category: 'science',
      keys: [
        { k: 'lgrr_current', student: true },
        { k: 'lgrr_rosters', student: true },
      ],
      reads: [
        'lsct_sections_v1',
        'np_rosters',
      ],
    },
    {
      slug: 'lab-safety-contract-tracker',
      title: 'Lab Safety Contract Tracker',
      file: 'Tools/013-lab-safety-contract-tracker.html',
      category: 'science',
      keys: [
        { k: 'lsct_current_v1', student: true },
        { k: 'lsct_sections_v1', student: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'data-chart-builder',
      title: 'Data Table → Chart Builder',
      file: 'Tools/038-data-chart-builder.html',
      category: 'science',
      keys: [
        { k: 'data-chart-builder-datasets' },
        { k: 'data-chart-builder-settings' },
      ],
    },
    {
      slug: 'lab-report-template-builder',
      title: 'Lab Report Template Builder',
      file: 'Tools/065-lab-report-template-builder.html',
      category: 'science',
      keys: [
        { k: 'lrt_current_v1' },
        { k: 'lrt_list_v1' },
        { k: 'lrt_template_v1' },
      ],
      prefixes: [
        { p: 'lrt_data_v1:' },
      ],
    },
    {
      slug: 'science-safety-label-maker',
      title: 'Science Safety Symbol & Equipment Label Maker',
      file: 'Tools/074-science-safety-label-maker.html',
      category: 'science',
      keys: [
        { k: 'sslm_queue_v1' },
      ],
    },
    {
      slug: 'scientific-method-planner',
      title: 'Scientific Method / Experiment Design Planner',
      file: 'Tools/059-experiment-design-planner.html',
      category: 'science',
      keys: [
        { k: 'edp_planner_v1' },
      ],
    },
    {
      slug: 'science-fair-project-tracker',
      title: 'Science Fair Project Tracker',
      file: 'Tools/073-science-fair-project-tracker.html',
      category: 'science',
      keys: [
        { k: 'sfpt_tracker_v1', student: true },
      ],
    },
    {
      slug: 'dichotomous-key-builder',
      title: 'Dichotomous Key Builder',
      file: 'Tools/057-dichotomous-key-builder.html',
      category: 'science',
      keys: [
        { k: 'dkb_key_v1' },
      ],
    },
    {
      slug: 'blank-map-generator',
      title: 'Blank Map Generator',
      file: 'Tools/046-blank-map-generator.html',
      category: 'social-studies',
      keys: [
        { k: '__bmg_probe__', transient: true },
        { k: 'bmg_project_v1', legacy: true },
        { k: 'bmg_workspace_v1' },
      ],
      idb: [
        { name: 'bmg-maps', note: 'Cached map images for the Blank Map Generator. Safe to leave out — they download again when needed.' },
      ],
      reads: [
        'bmg_project_v1',
      ],
    },
    {
      slug: 'timeline-builder',
      title: 'Timeline Builder',
      file: 'Tools/015-timeline-builder.html',
      category: 'social-studies',
      keys: [
        { k: 'gvb-timeline:current' },
        { k: 'gvb-timeline:list' },
      ],
      prefixes: [
        { p: 'gvb-timeline:', legacy: true },
        { p: 'gvb-timeline:data:' },
      ],
    },
    {
      slug: 'primary-source-analysis-generator',
      title: 'Primary Source Analysis Worksheet Generator',
      file: 'Tools/028-primary-source-analysis-generator.html',
      category: 'social-studies',
      keys: [
        { k: 'gvb-primary-source:current' },
        { k: 'gvb-primary-source:library' },
        { k: 'gvb-primary-source:list' },
      ],
      prefixes: [
        { p: 'gvb-primary-source:', legacy: true },
        { p: 'gvb-primary-source:data:' },
      ],
    },
    {
      slug: 'dbq-source-packet-builder',
      title: 'DBQ / Source Packet Builder',
      file: 'Tools/056-dbq-source-packet-builder.html',
      category: 'social-studies',
      keys: [
        { k: 'dbq_packet_v1', legacy: true },
        { k: 'dbq:bank' },
        { k: 'dbq:current' },
        { k: 'dbq:list' },
      ],
      prefixes: [
        { p: 'dbq:', legacy: true },
        { p: 'dbq:data:' },
      ],
      reads: [
        'dbq_packet_v1',
      ],
    },
    {
      slug: 'historical-trading-card-maker',
      title: 'Historical Figure / Country Trading Card Maker',
      file: 'Tools/064-historical-trading-card-maker.html',
      category: 'social-studies',
      keys: [
        { k: 'htcm_cards_v1', legacy: true },
        { k: 'htcm_cards_v2', legacy: true },
        { k: 'htcm:current' },
        { k: 'htcm:game' },
        { k: 'htcm:list' },
      ],
      prefixes: [
        { p: 'htcm:', legacy: true },
        { p: 'htcm:data:' },
      ],
      reads: [
        'htcm_card_size_v1',
        'htcm_cards_v1',
        'htcm_cards_v2',
        'np_rosters',
      ],
    },
    {
      slug: 'current-events-discussion-guide',
      title: 'Current Events Discussion Guide Generator',
      file: 'Tools/054-current-events-discussion-guide-generator.html',
      category: 'social-studies',
      keys: [
        { k: 'cedg_current_v1' },
        { k: 'cedg_guide_v1', legacy: true },
        { k: 'cedg_guides_v1' },
      ],
      prefixes: [
        { p: 'cedg_guide_v1:' },
      ],
      reads: [
        'cedg_guide_v1',
      ],
    },
    {
      slug: 'civics-simulation-role-cards',
      title: 'Government/Civics Simulation Role Card Generator',
      file: 'Tools/050-civics-role-card-generator.html',
      category: 'social-studies',
      keys: [
        { k: 'crcg_roles_v1', legacy: true },
        { k: 'crcg:current' },
        { k: 'crcg:list' },
      ],
      prefixes: [
        { p: 'crcg:', legacy: true },
        { p: 'crcg:data:' },
      ],
      reads: [
        'crcg_roles_v1',
        'np_rosters',
      ],
    },
    {
      slug: 'geography-bee-quiz-generator',
      title: 'Geography Bee / Map Skills Quiz Generator',
      file: 'Tools/062-geography-bee-quiz-generator.html',
      category: 'social-studies',
      keys: [
        { k: 'gbq_custom_v1' },
        { k: 'gbq_disabled_v1' },
        { k: 'gbq_settings_v1' },
        { k: 'gbq_tournament_v1' },
      ],
    },
    {
      slug: 'propaganda-analysis-worksheet-generator',
      title: 'Propaganda & Persuasion Analysis Worksheet Generator',
      file: 'Tools/083-propaganda-analysis-worksheet-generator.html',
      category: 'social-studies',
      keys: [
        { k: 'propa:current' },
        { k: 'propa:list' },
      ],
      prefixes: [
        { p: 'propa:data:' },
      ],
    },
    {
      slug: 'wiki-race',
      title: 'Wiki Race',
      file: 'Tools/086-wiki-race.html',
      category: 'social-studies',
    },
    {
      slug: 'vocab-conjugation-drill',
      title: 'Vocab & Conjugation Drill Generator',
      file: 'Tools/039-vocab-conjugation-drill.html',
      category: 'world-language',
      keys: [
        { k: 'gvb-vocab-conj:current' },
        { k: 'gvb-vocab-conj:list' },
      ],
      prefixes: [
        { p: 'gvb-vocab-conj:', legacy: true },
        { p: 'gvb-vocab-conj:data:' },
      ],
      reads: [
        'gvb-vocab-flashcards:list',
      ],
      readPrefixes: [
        'gvb-vocab-flashcards:data:',
      ],
    },
    {
      slug: 'roleplay-scenario-generator',
      title: 'Immersion Roleplay Scenario Generator',
      file: 'Tools/014-roleplay-scenario-generator.html',
      category: 'world-language',
      keys: [
        { k: 'gvb-roleplay:criteria' },
        { k: 'gvb-roleplay:current' },
        { k: 'gvb-roleplay:currentClass' },
        { k: 'gvb-roleplay:custom' },
        { k: 'gvb-roleplay:fills' },
        { k: 'gvb-roleplay:filter' },
        { k: 'gvb-roleplay:frames' },
        { k: 'gvb-roleplay:levelFilter' },
        { k: 'gvb-roleplay:roster' },
        { k: 'gvb-roleplay:ttsLang' },
        { k: 'gvb-roleplay:usefulFills' },
      ],
      prefixes: [
        { p: 'gvb-roleplay:', legacy: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'classroom-label-maker',
      title: 'Classroom Label Maker (Target Language)',
      file: 'Tools/051-classroom-label-maker.html',
      category: 'world-language',
      keys: [
        { k: 'clm_current_v1' },
        { k: 'clm_lang_v1', legacy: true },
        { k: 'clm_lists_v1' },
        { k: 'clm_words_v1', legacy: true },
      ],
      prefixes: [
        { p: 'clm_list_v1:' },
      ],
      reads: [
        'clm_lang_v1',
        'clm_words_v1',
      ],
    },
    {
      slug: 'verb-conjugation-poster-generator',
      title: 'Verb Conjugation Reference Poster Generator',
      file: 'Tools/079-verb-conjugation-poster-generator.html',
      category: 'world-language',
      keys: [
        { k: 'vcp_columns_v1' },
        { k: 'vcp_poster_v1' },
      ],
    },
    {
      slug: 'cultural-trivia-card-generator',
      title: 'Cultural Trivia Card Generator',
      file: 'Tools/053-cultural-trivia-card-generator.html',
      category: 'world-language',
      keys: [
        { k: 'ctcg_custom_v1' },
        { k: 'ctcg_hidden_v1' },
        { k: 'ctcg_settings_v1' },
      ],
    },
    {
      slug: 'picture-prompt-task-generator',
      title: 'Picture-Prompt Speaking/Writing Task Generator',
      file: 'Tools/071-picture-prompt-generator.html',
      category: 'world-language',
      keys: [
        { k: 'ppg_images_v1' },
        { k: 'ppg_print_count_v1' },
        { k: 'ppg_prompt_sets_v1' },
        { k: 'ppg_prompts_v1' },
      ],
    },
    {
      slug: 'cognates-false-friends-builder',
      title: 'Cognates & False Friends Reference List Builder',
      file: 'Tools/052-cognates-false-friends-builder.html',
      category: 'world-language',
      keys: [
        { k: 'cffb_list_v1' },
      ],
    },
    {
      slug: 'pe-tournament-station-rotation',
      title: 'Tournament Bracket & Station Rotation',
      file: 'Tools/021-pe-tournament-stations.html',
      category: 'arts-pe',
      keys: [
        { k: 'pe-tournament-stations', student: true },
      ],
    },
    {
      slug: 'gallery-walk-qr',
      title: 'Gallery Walk QR Codes',
      file: 'Tools/017-gallery-walk-qr.html',
      category: 'arts-pe',
      keys: [
        { k: 'gallery-walk-qr-sets', student: true },
      ],
      reads: [
        'np_rosters',
      ],
    },
    {
      slug: 'art-critique-worksheet-generator',
      title: 'Art Critique Worksheet Generator',
      file: 'Tools/047-art-critique-worksheet-generator.html',
      category: 'arts-pe',
      keys: [
        { k: 'acw_worksheet_current_v1' },
        { k: 'acw_worksheet_v1', legacy: true },
        { k: 'acw_worksheets_list_v1' },
      ],
      prefixes: [
        { p: 'acw_worksheet_data_v1:' },
      ],
      reads: [
        'acw_worksheet_v1',
      ],
    },
    {
      slug: 'fitness-skill-assessment-tracker',
      title: 'Fitness & Skill Assessment Tracker',
      file: 'Tools/060-fitness-skill-assessment-tracker.html',
      category: 'arts-pe',
      keys: [
        { k: 'fsat_tracker_v1', student: true },
      ],
    },
    {
      slug: 'art-portfolio-label-maker',
      title: 'Student Art Portfolio Label & QR Tag Maker',
      file: 'Tools/048-art-portfolio-label-maker.html',
      category: 'arts-pe',
      keys: [
        { k: 'apl_portfolio_v1', student: true, legacy: true },
        { k: 'apl_portfolios_v1' },
      ],
      reads: [
        'apl_portfolio_v1',
      ],
    },
    {
      slug: 'music-sightreading-generator',
      title: 'Music Sight-Reading / Rhythm Warm-Up Generator',
      file: 'Tools/067-music-sightreading-generator.html',
      category: 'arts-pe',
      keys: [
        { k: 'msrg_settings_v1' },
      ],
    },
    {
      slug: 'pe-warmup-circuit-generator',
      title: 'PE Warm-Up Circuit Card Generator',
      file: 'Tools/069-pe-warmup-circuit-generator.html',
      category: 'arts-pe',
      keys: [
        { k: 'pe_circuit_current_v1' },
        { k: 'pe_circuit_v1', legacy: true },
        { k: 'pe_circuits_v1' },
      ],
      prefixes: [
        { p: 'pe_circuit_v1:' },
      ],
      reads: [
        'pe_circuit_v1',
      ],
    },
    {
      slug: 'backup-restore',
      title: 'Backup & Restore',
      file: 'Tools/009-backup-restore.html',
      category: 'platform',
      keys: [
        { k: 'br_last_backup_at' },
      ],
    },
  ];

  var byKey = null;

  function index() {
    if (byKey) return byKey;
    byKey = { keys: {}, prefixes: [] };
    for (var i = 0; i < TOOLS.length; i++) {
      var t = TOOLS[i];
      for (var j = 0; j < (t.keys || []).length; j++) {
        byKey.keys[t.keys[j].k] = { tool: t, entry: t.keys[j] };
      }
      for (var p = 0; p < (t.prefixes || []).length; p++) {
        byKey.prefixes.push({ tool: t, entry: t.prefixes[p] });
      }
    }
    /* Longest prefix first, so gvb-command-center:excluded: wins over
       gvb-command-center: for a key both would match. */
    byKey.prefixes.sort(function (a, b) { return b.entry.p.length - a.entry.p.length; });
    return byKey;
  }

  /**
   * The tool that owns `key` and the declaration that matched, or null.
   * Exact key first, then the longest matching prefix.
   */
  function lookupKey(key) {
    var ix = index();
    if (Object.prototype.hasOwnProperty.call(ix.keys, key)) return ix.keys[key];
    for (var i = 0; i < ix.prefixes.length; i++) {
      if (key.indexOf(ix.prefixes[i].entry.p) === 0) return ix.prefixes[i];
    }
    return null;
  }

  /** The teacher-facing name for whatever owns `key`, or null if nothing does. */
  function labelFor(key) {
    var hit = lookupKey(key);
    if (!hit) return null;
    return hit.tool.backupLabel || hit.tool.title;
  }

  /** 'student' or 'settings'. Unrecognised is 'settings' — the safe direction. */
  function classifyKey(key) {
    var hit = lookupKey(key);
    return hit && hit.entry.student ? 'student' : 'settings';
  }

  /** True for a write probe that must never end up in a backup. */
  function isTransient(key) {
    var hit = lookupKey(key);
    return !!(hit && hit.entry.transient);
  }

  /**
   * A tool's page as another page under Tools/ should link it — the registry's
   * `file` minus the leading "Tools/". Throws on an unknown slug rather than
   * returning a broken href, because the alternative is a dead link nobody
   * notices: 010 carried five of these hardcoded, one of them (004) with an
   * unencoded space that the other four had escaped.
   */
  function href(slug) {
    var t = bySlug(slug);
    if (!t) throw new Error('ToolRegistry: no tool with slug "' + slug + '"');
    return t.file.replace(/^Tools\//, '');
  }

  function bySlug(slug) {
    for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].slug === slug) return TOOLS[i];
    return null;
  }

  /** Every declared IndexedDB database, as {name, note, tool}. */
  function databases() {
    var out = [];
    for (var i = 0; i < TOOLS.length; i++) {
      var dbs = TOOLS[i].idb || [];
      for (var j = 0; j < dbs.length; j++) {
        out.push({ name: dbs[j].name, note: dbs[j].note || '', tool: TOOLS[i] });
      }
    }
    return out;
  }

  global.ToolRegistry = {
    tools: TOOLS,
    lookupKey: lookupKey,
    labelFor: labelFor,
    classifyKey: classifyKey,
    isTransient: isTransient,
    bySlug: bySlug,
    href: href,
    databases: databases
  };
})(window);
