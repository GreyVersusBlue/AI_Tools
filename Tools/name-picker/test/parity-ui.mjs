// parity-ui.mjs — Name Picker: np-ui.js against the winner code it replaced.
//
//   node Tools/name-picker/test/parity-ui.mjs
//
// Path 15 P1 step 7 moved 007's selectWinner, selectTournamentWinner and the dialogs around them (showWinnerModal,
// showMultiWinnerModal, the Done / Roll Again / Remove buttons and their helpers) into createWinnerUi(host). oldUi() below is
// that code copied byte for byte from 007 at v453 inside a function that supplies the page globals it read. Both versions run
// against the same recording fake DOM and host: for every combination of rarity, lucky student, Crazy, sudden death, prompt,
// cold-call and mode, every dialog button and Escape is pressed, and the event logs, the roster, the history and the
// Mythic count must be identical afterwards. Pure Node.

import { createWinnerUi } from '../np-ui.js';

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log('  FAIL ' + label + '\n    got  ' + JSON.stringify(a).slice(0, 600) + '\n    want ' + JSON.stringify(b).slice(0, 600)); }
};

/* frozen: 007 at v453. The page's globals it read come in through g; names, isRolling and the Mythic count are its own. */
function oldUi(g) {
  const { document, rollRarity, playWinSound, showConfetti, fireworkShow, shake, triggerSuddenDeathExplosion, bumpCombo, markUndoPoint, todayKey, incrementStats, addToHof, checkAchievements, saveHistory, updateHistoryUI, displayName, detailFor, escapeHtml, noteBoardRemoval, scatterNames, finishRolling, pickName } = g;
  let names = g.names, isRolling = true, sessionMythicCount = 0;
  let mode = g.mode, crazyMode = g.crazy, suddenDeath = g.suddenDeath, luckyStudent = g.luckyStudent, prompts = g.prompts;
  const history = g.history, nameCards = g.nameCards;
function selectWinner(winnerCard){
  winnerCard.el.classList.add('winner');
  const useRarity=document.getElementById('rarityEnabled').checked;
  const luckyBonus=luckyStudent===winnerCard.name;
  const rarity=useRarity?rollRarity(luckyBonus):null;
  playWinSound(rarity);
  showConfetti();
  if(crazyMode){
    fireworkShow();
    shake(rarity&&(rarity.name==='LEGENDARY'||rarity.name==='MYTHIC')?3:2);
  }
  if(suddenDeath){triggerSuddenDeathExplosion();}
  isRolling=false;
  bumpCombo();
  const promptText=pickRandomPrompt();
  markUndoPoint([winnerCard.name]);
  const entry={name:winnerCard.name,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),date:todayKey()};
  if(promptText)entry.prompt=promptText;
  history.push(entry);
  incrementStats(winnerCard.name);
  if(rarity&&['RARE','EPIC','LEGENDARY','MYTHIC'].includes(rarity.name)){addToHof(winnerCard.name,rarity);}
  if(rarity&&rarity.name==='MYTHIC'){sessionMythicCount++;}
  checkAchievements(rarity,winnerCard.name);
  saveHistory();updateHistoryUI();
  const coldCall=document.getElementById('coldCallMode').checked;
  setTimeout(()=>showWinnerModal(winnerCard,coldCall,rarity,promptText),700);
}

/* Set by "Same question, next student" and spent by the very next pick. */
let stickyPrompt=null;
function pickRandomPrompt(){
  if(stickyPrompt){const held=stickyPrompt;stickyPrompt=null;return held;}
  if(!document.getElementById('promptsEnabled').checked||!prompts.length)return null;
  return prompts[Math.floor(Math.random()*prompts.length)];
}

/* The name block on the winner modal, and the one place the Class Roster Hub
   detail is worth the most: a name the teacher is unsure how to say is exactly
   the name they are least likely to call on. */
function winnerNameHTML(name){
  const shown=displayName(name,detailFor(name));
  return `<div class="winner-name">${escapeHtml(shown.big)}</div>`+
         (shown.sub?`<div class="winner-sub">${escapeHtml(shown.sub)}</div>`:'')+
         (shown.say?`<div class="winner-say">say: ${escapeHtml(shown.say)}</div>`:'');
}

