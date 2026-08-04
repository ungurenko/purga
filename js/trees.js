import * as THREE from 'three';
import { rand } from './utils.js';

/* ═══════════ shared materials (day/night mutates these) ═══════════ */
export const treeDarkMat=new THREE.MeshStandardMaterial({color:0x102e2c,roughness:0.95,metalness:0.02});
export const treeMidMat=new THREE.MeshStandardMaterial({color:0x163a36,roughness:0.92,metalness:0.02});
export const treeSnowMat=new THREE.MeshStandardMaterial({color:0xe8eef8,roughness:1,metalness:0});
export const trunkMat=new THREE.MeshStandardMaterial({color:0x241b12,roughness:0.95,metalness:0.02});

/* ═══════════ shared unit geometries (scale per mesh) ═══════════ */
const GEO_CONE=new THREE.ConeGeometry(1,1,11);
const GEO_CONE_LO=new THREE.ConeGeometry(1,1,8);
const GEO_CYL=new THREE.CylinderGeometry(1,1,1,9);
const GEO_SPH=new THREE.SphereGeometry(1,8,6);
const GEO_ICOS=new THREE.IcosahedronGeometry(1,0);

const MORPHS=[
  /* tall: slender, many tiers */
  {id:'tall',w:0.33,tiers:7,rMul:0.88,hMul:1.12,paws:4,pawLen:0.92,lean:0.035},
  /* full: classic balanced fir */
  {id:'full',w:0.40,tiers:6,rMul:1.00,hMul:1.00,paws:5,pawLen:1.00,lean:0.05},
  /* stocky: wider, denser lower crown */
  {id:'stocky',w:0.27,tiers:5,rMul:1.16,hMul:0.90,paws:6,pawLen:1.08,lean:0.06}
];

function pickMorph(){
  let r=Math.random(),acc=0;
  for(const m of MORPHS){acc+=m.w;if(r<=acc)return m;}
  return MORPHS[1];
}

function mesh(geo,mat){return new THREE.Mesh(geo,mat);}

const _up=new THREE.Vector3(0,1,0);
const _dir=new THREE.Vector3();

/** Radial branch “paw”: fat base near trunk, tip outward-down */
function addPaw(parent,tierY,tierR,ang,pawLen,needles){
  const len=tierR*rand(0.30,0.46)*pawLen;
  const thick=len*rand(0.34,0.52);
  const baseR=tierR*rand(0.42,0.58);
  const tipR=tierR*rand(0.92,1.12);
  const by=tierY+rand(-0.04,0.05)*tierR;
  const ty=by-len*rand(0.35,0.55);

  const bx=Math.cos(ang)*baseR;
  const bz=Math.sin(ang)*baseR;
  const tx=Math.cos(ang)*tipR;
  const tz=Math.sin(ang)*tipR;

  const paw=mesh(GEO_CONE_LO,needles);
  paw.scale.set(thick,len,thick*rand(0.7,0.95));
  /* cone apex is +Y; place center along base→tip */
  paw.position.set((bx+tx)*0.5,(by+ty)*0.5,(bz+tz)*0.5);
  _dir.set(tx-bx,ty-by,tz-bz).normalize();
  paw.quaternion.setFromUnitVectors(_up,_dir);
  parent.add(paw);

  if(Math.random()<0.58){
    const tip=mesh(GEO_SPH,treeSnowMat);
    const tr=thick*rand(0.38,0.62);
    tip.scale.set(tr*1.15,tr*rand(0.4,0.65),tr*1.15);
    tip.position.set(tx,ty+tr*0.15,tz);
    parent.add(tip);
  }

  /* secondary smaller needle tuft near tip */
  if(Math.random()<0.4){
    const tuft=mesh(GEO_CONE_LO,needles);
    const tl=len*rand(0.35,0.55);
    tuft.scale.set(thick*0.55,tl,thick*0.45);
    const ux=tx+Math.cos(ang+0.4)*len*0.15;
    const uz=tz+Math.sin(ang+0.4)*len*0.15;
    tuft.position.set((tx+ux)*0.5,ty-tl*0.2,(tz+uz)*0.5);
    _dir.set(ux-tx,-tl,uz-tz).normalize();
    if(_dir.lengthSq()>0.01)tuft.quaternion.setFromUnitVectors(_up,_dir);
    parent.add(tuft);
  }
}

