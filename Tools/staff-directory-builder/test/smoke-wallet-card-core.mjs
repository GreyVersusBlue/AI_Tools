// smoke-wallet-card-core.mjs — which link a wallet or lanyard card's QR opens,
// in pure Node.
//
//   node Tools/staff-directory-builder/test/smoke-wallet-card-core.mjs
//
// A phone that scans a lanyard card DOES what the code says, so wallet-card.js
// must hand back exactly one tel: or mailto: URI, and nothing when it is not
// sure: an extension typed "4214 / 4215" is two numbers, an address with a
// ? or & in it is a typo. This suite pins that, the sheet-versus-person choice,
// the sentence the editor shows, and the card sizes. WALLET_CARD_FILE points it
// at another copy of the module (the deliberate-break runs use it). Every name
// and number is invented (555-01xx, example.org). Exits 1 on any failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.WALLET_CARD_FILE || path.join(here, '..', 'wallet-card.js');
await import(pathToFileURL(file).href);
const C = globalThis.StaffCards;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Wallet cards — links, choice, sizes');

/* 1. telUri */
eq(C.telUri('4214'), 'tel:4214', 'a plain extension');
eq(C.telUri(' 4214 '), 'tel:4214', 'outer spaces go');
eq(C.telUri('x4214'), 'tel:4214', 'a leading x goes');
eq(C.telUri('Ext. 4214'), 'tel:4214', 'a leading "Ext." goes');
eq(C.telUri('ext 4214'), 'tel:4214', 'a leading "ext" goes, any case');
eq(C.telUri('(555) 010-0142'), 'tel:5550100142', 'brackets, spaces and dashes inside one number go');
eq(C.telUri('+1 555 0142'), 'tel:+15550142', 'a leading + stays');
eq(C.telUri('555.0142'), 'tel:5550142', 'dots go');
eq(C.telUri('4214 / 4215'), null, 'two numbers are not one number');
eq(C.telUri('4214, 4215'), null, 'a comma list is not one number');
eq(C.telUri('4214 or 4215'), null, 'words between numbers');
eq(C.telUri('main office'), null, 'no digits');
eq(C.telUri(''), null, 'empty');
eq(C.telUri('7'), null, 'one digit is not an extension');
eq(C.telUri('1234567890123456'), null, 'more than 15 digits');
eq(C.telUri('12+34'), null, 'a + inside the number');
eq(C.telUri(null), null, 'null');
eq(C.telUri('42*14'), null, 'a star inside is refused');

/* 2. mailUri */
eq(C.mailUri('mruiz@example.org'), 'mailto:mruiz@example.org', 'a plain address');
eq(C.mailUri(' mruiz@example.org '), 'mailto:mruiz@example.org', 'outer spaces go');
eq(C.mailUri("o'brien@example.org"), "mailto:o'brien@example.org", 'an apostrophe is a legal address character');
eq(C.mailUri('a.b+tag@mail.example.org'), 'mailto:a.b+tag@mail.example.org', 'a plus tag and a subdomain');
for (const bad of ['', 'mruiz', 'mruiz@', '@example.org', 'mruiz@example', 'a b@example.org', 'a@b@example.org',
  'a?subject=x@example.org', 'a@example.org?cc=b@example.org', 'a&b@example.org', 'a#b@example.org', 'a%40b@example.org',
  'a=b@example.org', 'a,b@example.org', 'a;b@example.org', '<a@example.org>', 'a@example..org', '.a@example.org',
  'a.@example.org', 'a@.example.org', 'a@example.org.', 'a@exam/ple.org', '"a"@example.org', 'a@example.org b@example.org']) {
  eq(C.mailUri(bad), null, 'refused: ' + JSON.stringify(bad));
}
eq(C.mailUri('a'.repeat(115) + '@example.org'), null, 'longer than 120 characters');
eq(C.mailUri(undefined), null, 'undefined');
eq(C.mailUri('a?b@example.org'), null, 'a ? alone is refused');
eq(C.mailUri('MRuiz@Example.org'), 'mailto:MRuiz@Example.org', 'case is kept as typed');

/* 3. resolve: the sheet's rule */
const both = { ext: '4214', email: 'mruiz@example.org' };
const onlyTel = { ext: '4214' }, onlyMail = { email: 'mruiz@example.org' }, neither = {};
const R = (p, m) => C.resolve(p, m);
eq(R(both, 'mail-else-tel').uri, 'mailto:mruiz@example.org', 'mail-else-tel with both: the email');
eq(R(both, 'tel-else-mail').uri, 'tel:4214', 'tel-else-mail with both: the extension');
eq(R(onlyTel, 'mail-else-tel').uri, 'tel:4214', 'mail-else-tel with only an extension falls to it');
eq(R(onlyMail, 'tel-else-mail').uri, 'mailto:mruiz@example.org', 'tel-else-mail with only an email falls to it');
eq(R(both, 'mail').kind, 'mail', 'mail only: kind mail');
eq(R(both, 'tel').kind, 'tel', 'tel only: kind tel');
eq(R(onlyTel, 'mail').kind, null, 'mail only with no email: no QR');
eq(R(onlyMail, 'tel').kind, null, 'tel only with no extension: no QR');
eq(R(both, 'none').kind, null, 'none: no QR');
eq(R(both, 'bogus').uri, 'mailto:mruiz@example.org', 'an unknown sheet mode is the default, mail-else-tel');
eq(R(both, undefined).uri, 'mailto:mruiz@example.org', 'no sheet mode is the default');
eq(R(neither, 'mail-else-tel').kind, null, 'nothing to link: no QR');
eq(R({ ext: '4214 / 4215', email: 'nope' }, 'mail-else-tel').kind, null, 'two unusable fields: no QR');
eq(R({ ext: '4214 / 4215', email: 'mruiz@example.org' }, 'tel-else-mail').uri, 'mailto:mruiz@example.org',
   'an unusable extension falls through to a usable email, never to half an extension');

