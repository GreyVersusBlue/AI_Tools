/* ---------------------------------------------------------------------------
   Seating Chart — "what was broken" in words (Path 14 P3).

   seating-solve.mjs returns ids and codes; this is where the sentence is
   written (Path 13's rule: the engine does not word anything). Pure, no DOM.
   Names go in as plain text, so the page puts every line into the document
   with textContent and nothing here is markup.

   explain(section, result) → [{ level, text }]
     level 'bad'   a hard rule is broken, or a student has no desk
     level 'note'  a wish is not met, or a rule was set aside
--------------------------------------------------------------------------- */
import { normalizeRules } from './seating-solve.mjs';

const many = (n, one, more) => (n === 1 ? one : more);

/** "A", "A and B", "A, B and C". */
export function nameList(list) {
  if (list.length <= 1) return list[0] || '';
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

const ZONE_WORDS = { front: 'the front row', back: 'the back row', edge: 'an end seat', notEdge: 'a seat with neighbours on both sides' };

export function explain(section, result) {
  const nameOf = {};
  for (const s of section.students || []) nameOf[s.id] = s.name;
  const nm = id => nameOf[id] || 'a student who has left';
  const names = ids => nameList((ids || []).map(nm));
  const either = ids => nameList(ids.map(nm)).replace(/ and ([^,]*)$/, ' or $1');
  const rules = {};
  for (const r of normalizeRules(section).rules) rules[r.id] = r;

  /** What a rule is for, as a phrase after "held by" / "was set aside". */
  const purpose = (kind, students, anyOf, zone) => {
    if (kind === 'apart') return `keeping ${names(students)} apart`;
    if (kind === 'together') {
      if (anyOf && anyOf.length) return `seating ${nm(students[0])} beside ${either(anyOf)}`;
      return students.length === 2 ? `seating ${names(students)} side by side` : `seating ${names(students)} together`;
    }
    if (kind === 'zone') return `seating ${names(students)} ${zone ? 'in ' + ZONE_WORDS[zone] : 'in the desks you marked'}`;
    if (kind === 'space') return `leaving ${names(students)} with no one beside them`;
    if (kind === 'seat') return `${names(students)}'s pinned seat`;
    return 'a desk left empty';
  };
  const holder = id => {
    const r = rules[id];
    if (!r) return null;
    return r.kind === 'seat' ? purpose('seat', r.students) : purpose(r.kind, r.students, r.anyOf, r.zone);
  };
  /** The broken state, as a clause. */
  const state = r => {
    const who = names(r.students), one = r.students.length === 1;
    switch (r.kind) {
      case 'apart': return `${who} ${r.students.length === 2 ? 'are' : 'include two who are'} side by side`;
      case 'together':
        if (r.anyOf && r.anyOf.length) return `${nm(r.students[0])} is not beside ${either(r.anyOf)}`;
        return r.students.length === 2 ? `${who} are not side by side` : `${who} are not all joined in one group`;
      case 'zone': return `${who} ${one ? 'is' : 'are'} not in ${r.zone ? ZONE_WORDS[r.zone] : 'the desks you marked'}`;
      case 'space': return `${who} ${one ? 'has' : 'have'} someone beside them`;
      case 'seat': return `${who} ${one ? 'is' : 'are'} not in the pinned seat`;
      default: return 'a desk meant to stay empty has a student in it';
    }
  };
  const IMPOSSIBLE = {
    'together-too-big': s => `${names(s)} are to sit together, but the room has no group of ${s.length} joined desks`,
    'zone-full': s => `${names(s)} are all to sit in a place with room for fewer than ${s.length}`,
    'apart-clique': s => `${names(s)} are all to be kept apart, but the room cannot seat that many with no two side by side`,
    'space-too-many': s => `${names(s)} each need room around them, and the room has no spot for that many`,
    'seat-twice': s => `${names(s)} is pinned to two different seats`,
    contradiction: s => `${names(s)} are to sit together and also to stay apart`,
  };

  const out = [];
  const seen = new Set();
  const say = (level, text) => { if (!seen.has(text)) { seen.add(text); out.push({ level, text }); } };

  for (const b of result.blame || []) {
    const r = rules[b.ruleId];
    if (!r) continue;
    if (b.cause === 'impossible') {
      const f = IMPOSSIBLE[b.code];
      say('bad', f ? `${f(b.students)}. No arrangement of this room can do that.` : `${state(r)}. No arrangement of this room can mend it.`);
    } else if (b.cause === 'held') {
      const holders = [...new Set(b.by.map(holder).filter(Boolean))];
      say('bad', holders.length
        ? `${state(r)}: every seat that would mend it is held by ${nameList(holders)}.`
        : `${state(r)}: no seat in the room would mend it.`);
    } else {
      say('bad', `${state(r)}. A swap would mend it and the search ran out: Shuffle tries again.`);
    }
  }

  for (const e of result.impossible || []) {
    if (e.code === 'no-room') say('bad', `The room has ${e.count} fewer ${many(e.count, 'desk', 'desks')} than students, so ${many(e.count, 'one student has', e.count + ' students have')} no desk.`);
  }
  const noDesk = (result.unseated || []).filter(id => nameOf[id]);
  if (noDesk.length && !out.some(o => / no desk\.$/.test(o.text))) say('bad', `${names(noDesk)} ${many(noDesk.length, 'has', 'have')} no desk.`);

  const soft = (result.broken || []).filter(b => !b.hard);
  for (const b of soft) {
    const r = rules[b.ruleId];
    if (r) say('note', `${state(r)}${r.why ? ' (' + r.why + ')' : ''}: a wish, not a must.`);
  }
  const by = id => soft.filter(b => b.ruleId === id).flatMap(b => b.students);
  const rep = by('pref:noRepeatSeat'), due = by('pref:frontRowRotation'), nbr = by('pref:newNeighbours');
  if (rep.length) say('note', `${names(rep)} ${many(rep.length, 'sits', 'sit')} where ${many(rep.length, 'they have', 'they have each')} sat before; every other desk broke a harder rule or was taken.`);
  if (due.length) say('note', `${names(due)} ${many(due.length, 'is', 'are')} still due the front row and ${many(due.length, 'is', 'are')} not in it.`);
  if (nbr.length) say('note', `${names(nbr)} ${many(nbr.length, 'has', 'have')} a neighbour from an earlier chart.`);
  if (soft.some(b => b.ruleId === 'pref:spreadEmpty')) say('note', 'Some empty desks are side by side.');

  for (const d of result.dropped || []) {
    if (d.code === 'contradiction' && d.students) {
      const other = d.byWhat ? purpose(d.byWhat.kind, d.byWhat.students) : 'another rule';
      say('note', `The rule ${purpose(d.kind, d.students)} was set aside: it contradicts ${other}.`);
    }
  }
  return out;
}
