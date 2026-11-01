/* htcm-theme-packs.js — card theme packs for the Historical Trading Card Maker,
   as data a teacher can import (Path 15 P5's pack format, on this tool's cards).

   A pack is a small JSON file:
     { "v": 1, "name": "Rome unit", "themes": [
         { "id": "forum", "label": "Forum", "frame": "greek-key", "texture": "parchment",
           "font": "Georgia, serif", "nameFont": "Georgia, serif",
           "ink": "#3d2b1f", "paper": "#f4e9d0", "accent": "#8a6d1d", "accent2": "#5b4636" } ] }
   It adds themes to the swatch picker, the review game and every export without
   touching the engine: each is the same record htcm-themes.js keeps for the built-in
   themes, under the key `pk-<pack>-<id>` (40 characters at most), so a pack theme can
   never replace a built-in one or another pack's.

   What is checked (a failing file stores nothing and every problem is named):
   - a name of 1 to 40 characters that has a letter or digit in it; at most 12 themes; ids of
     at most 20 lower-case letters, digits and dashes, none repeated;
   - a label of 1 to 24 characters; a frame and a texture that this tool already draws
     (a pack cannot bring its own markup or gradient); fonts of letters, digits, spaces,
     commas, quotes and dashes only; colours as 3- or 6-digit hex and nothing else;
   - ink on paper at 4.5:1 or better, which is the rule every built-in theme follows so a card
     stays legible on a black-and-white printer. Accent and secondary colours under 3:1 on the
     paper are a warning, not a refusal.
   Nothing here is student data. The packs live in `htcm:themepacks` on this device (at most
   twelve), are re-checked on every load, and are in no deck, share link or export: a deck that
   uses a pack theme the receiver lacks shows the classic theme there. */
