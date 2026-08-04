import * as THREE from 'three';
import { clamp, lerp, rand, $, fmt } from './utils.js';
import {
  G, best, saveBest, stageName, FREERIDE_SOFT, FREERIDE_HARD, KILL_Z, SPAWN_Z,
  obstacles, pendingRows, track
} from './state.js';
import {
  renderer, scene, camera, skyMat, groundTex, TILE_LEN,
  forest, resetForestTree, lanterns, LANT_N, LANT_SP,
  snow, snowMat, snowGeo, snowPos, snowSeed, SNOW_N,
  spPos, spVel, spLife, SP_N, spGeo, emitSpray, warmPt, mountGrp,
  terrainHeight, terrainSlope, updateTerrain
} from './scene.js';
import { riderG, boardG, riderPose } from './rider.js';
import { processSpawns } from './obstacles.js';
import { THEME_NIGHT, THEME_DAY, dayFactor, themeTick, applyTheme, toggleTheme } from './theme.js';
import { A, initAudio, playTone, SFX, toggleMute } from './audio.js';
import { vignetteEl, popupsEl, popup, banner, flashScreen, addScore, comboUp, comboReset } from './ui.js';
import { K, setupInput } from './input.js';

/* ═══════════ столкновения / события трассы ═══════════ */
const gyAt=(x=G.x,z=0)=>terrainHeight(x,G.dist-z);
function syncGroundY(){
  const g=gyAt();
  G.y=g;G.py=0;
  return g;
}
function nearMiss(){
  const pts=Math.round(30*G.mult);
  addScore(pts);comboUp();
  popup(`РЯДОМ! +${pts}`,'near');SFX.near();
  G.shake=Math.max(G.shake,0.09);
}
const REASONS={tree:'Врезался в ель',boulder:'Ледяная глыба',rock:'Скальный выступ',
  fence:'Не перепрыгнул ограждение',spin:'Поймал кант при приземлении'};
function crash(reason){
  if(G.state!=='running')return;
  G.state='crash';G.crashT=0;G.crashReason=REASONS[reason]||'Падение';
  comboReset();SFX.crash();flashScreen();
  G.shake=0.7;
  emitSpray(40,G.x,G.y+0.1,0,{sx:1.2,vx:0,vy:2,vyr:4,vz:3,vsx:5});
}
function rampLaunch(){
  G.grounded=false;
  G.vy=8.6+G.speed*0.10;
  G.takeoffT=G.time;
  popup('ТРАМПЛИН!','info');SFX.ramp();
  G.camDip=-0.35;
  emitSpray(12,G.x,G.y+0.1,0.8,{vx:0,vy:1.5,vz:5});
}
function doJump(){
  if(!G.grounded)return;
  G.grounded=false;G.vy=7.6;G.takeoffT=G.time;G.jumpBuf=0;
  SFX.jump();
  emitSpray(8,G.x,G.y+0.05,0.4,{vx:0,vy:1.2,vz:5});
}
function onLand(){
  const air=G.time-G.takeoffT;
  G.grounded=true;G.vy=0;
  syncGroundY();
  G.landAbsorb=Math.min(0.5,Math.max(0.18,air*0.12));
  G.camDip=0.5;G.shake=Math.max(G.shake,0.1);
  SFX.land();
  emitSpray(24,G.x,G.y+0.05,0,{sx:0.9,vx:0,vy:1.5,vyr:3,vz:4,vsx:3});
  if(air>0.35){
    const total=Math.abs(G.spinAngle);
    const norm=((G.spinAngle%360)+360)%360;
    const off=Math.min(norm,360-norm);
    const signed=norm>180?norm-360:norm;
    if(total>140){
      if(off<45){
        const deg=Math.max(180,Math.round(total/180)*180);
        const pts=Math.round(deg*G.mult);
        addScore(pts);comboUp();
        popup(`${deg}° · ЧИСТО +${pts}`,'trick');SFX.trick();
        G.visualSpin=signed;
      }else if(off<80){
        G.speed*=0.6;comboReset();
        popup('ЖЁСТКОЕ ПРИЗЕМЛЕНИЕ','bad');
        SFX.stumble();G.shake=Math.max(G.shake,0.3);
        G.visualSpin=signed;
      }else{crash('spin');return;}
    }
    if(G.grabTime>0.25&&total<=140){
      const pts=Math.round(40*G.mult);
      addScore(pts);comboUp();popup(`ГРЭБ +${pts}`,'trick');
    }
    if(air>1.25){
      const pts=Math.round(60*G.mult);
      addScore(pts);popup(`БОЛЬШОЙ ВОЗДУХ +${pts}`,'trick');
    }
  }
  G.spinAngle=0;G.spinVel=0;G.grabTime=0;G.grabbing=false;
}

