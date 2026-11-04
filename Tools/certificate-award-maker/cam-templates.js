/* Certificate & Award Maker — templates as data (Path rank 79).
   A template is a plain object: fonts, colours and the title's treatment. The five that
   shipped as CSS classes (.theme-playful ... .theme-ribbon) are entries here, and a teacher's
   own are the same shape, kept in one localStorage key. A new design is a new entry; the page
   has no code per template.

     { key, label, font, color, bg, title: { color, transform, style, weight, spacing, size },
       kicker: { color }, seal?: { seal, ribbon } }

   `font` is a key into FONTS (a fixed list of system stacks: nothing typed is ever put in a
   font-family). `color` is the certificate's ink and border colour, `bg` one colour or a
   [from, to] pair drawn as a 135 degree gradient. Every value is checked by clean(); what does not
   pass is dropped or replaced by the default, so a stored or shared template cannot put anything
   but a colour, a keyword or a number into the page's CSS. */
(function (global) {
  'use strict';

  var STORE_KEY = 'gvb-certificate-maker:templates';
  var MAX_CUSTOM = 12;

  var FONTS = {
    trebuchet: { label: 'Trebuchet (friendly)', stack: '"Trebuchet MS", "Segoe UI", sans-serif' },
    arialblack: { label: 'Arial Black (bold)', stack: '"Arial Black", Arial, sans-serif' },
    georgia: { label: 'Georgia (classic serif)', stack: 'Georgia, "Times New Roman", serif' },
    segoe: { label: 'Segoe UI (clean)', stack: '"Segoe UI", system-ui, sans-serif' },
    times: { label: 'Times (formal)', stack: '"Times New Roman", Times, serif' },
    courier: { label: 'Courier (typewriter)', stack: '"Courier New", Courier, monospace' }
  };

  var TRANSFORMS = ['none', 'uppercase'];
  var STYLES = ['normal', 'italic'];
  var WEIGHTS = [300, 400, 700, 900];
  var SPACINGS = { none: '0', wide: '.04em', wider: '.12em' };
  var SIZES = { small: '2.1rem', medium: '2.6rem', large: '3.1rem' };

  var BUILTIN = [
    { key: 'playful', label: 'Playful', font: 'trebuchet', color: '#e0459b', bg: ['#fff8f0', '#ffffff'],
      title: { color: '#e0459b', transform: 'none', style: 'normal', weight: 700, spacing: 'none', size: 'medium' },
      kicker: { color: '#ffb400' } },
    { key: 'varsity', label: 'Varsity', font: 'arialblack', color: '#1b3a6b', bg: '#ffffff',
      title: { color: '#1b3a6b', transform: 'uppercase', style: 'normal', weight: 700, spacing: 'none', size: 'medium' },
      kicker: { color: '#c81d25' } },
    { key: 'elegant', label: 'Elegant', font: 'georgia', color: '#8a6d1d', bg: '#fdfaf3',
      title: { color: '#1f2f4d', transform: 'none', style: 'italic', weight: 700, spacing: 'none', size: 'medium' },
      kicker: { color: '#8a6d1d' } },
    { key: 'modern', label: 'Modern', font: 'segoe', color: '#0f766e', bg: '#ffffff', bodyWeight: 300,
      title: { color: '#16211f', transform: 'none', style: 'normal', weight: 300, spacing: 'wide', size: 'medium' },
      kicker: { color: '#0f766e' } },
    { key: 'ribbon', label: 'Ribbon', font: 'georgia', color: '#1e3a5f', bg: '#ffffff',
      title: { color: '#1e3a5f', transform: 'none', style: 'normal', weight: 700, spacing: 'none', size: 'medium' },
      kicker: { color: '#b08d2f' }, seal: { seal: 'gold', ribbon: 'blue' } }
  ];

  var COLOR_RE = /^#[0-9a-f]{6}$/i;
  function color(v, fallback) { return typeof v === 'string' && COLOR_RE.test(v) ? v.toLowerCase() : fallback; }
  function oneOf(v, list, fallback) { return list.indexOf(v) === -1 ? fallback : v; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* clean(t): a template from anything, or null when it has no usable key. */
  function clean(t) {
    if (!t || typeof t !== 'object') return null;
    var key = typeof t.key === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(t.key) ? t.key : '';
    if (!key) return null;
    var label = typeof t.label === 'string' ? t.label.replace(/\s+/g, ' ').trim().slice(0, 30) : '';
    var ti = t.title && typeof t.title === 'object' ? t.title : {};
    var ki = t.kicker && typeof t.kicker === 'object' ? t.kicker : {};
    var ink = color(t.color, '#333333');
    var bg = Array.isArray(t.bg) ? [color(t.bg[0], '#ffffff'), color(t.bg[1], '#ffffff')] : color(t.bg, '#ffffff');
    var out = {
      key: key,
      label: label || key,
      font: has(FONTS, t.font) ? t.font : 'georgia',
      color: ink,
      bg: bg,
      title: {
        color: color(ti.color, ink),
        transform: oneOf(ti.transform, TRANSFORMS, 'none'),
        style: oneOf(ti.style, STYLES, 'normal'),
        weight: oneOf(Number(ti.weight), WEIGHTS, 700),
        spacing: has(SPACINGS, ti.spacing) ? ti.spacing : 'none',
        size: has(SIZES, ti.size) ? ti.size : 'medium'
      },
      kicker: { color: color(ki.color, ink) }
    };
    if (Number(t.bodyWeight) === 300) out.bodyWeight = 300;
    if (t.seal && typeof t.seal === 'object') out.seal = { seal: String(t.seal.seal || 'none'), ribbon: String(t.seal.ribbon || 'none') };
    return out;
  }

  function builtins() { return BUILTIN.map(clean); }

  /* slug(label): the key part of a teacher's template name. A name with any letter or digit outside a-z0-9
     (春, Été) also gets a short hash of the whole name, so two such names cannot share a key and overwrite
     each other (AI-63; both used to be "template"); a plain a-z name is unchanged. At most 30 characters. */
  function slug(label) {
    var name = String(label || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
    var s = name.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!/[^a-z0-9\s\p{P}\p{S}]/u.test(name)) return s.slice(0, 30) || 'template';   // as before, so a saved name keeps its key
    var h = 0x811c9dc5;
    for (var i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    var tag = ('000000' + h.toString(36)).slice(-7);
    s = s.slice(0, 22).replace(/-+$/, '');
    return (s ? s + '-' : 't-') + tag;
  }

  /* list(custom): the built-ins, then the teacher's, in order; a custom key that repeats an earlier one is dropped. */
  function list(custom) {
    var out = builtins();
    var seen = {};
    out.forEach(function (t) { seen[t.key] = true; });
    (Array.isArray(custom) ? custom : []).slice(0, MAX_CUSTOM).forEach(function (raw) {
      var t = clean(raw);
      if (t && !seen[t.key]) { seen[t.key] = true; t.custom = true; out.push(t); }
    });
    return out;
  }

  function find(templates, key) {
    for (var i = 0; i < templates.length; i++) if (templates[i].key === key) return templates[i];
    return null;
  }

  /* vars(t): the style attribute value for a .cert. Every part is from a checked field. */
  function vars(t) {
    var bg = Array.isArray(t.bg) ? 'linear-gradient(135deg, ' + t.bg[0] + ', ' + t.bg[1] + ')' : t.bg;
    return [
      '--t-ink:' + t.color,
      '--t-font:' + FONTS[t.font].stack.replace(/"/g, "'"),   // it goes into a style="" attribute
      '--t-bg:' + bg,
      '--t-body-weight:' + (t.bodyWeight || 'inherit'),
      '--t-title:' + t.title.color,
      '--t-title-transform:' + t.title.transform,
      '--t-title-style:' + t.title.style,
      '--t-title-weight:' + t.title.weight,
      '--t-title-spacing:' + SPACINGS[t.title.spacing],
      '--t-title-size:' + SIZES[t.title.size],
      '--t-kicker:' + t.kicker.color
    ].join(';') + ';';
  }

  /* swatch(t): a CSS background for the picker chip. */
  function swatch(t) {
    if (t.key === 'modern') return t.color;
    return 'linear-gradient(90deg,' + t.color + ',' + t.title.color + ')';
  }

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return v && Array.isArray(v.templates) ? v.templates.map(clean).filter(Boolean).slice(0, MAX_CUSTOM) : [];
    } catch (e) { return []; }
  }
  function save(custom) {
    var clean12 = (custom || []).map(clean).filter(Boolean).slice(0, MAX_CUSTOM);
    if (clean12.length) localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, templates: clean12 }));
    else localStorage.removeItem(STORE_KEY);
  }

  global.CertificateTemplates = {
    STORE_KEY: STORE_KEY, MAX_CUSTOM: MAX_CUSTOM, FONTS: FONTS, TRANSFORMS: TRANSFORMS, STYLES: STYLES,
    WEIGHTS: WEIGHTS, SPACINGS: SPACINGS, SIZES: SIZES,
    clean: clean, builtins: builtins, list: list, find: find, vars: vars, swatch: swatch, slug: slug,
    load: load, save: save
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