(function (global) {
  'use strict';

  var KEY = 'htcm:themepacks';
  var MAX_PACKS = 12;
  var MAX_THEMES = 12;
  var HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  var FONT = /^[A-Za-z0-9 ,"'-]{1,120}$/;
  var ID = /^[a-z0-9-]{1,20}$/;

  function expand(h) {
    var s = h.slice(1);
    if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function lum(h) {
    var c = expand(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) {
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 12).replace(/-+$/, ''); }
  function keyFor(packName, id) { return ('pk-' + slug(packName) + '-' + id).slice(0, 40); }

  function envOf(env) {
    env = env || {};
    return {
      frames: env.frames || (global.HtcmFrames ? Object.keys(global.HtcmFrames.FRAMES) : ['plain']),
      textures: env.textures || (global.HtcmThemes ? global.HtcmThemes.TEXTURES : [])
    };
  }

  /** Checks a parsed file. { ok, pack (cleaned), errors, warnings }. */
  function validate(obj, env) {
    env = envOf(env);
    var errors = [], warnings = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, pack: null, errors: ['The file is not a theme pack (it should hold one object with a name and a list of themes).'], warnings: [] };
    if (obj.v !== 1) errors.push('"v" must be 1.');
    var name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!name || name.length > 40 || !slug(name)) errors.push('"name" must be 1 to 40 characters with a letter or digit in it.');
    if (!Array.isArray(obj.themes) || !obj.themes.length) errors.push('"themes" must be a list with at least one theme.');
    else if (obj.themes.length > MAX_THEMES) errors.push('A pack can hold at most ' + MAX_THEMES + ' themes (this one has ' + obj.themes.length + ').');
    var themes = [], seen = {};
    (Array.isArray(obj.themes) ? obj.themes.slice(0, MAX_THEMES) : []).forEach(function (t, i) {
      var where = 'Theme ' + (i + 1) + (t && typeof t.id === 'string' ? ' (' + t.id.slice(0, 20) + ')' : '');
      if (!t || typeof t !== 'object') { errors.push(where + ' is not an object.'); return; }
      var n = errors.length;
      if (typeof t.id !== 'string' || !ID.test(t.id)) errors.push(where + ': "id" must be 1 to 20 lower-case letters, digits or dashes.');
      else if (seen[t.id]) errors.push(where + ': the id is used twice.');
      else seen[t.id] = true;
      var label = typeof t.label === 'string' ? t.label.trim() : '';
      if (!label || label.length > 24) errors.push(where + ': "label" must be 1 to 24 characters.');
      var frame = t.frame === undefined ? 'plain' : t.frame;
      if (env.frames.indexOf(frame) < 0) errors.push(where + ': "frame" must be one of ' + env.frames.join(', ') + '.');
      var texture = t.texture === undefined ? null : t.texture;
      if (texture !== null && env.textures.indexOf(texture) < 0) errors.push(where + ': "texture" must be left out, null, or one of ' + env.textures.join(', ') + '.');
      if (typeof t.font !== 'string' || !FONT.test(t.font)) errors.push(where + ': "font" must be 1 to 120 characters of letters, digits, spaces, commas, quotes and dashes.');
      var nameFont = t.nameFont === undefined || t.nameFont === null ? null : t.nameFont;
      if (nameFont !== null && (typeof nameFont !== 'string' || !FONT.test(nameFont))) errors.push(where + ': "nameFont" must be left out or use the same characters as "font".');
      ['ink', 'paper', 'accent', 'accent2'].forEach(function (k) {
        if (typeof t[k] !== 'string' || !HEX.test(t[k])) errors.push(where + ': "' + k + '" must be a 3- or 6-digit hex colour like #3d2b1f.');
      });
      if (errors.length === n) {
        var r = ratio(t.ink, t.paper);
        if (r < 4.5) errors.push(where + ': ink on paper is ' + r.toFixed(1) + ':1; it must be at least 4.5:1 so the card stays legible on a black-and-white printer.');
        else {
          if (ratio(t.accent, t.paper) < 3) warnings.push(where + ': the accent colour is under 3:1 on the paper, so the name may be faint.');
          if (ratio(t.accent2, t.paper) < 3) warnings.push(where + ': the second accent is under 3:1 on the paper, so stat labels may be faint.');
        }
      }
      if (errors.length === n) {
        themes.push({ id: t.id, label: label, frame: frame, texture: texture, font: t.font, nameFont: nameFont,
          ink: t.ink.toLowerCase(), paper: t.paper.toLowerCase(), accent: t.accent.toLowerCase(), accent2: t.accent2.toLowerCase() });
      }
    });
    if (errors.length) return { ok: false, pack: null, errors: errors, warnings: warnings };
    return { ok: true, pack: { v: 1, name: name, themes: themes }, errors: [], warnings: warnings };
  }

  /** The records htcm-themes.js keeps, one per theme in the packs. */
  function themesOf(packs) {
    var out = [];
    packs.forEach(function (p) {
      p.themes.forEach(function (t) {
        out.push({ key: keyFor(p.name, t.id), label: t.label, frame: t.frame, texture: t.texture, font: t.font, nameFont: t.nameFont,
          ink: t.ink, paper: t.paper, accent: t.accent, accent2: t.accent2, pack: p.name });
      });
    });
    return out;
  }

  function load() {
    var raw;
    try { raw = JSON.parse(global.localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
    if (!Array.isArray(raw)) return [];
    var out = [], names = {};
    raw.forEach(function (p) {
      var r = validate(p);
      if (r.ok && !names[r.pack.name] && out.length < MAX_PACKS) { names[r.pack.name] = true; out.push(r.pack); }
    });
    return out;
  }
  function save(packs) {
    try { global.localStorage.setItem(KEY, JSON.stringify(packs)); return true; } catch (e) { return false; }
  }

  /** Adds a checked pack, replacing one of the same name. { ok, error }. */
  function install(pack) {
    var packs = load();
    var at = -1;
    packs.forEach(function (p, i) { if (p.name === pack.name) at = i; });
    if (at < 0 && packs.length >= MAX_PACKS) return { ok: false, error: 'This device already holds ' + MAX_PACKS + ' theme packs; remove one first.' };
    if (at >= 0) packs[at] = pack; else packs.push(pack);
    return save(packs) ? { ok: true, replaced: at >= 0 } : { ok: false, error: 'The browser would not save the pack (its storage may be full).' };
  }
  function remove(name) {
    var packs = load().filter(function (p) { return p.name !== name; });
    return save(packs);
  }
  /** The file as a teacher would write it: a null nameFont or texture is left out. */
  function toFile(pack) {
    var themes = pack.themes.map(function (t) {
      var o = {};
      Object.keys(t).forEach(function (k) { if (t[k] !== null) o[k] = t[k]; });
      return o;
    });
    return JSON.stringify({ v: 1, name: pack.name, themes: themes }, null, 2);
  }

  /** Puts the stored packs' themes into the picker, the cards and the exports. */
  function apply() {
    var packs = load();
    global.HtcmThemes.setPackThemes(themesOf(packs));
    return packs;
  }

  global.HtcmThemePacks = {
    KEY: KEY, MAX_PACKS: MAX_PACKS, MAX_THEMES: MAX_THEMES,
    validate: validate, keyFor: keyFor, themesOf: themesOf, ratio: ratio,
    load: load, save: save, install: install, remove: remove, toFile: toFile, apply: apply
  };
})(window);
