/* np-theme-packs.js — theme packs: a unit-themed board as a file (Path 15 P5).
   A pack is data and nothing else:

     { "v": 1, "name": "Ancient Rome", "themes": { "forum": { "--bg": "#1a0f0a", ... }, ... } }

   A pack is a file a colleague sent, so it is read with a whitelist. Only the custom properties applyTheme() writes
   (the keys of THEMES.default, plus the optional --accent-fill) are accepted, and every value must be a hex colour:
   no url(), no expression, no var(), no name. A theme must carry all eleven required properties, so a half-written
   one cannot leave a board with an unreadable corner. A pack that fails says why, line by line, and stores nothing.
   Colours that read badly are a warning, not a refusal.

   Stored in one key, np_theme_packs: { v: 1, packs: { <packId>: { name, themes: { <themeId>: { <var>: <colour> } } } } }.
   Not student data. A pack's themes are picked by the id packThemeId(packId, themeId), which is at most 40 characters
   (np_theme keeps 40) and cannot collide with a built-in theme id. DOM-free; loads in Node. */

import { THEMES } from './np-themes.js';

export const REQUIRED = Object.keys(THEMES.default).filter(k => k !== '--accent-fill');
export const ALLOWED = [...REQUIRED, '--accent-fill'];
export const MAX_PACKS = 12;
export const MAX_THEMES = 24;
const MAX_PACK_NAME = 60;
const SLUG = /^[a-z0-9][a-z0-9-]{0,19}$/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** A pack's id from its name: lower-case letters, digits and dashes, at most 14 characters. */
export function packIdOf(name) {
  const s = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 14).replace(/-+$/, '');
  return s || 'pack';
}

/** The id a pack theme is chosen by (and stored under np_theme). */
export function packThemeId(packId, themeId) { return 'pk-' + packId + '-' + themeId; }

function luminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/* the text-on-background pairs the board draws */
const PAIRS = [['--text', '--bg'], ['--name-text', '--name-bg'], ['--highlight-text', '--highlight'], ['--winner-text', '--winner']];

/** A theme's own words: id "ancient-rome" is shown as "Ancient Rome". */
export function labelOf(themeId) {
  return themeId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Read a pack. Returns { ok: true, pack, warnings } with a clean copy (only whitelisted keys, normalised colours), or
 * { ok: false, errors } with every problem found. Never throws and never returns the input's own objects.
 */
export function validatePack(raw) {
  const errors = [], warnings = [];
  if (!isObj(raw)) return { ok: false, errors: ['That is not a theme pack (a pack is a JSON object).'] };
  if (raw.v !== 1) errors.push('The pack\'s "v" must be 1.');
  const name = typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ').slice(0, MAX_PACK_NAME) : '';
  if (!name) errors.push('The pack needs a "name".');
  if (!isObj(raw.themes)) errors.push('The pack needs a "themes" object.');
  const themes = {};
  if (isObj(raw.themes)) {
    const ids = Object.keys(raw.themes);
    if (!ids.length) errors.push('The pack has no themes.');
    if (ids.length > MAX_THEMES) errors.push('A pack holds at most ' + MAX_THEMES + ' themes; this one has ' + ids.length + '.');
    for (const id of ids.slice(0, MAX_THEMES)) {
      const t = raw.themes[id];
      if (!SLUG.test(id)) { errors.push('Theme "' + id.slice(0, 30) + '": the id must be 1 to 20 lower-case letters, digits or dashes.'); continue; }
      if (own(THEMES, id)) { errors.push('Theme "' + id + '": that is the id of a built-in theme.'); continue; }
      if (!isObj(t)) { errors.push('Theme "' + id + '" must be an object of colours.'); continue; }
      const clean = {};
      let bad = false;
      for (const k of Object.keys(t)) {
        if (!ALLOWED.includes(k)) { errors.push('Theme "' + id + '": "' + k.slice(0, 30) + '" is not a property a theme may set.'); bad = true; }
        else if (typeof t[k] !== 'string' || !HEX.test(t[k].trim())) { errors.push('Theme "' + id + '": ' + k + ' must be a hex colour such as #1a1a2e.'); bad = true; }
        else clean[k] = t[k].trim().toLowerCase();
      }
      for (const k of REQUIRED) if (!own(clean, k) && !bad) { errors.push('Theme "' + id + '" is missing ' + k + '.'); bad = true; }
      if (bad) continue;
      for (const [fg, bg] of PAIRS) {
        const c = contrast(clean[fg], clean[bg]);
        if (c < 4.5) warnings.push('Theme "' + id + '": ' + fg + ' on ' + bg + ' is ' + c.toFixed(1) + ':1 (4.5:1 reads comfortably).');
      }
      themes[id] = clean;
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, pack: { v: 1, name, themes }, warnings };
}

/** A stored value, or anything, as a safe { v: 1, packs } document. A pack that does not validate is dropped. */
export function blank() { return { v: 1, packs: {} }; }
export function fix(raw) {
  const out = blank();
  if (!isObj(raw) || !isObj(raw.packs)) return out;
  for (const id of Object.keys(raw.packs).slice(0, MAX_PACKS)) {
    if (!/^[a-z0-9][a-z0-9-]{0,13}$/.test(id)) continue;
    const r = validatePack({ v: 1, name: (raw.packs[id] || {}).name, themes: (raw.packs[id] || {}).themes });
    if (r.ok) out.packs[id] = { name: r.pack.name, themes: r.pack.themes };
  }
  return out;
}

/**
 * Add a validated pack to a stored document. Same name replaces (importing a corrected file); a different name adds, up
 * to MAX_PACKS. Returns { doc, packId, replaced } or { error }.
 */
export function addPack(doc, pack) {
  const base = fix(doc);
  const packId = packIdOf(pack.name);
  const replaced = own(base.packs, packId);
  if (!replaced && Object.keys(base.packs).length >= MAX_PACKS) {
    return { error: 'This device already holds ' + MAX_PACKS + ' theme packs. Remove one first.' };
  }
  base.packs[packId] = { name: pack.name, themes: pack.themes };
  return { doc: base, packId, replaced };
}

export function removePack(doc, packId) {
  const base = fix(doc);
  delete base.packs[packId];
  return base;
}

/** Every stored theme as { <themeId>: { label, pack, vars } }, `vars` the full map the page writes (accent-fill defaulted). */
export function resolve(doc) {
  const out = {};
  const base = fix(doc);
  for (const [pid, p] of Object.entries(base.packs)) {
    for (const [tid, vars] of Object.entries(p.themes)) {
      out[packThemeId(pid, tid)] = { label: labelOf(tid), pack: p.name, packId: pid, vars: { ...vars, '--accent-fill': vars['--accent-fill'] || vars['--accent'] } };
    }
  }
  return out;
}

/** The file for one pack: exactly what validatePack accepts, so an exported pack imports on another device. */
export function exportPack(doc, packId) {
  const p = fix(doc).packs[packId];
  if (!p) return null;
  return { v: 1, name: p.name, themes: p.themes };
}

/** Parse the text of a pack file. { ok, pack, warnings } or { ok: false, errors }. */
export function parsePackText(text) {
  let raw;
  try { raw = JSON.parse(String(text)); } catch (e) { return { ok: false, errors: ['That file is not valid JSON.'] }; }
  return validatePack(raw);
}
