import * as THREE from 'three';
import { clamp, lerp, rand, $, fmt } from './utils.js';
import {
  G, best, saveBest, stageName, FREERIDE_SOFT, FREERIDE_HARD, KILL_Z, SPAWN_Z,
  obstacles, pendingRows, track
} from './state.js';
import {
  renderer, scene, camera, skyMat,
  moonLight, warmPt,
  forestUpdate, lanterns, LANT_N, LANT_SP,
  terrainHeight, terrainSlope, updateTerrain,
  sparkleU, snowU, trailEmit, trailUpdate, trailReset,
  mountainsUpdate, blobShadowUpdate, lanternLightsUpdate
} from './scene.js';
import { composer, setGrade } from './postfx.js';
import { qualityInit, qualityFrame, qualityTier } from './quality.js';
import { riderG, boardG, riderPose, riderWeather } from './rider.js';
import {
  emitSpray, emitPowderBurst, blizzardUpdate
} from './blizzard.js';
import { processSpawns } from './obstacles.js';
import { THEME_NIGHT, THEME_DAY, dayFactor, themeTick, applyTheme, toggleTheme } from './theme.js';
import { A, initAudio, playTone, SFX, toggleMute } from './audio.js';
import { vignetteEl, popupsEl, popup, banner, flashScreen, addScore, comboUp, comboReset } from './ui.js';
import { K, setupInput } from './input.js';
import { initCamera, cameraUpdate, addTrauma, impulseDip } from './camera.js';

/* ═══════════ столкновения / события трассы ═══════════ */
const gyAt=(x=G.x,z=0)=>terrainHeight(x,G.dist-z);
function syncGroundY(){
  const g=gyAt();
  G.y=g;G.py=0;
  G.prevGroundY=g;
  return g;
}
function nearMiss(){
  const pts=Math.round(30*G.mult);
  addScore(pts);comboUp();
  popup(`РЯДОМ! +${pts}`,'near');SFX.near();
  addTrauma(0.12);
}
const REASONS={tree:'Врезался в ель',boulder:'Ледяная глыба',rock:'Скальный выступ',
  fence:'Не перепрыгнул ограждение',spin:'Поймал кант при приземлении'};
