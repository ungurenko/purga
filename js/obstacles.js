import * as THREE from 'three';
import { clamp, rand } from './utils.js';
import { G, SPAWN_Z, obstacles, pendingRows, track } from './state.js';
import { scene, terrainHeight } from './scene.js';
import {
  buildTree, treeDarkMat, treeMidMat, treeSnowMat, trunkMat
} from './trees.js';

// box helper used by builders (also in rider but local)
const box=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);

/* ═══════════ материалы / геометрии препятствий ═══════════ */
const iceMat=new THREE.MeshStandardMaterial({color:0x9ccfe6,roughness:0.25,metalness:0.05,flatShading:true});
const rockMat=new THREE.MeshStandardMaterial({color:0x5c6674,roughness:0.95,flatShading:true});
const woodMat=new THREE.MeshStandardMaterial({color:0x4d3a28,roughness:0.9});
const rampWoodMat=new THREE.MeshStandardMaterial({color:0x3a2d1f,roughness:0.9});
const lipMat=new THREE.MeshStandardMaterial({color:0xffab4a,emissive:0xff7a2a,emissiveIntensity:1.4,roughness:0.5});
function buildBoulder(r){
  const g=new THREE.Group();
  const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),iceMat);
  m.scale.setScalar(r);m.position.y=r*0.72;m.rotation.set(rand(6.28),rand(6.28),rand(6.28));g.add(m);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),treeSnowMat);
  cap.scale.set(r*0.6,r*0.25,r*0.6);cap.position.y=r*1.35;g.add(cap);
  return g;
}
function buildRock(r){
  const g=new THREE.Group();
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),rockMat);
  m.scale.setScalar(r);m.position.y=r*0.62;m.rotation.set(rand(6.28),rand(6.28),0);g.add(m);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),treeSnowMat);
  cap.scale.set(r*0.55,r*0.22,r*0.55);cap.position.y=r*1.18;g.add(cap);
  return g;
}
function buildFence(w){
  const g=new THREE.Group();
  for(const s of[-1,1]){
    const p=box(0.13,1.15,0.13,woodMat);p.position.set(s*(w/2-0.06),0.57,0);g.add(p);
  }
  for(const y of[0.5,0.92]){
    const r=box(w,0.14,0.09,woodMat);r.position.y=y;g.add(r);
  }
  const sn=box(w,0.05,0.13,treeSnowMat);sn.position.y=1.02;g.add(sn);
  return g;
}
function buildRamp(){
  const g=new THREE.Group();
  const sh=new THREE.Shape();
  sh.moveTo(1.25,0);sh.lineTo(-1.25,0);sh.lineTo(-1.25,0.9);sh.closePath();
  const geo=new THREE.ExtrudeGeometry(sh,{depth:2.6,bevelEnabled:false});
  geo.translate(0,0,-1.3);
  const body=new THREE.Mesh(geo,rampWoodMat);
  body.rotation.y=-Math.PI/2;g.add(body);
  const slope=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.62),treeSnowMat);
  slope.rotation.x=-1.23;slope.position.set(0,0.47,0.03);g.add(slope);
  const lip=box(2.7,0.09,0.12,lipMat);lip.position.set(0,0.93,-1.22);g.add(lip);
  return g;
}
const flagMatBase=new THREE.MeshStandardMaterial({color:0xffab4a,emissive:0xff7a2a,emissiveIntensity:0.35,side:THREE.DoubleSide,roughness:0.7});
const bulbMatBase=new THREE.MeshStandardMaterial({color:0xffd9a0,emissive:0xffb050,emissiveIntensity:1.5});
const gatePoleMat=new THREE.MeshStandardMaterial({color:0x22262e,roughness:0.8});
function buildGate(){
  const g=new THREE.Group();
  const flags=[];
  for(const s of[-1,1]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,2.3,6),gatePoleMat);
    p.position.set(s*3,1.15,0);g.add(p);
    const b=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6),bulbMatBase.clone());
    b.position.set(s*3,2.36,0);g.add(b);
    const fShape=new THREE.Shape();
    fShape.moveTo(0,0);fShape.lineTo(-s*0.95,0.2);fShape.lineTo(0,0.42);fShape.closePath();
    const f=new THREE.Mesh(new THREE.ShapeGeometry(fShape),flagMatBase.clone());
    f.position.set(s*3,1.85,0);g.add(f);
    flags.push({f,b});
  }
  g.userData.flags=flags;
  return g;
}

