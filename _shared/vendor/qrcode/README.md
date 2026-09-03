# qrcode.js — vendored

| | |
| --- | --- |
| Library | `qrcode.js` (QR code *encoder*) |
| Version | not recorded — see below |
| File | `qrcode.js`, 56,963 bytes |
| SHA-256 | `bdee8deb723d3b76015ecaefb974a0a438fe8889280914a06b60d755bcaa2909` |
| Licence | MIT (`LICENSE.txt` in this folder) |
| Copyright | 2009 Kazuhiko Arase |
| Upstream | http://www.d-project.com/ (mirrored at https://github.com/kazuhikoarase/qrcode-generator) |

**On the version:** the file header identifies the library and author but does
not stamp a version number, and there is no `package.json` or banner comment
with one either. The SHA-256 above is the identity of record. If you replace
this file, note where you got it so the next person has more to go on than a
hash.

**Not to be confused with `_shared/vendor/jsqr/` (jsQR), the QR code
*decoder*.** This library only draws QR codes; it cannot read them back. The
two are easy to mix up by name — `_shared/qr-scan.js` (the shared
camera/scan-loop wrapper) sits on top of jsQR, not this file.

The vendored-library consolidation (`HISTORY.md`) found and fixed the same duplication problem for
jsPDF/SheetJS/jsQR but left this library and JSZip as a follow-up ("Phase 1b").
This round did that follow-up: 14 identical per-tool `lib/qrcode.js` copies
(verified byte-identical after normalizing CRLF→LF) were consolidated into this
one file.

## Consumers

| File | Tag |
| --- | --- |
| `Tools/004-Classroom Timer.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/006-class-roster-hub.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/007-Name Picker.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/013-lab-safety-contract-tracker.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/016-qr-code-generator.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/017-gallery-walk-qr.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/018-qr-scavenger-hunt-builder.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/019-escape-room-builder.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/020-bracket-tournament-generator.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/023-exit-ticket-generator.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/035-schedule-visualizer.html` | `<script src="../_shared/vendor/qrcode/qrcode.js" defer>` |
| `Tools/042-certificate-award-maker.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/043-field-trip-permission-slip.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/048-art-portfolio-label-maker.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/051-classroom-label-maker.html` | `<script src="../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/classroom-timer/mirror.html` | `<script src="../../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/escape-room-builder/lock.html` | `<script src="../../_shared/vendor/qrcode/qrcode.js">` |
| `Tools/escape-room-builder/monitor.html` | `<script src="../../_shared/vendor/qrcode/qrcode.js">` |

Note the two different relative depths: the numbered tool pages sit in `Tools/`,
the companion pages sit one level further down in their tool's folder.

## Updating

Replace `qrcode.js`, update the size and hash above, and smoke-test QR
rendering in at least one consumer (type text, confirm a scannable code
draws) — there is no automated test for this on the site.
