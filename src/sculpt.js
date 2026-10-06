import * as THREE from "three";
import { pixelGeometry, crystalMaterial } from "./materials.js";

const dummy = new THREE.Object3D();
const shade = new THREE.Color();
export const hash = (n) => {
  const v = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return v - Math.floor(v);
};

// Surface voxelization gives each silhouette depth while omitting hidden interior cubes.
export function voxelEllipsoid(
  parent,
  center,
  radii,
  tint,
  cell = 1.25,
  glow = 0.38,
) {
  const voxels = [];
  const bounds = radii.map((r) => Math.ceil(r / cell));
  const inside = (x, y, z) =>
    ((x * cell) / radii[0]) ** 2 +
      ((y * cell) / radii[1]) ** 2 +
      ((z * cell) / radii[2]) ** 2 <=
    1;
  for (let x = -bounds[0]; x <= bounds[0]; x++)
    for (let y = -bounds[1]; y <= bounds[1]; y++)
      for (let z = -bounds[2]; z <= bounds[2]; z++) {
        if (!inside(x, y, z)) continue;
        if (
          [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
          ].every(([a, b, c]) => inside(x + a, y + b, z + c))
        )
          continue;
        const variation = 0.65 + hash(x * 83 + y * 17 + z * 41) * 0.42;
        shade
          .set(
            typeof tint === "function"
              ? tint(x * cell, y * cell, z * cell)
              : tint,
          )
          .multiplyScalar(variation);
        voxels.push({
          position: new THREE.Vector3(
            center[0] + x * cell,
            center[1] + y * cell,
            center[2] + z * cell,
          ),
          scale: new THREE.Vector3().setScalar(cell * 0.965),
          color: shade.clone(),
        });
      }
  const mesh = new THREE.InstancedMesh(
    pixelGeometry,
    crystalMaterial(glow),
    voxels.length,
  );
  voxels.forEach((v, i) => {
    dummy.position.copy(v.position);
    dummy.scale.copy(v.scale);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, v.color);
  });
  mesh.userData.voxels = voxels;
  parent.add(mesh);
  return mesh;
}

export function collectVoxels(root, world = false) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(),
    cells = [];
  root.traverse((mesh) => {
    if (!mesh.userData.voxels) return;
    const transform = world
      ? mesh.matrixWorld
      : new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    const rotation = new THREE.Quaternion(),
      translation = new THREE.Vector3(),
      scale = new THREE.Vector3();
    transform.decompose(translation, rotation, scale);
    for (const voxel of mesh.userData.voxels)
      cells.push({
        position: voxel.position.clone().applyMatrix4(transform),
        scale: voxel.scale.clone().multiply(scale),
        rotation: rotation.clone(),
        color: voxel.color.clone(),
      });
  });
  return cells;
}

// Surface-only implicit voxel forms retain the exact arcade silhouette.
function voxelShape(parent, bounds, inside, tint, cell = 0.65, glow = 0.16) {
  const cells = [],
    dimensions = bounds.map((v) => Math.ceil(v / cell));
  for (let x = -dimensions[0]; x <= dimensions[0]; x++)
    for (let y = -dimensions[1]; y <= dimensions[1]; y++)
      for (let z = -dimensions[2]; z <= dimensions[2]; z++) {
        const a = x * cell,
          b = y * cell,
          c = z * cell;
        if (!inside(a, b, c)) continue;
        if (
          [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
          ].every(([u, v, w]) =>
            inside(a + u * cell, b + v * cell, c + w * cell),
          )
        )
          continue;
        cells.push({
          position: new THREE.Vector3(a, b, c),
          scale: new THREE.Vector3().setScalar(cell * 0.96),
          color: new THREE.Color(
            typeof tint === "function" ? tint(a, b, c) : tint,
          ).multiplyScalar(0.82 + hash(x * 31 + y * 17 + z * 43) * 0.18),
        });
      }
  const mesh = new THREE.InstancedMesh(
    pixelGeometry,
    crystalMaterial(glow),
    cells.length,
  );
  cells.forEach((v, i) => {
    dummy.position.copy(v.position);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.copy(v.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, v.color);
  });
  mesh.userData.voxels = cells;
  parent.add(mesh);
  return mesh;
}

