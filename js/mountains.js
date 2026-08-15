import * as THREE from 'three';

/* Ridged alpine silhouettes + layered haze. No scene import (avoids cycles). */

/* color is a day/night multiplier — vertex colors hold rock vs snow */
export const mountFarMat=new THREE.MeshStandardMaterial({
  color:0xb8c4dc,roughness:0.96,metalness:0.02,vertexColors:true,flatShading:false
});
export const mountMidMat=new THREE.MeshStandardMaterial({
  color:0xc4cee2,roughness:0.94,metalness:0.02,vertexColors:true,flatShading:false
});
export const mountNearMat=new THREE.MeshStandardMaterial({
  color:0xd0d8ea,roughness:0.92,metalness:0.03,vertexColors:true,flatShading:false
});

const mountGrp=new THREE.Group();
const hazeGrp=new THREE.Group();
let _ready=false;

function hash2(ix,iz){
  const n=Math.sin(ix*127.1+iz*311.7)*43758.5453123;
  return n-Math.floor(n);
}
function valueNoise(x,z){
  const ix=Math.floor(x),iz=Math.floor(z);
  const fx=x-ix,fz=z-iz;
  const ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz);
  const a=hash2(ix,iz),b=hash2(ix+1,iz),c=hash2(ix,iz+1),d=hash2(ix+1,iz+1);
  return a+(b-a)*ux+(c-a)*uz+(a-b-c+d)*ux*uz;
}
function fbm(x,z,oct=4){
  let v=0,a=0.5,f=1,n=0;
  for(let i=0;i<oct;i++){v+=a*valueNoise(x*f,z*f);n+=a;a*=0.5;f*=2.07;}
  return v/n;
}
function smoothstep(e0,e1,x){
  const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));
  return t*t*(3-2*t);
}

/** Irregular peak: displaced cone + snow on high / lee faces. */
function peakGeo(r,h,segs,seed){
  const geo=new THREE.ConeGeometry(r,h,segs,5);
  const pos=geo.attributes.position;
  const col=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
    let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const ny=(y+h*0.5)/h;
    const ang=Math.atan2(z,x);
    const n1=0.5+0.5*Math.sin(ang*3.0+seed);
    const n2=0.5+0.5*Math.sin(ang*7.2+seed*1.7);
    const n3=fbm(x*0.035+seed,z*0.035+seed*0.6,3);
    const radial=1+(n1*0.42+n2*0.22-0.18)*(1-ny*ny);
    const yJit=(n3-0.5)*h*0.22*(1-ny*0.35);
    x*=radial;z*=radial;y+=yJit;
    /* secondary spur on some faces */
    const spur=Math.max(0,Math.sin(ang*2.0+seed*0.4))*0.18*(1-ny);
    x+=Math.cos(ang)*r*spur;z+=Math.sin(ang)*r*spur;
    pos.setXYZ(i,x,y,z);
    const snowH=smoothstep(0.32,0.74,ny);
    const lee=smoothstep(-0.15,0.55,z/Math.max(r,1));
    const snow=Math.min(1,snowH*(0.55+0.45*lee)+smoothstep(0.78,0.96,ny)*0.5);
    const rockR=0.16+n3*0.06,rockG=0.20+n3*0.05,rockB=0.30+n3*0.08;
    col[i*3]=rockR+(0.86-rockR)*snow;
    col[i*3+1]=rockG+(0.91-rockG)*snow;
    col[i*3+2]=rockB+(0.98-rockB)*snow;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.computeVertexNormals();
  return geo;
}

