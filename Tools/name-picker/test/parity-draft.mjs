// parity-draft.mjs — Name Picker: np-mode-draft.js against the Team Draft code it replaced.
//
//   node Tools/name-picker/test/parity-draft.mjs
//
// Path 15 P1 step 6 moved 007's Team Draft block (draftRemaining ... renderDraftBoard, plus the four variables
// draftTeams, draftTurnIndex, draftStarted, draftTeamCount) into createDraft(host). oldDraft() below is that block
// copied byte for byte from 007 at v452 inside a function that supplies the page globals it read. Both versions run
// against the same recording fake DOM and host with Math.random pinned and the same sequence of clicks, saves and
// roster changes; the logs, the HTML each draws and the state afterwards must be identical. Pure Node.

import { createDraft } from '../np-mode-draft.js';

/* Node's blob URLs carry a random id; a counter keeps the two runs comparable. The export's revoke timer is left to expire. */
let blobN = 0;
URL.createObjectURL = (b) => 'blob:test/' + (++blobN) + ':' + b.size;
URL.revokeObjectURL = () => {};

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log('  FAIL ' + label + '\n    got  ' + JSON.stringify(a).slice(0, 500) + '\n    want ' + JSON.stringify(b).slice(0, 500)); }
};

/* frozen: 007 at v452. The page's globals it read come in through g; draftTeams and the rest are its own. */
function oldDraft(g) {
  const { document, window, playBeep, playWinSound, showConfetti, fireworkShow, scatterNames, escapeHtml, isAbsent } = g;
  let names = g.names;
  let nameCards = [];
  void nameCards;
  let crazyMode = false;
  let draftTeams=[],draftTurnIndex=0,draftStarted=false,draftTeamCount=2;
  const updateCountDisplay = g.updateCountDisplay;
function draftRemaining(){
  const picked=new Set(draftTeams.flatMap(t=>t.picks));
  return names.filter(n=>!picked.has(n)&&!isAbsent(n));
}
function resetDraft(){
  draftTeams.forEach(t=>t.picks=[]);
  draftTurnIndex=0;
  scatterNames();
}
function reconfigureDraft(){
  draftStarted=false;
  scatterNames();
}
function startDraft(){
  const countInput=document.getElementById('draftTeamCount');
  const n=Math.max(2,Math.min(12,parseInt(countInput.value,10)||2));
  const nameInputs=document.querySelectorAll('.draft-team-name-input');
  draftTeamCount=n;
  draftTeams=Array.from({length:n},(_,i)=>({name:(nameInputs[i]&&nameInputs[i].value.trim())||`Team ${i+1}`,picks:[]}));
  draftTurnIndex=0;
  draftStarted=true;
  scatterNames();
}
function draftPick(name){
  if(!draftStarted||!draftTeams.length)return;
  const remaining=draftRemaining();
  if(!remaining.includes(name))return;
  const team=draftTeams[draftTurnIndex];
  team.picks.push(name);
  playBeep(500+Math.random()*200,90,'square',0.09);
  if(draftRemaining().length>0){
    draftTurnIndex=(draftTurnIndex+1)%draftTeams.length;
  }else{
    playWinSound(null);showConfetti();if(crazyMode)fireworkShow();
  }
  scatterNames();
}
function printDraftReport(){
  if(!draftTeams.length)return;
  document.getElementById('printSeatSection').style.display='none';
  document.getElementById('printReportTitle').textContent='Team Draft Results';
  document.getElementById('printReportSub').textContent=`${new Date().toLocaleDateString()} · ${draftTeams.length} teams`;
  document.querySelector('#printReportTable thead').innerHTML='<tr><th>Team</th><th>Size</th><th>Members</th></tr>';
  document.getElementById('printReportBody').innerHTML=draftTeams.map(t=>
    `<tr><td>${escapeHtml(t.name)}</td><td>${t.picks.length}</td><td>${t.picks.map(escapeHtml).join(', ')}</td></tr>`
  ).join('');
  window.print();
}
function exportDraftReport(){
  if(!draftTeams.length)return;
  const text=draftTeams.map(t=>`${t.name} (${t.picks.length})\n${t.picks.map(n=>'  - '+n).join('\n')}`).join('\n\n');
  const blob=new Blob([text],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`team-draft-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function draftSetupHTML(){
  const rows=[];
  for(let i=0;i<draftTeamCount;i++){
    const existing=(draftTeams[i]&&draftTeams[i].name)||`Team ${i+1}`;
    rows.push(`<input type="text" class="draft-team-name-input" data-team-idx="${i}" value="${escapeHtml(existing)}" maxlength="40">`);
  }
  const ready=names.filter(n=>!isAbsent(n)).length>0;
  return `<div class="draft-setup">
    <h2>🧑‍🤝‍🧑 TEAM DRAFT</h2>
    <p>Set up teams below, then captains take turns clicking a student on the board to draft them.</p>
    <div class="option-row" style="justify-content:center;border-bottom:none;"><span class="option-label" style="flex:0;">Number of teams:</span><input type="number" id="draftTeamCount" value="${draftTeamCount}" min="2" max="12" style="width:70px;"></div>
    <div class="draft-team-inputs">${rows.join('')}</div>
    <button class="btn-primary" id="draftStartBtn" ${ready?'':'disabled'}>🏁 Start Draft</button>
    ${ready?'':'<p class="muted-text">Load a roster first (⚙️ Roster).</p>'}
  </div>`;
}
function draftActiveHTML(){
  const remaining=draftRemaining();
  const complete=remaining.length===0;
  const teamsHtml=draftTeams.map((t,i)=>{
    const isTurn=!complete&&i===draftTurnIndex;
    return `<div class="draft-team-card${isTurn?' active-turn':''}">
      <h4>${isTurn?'👉 ':''}${escapeHtml(t.name)} <small>(${t.picks.length})</small></h4>
      <div class="draft-team-picks">${t.picks.length?t.picks.map(escapeHtml).join(', '):'<span style="opacity:0.6;">No picks yet</span>'}</div>
    </div>`;
  }).join('');
  const remainingHtml=complete?'':`<div class="draft-remaining-label">👉 ${escapeHtml(draftTeams[draftTurnIndex].name)}'s turn — click a student to draft them</div>
    <div class="draft-remaining">${remaining.map(n=>`<button class="draft-tile" data-draft-pick="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}</div>`;
  const doneHtml=complete?`<div class="draft-complete"><h3>🎉 Draft complete!</h3><div class="button-row" style="justify-content:center;"><button id="draftPrintBtn">🖨️ Print Rosters</button><button id="draftExportBtn">⬇️ Export</button><button id="draftRestartBtn">↺ New Draft (Same Teams)</button></div></div>`:'';
  return `<div class="draft-reconfigure"><button id="draftReconfigureBtn">⚙️ Reconfigure Teams</button></div><div class="draft-teams-bar">${teamsHtml}</div>${remainingHtml}${doneHtml}`;
}
function bindDraftSetupEvents(){
  document.getElementById('draftTeamCount').addEventListener('change',(e)=>{
    const inputs=document.querySelectorAll('.draft-team-name-input');
    inputs.forEach((inp,i)=>{if(draftTeams[i])draftTeams[i].name=inp.value;else draftTeams[i]={name:inp.value,picks:[]};});
    draftTeamCount=Math.max(2,Math.min(12,parseInt(e.target.value,10)||2));
    scatterNames();
  });
  document.querySelectorAll('.draft-team-name-input').forEach((inp,i)=>{
    inp.addEventListener('input',()=>{if(!draftTeams[i])draftTeams[i]={name:inp.value,picks:[]};else draftTeams[i].name=inp.value;});
  });
  const startBtn=document.getElementById('draftStartBtn');
  if(startBtn)startBtn.addEventListener('click',startDraft);
}
function bindDraftActiveEvents(){
  document.querySelectorAll('[data-draft-pick]').forEach(btn=>{
    btn.addEventListener('click',()=>draftPick(btn.dataset.draftPick));
  });
  const reconfigureBtn=document.getElementById('draftReconfigureBtn');
  if(reconfigureBtn)reconfigureBtn.addEventListener('click',reconfigureDraft);
  const printBtn=document.getElementById('draftPrintBtn');
  if(printBtn)printBtn.addEventListener('click',printDraftReport);
  const exportBtn=document.getElementById('draftExportBtn');
  if(exportBtn)exportBtn.addEventListener('click',exportDraftReport);
  const restartBtn=document.getElementById('draftRestartBtn');
  if(restartBtn)restartBtn.addEventListener('click',resetDraft);
}
function renderDraftBoard(){
  const board=document.getElementById('board');
  board.querySelectorAll('.name-card').forEach(el=>el.remove());
  board.querySelectorAll('.tournament-grid').forEach(el=>el.remove());
  board.querySelectorAll('.draft-board').forEach(el=>el.remove());
  board.querySelectorAll('.all-absent-msg').forEach(el=>el.remove());
  nameCards=[];
  const emptyState=document.getElementById('emptyState');
  if(emptyState)emptyState.style.display='none';
  const wrap=document.createElement('div');
  wrap.className='draft-board';
  if(draftStarted){
    wrap.innerHTML=draftActiveHTML();
    board.appendChild(wrap);
    bindDraftActiveEvents();
  }else{
    wrap.innerHTML=draftSetupHTML();
    board.appendChild(wrap);
    bindDraftSetupEvents();
  }
  updateCountDisplay();
}
  return {
    renderBoard: renderDraftBoard, reset: resetDraft, clear() { draftTeams=[];draftStarted=false;draftTurnIndex=0; },
    isStarted: () => draftStarted, teams: () => draftTeams, turn: () => draftTurnIndex, teamCount: () => draftTeamCount,
    remaining: draftRemaining, setupHTML: draftSetupHTML, activeHTML: draftActiveHTML,
    start: startDraft, pick: draftPick, reconfigure: reconfigureDraft, printReport: printDraftReport, exportReport: exportDraftReport,
    setNames(n) { names = n; }, setCrazy(c) { crazyMode = c; }
  };
}

/* a recording fake DOM: just what the draft block touches */
function makeEnv(log) {
  const els = new Map();
  const listeners = [];
  const mk = (key) => {
    if (!els.has(key)) {
      const el = {
        key, style: {}, _text: '', _html: '', value: '', dataset: {}, href: '', download: '',
        get textContent() { return this._text; }, set textContent(v) { this._text = v; log.push(['text', key, v]); },
        get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; log.push(['html', key, v]); },
        className: '',
        addEventListener(t, fn) { log.push(['on', key, t]); listeners.push({ key, t, fn }); },
        appendChild(c) { log.push(['append', key, c.className, c._html]); this.child = c; },
        remove() { log.push(['remove', key]); },
        click() { log.push(['click', key, this.href, this.download]); },
        querySelectorAll(sel) { log.push(['qsa', key, sel]); return []; }
      };
      els.set(key, el);
    }
    return els.get(key);
  };
  const state = { inputs: [], picks: [] };
  const document = {
    getElementById: (id) => id === 'emptyState' && state.noEmpty ? null : mk('#' + id),
    querySelector: (sel) => mk(sel),
    querySelectorAll: (sel) => {
      log.push(['qsa', 'doc', sel]);
      if (sel === '.draft-team-name-input') return state.inputs.map(v => ({ value: v, addEventListener: (t) => log.push(['on', 'name-input', t]) }));
      if (sel === '[data-draft-pick]') return state.picks.map(n => ({ dataset: { draftPick: n }, addEventListener: (t) => log.push(['on', 'pick:' + n, t]) }));
      return [];
    },
    createElement: (tag) => { const e = mk('new:' + tag + ':' + els.size); return e; }
  };
  const window = { print: () => log.push(['print']) };
  return { document, window, state, els, listeners, mk };
}

function build(Impl, scenario) {
  const log = [];
  const env = makeEnv(log);
  env.mk('#board').querySelectorAll = (sel) => { log.push(['qsa', 'board', sel]); return []; };
  let names = scenario.names.slice();
  const absent = new Set(scenario.absent || []);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let seedN = 7; const rng = () => (seedN = (seedN * 16807) % 2147483647) / 2147483647;
  const realRandom = Math.random; Math.random = rng;
  const common = {
    document: env.document, window: env.window,
    playBeep: (...a) => log.push(['beep', ...a.map(x => typeof x === 'number' ? Math.round(x * 1000) / 1000 : x)]),
    playWinSound: (x) => log.push(['win', x]), showConfetti: () => log.push(['confetti']), fireworkShow: () => log.push(['fireworks']),
    escapeHtml: esc, isAbsent: (n) => absent.has(n), updateCountDisplay: () => log.push(['count'])
  };
  let draft;
  const scatterNames = () => { log.push(['scatter']); draft.renderBoard(); };
  let crazy = false;
  if (Impl === 'old') {
    draft = oldDraft({ ...common, names, scatterNames, updateCountDisplay: common.updateCountDisplay });
  } else {
    draft = createDraft({ ...common, names: () => names, scatterNames, crazy: () => crazy, clearCards: () => log.push(['clearCards']) });
  }
  return {
    log, env, draft, absent,
    setNames(n) { names = n; if (draft.setNames) draft.setNames(n); },
    setCrazy(c) { crazy = c; if (draft.setCrazy) draft.setCrazy(c); },
    done() { Math.random = realRandom; }
  };
}

/* Both sides log an extra ['clearCards'] only on the new side (the old code assigned nameCards=[] with no log); strip it. */
const norm = (log) => log.filter(e => e[0] !== 'clearCards');

function runScenario(label, scenario) {
  const out = {};
  for (const impl of ['old', 'new']) {
    blobN = 0;
    const s = build(impl, scenario);
    const snaps = [];
    const snap = () => snaps.push({ started: s.draft.isStarted(), teams: JSON.parse(JSON.stringify(s.draft.teams())), turn: s.draft.turn(), count: s.draft.teamCount(), remaining: s.draft.remaining(), setup: s.draft.setupHTML(), active: s.draft.teams().length ? s.draft.activeHTML() : null });
    if (scenario.crazy) s.setCrazy(true);
    s.env.state.inputs = scenario.teamNames || [];
    s.draft.renderBoard(); snap();
    /* team-count box: type a name, change the count (the setup events are bound to the fake listeners) */
    if (scenario.countChange != null) {
      s.env.mk('#draftTeamCount').value = String(scenario.countChange);
      const l = s.env.listeners.filter(x => x.key === '#draftTeamCount' && x.t === 'change').pop();
      if (l) l.fn({ target: { value: String(scenario.countChange) } });
      snap();
    }
    s.env.mk('#draftTeamCount').value = String(scenario.startCount ?? scenario.countChange ?? 2);
    s.env.state.inputs = scenario.teamNames || [];
    s.draft.start(); snap();
    for (const step of scenario.steps || []) {
      if (step[0] === 'pick') { s.draft.pick(step[1]); }
      else if (step[0] === 'reconfigure') s.draft.reconfigure();
      else if (step[0] === 'reset') s.draft.reset();
      else if (step[0] === 'print') s.draft.printReport();
      else if (step[0] === 'export') { s.draft.exportReport(); }
      else if (step[0] === 'clear') { s.draft.clear(); s.draft.renderBoard(); }
      else if (step[0] === 'absent') { s.absent.add(step[1]); s.draft.renderBoard(); }
      else if (step[0] === 'names') { s.setNames(step[1]); s.draft.renderBoard(); }
      snap();
    }
    s.done();
    out[impl] = { log: norm(s.log), snaps };
  }
  eq(out.new.snaps, out.old.snaps, label + ': state and HTML after every step');
  eq(out.new.log, out.old.log, label + ': event log');
  return out;
}

const R8 = ['Ada', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal'];
const full = (names, count) => names.map(n => ['pick', n]);
runScenario('setup, nothing loaded', { names: [], steps: [] });
runScenario('setup, roster ready', { names: R8, steps: [] });
runScenario('two teams, full draft', { names: R8, steps: full(R8) });
runScenario('full draft with Crazy', { names: R8, crazy: true, steps: full(R8) });
runScenario('draft, print and export when done', { names: R8.slice(0, 3), steps: [...full(R8.slice(0, 3)), ['print'], ['export'], ['reset']] });
runScenario('three named teams', { names: R8, teamNames: ['Red', ' Blue ', ''], startCount: 3, steps: [['pick', 'Ada'], ['pick', 'Bo'], ['pick', 'Cy'], ['pick', 'Di']] });
runScenario('count 5, names with markup', { names: ['<b>X</b>', 'A&B', 'C"D', "E'F", 'G'], teamNames: ['<i>t</i>', 'T&2'], countChange: 5, steps: [['pick', '<b>X</b>'], ['pick', 'A&B']] });
runScenario('count clamps to 12', { names: R8, countChange: 99, teamNames: ['a'], steps: [['pick', 'Ada']] });
runScenario('count clamps to 2', { names: R8, countChange: 0, steps: [] });
runScenario('a name that is not on the board is ignored', { names: R8, steps: [['pick', 'Nobody'], ['pick', 'Ada'], ['pick', 'Ada']] });
runScenario('absent students are not draftable', { names: R8, absent: ['Bo', 'Cy'], steps: [['pick', 'Bo'], ['pick', 'Ada']] });
runScenario('absent marked mid-draft ends it', { names: R8.slice(0, 3), steps: [['pick', 'Ada'], ['absent', 'Bo'], ['absent', 'Cy']] });
runScenario('reconfigure and start again', { names: R8, steps: [['pick', 'Ada'], ['reconfigure'], ['reset']] });
runScenario('new draft with the same teams', { names: R8.slice(0, 2), steps: [['pick', 'Ada'], ['pick', 'Bo'], ['reset'], ['pick', 'Bo']] });
runScenario('a new roster clears the draft', { names: R8, steps: [['pick', 'Ada'], ['clear'], ['pick', 'Bo']] });
runScenario('a cleared draft keeps the team count it had', { names: R8, countChange: 4, teamNames: ['A', 'B'], steps: [['pick', 'Ada'], ['clear']] });
runScenario('the roster changes under a draft', { names: R8, steps: [['pick', 'Ada'], ['names', R8.slice(3)], ['pick', 'Ada'], ['pick', 'Di']] });
runScenario('print and export with no teams do nothing', { names: R8, steps: [['clear'], ['print'], ['export']] });
runScenario('a one-student roster', { names: ['Solo'], steps: [['pick', 'Solo']] });

console.log(`parity-draft: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
