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

// Shared clock keeps each luminous cube's core and facet glint deterministic in exports.
const crystalClock = { value: 0 };
export function setCrystalTime(time) {
  crystalClock.value = time;
}
export function crystalMaterial(intensity = 0.4) {
  const material = pixelMaterial("#ffffff", intensity, true);
  material.metalness = 0.38;
  material.roughness = 0.19;
  material.clearcoat = 0.58;
  material.clearcoatRoughness = 0.2;
  material.specularIntensity = 0.72;
  material.specularColor.set("#d2e8ff");
  material.ior = 1.52;
  material.envMapIntensity = 0.48;
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
      vec3 crystalColor = vec3(1.0);
      #ifdef USE_COLOR
        crystalColor = vColor.rgb;
      #endif
      vec2 edgeDistance = min(crystalUv, 1.0 - crystalUv);
      float edge = 1.0 - smoothstep(0.018, 0.062, min(edgeDistance.x, edgeDistance.y));
      vec2 gridUv = fract(crystalUv * 3.0);
      vec2 gridDistance = min(gridUv, 1.0 - gridUv);
      float grid = 1.0 - smoothstep(0.012, 0.05, min(gridDistance.x, gridDistance.y));
      vec2 inset = abs(crystalUv - 0.5);
      float core = 1.0 - smoothstep(0.09, 0.43, max(inset.x, inset.y));
      float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
      float peak = max(crystalColor.r, max(crystalColor.g, crystalColor.b));
      // The emitted hue stays saturated even inside dark amber/brown cubes.
      // Nearly black pupils and mouth details retain their dark silhouettes.
      vec3 energyColor = crystalColor / max(peak, 0.045);
      energyColor *= smoothstep(0.006, 0.045, peak);
      float shimmer = 0.93 + 0.07 * sin(crystalTime * 2.1 + crystalSeed * 2.7);
      float glint = pow(max(0.0, sin(crystalTime * 2.8 + crystalSeed * 1.91)), 22.0);
      float facet = pow(max(0.0, 1.0 - abs(crystalUv.x + crystalUv.y - 1.0)), 12.0);
      totalEmissiveRadiance *=
        (crystalColor * (0.5 + core * 0.32) +
         energyColor * (edge * 3.1 + grid * 0.28 + core * 0.3 + rim * 0.36 + glint * facet * 0.72))
        * shimmer;
    `,
    );
  };
  return material;
}
