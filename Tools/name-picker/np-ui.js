/* np-ui.js — the Name Picker's winner step, lifted out of 007 unchanged: selectWinner and selectTournamentWinner (the
   rarity roll, the effects, and what a pick records: undo point, history entry, stats, Hall of Fame, achievements), the
   winner / multi-winner / tournament dialogs and what their buttons do to the board. createWinnerUi(host) returns
   { selectWinner, selectTournamentWinner, showMultiWinnerModal }; the sticky "same question" prompt is its own state.
   The host supplies what the old code read from the page. Values are read at call time through getters: names(),
   mode(), crazy(), suddenDeath(), luckyStudent(), prompts(), history(), nameCards(); the page's writes are setNames(list),
   setRolling(bool) and bumpMythic(); the rest are the page's functions of the same name (rollRarity, playWinSound,
   showConfetti, fireworkShow, shake, triggerSuddenDeathExplosion, bumpCombo, markUndoPoint, todayKey, incrementStats,
   addToHof, checkAchievements, saveHistory, updateHistoryUI, displayName, detailFor, escapeHtml, noteBoardRemoval,
   scatterNames, finishRolling, pickName). Two optional hooks (Path 15 P4): drawQuestion() gives the words of the next bank
   question or null, and qidFor(text) the bank id to log with a prompt; a host without them gets the code that was here before.
   Held to the inline code it replaced by test/parity-ui.mjs. */

