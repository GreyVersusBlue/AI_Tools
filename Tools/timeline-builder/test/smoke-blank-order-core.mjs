// smoke-blank-order-core.mjs — pure-logic checks for the timeline worksheet's
// "what to blank / which events" choices and the printed ordering activity's
// deal (Tools/timeline-builder/tlb-worksheet.js). No browser.
//
//   node Tools/timeline-builder/test/smoke-blank-order-core.mjs
//
// What matters, and what is checked:
//
//   1. A worksheet saved before dates could be blanked means "titles, a seeded
//      pick of N" and picks exactly what it always did: the random pick is
//      recomputed here from the module's own seeded shuffle and must match
//      for every count and version, with or without the new options present.
//   2. Every nth: the right events, a different start per version, every event
//      blanked once across n versions, and never an untitled event.
//   3. Picked by hand: exactly the picked ids that exist and have a title, in
//      strip order; an id that is stale or hostile changes nothing.
//   4. Anything a link can carry in these fields is cleaned to a safe value.
//   5. The date bank is not the title bank's permutation: with "both" blanked
//      the i-th title would otherwise sit beside its own date.
//   6. The ordering deal: the same events and seed deal the same cards; with
//      three or more events (in more than one year) the deal is never in
//      order, over every seed and size; the key is the right order and each
//      key row names the card that holds it; ties are marked; Reshuffle's next
//      seed always changes the deal.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const shim = {};
new Function('global', fs.readFileSync(path.join(dir, '..', 'tlb-worksheet.js'), 'utf8'))(shim);
const W = shim.TimelineWorksheet;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const group = (name) => console.log('\n' + name);

const mk = (n, titled = () => true) => Array.from({ length: n }, (_, i) => ({
  id: 100 + i, title: titled(i) ? 'Event ' + i : '', yearStart: 1000 + i * 25
}));
const ids = (list) => list.map(e => e.id);
const scrambled = (events) => events.slice().reverse(); // storage order is not strip order

console.log('Timeline Builder — blanking choices and the ordering deal');

/* ── 1. the old pick is unchanged ───────────────────────────────────────── */
group('1. random pick, as before');
{
  const events = mk(12, i => i !== 4);
  const eligible = events.filter(e => e.title);
  let same = 0, total = 0;
  for (const count of [0, 1, 3, 5, 10, 11, 12, 40]) {
    for (const version of [1, 2, 3, 4]) {
      const n = Math.max(0, Math.min(eligible.length, count));
      let want;
      if (!n) want = [];
      else if (n === eligible.length) want = eligible;
      else want = W.shuffled(eligible, version * 9973).slice(0, n).sort((a, b) => a.yearStart - b.yearStart);
      const bare = W.chooseBlanks(scrambled(events), count, version);
      const withEmpty = W.chooseBlanks(scrambled(events), count, version, {});
      const withDefaults = W.chooseBlanks(scrambled(events), count, version, { kind: 'title', pick: 'random' });
      total++;
      if (JSON.stringify(ids(bare)) === JSON.stringify(ids(want)) &&
          JSON.stringify(ids(withEmpty)) === JSON.stringify(ids(want)) &&
          JSON.stringify(ids(withDefaults)) === JSON.stringify(ids(want))) same++;
    }
  }
  eq(same, total, 'every count and version picks what the old code picked');
  eq(ids(W.chooseBlanks(events, 5, 1)).includes(104), false, 'the untitled event is never picked');
}

/* ── 2. every nth ───────────────────────────────────────────────────────── */
group('2. every nth');
{
  const events = mk(10);
  eq(ids(W.chooseBlanks(scrambled(events), 0, 1, { pick: 'nth', nth: 3 })), [100, 103, 106, 109], 'every 3rd, version 1, in strip order');
  eq(ids(W.chooseBlanks(scrambled(events), 0, 2, { pick: 'nth', nth: 3 })), [101, 104, 107], 'version 2 starts one event later');
  eq(ids(W.chooseBlanks(events, 0, 4, { pick: 'nth', nth: 3 })), [100, 103, 106, 109], 'version 4 comes round to the start again');
  const seen = {};
  [1, 2, 3].forEach(v => W.chooseBlanks(events, 0, v, { pick: 'nth', nth: 3 }).forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; }));
  ok(Object.keys(seen).length === 10 && Object.values(seen).every(c => c === 1), 'across n versions each event is blanked exactly once');
  eq(ids(W.chooseBlanks(events, 0, 1, { pick: 'nth', nth: 1 })), ids(events), 'every 1st is every event');
  eq(ids(W.chooseBlanks(events, 0, 1, { pick: 'nth', nth: 99 })), [100, 102, 104, 106, 108], 'an nth over the limit is read as the default of 2');
  const gaps = mk(7, i => i % 2 === 0); // titled: 0,2,4,6
  eq(ids(W.chooseBlanks(gaps, 0, 1, { pick: 'nth', nth: 2 })), [100, 104], 'untitled events are skipped before counting, not after');
  eq(ids(W.chooseBlanks(events, 7, 1, { pick: 'nth', nth: 5 })), [100, 105], 'the count box is ignored when counting by nth');
}

