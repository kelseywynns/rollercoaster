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

export function makeSentry() {
  const root = new THREE.Group();
  root.name = "Sculpted ruby sentinel";
  voxelEllipsoid(root, [0, 0, 0], [7.8, 5.9, 4.9], "#f90949", 0.88, 0.5);
  voxelEllipsoid(root, [0, -3.2, 3.9], [5.2, 2, 3], "#b80b58", 0.72, 0.38);
  voxelEllipsoid(root, [0, -1.9, 6.3], [3.6, 0.65, 0.8], "#170826", 0.48, 0.08);
  for (const side of [-1, 1]) {
    voxelEllipsoid(
      root,
      [side * 3, 1.1, 4.4],
      [2, 1.4, 1.2],
      "#41ffd3",
      0.5,
      1.7,
    );
    voxelEllipsoid(
      root,
      [side * 3, 1.1, 5.5],
      [0.65, 0.95, 0.4],
      "#061126",
      0.38,
      0.04,
    );
    voxelEllipsoid(
      root,
      [side * 6.7, 5.3, -0.6],
      [1.5, 3.7, 1.6],
      "#ff5721",
      0.7,
      0.55,
    );
    voxelEllipsoid(
      root,
      [side * 8.2, -0.6, -1.4],
      [3.3, 1.5, 3.1],
      "#8d1aeb",
      0.78,
      0.48,
    );
  }
  root.userData.cells = collectVoxels(root);
  return root;
}

export function makeCompanion() {
  const root = new THREE.Group();
  root.name = "Amber scout";
  voxelEllipsoid(root, [0, 0, 0], [3.5, 4.1, 3], "#ffa000", 0.52, 0.4);
  voxelEllipsoid(root, [0, -1.8, 3], [1.6, 1.2, 2.4], "#ffbb18", 0.43, 0.35);
  for (const side of [-1, 1]) {
    voxelEllipsoid(
      root,
      [side * 1.5, 1.2, 2.5],
      [1.15, 1.4, 0.85],
      "#b6fff0",
      0.36,
      1,
    );
    voxelEllipsoid(
      root,
      [side * 1.5, 1.2, 3.25],
      [0.48, 0.7, 0.3],
      "#072039",
      0.27,
      0.03,
    );
    voxelEllipsoid(
      root,
      [side * 2.3, 4.2, -0.5],
      [0.65, 1.9, 0.7],
      "#ff6220",
      0.43,
      0.5,
    );
    voxelEllipsoid(
      root,
      [side * 1.7, -4.1, 0.9],
      [0.8, 1.2, 1.5],
      "#ed7911",
      0.45,
      0.4,
    );
  }
  root.userData.cells = collectVoxels(root);
  return root;
}

export function makeDrake() {
  const root = new THREE.Group();
  root.name = "Emerald voxel drake";
  voxelEllipsoid(root, [0, 0, 0], [5.8, 3.9, 4.5], "#00dc89", 0.72, 0.42);
  voxelEllipsoid(root, [0, -0.9, 4.2], [3.8, 2.1, 3.7], "#08efb5", 0.65, 0.42);
  voxelEllipsoid(root, [0, -2.3, 5], [3.6, 0.75, 2.6], "#1c628e", 0.57, 0.25);
  for (const side of [-1, 1]) {
    voxelEllipsoid(
      root,
      [side * 3, 1.5, 3.1],
      [1.5, 1.25, 1.7],
      "#e5ff39",
      0.45,
      1.4,
    );
    voxelEllipsoid(
      root,
      [side * 3, 1.5, 4.65],
      [0.45, 0.8, 0.35],
      "#151334",
      0.32,
      0.05,
    );
    voxelEllipsoid(
      root,
      [side * 4.2, 4, -1.5],
      [1.1, 3, 1.5],
      "#ad21e8",
      0.65,
      0.55,
    );
  }
  return root;
}

export function makeTitan() {
  const root = new THREE.Group();
  root.name = "Prism Warden";
  const parts = {};
  const joint = (name, parent, position) => {
    const group = new THREE.Group();
    group.position.set(...position);
    parent.add(group);
    parts[name] = group;
    return group;
  };
  const torso = joint("torso", root, [0, 0, 0]);
  voxelEllipsoid(torso, [0, 23, -2], [12, 13, 9], "#bd4811", 1.4, 0.3);
  voxelEllipsoid(torso, [0, 37, -2], [17, 16, 10], "#d95b08", 1.4, 0.34);
  voxelEllipsoid(torso, [0, 35, 7.5], [11, 12, 4], "#ffac21", 1.15, 0.38);
  voxelEllipsoid(torso, [0, 39, 10.4], [3.4, 4.6, 1.9], "#14ffcb", 0.8, 1.6);
  const head = joint("head", torso, [0, 56, 2]);
  voxelEllipsoid(head, [0, 0, 0], [12, 10.5, 9], "#e87917", 1.15, 0.33);
  voxelEllipsoid(head, [0, -4.5, 8.2], [9.6, 4.2, 5.3], "#ffbd43", 1, 0.32);
  voxelEllipsoid(head, [0, -5.6, 12.7], [6, 0.85, 0.6], "#2a0a23", 0.65, 0.03);
  for (const side of [-1, 1]) {
    voxelEllipsoid(
      head,
      [side * 4.7, 1.4, 7.9],
      [3.1, 2.3, 1.8],
      "#00fce4",
      0.64,
      1.4,
    );
    voxelEllipsoid(
      head,
      [side * 4.7, 1.2, 9.5],
      [1.1, 1.5, 0.55],
      "#07182e",
      0.48,
      0.02,
    );
    voxelEllipsoid(
      head,
      [side * 5.2, 4.1, 8.1],
      [4.1, 1.2, 1.9],
      "#6c1b75",
      0.8,
      0.25,
    );
    voxelEllipsoid(
      head,
      [side * 10, 7, -1],
      [2.4, 6.8, 2.6],
      "#8f20de",
      0.9,
      0.55,
    );
    const arm = joint(side < 0 ? "leftArm" : "rightArm", torso, [
      side * 17,
      44,
      -1,
    ]);
    voxelEllipsoid(
      arm,
      [side * 2, -7, 0],
      [7.1, 12, 7.2],
      "#bd490b",
      1.25,
      0.35,
    );
    voxelEllipsoid(
      arm,
      [side * 3, -18, 1.5],
      [7.8, 8, 7.5],
      "#841cba",
      1.2,
      0.45,
    );
    const hand = joint(side < 0 ? "leftHand" : "rightHand", arm, [
      side * 3,
      -25,
      4,
    ]);
    voxelEllipsoid(hand, [0, 0, 0], [8, 6.5, 7.7], "#f79c1b", 1.15, 0.35);
    for (let finger = 0; finger < 4; finger++)
      voxelEllipsoid(
        hand,
        [-5.4 + finger * 3.5, -3, 5.5],
        [1.7, 4.2, 2.4],
        "#ffba31",
        0.85,
        0.35,
      );
    voxelEllipsoid(
      torso,
      [side * 8, 7, 0],
      [6.7, 10, 6.7],
      "#70219c",
      1.3,
      0.3,
    );
    voxelEllipsoid(
      torso,
      [side * 8, -1, 3.5],
      [7, 3.5, 9],
      "#ed8917",
      1.2,
      0.35,
    );
  }
  root.userData.parts = parts;
  return root;
}
