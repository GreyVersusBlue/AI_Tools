// parity-modes.mjs — Name Picker: np-mode-jump / -disappear / -slot / -multi against the code they replaced.
//
//   node Tools/name-picker/test/parity-modes.mjs
//
// Path 15 P1 step 3 moved 007's jumpPick, disappearPick and slotPick into one module each, and
// step 4 multiPick. oldModes() below is that code, copied byte for byte from 007 at v449 and v450 inside a function that
// supplies the page globals it read. Both versions run against the same recording host and a
// recording fake DOM, with Math.random pinned to one seed and timers run in order; for every
// roster shape, Crazy on and off, the event logs must be identical. Pure Node.

import { jumpPick } from '../np-mode-jump.js';
import { disappearPick } from '../np-mode-disappear.js';
import { slotPick } from '../np-mode-slot.js';
import { multiPick } from '../np-mode-multi.js';
import { pickMany } from '../np-pick.js';

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log('  FAIL ' + label + '\n    got  ' + JSON.stringify(a).slice(0, 400) + '\n    want ' + JSON.stringify(b).slice(0, 400)); }
};

/* frozen: 007 at v449; every name it read from the page is a parameter of the wrapper */
function oldModes(g) {
  const { isSkipped, opts, drawWeights, playWinSound, showConfetti, fireworkShow, triggerSuddenDeathExplosion, markUndoPoint, history, todayKey, incrementStats, saveHistory, updateHistoryUI, bumpCombo, showMultiWinnerModal, suddenDeath } = g;
  let rotation = g.rotation;
  const { document, speed, setRollingState, finishRolling, chooseWinner, selectWinner, playBeep, shake, sleep, drawLightning, launchFirework, shuffle, requestAnimationFrame } = g;
  const nameCards = g.nameCards, crazyMode = g.crazyMode;
  let isRolling = false;
  void isRolling; /* the old code assigned it; it had no other reader in these three functions */
async function jumpPick(){
  isRolling=true;setRollingState(true);
  const activeCards=nameCards.filter(c=>c.active);
  if(activeCards.length===0){finishRolling();return;}
  const winnerCard=chooseWinner(activeCards);
  if(!winnerCard){finishRolling();return;}
  if(activeCards.length===1){selectWinner(winnerCard);return;}
  const winnerIdx=activeCards.indexOf(winnerCard);
  const dramatic=g.dramatic;
  const baseJumps=dramatic?16:10;
  const totalJumps=baseJumps+Math.floor(Math.random()*6);
  let lastIdx=-1,lastEl=null,currentDelay=speed;
  for(let i=0;i<totalJumps;i++){
    let idx;
    if(i===totalJumps-1)idx=winnerIdx;                 /* land on the chosen name */
    else{
      /* On the penultimate jump, stay off the winner so the last hop is a visible
         move rather than the same card lighting twice. */
      const avoidWinner=i===totalJumps-2&&activeCards.length>2;
      let guard=0;
      do{idx=Math.floor(Math.random()*activeCards.length);guard++;}
      while(guard<40&&((idx===lastIdx&&activeCards.length>1)||(avoidWinner&&idx===winnerIdx)));
    }
    activeCards.forEach(c=>c.el.classList.remove('highlighted'));
    activeCards[idx].el.classList.add('highlighted');
    playBeep(550+Math.random()*350,60);
    if(crazyMode){shake(1);if(lastEl)drawLightning(lastEl,activeCards[idx].el);}
    lastIdx=idx;lastEl=activeCards[idx].el;
    if(dramatic&&i>totalJumps*0.55)currentDelay=currentDelay*1.18;
    await sleep(currentDelay);
  }
  activeCards.forEach(c=>c.el.classList.remove('highlighted'));
  selectWinner(winnerCard);
}

async function disappearPick(){
  isRolling=true;setRollingState(true);
  const active=nameCards.filter(c=>c.active);
  if(active.length===0){finishRolling();return;}
  const winnerCard=chooseWinner(active);
  if(!winnerCard){finishRolling();return;}
  if(active.length===1){selectWinner(winnerCard);return;}
  /* Everyone but the winner goes, in a uniformly shuffled order. */
  for(const card of shuffle(active.filter(c=>c!==winnerCard))){
    if(crazyMode){
      const r=card.el.getBoundingClientRect();
      launchFirework(r.left+r.width/2,r.top+r.height/2,'#ffffff');
      shake(1);
    }
    card.el.classList.add('fading');
    card.active=false;
    playBeep(350+Math.random()*250,80,'sine',0.07);
    await sleep(speed);
    setTimeout(()=>{if(card.el)card.el.style.display='none';},450);
  }
  selectWinner(winnerCard);
}

async function slotPick(){
  isRolling=true;setRollingState(true);
  const activeCards=nameCards.filter(c=>c.active);
  if(activeCards.length===0){finishRolling();return;}
  const winnerCard=chooseWinner(activeCards);
  if(!winnerCard){finishRolling();return;}
  if(activeCards.length===1){selectWinner(winnerCard);return;}
  const overlay=document.createElement('div');
  overlay.className='slot-overlay';
  overlay.innerHTML=`<div class="slot-machine"><div class="slot-title">🎰 SPINNING... 🎰</div><div class="slot-reel"><div class="slot-strip" id="slotStrip"></div><div class="slot-line"></div></div></div>`;
  document.body.appendChild(overlay);
  const strip=overlay.querySelector('#slotStrip');
  const itemHeight=120,totalItems=60;
  const stripNames=[];
  for(let i=0;i<totalItems-1;i++)stripNames.push(activeCards[Math.floor(Math.random()*activeCards.length)].name);
  stripNames.push(winnerCard.name);
  stripNames.forEach(n=>{const item=document.createElement('div');item.className='slot-name';item.textContent=n;strip.appendChild(item);});
  const finalY=-((totalItems-1)*itemHeight);
  const duration=Math.max(1800,Math.min(4500,30000/Math.max(40,speed)*100));
  let startTime=null,lastTick=-1;
  return new Promise(resolve=>{
    function animate(t){
      if(!startTime)startTime=t;
      const elapsed=t-startTime;
      const progress=Math.min(elapsed/duration,1);
      const eased=1-Math.pow(1-progress,3);
      const y=finalY*eased;
      strip.style.transform=`translateY(${y}px)`;
      const itemIdx=Math.floor(Math.abs(y)/itemHeight);
      if(itemIdx!==lastTick&&progress<0.98){
        playBeep(900,30,'square',0.05);
        if(crazyMode&&itemIdx%3===0)shake(1);
        lastTick=itemIdx;
      }
      if(progress<1){requestAnimationFrame(animate);}
      else{
        playBeep(150,200,'sawtooth',0.15);
        shake(crazyMode?3:2);
        setTimeout(()=>{overlay.remove();selectWinner(winnerCard);resolve();},600);
      }
    }
    requestAnimationFrame(animate);
  });
}



async function multiPick(count){
  isRolling=true;setRollingState(true);
  const activeNames=nameCards.filter(c=>c.active).map(c=>c.name).filter(n=>!isSkipped(n));
  /* Draws through the same rotation, so picking four partners spends four turns
     rather than sidestepping the round. */
  const drawn=pickMany(rotation,activeNames,count,{fair:opts.fair,weights:drawWeights(activeNames)});
  rotation=drawn.state;
  const winners=drawn.names;
  if(!winners.length){finishRolling();return;}
  const activeCards=nameCards.filter(c=>c.active&&!isSkipped(c.name));
  const sweepCount=Math.min(18,Math.floor(20/(speed/100))+8);
  for(let i=0;i<sweepCount;i++){
    activeCards.forEach(c=>c.el.classList.remove('highlighted'));
    if(activeCards.length){const c=activeCards[Math.floor(Math.random()*activeCards.length)];c.el.classList.add('highlighted');}
    playBeep(550+Math.random()*350,50);
    if(crazyMode)shake(1);
    await sleep(speed*0.7);
  }
  activeCards.forEach(c=>c.el.classList.remove('highlighted'));
  winners.forEach(name=>{const card=nameCards.find(c=>c.name===name);if(card)card.el.classList.add('winner');});
  playWinSound(null);
  showConfetti(crazyMode);
  if(crazyMode){fireworkShow();shake(3);}
  if(suddenDeath){triggerSuddenDeathExplosion();}
  markUndoPoint(winners);
  winners.forEach(name=>{
    history.push({name,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),date:todayKey()});
    incrementStats(name);
  });
  saveHistory();updateHistoryUI();bumpCombo();
  setTimeout(()=>showMultiWinnerModal(winners),700);
}
  return { jumpPick, disappearPick, slotPick, multiPick, rotation: () => rotation };
}

