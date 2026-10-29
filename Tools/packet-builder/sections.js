/* sections.js — the section-provider registry behind 090 Packet Builder
   (Path 10 P1; the design is the P1 bullet in BACKLOG.md).
   Publishes window.PacketSections. Pure: nothing here reads storage, the
   clock or the DOM. The page hands every provider a context,
     ctx = { read(key) -> parsed JSON | undefined, todayISO, SchoolDay }
   and a provider answers with data, never markup:
     { id, title, sourceSlug, setupHint, storageKeys,
       evaluate(ctx) -> { available, status },
       build(ctx, opts) -> { pages: [{ title, blocks }] } }
   A block is one of h, p, kv, table, list, note, html (see BLOCK_TYPES).
   Text in every block but `html` is escaped by toHtml(), the one place text
   becomes markup. `html` carries markup a source tool already builds and
   escapes itself (seating's buildPrintPage); a provider that uses it owns that.

   A provider never throws at the page: evaluate() that throws is "unavailable",
   build() that throws puts the section in `skipped`. A key that is missing or
   broken reads as undefined, which every provider treats as "nothing saved".

   `storageKeys` is the schema contract. 090's row in _shared/tool-registry.js
   carries the union as `reads`, and Tools/packet-builder/test/sections.test.mjs
   fails when the two disagree.

   Presets: gvb-packet:presets.v1 = { v: 1, presets: [{ name, ids }] } and the
   open layout gvb-packet:layout.v1 = { v: 1, ids }; the order of `ids` is the
   packet's order. Only ids are stored, never a section's content. */
