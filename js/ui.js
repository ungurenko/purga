/* HUD helpers */
import { $, rand } from './utils.js';
import { G } from './state.js';

export const vignetteEl=$('vignette'),flashEl=$('flash'),bannerEl=$('banner'),popupsEl=$('popups');

export function popup(text,cls='info'){
  const el=document.createElement('div');
  el.className='popup '+cls;el.textContent=text;
  el.style.marginLeft=rand(-90,90)+'px';
  popupsEl.appendChild(el);
  el.addEventListener('animationend',()=>el.remove());
}
export function banner(text){
  bannerEl.textContent=text;
  bannerEl.classList.remove('show');void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
}
export function comboUIPop(){
  const cb=$('comboBox');
  cb.classList.remove('pop');void cb.offsetWidth;cb.classList.add('pop');
}
export function flashScreen(){
  flashEl.classList.remove('go');void flashEl.offsetWidth;flashEl.classList.add('go');
}
export const addScore=n=>{G.score+=n;};
export function comboUp(){
  G.combo++;G.mult=Math.min(5,1+G.combo*0.25);comboUIPop();
}
export function comboReset(){G.combo=0;G.mult=1;}
