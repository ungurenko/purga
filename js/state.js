/* game state & constants */
export const STAGES=['ТИХИЙ СКЛОН','ВЕТЕР КРЕПЧАЕТ','МЕТЕЛЬ','БУРАН','БЕЛАЯ ТЬМА','ШТОРМОВОЙ ПЕРЕВАЛ','ЛЕДЯНОЙ ГРЕБЕНЬ','ПОСЛЕДНИЙ СПУСК'];
export const stageName=s=>s<=STAGES.length?STAGES[s-1]:'ПУРГА ×'+s;
export const SPAWN_Z=-250,KILL_Z=16;
/** legacy half-width for obstacle path helpers (не стена) */
export const COURSE=18;
/** freeride: soft spring / hard clamp по X */
export const FREERIDE_SOFT=42,FREERIDE_HARD=55;

export const G={
  state:'menu',time:0,dist:0,score:0,speed:8,cruise:13,
  x:0,vx:0,y:16,py:0,vy:0,grounded:true,gvy:0,prevGroundY:16,
  stage:1,combo:0,mult:1,maxSpeed:0,
  crashT:0,crashReason:'',
  spinAngle:0,spinVel:0,visualSpin:0,
  grabbing:false,grabTime:0,takeoffT:0,jumpBuf:0,
  crouch:0,roll:0,boardYaw:0,fogT:0.015,windAmp:0,
  snowOpT:0.6,snowSizeT:0.11,landAbsorb:0
};

export const best={score:0,dist:0};
try{
  const b=JSON.parse(localStorage.getItem('purga:best'));
  if(b&&b.score){best.score=b.score;best.dist=b.dist||0;}
}catch(e){console.warn('purga: best load failed', e);}

export function saveBest(){
  try{localStorage.setItem('purga:best',JSON.stringify(best));}
  catch(e){console.warn('purga: best save failed', e);}
}

export const obstacles=[];
export const pendingRows=[];
export const track={spawnCursor:0, pathX:0};
