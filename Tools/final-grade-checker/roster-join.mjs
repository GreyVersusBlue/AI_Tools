// roster-join.mjs — which students on a class roster have no row in a pasted grade export, and
// which pasted rows are not on the roster. Pure; nothing here reads a page or stores a thing.
//
// The Final Grade Checker never persists grades, so this works on two lists held in memory: the
// students it parsed (`{ name }` each) and the roster's names (strings). A name is compared with
// case, accents, punctuation, spacing and "Last, First" against "First Last" all ignored, and
// with the order of its words ignored too, which is the swap that turns one student into two
// downstream. A name that does not match is NOT guessed at: it is listed, with at most one
// "close to" hint a person decides on. A match that is not one-to-one is named, never resolved:
//
//   missing     roster names no pasted row claims (a student with no grades to check)
//   extra       pasted rows no roster name claims (a student not on this roster)
//   duplicates  a pasted name that appears on more than one row
//   ambiguous   a pasted row that two roster names both fit (two Jordan Lees on the roster)
//   matched     [{ index, roster }] pasted row -> the roster name it was matched to
//
// The roster is the authority on who should be there; the paste is the authority on grades.

/** The comparison key for a name. */
export function nameKey(s) {
  let t = String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/[.,;'’"()\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.split(' ').filter(Boolean).sort().join(' ');
}

function editDistance(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** One roster name within a small edit of this key, when exactly one is: a hint, not a match. */
function closeTo(key, candidates) {
  const budget = Math.min(2, Math.floor(key.length / 4));
  if (budget < 1) return null;
  let best = null, bestD = budget + 1, tied = false;
  for (const c of candidates) {
    const d = editDistance(key, c.key, budget);
    if (d > budget) continue;
    if (d < bestD) { best = c; bestD = d; tied = false; } else if (d === bestD) tied = true;
  }
  return best && !tied ? best.name : null;
}

/**
 * @param students    [{ name }] as parsePastedData / the cards hold them
 * @param rosterNames [string]
 */
export function joinRoster(students, rosterNames) {
  const roster = [];
  const seenRoster = new Set();
  for (const n of rosterNames || []) {
    const name = String(n ?? '').replace(/\s+/g, ' ').trim();
    if (!name || seenRoster.has(name.toLowerCase())) continue;   // a roster listing a name twice is one student
    seenRoster.add(name.toLowerCase());
    roster.push({ name, key: nameKey(name) });
  }
  const byKey = new Map();
  roster.forEach(r => { if (!byKey.has(r.key)) byKey.set(r.key, []); byKey.get(r.key).push(r); });

  const claimed = new Set();
  const matched = [], extra = [], ambiguous = [];
  const rowsByKey = new Map();
  (students || []).forEach((st, index) => {
    const key = nameKey(st && st.name);
    if (!key) return;                                           // a row with no name cannot be matched
    if (!rowsByKey.has(key)) rowsByKey.set(key, []);
    rowsByKey.get(key).push(index);
    const hits = byKey.get(key) || [];
    if (hits.length === 1) { matched.push({ index, roster: hits[0].name }); claimed.add(hits[0].name); }
    else if (hits.length > 1) { ambiguous.push({ index, name: st.name, candidates: hits.map(h => h.name) }); hits.forEach(h => claimed.add(h.name)); }
    else extra.push({ index, name: st.name });
  });
  const unclaimed = roster.filter(r => !claimed.has(r.name));
  extra.forEach(e => { e.closeTo = closeTo(nameKey(e.name), unclaimed); });
  const duplicates = [...rowsByKey.values()].filter(ix => ix.length > 1)
    .map(ix => ({ name: students[ix[0]].name, indexes: ix }));
  return {
    matched, extra, ambiguous, duplicates,
    missing: unclaimed.map(r => r.name),
    rosterSize: roster.length,
    unnamed: (students || []).filter(st => !nameKey(st && st.name)).length,
  };
}