/* ═══════════ этапы ═══════════ */
function checkStage(){
  const st=Math.floor(G.dist/450)+1;
  if(st!==G.stage){
    G.stage=st;
    banner(`ЭТАП ${st} · ${stageName(st)}`);
    SFX.stage();
    G.cruise=Math.min(13+(st-1)*1.9,29);
    G.fogT=Math.min(0.015+(st-1)*0.0035,0.036);
    G.snowOpT=Math.min(0.5+st*0.08,0.9);
    G.snowSizeT=Math.min(0.1+st*0.012,0.2);
    G.windAmp=st>=3?(st-2)*0.5:0;
  }
}

/* ═══════════ камера ═══════════ */
const camTarget=new THREE.Vector3();
const lookTarget=new THREE.Vector3();
function cameraUpdate(dt){
  const gy=G.grounded?G.y:terrainHeight(G.x,G.dist);
  /* отстаём от рельефа, чтобы гребни читались, а freeride не дёргал камеру */
  G.camGroundY=lerp(G.camGroundY,gy,Math.min(1,1.8*dt));
  const slope=terrainSlope(G.x,G.dist);
  const pitchLift=clamp(-slope.dhds*0.85,-0.9,1.1);
  camTarget.set(
    G.x*0.62,
    G.camGroundY+3.55+G.py*0.5-G.camDip+pitchLift*0.28,
    9.4
  );
  const k=1-Math.pow(0.0008,dt);
  camera.position.lerp(camTarget,k);
  if(G.shake>0){
    camera.position.x+=(Math.random()-0.5)*G.shake*0.5;
    camera.position.y+=(Math.random()-0.5)*G.shake*0.4;
    G.shake=Math.max(0,G.shake-dt*2.2);
  }
  G.camDip+=(0-G.camDip)*Math.min(1,6*dt);
  /* смотрим дальше по склону — ширина горы как на референсе */
  const gyLook=terrainHeight(G.x*0.75,G.dist+26);
  lookTarget.set(G.x*0.75,gyLook+1.25+G.py*0.35,-18);
  camera.lookAt(lookTarget);
  const fovT=60+(G.speed/34)*16+(K.up&&G.grounded?3:0)+clamp(-slope.dhds*4.5,0,4.5);
  camera.fov=lerp(camera.fov,fovT,Math.min(1,5*dt));
  camera.updateProjectionMatrix();
}
/* ═══════════ обновление мира ═══════════ */
function moveWorld(scroll,dt){
  groundTex.offset.y+=scroll/TILE_LEN;
  updateTerrain(G.dist);
  for(const f of forest){
    f.m.position.z+=scroll;
    /* courseZ = dist − z постоянен при скролле → высота та же; при ресете пересчёт */
    f.m.rotation.z=Math.sin(G.time*0.8+f.m.userData.sway)*0.012;
    if(f.m.position.z>26)resetForestTree(f,false,G.dist);
  }
  for(const l of lanterns){
    l.g.position.z+=scroll;
    if(l.g.position.z>14){
      l.g.position.z-=LANT_N*LANT_SP;
      /* новый одиночный маркер где-то на склоне */
      l.x=(Math.random()<0.5?-1:1)*rand(5,32);
    }
    const lx=l.x??l.g.position.x;
    l.g.position.x=lx;
    l.g.position.y=terrainHeight(lx,G.dist-l.g.position.z);
    const glowB=THEME_NIGHT.glowBase+(THEME_DAY.glowBase-THEME_NIGHT.glowBase)*dayFactor;
    l.sp.material.opacity=glowB*(0.84+0.32*Math.sin(G.time*7+l.phase));
  }
  mountGrp.position.x=-G.x*0.18;
  const gy=terrainHeight(G.x*0.5,G.dist+5);
  warmPt.position.set(G.x*0.5,gy+2.4,-5);
  const warmBase=THEME_NIGHT.warmI+(THEME_DAY.warmI-THEME_NIGHT.warmI)*dayFactor;
  warmPt.intensity=warmBase+Math.sin(G.time*11)*1.2*(1-dayFactor);
}
function snowUpdate(dt,scroll){
  snowMat.opacity=lerp(snowMat.opacity,G.snowOpT,Math.min(1,dt));
  snowMat.size=lerp(snowMat.size,G.snowSizeT,Math.min(1,dt));
  scene.fog.density=lerp(scene.fog.density,G.fogT,Math.min(1,dt*0.7));
  const fall=(1.4+G.stage*0.5);
  const windX=Math.sin(G.time*0.4)*G.windAmp;
  for(let i=0;i<SNOW_N;i++){
    const i3=i*3;
    snowPos[i3+1]-=fall*(0.7+0.6*Math.abs(Math.sin(snowSeed[i])))*dt;
    snowPos[i3]+=(windX*2+Math.sin(G.time*0.7+snowSeed[i])*0.4)*dt;
    snowPos[i3+2]+=scroll;
    if(snowPos[i3+1]<0){snowPos[i3+1]+=28;snowPos[i3]=rand(-70,70);}
    if(snowPos[i3+2]>20)snowPos[i3+2]-=110;
    else if(snowPos[i3+2]<-90)snowPos[i3+2]+=110;
    if(snowPos[i3]>70)snowPos[i3]-=140;
    else if(snowPos[i3]<-70)snowPos[i3]+=140;
  }
  snowGeo.attributes.position.needsUpdate=true;
}
function sprayUpdate(dt,scroll){
  for(let i=0;i<SP_N;i++){
    if(spLife[i]<=0)continue;
    spLife[i]-=dt;
    const i3=i*3;
    if(spLife[i]<=0){spPos[i3+1]=-60;continue;}
    spVel[i3+1]-=12*dt;
    spPos[i3]+=spVel[i3]*dt;
    spPos[i3+1]+=spVel[i3+1]*dt;
    spPos[i3+2]+=spVel[i3+2]*dt+scroll;
    const floorY=terrainHeight(spPos[i3],G.dist-spPos[i3+2])+0.02;
    if(spPos[i3+1]<floorY){spPos[i3+1]=floorY;spVel[i3+1]*=-0.3;}
  }
  spGeo.attributes.position.needsUpdate=true;
  spGeo.attributes.aLife.needsUpdate=true;
  spGeo.attributes.aSize.needsUpdate=true;
}