export function createWinnerUi(host){
  let stickyPrompt=null;
  const rollRarity=(...a)=>host.rollRarity(...a);
  const playWinSound=(...a)=>host.playWinSound(...a);
  const showConfetti=(...a)=>host.showConfetti(...a);
  const fireworkShow=(...a)=>host.fireworkShow(...a);
  const shake=(...a)=>host.shake(...a);
  const triggerSuddenDeathExplosion=(...a)=>host.triggerSuddenDeathExplosion(...a);
  const bumpCombo=(...a)=>host.bumpCombo(...a);
  const markUndoPoint=(...a)=>host.markUndoPoint(...a);
  const todayKey=(...a)=>host.todayKey(...a);
  const incrementStats=(...a)=>host.incrementStats(...a);
  const addToHof=(...a)=>host.addToHof(...a);
  const checkAchievements=(...a)=>host.checkAchievements(...a);
  const saveHistory=(...a)=>host.saveHistory(...a);
  const updateHistoryUI=(...a)=>host.updateHistoryUI(...a);
  const displayName=(...a)=>host.displayName(...a);
  const detailFor=(...a)=>host.detailFor(...a);
  const escapeHtml=(...a)=>host.escapeHtml(...a);
  const noteBoardRemoval=(...a)=>host.noteBoardRemoval(...a);
  const scatterNames=(...a)=>host.scatterNames(...a);
  const finishRolling=(...a)=>host.finishRolling(...a);
  const pickName=(...a)=>host.pickName(...a);
  const document=host.document;

  function selectWinner(winnerCard){
    winnerCard.el.classList.add('winner');
    const useRarity=document.getElementById('rarityEnabled').checked;
    const luckyBonus=host.luckyStudent()===winnerCard.name;
    const rarity=useRarity?rollRarity(luckyBonus):null;
    playWinSound(rarity);
    showConfetti();
    if(host.crazy()){
      fireworkShow();
      shake(rarity&&(rarity.name==='LEGENDARY'||rarity.name==='MYTHIC')?3:2);
    }
    if(host.suddenDeath()){triggerSuddenDeathExplosion();}
    host.setRolling(false);
    bumpCombo();
    const promptText=pickRandomPrompt();
    markUndoPoint([winnerCard.name]);
    const entry={name:winnerCard.name,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),date:todayKey()};
    if(promptText)entry.prompt=promptText;
    if(promptText&&host.qidFor){const qid=host.qidFor(promptText);if(qid)entry.qid=qid;}
    host.history().push(entry);
    incrementStats(winnerCard.name);
    if(rarity&&['RARE','EPIC','LEGENDARY','MYTHIC'].includes(rarity.name)){addToHof(winnerCard.name,rarity);}
    if(rarity&&rarity.name==='MYTHIC'){host.bumpMythic();}
    checkAchievements(rarity,winnerCard.name);
    saveHistory();updateHistoryUI();
    const coldCall=document.getElementById('coldCallMode').checked;
    setTimeout(()=>showWinnerModal(winnerCard,coldCall,rarity,promptText),700);
  }

  /* Set by "Same question, next student" and spent by the very next pick. */
  function pickRandomPrompt(){
    if(stickyPrompt){const held=stickyPrompt;stickyPrompt=null;return held;}
    if(!document.getElementById('promptsEnabled').checked)return null;
    /* A page that offers the question bank as a source (Path 15 P4) passes drawQuestion(), which gives the next question's
       words or null when typed prompts are the source; without the hook this is the code it always was. */
    if(host.drawQuestion){const q=host.drawQuestion();if(q)return q;}
    if(!host.prompts().length)return null;
    return host.prompts()[Math.floor(Math.random()*host.prompts().length)];
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
    overlay.innerHTML=`<div class="modal ${host.crazy()?'crazy':''}">${rarityHTML}<div class="modal-label">🎉 Selected!</div>${winnerNameHTML(winnerCard.name)}${promptHTML}<div class="modal-buttons"><button class="btn-primary" id="modalDone">Done</button><button id="modalRoll">Roll Again</button>${sameHTML}<button id="modalRemoveRoll">Remove &amp; Roll Again</button></div></div>`;
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
    overlay.innerHTML=`<div class="modal ${host.crazy()?'crazy':''}"><div class="modal-label">🎉 ${winners.length} Selected!</div><div class="multi-pick-list">${winners.map(n=>{const d=displayName(n,detailFor(n));return `<div class="multi-pick-name">${escapeHtml(d.big)}${d.sub?` <span style="opacity:.6;font-size:.75em;">${escapeHtml(d.sub)}</span>`:''}</div>`;}).join('')}</div><div class="modal-buttons"><button class="btn-primary" id="multiDone">Done</button><button id="multiRoll">Roll Again</button><button id="multiRemoveRoll">Remove All &amp; Roll Again</button></div></div>`;
    document.body.appendChild(overlay);
    const cleanup=()=>{overlay.remove();document.removeEventListener('keydown',escHandler);};
    const escHandler=(e)=>{if(e.key==='Escape'){cleanup();finishRolling();cleanupMultiWinners(false);}};
    document.addEventListener('keydown',escHandler);
    const coldCall=document.getElementById('coldCallMode').checked;
    document.getElementById('multiDone').onclick=()=>{cleanup();cleanupMultiWinners(coldCall,winners);finishRolling();};
    document.getElementById('multiRoll').onclick=()=>{cleanup();cleanupMultiWinners(coldCall,winners);finishRolling();setTimeout(pickName,250);};
    document.getElementById('multiRemoveRoll').onclick=()=>{cleanup();noteBoardRemoval();host.setNames(host.names().filter(n=>!winners.includes(n)));scatterNames();finishRolling();setTimeout(pickName,250);};
  }

  function cleanupMultiWinners(coldCall,winners){
    if(coldCall&&winners){host.setNames(host.names().filter(n=>!winners.includes(n)));scatterNames();}
    else{host.nameCards().forEach(c=>c.el.classList.remove('winner'));}
  }

  function handleDone(winnerCard,coldCallMode){
    winnerCard.el.classList.remove('winner');
    if(coldCallMode){
      host.setNames(host.names().filter(n=>n!==winnerCard.name));
      if(host.mode()==='disappear')scatterNames();
      else removeCardSilently(winnerCard);
    }
    finishRolling();
  }

  function handleRollAgain(winnerCard,coldCallMode){
    if(coldCallMode){noteBoardRemoval();host.setNames(host.names().filter(n=>n!==winnerCard.name));}
    if(host.mode()==='disappear')scatterNames();
    else{winnerCard.el.classList.remove('winner');if(coldCallMode)removeCardSilently(winnerCard);}
    finishRolling();
    setTimeout(()=>pickName(),250);
  }

  function handleRemoveAndRoll(winnerCard){
    noteBoardRemoval();
    host.setNames(host.names().filter(n=>n!==winnerCard.name));
    if(host.mode()==='disappear')scatterNames();
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
    const luckyBonus=host.luckyStudent()===winnerCard.name;
    const rarity=useRarity?rollRarity(luckyBonus):null;
    playWinSound(rarity);
    showConfetti();
    if(host.crazy()){fireworkShow();shake(rarity&&(rarity.name==='LEGENDARY'||rarity.name==='MYTHIC')?3:2);}
    if(host.suddenDeath()){triggerSuddenDeathExplosion();}
    host.setRolling(false);
    bumpCombo();
    const promptText=pickRandomPrompt();
    markUndoPoint([winnerCard.name]);
    const entry={name:winnerCard.name,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),date:todayKey()};
    if(promptText)entry.prompt=promptText;
    if(promptText&&host.qidFor){const qid=host.qidFor(promptText);if(qid)entry.qid=qid;}
    host.history().push(entry);
    incrementStats(winnerCard.name);
    if(rarity&&['RARE','EPIC','LEGENDARY','MYTHIC'].includes(rarity.name)){addToHof(winnerCard.name,rarity);}
    if(rarity&&rarity.name==='MYTHIC')host.bumpMythic();
    checkAchievements(rarity,winnerCard.name);
    saveHistory();updateHistoryUI();
    const coldCall=document.getElementById('coldCallMode').checked;
    setTimeout(()=>{
      const overlay=document.createElement('div');
      overlay.className='modal-overlay';
      const rarityHTML=rarity?`<div class="rarity-banner ${rarity.class}">${rarity.emoji} ${rarity.name} PICK ${rarity.emoji}</div>`:'';
      const prompt=promptText;
      const promptHTML=prompt?`<div class="prompt-task"><div class="prompt-task-label">📝 TASK</div>${escapeHtml(prompt)}</div>`:'';
      overlay.innerHTML=`<div class="modal ${host.crazy()?'crazy':''}">${rarityHTML}<div class="modal-label">🏆 Selected!</div>${winnerNameHTML(winnerCard.name)}${promptHTML}<div class="modal-buttons"><button class="btn-primary" id="tDone">Done</button><button id="tRoll">Roll Again</button><button id="tRemoveRoll">Eliminate &amp; Roll</button></div></div>`;
      document.body.appendChild(overlay);
      const cleanup=()=>{overlay.remove();};
      document.getElementById('tDone').onclick=()=>{cleanup();winnerCard.el.classList.remove('winner-tile');if(coldCall){winnerCard.active=false;winnerCard.el.classList.add('eliminated');host.setNames(host.names().filter(n=>n!==winnerCard.name));}finishRolling();};
      document.getElementById('tRoll').onclick=()=>{cleanup();winnerCard.el.classList.remove('winner-tile');if(coldCall){noteBoardRemoval();winnerCard.active=false;winnerCard.el.classList.add('eliminated');host.setNames(host.names().filter(n=>n!==winnerCard.name));}finishRolling();setTimeout(pickName,250);};
      document.getElementById('tRemoveRoll').onclick=()=>{cleanup();noteBoardRemoval();winnerCard.active=false;winnerCard.el.classList.add('eliminated');host.setNames(host.names().filter(n=>n!==winnerCard.name));finishRolling();setTimeout(pickName,250);};
    },700);
  }

  return {selectWinner,selectTournamentWinner,showMultiWinnerModal};
}
