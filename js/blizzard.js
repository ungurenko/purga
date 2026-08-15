import * as THREE from 'three';
import { rand } from './utils.js';
import { scene, camera, terrainHeight } from './scene.js';

/* Three-layer blizzard + rooster-tail spray. */

function flakeTex(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');
  gr.addColorStop(0.4,'rgba(230,240,255,0.9)');
  gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const flakeMap=flakeTex();

const SNOW_N=1600;
const snowPos=new Float32Array(SNOW_N*3);
const snowSeed=new Float32Array(SNOW_N);
for(let i=0;i<SNOW_N;i++){
  snowPos[i*3]=rand(-70,70);snowPos[i*3+1]=rand(0,28);snowPos[i*3+2]=rand(-90,20);
  snowSeed[i]=rand(6.28);
}
const snowGeo=new THREE.BufferGeometry();
snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3).setUsage(THREE.DynamicDrawUsage));
const snowMat=new THREE.PointsMaterial({
  color:0xdfe8ff,size:0.13,map:flakeMap,transparent:true,opacity:0.55,
  depthWrite:false,sizeAttenuation:true
});
const snow=new THREE.Points(snowGeo,snowMat);
snow.frustumCulled=false;scene.add(snow);

const DRIFT_N=520;
const driftPos=new Float32Array(DRIFT_N*3);
const driftSeed=new Float32Array(DRIFT_N);
for(let i=0;i<DRIFT_N;i++){
  driftPos[i*3]=rand(-48,48);
  driftPos[i*3+1]=rand(0.05,1.6);
  driftPos[i*3+2]=rand(-70,18);
  driftSeed[i]=rand(6.28);
}
const driftGeo=new THREE.BufferGeometry();
driftGeo.setAttribute('position',new THREE.BufferAttribute(driftPos,3).setUsage(THREE.DynamicDrawUsage));
const driftMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uOp:{value:0.35},uDay:{value:0}},
  vertexShader:`
    uniform float uOp;
    varying float vA;
    void main(){
      vA=uOp;
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=clamp(28.0/-mv.z,4.0,42.0);
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader:`
    varying float vA;uniform float uDay;
    void main(){
      vec2 c=gl_PointCoord-0.5;
      c.x*=0.38; /* stretched ground sheet */
      float m=smoothstep(0.5,0.08,length(c));
      float a=m*vA*(0.55+0.45*(1.0-uDay));
      if(a<0.02)discard;
      gl_FragColor=vec4(0.90,0.94,1.0,a);
    }`
});
const drift=new THREE.Points(driftGeo,driftMat);
drift.frustumCulled=false;scene.add(drift);

const CAM_N=90;
const camPos=new Float32Array(CAM_N*3);
const camSeed=new Float32Array(CAM_N);
const camLife=new Float32Array(CAM_N);
for(let i=0;i<CAM_N;i++){
  camPos[i*3]=rand(-2.4,2.4);
  camPos[i*3+1]=rand(-1.4,1.6);
  camPos[i*3+2]=rand(-6.5,-1.2);
  camSeed[i]=rand(6.28);
  camLife[i]=rand(0.4,1);
}
const camGeo=new THREE.BufferGeometry();
camGeo.setAttribute('position',new THREE.BufferAttribute(camPos,3).setUsage(THREE.DynamicDrawUsage));
camGeo.setAttribute('aSeed',new THREE.BufferAttribute(camSeed,1));
const camStreak={value:0};
const camMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  uniforms:{uMap:{value:flakeMap},uStreak:{value:camStreak},uOp:{value:0.72},uDay:{value:0}},
  vertexShader:`
    attribute float aSeed;
    uniform float uStreak;
    varying float vS;varying float vSeed;
    void main(){
      vS=uStreak;vSeed=aSeed;
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=(7.0+aSeed*5.0)*(1.0+uStreak*1.3);
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader:`
    uniform sampler2D uMap;uniform float uOp;uniform float uDay;
    varying float vS;varying float vSeed;
    void main(){
      vec2 c=gl_PointCoord-0.5;
      c.x*=1.0+vS*3.2;
      c.y/=1.0+vS*1.6;
      float m=smoothstep(0.48,0.10,length(c));
      float tw=0.75+0.25*sin(vSeed*20.0);
      float a=m*uOp*tw*(0.7+0.3*(1.0-uDay));
      if(a<0.02)discard;
      gl_FragColor=vec4(0.95,0.97,1.0,a);
    }`
});
const camSnow=new THREE.Points(camGeo,camMat);
camSnow.frustumCulled=false;
camera.add(camSnow);

const SP_N=420;
const spPos=new Float32Array(SP_N*3),spVel=new Float32Array(SP_N*3),
      spLife=new Float32Array(SP_N),spSize=new Float32Array(SP_N);
