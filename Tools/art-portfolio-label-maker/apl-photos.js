/* Art Portfolio Label Maker — matching a folder of photos to entries (Path rank 82).
   Pure functions, no DOM, no storage. The page reads and downsizes the files; this decides which
   entry each photo belongs to, and the teacher sees that plan and can change it before anything
   is stored.

     plan(files, entries, opts) -> [{ index, name, entryId|null, how: 'name'|'order'|'none' }]

   `files` is [{ name }] in the order the browser gave them; `entries` is [{ id, title, artist, image }].
   A photo matches an entry by filename when the entry's artist (or, failing that, its title) is the
   photo's name, or every word of it is a word of the photo's name ("ava_r_self-portrait.jpg" for the
   artist "Ava R."); a match must be the single best one (artist and title both in the name beat either alone) and each entry takes one photo.
   With opts.fillInOrder, photos still unmatched go, in filename order, to entries still without a photo.
   An entry that already has a photo is left alone unless opts.replace. */
(function (global) {
  'use strict';

  var MAX_FILES = 60;
  var IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif)$/i;

  function fold(s) {
    var t = String(s == null ? '' : s);
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.toLowerCase();
  }

  /* words(s): lower-case words, accents and punctuation gone. */
  function words(s) {
    return fold(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  }

  /* baseName(file): the file name without folder, extension, camera counters in brackets or a copy suffix. */
  function baseName(name) {
    var n = String(name == null ? '' : name).replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]{2,5}$/, '');
    return n.replace(/\s*\((\d+)\)\s*$/, '').replace(/[ _-]+copy$/i, '');
  }

  /* looksLikeImage(file): true for an image by type or, when the browser gave no type, by extension. */
  function looksLikeImage(f) {
    if (!f) return false;
    if (f.type) return /^image\//.test(f.type);
    return IMAGE_EXT.test(String(f.name || ''));
  }

  function naturalCompare(a, b) {
    return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
  }

  /* score(fileWords, key): 0 for no match; 3 when the words are the same, 2 when the file's words begin with the key's, 1 when they hold all of them. */
  function score(fw, kw) {
    if (!kw.length || !fw.length) return 0;
    if (fw.length === kw.length && fw.every(function (w, i) { return w === kw[i]; })) return 3;
    var all = kw.every(function (w) { return fw.indexOf(w) !== -1; });
    if (!all) return 0;
    var starts = kw.every(function (w, i) { return fw[i] === w; });
    return starts ? 2 : 1;
  }

  function entryKeys(e) {
    var a = words(e && e.artist), t = words(e && e.title);
    return a.length ? [a, t] : [t];
  }

  function plan(files, entries, opts) {
    opts = opts || {};
    files = Array.isArray(files) ? files.slice(0, MAX_FILES) : [];
    entries = Array.isArray(entries) ? entries : [];
    var order = files.map(function (f, i) { return i; })
      .sort(function (a, b) { return naturalCompare(files[a].name, files[b].name) || a - b; });
    var out = files.map(function (f, i) { return { index: i, name: f.name, entryId: null, how: 'none' }; });
    var taken = {};
    var free = entries.filter(function (e) { return e && e.id && (opts.replace || !e.image); });

    // By name: a file takes an entry only when that entry is its one best candidate.
    order.forEach(function (i) {
      var fw = words(baseName(files[i].name));
      var best = 0, bestIds = [];
      free.forEach(function (e) {
        if (taken[e.id]) return;
        var s = 0;
        entryKeys(e).forEach(function (kw) { s += score(fw, kw); });   // artist and title both in the name beat one
        if (s > best) { best = s; bestIds = [e.id]; } else if (s === best && s > 0) bestIds.push(e.id);
      });
      if (best > 0 && bestIds.length === 1) {
        out[i].entryId = bestIds[0]; out[i].how = 'name'; taken[bestIds[0]] = true;
      }
    });

    // Then, if asked, the rest in order.
    if (opts.fillInOrder) {
      var rest = free.filter(function (e) { return !taken[e.id]; });
      var k = 0;
      order.forEach(function (i) {
        if (out[i].entryId || k >= rest.length) return;
        out[i].entryId = rest[k].id; out[i].how = 'order'; taken[rest[k].id] = true; k++;
      });
    }
    return out;
  }

  /* titleFromName(name): a new entry's title from a photo's file name. */
  function titleFromName(name) {
    var w = baseName(name).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return w.slice(0, 80);
  }

  /* fitWithin(w, h, max): the size to draw a w x h photo at so its longer side is at most max. */
  function fitWithin(w, h, max) {
    if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
    var s = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  }

  global.PortfolioPhotos = {
    MAX_FILES: MAX_FILES, plan: plan, words: words, baseName: baseName, looksLikeImage: looksLikeImage,
    titleFromName: titleFromName, fitWithin: fitWithin, naturalCompare: naturalCompare
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
