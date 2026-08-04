/* Camera physics: damped follow, velocity look-ahead, spring dip, trauma shake */
import * as THREE from 'three';
import { clamp, expDamp, smoothstep } from './utils.js';
import { G } from './state.js';
import { camera, terrainHeight, terrainSlope } from './scene.js';
import { K } from './input.js';

/** Tunable rig — one place for feel. */
const CAM={
  /* base framing */
  baseH:3.55,
  baseZ:9.2,
  followX:0.62,
  airFollow:0.48,
  pitchScale:0.28,
  /* axis damping (higher = snappier) */
  lambdaX:10,
  lambdaY:5.2,
  lambdaZ:4.2,
  lambdaLook:5.5,
  lambdaFov:3.2,
  /* double-damp ground height (inner then outer) */
  lambdaGroundIn:3.4,
  lambdaGroundOut:2.6,
  /* look-ahead */
  lookXFollow:0.78,
  lookVxLead:0.22,
  lookBase:18,
  lookPerSpeed:0.32,
  lookYLift:1.22,
  lookAir:0.32,
  lookZScale:0.72,
  posVxLead:0.055,
  /* speed composition */
  maxSpeed:36,
  fovBase:59,
  fovSpeed:14,
  fovTuck:2.4,
  fovBrake:-2,
  fovSlope:3.2,
  zPullMax:1.35,
  speedLiftMax:0.28,
  /* menu softer */
  menuLambdaMul:0.55,
  /* dip spring */
  dipStiff:48,
  dipDamp:11,
  /* trauma shake (Eiserloh) */
  traumaDecay:1.65,
  traumaExp:2,
  shakeAmpX:0.42,
  shakeAmpY:0.32,
  shakeAmpZ:0.08,
  shakeRollMax:0.012,
  noiseSpeed:22,
  shakeMult:1
};

const pos=new THREE.Vector3(0,CAM.baseH,CAM.baseZ);
const look=new THREE.Vector3(0,1.2,-18);
const desiredPos=new THREE.Vector3();
const desiredLook=new THREE.Vector3();

let groundIn=0;
let groundOut=0;
let dip=0;
let dipVel=0;
let trauma=0;
let noiseT=0;
let fov=CAM.fovBase;
let ready=false;

/* cheap 1D value-noise for shake (no scene dependency) */
function hash1(i){
  const n=Math.sin(i*127.1+311.7)*43758.5453123;
  return n-Math.floor(n);
}
function noise1(x){
  const i=Math.floor(x);
  const f=x-i;
  const u=f*f*(3-2*f);
  return hash1(i)+(hash1(i+1)-hash1(i))*u;
}
function signedNoise(x){
  return noise1(x)*2-1;
}

export function addTrauma(amount){
  trauma=clamp(trauma+amount,0,1);
}

export function impulseDip(amount){
  /* positive = camera dips down (landing), negative = lifts (takeoff) */
  dipVel+=amount*14;
  dip+=amount*0.35;
}

export function initCamera(opts={}){
  const gy=opts.groundY??G.y??0;
  groundIn=gy;
  groundOut=gy;
  dip=0;
  dipVel=0;
  trauma=0;
  noiseT=0;
  fov=CAM.fovBase;
  pos.set(0,gy+CAM.baseH,CAM.baseZ);
  look.set(0,gy+CAM.lookYLift,-CAM.lookBase*CAM.lookZScale);
  camera.position.copy(pos);
  camera.fov=fov;
  camera.updateProjectionMatrix();
  camera.lookAt(look);
  ready=true;
}

