// sections.test.mjs — pure-logic tests for Tools/packet-builder/sections.js (Path 10 P1):
// the provider registry (what it accepts and refuses), evaluate and build never
// throwing at the page, the block cleaner, toHtml's escaping, and the layout and
// preset records. Then the same checks run against deliberate breaks of the module
// (MUTANTS below): each break must turn at least one check red, or the suite fails.
//
//   node Tools/packet-builder/test/sections.test.mjs   (or: npm run test:packet-sections)
//
// sections.js is a classic script ending in `})(window or globalThis)`, so it runs
// here in a vm context. Nothing reads storage or the clock.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', 'sections.js'), 'utf8');

function load(src) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.PacketSections;
}
const plain = v => JSON.parse(JSON.stringify(v));

function provider(over) {
  return Object.assign({
    id: 'demo', title: 'Demo', sourceSlug: 'demo-tool', setupHint: 'Set it up in Demo.',
    storageKeys: ['demo-key'],
    evaluate: ctx => ({ available: ctx.read('demo-key') !== undefined, status: 'ok' }),
    build: () => ({ pages: [{ title: 'Demo page', blocks: [{ type: 'p', text: 'hello' }] }] })
  }, over || {});
}

function checks(PS) {
  const out = [];
  const t = (name, fn) => { let ok = false, msg = ''; try { ok = fn() === true; } catch (e) { msg = e.message; } out.push({ name, ok, msg }); };
  const throws = fn => { try { fn(); return false; } catch (e) { return true; } };
  const ctxWith = data => ({ read: k => data[k], todayISO: '2026-10-29' });

  // registry
  t('register accepts a whole provider', () => { const r = PS.create(); r.register(provider()); return r.ids().join() === 'demo'; });
  t('register refuses a duplicate id', () => { const r = PS.create(); r.register(provider()); return throws(() => r.register(provider())); });
  t('register refuses a bad id', () => { const r = PS.create(); return ['', 'Demo', '1x', 'a b', 'a'.repeat(41)].every(id => throws(() => r.register(provider({ id })))); });
  t('register refuses a missing piece', () => {
    const r = PS.create();
    return [{ title: '' }, { sourceSlug: '' }, { storageKeys: 'k' }, { storageKeys: [1] }, { evaluate: 1 }, { build: null }].every(o => throws(() => r.register(provider(o))));
  });
  t('register refuses a non-object', () => { const r = PS.create(); return throws(() => r.register(null)) && throws(() => r.register('x')); });
  t('list keeps registration order and hides the functions', () => {
    const r = PS.create(); r.register(provider({ id: 'b' })); r.register(provider({ id: 'a' }));
    const l = r.list();
    return l.map(p => p.id).join() === 'b,a' && l.every(p => !('evaluate' in p) && !('build' in p));
  });
  t('a copy from list cannot change the registry', () => { const r = PS.create(); r.register(provider()); r.list()[0].storageKeys.push('x'); return r.get('demo').storageKeys.join() === 'demo-key'; });
  t('storageKeys is the sorted union without repeats', () => {
    const r = PS.create(); r.register(provider({ id: 'a', storageKeys: ['z', 'm'] })); r.register(provider({ id: 'b', storageKeys: ['m', 'a'] }));
    return r.storageKeys().join() === 'a,m,z';
  });
  t('get of an unknown id is null', () => PS.create().get('nope') === null);
  t('the default registry starts empty and is separate from create()', () => { const r = PS.create(); r.register(provider()); return PS.ids().length === 0; });

  // evaluate
  t('evaluate reports each section with its status', () => {
    const r = PS.create(); r.register(provider());
    const e = r.evaluate(ctxWith({ 'demo-key': {} }))[0];
    return e.id === 'demo' && e.available === true && e.status === 'ok' && e.setupHint === 'Set it up in Demo.' && e.sourceSlug === 'demo-tool';
  });
  t('evaluate: nothing saved is unavailable', () => { const r = PS.create(); r.register(provider()); return r.evaluate(ctxWith({}))[0].available === false; });
  t('evaluate never throws: a throwing provider is unavailable', () => {
    const r = PS.create(); r.register(provider({ evaluate() { throw new Error('boom'); } }));
    const e = r.evaluate(ctxWith({}))[0]; return e.available === false && e.status.length > 0;
  });
  t('evaluate: a non-object answer is unavailable', () => { const r = PS.create(); r.register(provider({ evaluate: () => 'yes' })); return r.evaluate(ctxWith({}))[0].available === false; });
  t('evaluate: only available === true counts', () => { const r = PS.create(); r.register(provider({ evaluate: () => ({ available: 'yes', status: 's' }) })); return r.evaluate(ctxWith({}))[0].available === false; });

  // build
  t('build keeps the order asked for', () => {
    const r = PS.create(); r.register(provider({ id: 'a' })); r.register(provider({ id: 'b' }));
    return r.build(['b', 'a'], ctxWith({ 'demo-key': 1 })).sections.map(s => s.id).join() === 'b,a';
  });
  t('build skips an unknown id and says so', () => {
    const r = PS.create(); r.register(provider());
    const b = r.build(['ghost', 'demo'], ctxWith({ 'demo-key': 1 }));
    return b.sections.length === 1 && isDeepStrictEqual(plain(b.skipped), [{ id: 'ghost', why: 'unknown' }]);
  });
  t('build skips an unavailable section', () => {
    const r = PS.create(); r.register(provider());
    const b = r.build(['demo'], ctxWith({}));
    return b.sections.length === 0 && b.skipped[0].why === 'unavailable';
  });
  t('build survives a throwing build()', () => {
    const r = PS.create(); r.register(provider({ id: 'bad', build() { throw new Error('x'); } })); r.register(provider({ id: 'ok' }));
    const b = r.build(['bad', 'ok'], ctxWith({ 'demo-key': 1 }));
    return b.sections.map(s => s.id).join() === 'ok' && b.skipped[0].why === 'failed';
  });
  t('build treats no pages as failed', () => {
    const r = PS.create(); r.register(provider({ build: () => ({ pages: [] }) }));
    return r.build(['demo'], ctxWith({ 'demo-key': 1 })).skipped[0].why === 'failed';
  });
  t('build asks a section once however often it is named', () => {
    const r = PS.create(); r.register(provider());
    return r.build(['demo', 'demo'], ctxWith({ 'demo-key': 1 })).sections.length === 1;
  });
  t('build passes the context and the options through', () => {
    let seen = null; const r = PS.create();
    r.register(provider({ build(ctx, opts) { seen = [ctx.todayISO, opts.x]; return { pages: [{ title: 't', blocks: [] }] }; } }));
    r.build(['demo'], ctxWith({ 'demo-key': 1 }), { x: 7 });
    return isDeepStrictEqual(seen, ['2026-10-29', 7]);
  });
  t('build cleans what a provider returns', () => {
    const r = PS.create();
    r.register(provider({ build: () => ({ pages: [{ title: {}, blocks: [{ type: 'script', x: 1 }, { type: 'p', text: 'k' }] }] }) }));
    const s = r.build(['demo'], ctxWith({ 'demo-key': 1 })).sections[0];
    return s.pages[0].title === '' && s.pages[0].blocks.length === 1;
  });

  // blocks and html
  t('cleanBlock refuses an unknown type', () => PS.cleanBlock({ type: 'img', src: 'x' }) === null && PS.cleanBlock(null) === null && PS.cleanBlock([]) === null);
  t('cleanBlock coerces text and caps rows', () => {
    const b = PS.cleanBlock({ type: 'table', head: ['a', 1, {}], rows: Array.from({ length: 500 }, () => ['x']) });
    return b.head.join() === 'a,1,' && b.rows.length === 400;
  });
  t('cleanBlock caps a long text', () => PS.cleanBlock({ type: 'p', text: 'x'.repeat(9000) }).text.length === 4000);
  t('cleanBlock keeps a heading level to 2 or 3', () => PS.cleanBlock({ type: 'h', text: 'a', level: 9 }).level === 2 && PS.cleanBlock({ type: 'h', text: 'a', level: 3 }).level === 3);
  t('toHtml escapes every text block', () => {
    const bad = '<img src=x onerror=alert(1)>&"\'';
    const html = PS.toHtml([{ id: 'demo', pages: [{ title: bad, blocks: [
      { type: 'h', text: bad }, { type: 'p', text: bad }, { type: 'note', text: bad }, { type: 'list', items: [bad] },
      { type: 'kv', rows: [[bad, bad]] }, { type: 'table', head: [bad], rows: [[bad]] }] }] }]);
    return !/<img/i.test(html) && !html.includes('onerror=alert(1)>') && html.includes('&lt;img');
  });
  t('toHtml escapes the section id it writes into an attribute', () => PS.toHtml([{ id: 'a"b', pages: [{ title: '', blocks: [] }] }]).includes('data-section="a&quot;b"'));
  t('toHtml passes an html block through untouched', () => PS.toHtml([{ id: 'd', pages: [{ title: '', blocks: [{ type: 'html', html: '<b>x</b>' }] }] }]).includes('<b>x</b>'));
  t('toHtml writes one .pk-page per page, in order', () => {
    const html = PS.toHtml([{ id: 'a', pages: [{ title: 'One', blocks: [] }, { title: 'Two', blocks: [] }] }, { id: 'b', pages: [{ title: 'Three', blocks: [] }] }]);
    return (html.match(/class="pk-page pb-page"/g) || []).length === 3 && html.indexOf('One') < html.indexOf('Two') && html.indexOf('Two') < html.indexOf('Three');
  });
  t('toHtml draws a table head and its rows', () => {
    const html = PS.toHtml([{ id: 'a', pages: [{ title: '', blocks: [{ type: 'table', head: ['H'], rows: [['r1'], ['r2']] }] }] }]);
    return html.includes('<th>H</th>') && html.includes('<td>r1</td>') && html.includes('<td>r2</td>');
  });
  t('toHtml draws an empty list as nothing', () => !PS.toHtml([{ id: 'a', pages: [{ title: '', blocks: [{ type: 'list', items: [] }] }] }]).includes('<ul'));
  t('toHtml of nothing is empty', () => PS.toHtml([]) === '' && PS.toHtml(null) === '');

  // layout
  const known = ['a', 'b', 'c'];
  t('cleanIds drops unknown ids, repeats and non-strings, keeping order', () => {
    const r = PS.cleanIds(['c', 'x', 'a', 'c', 7, null, 'b'], known);
    return r.ids.join() === 'c,a,b' && r.dropped.join() === 'x';
  });
  t('cleanIds of a non-list is empty', () => PS.cleanIds('a', known).ids.length === 0);
  t('parseLayout reads a v1 record and refuses another version', () =>
    PS.parseLayout({ v: 1, ids: ['b', 'a'] }, known).ids.join() === 'b,a' && PS.parseLayout({ v: 2, ids: ['b'] }, known).ids.length === 0 && PS.parseLayout(null, known).ids.length === 0 && PS.parseLayout('x', known).ids.length === 0);
  t('layoutRecord round-trips through parseLayout', () => PS.parseLayout(plain(PS.layoutRecord(['c', 'a'])), known).ids.join() === 'c,a');
  t('layoutRecord copies the list', () => { const ids = ['a']; const rec = PS.layoutRecord(ids); ids.push('b'); return rec.ids.length === 1; });

  // presets
  t('parsePresets reads names and ids and refuses other versions', () =>
    PS.parsePresets({ v: 1, presets: [{ name: 'Sub', ids: ['a'] }] }).length === 1 && PS.parsePresets({ v: 2, presets: [{ name: 'Sub', ids: [] }] }).length === 0 && PS.parsePresets(null).length === 0 && PS.parsePresets({ v: 1 }).length === 0);
  t('parsePresets drops a nameless, id-less or repeated-name preset', () => {
    const l = PS.parsePresets({ v: 1, presets: [{ name: ' ', ids: [] }, { name: 'A', ids: 'x' }, { name: 'B', ids: ['a'] }, { name: 'b', ids: ['c'] }, 5] });
    return l.length === 1 && l[0].name === 'B' && l[0].ids.join() === 'a';
  });
  t('parsePresets caps the count and the name', () => {
    const l = PS.parsePresets({ v: 1, presets: Array.from({ length: 50 }, (_, i) => ({ name: 'n' + i + 'x'.repeat(80), ids: [] })) });
    return l.length === 30 && l.every(p => p.name.length <= 60);
  });
  t('savePreset appends, and replaces a name in any case in place', () => {
    let l = PS.savePreset([], 'Sub day', ['a']);
    l = PS.savePreset(l, 'Other', ['b']);
    l = PS.savePreset(l, 'sub DAY', ['c']);
    return l.length === 2 && l[0].name === 'sub DAY' && l[0].ids.join() === 'c' && l[1].name === 'Other';
  });
  t('savePreset ignores a blank name and stops at the cap', () => {
    let l = PS.savePreset([], '  ', ['a']);
    for (let i = 0; i < 40; i++) l = PS.savePreset(l, 'p' + i, []);
    return l.length === 30 && PS.savePreset([], '  ', ['a']).length === 0;
  });
  t('savePreset does not change the list it was given', () => { const l = [{ name: 'A', ids: ['a'] }]; PS.savePreset(l, 'A', ['b']); return l[0].ids.join() === 'a'; });
  t('deletePreset removes by name in any case', () => PS.deletePreset([{ name: 'A', ids: [] }, { name: 'B', ids: [] }], ' a ').map(p => p.name).join() === 'B');
  t('presetsRecord round-trips through parsePresets', () => {
    const l = [{ name: 'A', ids: ['a', 'b'] }];
    return isDeepStrictEqual(plain(PS.parsePresets(plain(PS.presetsRecord(l)))), l);
  });

  // load() and readerFor()
  t('load returns what the provider cleans, and null for an unknown id or a provider with no load', () => {
    const r = PS.create(); r.register(provider({ load: ctx => ctx.read('demo-key') })); r.register(provider({ id: 'plain' }));
    const ctx = { read: () => ({ a: 1 }) };
    return r.load('demo', ctx).a === 1 && r.load('nope', ctx) === null && r.load('plain', ctx) === null;
  });
  t('load that throws, or returns undefined, is null', () => {
    const r = PS.create(); r.register(provider({ load: () => { throw new Error('x'); } })); r.register(provider({ id: 'u', load: () => undefined }));
    return r.load('demo', {}) === null && r.load('u', {}) === null;
  });
  t('a load that is not a function is refused at register', () => { try { PS.create().register(provider({ load: 5 })); return false; } catch (e) { return /load must be a function/.test(e.message); } });
  t('readerFor parses JSON, and is undefined for missing, broken or a refusing storage', () => {
    const store = { a: '{"x":1}', b: '{oops', c: '0' };
    const rd = PS.readerFor({ getItem: k => (k in store ? store[k] : null) });
    const bad = PS.readerFor({ getItem: () => { throw new Error('blocked'); } });
    return rd('a').x === 1 && rd('b') === undefined && rd('zz') === undefined && rd('c') === 0 && bad('a') === undefined;
  });
  // moveTo (drag and drop)
  t('moveTo puts the dragged id where the target was, in both directions', () => PS.moveTo(['a', 'b', 'c', 'd'], 0, 2).join() === 'b,c,a,d' && PS.moveTo(['a', 'b', 'c', 'd'], 3, 1).join() === 'a,d,b,c');
  t('moveTo to the same place or out of range changes nothing', () =>
    PS.moveTo(['a', 'b'], 1, 1).join() === 'a,b' && PS.moveTo(['a', 'b'], 0, 5).join() === 'a,b' && PS.moveTo(['a', 'b'], -1, 0).join() === 'a,b' && PS.moveTo(['a', 'b'], 0, -1).join() === 'a,b');
  t('moveTo returns a copy', () => { const a = ['a', 'b']; const b = PS.moveTo(a, 0, 1); return a.join() === 'a,b' && b !== a; });
  // move
  t('move swaps with the neighbour', () => PS.move(['a', 'b', 'c'], 1, -1).join() === 'b,a,c' && PS.move(['a', 'b', 'c'], 1, 1).join() === 'a,c,b');
  t('move at an edge or out of range changes nothing', () =>
    PS.move(['a', 'b'], 0, -1).join() === 'a,b' && PS.move(['a', 'b'], 1, 1).join() === 'a,b' && PS.move(['a', 'b'], 5, 1).join() === 'a,b' && PS.move(['a', 'b'], -1, 1).join() === 'a,b');
  t('the storage keys are the names the page and the registry use', () => PS.LAYOUT_KEY === 'gvb-packet:layout.v1' && PS.PRESETS_KEY === 'gvb-packet:presets.v1');
  return out;
}

