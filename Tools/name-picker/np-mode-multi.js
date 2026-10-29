/* np-mode-multi.js — the Name Picker's "pick several at once" mode, lifted out of 007 unchanged.
   Takes `host`, the page's cards, rotation, options and effect/log helpers, and reads no page
   global. It draws through np-pick's pickMany, so picking four partners spends four turns of the
   rotation. test/parity-modes.mjs holds it to the inline code it replaced. */

import { pickMany } from './np-pick.js';

export async function multiPick(host,count){
  host.begin();
  const activeNames=host.cards().filter(c=>c.active).map(c=>c.name).filter(n=>!host.isSkipped(n));
  /* Draws through the same rotation, so picking four partners spends four turns
     rather than sidestepping the round. */
  const drawn=pickMany(host.rotation(),activeNames,count,{fair:host.options().fair,weights:host.drawWeights(activeNames)});
  host.setRotation(drawn.state);
  const winners=drawn.names;
  if(!winners.length){host.finishRolling();return;}
  const activeCards=host.cards().filter(c=>c.active&&!host.isSkipped(c.name));
  const sweepCount=Math.min(18,Math.floor(20/(host.speed()/100))+8);
  for(let i=0;i<sweepCount;i++){
    activeCards.forEach(c=>c.el.classList.remove('highlighted'));
    if(activeCards.length){const c=activeCards[Math.floor(Math.random()*activeCards.length)];c.el.classList.add('highlighted');}
    host.playBeep(550+Math.random()*350,50);
    if(host.crazy())host.shake(1);
    await host.sleep(host.speed()*0.7);
  }
  activeCards.forEach(c=>c.el.classList.remove('highlighted'));
  winners.forEach(name=>{const card=host.cards().find(c=>c.name===name);if(card)card.el.classList.add('winner');});
  host.playWinSound(null);
  host.showConfetti(host.crazy());
  if(host.crazy()){host.fireworkShow();host.shake(3);}
  if(host.suddenDeath()){host.triggerSuddenDeathExplosion();}
  host.markUndoPoint(winners);
  winners.forEach(name=>{
    host.history().push({name,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),date:host.todayKey()});
    host.incrementStats(name);
  });
  host.saveHistory();host.updateHistoryUI();host.bumpCombo();
  setTimeout(()=>host.showMultiWinnerModal(winners),700);
}