/**
 * Detailed track-side fir. Style matches rider.js: multi-part procedural,
 * shared mats/geo, no external assets.
 * @param {number} s overall scale (spawn uses ~0.8–1.25)
 * @returns {THREE.Group}
 */
export function buildTree(s=1){
  const morph=pickMorph();
  const g=new THREE.Group();
  g.userData.morph=morph.id;

  const lean=morph.lean*rand(0.4,1.2)*(Math.random()<0.5?-1:1);
  const leanAxis=Math.random()<0.5?'x':'z';
  g.rotation[leanAxis]=lean;
  g.rotation.y=rand(Math.PI*2);

  /* ── trunk + root flare ── */
  const trunkH=0.72*s*morph.hMul;
  const trunkTop=0.055*s;
  const trunkBot=0.12*s*morph.rMul;
  const trunk=mesh(GEO_CYL,trunkMat);
  trunk.scale.set(trunkBot,trunkH,trunkBot);
  /* cylinder is height 1 centered; shift so base sits on ground, top tapers via second mesh */
  trunk.position.y=trunkH*0.5;
  g.add(trunk);

  const trunkUpper=mesh(GEO_CYL,trunkMat);
  trunkUpper.scale.set(trunkTop,trunkH*0.55,trunkTop);
  trunkUpper.position.y=trunkH*0.72;
  g.add(trunkUpper);

  /* root nubs */
  const rootN=3+Math.floor(rand(2));
  for(let i=0;i<rootN;i++){
    const a=(i/rootN)*Math.PI*2+rand(-0.25,0.25);
    const root=mesh(GEO_CONE_LO,trunkMat);
    const rl=rand(0.16,0.28)*s*morph.rMul;
    const rt=rl*rand(0.45,0.7);
    root.scale.set(rt,rl,rt*0.85);
    root.position.set(Math.cos(a)*trunkBot*1.1,rl*0.22,Math.sin(a)*trunkBot*1.1);
    root.rotation.order='YXZ';
    root.rotation.y=a+Math.PI/2;
    root.rotation.z=-Math.PI/2+0.55;
    g.add(root);
  }

  /* snow ring at base */
  const baseSnow=mesh(GEO_SPH,treeSnowMat);
  baseSnow.scale.set(trunkBot*2.4,0.07*s,trunkBot*2.4);
  baseSnow.position.y=0.04*s;
  g.add(baseSnow);

  /* ── crown tiers (bottom → top indices) ── */
  const n=morph.tiers;
  const crownBase=trunkH*0.55;
  const crownTop=trunkH*0.15+2.55*s*morph.hMul;
  let maxR=0;

  const tierSpecs=[];
  for(let i=0;i<n;i++){
    /* i=0 bottom (widest), i=n-1 tip */
    const t=i/(n-1);
    const r=(1.15-t*0.78)*morph.rMul*s;
    const h=(0.55+t*0.22)*s*morph.hMul*rand(0.92,1.08);
    const y=crownBase+(crownTop-crownBase)*(0.12+t*0.88);
    tierSpecs.push({r,h,y,t,i});
    if(r>maxR)maxR=r;
  }

  for(const spec of tierSpecs){
    const {r,h,y,t,i}=spec;
    const needles=i%2===0?treeDarkMat:treeMidMat;
    const ox=rand(-0.06,0.06)*s;
    const oz=rand(-0.06,0.06)*s;
    const ax=1+rand(-0.12,0.12);
    const az=1+rand(-0.12,0.12);

    const body=mesh(GEO_CONE,needles);
    body.scale.set(r*ax,h,r*az);
    body.position.set(ox,y,oz);
    body.rotation.y=rand(Math.PI*2);
    body.rotation.x=rand(-0.04,0.04);
    body.rotation.z=rand(-0.04,0.04);
    g.add(body);

    /* inner denser under-layer for volume */
    if(i<n-1&&Math.random()<0.75){
      const under=mesh(GEO_CONE_LO,needles===treeDarkMat?treeMidMat:treeDarkMat);
      under.scale.set(r*ax*0.78,h*0.72,r*az*0.78);
      under.position.set(ox*0.5,y-h*0.08,oz*0.5);
      under.rotation.y=rand(Math.PI);
      g.add(under);
    }

    /* thick snow cap on upper face of tier */
    const snH=h*rand(0.14,0.22);
    const sn=mesh(GEO_CONE,treeSnowMat);
    sn.scale.set(r*ax*1.02,snH,r*az*1.02);
    sn.position.set(ox,y+h*0.5-snH*0.55+0.02*s,oz);
    sn.rotation.y=body.rotation.y+rand(-0.2,0.2);
    g.add(sn);

    /* soft snow blob on top of lower/mid tiers */
    if(t<0.85&&Math.random()<0.7){
      const cap=mesh(GEO_SPH,treeSnowMat);
      const cr=r*rand(0.22,0.38);
      cap.scale.set(cr,cr*rand(0.28,0.42),cr);
      cap.position.set(ox+rand(-0.08,0.08)*s,y+h*0.38,oz+rand(-0.08,0.08)*s);
      g.add(cap);
    }

    /* branch paws — skip pure tip, denser lower */
    if(i<n-1){
      const pawCount=morph.paws+(i===0?1:0)-(i>=n-2?1:0);
      const baseAng=rand(Math.PI*2);
      for(let p=0;p<pawCount;p++){
        const ang=baseAng+(p/pawCount)*Math.PI*2+rand(-0.22,0.22);
        addPaw(g,y-h*0.15,r,ang,morph.pawLen*(1-t*0.25),needles);
      }
    }
  }

  /* tip spike */
  const tip=mesh(GEO_CONE,treeDarkMat);
  const tipH=0.28*s*morph.hMul;
  tip.scale.set(0.12*s*morph.rMul,tipH,0.12*s*morph.rMul);
  tip.position.y=crownTop+tipH*0.35;
  g.add(tip);
  const tipSnow=mesh(GEO_SPH,treeSnowMat);
  tipSnow.scale.set(0.07*s,0.05*s,0.07*s);
  tipSnow.position.y=crownTop+tipH*0.55;
  g.add(tipSnow);

  /* snow clumps on lower crown */
  const clumps=2+Math.floor(rand(4));
  for(let c=0;c<clumps;c++){
    const a=rand(Math.PI*2);
    const rr=maxR*rand(0.45,0.95);
    const cl=mesh(Math.random()<0.5?GEO_SPH:GEO_ICOS,treeSnowMat);
    const cs=rand(0.06,0.14)*s;
    cl.scale.set(cs*rand(0.9,1.3),cs*rand(0.5,0.85),cs*rand(0.9,1.3));
    cl.position.set(
      Math.cos(a)*rr,
      crownBase+rand(0.15,0.9)*s*morph.hMul,
      Math.sin(a)*rr
    );
    cl.rotation.set(rand(2),rand(2),rand(2));
    g.add(cl);
  }

  /* rare icicles under mid tiers */
  if(Math.random()<0.45){
    const icicles=1+Math.floor(rand(2));
    for(let k=0;k<icicles;k++){
      const a=rand(Math.PI*2);
      const ice=mesh(GEO_CONE_LO,treeSnowMat);
      const ih=rand(0.12,0.22)*s;
      ice.scale.set(0.025*s,ih,0.025*s);
      ice.position.set(
        Math.cos(a)*maxR*rand(0.5,0.85),
        crownBase+rand(0.3,0.8)*s,
        Math.sin(a)*maxR*rand(0.5,0.85)
      );
      ice.rotation.x=Math.PI; /* point down */
      g.add(ice);
    }
  }

  /* hit radius hint for spawn (visual max extent, slightly conservative) */
  g.userData.hitR=maxR*0.72+0.18*s;
  g.userData.height=crownTop+tipH+0.1*s;

  return g;
}
