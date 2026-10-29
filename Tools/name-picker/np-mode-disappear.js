/* np-mode-disappear.js — the Name Picker's disappear pick mode, lifted out of 007 unchanged.
   The page hands in `host`, the few things a mode needs from it, so this file reads no page
   global: host.cards() the name cards, host.speed() and host.crazy() the current settings,
   host.begin() / host.finishRolling() the rolling state, host.chooseWinner(cards) and
   host.selectWinner(card) the draw and the result, and the effect helpers (playBeep, shake,
   sleep ...). test/parity-modes.mjs holds it to the inline code it replaced. */

export async function disappearPick(host){
  host.begin();
  const active=host.cards().filter(c=>c.active);
  if(active.length===0){host.finishRolling();return;}
  const winnerCard=host.chooseWinner(active);
  if(!winnerCard){host.finishRolling();return;}
  if(active.length===1){host.selectWinner(winnerCard);return;}
  /* Everyone but the winner goes, in a uniformly shuffled order. */
  for(const card of host.shuffle(active.filter(c=>c!==winnerCard))){
    if(host.crazy()){
      const r=card.el.getBoundingClientRect();
      host.launchFirework(r.left+r.width/2,r.top+r.height/2,'#ffffff');
      host.shake(1);
    }
    card.el.classList.add('fading');
    card.active=false;
    host.playBeep(350+Math.random()*250,80,'sine',0.07);
    await host.sleep(host.speed());
    setTimeout(()=>{if(card.el)card.el.style.display='none';},450);
  }
  host.selectWinner(winnerCard);
}
