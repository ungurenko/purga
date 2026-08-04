import * as THREE from 'three';
import { clamp, lerp } from './utils.js';
import { G } from './state.js';
import { scene } from './scene.js';
import { K } from './input.js';

/* ═══════════ сноубордист ═══════════ */
const jacketMat=new THREE.MeshStandardMaterial({color:0x27435e,roughness:0.8,metalness:0.05});
const accentMat=new THREE.MeshStandardMaterial({color:0xff9a3c,roughness:0.55,metalness:0.1,emissive:0x4a1f00,emissiveIntensity:0.45});
const pantsMat=new THREE.MeshStandardMaterial({color:0x1d2733,roughness:0.9,metalness:0.02});
const helmetMat=new THREE.MeshStandardMaterial({color:0x161c2a,roughness:0.45,metalness:0.1});
const skinMat=new THREE.MeshStandardMaterial({color:0xd9a184,roughness:0.9,metalness:0});
const boardTopMat=new THREE.MeshStandardMaterial({color:0xff8a3c,roughness:0.5,metalness:0.05,emissive:0x3a1402,emissiveIntensity:0.35});
const boardBaseMat=new THREE.MeshStandardMaterial({color:0x101319,roughness:0.75,metalness:0.1});
const scarfMat=new THREE.MeshStandardMaterial({color:0xd84f3f,roughness:0.95,side:THREE.DoubleSide,emissive:0x3a0908,emissiveIntensity:0.3});
const metalMat=new THREE.MeshStandardMaterial({color:0x9aa9c2,roughness:0.35,metalness:0.78});
const bootMat=new THREE.MeshStandardMaterial({color:0x2a2f3a,roughness:0.5,metalness:0.15});
const bootCuffMat=new THREE.MeshStandardMaterial({color:0xff9a3c,roughness:0.5,metalness:0.1,emissive:0x3a1602,emissiveIntensity:0.3});
const bindingMat=new THREE.MeshStandardMaterial({color:0x1c2028,roughness:0.55,metalness:0.3});
const hairMat=new THREE.MeshStandardMaterial({color:0x1d150e,roughness:0.9,metalness:0});
const gloveMat=new THREE.MeshStandardMaterial({color:0xff9a3c,roughness:0.55,metalness:0.08,emissive:0x3a1602,emissiveIntensity:0.25});
const innerMat=new THREE.MeshStandardMaterial({color:0x1c2230,roughness:0.95,metalness:0});
const seamMat=new THREE.MeshStandardMaterial({color:0x101522,roughness:0.95,metalness:0});
const logoMat=new THREE.MeshStandardMaterial({color:0xff9a3c,roughness:0.5,metalness:0.1,emissive:0x3a1602,emissiveIntensity:0.4});
const bootSoleMat=new THREE.MeshStandardMaterial({color:0x0a0c12,roughness:0.95,metalness:0.1});
const box=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
function capsule(r,len,m,topPivot=true,seg=10){
  const g=new THREE.CapsuleGeometry(r,len,4,seg);
  if(topPivot)g.translate(0,-(len/2+r),0);
  return new THREE.Mesh(g,m);
}
function lathe(profile,m,seg=18){
  return new THREE.Mesh(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(Math.max(0.0001,p[0]),p[1])),seg),m);
}
/* боковые ребра для шарниров, чтобы круглые края читались */
const RING_GEO=new THREE.TorusGeometry(1,1,8,18);
const riderG=new THREE.Group();riderG.rotation.order='YXZ';scene.add(riderG);
/* ───── доска с боковым вырезом, кантами и графикой ───── */
const boardG=new THREE.Group();riderG.add(boardG);
{
  const d=new THREE.Shape();
  d.moveTo(-0.155,-0.70);
  d.quadraticCurveTo(0,-0.78,0.155,-0.70);
  d.quadraticCurveTo(0.140,0,0.185,0.62);
  d.quadraticCurveTo(0.130,0.80,0,0.80);
  d.quadraticCurveTo(-0.130,0.80,-0.185,0.62);
  d.quadraticCurveTo(-0.140,0,-0.155,-0.70);
  const geo=new THREE.ExtrudeGeometry(d,{depth:0.032,bevelEnabled:true,bevelThickness:0.014,bevelSize:0.014,bevelSegments:3,steps:1});
  geo.translate(0,0,-(0.016+0.014));
  geo.rotateX(-Math.PI/2);
  const deck=new THREE.Mesh(geo,boardTopMat);deck.position.y=0.045;boardG.add(deck);
  const base=box(0.30,0.012,1.44,boardBaseMat);base.position.y=0.012;boardG.add(base);
  for(const s of[-1,1]){
    const rail=box(0.012,0.05,1.52,metalMat);
    rail.position.set(s*0.158,0.045,0);boardG.add(rail);
  }
  const stripeA=box(0.22,0.012,1.40,boardTopMat.clone());
  stripeA.material.emissiveIntensity=0.6;stripeA.material.color.set(0x6a3018);
  stripeA.position.y=0.064;boardG.add(stripeA);
  for(const z of[-0.55,0,0.55]){
    const dot=box(0.10,0.014,0.06,accentMat);dot.position.set(0,0.064,z);boardG.add(dot);
  }
  for(const s of[-1,1]){
    const tip=box(0.30,0.032,0.22,boardTopMat);
    tip.position.set(0,0.058,s*0.63);tip.rotation.x=-s*0.5;boardG.add(tip);
    const tipBase=box(0.26,0.010,0.20,boardBaseMat);
    tipBase.position.set(0,0.041,s*0.63);tipBase.rotation.x=-s*0.5;boardG.add(tipBase);
  }
}
/* ───── крепления и ботинки на доске ───── */
const bindings=[];
const footTargets=[];
const bootPivots=[];
for(let i=0;i<2;i++){
  const side=i===0?-1:1;
  const bx=side*0.11;
  const bz=side===-1?-0.26:0.26;
  const bg=new THREE.Group();bg.position.set(bx,0,bz);boardG.add(bg);
  const baseplate=box(0.21,0.03,0.30,bindingMat);baseplate.position.y=0.061;bg.add(baseplate);
  const pad=box(0.19,0.012,0.28,bootSoleMat);pad.position.y=0.075;bg.add(pad);
  const heelcup=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.10,0.04,12,1,true,Math.PI*0.6,Math.PI*0.9),bindingMat);
  heelcup.rotation.z=Math.PI/2;heelcup.rotation.x=Math.PI/2;heelcup.position.set(0,0.09,0.13);bg.add(heelcup);
  const highback=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.27,0.024),accentMat.clone());
  highback.material.emissiveIntensity=0.55;
  highback.position.set(0,0.215,0.115);highback.rotation.x=-0.14;bg.add(highback);
  const highbackTop=new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,0.18,8,1,false),accentMat);
  highbackTop.rotation.z=Math.PI/2;highbackTop.position.set(0,0.350,0.118);bg.add(highbackTop);
  const brace=box(0.05,0.10,0.025,bindingMat);brace.position.set(0,0.13,0.135);brace.rotation.x=-0.14;bg.add(brace);
  for(const[sy,sz,bw,front]of[[0.235,0.025,0.18,1],[0.135,-0.035,0.18,0]]){
    const s=box(bw,0.028,0.05,metalMat);s.position.set(0,sy,sz);bg.add(s);
    const bk=box(0.028,0.032,0.04,accentMat);bk.position.set(front?bw*0.42:-bw*0.42,sy,sz);bg.add(bk);
  }
  const ratchet=box(0.05,0.07,0.025,metalMat);ratchet.position.set(0,0.30,0.13);bg.add(ratchet);
  const bootP=new THREE.Group();bootP.position.set(0,0.082,0);bg.add(bootP);bootPivots.push(bootP);
  const sole=box(0.18,0.018,0.30,bootSoleMat);sole.position.y=-0.001;bootP.add(sole);
  const boot=lathe([[0.082,0.008],[0.092,0.030],[0.082,0.075],[0.068,0.130],[0.064,0.190],[0.072,0.250],[0.080,0.310],[0.082,0.335]],bootMat,20);
  boot.scale.z=1.18;bootP.add(boot);
  const cuff=box(0.19,0.024,0.40,bootCuffMat);cuff.position.y=0.310;cuff.scale.z=0.92;bootP.add(cuff);
  const cuffBack=box(0.19,0.018,0.06,bootCuffMat);cuffBack.position.set(0,0.310,0.17);cuffBack.scale.z=0.92;bootP.add(cuffBack);
  const spine=box(0.022,0.27,0.018,seamMat);spine.position.set(0,0.18,0.075);bootP.add(spine);
  const heelCap=new THREE.Mesh(new THREE.SphereGeometry(0.08,12,10),bootMat);
  heelCap.scale.set(0.95,1.1,0.85);heelCap.position.set(0,0.16,0.082);bootP.add(heelCap);
  for(const yz of[[0.08,0.080],[0.16,0.088],[0.24,0.082]]){
    const lace=box(0.14,0.008,0.022,seamMat);lace.position.set(0,yz[0],yz[1]);bootP.add(lace);
  }
  bindings.push({g:bg,side,highback});
  footTargets.push(new THREE.Vector3(bx,0.082+0.340,bz));
}
/* ───── таз / бёдра ───── */
const pelvis=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.15,0.20),pantsMat);
pelvis.position.set(0,0.89,0.01);riderG.add(pelvis);
const pelvisBack=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,10),pantsMat);
pelvisBack.scale.set(0.92,0.85,0.95);pelvisBack.position.set(0,0.86,0.06);riderG.add(pelvisBack);
/* ───── ноги (бедро→колено→голень, IK) ───── */
const thighGeoCache=[];
const shinGeoCache=[];
function makeThigh(){
  const m=capsule(0.092,0.18,pantsMat,true,12);
  return m;
}
function makeShin(){
  const m=capsule(0.078,0.14,pantsMat,true,12);
  return m;
}
const hipY=0.98;
const legL={thigh:makeThigh(),shin:makeShin(),knee:new THREE.Mesh(new THREE.SphereGeometry(0.103,12,10),pantsMat),side:-1};
legL.thigh.position.set(legL.side*0.11,hipY,0);riderG.add(legL.thigh);
legL.knee.scale.set(0.95,0.9,0.92);riderG.add(legL.knee);
const legR={thigh:makeThigh(),shin:makeShin(),knee:new THREE.Mesh(new THREE.SphereGeometry(0.103,12,10),pantsMat),side:1};
legR.thigh.position.set(legR.side*0.11,hipY,0);riderG.add(legR.thigh);
legR.knee.scale.set(0.95,0.9,0.92);riderG.add(legR.knee);
for(const leg of[legL,legR]){
  leg.thigh.add(leg.shin);
  leg.shin.position.set(0,0,0);
}
/* ───── торс: куртка с капюшоном, плечами, руками ───── */
const torso=new THREE.Group();riderG.add(torso);
const jacketProfile=[
  [0.001,0.000],[0.165,0.000],[0.182,0.040],[0.195,0.110],
  [0.205,0.200],[0.218,0.300],[0.232,0.380],[0.240,0.440],
  [0.222,0.480],[0.190,0.510],[0.130,0.530],[0.001,0.535]
];
const jacket=lathe(jacketProfile,jacketMat,28);
jacket.scale.set(1.0,1.0,0.74);torso.add(jacket);
const jacketInner=lathe(jacketProfile.map(p=>[Math.max(0.001,p[0]*0.92),p[1]]),innerMat,28);
jacketInner.scale.set(0.95,1.0,0.70);jacketInner.position.y=0.005;torso.add(jacketInner);
const hem=box(0.42,0.04,0.28,jacketMat);hem.position.set(0,0.005,0);torso.add(hem);
const hemBand=box(0.40,0.012,0.27,seamMat);hemBand.position.set(0,0.020,0);torso.add(hemBand);
const backSeam=box(0.024,0.42,0.018,seamMat);backSeam.position.set(0,0.21,0.152);torso.add(backSeam);
for(let i=0;i<3;i++){
  const st=new THREE.Mesh(new THREE.SphereGeometry(0.013,8,6),seamMat);
  st.position.set(0,0.08+i*0.10,0.166);torso.add(st);
}
const hood=box(0.34,0.20,0.20,jacketMat);hood.position.set(0,0.48,0.10);torso.add(hood);
const hoodInner=new THREE.Mesh(new THREE.SphereGeometry(0.16,14,10),innerMat);
hoodInner.scale.set(1.08,0.78,1.18);hoodInner.position.set(0,0.48,0.13);torso.add(hoodInner);
const hoodRim=box(0.36,0.018,0.22,jacketMat);hoodRim.position.set(0,0.41,0.13);torso.add(hoodRim);
const hoodDraw=box(0.025,0.18,0.012,accentMat);hoodDraw.position.set(0,0.48,0.215);torso.add(hoodDraw);
const hoodDrawTip=box(0.04,0.018,0.018,accentMat);hoodDrawTip.position.set(0,0.39,0.218);torso.add(hoodDrawTip);
const collar=box(0.30,0.06,0.22,innerMat);collar.position.set(0,0.52,0.02);torso.add(collar);
const collarRim=box(0.30,0.014,0.22,jacketMat);collarRim.position.set(0,0.55,0.02);torso.add(collarRim);
const shoulderLPad=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,10),jacketMat);
shoulderLPad.scale.set(1.05,0.7,0.85);shoulderLPad.position.set(-0.235,0.46,0);torso.add(shoulderLPad);
const shoulderRPad=shoulderLPad.clone();shoulderRPad.position.x=0.235;torso.add(shoulderRPad);
const logoBack=box(0.10,0.10,0.018,logoMat);logoBack.position.set(0,0.30,0.155);torso.add(logoBack);
const logoBackInner=box(0.058,0.058,0.022,seamMat);logoBackInner.position.set(0,0.30,0.158);torso.add(logoBackInner);
for(const sx of[-0.032,0.032]){
  const v=box(0.014,0.058,0.02,accentMat);v.position.set(sx,0.30,0.16);torso.add(v);
}
const armLGroup=new THREE.Group();armLGroup.position.set(-0.225,0.44,0);torso.add(armLGroup);
const armRGroup=new THREE.Group();armRGroup.position.set(0.225,0.44,0);torso.add(armRGroup);
const armLUpper=capsule(0.058,0.20,jacketMat,true,12);armLGroup.add(armLUpper);
const armLElbowGrp=new THREE.Group();armLGroup.add(armLElbowGrp);armLElbowGrp.position.set(0,-0.316,0);
const armLFore=capsule(0.052,0.16,jacketMat,true,12);armLElbowGrp.add(armLFore);
const armLWrist=new THREE.Group();armLElbowGrp.add(armLWrist);armLWrist.position.set(0,-0.264,0);
const armLElbow=new THREE.Mesh(new THREE.SphereGeometry(0.064,10,8),jacketMat);
armLElbow.position.set(0,-0.316,0);armLGroup.add(armLElbow);
const armLForeCuff=box(0.12,0.025,0.13,innerMat);armLForeCuff.position.set(0,-0.255,0);armLElbowGrp.add(armLForeCuff);
const armLGlove=new THREE.Mesh(new THREE.SphereGeometry(0.075,12,10),gloveMat);
armLGlove.scale.set(1,0.85,1.2);armLWrist.add(armLGlove);
const armLGloveCuff=box(0.14,0.025,0.10,gloveMat);armLGloveCuff.position.set(0,0.06,0);armLWrist.add(armLGloveCuff);
const armRUpper=capsule(0.058,0.20,jacketMat,true,12);armRGroup.add(armRUpper);
const armRElbowGrp=new THREE.Group();armRGroup.add(armRElbowGrp);armRElbowGrp.position.set(0,-0.316,0);
const armRFore=capsule(0.052,0.16,jacketMat,true,12);armRElbowGrp.add(armRFore);
const armRWrist=new THREE.Group();armRElbowGrp.add(armRWrist);armRWrist.position.set(0,-0.264,0);
const armRElbow=new THREE.Mesh(new THREE.SphereGeometry(0.064,10,8),jacketMat);
armRElbow.position.set(0,-0.316,0);armRGroup.add(armRElbow);
const armRForeCuff=box(0.12,0.025,0.13,innerMat);armRForeCuff.position.set(0,-0.255,0);armRElbowGrp.add(armRForeCuff);
const armRGlove=new THREE.Mesh(new THREE.SphereGeometry(0.075,12,10),gloveMat);
armRGlove.scale.set(1,0.85,1.2);armRWrist.add(armRGlove);
const armRGloveCuff=box(0.14,0.025,0.10,gloveMat);armRGloveCuff.position.set(0,0.06,0);armRWrist.add(armRGloveCuff);
const neckBalaclava=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.075,0.10,10,1),innerMat);
neckBalaclava.position.set(0,0.56,0);torso.add(neckBalaclava);
/* ───── голова, шлем, грива из волос ───── */
const headG=new THREE.Group();headG.position.set(0,0.62,0);torso.add(headG);
const skull=new THREE.Mesh(new THREE.SphereGeometry(0.145,16,12),skinMat);
skull.scale.set(1,1.12,1.1);headG.add(skull);
const skullBack=new THREE.Mesh(new THREE.SphereGeometry(0.135,14,10),skinMat);
skullBack.scale.set(0.95,0.9,0.85);skullBack.position.set(0,-0.005,0.04);headG.add(skullBack);
const helmet=new THREE.Mesh(new THREE.SphereGeometry(0.165,18,14,0,Math.PI*2,0,Math.PI*0.74),helmetMat);
helmet.position.y=0.018;helmet.scale.set(1,1.05,1.08);headG.add(helmet);
const helmetBack=new THREE.Mesh(new THREE.SphereGeometry(0.158,14,10,0,Math.PI*2,0,Math.PI*0.55),helmetMat);
helmetBack.position.set(0,0.012,0.012);headG.add(helmetBack);
const helmetBrim=box(0.30,0.018,0.10,helmetMat);
helmetBrim.position.set(0,0.045,-0.140);helmetBrim.rotation.x=-0.18;headG.add(helmetBrim);
for(let i=0;i<3;i++){
  const yoff=0.05-i*0.035;
  const vent=box(0.034,0.092,0.020,seamMat);
  vent.position.set(0,yoff,Math.sqrt(0.158*0.158-yoff*yoff)+0.005);
  vent.rotation.x=-Math.atan2(yoff,vent.position.z);
  headG.add(vent);
}
const strapBack=box(0.36,0.058,0.034,accentMat);
strapBack.position.set(0,-0.018,0.155);headG.add(strapBack);
const strapFront=box(0.36,0.058,0.034,accentMat);
strapFront.position.set(0,-0.018,-0.155);headG.add(strapFront);
const strapBuckle=box(0.04,0.06,0.025,metalMat);
strapBuckle.position.set(0,-0.018,0.178);headG.add(strapBuckle);
for(const sx of[-0.05,0.05]){
  const stripe=box(0.012,0.085,0.022,accentMat);
  stripe.position.set(sx,0.04,0.150);headG.add(stripe);
}
const goggleFront=new THREE.Mesh(new THREE.TorusGeometry(0.14,0.025,8,18,Math.PI*0.7),accentMat);
goggleFront.rotation.x=-Math.PI/2;goggleFront.position.set(0,-0.018,-0.155);headG.add(goggleFront);
const goggleLens=new THREE.Mesh(new THREE.CircleGeometry(0.13,18,Math.PI*0.15,Math.PI*0.7),new THREE.MeshStandardMaterial({color:0x223040,roughness:0.2,metalness:0.5,emissive:0x1a3050,emissiveIntensity:0.4,side:THREE.DoubleSide}));
goggleLens.rotation.x=-Math.PI/2;goggleLens.position.set(0,-0.018,-0.150);headG.add(goggleLens);
const ponyG=new THREE.Group();ponyG.position.set(0,-0.115,0.118);headG.add(ponyG);
const ponySeg1=capsule(0.038,0.10,hairMat,true,8);ponySeg1.position.set(0,-0.05,0.005);ponyG.add(ponySeg1);
const ponySeg2=capsule(0.034,0.09,hairMat,true,8);ponySeg2.position.set(0.020,-0.14,-0.005);ponySeg2.rotation.z=0.22;ponyG.add(ponySeg2);
const ponySeg3=capsule(0.030,0.08,hairMat,true,8);ponySeg3.position.set(0.050,-0.22,-0.015);ponySeg3.rotation.z=0.35;ponyG.add(ponySeg3);
const ponySeg4=capsule(0.026,0.07,hairMat,true,8);ponySeg4.position.set(0.085,-0.29,-0.025);ponySeg4.rotation.z=0.50;ponyG.add(ponySeg4);
/* ───── шарф: 5 пластин, развеваются на ветру ───── */
const scarf=[];
for(let i=0;i<5;i++){
  const s=new THREE.Mesh(new THREE.PlaneGeometry(0.16,0.21),scarfMat);
  s.position.set(0,0.40-i*0.045,0.135+i*0.14);
  s.userData.baseZ=0.135+i*0.14;
  torso.add(s);scarf.push(s);
}
const scarfBase=box(0.16,0.05,0.04,scarfMat);scarfBase.position.set(0,0.43,0.10);torso.add(scarfBase);
const blob=new THREE.Mesh(new THREE.CircleGeometry(0.85,20),
  new THREE.MeshBasicMaterial({color:0x060a18,transparent:true,opacity:0.34,depthWrite:false}));
