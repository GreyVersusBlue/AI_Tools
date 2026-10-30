/* np-mode-jump.js — the Name Picker's jump pick mode, lifted out of 007 unchanged.
   The page hands in `host`, the few things a mode needs from it, so this file reads no page
   global: host.cards() the name cards, host.speed() and host.crazy() the current settings,
   host.begin() / host.finishRolling() the rolling state, host.chooseWinner(cards) and
   host.selectWinner(card) the draw and the result, and the effect helpers (playBeep, shake,
   sleep ...). test/parity-modes.mjs holds it to the inline code it replaced. */

export async function jumpPick(host){
  host.begin();
  const activeCards=host.cards().filter(c=>c.active);
  if(activeCards.length===0){host.finishRolling();return;}
  const winnerCard=host.chooseWinner(activeCards);
  if(!winnerCard){host.finishRolling();return;}
  if(activeCards.length===1){host.selectWinner(winnerCard);return;}
  const winnerIdx=activeCards.indexOf(winnerCard);
  const dramatic=host.dramatic();
  const baseJumps=dramatic?16:10;
  const totalJumps=baseJumps+Math.floor(Math.random()*6);
  let lastIdx=-1,lastEl=null,currentDelay=host.speed();
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
    host.playBeep(550+Math.random()*350,60);
    if(host.crazy()){host.shake(1);if(lastEl)host.drawLightning(lastEl,activeCards[idx].el);}
    lastIdx=idx;lastEl=activeCards[idx].el;
    if(dramatic&&i>totalJumps*0.55)currentDelay=currentDelay*1.18;
    await host.sleep(currentDelay);
  }
  activeCards.forEach(c=>c.el.classList.remove('highlighted'));
  host.selectWinner(winnerCard);
}
