/* keyboard / touch */
export const K={left:false,right:false,up:false,down:false};
const KEYMAP={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',
  ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};

/**
 * Wire controls. handlers: {startGame,restart,togglePause,toggleMute,initAudio,getState,onJump}
 */
export function setupInput(h){
  const $=id=>document.getElementById(id);
  addEventListener('keydown',e=>{
    h.initAudio();if(h.A.ctx&&h.A.ctx.state==='suspended')h.A.ctx.resume();
    if(KEYMAP[e.code]){K[KEYMAP[e.code]]=true;e.preventDefault();return;}
    if(e.code==='Space'){
      e.preventDefault();
      const st=h.getState();
      if(st==='running')h.onJump();
      else if(st==='menu')h.startGame();
      else if(st==='over')h.restart();
      return;
    }
    if(e.code==='Enter'){
      const st=h.getState();
      if(st==='menu')h.startGame();
      else if(st==='over')h.restart();
    }
    const st=h.getState();
    if(e.code==='KeyR'&&(st==='over'||st==='running'||st==='paused'))h.restart();
    if(e.code==='KeyM')h.toggleMute();
    if(e.code==='KeyP'||e.code==='Escape')h.togglePause();
  });
  addEventListener('keyup',e=>{if(KEYMAP[e.code]){K[KEYMAP[e.code]]=false;e.preventDefault();}});
  addEventListener('blur',()=>{if(h.getState()==='running')h.togglePause();});

  function bindTouchBtn(id,key){
    const el=$(id);
    const on=e=>{e.preventDefault();h.initAudio();K[key]=true;};
    const off=e=>{e.preventDefault();K[key]=false;};
    el.addEventListener('pointerdown',on);
    el.addEventListener('pointerup',off);
    el.addEventListener('pointercancel',off);
    el.addEventListener('pointerleave',off);
  }
  bindTouchBtn('tbL','left');bindTouchBtn('tbR','right');bindTouchBtn('tbD','down');
  {
    const el=$('tbJ');
    el.addEventListener('pointerdown',e=>{e.preventDefault();h.initAudio();
      if(h.getState()==='running')h.onJump();});
  }
  if(matchMedia('(pointer:coarse)').matches||'ontouchstart' in window)$('touch').style.display='block';

  $('muteBtn').addEventListener('click',e=>{e.stopPropagation();h.toggleMute();});
  $('themeBtn').addEventListener('click',e=>{e.stopPropagation();h.toggleTheme();});
  $('startBtn').addEventListener('click',h.startGame);
  $('restartBtn').addEventListener('click',h.restart);
  $('resumeBtn').addEventListener('click',h.togglePause);
}
