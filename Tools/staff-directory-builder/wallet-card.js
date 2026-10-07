/* wallet-card.js — what goes on 075's wallet and lanyard cards, and which link
   the QR on each one opens. A plain script that publishes one global,
   `StaffCards`, so the page can call it and a pure-Node suite can import it.

   Nothing here touches the page or draws anything. The page owns the DOM and
   _shared/qr-draw.js owns the code; this file owns the three decisions that
   have to be right and are easy to get wrong:

     The link. A QR on a lanyard is scanned by a phone that then DOES what the
     code says, so the text must be exactly one `tel:` or `mailto:` URI and
     nothing else. telUri() and mailUri() return the URI or null, and null
     is the answer for anything they are not sure of: an extension typed
     "4214 / 4215" is two numbers, and gluing them into one would send somebody
     to the wrong phone. An address with a character that has a meaning inside
     a mailto: URI (? & # % =) is refused rather than escaped, because a
     staff address with one of those in it is a typo far more often than an
     address.

     The choice. resolve() says which link a person's card carries, from the
     sheet's setting and the person's own: a person set to "tel", "mail" or
     "none" ignores the sheet; "follow the sheet" takes the sheet's rule. It
     also returns the sentence the EDITOR shows beside that person ("QR opens
     mailto:…", "No QR: no extension or email listed") — an entry with nothing
     to link gets no QR and says why in the editor, never on the card.

     The size. SIZES holds the two card shapes. Both are the CR80 card (the
     3.375 x 2.125 in ID-card size that lanyard holders, badge reels and wallet
     pouches are all made for), the wallet card on its side and the lanyard card
     upright, so one laminating pouch fits either. `qrPx` is the room the code
     gets in CSS px; the page asks qr-draw.js for the biggest whole-pixel module
     that fits it, and qr-draw.js refuses anything under its own 4 px floor.

   The numbers were not guessed: Tools/staff-directory-builder/test/
   smoke-wallet-cards.mjs draws every card, reads the canvas back and decodes
   it with the vendored jsQR. */