function makeWorld({ n, crazy, dramatic, winner, speed, skip = [], fair = true, sudden = false, count = 3 }) {
  const log = [];
  const cards = Array.from({ length: n }, (_, i) => {
    const name = 'S' + i;
    return { name, active: true, el: {
      classList: { add: (c) => log.push([name, 'add', c]), remove: (c) => log.push([name, 'remove', c]) },
      style: new Proxy({}, { set: (t, k, v) => { log.push([name, 'style', k, v]); return true; } }),
      getBoundingClientRect: () => ({ left: 10 * i, top: 5 * i, width: 20, height: 8 }),
    } };
  });
  const makeEl = (tag, id) => {
    const el = { tag, id, children: [], style: new Proxy({}, { set: (t, k, v) => { log.push(['el:' + tag, 'style', k, v]); return true; } }),
      appendChild(c) { log.push(['el:' + tag, 'append', c.tag + ':' + (c.className || '')]); this.children.push(c); },
      querySelector(sel) { const s = makeEl('div', sel); this.strip = this.strip || s; return this.strip; },
      remove() { log.push(['el:' + tag, 'remove']); } };
    return new Proxy(el, { set: (t, k, v) => { if (k === 'className' || k === 'innerHTML' || k === 'textContent') log.push(['el:' + tag, k, v]); t[k] = v; return true; } });
  };
  let rotation = { seed: 1, round: 0 };   /* np-pick treats the state as opaque input; a fresh one is enough */
  const hist = [];
  const pass = (name) => (...a) => { log.push([name, ...a]); };
  const document = { createElement: (tag) => makeEl(tag), body: { appendChild: (c) => log.push(['body', 'append', c.className]) } };
  const timers = [], frames = [];
  const w = cards[winner] || null;
  const host = {
    document, speed: () => speed, crazy: () => crazy, dramatic: () => dramatic, cards: () => cards,
    begin: () => log.push(['begin']), finishRolling: () => log.push(['finish']),
    chooseWinner: (cs) => { log.push(['choose', cs.length]); return w && cs.includes(w) ? w : (winner === -1 ? null : cs[0]); },
    selectWinner: (c) => log.push(['select', c.name]),
    playBeep: (...a) => log.push(['beep', ...a.map((x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x))]),
    shake: (k) => log.push(['shake', k]), sleep: (ms) => { log.push(['sleep', ms]); return Promise.resolve(); },
    drawLightning: (a, b) => log.push(['lightning', cards.findIndex((c) => c.el === a), cards.findIndex((c) => c.el === b)]),
    launchFirework: (x, y, c) => log.push(['firework', x, y, c]),
    shuffle: (l) => { log.push(['shuffle', l.length]); return l.slice().reverse(); },
    requestAnimationFrame: (fn) => { frames.push(fn); },
    isSkipped: (nm) => skip.includes(nm), rotation: () => rotation, setRotation: (r) => { rotation = r; },
    options: () => ({ fair }), drawWeights: (list) => { log.push(['weights', list.length]); return null; },
    history: () => hist, suddenDeath: () => sudden,
    playWinSound: pass('winSound'), showConfetti: pass('confetti'), fireworkShow: pass('fireworks'),
    triggerSuddenDeathExplosion: pass('explosion'), markUndoPoint: pass('undo'), incrementStats: pass('stats'),
    saveHistory: pass('save'), updateHistoryUI: pass('historyUI'), bumpCombo: pass('combo'),
    todayKey: () => '2026-10-29', showMultiWinnerModal: pass('modal'),
  };
  const old = oldModes({
    document, speed: speed, nameCards: cards, crazyMode: crazy, dramatic,
    setRollingState: () => log.push(['begin']), finishRolling: host.finishRolling, chooseWinner: host.chooseWinner,
    selectWinner: host.selectWinner, playBeep: host.playBeep, shake: host.shake, sleep: host.sleep,
    drawLightning: host.drawLightning, launchFirework: host.launchFirework, shuffle: host.shuffle,
    requestAnimationFrame: host.requestAnimationFrame,
    isSkipped: host.isSkipped, opts: { fair }, rotation, drawWeights: host.drawWeights,
    playWinSound: host.playWinSound, showConfetti: host.showConfetti, fireworkShow: host.fireworkShow,
    triggerSuddenDeathExplosion: host.triggerSuddenDeathExplosion, markUndoPoint: host.markUndoPoint,
    history: hist, todayKey: host.todayKey, incrementStats: host.incrementStats, saveHistory: host.saveHistory,
    updateHistoryUI: host.updateHistoryUI, bumpCombo: host.bumpCombo, showMultiWinnerModal: host.showMultiWinnerModal,
    suddenDeath: sudden,
  });
  return { log, host, old, timers, frames, cards, hist, count, getRotation: () => rotation };
}