/** Long sawtooth ridgeline — the horizon's main character. */
function rangeGeo(width,height,depth,cols,seed){
  const rows=5;
  const pos=new Float32Array((cols+1)*(rows+1)*3);
  const col=new Float32Array((cols+1)*(rows+1)*3);
  const idx=[];
  for(let r=0;r<=rows;r++){
    const v=r/rows;
    /* 0 = far skirt, 0.5 = crest, 1 = near skirt */
    const ridge=1-Math.abs(v*2-1);
    const z= -depth*0.5 + depth*v;
    for(let c=0;c<=cols;c++){
      const u=c/cols;
      const x=-width*0.5+width*u;
      const n=fbm(u*6.5+seed,v*2.2+seed*0.7,4);
      const n2=fbm(u*14+seed*2,v*4,3);
      const peaks=Math.pow(Math.abs(Math.sin(u*Math.PI*3.2+seed)+Math.sin(u*Math.PI*7.1+n*4)*0.45),1.15);
      const h=height*(0.28+peaks*0.72)*(0.55+n*0.55)*ridge;
      const y=h+(n2-0.5)*height*0.08*ridge;
      const i=r*(cols+1)+c;
      pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z+(n-0.5)*depth*0.08;
      const snow=smoothstep(height*0.28,height*0.72,y)*ridge;
      col[i*3]=0.16+(0.88-0.16)*snow;
      col[i*3+1]=0.20+(0.92-0.20)*snow;
      col[i*3+2]=0.30+(0.98-0.30)*snow;
    }
  }
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const a=r*(cols+1)+c;
      idx.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function hazeMat(hex,op){
  const c=new THREE.Color(hex);
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{
      uCol:{value:c},
      uOp:{value:op},
      uDay:{value:0}
    },
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 vUv;uniform vec3 uCol;uniform float uOp;uniform float uDay;
      void main(){
        float h=smoothstep(0.0,0.35,vUv.y)*smoothstep(1.0,0.42,vUv.y);
        float side=smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x);
        vec3 day=mix(uCol,vec3(0.78,0.86,0.94),uDay);
        float a=h*side*uOp*(0.55+0.45*(1.0-uDay));
        if(a<0.01)discard;
        gl_FragColor=vec4(day,a);
      }`
  });
}

const hazeMats=[];

export function initMountains(scene){
  if(_ready)return;
  _ready=true;

  /* far wall of ranges */
  const far=new THREE.Mesh(rangeGeo(720,150,90,56,1.7),mountFarMat);
  far.position.set(0,8,-430);
  far.receiveShadow=false;far.castShadow=false;
  mountGrp.add(far);

  const farB=new THREE.Mesh(rangeGeo(640,110,70,48,4.2),mountFarMat);
  farB.position.set(40,4,-380);
  mountGrp.add(farB);

  /* mid isolated peaks */
  for(let i=0;i<11;i++){
    const h=55+hash2(i,3.1)*90;
    const r=h*(0.42+hash2(i,8.8)*0.32);
    const m=new THREE.Mesh(peakGeo(r,h,10,i*13.7),i%3===0?mountFarMat:mountMidMat);
    const side=hash2(i,1.2)<0.5?-1:1;
    m.position.set(side*(80+hash2(i,2.4)*220),h*0.28-10,-(300+hash2(i,5.5)*140));
    m.rotation.y=hash2(i,9.1)*Math.PI*2;
    m.castShadow=false;
    mountGrp.add(m);
  }

  /* nearer foothills — kept wide so they frame, not eat, the slope */
  for(let i=0;i<6;i++){
    const h=26+hash2(i,11.2)*28;
    const r=h*(0.42+hash2(i,6.6)*0.22);
    const m=new THREE.Mesh(peakGeo(r,h,9,i*21.4+4),mountNearMat);
    const side=i%2?-1:1;
    m.position.set(side*(140+hash2(i,4.4)*140),h*0.18-4,-(240+hash2(i,7.7)*80));
    m.rotation.y=hash2(i,3.3)*Math.PI;
    mountGrp.add(m);
  }

  const nearRange=new THREE.Mesh(rangeGeo(520,52,40,40,8.8),mountNearMat);
  nearRange.position.set(-20,-4,-290);
  mountGrp.add(nearRange);

  scene.add(mountGrp);

  const bands=[
    {z:-360,w:900,h:220,y:40,col:0x0c1428,op:0.42},
    {z:-280,w:820,h:160,y:18,col:0x121c34,op:0.28},
    {z:-210,w:740,h:110,y:4,col:0x182440,op:0.18}
  ];
  for(const b of bands){
    const mat=hazeMat(b.col,b.op);
    hazeMats.push(mat);
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(b.w,b.h),mat);
    pl.position.set(0,b.y,b.z);
    pl.renderOrder=-2;
    hazeGrp.add(pl);
  }
  scene.add(hazeGrp);
}

export function mountainsUpdate(riderX,day){
  mountGrp.position.x=-riderX*0.18;
  hazeGrp.position.x=-riderX*0.12;
  for(const m of hazeMats)m.uniforms.uDay.value=day;
}

export { mountGrp };