(function (global) {
  'use strict';

  var PX_PER_IN = 96;

  /* in: the card's printed size. cols / perPage: how many go on a Letter or A4
     page inside a 0.375 in margin. qr: the room for the code in inches, which
     becomes qrPx. The wallet card's 1.55 in is the most that leaves the text
     column a usable width on a 2.125 in card, and takes a code up to version 3
     (an address of up to 48 characters) at the 4 px floor; the lanyard card's
     1.85 in takes version 4 (up to 73). */
  var SIZES = {
    wallet: {
      label: 'Wallet card, 3.375 × 2.125 in (credit-card size, landscape)',
      short: 'wallet',
      w: 3.375, h: 2.125, cols: 2, perPage: 8, qr: 1.55
    },
    lanyard: {
      label: 'Lanyard card, 2.125 × 3.375 in (ID-badge size, upright)',
      short: 'lanyard',
      w: 2.125, h: 3.375, cols: 3, perPage: 9, qr: 1.85
    }
  };
  Object.keys(SIZES).forEach(function (k) {
    SIZES[k].key = k;
    SIZES[k].qrPx = Math.floor(SIZES[k].qr * PX_PER_IN);
  });

  var SHEET_MODES = {
    'mail-else-tel': 'Email, or the extension if there is no email',
    'tel-else-mail': 'The extension, or the email if there is no extension',
    'mail': 'Email only',
    'tel': 'Extension only',
    'none': 'No QR codes'
  };
  var PERSON_MODES = { '': 'Follow the sheet', 'tel': 'Call the extension', 'mail': 'Email', 'none': 'No QR' };

  function text(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  /** 'tel:4214' for an extension that is one number, else null. A leading
      "ext." or "x" is dropped; spaces, dots, dashes and brackets inside the
      number are dropped; a leading + is kept. Anything else (a slash, a
      comma, letters, two numbers) is not one number, so it is null. */
  function telUri(ext) {
    var s = text(ext).replace(/^(ext\.?|x)\s*/i, '');
    if (!/^\+?\(?[0-9][0-9 ().\-]*$/.test(s)) return null;
    var digits = s.replace(/[^0-9+]/g, '');
    var count = digits.replace(/\+/g, '').length;
    if (count < 2 || count > 15) return null;
    return 'tel:' + digits;
  }

  /** 'mailto:name@host.tld' for a plain address, else null. */
  function mailUri(email) {
    var s = text(email);
    if (!s || s.length > 120) return null;
    var bad = '[^\\s@<>()\\[\\]\\\\,;:"%?#&=/]';
    if (!new RegExp('^' + bad + '+@' + bad + '+\\.' + bad + '+$').test(s)) return null;
    if (/\.\./.test(s) || /^\.|\.@|@\.|\.$/.test(s)) return null;
    return 'mailto:' + s;
  }

  function validSheetMode(m) { return Object.prototype.hasOwnProperty.call(SHEET_MODES, m) ? m : 'mail-else-tel'; }
  function validPersonMode(m) { return m === 'tel' || m === 'mail' || m === 'none' ? m : ''; }

  /** Which link this person's card carries.
      Returns { kind: 'tel' | 'mail' | null, uri, note, why } where `note` is
      the sentence the editor shows and `why` is '' or the reason there is no
      code. `uri` is the exact text to encode. */
  function resolve(person, sheetMode) {
    person = person || {};
    var own = validPersonMode(person.qr);
    var mode = own || validSheetMode(sheetMode);
    var tel = telUri(person.ext), mail = mailUri(person.email);
    var haveExt = !!text(person.ext), haveMail = !!text(person.email);

    function got(kind, uri) {
      return { kind: kind, uri: uri, why: '', note: 'QR opens ' + uri };
    }
    function none(why) {
      return { kind: null, uri: '', why: why, note: 'No QR: ' + why };
    }
    function whyNot(kind) {
      if (kind === 'tel') {
        return haveExt ? 'the extension is not a single number' : 'no extension listed';
      }
      return haveMail ? 'the email address is not usable' : 'no email listed';
    }

    if (mode === 'none') return none(own ? 'set to none for this person' : 'the sheet is set to no QR codes');
    if (mode === 'tel') return tel ? got('tel', tel) : none(whyNot('tel'));
    if (mode === 'mail') return mail ? got('mail', mail) : none(whyNot('mail'));
    var first = mode === 'tel-else-mail' ? 'tel' : 'mail';
    var second = first === 'tel' ? 'mail' : 'tel';
    var uris = { tel: tel, mail: mail };
    if (uris[first]) return got(first, uris[first]);
    if (uris[second]) return got(second, uris[second]);
    if (!haveExt && !haveMail) return none('no extension or email listed');
    if (haveExt && !haveMail) return none(whyNot('tel'));
    if (haveMail && !haveExt) return none(whyNot('mail'));
    return none('neither the extension nor the email is usable');
  }

  /** What a code opens, said in words for the caption under it. */
  function caption(kind, person) {
    if (kind === 'tel') return 'Scan to call' + (text(person && person.ext) ? ' ext. ' + text(person.ext).replace(/^(ext\.?|x)\s*/i, '') : '');
    if (kind === 'mail') return 'Scan to email';
    return '';
  }

  /** The name's size step, by length, so a long name wraps inside the card
      instead of running past it: 0 (the largest) to 2. */
  function nameStep(name) {
    var n = text(name).length;
    return n <= 18 ? 0 : (n <= 30 ? 1 : 2);
  }

  /** Splits cards into pages of `perPage`. */
  function pages(items, perPage) {
    var size = Math.floor(Number(perPage));
    if (!(size >= 1)) size = 1;
    var out = [];
    for (var i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  global.StaffCards = {
    PX_PER_IN: PX_PER_IN,
    SIZES: SIZES,
    SHEET_MODES: SHEET_MODES,
    PERSON_MODES: PERSON_MODES,
    telUri: telUri,
    mailUri: mailUri,
    validSheetMode: validSheetMode,
    validPersonMode: validPersonMode,
    resolve: resolve,
    caption: caption,
    nameStep: nameStep,
    pages: pages
  };
})(typeof window !== 'undefined' ? window : globalThis);
