// undo.test.mjs — pure-logic tests for _shared/undo.js (Path 14 P5): the
// snapshot stack the single-snapshot tools share.
//
//   node Tools/undo/test/undo.test.mjs   (or: npm run test:undo)
//
// undo.js is a classic script ending in `})(window or globalThis)`, so it runs
// here in a vm context. The same checks are then run against deliberate breaks
// of the module (MUTANTS below): each must turn at least one check red, or the
// suite fails, so a check that passes on a broken module is caught here.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = fs.readFileSync(path.join(ROOT, '_shared/undo.js'), 'utf8');

function load(src) {
  const ctx = { JSON, Math };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.UndoStack;
}

function checks(U) {
  const fails = [];
  const ok = (cond, name) => { if (!cond) fails.push(name); };
  const key = (o) => ({ ctrlKey: true, metaKey: false, shiftKey: false, target: { tagName: 'DIV' }, preventDefault() { this.pd = true; }, ...o });

  // one step: what a single-snapshot tool did
  let u = U.create();
  ok(u.undo() === null && !u.canUndo(), 'empty undo returns null');
  u.push({ n: 1 });
  ok(u.canUndo() && u.depth() === 1, 'push makes undo available');
  const back = u.undo();
  ok(back && back.n === 1 && !u.canUndo(), 'one undo returns the pushed state');

  // two steps, in reverse order
  u = U.create();
  u.push({ n: 1 }); u.push({ n: 2 });
  ok(u.undo().n === 2 && u.undo().n === 1 && u.undo() === null, 'two-step undo comes back newest first');

  // snapshots are copies
  const live = { list: [1] };
  u = U.create(); u.push(live); live.list.push(2);
  ok(u.undo().list.length === 1, 'a later edit does not reach into history');

  // limit
  u = U.create({ limit: 3 });
  for (let i = 0; i < 5; i++) u.push(i);
  ok(u.depth() === 3 && u.undo() === 4 && u.undo() === 3 && u.undo() === 2 && u.undo() === null, 'limit drops the oldest');
  ok(U.DEFAULT_LIMIT === 60, 'default limit is 60');
  u = U.create(); for (let i = 0; i < 70; i++) u.push(i);
  ok(u.depth() === 60, 'default keeps 60');

  // maxBytes
  u = U.create({ maxBytes: 10, serialize: String, parse: String });
  u.push('aaaa'); u.push('bbbb'); u.push('cccc');
  ok(u.depth() === 2 && u.undo() === 'cccc', 'maxBytes drops oldest until it fits');
  u = U.create({ maxBytes: 3, serialize: String, parse: String });
  u.push('toolongvalue');
  ok(u.depth() === 1 && u.undo() === 'toolongvalue', 'the newest step is kept however big');

  // redo
  u = U.create();
  u.push({ n: 1 });
  const cur = { n: 2 };
  const r1 = u.undo(cur);
  ok(r1.n === 1 && u.canRedo() && u.redoDepth() === 1, 'undo(current) fills redo');
  const r2 = u.redo(r1);
  ok(r2.n === 2 && u.canUndo() && !u.canRedo(), 'redo returns current and refills undo');
  u = U.create(); u.push(1);
  u.undo();
  ok(!u.canRedo(), 'undo without current leaves redo empty (005 behaviour)');
  u = U.create(); u.push(1); u.undo(5);
  u.push(9);
  ok(!u.canRedo(), 'a new push clears redo');
  u = U.create();
  ok(u.redo() === null, 'empty redo returns null');

  // pushRaw
  u = U.create(); u.pushRaw('{"x":7}');
  ok(u.undo().x === 7, 'pushRaw takes a string already made');

  // clear + onChange
  let calls = 0;
  u = U.create({ onChange: () => { calls++; } });
  u.push(1); u.undo(); u.clear();
  ok(calls === 3, 'onChange fires on push, undo and clear');
  u = U.create(); u.push(1); u.push(2); u.undo(3); u.clear();
  ok(!u.canUndo() && !u.canRedo(), 'clear empties both sides');

  // key handler
  u = U.create(); let did = '';
  let h = U.keyHandler(u, { undo: () => { did += 'u'; }, redo: () => { did += 'r'; } });
  let e = key({ key: 'z' }); h(e);
  ok(did === 'u' && e.pd, 'Ctrl+Z undoes and prevents default');
  e = key({ key: 'Z', shiftKey: true }); h(e);
  ok(did === 'ur', 'Ctrl+Shift+Z redoes');
  e = key({ key: 'y' }); h(e);
  ok(did === 'urr', 'Ctrl+Y redoes');
  e = key({ key: 'z', target: { tagName: 'INPUT' } }); h(e);
  ok(did === 'urr' && !e.pd, 'a text field keeps its own undo');
  e = key({ key: 'z', ctrlKey: false }); h(e);
  ok(did === 'urr', 'plain z does nothing');
  h = U.keyHandler(u, { undo: () => { did += 'u'; } });
  e = key({ key: 'y' }); h(e);
  ok(did === 'urr' && !e.pd, 'no redo action: Ctrl+Y is left alone');
  return fails;
}

const MUTANTS = {
  'push keeps live reference': (s) => s.replace('return api.pushRaw(serialize(state));', 'undoS.push(state); return;'),
  'limit ignored': (s) => s.replace('while (list.length > limit) list.shift();', ''),
  'newest step can be dropped by maxBytes': (s) => s.replace('list.length > 1) total', 'list.length > 0) total'),
  'undo pops the oldest': (s) => s.replace('var str = undoS.pop();', 'var str = undoS.shift();'),
  'push keeps redo': (s) => s.replace('undoS.push(str); redoS = [];', 'undoS.push(str);'),
  'undo always fills redo': (s) => s.replace("if (arguments.length && current !== undefined) { redoS.push", 'if (true) { redoS.push'),
  'key handler ignores text fields': (s) => s.replace("if (tag === 'input' || tag === 'textarea' || tag === 'select') return;", ''),
  'clear leaves redo': (s) => s.replace('undoS = []; redoS = []; changed', 'undoS = []; changed'),
};

let bad = 0;
const base = checks(load(SRC));
if (base.length) { bad++; console.log('FAIL', base.join('; ')); } else console.log('ok   module checks');
for (const [name, fn] of Object.entries(MUTANTS)) {
  const mutated = fn(SRC);
  if (mutated === SRC) { bad++; console.log('FAIL mutant did not apply:', name); continue; }
  let fails;
  try { fails = checks(load(mutated)); } catch (err) { fails = ['threw ' + err.message]; }
  if (!fails.length) { bad++; console.log('FAIL mutant survived:', name); } else console.log('ok   mutant caught:', name);
}
console.log(bad ? `FAIL ${bad}` : 'all passed');
process.exit(bad ? 1 : 0);