async function drive(which, fn, world) {
  const realST = globalThis.setTimeout, realRand = Math.random;
  let seed = 11;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  globalThis.setTimeout = (f, ms) => { world.timers.push([ms, f]); return world.timers.length; };
  const RealDate = globalThis.Date;
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : ['2026-10-29T15:04:00Z'])); } };
  try {
    const args = fn === 'multiPick' ? [world.count] : [];
    const p = which === 'old' ? world.old[fn](...args) : ({ jumpPick, disappearPick, slotPick, multiPick })[fn](world.host, ...args);
    let t = 0;
    /* run animation frames and timers until the mode resolves */
    let done = false; p.then(() => { done = true; });
    for (let guard = 0; guard < 4000 && !done; guard++) {
      await Promise.resolve(); await Promise.resolve();
      if (world.frames.length) { const f = world.frames.shift(); t += 50; f(t); continue; }
      if (world.timers.length) { const [ms, f] = world.timers.shift(); world.log.push(['timer', ms]); f(); continue; }
      if (!done) await new Promise((r) => realST(r, 0));
    }
    while (world.timers.length) { const [ms, f] = world.timers.shift(); world.log.push(['timer', ms]); f(); }
    await p;
  } finally { globalThis.setTimeout = realST; Math.random = realRand; globalThis.Date = RealDate; }
  world.log.push(['history', JSON.stringify(world.hist)]);
  if (which === 'old') world.log.push(['rotation-end', JSON.stringify(world.old.rotation())]);
  else world.log.push(['rotation-end', JSON.stringify(world.getRotation())]);
  return world.log;
}

