import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { Vector2 } from "three";

// Spatial shutter streaks only at the periphery: center action and pixels stay crisp.
// This has no frame history, so seeking and offline exports are deterministic.
export function makeRushPass() {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      amount: { value: 0 },
      center: { value: new Vector2(0.5, 0.52) },
    },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform vec2 center; varying vec2 vUv;
      void main(){
        vec2 delta=vUv-center;
        float edge=smoothstep(.2,.62,length(delta));
        vec4 sum=texture2D(tDiffuse,vUv)*2.0;
        for(int i=1;i<=6;i++) {
          float t=float(i)/6.0;
          sum+=texture2D(tDiffuse,clamp(vUv-delta*t*amount*edge,vec2(.001),vec2(.999)));
        }
        gl_FragColor=sum/8.0;
      }`,
  });
}
