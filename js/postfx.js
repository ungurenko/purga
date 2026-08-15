import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/* без MSAA: края маскируются зерном/инеем/блумом; bloom в половине разрешения */
const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType});
const composer=new EffectComposer(renderer,rt);
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(innerWidth,innerHeight);
composer.addPass(new RenderPass(scene,camera));
/* threshold high so snow stays snow; lanterns / moon / amber still bloom */
const bloomPass=new UnrealBloomPass(new THREE.Vector2(Math.round(innerWidth/2),Math.round(innerHeight/2)),0.48,0.52,0.88);
composer.addPass(bloomPass);

/* grade + tonemap + colorspace в одном проходе (вместо ShaderPass + OutputPass) */
const FinalShader={
  name:'FinalGradeShader',
  uniforms:{
    tDiffuse:{value:null},
    toneMappingExposure:{value:1},
    uDay:{value:0},
    uSpeed:{value:0},
    uFrost:{value:0},
    uTime:{value:0},
    uEnabled:{value:1}
  },
  vertexShader:`
    precision highp float;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uDay,uSpeed,uFrost,uTime,uEnabled;
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>
    varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);
      float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
      vec2 u=f*f*(3.-2.*f);
      return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
    }
    void main(){
      vec2 uv=vUv;
      vec4 src=texture2D(tDiffuse,uv);
      vec3 col=src.rgb;
      if(uEnabled>=0.5){

        /* speed chromatic aberration */
        float ca=uSpeed*0.0042;
        vec2 fromC=uv-0.5;
        col.r=texture2D(tDiffuse,uv+fromC*ca).r;
        col.g=src.g;
        col.b=texture2D(tDiffuse,uv-fromC*ca).b;

        /* night: teal shadows, amber highlights · day: cold paper white */
        float luma=dot(col,vec3(0.2126,0.7152,0.0722));
        vec3 nightSh=vec3(0.07,0.14,0.24);
        vec3 nightHi=vec3(1.0,0.86,0.68);
        vec3 daySh=vec3(0.62,0.72,0.84);
        vec3 dayHi=vec3(1.0,0.98,0.94);
        vec3 sh=mix(nightSh,daySh,uDay);
        vec3 hi=mix(nightHi,dayHi,uDay);
        col=mix(col*mix(vec3(1.0),sh/max(vec3(0.12),sh),0.22), hi, smoothstep(0.62,1.05,luma)*0.14);
        /* slight teal lift in night mids */
        col=mix(col,col*vec3(0.90,1.04,1.12), (1.0-uDay)*0.12);

        /* film grain */
        float g=hash(uv*vec2(1920.0,1080.0)+fract(uTime*19.7));
        col+= (g-0.5)*0.045;

        /* lens frost / rime on edges — grows with stage & speed */
        float dist=length(fromC);
        float vign=smoothstep(0.42,0.92,dist);
        float frostN=noise(uv*18.0+vec2(uTime*0.02,0.0));
        frostN+=0.5*noise(uv*42.0+vec2(3.1,uTime*0.04));
        float veins=smoothstep(0.55,0.85,frostN)*vign;
        float frost=uFrost*veins;
        vec3 frostCol=mix(vec3(0.78,0.88,1.0),vec3(0.95,0.97,1.0),uDay);
        col=mix(col,frostCol,frost*0.72);
        /* tiny crystals */
        float xt=step(0.93,hash(floor(uv*90.0)))*vign*uFrost;
        col+=vec3(0.85,0.92,1.0)*xt*0.35;
      }
      vec4 frag=vec4(col,src.a);

      #ifdef ACES_FILMIC_TONE_MAPPING
        frag.rgb=ACESFilmicToneMapping(frag.rgb);
      #endif
      #ifdef SRGB_TRANSFER
        frag=sRGBTransferOETF(frag);
      #endif
      gl_FragColor=frag;
    }`
};

class FinalPass extends Pass{
  constructor(){
    super();
    this.material=new THREE.RawShaderMaterial({
      name:FinalShader.name,
      uniforms:FinalShader.uniforms,
      vertexShader:FinalShader.vertexShader,
      fragmentShader:FinalShader.fragmentShader,
      defines:{ACES_FILMIC_TONE_MAPPING:'',SRGB_TRANSFER:''}
    });
    this.fsQuad=new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer){
    this.material.uniforms.tDiffuse.value=readBuffer.texture;
    this.material.uniforms.toneMappingExposure.value=renderer.toneMappingExposure;
    if(this.renderToScreen===true){
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    }else{
      renderer.setRenderTarget(writeBuffer);
      if(this.clear)renderer.clear(renderer.autoClearColor,renderer.autoClearDepth,renderer.autoClearStencil);
      this.fsQuad.render(renderer);
    }
  }
}

const gradePass=new FinalPass();
composer.addPass(gradePass);

export function setGrade(ctx){
  const u=gradePass.material.uniforms;
  u.uDay.value=ctx.day??0;
  u.uSpeed.value=ctx.speedN??0;
  u.uFrost.value=ctx.frost??0;
  u.uTime.value=ctx.time??0;
}

export function setGradeEnabled(on){
  gradePass.material.uniforms.uEnabled.value=on?1:0;
}

export function resizePost(w,h){
  composer.setSize(w,h);
  bloomPass.setSize(Math.round(w/2),Math.round(h/2));
}

export { composer, bloomPass, gradePass };
