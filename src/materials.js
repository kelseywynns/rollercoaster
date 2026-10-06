import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Tiny bevels catch specular light without rounding away the individual pixels.
export const pixelGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.045);
let reflections = null;
export function setPixelEnvironment(texture) {
  reflections = texture;
}
export function pixelMaterial(
  color,
  intensity = 0.85,
  instanceEmission = false,
) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    envMap: reflections,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.5,
    roughness: 0.19,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.65,
  });
  if (instanceEmission) {
    // Debris keeps each original pixel's color in both its surface and glow.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif",
      );
    };
  }
  return material;
}

// Shared clock keeps the faint internal pixel grid deterministic during seeking and export.
const crystalClock = { value: 0 };
export function setCrystalTime(time) {
  crystalClock.value = time;
}
export function crystalMaterial(intensity = 0.4) {
  const material = pixelMaterial("#ffffff", intensity, true);
  material.metalness = 0.16;
  material.roughness = 0.24;
  material.clearcoat = 0.72;
  material.clearcoatRoughness = 0.28;
  material.ior = 1.46;
  material.envMapIntensity = 0.58;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.crystalTime = crystalClock;
    shader.vertexShader =
      "varying vec2 crystalUv; varying float crystalSeed;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      crystalUv = uv;
      crystalSeed = 0.0;
      #ifdef USE_INSTANCING
        crystalSeed = dot(instanceMatrix[3].xyz, vec3(0.73, 1.31, 0.39));
      #endif
    `,
    );
    shader.fragmentShader =
      "uniform float crystalTime; varying vec2 crystalUv; varying float crystalSeed;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `
      #include <emissivemap_fragment>
      #ifdef USE_COLOR
        totalEmissiveRadiance *= vColor.rgb;
      #endif
      vec2 edgeDistance = min(crystalUv, 1.0 - crystalUv);
      float edge = 1.0 - smoothstep(0.018, 0.045, min(edgeDistance.x, edgeDistance.y));
      vec2 gridUv = fract(crystalUv * 3.0);
      vec2 gridDistance = min(gridUv, 1.0 - gridUv);
      float grid = 1.0 - smoothstep(0.015, 0.045, min(gridDistance.x, gridDistance.y));
      float shimmer = 0.93 + 0.07 * sin(crystalTime * 1.4 + crystalSeed * 2.7);
      totalEmissiveRadiance *= (0.38 + edge * 1.1 + grid * 0.16) * shimmer;
    `,
    );
  };
  return material;
}