(function (root) {
  'use strict';

  var BLOCK_TYPES = ['h', 'p', 'kv', 'table', 'list', 'note', 'html'];
  var MAX_TEXT = 4000;
  var MAX_ROWS = 400;
  var MAX_PRESETS = 30;
  var MAX_NAME = 60;
  var LAYOUT_KEY = 'gvb-packet:layout.v1';
  var PRESETS_KEY = 'gvb-packet:presets.v1';
  var ID_RE = /^[a-z][a-z0-9-]{0,39}$/;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v) { return typeof v === 'string' ? v.slice(0, MAX_TEXT) : (typeof v === 'number' && isFinite(v) ? String(v) : ''); }
  function strs(a) { return Array.isArray(a) ? a.slice(0, MAX_ROWS).map(str) : []; }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* One block, cleaned to the shape toHtml draws, or null when it is not one. */
  function cleanBlock(b) {
    if (!isObj(b) || BLOCK_TYPES.indexOf(b.type) < 0) return null;
    var t = b.type;
    if (t === 'h') return { type: 'h', text: str(b.text), level: b.level === 3 ? 3 : 2 };
    if (t === 'p' || t === 'note') return { type: t, text: str(b.text) };
    if (t === 'html') return { type: 'html', html: typeof b.html === 'string' ? b.html : '' };
    if (t === 'list') return { type: 'list', items: strs(b.items) };
    if (t === 'kv') {
      var rows = Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS) : [];
      return { type: 'kv', rows: rows.map(function (r) { return Array.isArray(r) ? [str(r[0]), str(r[1])] : ['', '']; }) };
    }
    var head = strs(b.head);
    var body = Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS).map(strs) : [];
    return { type: 'table', head: head, rows: body };
  }

  function cleanPages(pages) {
    if (!Array.isArray(pages)) return [];
    return pages.map(function (p) {
      var blocks = isObj(p) && Array.isArray(p.blocks) ? p.blocks.map(cleanBlock).filter(Boolean) : [];
      return { title: isObj(p) ? str(p.title) : '', blocks: blocks };
    });
  }

  function blockHtml(b) {
    switch (b.type) {
      case 'h': return '<h' + b.level + ' class="pb-h">' + esc(b.text) + '</h' + b.level + '>';
      case 'p': return '<p class="pb-p">' + esc(b.text) + '</p>';
      case 'note': return '<p class="pb-note">' + esc(b.text) + '</p>';
      case 'html': return b.html;
      case 'list':
        return b.items.length ? '<ul class="pb-list">' + b.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '';
      case 'kv':
        return b.rows.length ? '<dl class="pb-kv">' + b.rows.map(function (r) {
          return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
        }).join('') + '</dl>' : '';
      default:
        return '<table class="pb-table">' +
          (b.head.length ? '<thead><tr>' + b.head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead>' : '') +
          '<tbody>' + b.rows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table>';
    }
  }

  /* sections: [{ id, pages }] -> one .pk-page per page; every page names its section. */
  function toHtml(sections) {
    var out = [];
    (sections || []).forEach(function (s) {
      cleanPages(s.pages).forEach(function (p) {
        out.push('<section class="pk-page pb-page" data-section="' + esc(s.id) + '">' +
          (p.title ? '<h2 class="pb-title">' + esc(p.title) + '</h2>' : '') +
          p.blocks.map(blockHtml).join('') + '</section>');
      });
    });
    return out.join('');
  }

  /* ---- layout and presets (pure; the page does the storing) ---- */

  function cleanIds(ids, known) {
    var seen = {}, out = [], dropped = [];
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      if (typeof id !== 'string') return;
      if (seen[id]) return;
      seen[id] = true;
      if (known.indexOf(id) < 0) dropped.push(id); else out.push(id);
    });
    return { ids: out, dropped: dropped };
  }

  function parseLayout(raw, known) {
    if (!isObj(raw) || raw.v !== 1) return { ids: [], dropped: [] };
    return cleanIds(raw.ids, known);
  }
  function layoutRecord(ids) { return { v: 1, ids: ids.slice() }; }

  function parsePresets(raw) {
    if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.presets)) return [];
    var out = [], seen = {};
    raw.presets.forEach(function (p) {
      if (!isObj(p) || typeof p.name !== 'string' || !Array.isArray(p.ids)) return;
      var name = p.name.trim().slice(0, MAX_NAME);
      var key = name.toLowerCase();
      if (!name || seen[key] || out.length >= MAX_PRESETS) return;
      seen[key] = true;
      out.push({ name: name, ids: p.ids.filter(function (i) { return typeof i === 'string'; }) });
    });
    return out;
  }
  function presetsRecord(list) { return { v: 1, presets: list.map(function (p) { return { name: p.name, ids: p.ids.slice() }; }) }; }

  /* Saving under a name already used (any case) replaces it in place. */
  function savePreset(list, name, ids) {
    var n = String(name || '').trim().slice(0, MAX_NAME);
    if (!n) return list.slice();
    var out = list.slice(), hit = -1;
    out.forEach(function (p, i) { if (p.name.toLowerCase() === n.toLowerCase()) hit = i; });
    var rec = { name: n, ids: ids.slice() };
    if (hit >= 0) out[hit] = rec; else if (out.length < MAX_PRESETS) out.push(rec);
    return out;
  }
  function deletePreset(list, name) {
    return list.filter(function (p) { return p.name.toLowerCase() !== String(name).trim().toLowerCase(); });
  }

  /* Move ids[i] one step (dir -1 up, +1 down); out of range is no move. */
  function move(ids, i, dir) {
    var j = i + dir;
    if (i < 0 || i >= ids.length || j < 0 || j >= ids.length) return ids.slice();
    var out = ids.slice(), t = out[i];
    out[i] = out[j]; out[j] = t;
    return out;
  }

  /* Take ids[from] and put it where ids[to] was (drag and drop); the others keep their order.
     Either index out of range, or the same one, is no move. */
  function moveTo(ids, from, to) {
    if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids.slice();
    var out = ids.slice(), one = out.splice(from, 1)[0];
    out.splice(to, 0, one);
    return out;
  }

  /* ---- the registry ---- */

  function create() {
    var list = [];

    function find(id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }

    function problem(p) {
      if (!isObj(p)) return 'a provider is an object';
      if (typeof p.id !== 'string' || !ID_RE.test(p.id)) return 'id must be lower-case words joined by hyphens';
      if (find(p.id)) return 'id "' + p.id + '" is already registered';
      if (typeof p.title !== 'string' || !p.title.trim()) return 'title is required';
      if (typeof p.sourceSlug !== 'string' || !p.sourceSlug) return 'sourceSlug is required';
      if (!Array.isArray(p.storageKeys) || p.storageKeys.some(function (k) { return typeof k !== 'string' || !k; })) return 'storageKeys must be a list of key names';
      if (typeof p.evaluate !== 'function') return 'evaluate must be a function';
      if (typeof p.build !== 'function') return 'build must be a function';
      return '';
    }

    function register(p) {
      var why = problem(p);
      if (why) throw new Error('PacketSections.register: ' + why);
      list.push({
        id: p.id, title: p.title.trim(), sourceSlug: p.sourceSlug,
        setupHint: typeof p.setupHint === 'string' ? p.setupHint : '',
        storageKeys: p.storageKeys.slice(), evaluate: p.evaluate, build: p.build
      });
    }

    function ids() { return list.map(function (p) { return p.id; }); }
    function get(id) { var p = find(id); return p ? { id: p.id, title: p.title, sourceSlug: p.sourceSlug, setupHint: p.setupHint, storageKeys: p.storageKeys.slice() } : null; }
    function all() { return list.map(function (p) { return get(p.id); }); }
    function storageKeys() {
      var seen = {}, out = [];
      list.forEach(function (p) { p.storageKeys.forEach(function (k) { if (!seen[k]) { seen[k] = true; out.push(k); } }); });
      return out.sort();
    }

    function evaluateOne(p, ctx) {
      var r;
      try { r = p.evaluate(ctx); } catch (e) { r = null; }
      if (!isObj(r)) return { available: false, status: 'Could not be read.' };
      return { available: r.available === true, status: str(r.status) };
    }

    /* Every section, in registration order, with its status. Never throws. */
    function evaluate(ctx) {
      return list.map(function (p) {
        var r = evaluateOne(p, ctx);
        return { id: p.id, title: p.title, sourceSlug: p.sourceSlug, setupHint: p.setupHint, available: r.available, status: r.status };
      });
    }

    /* The chosen ids in the order given: { sections: [{ id, title, pages }], skipped: [{ id, why }] }.
       An id nobody answers to, an unavailable section and a build that throws or
       returns no page are skipped with a reason; none of them stops the packet. */
    function build(chosen, ctx, opts) {
      var sections = [], skipped = [], seen = {};
      (Array.isArray(chosen) ? chosen : []).forEach(function (id) {
        if (seen[id]) return;
        seen[id] = true;
        var p = find(id);
        if (!p) { skipped.push({ id: String(id), why: 'unknown' }); return; }
        if (!evaluateOne(p, ctx).available) { skipped.push({ id: id, why: 'unavailable' }); return; }
        var r, pages;
        try { r = p.build(ctx, opts || {}); } catch (e) { r = null; }
        pages = isObj(r) ? cleanPages(r.pages) : [];
        if (!pages.length) { skipped.push({ id: id, why: 'failed' }); return; }
        sections.push({ id: id, title: p.title, pages: pages });
      });
      return { sections: sections, skipped: skipped };
    }

    return {
      register: register, ids: ids, get: get, list: all, storageKeys: storageKeys,
      evaluate: evaluate, build: build
    };
  }

  var api = create();
  api.create = create;
  api.BLOCK_TYPES = BLOCK_TYPES.slice();
  api.LAYOUT_KEY = LAYOUT_KEY;
  api.PRESETS_KEY = PRESETS_KEY;
  api.cleanBlock = cleanBlock;
  api.cleanPages = cleanPages;
  api.toHtml = toHtml;
  api.esc = esc;
  api.cleanIds = cleanIds;
  api.parseLayout = parseLayout;
  api.layoutRecord = layoutRecord;
  api.parsePresets = parsePresets;
  api.presetsRecord = presetsRecord;
  api.savePreset = savePreset;
  api.deletePreset = deletePreset;
  api.move = move;
  api.moveTo = moveTo;
  root.PacketSections = api;
})(typeof window !== 'undefined' ? window : globalThis);
