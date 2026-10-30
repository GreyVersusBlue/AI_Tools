// np-question-source.js — the Name Picker's second source of task prompts: the teacher's question bank.
//
// A pick can carry a prompt (np_history `prompt`, 300 characters). Until Path 15 P4 the only source was the typed list in
// np_prompts. This module turns questions from `_shared/question-bank.js` into the same thing: the question's TEXT (never its
// answer, choices or picture: the winner modal is on a projector) and, when the id is the teacher's own, that id as `qid` so a
// later reader can find the question again. A built-in set's `seed:` id is never stored (question-bank.js's rule).
//
// Pure: no storage, no DOM, no Math.random of its own (the bag takes an rng).

export const MAX_PROMPT = 300;     // np-store's cap on a history `prompt`
export const MAX_QID = 80;

const str = v => (typeof v === "string" ? v : v == null ? "" : String(v));

/** The id worth keeping on a history entry: a bank id, never a `seed:` id, 80 characters at most. '' when there is none. */
export function keepId(id) {
  const s = str(id).trim();
  return s && s.length <= MAX_QID && !/^seed:/i.test(s) ? s : "";
}

/** One question as a prompt: `{ text, qid }`, or null for a question with no words. */
export function toPrompt(q) {
  if (!q || typeof q !== "object") return null;
  const text = str(q.prompt).replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT);
  return text ? { text, qid: keepId(q.id) } : null;
}

/** The usable prompts of a list of questions, in order; a question whose words repeat an earlier one is dropped. */
export function usable(questions) {
  const seen = new Set(), out = [];
  for (const q of Array.isArray(questions) ? questions : []) {
    const p = toPrompt(q);
    if (!p || seen.has(p.text)) continue;
    seen.add(p.text);
    out.push(p);
  }
  return out;
}

/** The id of the prompt with exactly this text, or ''. */
export function idFor(items, text) {
  const t = str(text);
  const hit = (items || []).find(p => p.text === t);
  return hit ? hit.qid : "";
}

/**
 * A shuffled bag over `items`: next() gives every item once before any comes round again, and the first of a new round is
 * never the last of the one before (when there is more than one item). `rng` is () => [0, 1).
 */
export function createBag(items, rng = Math.random) {
  let list = (items || []).slice(), queue = [], last = null;
  function refill() {
    queue = list.slice();
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (queue.length > 1 && last !== null && queue[queue.length - 1] === last) {
      const k = Math.floor(rng() * (queue.length - 1));
      [queue[queue.length - 1], queue[k]] = [queue[k], queue[queue.length - 1]];
    }
  }
  return {
    size: () => list.length,
    next() {
      if (!list.length) return null;
      if (!queue.length) refill();
      last = queue.pop();
      return last;
    },
    reset(items2) { list = (items2 || []).slice(); queue = []; last = null; }
  };
}

export default { MAX_PROMPT, MAX_QID, keepId, toPrompt, usable, idFor, createBag };