export function makeSentry() {
  const root = new THREE.Group();
  root.name = "Blinky — voxel ghost";
  voxelShape(
    root,
    [7, 8, 5],
    (x, y, z) => {
      const r = (x * x) / 42.25 + (z * z) / 23.04;
      if (r > 1 || y > 7.2 || y < -6.2) return false;
      if (y > 1 && r + (y - 1) ** 2 / 38.4 > 1) return false;
      if (y < -3.7 && Math.floor((x + 6.5) / 2.2) % 2 === 1) return false;
      return true;
    },
    "#e71637",
    0.67,
    0.64,
  );
  for (const side of [-1, 1]) {
    voxelEllipsoid(
      root,
      [side * 2.5, 1, 4.25],
      [1.85, 2.45, 0.95],
      "#dfebf3",
      0.43,
      0.065,
    );
    voxelEllipsoid(
      root,
      [side * 2.5 + 0.48, 0.75, 5.02],
      [0.8, 1.2, 0.35],
      "#123aa1",
      0.34,
      0.14,
    );
  }
  root.userData.cells = collectVoxels(root);
  return root;
}

export function makeCompanion() {
  const root = new THREE.Group();
  root.name = "Pac-Man";
  const shapes = [];
  for (const angle of [0.28, 0.62]) {
    const group = new THREE.Group();
    root.add(group);
    voxelShape(
      group,
      [4.6, 4.6, 4.6],
      (x, y, z) =>
        x * x + y * y + z * z < 20.25 && !(x > 0.2 && Math.abs(y) < x * angle),
      "#ffd414",
      0.51,
      0.68,
    );
    const eye = voxelEllipsoid(
      group,
      [0.15, 2.35, 4.08],
      [0.6, 0.84, 0.36],
      "#07070c",
      0.24,
      0.0,
    );
    // A forward, ink-dark pupil remains readable inside the golden halo.
    eye.material.metalness = 0.05;
    eye.material.roughness = 0.7;
    eye.material.clearcoat = 0;
    eye.material.envMapIntensity = 0.05;
    eye.material.specularIntensity = 0.1;
    shapes.push(group);
  }
  root.userData.frames = shapes;
  return root;
}

export function makeDrake() {
  const root = new THREE.Group();
  root.name = "Centipede";
  voxelEllipsoid(root, [0, 0, 0], [5.6, 4.5, 4.8], "#adcd1b", 0.69, 0.64);
  voxelEllipsoid(root, [0, -1.1, 4], [4.2, 2.1, 2.2], "#d34b19", 0.59, 0.5);
  for (const side of [-1, 1]) {
    voxelEllipsoid(
      root,
      [side * 2.5, 1.4, 4],
      [1.55, 1.9, 0.9],
      "#f7e5b7",
      0.4,
      0.06,
    );
    voxelEllipsoid(
      root,
      [side * 2.5, 1.3, 4.75],
      [0.6, 1, 0.3],
      "#161521",
      0.3,
      0.01,
    );
    for (let j = 0; j < 4; j++)
      voxelEllipsoid(
        root,
        [side * (3 + j * 0.48), 4 + j * 0.8, 0],
        [0.5, 0.75, 0.5],
        "#d63c57",
        0.42,
        0.62,
      );
  }
  return root;
}

export function makeBarrel() {
  const root = new THREE.Group();
  root.name = "Iron-banded wooden barrel";
  voxelShape(
    root,
    [5, 5, 4.7],
    (x, y, z) => {
      if (Math.abs(z) > 4.4) return false;
      const radius = 4.25 + 0.55 * Math.cos(((z / 4.4) * Math.PI) / 2);
      return x * x + y * y <= radius * radius;
    },
    (x, y, z) => {
      const radius = Math.hypot(x, y),
        hoop = Math.abs(z) > 2.45 && Math.abs(z) < 3.25;
      if (hoop && radius > 3.65) return "#384c69";
      if (Math.abs(z) > 3.9) {
        if (radius > 3.65) return "#604025";
        if (Math.abs(x - y) < 0.5 || Math.abs(x + y) < 0.5) return "#774322";
        return "#c88a42";
      }
      return ["#a36329", "#c58a3c", "#8b4c25"][
        Math.floor(((Math.atan2(y, x) + Math.PI) * 8) / Math.PI) % 3
      ];
    },
    0.63,
    0.55,
  );
  root.userData.cells = collectVoxels(root);
  return root;
}