/* ── 3. by hand ─────────────────────────────────────────────────────────── */
group('3. picked by hand');
{
  const events = mk(8, i => i !== 2);
  eq(ids(W.chooseBlanks(scrambled(events), 0, 1, { pick: 'hand', hand: [106, 101, 103] })), [101, 103, 106], 'the picked events, in strip order');
  eq(ids(W.chooseBlanks(events, 0, 1, { pick: 'hand', hand: [102, 105] })), [105], 'an untitled event cannot be picked');
  eq(ids(W.chooseBlanks(events, 0, 1, { pick: 'hand', hand: [999, '103', null, 104] })), [104], 'a stale id, a string and a null are ignored');
  eq(ids(W.chooseBlanks(events, 5, 1, { pick: 'hand', hand: [] })), [], 'nobody picked means nothing blanked, not the count box');
  eq(ids(W.chooseBlanks(events, 0, 3, { pick: 'hand', hand: [101, 107] })), [101, 107], 'the same picks on every version');
  const items = W.buildItems(events, 0, 1, { pick: 'hand', hand: [107, 101] });
  eq(items.map(i => [i.number, i.event.id]), [[1, 101], [2, 107]], 'items are numbered along the strip');
}

/* ── 4. what a link can carry ───────────────────────────────────────────── */
group('4. normalizeBlank cleans what it is given');
{
  eq(W.normalizeBlank(undefined), { kind: 'title', pick: 'random', nth: 2, hand: [] }, 'nothing means the old behaviour');
  eq(W.normalizeBlank({ count: 5, versions: 1, wordBank: true }), { kind: 'title', pick: 'random', nth: 2, hand: [] }, 'an old saved worksheet means the old behaviour');
  eq(W.normalizeBlank({ kind: 'date', pick: 'nth', nth: 4, hand: [1, 2] }), { kind: 'date', pick: 'nth', nth: 4, hand: [1, 2] }, 'good values pass through');
  eq(W.normalizeBlank({ kind: '<img onerror=x>', pick: 'all' }).kind, 'title', 'an unknown kind is titles');
  eq(W.normalizeBlank({ kind: '<img onerror=x>', pick: 'all' }).pick, 'random', 'an unknown pick is random');
  eq(W.normalizeBlank({ nth: -3 }).nth, 2, 'a negative nth is 2');
  eq(W.normalizeBlank({ nth: 0.2 }).nth, 2, 'a nth that rounds to zero is 2');
  eq(W.normalizeBlank({ nth: 'x' }).nth, 2, 'a nth that is not a number is 2');
  eq(W.normalizeBlank({ nth: 7.4 }).nth, 7, 'a fractional nth is rounded');
  eq(W.normalizeBlank({ hand: [3, 3, '4', NaN, Infinity, {}, 5] }).hand, [3, 5], 'hand keeps finite numbers once each');
  eq(W.normalizeBlank({ hand: 'x' }).hand, [], 'a hand that is not a list is empty');
  eq(W.normalizeBlank('date').kind, 'title', 'a string is not a settings object');
  eq(W.normalizeBlank(null).pick, 'random', 'null is not a settings object');
}

/* ── 5. the date bank is not the title bank ─────────────────────────────── */
group('5. date bank');
{
  const events = mk(9);
  const items = W.buildItems(events, 9, 1);
  const label = (e) => 'D' + e.yearStart;
  const titles = W.wordBank(items, 1);
  const dates = W.dateBank(items, 1, label);
  eq(dates.slice().sort(), items.map(i => label(i.event)).sort(), 'the date bank holds exactly the removed dates');
  const samePermutation = titles.every((t, i) => label(items.find(it => it.event.title === t).event) === dates[i]);
  ok(!samePermutation, 'title i and date i of the banks are not the same event (they would pair the answers up)');
  eq(W.dateBank(items, 1, label), dates, 'a reprint of a version gives the same bank');
  ok(JSON.stringify(W.dateBank(items, 2, label)) !== JSON.stringify(dates), 'version 2 shuffles it differently');
  eq(W.dateBank([], 1, label), [], 'no blanks, no bank');
}

