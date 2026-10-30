/* np-mode-tournament.js — the Name Picker's Tournament (game-show grid) spotlight sweep, lifted out
   of 007 unchanged. Same host as the other modes, plus host.isSkipped and host.selectTournamentWinner;
   the winner dialog and everything it records stay in the page (np-ui, still to come). Held to the
   inline code it replaced by test/parity-modes.mjs. */

export async function tournamentPick(host){
  host.begin();
  const activeCards=host.cards().filter(c=>c.active&&!host.isSkipped(c.name));
  if(activeCards.length===0){host.finishRolling();return;}
  const winnerCard=host.chooseWinner(activeCards);
  if(!winnerCard){host.finishRolling();return;}
  if(activeCards.length===1){host.selectTournamentWinner(winnerCard);return;}
  const winnerIdx=activeCards.indexOf(winnerCard);
  const dramatic=host.dramatic();
  const baseJumps=dramatic?18:12;
  const totalJumps=baseJumps+Math.floor(Math.random()*6);
  let lastIdx=-1,currentDelay=Math.max(host.speed(),90);
  for(let i=0;i<totalJumps;i++){
    let idx;
    if(i===totalJumps-1)idx=winnerIdx;
    else{
      const avoidWinner=i===totalJumps-2&&activeCards.length>2;
      let guard=0;
      do{idx=Math.floor(Math.random()*activeCards.length);guard++;}
      while(guard<40&&((idx===lastIdx&&activeCards.length>1)||(avoidWinner&&idx===winnerIdx)));
    }
    activeCards.forEach(c=>c.el.classList.remove('spotlight'));
    activeCards[idx].el.classList.add('spotlight');
    host.playBeep(600+Math.random()*350,55,'square',0.08);
    if(host.crazy())host.shake(1);
    lastIdx=idx;
    if(dramatic&&i>totalJumps*0.55)currentDelay=currentDelay*1.16;
    await host.sleep(currentDelay);
  }
  activeCards.forEach(c=>c.el.classList.remove('spotlight'));
  host.selectTournamentWinner(winnerCard);
}