export function makeTitan() {
  const root = new THREE.Group();
  root.name = "Donkey Kong";
  const parts = {};
  const joint = (name, parent, p) => {
    const g = new THREE.Group();
    g.position.set(...p);
    parent.add(g);
    parts[name] = g;
    return g;
  };
  const fur = "#643019",
    shadeFur = "#452114",
    skin = "#be8048",
    palm = "#b77943";
  const torso = joint("torso", root, [0, 0, 0]);
  voxelEllipsoid(torso, [0, 22, -2], [12.5, 15, 9.5], fur, 1.2, 0.82);
  voxelEllipsoid(torso, [0, 37, -3], [18, 16, 11], fur, 1.22, 0.9);
  voxelEllipsoid(torso, [0, 33, 7.2], [11.5, 13.5, 3.6], skin, 1.05, 0.5);
  const head = joint("head", torso, [0, 54, 2]);
  voxelEllipsoid(head, [0, 0, -0.8], [12, 10.5, 9.2], fur, 1.05, 0.86);
  // Heavy mask, forward muzzle, nostrils and a dark lip define the gorilla face.
  voxelEllipsoid(head, [0, 1.1, 7.1], [8.9, 6.1, 3.6], skin, 0.85, 0.4);
  voxelEllipsoid(head, [0, -4, 9.7], [10, 4.7, 5.1], skin, 0.84, 0.4);
  voxelEllipsoid(head, [0, -5.3, 14.2], [7.1, 1.6, 0.65], shadeFur, 0.55, 0.01);
  voxelEllipsoid(
    head,
    [0, -5.8, 14.55],
    [5.8, 0.45, 0.25],
    "#e3c7a0",
    0.42,
    0.045,
  );
  voxelEllipsoid(head, [0, -1.3, 13], [5.4, 2.5, 2.1], "#ad6e3f", 0.65, 0.25);
  for (const side of [-1, 1]) {
    voxelEllipsoid(
      head,
      [side * 2, -1.2, 14.8],
      [0.8, 0.65, 0.28],
      "#21140f",
      0.35,
      0,
    );
    voxelEllipsoid(
      head,
      [side * 4, 3.1, 9.7],
      [2.55, 2.1, 1.2],
      "#ede1c4",
      0.48,
      0.085,
    );
    voxelEllipsoid(
      head,
      [side * 3.7, 2.8, 10.8],
      [0.78, 1.13, 0.32],
      "#13101a",
      0.33,
      0,
    );
    voxelEllipsoid(
      head,
      [side * 4.2, 4.6, 9.5],
      [4.4, 1.9, 1.6],
      shadeFur,
      0.72,
      0.035,
    );
    voxelEllipsoid(
      head,
      [side * 11.4, 0, 1],
      [2.4, 3.1, 1.65],
      skin,
      0.67,
      0.34,
    );
    const arm = joint(side < 0 ? "leftArm" : "rightArm", torso, [
      side * 17,
      43,
      -1,
    ]);
    voxelEllipsoid(arm, [side * 2, -8, 0], [7.8, 13, 7.7], fur, 1.2, 0.86);
    voxelEllipsoid(arm, [side * 3, -22, 2], [7, 10, 7.2], fur, 1.15, 0.82);
    const hand = joint(side < 0 ? "leftHand" : "rightHand", arm, [
      side * 3,
      -30,
      4,
    ]);
    voxelEllipsoid(hand, [0, 0, 0], [7.6, 5.6, 7], palm, 1, 0.52);
    for (let f = 0; f < 4; f++)
      voxelEllipsoid(
        hand,
        [-4.8 + f * 3.1, -2.6, 5.2],
        [1.5, 3.5, 2.2],
        skin,
        0.73,
        0.48,
      );
    const leg = joint(side < 0 ? "leftLeg" : "rightLeg", torso, [
      side * 8,
      7,
      -1,
    ]);
    voxelEllipsoid(leg, [0, 0, 0], [6.5, 10, 6.8], fur, 1.1, 0.8);
    voxelEllipsoid(leg, [0, -8, 5], [6.8, 3.7, 9], palm, 1.0, 0.48);
  }
  // Red tie and simple yellow DK monogram: instantly recognizable at coaster distance.
  for (let y = 0; y < 10; y++)
    for (let x = -2; x <= 2; x++) {
      if (y > 7 && Math.abs(x) > 9 - y) continue;
      voxelEllipsoid(
        torso,
        [x * 1.1, 44 - y * 1.15, 11.5],
        [0.61, 0.64, 0.48],
        "#d31429",
        0.52,
        0.9,
      );
    }
  const letters = ["XX.X.X", "X.XXX.", "X.XXX.", "XX.X.X"];
  letters.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "X")
        voxelEllipsoid(
          torso,
          [(x - 2.5) * 0.64, 40 - y * 0.7, 12.1],
          [0.34, 0.38, 0.25],
          "#f2c334",
          0.29,
          0.28,
        );
    }),
  );
  root.userData.parts = parts;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    // Amber cores and tinted reflections keep the gorilla's brown silhouette
    // while the beveled cube faces sparkle like illuminated glass.
    mesh.material.metalness = 0.32;
    mesh.material.roughness = 0.22;
    mesh.material.clearcoat = 0.46;
    mesh.material.clearcoatRoughness = 0.22;
    mesh.material.specularColor.set("#ffd2a0");
    mesh.material.specularIntensity = 0.58;
    mesh.material.envMapIntensity = 0.4;
  });
  return root;
}