function crash(reason){
  if(G.state!=='running')return;
  G.state='crash';G.crashT=0;G.crashReason=REASONS[reason]||'Падение';
  comboReset();SFX.crash();flashScreen();
  addTrauma(0.85);
  impulseDip(0.4);
  emitPowderBurst(G.x,G.y+0.1,true);
  emitSpray(40,G.x,G.y+0.1,0,{sx:1.2,vx:0,vy:2,vyr:4,vz:3,vsx:5});
}
function rampLaunch(){
  G.grounded=false;
  G.vy=8.6+G.speed*0.10;
  G.takeoffT=G.time;
  popup('ТРАМПЛИН!','info');SFX.ramp();
  impulseDip(-0.22);
  addTrauma(0.08);
  emitSpray(12,G.x,G.y+0.1,0.8,{vx:0,vy:1.5,vz:5});
}
function doJump(){
  if(!G.grounded)return;
  G.grounded=false;G.vy=7.6;G.takeoffT=G.time;G.jumpBuf=0;
  SFX.jump();
  impulseDip(-0.08);
  emitSpray(8,G.x,G.y+0.05,0.4,{vx:0,vy:1.2,vz:5});
}
function onLand(){
  const air=G.time-G.takeoffT;
  G.grounded=true;G.vy=0;G.gvy=0;
  syncGroundY();
  G.landAbsorb=Math.min(0.5,Math.max(0.18,air*0.12));
  const hard=air>0.55;
  impulseDip(hard?0.35:0.18);
  addTrauma(hard?0.22:0.15);
  SFX.land();
  emitPowderBurst(G.x,G.y+0.05,hard);
  emitSpray(hard?16:10,G.x,G.y+0.05,0,{sx:0.9,vx:0,vy:1.5,vyr:3,vz:4,vsx:3});
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
        SFX.stumble();
        addTrauma(0.35);
        impulseDip(0.28);
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

/* ═══════════ обновление мира ═══════════ */
function moveWorld(scroll,dt){
  updateTerrain(G.dist);
  forestUpdate(G.dist,scroll,G.time);
  for(const l of lanterns){
    l.g.position.z+=scroll;
    if(l.g.position.z>14){
      l.g.position.z-=LANT_N*LANT_SP;
      l.x=(Math.random()<0.5?-1:1)*rand(5,32);
    }
    const lx=l.x??l.g.position.x;
    l.g.position.x=lx;
    l.g.position.y=terrainHeight(lx,G.dist-l.g.position.z);
    const glowB=THEME_NIGHT.glowBase+(THEME_DAY.glowBase-THEME_NIGHT.glowBase)*dayFactor;
    l.sp.material.opacity=glowB*(0.84+0.32*Math.sin(G.time*7+l.phase));
  }
  mountainsUpdate(G.x,dayFactor);
  const gy=terrainHeight(G.x*0.5,G.dist+5);
  warmPt.position.set(G.x*0.5,gy+2.4,-5);
  const warmBase=THEME_NIGHT.warmI+(THEME_DAY.warmI-THEME_NIGHT.warmI)*dayFactor;
  warmPt.intensity=warmBase+Math.sin(G.time*11)*1.2*(1-dayFactor);
  const shTgt=moonLight.target.position;
  shTgt.set(G.x,terrainHeight(G.x,G.dist),0);
  const dir=moonLight.position.clone().sub(shTgt).normalize();
  moonLight.position.copy(shTgt).addScaledVector(dir,60);
  moonLight.target.updateMatrixWorld();
  const airH=G.grounded?0:G.py;
  blobShadowUpdate(G.x,G.dist,airH,terrainSlope(G.x,G.dist));
  if(G.grounded&&G.speed>4&&G.state==='running')trailEmit(G.x);
  trailUpdate(G.dist,scroll,dt);
  lanternLightsUpdate(dayFactor,qualityTier()>0);
  snowU.wind.value=G.windAmp;
}
function weatherUpdate(dt,scroll){
  scene.fog.density=lerp(scene.fog.density,G.fogT,Math.min(1,dt*0.7));
  blizzardUpdate(dt,scroll,{
    stage:G.stage,windAmp:G.windAmp,time:G.time,speed:G.speed,
    dist:G.dist,day:dayFactor,snowOpT:G.snowOpT,snowSizeT:G.snowSizeT,
    x:G.x,y:G.y,grounded:G.grounded,vx:G.vx
  });
}

/* ═══════════ управление состоянием ═══════════ */
function reset(){
  G.score=0;G.dist=0;G.stage=1;G.cruise=13;G.combo=0;G.mult=1;
  G.speed=10;G.x=0;G.vx=0;G.vy=0;G.grounded=true;
  G.spinAngle=0;G.spinVel=0;G.visualSpin=0;G.grabTime=0;G.grabbing=false;
  G.maxSpeed=0;G.jumpBuf=0;G.gvy=0;
  trailReset();
  G.fogT=0.015;G.snowOpT=0.6;G.snowSizeT=0.11;G.windAmp=0;
  track.pathX=0;pendingRows.length=0;
  for(const o of obstacles)scene.remove(o.group);
  obstacles.length=0;
  track.spawnCursor=0;
  scene.fog.density=G.fogT;
  riderG.rotation.set(0,0,0);
  const gy0=syncGroundY();
  riderG.position.set(0,gy0,0);
  initCamera({groundY:gy0});
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
  sparkleU.value=G.time;
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
    /* world-Y: прилипание к рельефу + вылет с гребней и крутых перегибов */
    if(G.grounded){
      const g=gyAt();
      const gvyInst=(g-G.prevGroundY)/Math.max(dt,1e-4);
      G.prevGroundY=g;
      G.y=g;G.py=0;
      G.gvy=lerp(G.gvy,gvyInst,0.3);
      /* резкий перегиб после подъёма (гребень/трамплин) — инерция несёт вверх */
      const crest=G.gvy>1.6&&gvyInst<G.gvy-5.5;
      /* большой провал на скорости — склон уходит из-под ног */
      const drop=gvyInst<-9&&G.speed>14;
      if(crest||drop){
        G.grounded=false;
        G.vy=clamp(G.gvy,-3,11);
        G.takeoffT=G.time;
        emitSpray(12,G.x,G.y+0.05,0.4,{vx:0,vy:1.2,vz:4});
        if(crest){popup('ГРЕБЕНЬ!','info');SFX.ramp();impulseDip(-0.16);}
        else addTrauma(0.1);
      }
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
  weatherUpdate(dt,scroll);
  const speedN=clamp(G.speed/36,0,1);
  const frost=clamp((G.stage-1)/7*0.55+speedN*0.4,0,1)*(1-dayFactor*0.35);
  setGrade({day:dayFactor,speedN,frost,time:G.time});
  riderWeather({
    day:dayFactor,speed:G.speed,stage:G.stage,time:G.time,
    grounded:G.grounded,state:G.state,frost,dt
  });
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
  riderG.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  reset();
  G.state='menu';
  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.05);
    qualityFrame(dt);
    if(G.state!=='paused')update(dt);
    else themeTick(dt);
    if(qualityTier()===0)renderer.render(scene,camera);
    else composer.render();
  }
  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
    composer.setSize(innerWidth,innerHeight);
  });
  addEventListener('pointerdown',()=>{initAudio();if(A.ctx&&A.ctx.state==='suspended')A.ctx.resume();},{once:false});
  qualityInit();
  animate();
}

export { update, reset, startGame, restart, togglePause };
