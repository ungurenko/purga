import * as THREE from 'three';
import { rand, $ } from './utils.js';

/* ═══════════ рендерер / сцена ═══════════ */
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
renderer.outputColorSpace=THREE.SRGBColorSpace;
$('app').appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x131a30,0.015);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,900);
camera.position.set(0,3.2,8.4);
const hemiLight=new THREE.HemisphereLight(0x3a4f86,0x10182c,0.8);
scene.add(hemiLight);
const moonLight=new THREE.DirectionalLight(0xffd9ae,1.45);
moonLight.position.set(-30,42,25);
scene.add(moonLight);
const warmPt=new THREE.PointLight(0xff9a4d,10,30,2);
scene.add(warmPt);
/* ═══════════ небесный купол: ночь/день ═══════════ */
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
/* ═══════════ текстура вельвета (склон) ═══════════ */
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
  for(let y=0;y<512;y+=7){
    g.fillStyle=(y%14<7)?'rgba(255,255,255,0.10)':'rgba(128,148,190,0.10)';
    g.fillRect(0,y,512,2);
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
const groundTex=makeGroundTexture();
groundTex.repeat.set(7,42);
const TILE_LEN=340/42;
const ground=new THREE.Mesh(
  new THREE.PlaneGeometry(96,340),
  new THREE.MeshStandardMaterial({map:groundTex,roughness:0.95,metalness:0})
);
ground.rotation.x=-Math.PI/2;ground.position.z=-130;
scene.add(ground);
/* снежные валы по краям трассы */
const bankMat=new THREE.MeshStandardMaterial({color:0xe6ecf8,roughness:1});
const bankGeo=new THREE.BoxGeometry(4,1.5,340);
for(const s of[-1,1]){
  const b=new THREE.Mesh(bankGeo,bankMat);
  b.position.set(s*12.4,0.62,-130);scene.add(b);
}
/* ═══════════ горные силуэты ═══════════ */
const mountGrp=new THREE.Group();scene.add(mountGrp);
const mountFarMat=new THREE.MeshStandardMaterial({color:0x0b1226,roughness:1,flatShading:true});
const mountNearMat=new THREE.MeshStandardMaterial({color:0x101a34,roughness:1,flatShading:true});
{
  for(let i=0;i<8;i++){
    const r=rand(45,95),h=rand(55,115);
    const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,5),Math.random()<0.5?mountFarMat:mountNearMat);
    m.position.set(rand(-280,280),h/2-6,-rand(290,430));
    m.rotation.y=rand(Math.PI);
    mountGrp.add(m);
  }
}
/* ═══════════ еловый лес за трассой (пул) ═══════════ */
const forestMat1=new THREE.MeshStandardMaterial({color:0x0c2126,roughness:1});
const forestMat2=new THREE.MeshStandardMaterial({color:0x122a30,roughness:1});
const forestCone=new THREE.ConeGeometry(1,1,6);
const forest=[];
function resetForestTree(f,initial){
  const side=Math.random()<0.5?-1:1;
  const h=rand(5,10.5),r=rand(1.2,2.3);
  f.m.position.set(side*(15+rand(19)),h/2,initial?rand(-300,24):f.m.position.z-330);
  f.m.scale.set(r,h,r);
  f.m.userData.sway=rand(6.28);
}
for(let i=0;i<76;i++){
  const m=new THREE.Mesh(forestCone,Math.random()<0.5?forestMat1:forestMat2);
  const f={m};resetForestTree(f,true);scene.add(m);forest.push(f);
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
const lanterns=[];
const LANT_N=12,LANT_SP=44;
for(let i=0;i<LANT_N;i++){
  const g=new THREE.Group();
  const p=new THREE.Mesh(poleGeo,poleMat);p.position.y=1.35;g.add(p);
  const l=new THREE.Mesh(lampGeo,lampMat);l.position.y=2.75;g.add(l);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.2,4),bankMat);cap.position.y=3.05;cap.rotation.y=Math.PI/4;g.add(cap);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffa64d,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0.5}));
  sp.position.y=2.75;sp.scale.set(2.4,2.4,1);g.add(sp);
  g.position.set((i%2?1:-1)*11.2,0,10-i*LANT_SP);
  scene.add(g);
  lanterns.push({g,sp,phase:rand(6.28)});
}
/* ═══════════ снегопад ═══════════ */
const SNOW_N=1600;
const snowPos=new Float32Array(SNOW_N*3);
const snowSeed=new Float32Array(SNOW_N);
for(let i=0;i<SNOW_N;i++){
  snowPos[i*3]=rand(-36,36);snowPos[i*3+1]=rand(0,26);snowPos[i*3+2]=rand(-90,20);
  snowSeed[i]=rand(6.28);
}
const snowGeo=new THREE.BufferGeometry();
snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3).setUsage(THREE.DynamicDrawUsage));
const snowMat=new THREE.PointsMaterial({color:0xdfe8ff,size:0.11,transparent:true,opacity:0.6,depthWrite:false,sizeAttenuation:true});
const snow=new THREE.Points(snowGeo,snowMat);
snow.frustumCulled=false;scene.add(snow);
/* ═══════════ снежная пыль (спрей от доски) ═══════════ */
const SP_N=320;
const spPos=new Float32Array(SP_N*3),spVel=new Float32Array(SP_N*3),
      spLife=new Float32Array(SP_N),spSize=new Float32Array(SP_N);