for(let i=0;i<SP_N;i++)spPos[i*3+1]=-60;
const spGeo=new THREE.BufferGeometry();
spGeo.setAttribute('position',new THREE.BufferAttribute(spPos,3).setUsage(THREE.DynamicDrawUsage));
spGeo.setAttribute('aLife',new THREE.BufferAttribute(spLife,1).setUsage(THREE.DynamicDrawUsage));
spGeo.setAttribute('aSize',new THREE.BufferAttribute(spSize,1).setUsage(THREE.DynamicDrawUsage));
const spMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  uniforms:{uDay:{value:0}},
  vertexShader:`attribute float aLife;attribute float aSize;varying float vA;
    void main(){vA=clamp(aLife*2.4,0.0,1.0);
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    gl_PointSize=aSize*(170.0/-mv.z)*(0.30+0.70*vA);
    gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying float vA;uniform float uDay;
    void main(){vec2 c=gl_PointCoord-0.5;float m=smoothstep(0.5,0.10,length(c));
    float a=m*vA*0.92;if(a<0.02)discard;
    vec3 col=mix(vec3(0.90,0.94,1.0),vec3(1.0,1.0,1.0),uDay);
    gl_FragColor=vec4(col,a);}`
});
const spray=new THREE.Points(spGeo,spMat);
spray.frustumCulled=false;scene.add(spray);
let spCursor=0;
let spActive=0;

export function emitSpray(n,px,py,pz,ox={}){
  for(let k=0;k<n;k++){
    const i=spCursor++%SP_N,i3=i*3;
    if(spLife[i]<=0)spActive++;
    spPos[i3]=px+(Math.random()-0.5)*(ox.sx||0.3);
    spPos[i3+1]=py+Math.random()*(ox.sy||0.12);
    spPos[i3+2]=pz+(Math.random()-0.5)*(ox.sz||0.3);
    spVel[i3]=(ox.vx||0)+(Math.random()-0.5)*(ox.vsx||1.4);
    spVel[i3+1]=(ox.vy||2)+Math.random()*(ox.vyr||2.2);
    spVel[i3+2]=(ox.vz||4)+Math.random()*2.4;
    spLife[i]=0.28+Math.random()*0.32;
    spSize[i]=0.12+Math.random()*0.16;
  }
}

export function emitRooster(x,y,speed,vx,dt){
  if(speed<7)return;
  const n=speed>18?5:3;
  const back=-(2.2+speed*0.18);
  for(const side of[-1,1]){
    emitSpray(n,x+side*0.22,y+0.04,0.15,{
      sx:0.08,sy:0.06,sz:0.1,
      vx:side*(1.6+Math.abs(vx)*0.15)+vx*0.2,
      vsx:0.8,
      vy:1.1+speed*0.04,vyr:1.8,
      vz:back
    });
  }
}

export function emitPowderBurst(x,y,hard){
  emitSpray(hard?36:20,x,y+0.08,0,{
    sx:1.1,sy:0.2,sz:0.8,
    vx:0,vsx:4.2,
    vy:2.2,vyr:hard?5:3.2,
    vz:2.5
  });
}

const SNOW_RANGE=[700,1100,1600];
const DRIFT_RANGE=[0,280,520];
const CAM_RANGE=[0,40,90];

export function setBlizzardQuality(tier){
  snowGeo.setDrawRange(0,SNOW_RANGE[tier]||700);
  driftGeo.setDrawRange(0,DRIFT_RANGE[tier]||0);
  camGeo.setDrawRange(0,CAM_RANGE[tier]||0);
  drift.visible=tier>0;
  camSnow.visible=tier>1;
  spray.visible=true;
}

export function blizzardSetDay(t){
  snowMat.color.setHex(t>0.5?0xffffff:0xdfe8ff);
  driftMat.uniforms.uDay.value=t;
  camMat.uniforms.uDay.value=t;
  spMat.uniforms.uDay.value=t;
}

/* общие значения и плавные лерпы — каждый кадр */
export function blizzardCommon(dt,ctx){
  const stage=ctx.stage||1;
  const windAmp=ctx.windAmp||0;
  const time=ctx.time||0;
  const speed=ctx.speed||0;
  const day=ctx.day||0;
  const opT=ctx.snowOpT??0.6;
  const sizeT=ctx.snowSizeT??0.11;
  const st=Math.min(1,Math.max(0,(stage-1)/7));
  snowMat.opacity=THREE.MathUtils.lerp(snowMat.opacity,opT*(0.85+st*0.25),Math.min(1,dt*2));
  snowMat.size=THREE.MathUtils.lerp(snowMat.size,sizeT*(1+st*0.35),Math.min(1,dt*2));
  driftMat.uniforms.uOp.value=0.16+st*0.42+windAmp*0.06;
  camMat.uniforms.uOp.value=0.28+st*0.22;
  const streak=Math.min(1,Math.max(0,(speed-10)/22));
  camStreak.value=streak;
  camMat.uniforms.uStreak.value=streak;
  if(ctx.grounded&&speed>8)emitRooster(ctx.x,ctx.y,speed,ctx.vx,dt);
}

