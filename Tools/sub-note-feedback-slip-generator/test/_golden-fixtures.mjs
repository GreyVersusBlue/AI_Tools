// _golden-fixtures.mjs — the saves smoke-saves.mjs replays against the golden
// taken from the page as it was before named saved slips (2026-10-06, the
// one-slip page at commit 4a13d48). Made-up wording only.
export const GOLDEN_FILE = new URL('./golden-old-slips.json', import.meta.url);

const p = (...texts) => texts.map((text, i) => ({ id: 'g' + i, text }));

export const FIXTURES = [
  { name: 'full save', saved: { copyCount: 3, prompts: p('Which table was loudest?', 'Did the quiz finish?', ''), classPeriod: '4th Period', urgencyBox: false } },
  { name: 'defaults saved', saved: { copyCount: 2, prompts: p('What worked well today?', 'What didn’t go as planned?', 'Any names or notes I should know for tomorrow?', 'Anything else the teacher should know?'), classPeriod: '', urgencyBox: true } },
  { name: 'no class period, no urgency field (an older save)', saved: { copyCount: 5, prompts: p('Who needs a call home?') } },
  { name: 'six wordy prompts, one-up', saved: { copyCount: 2, prompts: p('One?', 'Two?', 'Three?', 'Four?', 'Five?', 'Six <b>bold</b> & "quoted"?'), classPeriod: 'Team 6 — Blue', urgencyBox: true } },
  { name: 'nothing saved', saved: null },
  { name: 'saved with an empty prompt list (reads as nothing saved)', saved: { copyCount: 4, prompts: [], classPeriod: 'X', urgencyBox: true } },
];