/* 4. resolve: a person's own choice beats the sheet */
eq(R({ ...both, qr: 'tel' }, 'mail').uri, 'tel:4214', 'a person set to tel, on a mail-only sheet');
eq(R({ ...both, qr: 'mail' }, 'tel').uri, 'mailto:mruiz@example.org', 'a person set to mail, on a tel-only sheet');
eq(R({ ...both, qr: 'none' }, 'mail-else-tel').kind, null, 'a person set to none, on a sheet that would give one');
eq(R({ ...both, qr: '' }, 'tel').uri, 'tel:4214', 'an empty choice follows the sheet');
eq(R({ ...both, qr: 'nonsense' }, 'tel').uri, 'tel:4214', 'an unknown choice follows the sheet');
eq(R({ ext: '4214', qr: 'mail' }, 'tel').kind, null, 'a person set to mail with no email does not fall back to tel');

/* 5. the editor's sentence, and why */
eq(R(both, 'mail-else-tel').note, 'QR opens mailto:mruiz@example.org', 'the note names the exact link');
eq(R(onlyTel, 'tel').note, 'QR opens tel:4214', 'the note for a call');
eq(R(neither, 'mail-else-tel').note, 'No QR: no extension or email listed', 'nothing listed');
eq(R({ ext: 'a/b' }, 'tel').note, 'No QR: the extension is not a single number', 'a bad extension is named');
eq(R({ email: 'x' }, 'mail').note, 'No QR: the email address is not usable', 'a bad email is named');
eq(R(neither, 'tel').note, 'No QR: no extension listed', 'tel only, no extension');
eq(R(neither, 'mail').note, 'No QR: no email listed', 'mail only, no email');
eq(R({ ext: 'a/b', email: 'x' }, 'mail-else-tel').note, 'No QR: neither the extension nor the email is usable', 'both bad');
eq(R({ ext: 'a/b' }, 'mail-else-tel').note, 'No QR: the extension is not a single number', 'a bad extension and no email: the extension is named, on a sheet that tries both');
eq(R({ email: 'x' }, 'tel-else-mail').note, 'No QR: the email address is not usable', 'a bad email and no extension: the email is named');
eq(R(both, 'none').note, 'No QR: the sheet is set to no QR codes', 'sheet none');
eq(R({ ...both, qr: 'none' }, 'tel').note, 'No QR: set to none for this person', 'person none');
eq(R(neither, 'none').uri, '', 'no link means an empty uri');
ok(!/^QR/.test(R(neither, 'tel').note), 'a no-QR note never starts "QR opens"');

/* 6. captions */
eq(C.caption('tel', { ext: 'x4214' }), 'Scan to call ext. 4214', 'call caption drops the x');
eq(C.caption('tel', { ext: '' }), 'Scan to call', 'call caption with no extension text');
eq(C.caption('mail', {}), 'Scan to email', 'email caption');
eq(C.caption(null, {}), '', 'no kind, no caption');

/* 7. sizes: CR80, two ways up, and the room for the code */
const w = C.SIZES.wallet, l = C.SIZES.lanyard;
eq(w.w + 'x' + w.h, '3.375x2.125', 'wallet is CR80 on its side');
eq(l.w + 'x' + l.h, '2.125x3.375', 'lanyard is CR80 upright');
eq(w.qrPx, 148, 'wallet code room: 1.55 in = 148 px');
eq(l.qrPx, 177, 'lanyard code room: 1.85 in = 177 px');
eq(w.cols * w.w <= 7.75 && 4 * w.h <= 10.25 && w.perPage === 8, true, 'eight wallet cards fit inside a Letter page with a 0.375 in margin');
eq(l.cols * l.w <= 7.75 && 3 * l.h <= 10.25 && l.perPage === 9, true, 'nine lanyard cards fit inside a Letter page with a 0.375 in margin');
ok(w.qrPx >= 37 * 4, 'wallet room holds a version 3 code (37 modules with its quiet zone) at the 4 px floor');
ok(l.qrPx >= 41 * 4, 'lanyard room holds a version 4 code (41 modules with its quiet zone) at the 4 px floor');
eq(Object.keys(C.SIZES).join(), 'wallet,lanyard', 'two sizes');
eq(C.SIZES.wallet.key + C.SIZES.lanyard.key, 'walletlanyard', 'each size carries its key');

/* 8. names and pages */
eq(C.nameStep('Ana Ruiz'), 0, 'a short name is the largest step');
eq(C.nameStep('x'.repeat(18)), 0, '18 characters is still the largest');
eq(C.nameStep('x'.repeat(19)), 1, '19 steps down');
eq(C.nameStep('x'.repeat(30)), 1, '30 is still step 1');
eq(C.nameStep('x'.repeat(31)), 2, '31 steps down again');
eq(JSON.stringify(C.pages([1, 2, 3, 4, 5], 2)), '[[1,2],[3,4],[5]]', 'pages of two');
eq(C.pages([], 8).length, 0, 'no cards, no pages');
eq(C.pages([1, 2, 3], 'x').length, 3, 'a bad page size is one to a page, not a hang');
eq(C.validSheetMode('tel'), 'tel', 'a known sheet mode');
eq(C.validSheetMode('zzz'), 'mail-else-tel', 'an unknown sheet mode');
eq(C.validPersonMode('mail'), 'mail', 'a known person mode');
eq(C.validPersonMode('zzz'), '', 'an unknown person mode');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
