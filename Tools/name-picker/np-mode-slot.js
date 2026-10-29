/* np-mode-slot.js — the Name Picker's slot pick mode, lifted out of 007 unchanged.
   The page hands in `host`, the few things a mode needs from it, so this file reads no page
   global: host.cards() the name cards, host.speed() and host.crazy() the current settings,
   host.begin() / host.finishRolling() the rolling state, host.chooseWinner(cards) and
   host.selectWinner(card) the draw and the result, and the effect helpers (playBeep, shake,
   sleep ...). test/parity-modes.mjs holds it to the inline code it replaced. */

export async function slotPick(host){
  host.begin();
  const activeCards=host.cards().filter(c=>c.active);
  if(activeCards.length===0){host.finishRolling();return;}
  const winnerCard=host.chooseWinner(activeCards);
  if(!winnerCard){host.finishRolling();return;}
  if(activeCards.length===1){host.selectWinner(winnerCard);return;}
  const overlay=host.document.createElement('div');
  overlay.className='slot-overlay';
  overlay.innerHTML=`<div class="slot-machine"><div class="slot-title">🎰 SPINNING... 🎰</div><div class="slot-reel"><div class="slot-strip" id="slotStrip"></div><div class="slot-line"></div></div></div>`;
  host.document.body.appendChild(overlay);
  const strip=overlay.querySelector('#slotStrip');
  const itemHeight=120,totalItems=60;
  const stripNames=[];
  for(let i=0;i<totalItems-1;i++)stripNames.push(activeCards[Math.floor(Math.random()*activeCards.length)].name);
  stripNames.push(winnerCard.name);
  stripNames.forEach(n=>{const item=host.document.createElement('div');item.className='slot-name';item.textContent=n;strip.appendChild(item);});
  const finalY=-((totalItems-1)*itemHeight);
  const duration=Math.max(1800,Math.min(4500,30000/Math.max(40,host.speed())*100));
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
        host.playBeep(900,30,'square',0.05);
        if(host.crazy()&&itemIdx%3===0)host.shake(1);
        lastTick=itemIdx;
      }
      if(progress<1){host.requestAnimationFrame(animate);}
      else{
        host.playBeep(150,200,'sawtooth',0.15);
        host.shake(host.crazy()?3:2);
        setTimeout(()=>{overlay.remove();host.selectWinner(winnerCard);resolve();},600);
      }
    }
    host.requestAnimationFrame(animate);
  });
}