/* ── 6. the ordering deal ───────────────────────────────────────────────── */
group('6. ordering deal');
{
  const sortedIds = (n) => mk(n).map(e => e.id);
  let neverInOrder = 0, cases = 0, repeatable = 0, keyRight = 0, cardsHoldKey = 0;
  for (let n = 3; n <= 24; n++) {
    const events = scrambled(mk(n));
    for (let seed = 1; seed <= 60; seed++) {
      cases++;
      const d = W.deal(events, seed);
      const order = d.cards.map(c => c.event.id);
      if (JSON.stringify(order) !== JSON.stringify(sortedIds(n))) neverInOrder++;
      if (JSON.stringify(W.deal(events, seed)) === JSON.stringify(d)) repeatable++;
      if (JSON.stringify(d.key.map(k => k.event.id)) === JSON.stringify(sortedIds(n)) && d.key.every((k, i) => k.position === i + 1)) keyRight++;
      if (d.key.every(k => d.cards[k.label - 1].event.id === k.event.id) && d.cards.every((c, i) => c.label === i + 1)) cardsHoldKey++;
    }
  }
  eq(neverInOrder, cases, 'no seed deals 3..24 events in the right order (' + cases + ' deals)');
  eq(repeatable, cases, 'the same events and seed deal the same cards');
  eq(keyRight, cases, 'the key is the right order, numbered 1..n');
  eq(cardsHoldKey, cases, 'each key row names the card that holds its event, and cards are numbered 1..n in dealt order');

  // seeds beyond the small ones, and a seed that is hostile
  eq(W.cleanSeed(0), 1, 'seed 0 is 1');
  eq(W.cleanSeed(-5), 1, 'a negative seed is 1');
  eq(W.cleanSeed('x'), 1, 'a seed that is not a number is 1');
  eq(W.cleanSeed(7.9), 7, 'a fractional seed is floored');
  eq(W.cleanSeed(99999999999), 1, 'a seed over the limit is 1');
  eq(W.cleanSeed(2147483647), 2147483647, 'the largest seed stands');
  let big = 0;
  for (const seed of [1000003, 987654321, 2147483647]) if (JSON.stringify(W.deal(mk(9), seed).cards.map(c => c.event.id)) !== JSON.stringify(sortedIds(9))) big++;
  eq(big, 3, 'large seeds do not deal in order either');

  // a different seed is a different paper (mostly)
  const base = W.deal(mk(10), 1).cards.map(c => c.event.id).join();
  let differing = 0;
  for (let seed = 2; seed <= 30; seed++) if (W.deal(mk(10), seed).cards.map(c => c.event.id).join() !== base) differing++;
  ok(differing >= 27, 'other seeds usually deal differently: ' + differing + ' of 29');

  // untitled events have no card
  const some = mk(7, i => i !== 3);
  const d = W.deal(some, 1);
  eq(d.cards.length, 6, 'an untitled event has no card');
  ok(!d.cards.some(c => c.event.id === 103), 'and is not on the key');

  // two and one
  eq(W.deal(mk(2), 1).cards.length, 2, 'two events still deal');
  eq(W.deal(mk(1), 1).cards.length, 1, 'one event deals one card');
  eq(W.deal([], 1).cards.length, 0, 'no events, no cards');

  // ties
  const tied = [
    { id: 1, title: 'A', yearStart: 1900 }, { id: 2, title: 'B', yearStart: 1910 }, { id: 3, title: 'C', yearStart: 1910 },
    { id: 4, title: 'D', yearStart: 1950 }
  ];
  const dt = W.deal(tied, 5);
  eq(dt.key.map(k => k.tied), [false, true, true, false], 'events in one year are marked tied, the rest are not');
  const order = dt.cards.map(c => c.event.yearStart);
  ok(order.some((y, i) => i > 0 && y < order[i - 1]), 'a deal with ties is still not in order by year');

  // all in one year: nothing to get wrong, and no endless search
  const flat = [1, 2, 3, 4].map(i => ({ id: i, title: 'T' + i, yearStart: 1800 }));
  eq(W.deal(flat, 1).cards.length, 4, 'four events in one year still deal');

  // Reshuffle
  let changed = 0, trials = 0;
  for (const n of [3, 4, 5, 8]) {
    for (let seed = 1; seed <= 40; seed++) {
      trials++;
      const next = W.nextSeed(mk(n), seed);
      if (next !== seed && W.deal(mk(n), next).cards.map(c => c.event.id).join() !== W.deal(mk(n), seed).cards.map(c => c.event.id).join()) changed++;
    }
  }
  eq(changed, trials, 'the next seed always changes the deal, even with three events (' + trials + ' tries)');
  ok(W.nextSeed(mk(5), 2147483647) >= 1, 'the next seed after the largest wraps to a valid one');
  eq(W.nextSeed(mk(1), 3) > 0, true, 'one event: Reshuffle still returns a seed');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
