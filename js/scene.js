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
const groundTex=makeGroundTexture();
groundTex.repeat.set(14,42);
const TILE_LEN=340/42;
/* широкий freeride-склон (без коридора) */
const GROUND_W=180,GROUND_L=340,GROUND_Z=-130;
const GROUND_SEG_X=72,GROUND_SEG_Z=110;
/* ═══════════ noise-рельеф: хребты + чаши (не синус-жёлоб) ═══════════ */
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
/**
 * Высота снега. courseZ = G.dist − worldZ (растёт по мере спуска).
 * Открытая гора: нет edge-бортов, только дальние предгорья за freeride.
 */
function terrainHeight(x,courseZ){
  const z=courseZ;
  let h=16;
  /* макро-хребты — главная «горность» */
  h+=ridged2(x*0.011+2.4,z*0.0075+0.8,4)*10.5;
  h+=ridged2(x*0.023-5.1,z*0.016+3.2,3)*4.8;
  /* широкие чаши / полки */
  h+=(fbm2(x*0.017+8.0,z*0.012-1.3,3)-0.5)*7.2;
  /* средние бугры (читаемые, не тряска) */
  h+=(fbm2(x*0.048+1.1,z*0.036+4.7,2)-0.5)*3.0;
  /* лёгкая асимметрия, чтобы не было «плиты» */
  h+=Math.sin(x*0.065+z*0.019)*0.55;
  h+=Math.sin(x*0.028-z*0.041+1.7)*0.4;
  /* микро-вельвет (слабо) */
  h+=(fbm2(x*0.19,z*0.16,2)-0.5)*0.32;
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
const ground=new THREE.Mesh(
  groundGeo,
  new THREE.MeshStandardMaterial({map:groundTex,roughness:0.95,metalness:0})
);
ground.rotation.x=-Math.PI/2;ground.position.z=GROUND_Z;
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
  /* normals реже — mesh плотный; первый кадр обязательно */
  if((++_terrainNormFrame&1)===0||_terrainNormFrame===1)groundGeo.computeVertexNormals();
}
/* bankMat оставлен для фонарей/декора; снежных валов-коридоров больше нет */
const bankMat=new THREE.MeshStandardMaterial({color:0xe6ecf8,roughness:1});
updateTerrain(0);
/* ═══════════ горные силуэты ═══════════ */
const mountGrp=new THREE.Group();scene.add(mountGrp);
const mountFarMat=new THREE.MeshStandardMaterial({color:0x0b1226,roughness:1,flatShading:true});
const mountNearMat=new THREE.MeshStandardMaterial({color:0x101a34,roughness:1,flatShading:true});
{
  for(let i=0;i<14;i++){
    const r=rand(40,100),h=rand(50,130);
    const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,5),Math.random()<0.5?mountFarMat:mountNearMat);
    m.position.set(rand(-300,300),h/2-8,-rand(270,460));
    m.rotation.y=rand(Math.PI);
    mountGrp.add(m);
  }
  for(let i=0;i<6;i++){
    const r=rand(22,48),h=rand(28,55);
    const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,5),mountNearMat);
    m.position.set(rand(-220,220),h/2-4,-rand(180,280));
    m.rotation.y=rand(Math.PI);
    mountGrp.add(m);
  }
}
/* ═══════════ еловый лес на открытом склоне (пул) ═══════════ */
const forestMat1=new THREE.MeshStandardMaterial({color:0x0c2126,roughness:1});
const forestMat2=new THREE.MeshStandardMaterial({color:0x122a30,roughness:1});
const forestCone=new THREE.ConeGeometry(1,1,6);
const forest=[];
function placeOnTerrain(obj,x,z,yOff=0,dist=0){
  obj.position.set(x,terrainHeight(x,dist-z)+yOff,z);
}
/** X с плотностью: редко в центре, густо по бокам freeride. */
function pickForestX(){
  const u=Math.random();
  const s=Math.random()<0.5?-1:1;
  if(u<0.12)return rand(-9,9);           /* редкие на линии спуска */
  if(u<0.40)return s*rand(8,20);         /* средняя полоса */
  if(u<0.75)return s*rand(18,42);        /* основной freeride-край */
  return s*rand(38,78);                  /* дальние предгорья */
}
function resetForestTree(f,initial,dist=0){
  const h=rand(5,12),r=rand(1.15,2.5);
  const x=pickForestX();
  const z=initial?rand(-300,24):f.m.position.z-330;
  f.m.scale.set(r,h,r);
  f.hHalf=h/2;
  placeOnTerrain(f.m,x,z,h/2,dist);
  f.m.userData.sway=rand(6.28);
}
for(let i=0;i<110;i++){
  const m=new THREE.Mesh(forestCone,Math.random()<0.5?forestMat1:forestMat2);
  const f={m,hHalf:1};resetForestTree(f,true,0);scene.add(m);forest.push(f);
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
  const p=new THREE.Mesh(poleGeo,poleMat);p.position.y=1.35;g.add(p);
  const l=new THREE.Mesh(lampGeo,lampMat);l.position.y=2.75;g.add(l);
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
/* ═══════════ снегопад ═══════════ */
const SNOW_N=1600;
const snowPos=new Float32Array(SNOW_N*3);
const snowSeed=new Float32Array(SNOW_N);
for(let i=0;i<SNOW_N;i++){
  snowPos[i*3]=rand(-70,70);snowPos[i*3+1]=rand(0,28);snowPos[i*3+2]=rand(-90,20);
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
  terrainHeight, terrainSlope, updateTerrain, placeOnTerrain,
  GROUND_W, GROUND_L,
  mountGrp, mountFarMat, mountNearMat,
  forest, forestMat1, forestMat2, resetForestTree,
  lanterns, LANT_N, LANT_SP, lampMat,
  snow, snowMat, snowGeo, snowPos, snowSeed, SNOW_N,
  spray, spGeo, spMat, spPos, spVel, spLife, spSize, SP_N,
  emitSpray
};