/* ═══════════ управление состоянием ═══════════ */
function reset(){
  G.score=0;G.dist=0;G.stage=1;G.cruise=13;G.combo=0;G.mult=1;
  G.speed=10;G.x=0;G.vx=0;G.vy=0;G.grounded=true;
  G.spinAngle=0;G.spinVel=0;G.visualSpin=0;G.grabTime=0;G.grabbing=false;
  G.shake=0;G.camDip=0;G.maxSpeed=0;G.jumpBuf=0;
  G.fogT=0.015;G.snowOpT=0.6;G.snowSizeT=0.11;G.windAmp=0;
  track.pathX=0;pendingRows.length=0;
  for(const o of obstacles)scene.remove(o.group);
  obstacles.length=0;
  track.spawnCursor=0;
  scene.fog.density=G.fogT;
  snowMat.opacity=G.snowOpT;snowMat.size=G.snowSizeT;
  riderG.rotation.set(0,0,0);
  const gy0=syncGroundY();
  G.camGroundY=gy0;
  riderG.position.set(0,gy0,0);
  camera.position.set(0,gy0+3.55,9.4);camera.fov=60;camera.updateProjectionMatrix();
  updateTerrain(0);
  popupsEl.innerHTML='';
}
function startGame(){
  if(G.state==='running')return;
  reset();
  G.state='running';
  $('menu').classList.add('hidden');
  $('over').classList.add('hidden');
  $('hud').classList.remove('hidden');
  popup('ПОЕХАЛИ!','info');
  playTone({f0:330,f1:660,dur:0.2,type:'triangle',g:0.15});
  setTimeout(()=>$('hint').classList.add('hidden'),9000);
}
function restart(){
  $('pauseOv').classList.add('hidden');
  startGame();
}
function togglePause(){
  if(G.state==='running'){G.state='paused';$('pauseOv').classList.remove('hidden');}
  else if(G.state==='paused'){G.state='running';$('pauseOv').classList.add('hidden');}
}
function showOver(){
  G.state='over';
  const sc=Math.floor(G.score);
  const isRec=sc>best.score;
  if(isRec){best.score=sc;best.dist=Math.floor(G.dist);saveBest();}
  $('crashReason').textContent=G.crashReason;
  $('overScore').textContent=fmt(sc);
  $('overDist').textContent=fmt(G.dist)+' м';
  $('overSpeed').textContent=Math.round(G.maxSpeed*3.6)+' км/ч';
  $('overBest').textContent=fmt(best.score);
  $('recordBadge').classList.toggle('hidden',!isRec);
  $('over').classList.remove('hidden');
}

