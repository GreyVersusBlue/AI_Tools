/* np-mode-draft.js — the Name Picker's Team Draft mode (captains alternate picking students), lifted out of
   007 unchanged. The four page variables it kept (draftTeams, draftTurnIndex, draftStarted, draftTeamCount) are
   state of createDraft(); the page asks it to clear() on a new roster or an erase and to renderBoard(). The host
   supplies what the old code read from the page: names(), isAbsent(n), scatterNames(), playBeep, playWinSound,
   showConfetti, fireworkShow, crazy(), escapeHtml, document, window, clearCards(), updateCountDisplay().
   Held to the inline code it replaced by test/parity-draft.mjs. */

export function createDraft(host){
  let draftTeams=[],draftTurnIndex=0,draftStarted=false,draftTeamCount=2;
  const document=host.document, escapeHtml=host.escapeHtml;
  const scatterNames=()=>host.scatterNames();

  function draftRemaining(){
    const picked=new Set(draftTeams.flatMap(t=>t.picks));
    return host.names().filter(n=>!picked.has(n)&&!host.isAbsent(n));
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
    host.playBeep(500+Math.random()*200,90,'square',0.09);
    if(draftRemaining().length>0){
      draftTurnIndex=(draftTurnIndex+1)%draftTeams.length;
    }else{
      host.playWinSound(null);host.showConfetti();if(host.crazy())host.fireworkShow();
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
    host.window.print();
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
    const ready=host.names().filter(n=>!host.isAbsent(n)).length>0;
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
    host.clearCards();
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
    host.updateCountDisplay();
  }
  /* a new roster or an erase: the old code's `draftTeams=[];draftStarted=false;draftTurnIndex=0;` (draftTeamCount stays) */
  function clear(){draftTeams=[];draftStarted=false;draftTurnIndex=0;}
  return {
    renderBoard:renderDraftBoard, reset:resetDraft, clear,
    /* read-only views, for the page and the parity suite */
    isStarted:()=>draftStarted, teams:()=>draftTeams, turn:()=>draftTurnIndex, teamCount:()=>draftTeamCount,
    remaining:draftRemaining, setupHTML:draftSetupHTML, activeHTML:draftActiveHTML,
    start:startDraft, pick:draftPick, reconfigure:reconfigureDraft, printReport:printDraftReport, exportReport:exportDraftReport
  };
}