function showWinnerModal(winnerCard,coldCallMode,rarity,prompt){
  const overlay=document.createElement('div');
  overlay.className='modal-overlay';
  const rarityHTML=rarity?`<div class="rarity-banner ${rarity.class}">${rarity.emoji} ${rarity.name} PICK ${rarity.emoji}</div>`:'';
  const promptHTML=prompt?`<div class="prompt-task"><div class="prompt-task-label">📝 TASK</div>${escapeHtml(prompt)}</div>`:'';
  /* "Same question, next student" is the whole point of attaching a prompt to a
     pick: a discussion question is asked of three or four students in a row, and
     re-rolling used to throw the question away and draw a new one. */
  const sameHTML=prompt?`<button id="modalSameQ">Same question, next student</button>`:'';
  overlay.innerHTML=`<div class="modal ${crazyMode?'crazy':''}">${rarityHTML}<div class="modal-label">🎉 Selected!</div>${winnerNameHTML(winnerCard.name)}${promptHTML}<div class="modal-buttons"><button class="btn-primary" id="modalDone">Done</button><button id="modalRoll">Roll Again</button>${sameHTML}<button id="modalRemoveRoll">Remove &amp; Roll Again</button></div></div>`;
  document.body.appendChild(overlay);
  const cleanup=()=>{overlay.remove();document.removeEventListener('keydown',escHandler);};
  const escHandler=(e)=>{if(e.key==='Escape'){cleanup();handleDone(winnerCard,coldCallMode);}};
  document.addEventListener('keydown',escHandler);
  document.getElementById('modalDone').onclick=()=>{cleanup();handleDone(winnerCard,coldCallMode);};
  document.getElementById('modalRoll').onclick=()=>{cleanup();handleRollAgain(winnerCard,coldCallMode);};
  document.getElementById('modalRemoveRoll').onclick=()=>{cleanup();handleRemoveAndRoll(winnerCard);};
  if(prompt)document.getElementById('modalSameQ').onclick=()=>{cleanup();stickyPrompt=prompt;handleRollAgain(winnerCard,coldCallMode);};
}

function showMultiWinnerModal(winners){
  const overlay=document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal ${crazyMode?'crazy':''}"><div class="modal-label">🎉 ${winners.length} Selected!</div><div class="multi-pick-list">${winners.map(n=>{const d=displayName(n,detailFor(n));return `<div class="multi-pick-name">${escapeHtml(d.big)}${d.sub?` <span style="opacity:.6;font-size:.75em;">${escapeHtml(d.sub)}</span>`:''}</div>`;}).join('')}</div><div class="modal-buttons"><button class="btn-primary" id="multiDone">Done</button><button id="multiRoll">Roll Again</button><button id="multiRemoveRoll">Remove All &amp; Roll Again</button></div></div>`;
  document.body.appendChild(overlay);
  const cleanup=()=>{overlay.remove();document.removeEventListener('keydown',escHandler);};
  const escHandler=(e)=>{if(e.key==='Escape'){cleanup();finishRolling();cleanupMultiWinners(false);}};
  document.addEventListener('keydown',escHandler);
  const coldCall=document.getElementById('coldCallMode').checked;
  document.getElementById('multiDone').onclick=()=>{cleanup();cleanupMultiWinners(coldCall,winners);finishRolling();};
  document.getElementById('multiRoll').onclick=()=>{cleanup();cleanupMultiWinners(coldCall,winners);finishRolling();setTimeout(pickName,250);};
  document.getElementById('multiRemoveRoll').onclick=()=>{cleanup();noteBoardRemoval();names=names.filter(n=>!winners.includes(n));scatterNames();finishRolling();setTimeout(pickName,250);};
}

function cleanupMultiWinners(coldCall,winners){
  if(coldCall&&winners){names=names.filter(n=>!winners.includes(n));scatterNames();}
  else{nameCards.forEach(c=>c.el.classList.remove('winner'));}
}

function handleDone(winnerCard,coldCallMode){
  winnerCard.el.classList.remove('winner');
  if(coldCallMode){
    names=names.filter(n=>n!==winnerCard.name);
    if(mode==='disappear')scatterNames();
    else removeCardSilently(winnerCard);
  }
  finishRolling();
}

function handleRollAgain(winnerCard,coldCallMode){
  if(coldCallMode){noteBoardRemoval();names=names.filter(n=>n!==winnerCard.name);}
  if(mode==='disappear')scatterNames();
  else{winnerCard.el.classList.remove('winner');if(coldCallMode)removeCardSilently(winnerCard);}
  finishRolling();
  setTimeout(()=>pickName(),250);
}

function handleRemoveAndRoll(winnerCard){
  noteBoardRemoval();
  names=names.filter(n=>n!==winnerCard.name);
  if(mode==='disappear')scatterNames();
  else removeCardSilently(winnerCard);
  finishRolling();
  setTimeout(()=>pickName(),250);
}