for(let i=0;i<SP_N;i++)spPos[i*3+1]=-60;
const spGeo=new THREE.BufferGeometry();
spGeo.setAttribute('position',new THREE.BufferAttribute(spPos,3).setUsage(THREE.DynamicDrawUsage));
spGeo.setAttribute('aLife',new THREE.BufferAttribute(spLife,1).setUsage(THREE.DynamicDrawUsage));
spGeo.setAttribute('aSize',new THREE.BufferAttribute(spSize,1).setUsage(THREE.DynamicDrawUsage));
const spMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  vertexShader:`attribute float aLife;attribute float aSize;varying float vA;
    void main(){vA=clamp(aLife*2.2,0.0,1.0);
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    gl_PointSize=aSize*(150.0/-mv.z)*(0.35+0.65*vA);
    gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying float vA;
    void main(){vec2 c=gl_PointCoord-0.5;float m=smoothstep(0.5,0.12,length(c));
    float a=m*vA*0.9;if(a<0.02)discard;
    gl_FragColor=vec4(0.93,0.96,1.0,a);}`
});
const spray=new THREE.Points(spGeo,spMat);
spray.frustumCulled=false;scene.add(spray);
let spCursor=0;
function emitSpray(n,px,py,pz,ox={}){
  for(let k=0;k<n;k++){
    const i=spCursor++%SP_N,i3=i*3;
    spPos[i3]=px+(Math.random()-0.5)*(ox.sx||0.3);
    spPos[i3+1]=py+Math.random()*(ox.sy||0.12);
    spPos[i3+2]=pz+(Math.random()-0.5)*(ox.sz||0.3);
    spVel[i3]=(ox.vx||0)+(Math.random()-0.5)*(ox.vsx||1.4);
    spVel[i3+1]=(ox.vy||2)+Math.random()*(ox.vyr||2.2);
    spVel[i3+2]=(ox.vz||4)+Math.random()*2.4;
    spLife[i]=0.28+Math.random()*0.27;
    spSize[i]=0.12+Math.random()*0.12;
  }
}

export {
  THREE,
  renderer, scene, camera,
  hemiLight, moonLight, warmPt,
  skyMat, ground, groundTex, TILE_LEN, bankMat,
  mountGrp, mountFarMat, mountNearMat,
  forest, forestMat1, forestMat2, resetForestTree,
  lanterns, LANT_N, LANT_SP, lampMat,
  snow, snowMat, snowGeo, snowPos, snowSeed, SNOW_N,
  spray, spGeo, spMat, spPos, spVel, spLife, spSize, SP_N,
  emitSpray
};
