// np-pick.js — who gets called, and how fairly.
//
// This is a name picker's entire job and it was the one thing nothing in the
// project verified. Everything here is pure and takes an injectable `rng`, which
// is what lets test/smoke.mjs run a few hundred thousand draws and check the
// distribution with numbers instead of impressions.
//
// Two things were wrong before this file existed:
//
//   1. Every pick was an independent uniform draw. Over twenty-eight students
//      that calls the same student twice in a row about once every twenty-eight
//      picks, and after twenty-eight picks leaves roughly ten of them never
//      called at all (1 - (1-1/28)^28 ≈ 0.64 coverage). np_stats and np_history
//      were already tracking who had been called; nothing read them back.
//   2. makeGroups() shuffled with `sort(() => Math.random() - 0.5)`, which is not
//      a shuffle. The comparator is inconsistent, so the result depends on the
//      sort implementation and heavily favours leaving elements near where they
//      started. In V8 that means the first name in the roster lands in group 1
//      far more often than one in twelve. Fisher-Yates below is uniform.
//
// DOM-free. Imported by the page and by the Node suite.

/** Fisher-Yates. Uniform over all n! orderings; does not mutate the input. */
export function shuffle(list, rng = Math.random) {
  const out = Array.from(list);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A brand-new rotation. `remaining` is who has not been called this round. */
export function freshRotation() {
  return { remaining: [], last: null };
}

/**
 * One pick, without replacement inside a round.
 *
 * Everybody eligible gets called exactly once before anybody gets called twice.
 * When a round runs out it refills from the current eligible pool, and the first
 * draw of the new round excludes whoever was called last so a round boundary
 * cannot produce a back-to-back repeat. Roster of one is the only case that can
 * repeat, and it has no alternative.
 *
 * `eligible` is re-read every call, so marking a student absent or loading a
 * different period takes effect immediately without resetting anybody's turn:
 * names that left the pool are dropped from `remaining`, names that joined are
 * picked up at the next refill.
 *
 * Returns `{name, state}` and never mutates the state passed in. `name` is null
 * only when nobody is eligible.
 */
export function fairPick(state, eligible, rng = Math.random) {
  const pool = [];
  const seen = new Set();
  for (const n of eligible || []) {
    if (typeof n !== "string" || !n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    pool.push(n);
  }
  const last = state && typeof state.last === "string" ? state.last : null;
  if (!pool.length) return { name: null, state: { remaining: [], last } };

  let remaining = ((state && state.remaining) || []).filter(n => seen.has(n));
  if (!remaining.length) remaining = pool.slice();

  // Defer the previous pick when there is anyone else left to call.
  let candidates = remaining;
  if (remaining.length > 1 && last !== null && remaining.includes(last)) {
    candidates = remaining.filter(n => n !== last);
  }

  const name = candidates[Math.floor(rng() * candidates.length)];
  return { name, state: { remaining: remaining.filter(n => n !== name), last: name } };
}

/**
 * One independent uniform draw — what the tool did before, kept for when fair
 * rotation is switched off. Still avoids an immediate repeat, which the jump
 * animation already did by accident and a teacher notices.
 */
export function uniformPick(state, eligible, rng = Math.random) {
  const pool = Array.from(new Set((eligible || []).filter(n => typeof n === "string" && n)));
  const last = state && typeof state.last === "string" ? state.last : null;
  if (!pool.length) return { name: null, state: { remaining: [], last } };
  const candidates = pool.length > 1 && last !== null ? pool.filter(n => n !== last) : pool;
  const name = candidates[Math.floor(rng() * candidates.length)];
  return { name, state: { remaining: [], last: name } };
}

/** `fair ? fairPick : uniformPick`, so callers do not branch. */
export function pickOne(state, eligible, { fair = true, rng = Math.random } = {}) {
  return (fair ? fairPick : uniformPick)(state, eligible, rng);
}

/**
 * `count` distinct names in one go, for partners and small groups. Draws through
 * the same rotation so a multi-pick spends turns rather than sidestepping them —
 * pick 4 from 28 twice and you have called eight different students.
 */
export function pickMany(state, eligible, count, { fair = true, rng = Math.random } = {}) {
  const names = [];
  const chosen = new Set();
  let s = state;
  const want = Math.max(1, Math.floor(count) || 1);
  const pool = Array.from(new Set((eligible || []).filter(n => typeof n === "string" && n)));
  const total = Math.min(want, pool.length);
  // `left` shrinks so a single call cannot return the same name twice even when
  // the rotation refills part-way through.
  let left = pool.slice();
  for (let i = 0; i < total; i++) {
    const step = (fair ? fairPick : uniformPick)(s, left, rng);
    if (!step.name || chosen.has(step.name)) break;
    chosen.add(step.name);
    names.push(step.name);
    left = left.filter(n => n !== step.name);
    s = step.state;
  }
  return { names, state: s };
}

/**
 * Split a roster into `n` groups as evenly as the count allows. Uniform shuffle,
 * then deal round-robin, so group sizes differ by at most one.
 */
export function makeGroups(names, n, rng = Math.random) {
  const count = Math.max(2, Math.floor(n) || 2);
  const pool = shuffle(Array.from(new Set((names || []).filter(x => typeof x === "string" && x))), rng);
  const groups = Array.from({ length: count }, () => []);
  pool.forEach((name, i) => groups[i % count].push(name));
  return groups;
}

/**
 * Who is due. Reads np_stats so the panel can say it, rather than the counts
 * being recorded and never used.
 */
export function leastPicked(names, stats = {}) {
  const rows = (names || []).map(n => ({ name: n, count: Number(stats[n]) || 0 }));
  if (!rows.length) return [];
  const min = Math.min(...rows.map(r => r.count));
  return rows.filter(r => r.count === min).map(r => r.name);
}

export default {
  shuffle, freshRotation, fairPick, uniformPick, pickOne, pickMany, makeGroups, leastPicked
};