function removeCardSilently(card){
  card.active=false;
  card.el.classList.remove('winner');
  card.el.classList.add('fading');
  setTimeout(()=>{if(card.el&&card.el.parentNode)card.el.remove();},500);
}
function selectTournamentWinner(winnerCard){
  winnerCard.el.classList.add('winner-tile');
  const useRarity=document.getElementById('rarityEnabled').checked;
  const luckyBonus=luckyStudent===winnerCard.name;
  const rarity=useRarity?rollRarity(luckyBonus):null;
  playWinSound(rarity);
  showConfetti();
  if(crazyMode){fireworkShow();shake(rarity&&(rarity.name==='LEGENDARY'||rarity.name==='MYTHIC')?3:2);}
  if(suddenDeath){triggerSuddenDeathExplosion();}
  isRolling=false;
  bumpCombo();
  const promptText=pickRandomPrompt();
  markUndoPoint([winnerCard.name]);
  const entry={name:winnerCard.name,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),date:todayKey()};
  if(promptText)entry.prompt=promptText;
  history.push(entry);
  incrementStats(winnerCard.name);
  if(rarity&&['RARE','EPIC','LEGENDARY','MYTHIC'].includes(rarity.name)){addToHof(winnerCard.name,rarity);}
  if(rarity&&rarity.name==='MYTHIC')sessionMythicCount++;
  checkAchievements(rarity,winnerCard.name);
  saveHistory();updateHistoryUI();
  const coldCall=document.getElementById('coldCallMode').checked;
  setTimeout(()=>{
    const overlay=document.createElement('div');
    overlay.className='modal-overlay';
    const rarityHTML=rarity?`<div class="rarity-banner ${rarity.class}">${rarity.emoji} ${rarity.name} PICK ${rarity.emoji}</div>`:'';
    const prompt=promptText;
    const promptHTML=prompt?`<div class="prompt-task"><div class="prompt-task-label">📝 TASK</div>${escapeHtml(prompt)}</div>`:'';
    overlay.innerHTML=`<div class="modal ${crazyMode?'crazy':''}">${rarityHTML}<div class="modal-label">🏆 Selected!</div>${winnerNameHTML(winnerCard.name)}${promptHTML}<div class="modal-buttons"><button class="btn-primary" id="tDone">Done</button><button id="tRoll">Roll Again</button><button id="tRemoveRoll">Eliminate &amp; Roll</button></div></div>`;
    document.body.appendChild(overlay);
    const cleanup=()=>{overlay.remove();};
    document.getElementById('tDone').onclick=()=>{cleanup();winnerCard.el.classList.remove('winner-tile');if(coldCall){winnerCard.active=false;winnerCard.el.classList.add('eliminated');names=names.filter(n=>n!==winnerCard.name);}finishRolling();};
    document.getElementById('tRoll').onclick=()=>{cleanup();winnerCard.el.classList.remove('winner-tile');if(coldCall){noteBoardRemoval();winnerCard.active=false;winnerCard.el.classList.add('eliminated');names=names.filter(n=>n!==winnerCard.name);}finishRolling();setTimeout(pickName,250);};
    document.getElementById('tRemoveRoll').onclick=()=>{cleanup();noteBoardRemoval();winnerCard.active=false;winnerCard.el.classList.add('eliminated');names=names.filter(n=>n!==winnerCard.name);finishRolling();setTimeout(pickName,250);};
  },700);
}
  return {
    selectWinner, selectTournamentWinner, showMultiWinnerModal,
    names: () => names, mythic: () => sessionMythicCount, rolling: () => isRolling,
    set(k, v) { ({ mode: () => { mode = v; }, crazy: () => { crazyMode = v; }, suddenDeath: () => { suddenDeath = v; }, luckyStudent: () => { luckyStudent = v; }, prompts: () => { prompts = v; } })[k](); },
  };
}

/* ---------- the world both versions run in ---------- */
const RARITIES = {
  none: null,
  common: { name: 'COMMON', class: 'r-common', emoji: '⚪' },
  rare: { name: 'RARE', class: 'r-rare', emoji: '🔷' },
  legendary: { name: 'LEGENDARY', class: 'r-leg', emoji: '🌟' },
  mythic: { name: 'MYTHIC', class: 'r-myth', emoji: '💎' },
};

