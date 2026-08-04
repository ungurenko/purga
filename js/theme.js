import * as THREE from 'three';
import { $ } from './utils.js';
import {
  scene, renderer, hemiLight, moonLight, warmPt, skyMat,
  ground, bankMat, mountFarMat, mountNearMat, forestMat1, forestMat2,
  snowMat, lampMat
} from './scene.js';
import {
  accentMat, boardTopMat, scarfMat, bootCuffMat, gloveMat, logoMat
} from './rider.js';
import { treeDarkMat, treeMidMat, treeSnowMat, trunkMat } from './trees.js';
import { lipMat, flagMatBase, bulbMatBase } from './obstacles.js';

/* ═══════════ день / ночь ═══════════ */
export const THEME_NIGHT={
  fog:0x131a30,
  hemiSky:0x3a4f86,hemiGround:0x10182c,hemiI:0.8,
  dirCol:0xffd9ae,dirI:1.45,dirPos:[-30,42,25],
  warmCol:0xff9a4d,warmI:10,
  exposure:1.15,
  bank:0xe6ecf8,mountFar:0x0b1226,mountNear:0x101a34,
  forest1:0x0c2126,forest2:0x122a30,
  snow:0xdfe8ff,
  lampEm:1.6,glowBase:0.5,bulbEm:1.5,lipEm:1.4,flagEm:0.35,
  riderEmScale:1,
  css:{'--bg':'#070b1a','--panel':'rgba(12,19,40,.84)','--steel':'#8fa3c8','--line':'rgba(127,147,189,.35)','--snow':'#eef3ff'}
};
export const THEME_DAY={
  fog:0xc5d6ea,
  hemiSky:0xb6d2f0,hemiGround:0xdde8f2,hemiI:1.1,
  dirCol:0xfff2dc,dirI:1.9,dirPos:[28,48,18],
  warmCol:0xffe0b0,warmI:0.35,
  exposure:1.3,
  bank:0xf5f8fd,mountFar:0xb4c2d4,mountNear:0xd4dce8,
  forest1:0x2d4f3c,forest2:0x3a5f48,
  snow:0xffffff,
  lampEm:0.12,glowBase:0.04,bulbEm:0.18,lipEm:0.55,flagEm:0.2,
  riderEmScale:0.35,
  css:{'--bg':'#d2e2f2','--panel':'rgba(255,255,255,.78)','--steel':'#4a5d78','--line':'rgba(80,100,130,.28)','--snow':'#1a2438'}
};
export let themeMode='night';
try{const t=localStorage.getItem('purga:theme');if(t==='day'||t==='night')themeMode=t;}catch(e){console.warn('purga: theme storage', e);}
export let dayFactor=themeMode==='day'?1:0;
export let dayTarget=dayFactor;
const _cA=new THREE.Color(),_cB=new THREE.Color(),_cOut=new THREE.Color();
export function mixCol(a,b,t){return _cOut.copy(_cA.set(a)).lerp(_cB.set(b),t).getHex();}
export function applyTheme(t){
  t=Math.max(0,Math.min(1,t));
  dayFactor=t;
  scene.fog.color.setHex(mixCol(THEME_NIGHT.fog,THEME_DAY.fog,t));
  hemiLight.color.setHex(mixCol(THEME_NIGHT.hemiSky,THEME_DAY.hemiSky,t));
  hemiLight.groundColor.setHex(mixCol(THEME_NIGHT.hemiGround,THEME_DAY.hemiGround,t));
  hemiLight.intensity=THEME_NIGHT.hemiI+(THEME_DAY.hemiI-THEME_NIGHT.hemiI)*t;
  moonLight.color.setHex(mixCol(THEME_NIGHT.dirCol,THEME_DAY.dirCol,t));
  moonLight.intensity=THEME_NIGHT.dirI+(THEME_DAY.dirI-THEME_NIGHT.dirI)*t;
  const np=THEME_NIGHT.dirPos,dp=THEME_DAY.dirPos;
  moonLight.position.set(
    np[0]+(dp[0]-np[0])*t,
    np[1]+(dp[1]-np[1])*t,
    np[2]+(dp[2]-np[2])*t
  );
  warmPt.color.setHex(mixCol(THEME_NIGHT.warmCol,THEME_DAY.warmCol,t));
  renderer.toneMappingExposure=THEME_NIGHT.exposure+(THEME_DAY.exposure-THEME_NIGHT.exposure)*t;
  bankMat.color.setHex(mixCol(THEME_NIGHT.bank,THEME_DAY.bank,t));
  ground.material.color.setHex(mixCol(0xd8e0ee,0xffffff,t));
  mountFarMat.color.setHex(mixCol(THEME_NIGHT.mountFar,THEME_DAY.mountFar,t));
  mountNearMat.color.setHex(mixCol(THEME_NIGHT.mountNear,THEME_DAY.mountNear,t));
  forestMat1.color.setHex(mixCol(THEME_NIGHT.forest1,THEME_DAY.forest1,t));
  forestMat2.color.setHex(mixCol(THEME_NIGHT.forest2,THEME_DAY.forest2,t));
  treeDarkMat.color.setHex(mixCol(0x102e2c,0x2f5240,t));
  treeMidMat.color.setHex(mixCol(0x163a36,0x3a6350,t));
  trunkMat.color.setHex(mixCol(0x241b12,0x3a2e22,t));
  treeSnowMat.color.setHex(mixCol(0xe8eef8,0xffffff,t));
  snowMat.color.setHex(mixCol(THEME_NIGHT.snow,THEME_DAY.snow,t));
  lampMat.emissiveIntensity=THEME_NIGHT.lampEm+(THEME_DAY.lampEm-THEME_NIGHT.lampEm)*t;
  bulbMatBase.emissiveIntensity=THEME_NIGHT.bulbEm+(THEME_DAY.bulbEm-THEME_NIGHT.bulbEm)*t;
  lipMat.emissiveIntensity=THEME_NIGHT.lipEm+(THEME_DAY.lipEm-THEME_NIGHT.lipEm)*t;
  flagMatBase.emissiveIntensity=THEME_NIGHT.flagEm+(THEME_DAY.flagEm-THEME_NIGHT.flagEm)*t;
  const emS=THEME_NIGHT.riderEmScale+(THEME_DAY.riderEmScale-THEME_NIGHT.riderEmScale)*t;
  accentMat.emissiveIntensity=0.45*emS;
  boardTopMat.emissiveIntensity=0.35*emS;
  scarfMat.emissiveIntensity=0.3*emS;
  bootCuffMat.emissiveIntensity=0.3*emS;
  gloveMat.emissiveIntensity=0.25*emS;
  logoMat.emissiveIntensity=0.4*emS;
  skyMat.uniforms.uDay.value=t;
  const src=(t>=0.5)?THEME_DAY.css:THEME_NIGHT.css;
  const root=document.documentElement;
  for(const k of Object.keys(src))root.style.setProperty(k,src[k]);
  document.body.classList.toggle('theme-day',t>=0.5);
  const tb=$('themeBtn');
  if(tb)tb.textContent=themeMode==='day'?'ТЕМА: ДЕНЬ':'ТЕМА: НОЧЬ';
}
export function setTheme(mode,instant){
  themeMode=mode==='day'?'day':'night';
  dayTarget=themeMode==='day'?1:0;
  try{localStorage.setItem('purga:theme',themeMode);}catch(e){console.warn('purga: theme storage', e);}
  if(instant){dayFactor=dayTarget;applyTheme(dayFactor);}
  const tb=$('themeBtn');
  if(tb)tb.textContent=themeMode==='day'?'ТЕМА: ДЕНЬ':'ТЕМА: НОЧЬ';
}
export function toggleTheme(){
  setTheme(themeMode==='day'?'night':'day',false);
}
export function themeTick(dt){
  if(Math.abs(dayFactor-dayTarget)<0.001){
    if(dayFactor!==dayTarget){dayFactor=dayTarget;applyTheme(dayFactor);}
    return;
  }
  const speed=1.1;
  const dir=dayTarget>dayFactor?1:-1;
  dayFactor=Math.max(0,Math.min(1,dayFactor+dir*speed*dt));
  if((dir>0&&dayFactor>=dayTarget)||(dir<0&&dayFactor<=dayTarget))dayFactor=dayTarget;
  applyTheme(dayFactor);
}
