import { renderer, moonLight, bounceLight, rimLight, snowU, lanternLightsUpdate } from './scene.js';
import { composer, bloomPass, setGradeEnabled } from './postfx.js';
import { setBlizzardQuality } from './blizzard.js';
import { dayFactor } from './theme.js';

/* tier 0 = низкий, 1 = средний, 2 = высокий */
let tier=2,acc=0,frames=0,cooldown=0;

function apply(){
  const pr=[1,1.5,Math.min(devicePixelRatio,2)][tier];
  renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight);
  composer.setPixelRatio(pr);composer.setSize(innerWidth,innerHeight);
  moonLight.castShadow=tier>0;
  bloomPass.enabled=tier>0;
  setGradeEnabled(tier>0);
  snowU.sparkle.value=tier>0?1:0;
  bounceLight.visible=tier>0;
  rimLight.visible=tier>1;
  setBlizzardQuality(tier);
  if(tier===0)lanternLightsUpdate(dayFactor,false);
}

export function qualityInit(){apply();}
export function qualityTier(){return tier;}
export function qualityFrame(dt){
  acc+=dt;frames++;
  if(cooldown>0)cooldown-=dt;
  if(frames>=75){
    const fps=frames/acc;
    acc=0;frames=0;
    if(cooldown>0)return;
    if(fps<44&&tier>0){tier--;apply();cooldown=6;}
    else if(fps>57&&tier<2){tier++;apply();cooldown=10;}
  }
}
