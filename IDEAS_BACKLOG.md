# Ideas Backlog

Everything that's been suggested for the toolkit but hasn't been built yet. This file is the source of truth for
the list — the "coming soon" rows on `index.html` and the public [`ideas-backlog.html`](ideas-backlog.html) page
should both be kept in sync with whatever's here.

Reminder: coming soon means not right now.

## General / Classroom Logistics

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Math

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## English / Language Arts

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Science

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Social Studies

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## World Language

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Arts & PE

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Existing Tools — Enhancement Ideas

These are improvements to tools that are already built and live on the site, not new standalone tools — so none of
these get an `index.html` "coming soon" row.

**Rank** is a single priority order across this whole table, 1 = most important, no ties. It's what makes "work on
the next 10 most important ideas" a well-defined request — take the 10 lowest-numbered *unclaimed* rows, skipping
any row already tagged 🔒 **CLAIMED**. See "Working the ranked Existing Tools list" under
[Picking one up](#picking-one-up) for the renumbering rule and how to claim rows so multiple chats can work this
list in parallel without colliding.

| Rank | Tool | Idea | What it would do |
|---|---|---|---|
| 1 | Sub Note / Feedback Slip Generator | Follow-up urgency checkbox | A printed "call me about this" box the substitute ticks, so the teacher can triage which slips to read first. |
| 2 | Book Tasting Menu Generator | Printable tasting response slips | Print small "first course / second course" rating slips matching the menu, so the tasting produces a paper artifact. |
| 3 | Peer Feedback / Editing Checklist Generator | Three-point rating per item | Optional yes/somewhat/no boxes instead of a bare checkbox, so feedback records degree rather than only presence. |
| 4 | Science Safety Symbol & Equipment Label Maker | Reorder the label queue | Up and down controls on queued labels so the printed grid comes out in shelf order rather than insertion order. |
| 5 | Word Problem Warm-Up Generator | Copy current problem to clipboard | One button copying the projected problem text and answer, for pasting into a slide deck. |
| 6 | Daily Editing / DOL Warm-Up Generator | Hide individual built-in sentences | A per-sentence hide/unhide toggle on the built-ins with hidden ids persisted, copying the pattern already shipped in two sibling tools. |
| 7 | Cognates & False Friends Reference List Builder | Bulk paste import | Accept a pasted multi-line list — word, English, type — to build a whole reference set at once instead of row by row. |
| 8 | Cultural Trivia Card Generator | Bulk import a custom bank | Paste question/answer/category rows to load a whole custom bank in one step rather than adding questions individually. |
| 9 | Geography Bee / Map Skills Quiz Generator | Bulk import a custom bank | Paste question/answer/category rows to load a whole regional bank at once instead of adding questions one at a time. |
| 10 | Math "Find the Mistake" Warm-Up Generator | Grade-band scoping of the bank | Tag built-ins elementary, middle, and high and filter the display and worksheet together, matching a sibling tool's shipped filter. |
| 11 | Unit Conversion Reference Chart Builder | Grade-band presets | One click selects the right unit sets for elementary versus middle school, instead of checking boxes individually every time. |
| 12 | Grammar Mad Libs Generator | Editable per-tag word banks | Let a teacher paste their own nouns and adjectives per tag, so the worksheet's suggestion boxes carry the current unit's vocabulary. |
| 13 | Picture-Prompt Speaking/Writing Task Generator | Prompt sets by target language | Ship starter prompt libraries per language taught, selectable so the printed task wording matches the class. |
| 14 | Verb Conjugation Reference Poster Generator | Per-panel accent colors | Assign one color per verb-ending group so the poster is scannable from across the room. |
| 15 | Historical Figure / Country Trading Card Maker | Standard trading-card size option | A 2.5×3.5 inch print preset alongside the current larger card, for genuinely pocket-sized cards. |
| 16 | Lab Report Template Builder | Typed data-table columns | Let each data column declare numeric or text plus a units label, so the printed grid shows the expected format before students record. |
| 17 | Dichotomous Key Builder | Preview a classification path | Enter a hypothetical specimen's traits and highlight the couplet route it would take, catching dead ends before the key is printed. |
| 18 | Music Sight-Reading / Rhythm Warm-Up Generator | Glyph-support probe with fallback | Measure the musical-symbol glyphs at load and warn or swap to drawn shapes when the projecting machine renders empty boxes. |
| 19 | Virtual Manipulatives Board | Snap-to-grid toggle | Optional grid snapping so ten units visibly line up into a ten-rod without careful manual dragging. |
| 20 | Student Art Portfolio Label & QR Tag Maker | Class reference sheet print | One compact page listing every piece's title, artist, and full statement, for the teacher's records and for gallery signage. |
| 21 | Government/Civics Simulation Role Card Generator | Assign students to roles | Load a roster from `np_rosters` and print each card with its assigned student's name already on it. |
| 22 | QR Scavenger Hunt Builder | Staggered station starts | Assign each team a different starting station and rotation offset, printed on a per-team route card so teams stop bunching. |
| 23 | Lab Group & Role Randomizer | Group size from equipment count | Enter "7 microscopes" and get groups sized to the equipment on hand rather than to an arbitrary group size. |
| 24 | Field Trip Permission Slip Generator | Bilingual slip printing | Print the same slip with a teacher-supplied second-language column or facing page — the most-requested permission-slip feature in most districts. |
| 25 | Math Fact Drill Sheet Generator | More operation types | Fraction, decimal, percent, integer, and order-of-operations templates alongside the four arithmetic ones. |
| 26 | Word Doc Merger | Per-document merge options | Move the page-break and heading-normalization choices from global settings to per-document toggles in the file list. |
| 27 | Image → PDF Assembler | Whiteboard auto-enhance | A canvas-only contrast and white-balance pass that makes a phone photo of a whiteboard or worksheet legible and cheap to print. |
| 28 | Immersion Roleplay Scenario Generator | Success-criteria strip | A teacher-authored "what a good attempt sounds like" band printed on every handout and role card. |
| 29 | Timeline Builder | Tiled wall-timeline print | Reuse the Blank Map Generator's `printTiledPages` so one timeline spreads across taped-together sheets for a hallway wall. |
| 30 | Bracket / Tournament Generator | Scores that feed standings | Make the score field structured so round-robin W/L, point differential, and the printed bracket become a real record instead of free text. |
| 31 | Novel Study / Reading Circles Manager | Vocabulary to review game | Export the accumulated vocabulary log into the Review Game Board's bank, using the same bridge pattern the flashcard handoff already uses. |
| 32 | Art Critique Worksheet Generator | Artist self-reflection variant | A toggle that rewords the four critique steps into first person, for a student reflecting on their own finished piece. |
| 33 | DBQ / Source Packet Builder | Image size and crop control | A per-source width/scale slider and crop box, so uploaded documents print at a usable size instead of stretching to page width. |
| 34 | Story Elements / Plot Diagram Builder | Presentation view for discussion | A large-type, borderless, read-only rendering of the diagram for projecting live during a class discussion. |
| 35 | Final Grade Checker | Missing-work triage report | From the same paste, list who has zeros and who is one assignment from a letter change, and print a per-student catch-up slip. |
| 36 | Seating Chart Generator | Seating history and rotation | Record who sat where each unit and enforce "not the same seat twice" and "front row once per quarter", printable as evidence for a parent or admin. |
| 37 | East Middle Schedule Browser | One-page substitute view | Pick an absent teacher and print a single sheet: their day, rooms, groups, common-planning coverage candidates, and a building map crop. |
| 38 | School Layout Visualizer | Evacuation route planner | Compute and print per-room evacuation paths and assembly points from the existing A* graph, as postable door cards. |
| 39 | Quiz / Review Game Board | Audio in a clue | Record or attach a short clip — a pronunciation, a music excerpt, a primary-source recording — stored in IndexedDB rather than inline, with a play control on the projected clue. |
| 40 | Quiz / Review Game Board | Reusable tagged question bank | A bank separate from any one board, tagged by unit, standard, and difficulty, that multiple boards and future game formats draw from. |
| 41 | Vocabulary Flashcard & Word Wall Generator | More printables from one list | Generate a word search, crossword, bingo cards, and a matching quiz from the same term-and-definition list. |
| 42 | School Calendar Visualizer | Unit pacing layer | Lay named units across date ranges, auto-counting actual instructional days after holidays and half days, printable as a pacing calendar. |
| 43 | Math Fact Drill Sheet Generator | Self-checking sheet formats | Riddle-answer, colour-by-answer, and maze transformations of an existing problem set, each with a key. |
| 44 | Field Trip Permission Slip Generator | Scan returned slips to check off | Use `_shared/qr-scan.js` on the QR each slip already carries, so the collection tracker ticks students off in seconds. |
| 45 | Lab Safety Contract Tracker | Scan returned forms | Print a per-student code on each blank contract and tick off a returned stack with `_shared/qr-scan.js` in under a minute. |
| 46 | Sub Plan Builder | Richer document output | Extend the document builder with per-period tables, headers and footers with page numbers, and an embedded seating-chart image. |
| 47 | Rubric Builder | Rubric scores flow to grade tools | A read-only bridge writing rubric totals into Final Grade Checker / Grade Distribution Visualizer's storage contract, mirroring the existing `wpg-rubric-link.js` pattern. |
| 48 | Class Roster Hub | All-rosters device transfer | Move every roster, sidecar record, and archive to another machine over `_shared/webrtc-pair.js` with QR pairing, producing no file to lose or email. |
| 49 | Backup & Restore | Device-to-device migration | Carry the versioned backup envelope straight to a new laptop over `_shared/webrtc-pair.js`, with no file ever written to disk. |
| 50 | Classroom Timer | Phone as timer remote | Extend the existing `webrtc-pair.js` mirror so the paired phone starts, pauses, and advances agenda segments while the teacher walks the room. |
| 51 | Command Center | Phone remote for the dashboard | Pair a phone via `_shared/webrtc-pair.js` to drive five named actions — timer, next student, sign in, advance period — from across the room. |
| 52 | Tournament Bracket & Station Rotation | Real phone-to-laptop remote | Replace the same-device BroadcastChannel remote with `_shared/webrtc-pair.js` LAN pairing, so a phone actually drives the gym display. |
| 53 | Digital Hall Pass / Sign-Out Log | Two-teacher hallway sync | Pair two teachers' boards over `_shared/webrtc-pair.js` so a shared hallway shows one combined out-count and one overtime alert instead of two blind halves. |
| 54 | Name Picker | Equity by seat position | Join the equity report to `seating-chart-v1` so the printed participation summary shows call rates by row and region of the room. |
| 55 | Behavior & Points Tracker | Seating-chart board layout | Arrange the tap targets the way the room actually is, read from `seating-chart-v1`, instead of alphabetically. |
| 56 | Group / Team Generator | Year-long pairing matrix | Retain pair history beyond the current two generations and print a who-has-worked-with-whom grid that drives an "everyone pairs with everyone" grouping mode. |
| 57 | Bracket / Tournament Generator | Pools and Swiss formats | Pools feeding an elimination bracket, plus a Swiss pairing mode, so nobody is eliminated after a single round. |
| 58 | Exit Ticket / Bell Ringer Generator | Bell-ringer sequences | Plan a prompt per day for a week or unit, advanced by date with manual override, mirroring Writing Prompt's Prompt Sets. |
| 59 | Writing Prompt Generator | Teacher-kept writing record | Log which prompt each student wrote to and the teacher's note, printable per student for a conference. |
| 60 | Novel Study / Reading Circles Manager | Multiple books in one project | Four circles reading four different books at four paces, with per-book schedules and one combined meeting-day view. |
| 61 | Digital Escape Room / Puzzle Lock Builder | Printable paper packet | Emit the same puzzle chain as a cut-apart paper packet with a teacher key, so the room runs with no devices at all. |
| 62 | QR Scavenger Hunt Builder | Paper no-device hunt mode | Print clue cards with code words plus a team answer sheet and teacher key, for the day the Chromebooks stayed in the cart. |
| 63 | Gallery Walk QR Codes | Verify the whole batch before printing | Decode every generated code with `_shared/qr-scan.js` and flag any station whose code will not scan reliably, before the ink is spent. |
| 64 | QR Code Generator | Equipment check-out mode | Scan printed asset codes in and out, keeping a local record of which kit is with which group, printable as an inventory sheet. |
| 65 | Lab Group & Role Randomizer | Gate groups on the safety contract | Read `lsct_sections_v1` and flag or exclude students who have not returned a signed lab safety contract. |
| 66 | Number Talks / Mental Math Routine Board | Class strategy wall library | Accumulate the class's own named strategies across the year and print them as wall reference posters. |
| 67 | Image → PDF Assembler | Per-student portfolio PDFs | Group images by student name parsed from filenames and emit one PDF each, delivered as a single archive via the shared JSZip build. |
| 68 | Graph Paper & Number Line Generator | Graphing worksheet mode | A problem printed above each small coordinate plane, plus a matching answer-key sheet with the line or curve already plotted. |
| 69 | Immersion Roleplay Scenario Generator | Speaking assessment layer | Tap a short rubric per pair while circulating, stored per class, printed as a per-student speaking record. |
| 70 | Timeline Builder | Timeline plus map print | Pair events to places and print the timeline along the bottom with a map above, each event pinned to both. |
| 71 | Primary Source Analysis Worksheet Generator | Side-by-side corroboration worksheet | Print two sources on one sheet with shared sourcing questions plus a "where do they disagree" comparison block and answer key. |
| 72 | Prompt Builder | Task-organized prompt library | A browsable built-in library grouped by teaching task — write a rubric, differentiate a text, draft a parent email — each loading a full form state. |
| 73 | Word Doc Merger | Cover page, headers, and page numbers | Generate a title/class/date cover page and inject running headers plus continuous page numbering across the merged document. |
| 74 | Silent Reading (SSR) Log Tracker | Printable parent reading report | One page per student showing books finished, pages, minutes, and streaks this quarter, batch-printed for conferences or mailing. |
| 75 | Grade Distribution Visualizer | Per-question item analysis | Accept per-item scores, chart which questions the class missed most, and print a reteach priority list. |
| 76 | Data Table → Chart Builder | Chart annotation layer | Add arrows, text callouts, and shaded regions on the chart so a printed figure makes an argument rather than just showing a picture. |
| 77 | Vocab & Conjugation Drill Generator | Conjugation pattern engine | Given an infinitive and verb class, generate the full regular table automatically, with irregular overrides only where flagged. |
| 78 | Formula Reference Sheet Builder | Local math notation renderer | A self-contained renderer for fractions, radicals, exponents, subscripts, and Greek letters, so formulas stop being plain text. |
| 79 | Certificate & Award Maker | Templates as data | Move layout, fonts, borders, and colors into template objects so new and teacher-built designs need no code changes. |
| 80 | Sub Binder / Day Bundle Generator | Evergreen emergency binder | A permanently maintained no-notice packet built from date-independent sections only, with a staleness reminder, printed once and left in a drawer. |
| 81 | Blank Map Generator | Choropleth from pasted data | Paste "region, value" rows and shade the vector base map with a grayscale-safe ramp plus an automatic legend. |
| 82 | Art Critique Worksheet Generator | Rubric-scored critique variant | An optional per-step point scale and teacher score column printed alongside the open-ended prompts, with a matching score key. |
| 83 | Student Art Portfolio Label & QR Tag Maker | Bulk photo import | Select an entire folder of images at once, downscale them, and auto-match by filename to existing entries or create new ones. |
| 84 | Book Tasting Menu Generator | Spreadsheet book-list import | Use the shared SheetJS build to import title/author/genre/blurb rows in bulk, with a genre-balance warning on the result. |
| 85 | Government/Civics Simulation Role Card Generator | Per-role case file packets | Attach role-specific evidence, witness facts, or bill text that prints as a companion packet behind each card. |
| 86 | Classroom Label Maker (Target Language) | Teacher-recorded audio fallback | Record pronunciations locally via MediaRecorder and store them, so labels still work when the browser has no target-language voice. |
| 87 | Cognates & False Friends Reference List Builder | Practice worksheet variants | Generate matching, fill-in-the-blank, and "trap or true cognate" quiz handouts with answer keys from the same list. |
| 88 | Cultural Trivia Card Generator | Export into Review Game Board | Emit the selected question set in the Review Game Board's category/points/question/answer format, so a trivia bank becomes a game board. |
| 89 | Current Events Discussion Guide Generator | Two-article comparison guide | Paste two articles on the same event and generate a side-by-side guide with bias and framing contrast questions and a shared vocabulary list. |
| 90 | Daily Editing / DOL Warm-Up Generator | Bulk-import a custom bank | Paste a whole list of broken-and-fixed pairs, tab- or pipe-separated, instead of entering them one at a time. |
| 91 | DBQ / Source Packet Builder | Share a packet by link | Encode the whole packet with `_shared/state-link.js` into a URL, plus a QR, so a department teammate opens the identical packet offline. |
| 92 | Dichotomous Key Builder | Visual branching tree view | Render the couplet list as a branching diagram, printable as a one-page overview alongside the numbered text key. |
| 93 | Duty Roster Builder | Multi-week rotating schedule | Store several weeks, derive week N+1 by shifting each person one duty, and print a whole month's grid at once. |
| 94 | Scientific Method / Experiment Design Planner | Hand off to Lab Report Builder | Encode the plan with `_shared/state-link.js` and open the Lab Report Template Builder pre-filled with question, hypothesis, materials, and procedure. |
| 95 | Fitness & Skill Assessment Tracker | Per-student report cards | A print view of one page per student across all events and dates, with the class average for comparison, for handing home. |
| 96 | Fraction–Decimal–Percent Conversion Drill Generator | Improper, mixed, and negative values | Extend operand generation past 0–1 to improper fractions, mixed numbers, and negatives, widening what the drill can practice. |
| 97 | Geography Bee / Map Skills Quiz Generator | Multiple-choice quiz mode | Auto-generate three distractors from same-category answers, for both the projector display and the printed quiz plus key. |
| 98 | Grammar Mad Libs Generator | Multiple saved custom stories | Named multi-save for custom templates plus their word banks, so several stories coexist rather than one overwriting the last. |
| 99 | Historical Figure / Country Trading Card Maker | Batch-add blank cards from a roster | Paste a name-per-line assignment list to create pre-titled blank cards for a whole class research project in one step. |
| 100 | Lab Report Template Builder | Pre-lab and post-lab packet split | Print a planning packet — hypothesis, materials, procedure — and a separate report packet — data, conclusion — from one saved template. |
| 101 | Math "Find the Mistake" Warm-Up Generator | Bulk import a custom bank | Paste problem/work/fix/explain rows to load a unit's worth of mistake problems at once. |
| 102 | Music Sight-Reading / Rhythm Warm-Up Generator | Metronome and reference pitch | Wire the currently decorative tempo field to a real click track and add a play-through of the generated pitches. |
| 103 | Parent/Guardian Contact Log | Conference print packet | One student's full contact history plus a blank note-taking area, formatted as a single page to hand an administrator before a meeting. |
| 104 | PE Warm-Up Circuit Card Generator | Live circuit rotation timer | A projector mode that counts down each station's duration and signals the rotation, driving the circuit live rather than only printing signage. |
| 105 | Peer Feedback / Editing Checklist Generator | Roster-driven pre-named half-sheets | Read `np_rosters` and print one half-sheet per student with the author's name already filled in. |
| 106 | Picture-Prompt Speaking/Writing Task Generator | Multiple named saved image sets | Named multi-save for image libraries, so a family-vocabulary set and a school-vocabulary set coexist without re-uploading. |
| 107 | Story Elements / Plot Diagram Builder | Share a diagram by link | Encode the diagram with `_shared/state-link.js` so the same novel's diagram moves between class periods or to a teammate's browser. |
| 108 | Science Fair Project Tracker | Multiple named saved trackers | Named multi-save so each class period's science-fair cohort keeps its own roster, milestones, and due dates. |
| 109 | Science Safety Symbol & Equipment Label Maker | Two symbols per label | Let a label carry more than one icon — corrosive plus eye protection — across the edit form, duplicate logic, and printed card. |
| 110 | Staff Directory / Quick-Reference Builder | Wallet-card layout with QR | An alternate lanyard-insert print with a QR per entry encoding a phone or email link. |
| 111 | Sub Note / Feedback Slip Generator | Multiple named saved prompt sets | Named multi-save so a general slip, a lab-day slip, and a testing-day slip stay ready simultaneously. |
| 112 | Testing Accommodations Reference Card Generator | Room-assignment view | Define testing rooms and proctors, auto-route students by accommodation — separate setting, read-aloud — and print per-room proctor lists. |
| 113 | Unit Conversion Reference Chart Builder | Named saves plus reorder and share | Convert the single stored chart to named multi-save, with group and line reordering and a `_shared/state-link.js` share URL. |
| 114 | Verb Conjugation Reference Poster Generator | Irregular verb call-out boxes | An optional side panel per poster listing three to five common irregulars in that tense — regular patterns are only half a wall reference. |
| 115 | Word Problem Warm-Up Generator | Two-step word problems | Chained-operation templates for the upper grade band, the biggest gap for the grades 6–8 audience the tool targets. |

### Currently claimed (in progress elsewhere)

Nothing claimed right now — every row that was here has shipped (or graduated back to the ranked table above).

## Platform-Wide — Big Swings

Cross-cutting infrastructure ideas, not new standalone tools — they'd touch the landing page or several existing
tools at once rather than adding one new `.html` entry point. Same rule as the Blank Map Generator section above:
no `index.html` "coming soon" row for these, since there's no single new tool page to point one at. Ambitious, and
all still within GitHub Pages' static-hosting limits (no server, no accounts, no database) — several lean on
browser APIs the toolkit doesn't use yet.

The original four rows have a phased implementation roadmap in [`PLATFORM_PLAN.md`](PLATFORM_PLAN.md); the rows
below them, added in the 2026-08-11 review pass, do not have one yet. Rows still come off this list only when each
swing actually ships, per "Picking one up" below.

| Idea | What it would do |
|---|---|
| Bulk CSV Roster Import Hub | Upload a full set of class rosters once and have every roster-consuming tool on the site pick them up, instead of pasting the same list into each tool separately. |
| Custom Theme / Branding Pass | Let a school set an accent color and logo once (saved locally) and have it carry across every tool for a school-specific reskin. |
| Voice Command / Speech-to-Text Input | Wire the browser's Web Speech API into compatible tools (calling a name, logging a behavior point) for hands-free operation. |
| Printable "Cheat Sheet" Bundle Export | Combine chosen printable outputs from several tools (seating chart, sub plan, hall pass log) into one exported packet, generalizing the Sub Binder's approach to any tool combination. |
| Dark / Projector Mode Rollout | `_shared/theme.css` and `_shared/theme-toggle.js` are built, tested, and linked by zero of the 81 tools — the only dark mode anyone actually gets is a11y.js's CSS-filter invert. Ship the real toggle across the toolkit, keeping the filter fallback for the paper-preview tools it was written for. |
| Shareable State Links Everywhere | Extend `_shared/state-link.js` (used by 6 of 81 tools) to every builder and generator, so a configured worksheet, rubric, packet, or board reopens from a pasted link or a scanned QR instead of being re-entered by hand. |
| Second-Screen / Device Pairing Rollout | Spend `_shared/webrtc-pair.js` (used by 2 of 81 tools) on the tools that want a projector view driven from a phone — timer, name picker, review game board, station rotation, command center — and on device-to-device transfer of rosters and backups. |
| Uniform Export Layer | jsPDF, SheetJS, and JSZip are all vendored but unevenly spent: give every printing tool a PDF button, every tool holding tabular data a CSV/XLSX export, and every multi-sheet generator a ZIP — so no tool's data is trapped in localStorage. |
| Shared Baseline Adoption Sweep | 17 tools still inline the layout rules `_shared/base.css` now owns, 14 skip `_shared/ink-paper.css`, and 8 skip the `_shared/a11y.*` baseline entirely — with 002, 007, 016, 018, 034, 035, 038 and 044 missing all three. Bring the stragglers onto the shared files. |
| Print Reliability Audit | 58 tools carry hand-written `@media print` blocks and only 16 use `_shared/print-area.css`. Sweep for the clipping bug already found and fixed in the Art Critique generator, where a fixed `height` plus `overflow: hidden` on a print sheet silently cut content off the page. |
| Phone-Sized Layout Pass | Toolbars have outgrown a phone screen: the seating chart's ~15 controls wrap to roughly 380px tall at 375px wide and push the chart about 1050px down the page, which is the repo's one currently-failing test assertion. Cap or collapse oversized toolbars site-wide. |
| First-Run Sample Data | Most tools open to an empty form, so a teacher evaluating one during a prep period sees nothing. Give each a "Load sample data" button that fills a realistic, immediately-printable example, following the models already in the Blank Map Generator and School Calendar Visualizer. |
| Landing-Page Web Fonts Never Shipped | `index.html` and `ideas-backlog.html` declare `@font-face` for five woff2 files under `assets/fonts/` that were never committed to the repo, so both pages silently fall back to system-ui on the live site while every tool page under `Tools/` has its own committed fonts. Either vendor the five files (and precache them) or drop the declarations. |

## Picking one up

When an idea gets built for real:

1. Build it the normal way — one `.html` entry point in `Tools/`, matching subfolder for supporting assets if needed.
2. Remove its row from this file, and from `ideas-backlog.html`.
3. In `index.html`, delete its `.row.soon` placeholder and add a normal `<a class="row ink">` tool row in its place
   (see DEV NOTES item 6 in `index.html` for the exact steps and bookkeeping — record counts, memo/rev dates,
   changelog entry).
4. Add it to the `README.md` tools table.

### Working the ranked Existing Tools list

The "Existing Tools — Enhancement Ideas" table doesn't follow steps 3–4 above (no `index.html` row, no README entry
— it's an improvement to a tool already listed there, not a new one), and it has one extra rule the other sections
don't: **Rank must stay a contiguous 1..N sequence with no gaps and no ties.**

- To pick up a batch, take the N lowest-numbered rows (e.g. "the next 10" = ranks 1–10).
- When a row ships (or is abandoned), delete it from the table in `IDEAS_BACKLOG.md` and `ideas-backlog.html`, then
  renumber every remaining row so the ranks are contiguous again starting at 1 — e.g. if ranks 1–10 just shipped,
  old #11 becomes new #1, old #12 becomes new #2, and so on.
- If you're adding a newly-noticed enhancement idea rather than removing one, insert it at whatever rank reflects
  its priority and bump every row at or below that rank down by one to keep the sequence contiguous.

**Claiming rows to run chats in parallel:** ranks never change when something gets claimed — only when it ships or
is removed. To claim a batch:

1. Pick your batch from the lowest-numbered *unclaimed* rows (skip any row already tagged 🔒 CLAIMED — it doesn't
   count toward your N).
2. Prefix each claimed row's Idea cell with `🔒 **CLAIMED (YYYY-MM-DD)**` (today's date) — e.g.
   `🔒 **CLAIMED (2026-08-10)** — Custom operand ranges` — in both `IDEAS_BACKLOG.md` and `ideas-backlog.html`
   (wrap the idea name in `<span class="claimed">🔒 CLAIMED (YYYY-MM-DD)</span>` there, right before the name text).
3. Push that tagging-only commit to `main` by itself, *before* writing any implementation code, so other sessions
   pull the claim before picking their own batch.
4. When you finish (or abandon) a row, the same commit that removes/renumbers it (per the rule above) removes the
   claim tag with it. If you abandon it without shipping, just strip the tag instead and leave the row at its rank.
5. A claim more than a day or two old with no corresponding commit landed on `main` is stale — safe to treat as
   abandoned and reclaim.