blob.rotation.x=-Math.PI/2;scene.add(blob);

/* ═══════════ поза и анимация райдера ═══════════ */
function riderPose(dt){
  const air=!G.grounded;
  const tuck=G.grounded&&K.up;
  const brake=G.grounded&&K.down;
  const grab=air&&G.grabbing;
  const grabAmt=clamp(G.grabTime,0,0.5)*1.8;
  const land=clamp(G.landAbsorb,0,0.5);
  const hipDrop=lerp(0,0.16,Math.min(1,tuck?1:0))+(brake?-0.05:0)+(air?0.04:0)+land*0.20;
  const curHipY=hipY-hipDrop;
  const torsoLean=0.10+G.speed*0.0035+(tuck?0.20:0)+(grab?0.30:0)+(air&&!grab?0.05:0)+land*0.18;
  const torsoTwist=grab?legR.side*grabAmt*0.25:0;
  const bendF=clamp(0.46+land*0.35+(tuck?0.35:0)+(air?0.20:0)-(brake?0.22:0),0.15,0.95);
  const fwdBulge=bendF*0.18;
  const outBulge=0.055+bendF*0.04;
  const L_FOOT=footTargets[0],R_FOOT=footTargets[1];
  const carve=clamp(G.vx*0.06,-0.6,0.6);
  function applyLeg(leg,foot){
    const H=new THREE.Vector3(leg.side*0.11,curHipY,0);
    const mid=new THREE.Vector3().addVectors(H,foot).multiplyScalar(0.5);
    const K=new THREE.Vector3(mid.x+leg.side*outBulge,mid.y,mid.z-fwdBulge);
    const thighDir=new THREE.Vector3().subVectors(K,H).normalize();
    const qThigh=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),thighDir);
    const ankleDir=new THREE.Vector3().subVectors(foot,K).normalize();
    const qShinWorld=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),ankleDir);
    const qShinLocal=qThigh.clone().invert().multiply(qShinWorld);
    leg.thigh.quaternion.copy(qThigh);
    leg.shin.quaternion.copy(qShinLocal);
    leg.knee.position.set(K.x,K.y,K.z);
  }
  applyLeg(legL,L_FOOT);
  applyLeg(legR,R_FOOT);
  pelvis.rotation.set(0,torsoTwist*0.4,carve*0.25);
  pelvisBack.rotation.set(0,torsoTwist*0.4,carve*0.20);
  pelvis.position.y=0.89-hipDrop*0.6;
  pelvisBack.position.y=0.86-hipDrop*0.6+hipDrop*0.15;
  const shoulderRoll=carve*0.32+(tuck?-0.10:0);
  armLGroup.position.set(-0.225-torsoTwist*0.04,0.44-hipDrop*0.6,shoulderRoll*0.04);
  armRGroup.position.set(0.225+torsoTwist*0.04,0.44-hipDrop*0.6,-shoulderRoll*0.04);
  const upperRotX=(tuck?0.18:0.05)+(grab?-0.05:0);
  const flap=Math.sin(G.time*9)*0.04+carve*0.10;
  if(grab&&legR.side>0){
    armRGroup.rotation.set(0.45,torsoTwist*0.4,0.32);
    armRElbowGrp.rotation.set(1.75,0,-0.20);
  }else if(grab&&legR.side<0){
    armLGroup.rotation.set(0.45,-torsoTwist*0.4,-0.32);
    armLElbowGrp.rotation.set(1.75,0,0.20);
  }else{
    armLGroup.rotation.set(upperRotX,-torsoTwist*0.25,-shoulderRoll+flap);
    armRGroup.rotation.set(upperRotX,torsoTwist*0.25,shoulderRoll+flap);
  }
  if(!(grab&&legR.side>0))armLElbowGrp.rotation.set(tuck?1.30:(air?0.55:1.05),0,0.22);
  if(!(grab&&legR.side<0))armRElbowGrp.rotation.set(tuck?1.30:(air?0.55:1.05),0,-0.22);
  torso.position.set(0,0,-hipDrop*0.05);
  torso.rotation.set(torsoLean,torsoTwist,-carve*0.18);
  headG.rotation.set(-torsoLean*0.25,-G.boardYaw*0.40,-carve*0.22);
  const ponySway=Math.sin(G.time*5.5)*0.06+G.vx*0.015;
  ponyG.rotation.set(air?-0.12:-0.04,0,0.28+ponySway);
  const wind=clamp((G.speed/30)+(G.windAmp?G.windAmp*0.3:0),0,1.6);
  for(let i=0;i<scarf.length;i++){
    const s=scarf[i];
    const bz=s.userData.baseZ;
    s.position.set(
      Math.sin(G.time*9+i*1.2)*0.06+ponySway*0.5,
      0.40-i*0.045+Math.sin(G.time*7+i)*0.03-(air?0.05:0)-hipDrop*0.45,
      bz+i*(0.14+wind*0.06)
    );
    s.rotation.set(-0.5-wind*0.35-G.speed*0.012,Math.sin(G.time*6+i)*0.2+i*0.04,ponySway*0.4);
  }
  if(G.state==='crash'){
    riderG.rotation.x+=dt*9;
    riderG.rotation.z=Math.sin(G.crashT*12)*0.4;
    boardG.rotation.z+=dt*6;
    riderG.position.set(G.x,Math.max(0,Math.sin(Math.min(G.crashT*9,Math.PI))*0.4*(1-G.crashT*0.7)),0);
  }else{
    riderG.rotation.x=0;
    boardG.rotation.z=0;
    const rollT=clamp(-G.vx*0.05,-0.5,0.5);
    G.roll=lerp(G.roll,rollT,Math.min(1,9*dt));
    const yawT=-G.vx*0.045;
    G.boardYaw=lerp(G.boardYaw,yawT,Math.min(1,10*dt));
    G.visualSpin*=Math.max(0,1-6*dt);
    riderG.rotation.y=G.boardYaw+(air?G.spinAngle*Math.PI/180:G.visualSpin*Math.PI/180);
    riderG.rotation.z=G.roll;
    riderG.position.set(G.x,G.py,0);
  }
  blob.position.set(G.x,0.02,0);
  const bsc=clamp(1-G.py*0.28,0.3,1);
  blob.scale.set(bsc,bsc,1);
  blob.material.opacity=0.34*bsc;
  G.landAbsorb=Math.max(0,G.landAbsorb-dt*1.6);
}

export {
  riderG, boardG, blob,
  jacketMat, accentMat, boardTopMat, scarfMat, bootCuffMat, gloveMat, logoMat,
  footTargets, hipY, legL, legR, pelvis, pelvisBack,
  armLGroup, armRGroup, armLElbowGrp, armRElbowGrp,
  torso, headG, ponyG, scarf,
  riderPose
};