export function cameraUpdate(dt){
  if(!ready)initCamera({groundY:G.y});
  const menu=G.state==='menu';
  const lamMul=menu?CAM.menuLambdaMul:1;
  const speed=G.speed;
  const spN=clamp(speed/CAM.maxSpeed,0,1);
  const spEase=smoothstep(0.08,0.92,spN);

  /* terrain anchor — double damper kills ridge noise */
  const rawGy=G.grounded?G.y:terrainHeight(G.x,G.dist);
  groundIn=expDamp(groundIn,rawGy,CAM.lambdaGroundIn,dt);
  groundOut=expDamp(groundOut,groundIn,CAM.lambdaGroundOut*lamMul,dt);

  const slope=terrainSlope(G.x,G.dist);
  const pitchLift=clamp(-slope.dhds*0.85,-0.9,1.1)*CAM.pitchScale;
  const speedLift=spEase*CAM.speedLiftMax;
  const zPull=spEase*CAM.zPullMax;

  /* dip spring toward 0 */
  const dipAcc=-CAM.dipStiff*dip-CAM.dipDamp*dipVel;
  dipVel+=dipAcc*dt;
  dip+=dipVel*dt;
  if(Math.abs(dip)<1e-4&&Math.abs(dipVel)<1e-3){dip=0;dipVel=0;}

  /* desired rig */
  const followX=G.x*CAM.followX+G.vx*CAM.posVxLead;
  desiredPos.set(
    followX,
    groundOut+CAM.baseH+G.py*CAM.airFollow-dip+pitchLift+speedLift,
    CAM.baseZ+zPull
  );

  const lx=expDamp(pos.x,desiredPos.x,CAM.lambdaX*lamMul,dt);
  const ly=expDamp(pos.y,desiredPos.y,CAM.lambdaY*lamMul,dt);
  const lz=expDamp(pos.z,desiredPos.z,CAM.lambdaZ*lamMul,dt);
  pos.set(lx,ly,lz);

  /* look-ahead grows with speed; leads lateral velocity */
  const lookDist=CAM.lookBase+speed*CAM.lookPerSpeed;
  const lookX=G.x*CAM.lookXFollow+G.vx*CAM.lookVxLead*(menu?0.4:1);
  const gyLook=terrainHeight(lookX,G.dist+lookDist);
  desiredLook.set(
    lookX,
    gyLook+CAM.lookYLift+G.py*CAM.lookAir,
    -lookDist*CAM.lookZScale
  );
  look.x=expDamp(look.x,desiredLook.x,CAM.lambdaLook*lamMul,dt);
  look.y=expDamp(look.y,desiredLook.y,CAM.lambdaLook*lamMul,dt);
  look.z=expDamp(look.z,desiredLook.z,CAM.lambdaLook*lamMul,dt);

  /* FOV composition */
  const tuck=K.up&&G.grounded&&!menu;
  const brake=K.down&&G.grounded&&!menu;
  const slopeBoost=clamp(-slope.dhds*CAM.fovSlope,0,CAM.fovSlope);
  let fovT=CAM.fovBase+spEase*CAM.fovSpeed+slopeBoost;
  if(tuck)fovT+=CAM.fovTuck;
  if(brake)fovT+=CAM.fovBrake;
  if(menu)fovT=CAM.fovBase;
  fov=expDamp(fov,fovT,CAM.lambdaFov,dt);

  /* trauma decay + noise offset (applied only to render pose) */
  if(trauma>0){
    trauma=Math.max(0,trauma*Math.exp(-CAM.traumaDecay*dt));
    if(trauma<0.002)trauma=0;
  }
  noiseT+=dt*CAM.noiseSpeed;
  const shakeAmt=Math.pow(trauma,CAM.traumaExp)*CAM.shakeMult;
  const sx=signedNoise(noiseT)*CAM.shakeAmpX*shakeAmt;
  const sy=signedNoise(noiseT+17.3)*CAM.shakeAmpY*shakeAmt;
  const sz=signedNoise(noiseT+41.1)*CAM.shakeAmpZ*shakeAmt;
  const roll=signedNoise(noiseT+7.7)*CAM.shakeRollMax*shakeAmt;

  camera.position.set(pos.x+sx,pos.y+sy,pos.z+sz);
  camera.lookAt(look);
  if(Math.abs(roll)>1e-5)camera.rotateZ(roll);

  if(Math.abs(camera.fov-fov)>0.01){
    camera.fov=fov;
    camera.updateProjectionMatrix();
  }
}