/* фоновый снег — 60 Гц */
export function blizzardSnow(dt,scroll,ctx){
  const stage=ctx.stage||1;
  const windAmp=ctx.windAmp||0;
  const time=ctx.time||0;
  const fall=1.4+stage*0.5;
  const windX=Math.sin(time*0.4)*windAmp;
  for(let i=0;i<SNOW_N;i++){
    const i3=i*3;
    snowPos[i3+1]-=fall*(0.7+0.6*Math.abs(Math.sin(snowSeed[i])))*dt;
    snowPos[i3]+=(windX*2+Math.sin(time*0.7+snowSeed[i])*0.4)*dt;
    snowPos[i3+2]+=scroll;
    if(snowPos[i3+1]<0){snowPos[i3+1]+=28;snowPos[i3]=rand(-70,70);}
    if(snowPos[i3+2]>20)snowPos[i3+2]-=110;
    else if(snowPos[i3+2]<-90)snowPos[i3+2]+=110;
    if(snowPos[i3]>70)snowPos[i3]-=140;
    else if(snowPos[i3]<-70)snowPos[i3]+=140;
  }
  snowGeo.attributes.position.needsUpdate=true;
}

/* позёмка — 30 Гц (тяжёлый terrainHeight на частицу) */
export function blizzardDrift(dt,scroll,ctx){
  const stage=ctx.stage||1;
  const windAmp=ctx.windAmp||0;
  const time=ctx.time||0;
  const dist=ctx.dist||0;
  const fall=1.4+stage*0.5;
  const windX=Math.sin(time*0.4)*windAmp;
  for(let i=0;i<DRIFT_N;i++){
    const i3=i*3;
    const fl=fall*1.15+windAmp*0.4;
    driftPos[i3]+=(windX*3.4+Math.sin(time*1.6+driftSeed[i])*1.8)*dt;
    driftPos[i3+2]+=scroll+(-6-stage*0.8)*dt;
    const floor=terrainHeight(driftPos[i3],dist-driftPos[i3+2])+0.08;
    driftPos[i3+1]=floor+0.12+Math.abs(Math.sin(time*2.2+driftSeed[i]))*0.55;
    if(driftPos[i3+2]>18){driftPos[i3+2]-=88;driftPos[i3]=rand(-48,48);}
    else if(driftPos[i3+2]<-70){driftPos[i3+2]+=88;}
    if(driftPos[i3]>48)driftPos[i3]-=96;
    else if(driftPos[i3]<-48)driftPos[i3]+=96;
  }
  driftGeo.attributes.position.needsUpdate=true;
}

/* ближние хлопья у камеры — 60 Гц */
export function blizzardCam(dt,ctx){
  const time=ctx.time||0;
  const windAmp=ctx.windAmp||0;
  const speed=ctx.speed||0;
  const streak=Math.min(1,Math.max(0,(speed-10)/22));
  const windX=Math.sin(time*0.4)*windAmp;
  const camFall=2.4+speed*0.12;
  for(let i=0;i<CAM_N;i++){
    const i3=i*3;
    camLife[i]-=dt*0.55;
    camPos[i3+1]-=camFall*(0.4+0.6*Math.abs(Math.sin(camSeed[i])))*dt;
    camPos[i3]+=(windX*0.08+Math.sin(time*2+camSeed[i])*0.15)*dt;
    camPos[i3+2]+=streak*1.8*dt;
    if(camLife[i]<=0||camPos[i3+1]<-1.8||camPos[i3+2]>-0.6){
      camPos[i3]=rand(-2.6,2.6);
      camPos[i3+1]=rand(0.6,1.8);
      camPos[i3+2]=rand(-6.8,-1.4);
      camLife[i]=0.6+Math.random()*0.8;
    }
  }
  camGeo.attributes.position.needsUpdate=true;
}

/* брызги/буран — 60 Гц; пропуск, когда частиц нет */
export function blizzardSpray(dt,scroll,ctx){
  if(spActive<=0)return;
  const dist=ctx.dist||0;
  for(let i=0;i<SP_N;i++){
    if(spLife[i]<=0)continue;
    spLife[i]-=dt;
    const i3=i*3;
    if(spLife[i]<=0){spActive--;spPos[i3+1]=-60;continue;}
    spVel[i3+1]-=14*dt;
    spPos[i3]+=spVel[i3]*dt;
    spPos[i3+1]+=spVel[i3+1]*dt;
    spPos[i3+2]+=spVel[i3+2]*dt+scroll;
    const floorY=terrainHeight(spPos[i3],dist-spPos[i3+2])+0.02;
    if(spPos[i3+1]<floorY){spPos[i3+1]=floorY;spVel[i3+1]*=-0.28;spVel[i3]*=0.7;spLife[i]*=0.7;}
  }
  spGeo.attributes.position.needsUpdate=true;
  spGeo.attributes.aLife.needsUpdate=true;
  spGeo.attributes.aSize.needsUpdate=true;
}

export {
  snowMat, snowGeo, snowPos, snowSeed, SNOW_N,
  drift, driftMat,
  camSnow,
  spray, spGeo, spMat, spPos, spVel, spLife, spSize, SP_N
};