/* ═══════════ главный апдейт ═══════════ */
function update(dt){
  G.time+=dt;
  themeTick(dt);
  skyMat.uniforms.uTime.value=G.time;
  if(G.state==='menu'){
    G.speed=lerp(G.speed,8,dt*2);
    const tx=Math.sin(G.time*0.4)*6;
    G.x=lerp(G.x,tx,Math.min(1,dt*1.5));
    G.vx=(tx-G.x)*2;
    syncGroundY();
  }else if(G.state==='crash'){
    G.speed=Math.max(0,G.speed-30*dt);
    G.crashT+=dt;
    if(G.crashT>1.05)showOver();
  }else if(G.state==='over'){
    G.speed=0;
  }else if(G.state==='running'){
    /* скорость + склон: вниз разгон, вверх тормоз; поперёк — лёгкий снос */
    const brake=K.down,tuck=K.up;
    const slopeNow=terrainSlope(G.x,G.dist);
    const hillBoost=G.grounded?clamp(-slopeNow.dhds*14,-9,14):0;
    if(brake)G.speed=Math.max(6,G.speed-26*dt);
    else{
      const target=tuck?G.cruise+9:G.cruise;
      const acc=tuck?12:(target>G.speed?7:14);
      G.speed+=clamp(target-G.speed,-acc*dt,acc*dt);
      G.speed=clamp(G.speed+hillBoost*dt,5,36);
    }
    G.maxSpeed=Math.max(G.maxSpeed,G.speed);
    /* руление — freeride, без стен */
    const dir=(K.right?1:0)-(K.left?1:0);
    if(G.grounded){
      G.vx+=dir*28*(tuck?0.8:1)*dt;
      /* скатывание с поперечного ребра */
      G.vx+=(-slopeNow.dhdx)*G.speed*0.42*dt;
      G.vx-=G.vx*2.6*dt;
      if(G.jumpBuf>0){doJump();}
    }else{
      G.vx+=dir*6.5*dt;
      const svT=dir*5.2;
      G.spinVel=dir!==0?lerp(G.spinVel,svT,Math.min(1,8*dt)):G.spinVel*Math.max(0,1-5*dt);
      G.spinAngle+=G.spinVel*57.2958*dt;
      G.grabbing=K.down;
      if(G.grabbing)G.grabTime+=dt;
    }
    G.jumpBuf=Math.max(0,G.jumpBuf-dt);
    /* world-Y: баллистика, приземление на mesh */
    if(G.grounded){
      syncGroundY();
    }else{
      G.y+=G.vy*dt;
      G.vy-=24*dt;
      const ground=gyAt();
      G.py=G.y-ground;
      if(G.y<=ground&&G.vy<=0){G.y=ground;onLand();}
    }
    /* позиция X + мягкий anti-void край (не стена) */
    G.x+=G.vx*dt;
    if(G.windAmp>0)G.vx+=Math.sin(G.time*0.5)*G.windAmp*0.4*dt;
    const ax=Math.abs(G.x);
    if(ax>FREERIDE_SOFT){
      const over=ax-FREERIDE_SOFT;
      G.vx-=Math.sign(G.x)*over*2.2*dt;
      if(ax>FREERIDE_HARD){
        G.x=Math.sign(G.x)*FREERIDE_HARD;
        G.vx*=0.55;
      }
    }
    /* спрей от кантов */
    if(G.grounded&&Math.abs(G.vx)>3.5)
      emitSpray(3,G.x-Math.sign(G.vx)*0.3,G.y+0.04,0.3,{vx:Math.sign(G.vx)*1.2,vy:1.4,vz:4,vsx:1});
    if(G.grounded&&brake&&G.speed>8)
      emitSpray(5,G.x,G.y+0.05,0.5,{vx:0,vy:2,vyr:2.5,vz:6,vsx:2.5});
    /* прогресс */
    G.score+=G.speed*dt*2;
    processSpawns();
    checkStage();
  }
  const scroll=G.speed*dt;
  if(G.state==='running')G.dist+=scroll;
  moveWorld(scroll,dt);
  /* препятствия */
  for(let i=obstacles.length-1;i>=0;i--){
    const o=obstacles[i];
    o.group.position.z+=scroll;
    o.group.position.y=terrainHeight(o.x,G.dist-o.group.position.z);
    const z=o.group.position.z;
    if(z>KILL_Z){scene.remove(o.group);obstacles.splice(i,1);continue;}
    if(o.type==='gate'){
      const fl=o.group.userData.flags;
      for(let k=0;k<fl.length;k++){
        fl[k].f.rotation.y=Math.sin(G.time*7+o.phase+k*1.7)*0.35;
      }
      if(o.flash>0){
        o.flash-=dt*1.8;
        for(const q of fl){
          q.f.material.emissiveIntensity=0.35+Math.max(0,o.flash)*2.2;
          q.b.emissiveIntensity=1.5+Math.max(0,o.flash)*3;
        }
      }
    }
    if(G.state!=='running')continue;
    const dx=Math.abs(G.x-o.x);
    if(o.type==='gate'){
      if(!o.passed&&z>0.35){
        o.passed=true;
        if(dx<=o.half){
          const pts=Math.round(50*G.mult);
          addScore(pts);comboUp();
          popup(`ВОРОТА +${pts}`,'good');
          o.flash=1;SFX.gate();
        }else{
          comboReset();popup('МИМО ВОРОТ','bad');
        }
      }
    }else if(o.type==='ramp'){
      if(!o.used&&G.grounded&&Math.abs(z)<1.1&&dx<1.7){o.used=true;rampLaunch();}
    }else{
      if(Math.abs(z)<o.zd&&dx<o.r+0.45&&G.py<o.h-0.12){crash(o.type);}
      else if(!o.passed&&z>0.45){
        o.passed=true;
        if(dx<o.r+2.0)nearMiss();
      }
    }
  }
  riderPose(dt);
  cameraUpdate(dt);
  snowUpdate(dt,scroll);
  sprayUpdate(dt,scroll);
  /* HUD */
  if(G.state==='running'||G.state==='crash'){
    $('speedVal').textContent=Math.round(G.speed*3.6);
    $('speedBarFill').style.width=Math.min(100,G.speed/36*100)+'%';
    $('scoreVal').textContent=fmt(G.score);
    $('bestVal').textContent='РЕКОРД '+fmt(Math.max(best.score,G.score));
    $('distVal').textContent=fmt(G.dist)+' м';
    $('stageName').textContent=`ЭТАП ${G.stage} · ${stageName(G.stage)}`;
    const cb=$('comboBox');
    if(G.combo>=1){
      cb.classList.remove('hidden');
      $('comboMult').textContent='×'+(Math.round(G.mult*10)/10);
      $('comboCnt').textContent='СЕРИЯ '+G.combo;
    }else cb.classList.add('hidden');
  }
  vignetteEl.style.opacity=clamp(0.25+G.speed/34*0.35+(G.state==='crash'?0.2:0),0,0.8);
  if(A.windGain&&A.ctx){
    const t=A.muted?0:(0.04+G.speed/34*0.16);
    A.windGain.gain.value=lerp(A.windGain.gain.value,t,0.1);
    A.windFilter.frequency.value=260+G.speed*26+G.stage*40;
  }
}

export function boot(){
  setupInput({
    startGame, restart, togglePause, toggleMute, toggleTheme, initAudio,
    A, getState:()=>G.state,
    onJump:()=>{G.jumpBuf=0.14;}
  });
  const mb=$('menuBest');
  if(best.score>0)mb.textContent=`ЛУЧШИЙ РЕЗУЛЬТАТ: ${fmt(best.score)} ОЧКОВ · ${fmt(best.dist)} М`;
  applyTheme(dayFactor);
  reset();
  G.state='menu';
  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.05);
    if(G.state!=='paused')update(dt);
    else themeTick(dt);
    renderer.render(scene,camera);
  }
  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
  addEventListener('pointerdown',()=>{initAudio();if(A.ctx&&A.ctx.state==='suspended')A.ctx.resume();},{once:false});
  animate();
}

export { update, reset, startGame, restart, togglePause };
