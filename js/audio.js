/* procedural WebAudio */
export const A={ctx:null,master:null,windGain:null,windFilter:null,noise:null,muted:false};

export function initAudio(){
  if(A.ctx)return;
  try{
    A.ctx=new (window.AudioContext||window.webkitAudioContext)();
    A.master=A.ctx.createGain();A.master.gain.value=0.6;A.master.connect(A.ctx.destination);
    const len=A.ctx.sampleRate*2,buf=A.ctx.createBuffer(1,len,A.ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    A.noise=buf;
    const src=A.ctx.createBufferSource();src.buffer=buf;src.loop=true;
    A.windFilter=A.ctx.createBiquadFilter();A.windFilter.type='lowpass';A.windFilter.frequency.value=300;
    A.windGain=A.ctx.createGain();A.windGain.gain.value=0;
    src.connect(A.windFilter).connect(A.windGain).connect(A.master);src.start();
  }catch(e){console.warn('purga: audio init failed', e);}
}

const audioOK=()=>A.ctx&&!A.muted;

export function playNoise(o={}){
  if(!audioOK())return;
  const{dur=0.3,f0=800,f1=f0,q=1,g=0.3,type='lowpass',dl=0}=o;
  const t=A.ctx.currentTime+dl;
  const s=A.ctx.createBufferSource();s.buffer=A.noise;
  const f=A.ctx.createBiquadFilter();f.type=type;f.Q.value=q;
  f.frequency.setValueAtTime(Math.max(40,f0),t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40,f1),t+dur);
  const gn=A.ctx.createGain();
  gn.gain.setValueAtTime(g,t);gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(f).connect(gn).connect(A.master);s.start(t);s.stop(t+dur+0.05);
}

export function playTone(o={}){
  if(!audioOK())return;
  const{f0=440,f1=f0,dur=0.15,type='sine',g=0.2,dl=0}=o;
  const t=A.ctx.currentTime+dl;
  const osc=A.ctx.createOscillator();osc.type=type;
  osc.frequency.setValueAtTime(f0,t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);
  const gn=A.ctx.createGain();
  gn.gain.setValueAtTime(g,t);gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  osc.connect(gn).connect(A.master);osc.start(t);osc.stop(t+dur+0.05);
}

export const SFX={
  jump(){playNoise({dur:0.22,f0:500,f1:1800,type:'bandpass',q:1.2,g:0.22});},
  ramp(){SFX.jump();playTone({f0:300,f1:640,dur:0.25,type:'sawtooth',g:0.1});},
  land(){playTone({f0:95,f1:55,dur:0.16,g:0.35});playNoise({dur:0.12,f0:600,f1:200,g:0.18});},
  crash(){playNoise({dur:0.5,f0:1200,f1:120,g:0.5});playTone({f0:170,f1:50,dur:0.45,type:'sawtooth',g:0.2});},
  trick(){playTone({f0:660,dur:0.09,type:'square',g:0.15});playTone({f0:990,dur:0.12,type:'square',g:0.12,dl:0.08});},
  gate(){playTone({f0:830,dur:0.13,type:'triangle',g:0.17});playTone({f0:1245,dur:0.14,type:'triangle',g:0.11,dl:0.07});},
  near(){playNoise({dur:0.14,f0:2200,f1:900,type:'bandpass',g:0.14});},
  stumble(){playNoise({dur:0.2,f0:500,f1:150,g:0.3});},
  stage(){playTone({f0:440,dur:0.12,type:'triangle',g:0.14});playTone({f0:660,dur:0.16,type:'triangle',g:0.14,dl:0.1});}
};

export function toggleMute(){
  initAudio();
  A.muted=!A.muted;
  if(A.master)A.master.gain.value=A.muted?0:0.6;
  const btn=document.getElementById('muteBtn');
  if(btn)btn.textContent=A.muted?'ЗВУК: ВЫКЛ':'ЗВУК: ВКЛ';
}