console.log('Name Picker — pick-mode parity');

const shapes = [];
for (const crazy of [false, true]) for (const dramatic of [false, true]) {
  for (const n of [0, 1, 2, 3, 9]) shapes.push({ n, crazy, dramatic, winner: n > 1 ? n - 1 : 0, speed: 130 });
  shapes.push({ n: 6, crazy, dramatic, winner: -1, speed: 130 });   /* the draw finds nobody */
  shapes.push({ n: 5, crazy, dramatic, winner: 2, speed: 40 });
}
for (const crazy of [false, true]) for (const sudden of [false, true]) {
  for (const n of [0, 1, 4, 8]) for (const count of [1, 3, 9]) shapes.push({ fn: 'multiPick', n, crazy, dramatic: false, winner: 0, speed: 130, count, sudden });
  shapes.push({ fn: 'multiPick', n: 5, crazy, dramatic: false, winner: 0, speed: 400, count: 2, sudden });   /* a slow speed is under the 18-sweep cap */
  shapes.push({ fn: 'multiPick', n: 6, crazy, dramatic: false, winner: 0, speed: 60, count: 2, sudden, skip: ['S1', 'S4'], fair: false });
}
for (const fn of ['jumpPick', 'disappearPick', 'slotPick', 'multiPick']) {
  let events = 0;
  for (const shape of shapes.filter((x) => (x.fn || (fn === 'multiPick' ? '' : fn)) === fn || (!x.fn && fn !== 'multiPick'))) {
    const a = await drive('old', fn, makeWorld(shape));
    const b = await drive('new', fn, makeWorld(shape));
    events += a.length;
    eq(b, a, fn + ' ' + JSON.stringify(shape));
  }
  if (events < 200) { failed++; console.log('  FAIL ' + fn + ' recorded too little (' + events + ')'); } else passed++;
}

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
