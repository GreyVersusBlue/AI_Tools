/* seating-rules.mjs — the page's half of the rule language (Path 14 P3).
   Pure: no DOM, no storage. The Rules block on 005 builds a rule here from its
   form, adds and removes it, prunes rules whose students or desks have gone, and
   words each one for the list. The solver reads rules; only this file writes them.

   A 2-member apart or together rule is also written to the old `apart` and
   `together` pair lists (rulesToLegacy), because a page cached from before rules
   existed reads only those, and absorbLegacy on load lets the lists win for pairs.
   The lists are rewritten after every change here. `rules` is created the first
   time a rule is added (the pairs already on the chart become Must rules then),
   so a chart that never uses the block is not changed. */
import { repairRule, rulesToLegacy, pairKey } from './seating.mjs';
import { normalizeRules, score } from './seating-solve.mjs';

export const FORM_KINDS = ['apart', 'together', 'partner', 'zone', 'space'];
export const ZONE_LABEL = {
  front: 'the front row', back: 'the back row', edge: 'an end-of-row desk', notEdge: 'a desk that is not at an end',
};
export const WEIGHT_LABEL = ['', 'a little', 'important', 'really want'];

const legacyRule = (kind, a, b) => ({
  id: `legacy:${kind}:${pairKey(a, b)}`, kind, hard: true, weight: 2, students: [a, b], desks: [], zone: '', anyOf: [], why: '',
});

/** Make `rules` exist, with today's pairs in it as Must rules. */
function ensureRules(section) {
  if (!Array.isArray(section.rules)) section.rules = [];
  if (!section.rules.length) {
    for (const [kind, list] of [['apart', section.apart], ['together', section.together]]) {
      for (const p of Array.isArray(list) ? list : []) if (Array.isArray(p) && p.length === 2) section.rules.push(legacyRule(kind, p[0], p[1]));
    }
  }
}
function mirror(section) {
  const { apart, together } = rulesToLegacy(section.rules);
  section.apart = apart; section.together = together;
}

/** buildRule(form, section, uid) → { rule } or { error: 'sentence for the teacher' }.
    form: { kind, students, anyOf, zone, desks, hard, weight, why }; `kind` is one of
    FORM_KINDS ('partner' is a together rule with anyOf); zone is a ZONE_LABEL key or 'desks'. */
export function buildRule(form, section, uid = () => Math.random().toString(36).slice(2, 9)) {
  const kind = form.kind;
  if (!FORM_KINDS.includes(kind)) return { error: 'Pick a kind of rule.' };
  const sset = new Set(section.students.map(s => s.id));
  const dset = new Set(section.desks.map(d => d.id));
  const students = [...new Set(form.students || [])].filter(id => sset.has(id));
  const anyOf = [...new Set(form.anyOf || [])].filter(id => sset.has(id) && !students.includes(id));
  const byDesks = kind === 'zone' && form.zone === 'desks';
  const desks = byDesks ? [...new Set(form.desks || [])].filter(id => dset.has(id)) : [];
  if ((kind === 'apart' || kind === 'together') && students.length < 2) return { error: 'Pick at least two students.' };
  if (kind === 'partner') {
    if (students.length !== 1) return { error: 'Pick one student who needs a partner.' };
    if (!anyOf.length) return { error: 'Pick at least one student who could be the partner.' };
  }
  if (kind === 'space' && !students.length) return { error: 'Pick at least one student.' };
  if (kind === 'zone') {
    if (!students.length) return { error: 'Pick at least one student for the zone.' };
    if (byDesks && !desks.length) return { error: 'Tap at least one desk on the floor.' };
    if (!byDesks && !Object.prototype.hasOwnProperty.call(ZONE_LABEL, form.zone)) return { error: 'Pick a zone.' };
  }
  const w = Math.round(Number(form.weight));
  const dropped = [];
  const rule = repairRule({
    id: 'rule:' + uid(), kind: kind === 'partner' ? 'together' : kind,
    hard: form.hard === true, weight: Number.isFinite(w) ? w : 2,
    students, desks, zone: byDesks ? '' : (kind === 'zone' ? form.zone : ''), anyOf: kind === 'partner' ? anyOf : [],
    why: typeof form.why === 'string' ? form.why : '',
  }, 0, sset, dset, dropped);
  if (!rule) return { error: 'That rule has too few students or desks.' };
  const same = (a, b) => JSON.stringify([a.kind, [...a.students].sort(), a.zone, [...a.desks].sort(), [...a.anyOf].sort()])
    === JSON.stringify([b.kind, [...b.students].sort(), b.zone, [...b.desks].sort(), [...b.anyOf].sort()]);
  const existing = Array.isArray(section.rules) && section.rules.length ? section.rules : pairRules(section);
  if (existing.some(r => same(r, rule))) return { error: 'That rule is already there.' };
  // a hard together over the same two students as a hard apart cannot both be kept
  if (rule.hard && !rule.anyOf.length && (rule.kind === 'apart' || rule.kind === 'together')) {
    const opp = rule.kind === 'apart' ? 'together' : 'apart';
    const clash = existing.find(r => r.kind === opp && r.hard && !r.anyOf.length && r.students.filter(s => rule.students.includes(s)).length >= 2);
    if (clash) return { error: `That clashes with a ${opp === 'apart' ? 'keep-apart' : 'put-together'} rule on the same students.` };
  }
  return { rule };
}
function pairRules(section) {
  const out = [];
  for (const [kind, list] of [['apart', section.apart], ['together', section.together]]) {
    for (const p of Array.isArray(list) ? list : []) if (Array.isArray(p) && p.length === 2) out.push(legacyRule(kind, p[0], p[1]));
  }
  return out;
}