function makeWorld(o) {
  const log = [];
  const timers = [];
  const els = new Map();
  const docListeners = [];
  const mkEl = (key) => {
    const el = { key, checked: false, onclick: null, className: '', _html: '', _text: '', classes: new Set(),
      get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; log.push(['html', key, v]); },
      get textContent() { return this._text; }, set textContent(v) { this._text = v; },
      remove() { log.push(['remove', key]); this.parentNode = null; }, parentNode: {} };
    return el;
  };
  const byId = (id) => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };
  byId('rarityEnabled').checked = o.useRarity;
  byId('coldCallMode').checked = o.coldCall;
  byId('promptsEnabled').checked = o.promptsOn;
  let overlays = 0;
  const document = {
    getElementById: byId,
    createElement: (tag) => { const e = mkEl('new:' + tag + ':' + (overlays++)); return new Proxy(e, { set(t, k, v) { if (k === 'className') log.push(['class', t.key, v]); t[k] = v; return true; } }); },
    body: { appendChild: (c) => log.push(['body-append', c.className]) },
    addEventListener: (t, fn) => { docListeners.push([t, fn]); log.push(['doc-on', t]); },
    removeEventListener: (t) => { log.push(['doc-off', t]); const i = docListeners.findIndex((l) => l[0] === t); if (i >= 0) docListeners.splice(i, 1); },
  };
  const cards = o.names.map((name) => {
    return { name, active: true, el: {
      classList: { add: (c) => log.push([name, 'add', c]), remove: (c) => log.push([name, 'remove', c]) },
      remove: () => log.push([name, 'el-remove']), parentNode: {},
    } };
  });
  const hist = [];
  const pass = (n) => (...a) => { log.push([n, ...a.map((x) => (x && x.name) || x)]); };
  const fns = {
    document,
    rollRarity: (l) => { log.push(['roll', l]); return RARITIES[o.rarity]; },
    playWinSound: pass('winSound'), showConfetti: pass('confetti'), fireworkShow: pass('fireworks'), shake: pass('shake'),
    triggerSuddenDeathExplosion: pass('explosion'), bumpCombo: pass('combo'), markUndoPoint: (w) => log.push(['undo', JSON.stringify(w)]),
    todayKey: () => '2026-10-29', incrementStats: pass('stats'), addToHof: (n, r) => log.push(['hof', n, r.name]),
    checkAchievements: (r, n) => log.push(['achievements', r && r.name, n]), saveHistory: pass('save'), updateHistoryUI: pass('historyUI'),
    displayName: (n, d) => ({ big: n + (d ? '!' : ''), sub: o.sub ? 'sub ' + n : '', say: o.say ? 'say ' + n : '' }),
    detailFor: (n) => (o.sub ? { n } : null), escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    noteBoardRemoval: pass('note-removal'), scatterNames: pass('scatter'), finishRolling: pass('finish'), pickName: pass('pickName'),
  };
  return { log, timers, els, docListeners, cards, hist, fns, document, byId };
}

async function run(which, o, steps) {
  const w = makeWorld(o);
  const realST = globalThis.setTimeout, realLocale = Date.prototype.toLocaleTimeString, realRand = Math.random;
  let seed = 17;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  globalThis.setTimeout = (f, ms) => { w.timers.push([ms, f]); return w.timers.length; };
  Date.prototype.toLocaleTimeString = () => '03:04 PM';
  let names = o.names.slice();
  const state = { mode: o.mode, crazy: o.crazy, suddenDeath: o.sudden, luckyStudent: o.lucky, prompts: o.prompts };
  let rolling = true, mythic = 0;
  let ui;
  try {
    if (which === 'old') {
      ui = oldUi({ ...w.fns, names, mode: o.mode, crazy: o.crazy, suddenDeath: o.sudden, luckyStudent: o.lucky, prompts: o.prompts, history: w.hist, nameCards: w.cards });
    } else {
      const f = w.fns;
      const impl = createWinnerUi({ ...f,
        names: () => names, setNames: (l) => { names = l; }, mode: () => state.mode, crazy: () => state.crazy, suddenDeath: () => state.suddenDeath,
        luckyStudent: () => state.luckyStudent, prompts: () => state.prompts, history: () => w.hist, nameCards: () => w.cards,
        setRolling: (v) => { rolling = v; }, bumpMythic: () => { mythic++; } });
      ui = { ...impl, names: () => names, mythic: () => mythic, rolling: () => rolling };
    }
    const card = w.cards[o.winner];
    const flush = () => { while (w.timers.length) { const [ms, f] = w.timers.shift(); w.log.push(['timer', ms]); f(); } };
    if (o.fn === 'multi') ui.showMultiWinnerModal(o.multi); else ui[o.fn](card);
    flush();
    for (const id of steps) {
      if (id === 'Escape') { for (const [t, fn] of w.docListeners.slice()) if (t === 'keydown') fn({ key: 'Escape' }); }
      else if (id === 'AGAIN') ui[o.fn](card);
      else if (id === 'OtherKey') { for (const [t, fn] of w.docListeners.slice()) if (t === 'keydown') fn({ key: 'a' }); }
      else { const b = w.byId(id); w.log.push(['click', id]); if (b.onclick) b.onclick(); }
      flush();
    }
  } finally { globalThis.setTimeout = realST; Date.prototype.toLocaleTimeString = realLocale; Math.random = realRand; }
  w.log.push(['end', JSON.stringify(ui.names()), ui.mythic(), ui.rolling(), JSON.stringify(w.hist)]);
  return w.log;
}