/* ═══════════ спавн трассы ═══════════ */
function pathWalk(){track.pathX=clamp(track.pathX+rand(-3,3),-6.5,6.5);}
function avoidX(minD,center=track.pathX){
  for(let i=0;i<14;i++){
    const x=rand(-9.2,9.2);
    if(Math.abs(x-center)>minD)return x;
  }
  return center>0?center-minD-0.5:center+minD+0.5;
}
function addOb(group,type,x,props){
  group.position.set(x,terrainHeight(x,G.dist-SPAWN_Z),SPAWN_Z);
  scene.add(group);
  obstacles.push({type,group,x,passed:false,used:false,flash:0,phase:rand(6.28),...props});
}
const spawnTree=(x,s=1)=>{
  const g=buildTree(s);
  const r=(g.userData.hitR||(0.55*s+0.2));
  const h=Math.max(2.8,g.userData.height||3);
  addOb(g,'tree',x,{r,h,zd:0.55});
};
const spawnBoulder=x=>{const r=rand(0.85,1.25);addOb(buildBoulder(r),'boulder',x,{r:r*0.95,h:1.45,zd:0.8});};
const spawnRock=x=>{const r=rand(0.9,1.3);addOb(buildRock(r),'rock',x,{r:r*0.9,h:1.6,zd:0.8});};
const spawnFence=(cx,w)=>addOb(buildFence(w),'fence',cx,{r:w/2,h:1.0,zd:0.4});
const spawnRamp=x=>addOb(buildRamp(),'ramp',x,{r:1.6,h:0,zd:1.0});
const spawnGate=x=>addOb(buildGate(),'gate',x,{half:2.75});
const gapBase=()=>clamp(21-G.stage*2.0,9,21);
const rowGate=()=>{pathWalk();return{gap:26,build(){spawnGate(track.pathX);}};};
const rowTrees=()=>{pathWalk();const s=G.stage;
  return{gap:gapBase()+rand(0,7),build(){
    const n=2+(Math.random()<0.6?1:0)+(s>=3&&Math.random()<0.5?1:0);
    for(let i=0;i<n;i++)spawnTree(avoidX(2.7),rand(0.8,1.25));
  }};};
const rowBoulder=()=>{pathWalk();
  return{gap:gapBase()+rand(0,6),build(){
    spawnBoulder(avoidX(2.4));
    if(Math.random()<0.45)spawnBoulder(avoidX(2.4));
  }};};
const rowRocks=()=>{pathWalk();
  return{gap:gapBase()+rand(2,8),build(){
    let cx=track.pathX+(Math.random()<0.5?-1:1)*rand(3.5,6);
    cx=clamp(cx,-8,8);
    if(Math.abs(cx-track.pathX)<3)cx=clamp(track.pathX+(cx>track.pathX?3.4:-3.4),-8,8);
    const n=2+(Math.random()<0.5?1:0);
    for(let i=0;i<n;i++)spawnRock(clamp(cx+rand(-1.4,1.4),-9,9));
  }};};
const rowFence=()=>{pathWalk();
  return{gap:gapBase()+rand(2,8),build(){
    const force=Math.random()<0.55;
    const cx=force?track.pathX:clamp(track.pathX+(Math.random()<0.5?-1:1)*rand(3.5,5.5),-7.5,7.5);
    spawnFence(cx,rand(4.2,7));
  }};};
const rowRamp=()=>{pathWalk();const px=track.pathX;
  return{gap:20,build(){
    spawnRamp(px);
    if(Math.random()<0.65){
      pendingRows.push({gap:14,build(){
        if(Math.random()<0.5)spawnFence(track.pathX,rand(4,5.5));
        else spawnBoulder(track.pathX+rand(-0.8,0.8));
      }});
    }
  }};};
const rowSlalom=()=>{pathWalk();
  return{gap:12,build(){
    for(let i=0;i<4;i++){
      pendingRows.push({gap:11,build(){
        const gx=(i%2?-4.2:4.2)+rand(-1,1);
        for(let k=0;k<3;k++)spawnTree(avoidX(2.4,gx),rand(0.85,1.2));
      }});
    }
  }};};
/* Clear track: no obstacles. Keep builders above for easy restore. */
function randomRow(){
  return{gap:9999,build(){}};
}
function processSpawns(){
  /* empty track — nothing spawns on the slope */
}

export {
  treeDarkMat, treeMidMat, treeSnowMat, trunkMat, lipMat, flagMatBase, bulbMatBase,
  buildTree, buildBoulder, buildRock, buildFence, buildRamp, buildGate,
  addOb, spawnTree, spawnBoulder, spawnRock, spawnFence, spawnRamp, spawnGate,
  processSpawns, randomRow, pathWalk
};
