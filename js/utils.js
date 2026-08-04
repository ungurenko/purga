/* utilities */
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
/** Frame-rate independent exponential damping toward target (lambda = snappiness). */
export const expDamp=(a,b,lambda,dt)=>a+(b-a)*(1-Math.exp(-lambda*dt));
/** Smoothstep ease 0…1 (Hermite). */
export const smoothstep=(e0,e1,x)=>{
  const t=clamp((x-e0)/(e1-e0),0,1);
  return t*t*(3-2*t);
};
export const rand=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
export const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
export const $=id=>document.getElementById(id);
export const fmt=n=>Math.floor(n).toLocaleString('ru-RU');
