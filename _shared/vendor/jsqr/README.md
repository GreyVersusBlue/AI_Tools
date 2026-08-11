# jsQR — vendored

| | |
| --- | --- |
| Library | jsQR (QR code *decoder*) |
| Version | not recorded — see below |
| File | `jsqr.js`, 256,723 bytes |
| SHA-256 | `3325b0888fa4745c4e6940897d8c4f426fbaae76901fcbfe1871a04e90a51655` |
| Licence | Apache-2.0 (`LICENSE-jsqr.txt` in this folder) |
| Upstream | https://github.com/cozmo/jsQR |

**On the version:** this is the webpack UMD build, and jsQR does not stamp a
version string anywhere in it — `grep` finds nothing, and there is no
`sourceMappingURL` or banner comment either. The SHA-256 above is the identity
of record. If you replace this file, note where you got it so the next person
has more to go on than a hash.

Phase 1 found four copies of this file across the site. Three were 266,822
bytes and one was 256,723; the plan's audit table read that as one older build.
It isn't — the 10,099-byte gap is exactly the CRLF line endings on the three
larger copies. Normalize the line endings and all four have the same digest.
This is the LF copy.

Not to be confused with `qrcode.js` (a QR *encoder*, MIT, Kazuhiko Arase),
which several tools still keep in their own `lib/` folders and which is a
separate consolidation job — see `REFACTOR_PLAN.md`.

## Consumers

| File | Tag |
| --- | --- |
| `Tools/004-Classroom Timer.html` | `<script src="../_shared/vendor/jsqr/jsqr.js">` |
| `Tools/016-qr-code-generator.html` | `<script src="../_shared/vendor/jsqr/jsqr.js">` |
| `Tools/035-schedule-visualizer.html` | `<script src="../_shared/vendor/jsqr/jsqr.js" defer>` |
| `Tools/classroom-timer/mirror.html` | `<script src="../../_shared/vendor/jsqr/jsqr.js">` |
| `Tools/escape-room-builder/monitor.html` | `<script src="../../_shared/vendor/jsqr/jsqr.js">` |

Note the two different relative depths: the numbered tool pages sit in `Tools/`,
the companion pages sit one level further down in their tool's folder.

`_shared/qr-scan.js` is the shared camera/scan-loop wrapper that sits on top of
this library.

## Updating

Replace the file, update the size and hash above, and test an actual scan with a
real camera in at least one consumer — this is the one library here whose
failure mode (decodes nothing, silently) doesn't show up in any automated test
on this site.
