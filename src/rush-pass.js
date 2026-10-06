import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { Vector2 } from "three";

// Spatial shutter streaks only at the periphery: center action and pixels stay crisp.
// This has no frame history, so seeking and offline exports are deterministic.
export function makeRushPass() {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      amount: { value: 0 },
      kick: { value: 0 },
      center: { value: new Vector2(0.5, 0.52) },
    },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform float kick; uniform vec2 center; varying vec2 vUv;
      void main(){
        vec2 delta=vUv-center;
        float edge=smoothstep(.18,.57,length(delta));
        // The cockpit is attached to the camera: blurring it creates false ghost copies.
        edge *= smoothstep(.24,.48,vUv.y);
        vec4 sum=texture2D(tDiffuse,vUv)*2.0;
        for(int i=1;i<=6;i++) {
          float t=float(i)/6.0;
          sum+=texture2D(tDiffuse,clamp(vUv-delta*t*amount*edge,vec2(.001),vec2(.999)));
        }
        vec4 color=sum/8.0;
        // A slight peripheral color split reinforces boost pressure; the sightline stays clean.
        vec2 split=delta*edge*amount*.032;
        color.r=mix(color.r,texture2D(tDiffuse,clamp(vUv+split,vec2(.001),vec2(.999))).r,.45);
        color.b=mix(color.b,texture2D(tDiffuse,clamp(vUv-split,vec2(.001),vec2(.999))).b,.45);
        color.rgb += vec3(.03,.12,.2)*kick*edge;
        gl_FragColor=color;
      }`,
  });
}
