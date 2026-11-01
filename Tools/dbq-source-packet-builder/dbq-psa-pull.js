/* dbq-psa-pull.js — reading 028's source library for 056 DBQ / Source Packet
   Builder. A plain script that publishes one global, `DbqPsaPull`, so the page
   can call it and a pure-Node suite can import it.

   The pairing shipped in one direction first: a text source in 056 becomes a
   SOAPSTone worksheet in 028. This is the other direction. A source a teacher
   saved in 028's library (`gvb-primary-source:library`, entries of { id,
   title, type, description, text, imageDataUrl, citationAuthor, citationDate,
   citationOrigin, tags, savedAt }) can be added to a packet here.

   READ-ONLY. Nothing here, and nothing the page does with it, writes 028's
   key: adding a source to a packet copies it, and the original stays in 028's
   library. The page owns the localStorage read and the image copy (028's
   images are `idb:` references into the `psa` namespace of the shared media
   store; a packet's are in `dbq`, so the bytes are copied, not shared).

   Everything arriving from that key is untrusted shape: a value that is not
   the expected type is dropped, an image is kept only as an `idb:` reference
   or an inline image data URL, and text stays text (the page escapes it). */
(function (global) {
  'use strict';

  var REF = /^idb:[A-Za-z0-9_-]{1,40}$/;
  var LIMIT = 500;

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 20000) : ''; }

  function cleanImage(v) {
    if (typeof v !== 'string') return '';
    if (REF.test(v)) return v;
    if (v.slice(0, 11) === 'data:image/') return v;
    return '';
  }

  /** The stored string to a list of entries 056 can show. Unreadable is empty. */
  function read(raw) {
    var list;
    try { list = JSON.parse(raw || '[]'); } catch (e) { return []; }
    if (!Array.isArray(list)) return [];
    var seen = {}, out = [];
    list.forEach(function (e, i) {
      if (!e || typeof e !== 'object' || out.length >= LIMIT) return;
      var entry = {
        id: str(e.id, 80) || ('psa' + i),
        title: str(e.title, 300).trim(),
        type: str(e.type, 40),
        description: str(e.description, 4000).trim(),
        text: str(e.text, 20000),
        image: cleanImage(e.imageDataUrl),
        author: str(e.citationAuthor, 200).trim(),
        date: str(e.citationDate, 100).trim(),
        origin: str(e.citationOrigin, 300).trim(),
        tags: (Array.isArray(e.tags) ? e.tags : []).filter(function (t) { return typeof t === 'string' && t.trim(); }).map(function (t) { return t.trim().slice(0, 60); }).slice(0, 20),
        savedAt: str(e.savedAt, 40)
      };
      if (seen[entry.id]) return;
      seen[entry.id] = 1;
      if (!entry.title && !entry.text.trim() && !entry.description && !entry.image && !entry.author && !entry.origin) return;
      out.push(entry);
    });
    return out;
  }

  /** "Author, Origin, Date": the parts that exist, in that order. */
  function citationOf(entry) {
    return [entry.author, entry.origin, entry.date].filter(Boolean).join(', ');
  }

  function label(entry) {
    if (entry.title) return entry.title;
    var c = citationOf(entry);
    if (c) return c;
    var body = (entry.text.trim() || entry.description);
    return body ? body.slice(0, 40) + (body.length > 40 ? '…' : '') : 'Untitled source';
  }

  function matches(entry, filter) {
    var f = String(filter || '').trim().toLowerCase();
    if (!f) return true;
    return [entry.title, citationOf(entry), entry.description, entry.tags.join(' ')].join(' ').toLowerCase().indexOf(f) !== -1;
  }

  /** The fields of a new packet source for an entry. `image` is left null:
      the page copies the picture's bytes and sets it. */
  function toSource(entry, id, questionId) {
    var isImage = !!entry.image;
    return {
      id: id,
      bankId: null,
      title: entry.title,
      type: isImage ? 'image' : 'text',
      /* A text source takes the document's text, or the description when
         there is none; a picture's description has no place in a packet. */
      text: isImage ? '' : (entry.text.trim() ? entry.text : entry.description),
      image: null,
      imgW: 0, imgH: 0,
      crop: { x: 0, y: 0, w: 1, h: 1 },
      widthPct: 100,
      citation: citationOf(entry),
      questions: [{ id: questionId, text: '' }]
    };
  }

  global.DbqPsaPull = {
    KEY: 'gvb-primary-source:library',
    read: read, citationOf: citationOf, label: label, matches: matches, toSource: toSource, cleanImage: cleanImage
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