export function addRule(section, rule) {
  ensureRules(section);
  section.rules.push(rule);
  mirror(section);
}
export function removeRule(section, id) {
  if (!Array.isArray(section.rules)) return false;
  const n = section.rules.length;
  section.rules = section.rules.filter(r => r.id !== id);
  if (section.rules.length === n) return false;
  mirror(section);
  return true;
}

/** Drop a gone student or desk from every rule; a rule left too small goes. True when anything changed. */
export function pruneRules(section) {
  if (!Array.isArray(section.rules) || !section.rules.length) return false;
  const sset = new Set(section.students.map(s => s.id));
  const dset = new Set(section.desks.map(d => d.id));
  const next = section.rules.map((r, i) => repairRule(r, i, sset, dset, [])).filter(Boolean);
  if (JSON.stringify(next) === JSON.stringify(section.rules)) return false;
  section.rules = next;
  mirror(section);
  return true;
}

/** describeRule(rule, nameOf, deskNo) → { text, strength, why } for the list. */
export function describeRule(r, nameOf, deskNo) {
  const names = ids => ids.map(nameOf).join(', ');
  let text;
  if (r.kind === 'apart') text = `Keep apart: ${names(r.students)}`;
  else if (r.kind === 'together' && r.anyOf.length) text = `${names(r.students)} needs a partner from: ${names(r.anyOf)}`;
  else if (r.kind === 'together') text = `${r.students.length > 2 ? 'Pod' : 'Put together'}: ${names(r.students)}`;
  else if (r.kind === 'zone') text = `${names(r.students)} in ${r.zone ? ZONE_LABEL[r.zone] : 'desk ' + r.desks.map(deskNo).join(', ')}`;
  else if (r.kind === 'space') text = `Needs room (no neighbour): ${names(r.students)}`;
  else if (r.kind === 'seat') text = `${names(r.students)} keeps desk ${r.desks.map(deskNo).join(', ')}`;
  else text = `Desk ${r.desks.map(deskNo).join(', ')} stays empty`;
  return { text, strength: r.hard ? 'Must' : `Want: ${WEIGHT_LABEL[r.weight] || 'important'}`, why: r.why || '' };
}

/** The section as it leaves the device in a link or a file: its rules without `why`, the reason the
    teacher wrote (the one field of a rule that can describe a child). A section with no rules is returned as is. */
export function forShare(section) {
  if (!section) return section;
  // A room belongs to this browser's chart (Path 14 P4): the link carries the desks, not the room id.
  const { room, ...rest } = section;
  if (!Array.isArray(rest.rules)) return room === undefined ? section : rest;
  return { ...rest, rules: rest.rules.map(r => ({ ...r, why: '' })) };
}

/** What the substitute's page says about the rules that are not plain pairs (the pairs keep their
    sentences from checkConstraints): { broken: [text], kept: [text] }, Must rules only, worded by
    describeRule, so it names the kind and the students and never the reason. */
export function subRules(section) {
  const nameById = {};
  for (const st of section.students || []) nameById[st.id] = st.name;
  const nameOf = id => nameById[id] || 'a student who has left';
  const deskNo = id => (section.desks || []).findIndex(d => d.id === id) + 1;
  const brokenIds = new Set(score(section, section.assign || {}).broken.filter(b => b.hard).map(b => b.ruleId));
  const out = { broken: [], kept: [] };
  for (const r of normalizeRules(section).rules) {
    if (!r.hard || r.kind === 'seat' || r.kind === 'empty') continue;
    if ((r.kind === 'apart' || r.kind === 'together') && r.students.length === 2 && !r.anyOf.length) continue;
    (brokenIds.has(r.id) ? out.broken : out.kept).push(describeRule(r, nameOf, deskNo).text);
  }
  return out;
}