const MUTANTS = [
  ['esc leaves < alone', s => s.replace(".replace(/</g, '&lt;')", '')],
  ['esc leaves quotes alone', s => s.replace(".replace(/\"/g, '&quot;')", '')],
  ['toHtml skips escaping of p', s => s.replace("esc(b.text) + '</p>';\n      case 'note'", "b.text + '</p>';\n      case 'note'")],
  ['toHtml skips escaping of table cells', s => s.replace("'<td>' + esc(c)", "'<td>' + c")],
  ['toHtml skips escaping of kv', s => s.replace("'<dt>' + esc(r[0])", "'<dt>' + r[0]")],
  ['cleanBlock accepts any type', s => s.replace("BLOCK_TYPES.indexOf(b.type) < 0", 'false')],
  ['register allows duplicate ids', s => s.replace("if (find(p.id)) return", "if (false) return")],
  ['register skips the id pattern', s => s.replace("!ID_RE.test(p.id)", 'false')],
  ['evaluate lets a throw out', s => s.replace("try { r = p.evaluate(ctx); } catch (e) { r = null; }", 'r = p.evaluate(ctx);')],
  ['build lets a throw out', s => s.replace("try { r = p.build(ctx, opts || {}); } catch (e) { r = null; }", 'r = p.build(ctx, opts || {});')],
  ['build ignores availability', s => s.replace("if (!evaluateOne(p, ctx).available) { skipped.push({ id: id, why: 'unavailable' }); return; }", '')],
  ['build builds a repeat twice', s => s.replace("if (seen[id]) return;\n        seen[id] = true;\n        var p", "var p")],
  ['available is truthy, not true', s => s.replace("r.available === true", '!!r.available')],
  ['cleanIds keeps unknown ids', s => s.replace("if (known.indexOf(id) < 0) dropped.push(id); else out.push(id);", 'out.push(id);')],
  ['cleanIds keeps repeats', s => s.replace("if (seen[id]) return;\n      seen[id] = true;\n      if (known", "if (known")],
  ['parseLayout ignores the version', s => s.replace("if (!isObj(raw) || raw.v !== 1) return { ids: [], dropped: [] };", "if (!isObj(raw)) return { ids: [], dropped: [] };")],
  ['savePreset is case-sensitive', s => s.replace("p.name.toLowerCase() === n.toLowerCase()", "p.name === n")],
  ['savePreset ignores the cap', s => s.replace("else if (out.length < MAX_PRESETS) out.push(rec)", 'else out.push(rec)')],
  ['parsePresets allows repeated names', s => s.replace("if (!name || seen[key] ||", "if (!name ||")],
  ['parsePresets ignores the cap', s => s.replace(" || out.length >= MAX_PRESETS", '')],
  ['deletePreset is case-sensitive', s => s.replace("p.name.toLowerCase() !== String(name).trim().toLowerCase()", "p.name !== String(name)")],
  ['load lets a throw through', s => s.replace('try { var r = p.load(ctx); return r === undefined ? null : r; } catch (e) { return null; }', 'var r = p.load(ctx); return r === undefined ? null : r;')],
  ['load returns undefined for nothing', s => s.replace('return r === undefined ? null : r;', 'return r;')],
  ['load answers for an unknown id', s => s.replace('if (!p || !p.load) return null;', 'if (!p.load) return null;')],
  ['register takes a bad load', s => s.replace("if (p.load !== undefined && typeof p.load !== 'function') return 'load must be a function when given';", '')],
  ['readerFor lets a bad value throw', s => s.replace('} catch (e) { return undefined; }\n    };', '} catch (e) { throw e; }\n    };')],
  ['readerFor reads a missing key as null', s => s.replace('raw === null || raw === undefined ? undefined : JSON.parse(raw)', 'raw === undefined ? undefined : JSON.parse(raw)')],
  ['moveTo drops the dragged id', s => s.replace('out.splice(to, 0, one);', '')],
  ['moveTo inserts one place late', s => s.replace('out.splice(to, 0, one);', 'out.splice(to + 1, 0, one);')],
  ['moveTo accepts an index past the end', s => s.replace('from >= ids.length || to >= ids.length', 'from >= ids.length')],
  ['move wraps at the edge', s => s.replace("j < 0 || j >= ids.length", 'false')],
  ['storageKeys keeps repeats', s => s.replace("if (!seen[k]) { seen[k] = true; out.push(k); }", 'out.push(k);')],
  ['list leaks the build function', s => s.replace("storageKeys: p.storageKeys.slice() } : null; }", "storageKeys: p.storageKeys.slice(), build: p.build } : null; }")],
  ['the default registry is shared', s => s.replace("var list = [];\n\n    function find", "var list = root.__shared || (root.__shared = []);\n\n    function find")],
  ['table rows are not capped', s => s.replace("b.rows.slice(0, MAX_ROWS).map(strs)", 'b.rows.map(strs)')],
  ['heading level is free', s => s.replace("b.level === 3 ? 3 : 2", 'b.level')],
  ['text is not capped', s => s.replace("v.slice(0, MAX_TEXT) : (typeof", "v : (typeof")]
];

let failed = 0;
const base = checks(load(SRC));
for (const c of base) if (!c.ok) { failed++; console.log('FAIL ' + c.name + (c.msg ? ' -- ' + c.msg : '')); }
console.log(`${base.length - failed}/${base.length} checks pass on sections.js`);

let survived = 0;
for (const [name, mutate] of MUTANTS) {
  const src = mutate(SRC);
  if (src === SRC) { survived++; console.log('FAIL mutant "' + name + '" did not change the source (its pattern is stale)'); continue; }
  let red = false;
  try { red = checks(load(src)).some(c => !c.ok); } catch (e) { red = true; }
  if (!red) { survived++; console.log('FAIL mutant survived: ' + name); }
}
console.log(`${MUTANTS.length - survived}/${MUTANTS.length} deliberate breaks caught`);
if (failed || survived) process.exit(1);
console.log('PASS sections.js');
