import * as THREE from 'three';
import { rand, $ } from './utils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { treeSnowMat } from './trees.js';
import { initMountains, mountFarMat, mountNearMat, mountMidMat, mountainsUpdate, mountGrp } from './mountains.js';

/* ═══════════ рендерер / сцена ═══════════ */
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x131a30,0.015);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,900);
camera.position.set(0,3.2,8.4);
scene.add(camera);
const hemiLight=new THREE.HemisphereLight(0x3a4f86,0x10182c,0.8);
scene.add(hemiLight);
const moonLight=new THREE.DirectionalLight(0xffd9ae,1.45);
moonLight.position.set(-30,42,25);
moonLight.castShadow=true;
moonLight.shadow.mapSize.set(1024,1024);
moonLight.shadow.camera.left=-32;
moonLight.shadow.camera.right=32;
moonLight.shadow.camera.top=32;
moonLight.shadow.camera.bottom=-32;
moonLight.shadow.camera.near=5;
moonLight.shadow.camera.far=200;
moonLight.shadow.bias=-0.0003;
moonLight.shadow.normalBias=0.55;
scene.add(moonLight);
scene.add(moonLight.target);
const warmPt=new THREE.PointLight(0xff9a4d,10,30,2);
scene.add(warmPt);
/* snow bounce from below + cold rim from behind */
const bounceLight=new THREE.DirectionalLight(0xc8d6ee,0.32);
bounceLight.position.set(8,-6,12);
scene.add(bounceLight);
const rimLight=new THREE.DirectionalLight(0x7eb6ff,0.4);
rimLight.position.set(18,10,-28);
scene.add(rimLight);
const LAMP_LIGHT_N=3;
const lampLights=[];
for(let i=0;i<LAMP_LIGHT_N;i++){
  const pl=new THREE.PointLight(0xff9a4d,0,16,2);
  scene.add(pl);
  lampLights.push(pl);
}
/* ═══════════ небесный купол: ночь/день + северное сияние ═══════════ */
const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,
  uniforms:{
    uTime:{value:0},
    uDay:{value:0},
    uMoon:{value:new THREE.Vector3(-0.42,0.30,-0.86).normalize()},
    uSun:{value:new THREE.Vector3(0.38,0.58,0.28).normalize()}
  },
  vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
    varying vec3 vP;uniform float uTime;uniform float uDay;uniform vec3 uMoon;uniform vec3 uSun;
    float hash(vec3 p){p=fract(p*0.3183+vec3(0.1,0.2,0.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);
      float a=hash2(i),b=hash2(i+vec2(1.0,0.0)),c=hash2(i+vec2(0.0,1.0)),d=hash2(i+vec2(1.0,1.0));
      vec2 u=f*f*(3.0-2.0*f);
      return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
    }
    void main(){
      vec3 d=normalize(vP);
      float h=clamp(d.y,-0.1,1.0);
      vec3 nZen=vec3(0.024,0.035,0.09),nMid=vec3(0.06,0.09,0.19),nHor=vec3(0.10,0.12,0.20);
      vec3 ncol=mix(nHor,nMid,smoothstep(0.0,0.18,h));
      ncol=mix(ncol,nZen,smoothstep(0.15,0.6,h));
      float md=max(dot(d,uMoon),0.0);
      ncol+=vec3(1.0,0.62,0.32)*pow(md,60.0)*1.3;
      ncol+=vec3(0.9,0.5,0.25)*pow(md,6.0)*0.16;
      float ndisk=smoothstep(0.9992,0.99965,md);
      ncol=mix(ncol,vec3(1.0,0.9,0.72)*1.6,ndisk);
      if(h>0.12){
        vec3 g=floor(d*220.0);float rnd=hash(g);
        float st=step(0.9975,rnd)*(0.5+0.5*sin(uTime*2.0+rnd*40.0));
        ncol+=vec3(0.8,0.85,1.0)*st*smoothstep(0.12,0.4,h)*0.7;
      }
      /* северное сияние (только ночь) */
      float aur=0.0;
      if(h>0.05){
        float band=smoothstep(0.05,0.28,h)*smoothstep(0.78,0.40,h);
        vec2 ap=vec2(d.x*3.1+uTime*0.015,h*6.5);
        float c1=noise(ap*vec2(1.3,2.4)+vec2(uTime*0.06,0.0));
        float c2=noise(ap*vec2(2.6,4.3)+vec2(3.7,uTime*0.09));
        aur=band*smoothstep(0.42,0.92,c1*0.62+c2*0.48);
      }
      ncol+=aur*(vec3(0.12,0.85,0.50)*0.32+vec3(0.30,0.25,0.90)*0.10)*(1.0-clamp(uDay,0.0,1.0));
      vec3 dZen=vec3(0.42,0.70,0.94),dMid=vec3(0.72,0.86,0.97),dHor=vec3(0.93,0.96,0.99);
      vec3 dcol=mix(dHor,dMid,smoothstep(0.0,0.22,h));
      dcol=mix(dcol,dZen,smoothstep(0.18,0.72,h));
      float sd=max(dot(d,uSun),0.0);
      dcol+=vec3(1.0,0.93,0.78)*pow(sd,70.0)*1.5;
      dcol+=vec3(1.0,0.88,0.62)*pow(sd,7.0)*0.28;
      float sdisk=smoothstep(0.9984,0.9994,sd);
      dcol=mix(dcol,vec3(1.0,0.98,0.92)*1.85,sdisk);
      if(h>0.02){
        vec2 uv=d.xz/max(d.y+0.38,0.08);
        uv+=vec2(uTime*0.01,uTime*0.005);
        float c=noise(uv*2.0);
        c+=0.55*noise(uv*4.2+vec2(2.7,1.3));
        c+=0.25*noise(uv*8.0+vec2(5.1,3.8));
        c=smoothstep(0.52,0.82,c)*smoothstep(0.02,0.22,h)*smoothstep(0.92,0.32,h);
        dcol=mix(dcol,vec3(1.0,1.0,1.0),c*0.88);
      }
      vec3 col=mix(ncol,dcol,clamp(uDay,0.0,1.0));
      gl_FragColor=vec4(col,1.0);
    }`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(520,24,16),skyMat));
/* ═══════════ текстуры: вельвет, снежинка, клякса-тень ═══════════ */
function makeGroundTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d');
  g.fillStyle='#dde5f3';g.fillRect(0,0,512,512);
  for(let i=0;i<26;i++){
    const x=rand(512),y=rand(512),r=rand(40,120);
    const gr=g.createRadialGradient(x,y,0,x,y,r);
    const white=Math.random()<0.5;
    gr.addColorStop(0,white?'rgba(255,255,255,0.10)':'rgba(150,172,214,0.10)');
    gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);
  }
  /* слабый вельвет — не «идеальная лыжня» */
  for(let y=0;y<512;y+=9){
    g.fillStyle=(y%18<9)?'rgba(255,255,255,0.06)':'rgba(128,148,190,0.055)';
    g.fillRect(0,y,512,1);
  }
  for(let i=0;i<520;i++){
    g.fillStyle=`rgba(255,255,255,${rand(0.4,0.95)})`;
    g.fillRect(rand(512),rand(512),rand()<0.85?1:2,rand()<0.85?1:2);
  }
  for(let i=0;i<9;i++){
    g.fillStyle='rgba(255,190,120,0.8)';
    g.fillRect(rand(512),rand(512),2,2);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return t;
}
function blobTex(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,6,64,64,62);
  gr.addColorStop(0,'rgba(8,12,24,0.6)');
  gr.addColorStop(0.6,'rgba(8,12,24,0.28)');
  gr.addColorStop(1,'rgba(8,12,24,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
const groundTex=makeGroundTexture();
groundTex.repeat.set(14,42);
const TILE_LEN=340/42;
/* широкий freeride-склон (без коридора) */
const GROUND_W=180,GROUND_L=340,GROUND_Z=-130;
const GROUND_SEG_X=72,GROUND_SEG_Z=110;
/* ═══════════ noise-рельеф: хребты + чаши + горки-трамплины ═══════════ */
function hash2(ix,iz){
  const n=Math.sin(ix*127.1+iz*311.7)*43758.5453123;
  return n-Math.floor(n);
}
function valueNoise2(x,z){
  const ix=Math.floor(x),iz=Math.floor(z);
  const fx=x-ix,fz=z-iz;
  const ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz);
  const a=hash2(ix,iz),b=hash2(ix+1,iz),c=hash2(ix,iz+1),d=hash2(ix+1,iz+1);
  return a+(b-a)*ux+(c-a)*uz+(a-b-c+d)*ux*uz;
}
function fbm2(x,z,oct=4){
  let v=0,a=0.5,f=1,norm=0;
  for(let i=0;i<oct;i++){
    v+=a*valueNoise2(x*f,z*f);
    norm+=a;a*=0.5;f*=2.03;
  }
  return v/norm;
}
/** Ridged multi-fractal: острые хребты, как горные гребни. */
function ridged2(x,z,oct=4){
  let v=0,a=0.5,f=1,norm=0,w=1;
  for(let i=0;i<oct;i++){
    let n=valueNoise2(x*f,z*f);
    n=1-Math.abs(n*2-1);
    n=n*n*w;
    v+=n*a;
    norm+=a;
    w=Math.min(1,n*1.6);
    a*=0.5;f*=2.07;
  }
  return v/norm;
}
/* 1D-шум вдоль линии спуска — длинные волны горок */
function noise1(x){
  const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);
  const a=hash2(i,0.5),b=hash2(i+1,0.5);
  return a+(b-a)*u;
}
function fbm1(x,oct=2){
  let v=0,a=0.5,f=1,norm=0;
  for(let i=0;i<oct;i++){
    v+=a*noise1(x*f);
    norm+=a;a*=0.5;f*=2.1;
  }
  return v/norm;
}
function hash1i(n){
  const s=Math.sin(n*127.1+311.7)*43758.5453123;
  return s-Math.floor(s);
}
const KICK_CELL=54;
/**
 * Высота снега. courseZ = G.dist − worldZ (растёт по мере спуска).
 * Открытая гора: длинные волны, средние бугры и горки-трамплины.
 */
function terrainHeight(x,courseZ){
  const z=courseZ;
  let h=16;
  /* макро-хребты — главная «горность» */
  h+=ridged2(x*0.011+2.4,z*0.0075+0.8,4)*10.5;
  h+=ridged2(x*0.023-5.1,z*0.016+3.2,3)*4.8;
  /* широкие чаши / полки */
  h+=(fbm2(x*0.017+8.0,z*0.012-1.3,3)-0.5)*7.2;
  /* длинные волны вдоль спуска: разгон вниз / затяжной подъём */
  h+=(fbm1(z*0.008+3.3)-0.5)*14;
  /* средние бугры вдоль спуска */
  h+=(fbm1(z*0.05+8.8)-0.5)*2.4;
  /* средние бугры (читаемые, не тряска) */
  h+=(fbm2(x*0.048+1.1,z*0.036+4.7,2)-0.5)*3.0;
  /* лёгкая асимметрия, чтобы не было «плиты» */
  h+=Math.sin(x*0.065+z*0.019)*0.55;
  h+=Math.sin(x*0.028-z*0.041+1.7)*0.4;
  /* микро-вельвет (слабо) */
  h+=(fbm2(x*0.19,z*0.16,2)-0.5)*0.32;
  /* горки-трамплины: гауссовы купола по клеткам вдоль трассы */
  const cc=Math.floor(z/KICK_CELL);
  if(hash1i(cc*3.7+11.3)<0.62){
    const zc=cc*KICK_CELL+KICK_CELL*(0.3+0.4*hash1i(cc*5.1+2.2));
    const amp=1.8+1.4*hash1i(cc*7.9+4.4);
    const xc=(hash1i(cc*9.2+6.6)-0.5)*16;
    const sz=3.5+1.6*hash1i(cc*4.4+8.8);
    const sx=4.5+2.5*hash1i(cc*6.1+1.9);
    const dz=z-zc,dx=x-xc;
    h+=amp*Math.exp(-(dz*dz)/(2*sz*sz)-(dx*dx)/(2*sx*sx));
  }
  /* дальние предгорья только ЗА freeride-зоной — декор, не стена */
  const far=Math.max(0,Math.abs(x)-50)/28;
  if(far>0){
    const ff=far*far;
    h+=ff*(10+ridged2(x*0.04,z*0.03,2)*8+fbm2(x*0.06,z*0.04,2)*4);
  }
  return h;
}
/** Наклон: dhdx (вбок), dhds (вдоль спуска; >0 = подъём впереди). */
function terrainSlope(x,courseZ,e=0.7){
  const h=terrainHeight(x,courseZ);
  const dhdx=(terrainHeight(x+e,courseZ)-terrainHeight(x-e,courseZ))/(2*e);
  const dhds=(terrainHeight(x,courseZ+e)-terrainHeight(x,courseZ-e))/(2*e);
  return{h,dhdx,dhds};
}
const groundGeo=new THREE.PlaneGeometry(GROUND_W,GROUND_L,GROUND_SEG_X,GROUND_SEG_Z);
const groundBase=new Float32Array(groundGeo.attributes.position.array); /* lx, ly, 0 */
{
  const n=groundGeo.attributes.position.count;
  const colAttr=new THREE.BufferAttribute(new Float32Array(n*3).fill(1),3);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  groundGeo.setAttribute('color',colAttr);
}
/* living snow: world-space ridges, packed/ice by slope, wrap light, sparkle */
export const sparkleU={value:0};
export const snowU={day:{value:0},sparkle:{value:1},wind:{value:0}};
const groundMat=new THREE.MeshStandardMaterial({map:groundTex,roughness:0.84,metalness:0,vertexColors:true});
groundMat.onBeforeCompile=(sh)=>{
  sh.uniforms.uSparkleTime=sparkleU;
  sh.uniforms.uDay=snowU.day;
  sh.uniforms.uSparkle=snowU.sparkle;
  sh.uniforms.uWind=snowU.wind;
  sh.vertexShader=sh.vertexShader
    .replace('#include <common>','#include <common>\nvarying vec3 vWpos;\nvarying vec3 vWnor;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvWpos=(modelMatrix*vec4(transformed,1.0)).xyz;')
    .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvWnor=normalize(mat3(modelMatrix)*objectNormal);');
  sh.fragmentShader=sh.fragmentShader
    .replace('#include <common>',`#include <common>
      varying vec3 vWpos;varying vec3 vWnor;
      uniform float uSparkleTime;uniform float uDay;uniform float uSparkle;uniform float uWind;
      float snHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float snNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);
        float a=snHash(i),b=snHash(i+vec2(1.0,0.0)),c=snHash(i+vec2(0.0,1.0)),d=snHash(i+vec2(1.0,1.0));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
      }
      float snFbm(vec2 p){
        float v=0.0,a=0.5;
        for(int i=0;i<4;i++){v+=a*snNoise(p);p=p*2.07+vec2(1.7,3.1);a*=0.5;}
        return v;
      }
      float spHash3(vec3 p){p=fract(p*0.3183+vec3(0.1,0.2,0.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}`)
    .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    {
      vec2 wp=vWpos.xz;
      float e=0.18;
      float nL=snFbm(wp*0.42+vec2(-e,0.0)+uWind*0.15);
      float nR=snFbm(wp*0.42+vec2( e,0.0)+uWind*0.15);
      float nD=snFbm(wp*0.42+vec2(0.0,-e)+uWind*0.15);
      float nU=snFbm(wp*0.42+vec2(0.0, e)+uWind*0.15);
      vec3 bump=normalize(vec3(nL-nR,0.42,nD-nU));
      normal=normalize(normal+bump*0.32);
    }`)
    .replace('#include <color_fragment>',`#include <color_fragment>
    {
      vec2 wp=vWpos.xz;
      float ridges=snFbm(wp*0.28+vec2(uWind*0.2,0.0));
      float micro=snFbm(wp*1.9);
      float steep=1.0-clamp(vWnor.y,0.0,1.0);
      vec3 powder=mix(vec3(0.90,0.93,0.99),vec3(1.0,1.0,1.0),uDay);
      vec3 packed=mix(vec3(0.68,0.76,0.90),vec3(0.86,0.90,0.96),uDay);
      vec3 ice=mix(vec3(0.72,0.84,0.96),vec3(0.80,0.90,0.98),uDay);
      vec3 col=mix(powder,packed,smoothstep(0.32,0.72,ridges));
      col=mix(col,ice,smoothstep(0.22,0.68,steep));
      col=mix(col,powder,micro*0.12);
      diffuseColor.rgb*=col;
    }`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    {
      float steepR=1.0-clamp(vWnor.y,0.0,1.0);
      roughnessFactor=mix(0.92,0.30,smoothstep(0.25,0.75,steepR)*0.85);
    }`)
    .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    {
      if(uSparkle>0.5){
        vec3 spP=vWpos*18.0;
        vec3 spCell=floor(spP);
        float spRnd=spHash3(spCell);
        float spMask=smoothstep(0.46,0.08,length(fract(spP)-0.5));
        float spTw=0.5+0.5*sin(uSparkleTime*5.0+spRnd*90.0);
        float spGlint=step(0.988,spRnd)*spMask*spTw*uSparkle;
        vec3 V=normalize(vViewPosition);
        float glancing=pow(1.0-clamp(dot(normal,V),0.0,1.0),3.2);
        float facing=clamp(dot(normal,V),0.0,1.0);
        totalEmissiveRadiance+=vec3(0.88,0.93,1.0)*spGlint*(0.2+0.8*facing+1.4*glancing)*1.25;
        float iceFlash=smoothstep(0.4,0.8,1.0-clamp(vWnor.y,0.0,1.0))*glancing*0.12*(0.6+0.4*uDay);
        totalEmissiveRadiance+=vec3(0.75,0.88,1.0)*iceFlash;
      }
    }`)
    .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    {
      #if NUM_DIR_LIGHTS > 0
        vec3 L=directionalLights[0].direction;
        float wrap=max(dot(normal,L)*0.55+0.45,0.0);
        vec3 wrapCol=mix(vec3(0.42,0.56,0.78),vec3(0.78,0.86,0.94),uDay);
        reflectedLight.indirectDiffuse+=wrapCol*wrap*0.20;
      #endif
      float skyFill=pow(max(vWnor.y,0.0),0.65);
      reflectedLight.indirectDiffuse+=mix(vec3(0.18,0.28,0.48),vec3(0.55,0.64,0.74),uDay)*skyFill*0.12;
    }`);
};
const ground=new THREE.Mesh(groundGeo,groundMat);
ground.rotation.x=-Math.PI/2;ground.position.z=GROUND_Z;
ground.receiveShadow=true;
ground.geometry.computeVertexNormals();
scene.add(ground);
let _terrainNormFrame=0;
function updateTerrain(dist){
  const pos=groundGeo.attributes.position.array;
  const n=pos.length/3;
  for(let i=0;i<n;i++){
    const i3=i*3;
    const lx=groundBase[i3],ly=groundBase[i3+1];
    /* после rot.x=-π/2: world=(lx, localZ, -ly+GROUND_Z); course=dist-worldZ */
    const worldZ=-ly+GROUND_Z;
    const h=terrainHeight(lx,dist-worldZ);
    pos[i3]=lx;pos[i3+1]=ly;pos[i3+2]=h;
  }
  groundGeo.attributes.position.needsUpdate=true;
  /* normals + окраска по уклону реже — mesh плотный; первый кадр обязательно */
  if((++_terrainNormFrame&1)===0||_terrainNormFrame===1){
    groundGeo.computeVertexNormals();
    const col=groundGeo.attributes.color.array;
    const cols=GROUND_SEG_X+1;
    const dx=GROUND_W/GROUND_SEG_X,dz=GROUND_L/GROUND_SEG_Z;
    for(let i=0;i<n;i++){
      const i3=i*3;
      const c=i%cols,r=(i-c)/cols;
      const left=c>0?pos[i3-1]:pos[i3+2];
      const right=c<GROUND_SEG_X?pos[i3+5]:pos[i3+2];
      const up=r>0?pos[i3-cols*3+2]:pos[i3+2];
      const down=r<GROUND_SEG_Z?pos[i3+cols*3+2]:pos[i3+2];
      const sx=(right-left)/(2*dx),sz=(up-down)/(2*dz);
      const s=Math.sqrt(sx*sx+sz*sz);
      const t=Math.min(1,Math.max(0,(s-0.28)/0.85));
      col[i3]=1-0.22*t;col[i3+1]=1-0.16*t;col[i3+2]=1-0.04*t;
    }
    groundGeo.attributes.color.needsUpdate=true;
  }
}
/* bankMat оставлен для фонарей/декора; снежных валов-коридоров больше нет */
const bankMat=new THREE.MeshStandardMaterial({color:0xe6ecf8,roughness:1});
updateTerrain(0);
initMountains(scene);
/* ═══════════ еловый лес: instanced, два оттенка хвои ═══════════ */
const forestMat1=new THREE.MeshStandardMaterial({color:0x0c2126,roughness:1});
const forestMat2=new THREE.MeshStandardMaterial({color:0x122a30,roughness:1});
function makeFirGeo(){
  const needles=[],caps=[];
  const tiers=[
    [1.18,1.35,0.92],
    [0.98,1.42,1.78],
    [0.74,1.38,2.55],
    [0.50,1.22,3.28],
    [0.28,0.95,3.95]
  ];
  for(let i=0;i<tiers.length;i++){
    const [r,h,y]=tiers[i];
    const c=new THREE.ConeGeometry(r,h,6);
    const ox=(i%2?0.06:-0.05),oz=(i%3?0.04:-0.03);
    c.translate(ox,y,oz);
    c.rotateY(i*0.7);
    needles.push(c);
  }
  for(let i=0;i<4;i++){
    const [r,h,y]=tiers[i];
    const c=new THREE.ConeGeometry(r*1.06,h*0.28,6);
    c.translate((i%2?0.04:-0.03),y+h*0.40,0);
    caps.push(c);
  }
  return mergeGeometries([mergeGeometries(needles),mergeGeometries(caps)],true);
}
const firGeo=makeFirGeo();
const FOREST_N=130,FOREST_HALF=FOREST_N>>1;
const forestData=[];
/** X с плотностью: редко в центре, густо по бокам freeride. */
function pickForestX(){
  const u=Math.random();
  const s=Math.random()<0.5?-1:1;
  if(u<0.12)return rand(-9,9);           /* редкие на линии спуска */
  if(u<0.40)return s*rand(8,20);         /* средняя полоса */
  if(u<0.75)return s*rand(18,42);        /* основной freeride-край */
  return s*rand(38,78);                  /* дальние предгорья */
}
function makeForestMesh(mat,count){
  const m=new THREE.InstancedMesh(firGeo,[mat,treeSnowMat],count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.castShadow=true;m.receiveShadow=true;
  m.frustumCulled=false;
  scene.add(m);
  return m;
}
const forestA=makeForestMesh(forestMat1,FOREST_HALF);
const forestB=makeForestMesh(forestMat2,FOREST_N-FOREST_HALF);
for(let i=0;i<FOREST_N;i++){
  forestData.push({x:pickForestX(),z:rand(-300,24),s:rand(1.5,3.4),sy:rand(0.9,1.15),ry:rand(6.28),ph:rand(6.28)});
}
const _firDummy=new THREE.Object3D();
function forestUpdate(dist,scroll,time){
  for(let i=0;i<FOREST_N;i++){
    const f=forestData[i];
    f.z+=scroll;
    if(f.z>26){f.z-=330;f.x=pickForestX();f.s=rand(1.5,3.4);f.sy=rand(0.9,1.15);f.ry=rand(6.28);}
    _firDummy.position.set(f.x,terrainHeight(f.x,dist-f.z)-0.2,f.z);
    _firDummy.rotation.set(Math.sin(time*0.7+f.ph)*0.012,f.ry,Math.cos(time*0.6+f.ph)*0.012);
    _firDummy.scale.set(f.s,f.s*f.sy,f.s);
    _firDummy.updateMatrix();
    if(i<FOREST_HALF)forestA.setMatrixAt(i,_firDummy.matrix);
    else forestB.setMatrixAt(i-FOREST_HALF,_firDummy.matrix);
  }
  forestA.instanceMatrix.needsUpdate=true;
  forestB.instanceMatrix.needsUpdate=true;
}
function placeOnTerrain(obj,x,z,yOff=0,dist=0){
  obj.position.set(x,terrainHeight(x,dist-z)+yOff,z);
}
/* ═══════════ фонари вдоль трассы ═══════════ */
function radialTex(inner,outer){
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,4,64,64,62);
  gr.addColorStop(0,inner);gr.addColorStop(1,outer);
  g.fillStyle=gr;g.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const glowTex=radialTex('rgba(255,200,130,0.9)','rgba(255,140,50,0)');
const poleMat=new THREE.MeshStandardMaterial({color:0x1d222b,roughness:0.9});
const lampMat=new THREE.MeshStandardMaterial({color:0xffb050,emissive:0xff8a2a,emissiveIntensity:1.6,roughness:0.5});
const lampGeo=new THREE.BoxGeometry(0.34,0.4,0.34);
const poleGeo=new THREE.CylinderGeometry(0.07,0.09,2.7,6);
/* редкие одиночные маркеры (не парный коридор) */
const lanterns=[];
const LANT_N=8,LANT_SP=62;
for(let i=0;i<LANT_N;i++){
  const g=new THREE.Group();
  const p=new THREE.Mesh(poleGeo,poleMat);p.position.y=1.35;p.castShadow=true;g.add(p);
  const l=new THREE.Mesh(lampGeo,lampMat);l.position.y=2.75;l.castShadow=true;g.add(l);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.2,4),bankMat);cap.position.y=3.05;cap.rotation.y=Math.PI/4;g.add(cap);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffa64d,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0.5}));
  sp.position.y=2.75;sp.scale.set(2.4,2.4,1);g.add(sp);
  const side=i%2?1:-1;
  const lx=side*rand(6,28)+(Math.random()-0.5)*4;
  const lz=10-i*LANT_SP;
  placeOnTerrain(g,lx,lz,0,0);
  scene.add(g);
  lanterns.push({g,sp,phase:rand(6.28),x:lx});
}
/* ═══════════ клякса-тень под райдером (ложится на склон) ═══════════ */
const blobShadow=new THREE.Mesh(
  new THREE.PlaneGeometry(1.8,2.6),
  new THREE.MeshBasicMaterial({map:blobTex(),transparent:true,depthWrite:false,opacity:0.38})
);
blobShadow.rotation.order='YXZ';
blobShadow.rotation.x=-Math.PI/2;
blobShadow.renderOrder=2;
scene.add(blobShadow);
function blobShadowUpdate(x,dist,airH,slope){
  const y=terrainHeight(x,dist)+0.04;
  blobShadow.position.set(x,y,0);
  blobShadow.material.opacity=Math.max(0,0.40-airH*0.07);
  const sc=1+Math.min(airH*0.12,0.9);
  blobShadow.scale.set(sc*(1+Math.abs(slope?.dhdx||0)*0.4),sc,1);
  blobShadow.rotation.x=-Math.PI/2+Math.atan(slope?.dhds||0);
  blobShadow.rotation.z=-Math.atan(slope?.dhdx||0);
}
/* ═══════════ лыжня: желоб + валики ═══════════ */
const TRAIL_N=64;
const trailPts=[];
const trailPos=new Float32Array(TRAIL_N*3*3);
const trailFade=new Float32Array(TRAIL_N*3);
const trailSide=new Float32Array(TRAIL_N*3);
const trailIdx=[];
for(let i=0;i<TRAIL_N;i++){
  trailSide[i*3]=0;trailSide[i*3+1]=0.5;trailSide[i*3+2]=1;
}
for(let i=0;i<TRAIL_N-1;i++){
  const a=i*3;
  trailIdx.push(a,a+1,a+3, a+1,a+4,a+3);
  trailIdx.push(a+1,a+2,a+4, a+2,a+5,a+4);
}
const trailGeo=new THREE.BufferGeometry();
trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3).setUsage(THREE.DynamicDrawUsage));
trailGeo.setAttribute('aFade',new THREE.BufferAttribute(trailFade,1).setUsage(THREE.DynamicDrawUsage));
trailGeo.setAttribute('aSide',new THREE.BufferAttribute(trailSide,1));
trailGeo.setIndex(trailIdx);
const trailMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
  uniforms:{uDay:{value:0}},
  vertexShader:`attribute float aFade;attribute float aSide;varying float vF;varying float vS;
    void main(){vF=aFade;vS=aSide;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying float vF;varying float vS;uniform float uDay;
    void main(){
      float center=1.0-abs(vS*2.0-1.0);
      float groove=smoothstep(0.15,0.85,center);
      vec3 packed=mix(vec3(0.38,0.46,0.62),vec3(0.62,0.70,0.80),uDay);
      vec3 lip=mix(vec3(0.90,0.93,1.0),vec3(1.0,1.0,1.0),uDay);
      vec3 col=mix(lip,packed,groove);
      float a=vF*mix(0.22,0.62,groove);
      if(a<0.01)discard;
      gl_FragColor=vec4(col,a);
    }`
});
const trail=new THREE.Mesh(trailGeo,trailMat);
trail.frustumCulled=false;
trail.renderOrder=2;
scene.add(trail);
function trailEmit(x){
  trailPts.unshift({x,z:0,life:1});
  if(trailPts.length>TRAIL_N)trailPts.length=TRAIL_N;
}
function trailUpdate(dist,scroll,dt){
  for(const p of trailPts){
    p.z+=scroll;
    p.life-=dt*0.72;
  }
  while(trailPts.length&&trailPts[trailPts.length-1].life<=0)trailPts.pop();
  for(let i=0;i<TRAIL_N;i++){
    const p=trailPts[i];
    const i9=i*9;
    if(!p||p.life<=0){
      trailPos[i9+1]=-60;trailPos[i9+4]=-60;trailPos[i9+7]=-60;
      trailFade[i*3]=0;trailFade[i*3+1]=0;trailFade[i*3+2]=0;
      continue;
    }
    const y=terrainHeight(p.x,dist-p.z);
    const w=0.36;
    trailPos[i9]=p.x-w;trailPos[i9+1]=y+0.055;trailPos[i9+2]=p.z;
    trailPos[i9+3]=p.x;  trailPos[i9+4]=y+0.018;trailPos[i9+5]=p.z;
    trailPos[i9+6]=p.x+w;trailPos[i9+7]=y+0.055;trailPos[i9+8]=p.z;
    const f=Math.min(1,p.life*2.2)*Math.max(0,p.life);
    trailFade[i*3]=f*0.7;trailFade[i*3+1]=f;trailFade[i*3+2]=f*0.7;
  }
  trailGeo.attributes.position.needsUpdate=true;
  trailGeo.attributes.aFade.needsUpdate=true;
}
function trailReset(){
  trailPts.length=0;
  trailFade.fill(0);
  for(let i=0;i<TRAIL_N;i++){
    const i9=i*9;
    trailPos[i9+1]=-60;trailPos[i9+4]=-60;trailPos[i9+7]=-60;
  }
  trailGeo.attributes.position.needsUpdate=true;
  trailGeo.attributes.aFade.needsUpdate=true;
}
function lanternLightsUpdate(day,enabled){
  if(!enabled){
    for(const pl of lampLights)pl.intensity=0;
    return;
  }
  const ranked=lanterns
    .map(l=>({l,z:l.g.position.z}))
    .filter(o=>o.z<10&&o.z>-40)
    .sort((a,b)=>Math.abs(a.z)-Math.abs(b.z));
  const base=8*(1-day);
  for(let i=0;i<LAMP_LIGHT_N;i++){
    const pl=lampLights[i];
    const hit=ranked[i];
    if(!hit){pl.intensity=0;continue;}
    const g=hit.l.g;
    pl.position.set(g.position.x,g.position.y+2.7,g.position.z);
    pl.intensity=base*(0.7+0.3*Math.sin(performance.now()*0.006+hit.l.phase));
    pl.distance=18;
  }
}

export {
  THREE,
  renderer, scene, camera,
  hemiLight, moonLight, warmPt, bounceLight, rimLight, lampLights,
  skyMat, ground, groundTex, TILE_LEN, bankMat, trailMat,
  terrainHeight, terrainSlope, updateTerrain, placeOnTerrain,
  GROUND_W, GROUND_L,
  mountGrp, mountFarMat, mountNearMat, mountMidMat, mountainsUpdate,
  forestMat1, forestMat2, forestUpdate,
  lanterns, LANT_N, LANT_SP, lampMat, lanternLightsUpdate,
  blobShadow, blobShadowUpdate, trailEmit, trailUpdate, trailReset
};
