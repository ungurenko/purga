/* utilities */
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const rand=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
export const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
export const $=id=>document.getElementById(id);
export const fmt=n=>Math.floor(n).toLocaleString('ru-RU');