const NAMES = ['Ada', 'Bo', 'Cy'];
let cases = 0, events = 0;
async function both(label, o, steps) {
  const a = await run('old', o, steps), b = await run('new', o, steps);
  cases++; events += a.length;
  eq(b, a, label);
}

console.log('Name Picker — winner UI parity');
const base = { names: NAMES, winner: 1, mode: 'jump', crazy: false, sudden: false, lucky: null, prompts: [], promptsOn: false, useRarity: false, rarity: 'none', coldCall: false, sub: false, say: false };

/* selectWinner: every effect branch, then every button */
for (const rarity of ['none', 'common', 'rare', 'legendary', 'mythic']) for (const crazy of [false, true]) for (const sudden of [false, true]) for (const lucky of [null, 'Bo']) {
  await both(`selectWinner ${rarity} crazy=${crazy} sudden=${sudden} lucky=${lucky}`, { ...base, fn: 'selectWinner', rarity, useRarity: rarity !== 'none', crazy, sudden, lucky }, ['modalDone']);
}
for (const coldCall of [false, true]) for (const mode of ['jump', 'disappear']) for (const prompts of [[], ['Why?', 'How?']]) for (const sub of [false, true]) {
  for (const steps of [['modalDone'], ['modalRoll'], ['modalRemoveRoll'], ['Escape'], ['OtherKey', 'modalDone'], ['modalSameQ']]) {
    if (steps[0] === 'modalSameQ' && !prompts.length) continue;
    await both(`selectWinner buttons ${steps.join('+')} cold=${coldCall} mode=${mode} prompts=${prompts.length} sub=${sub}`,
      { ...base, fn: 'selectWinner', coldCall, mode, prompts, promptsOn: prompts.length > 0, sub, say: sub, useRarity: true, rarity: 'rare' }, steps);
  }
}
/* the sticky "same question" prompt is spent by the very next pick */
await both('same question then the next pick', { ...base, fn: 'selectWinner', prompts: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], promptsOn: true }, ['modalSameQ', 'AGAIN', 'modalDone', 'AGAIN', 'modalDone', 'AGAIN', 'modalDone', 'AGAIN']);
await both('prompts switched off', { ...base, fn: 'selectWinner', prompts: ['Q1'], promptsOn: false }, ['modalDone']);
/* selectTournamentWinner */
for (const rarity of ['none', 'rare', 'mythic']) for (const crazy of [false, true]) for (const sudden of [false, true]) for (const coldCall of [false, true]) {
  for (const steps of [['tDone'], ['tRoll'], ['tRemoveRoll']]) {
    await both(`selectTournamentWinner ${rarity} crazy=${crazy} sudden=${sudden} cold=${coldCall} ${steps[0]}`,
      { ...base, fn: 'selectTournamentWinner', rarity, useRarity: rarity !== 'none', crazy, sudden, coldCall, prompts: ['T?'], promptsOn: true, lucky: 'Bo' }, steps);
  }
}
/* pick several at once */
for (const coldCall of [false, true]) for (const crazy of [false, true]) {
  for (const steps of [['multiDone'], ['multiRoll'], ['multiRemoveRoll'], ['Escape']]) {
    await both(`multi ${steps[0]} cold=${coldCall} crazy=${crazy}`, { ...base, fn: 'multi', multi: ['Ada', 'Cy'], coldCall, crazy, sub: true }, steps);
  }
}
/* markup in a name reaches the dialog escaped, the same way */
await both('a name with markup', { ...base, names: ['<b>Ada</b>', 'B&"o'], winner: 0, fn: 'selectWinner', sub: true, say: true }, ['modalDone']);

if (events < 3000) { failed++; console.log('  FAIL recorded too little (' + events + ')'); } else passed++;
console.log(`${passed} passed, ${failed} failed (${cases} cases, ${events} events)`);
process.exit(failed ? 1 : 0);
