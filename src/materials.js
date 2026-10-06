import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Tiny bevels catch specular light without rounding away the individual pixels.
export const pixelGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.045);
let reflections = null;
export function setPixelEnvironment(texture) {
  reflections = texture;
}
export function pixelMaterial(color, intensity = 0.85) {
  return new THREE.MeshPhysicalMaterial({
    color,
    envMap: reflections,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.5,
    roughness: 0.19,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.7,
  });
}
