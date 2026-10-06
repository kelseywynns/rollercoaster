import * as THREE from "three";
import { clamp } from "./ride.js";

const box = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const color = new THREE.Color();
const ease = (value) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};
const windowEnvelope = (p, start, end, feather = 0.025) =>
  ease((p - start) / feather) * ease((end - p) / feather);

function sprite(pattern, palette, size = 1) {
  const group = new THREE.Group();
  const cells = [];
  pattern.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell !== ".")
        cells.push({
          x: (x - row.length / 2) * size,
          y: (pattern.length / 2 - y) * size,
          cell,
        });
    }),
  );
  const mesh = new THREE.InstancedMesh(
    box,
    new THREE.MeshStandardMaterial({
      roughness: 0.55,
      metalness: 0.12,
      emissive: "#30152c",
      emissiveIntensity: 0.35,
    }),
    cells.length,
  );
  cells.forEach((cell, i) => {
    dummy.position.set(cell.x, cell.y, cell.cell === "E" ? size * 1.1 : 0);
    dummy.scale.set(
      size * 0.94,
      size * 0.94,
      size * (cell.cell === "E" ? 0.6 : 2),
    );
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.set(palette[cell.cell] || palette.X));
  });
  group.add(mesh);
  return group;
}

const sentinelPattern = [
  "..X.......X..",
  ".XXX.....XXX.",
  "..XXXXXXXXX..",
  ".XXEEEEEEEXX.",
  "XXXEE.X.EEXXX",
  "XXXX..X..XXXX",
  ".XXXXXXXXXXX.",
  "..XXKKKKKXX..",
  "...XXXXXXX...",
  ".XXX.....XXX.",
  "XX.........XX",
];
const wingPattern = [
  "X...............X",
  "XX.............XX",
  "XXX...XXX.....XXX",
  ".XXX.XXXXX...XXX.",
  "..XXXXXXXXXXXXX..",
  "...XXXEXEXXXX....",
  "..XXXXXXXKXXXX...",
  ".XX...XXXXX..XX..",
  "X......XXX.....X.",
];

export class Encounters {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.sentinel = sprite(
      sentinelPattern,
      { X: "#ff526e", E: "#aaffef", K: "#451b50" },
      1.45,
    );
    this.root.add(this.sentinel);
    this.companion = sprite(
      [
        "..X...X..",
        "...XXX...",
        "..XXXXX..",
        ".XXEXEXX.",
        "..XXXXX..",
        "...X.X...",
      ],
      { X: "#ffd179", E: "#42264e" },
      0.65,
    );
    this.root.add(this.companion);
    this.dragon = sprite(
      wingPattern,
      { X: "#4bf3bb", E: "#fff6a0", K: "#235275" },
      1.2,
    );
    this.root.add(this.dragon);
    this.tail = Array.from({ length: 12 }, (_, i) => {
      const segment = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(3.6 - i * 0.16, 3.3 - i * 0.13, 4.5),
        new THREE.MeshStandardMaterial({
          color: i % 2 ? "#53dabd" : "#82f7c9",
          roughness: 0.6,
        }),
      );
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 3.7 - i * 0.14, 1.8),
        new THREE.MeshBasicMaterial({ color: "#ffb3cd" }),
      );
      fin.position.y = 2.8 - i * 0.1;
      segment.add(body, fin);
      this.root.add(segment);
      return segment;
    });
    this.wings = [-1, 1].map((side) => {
      const drone = sprite(
        wingPattern,
        { X: side < 0 ? "#ad88ff" : "#ffbe76", E: "#fff9d4", K: "#54214d" },
        0.6,
      );
      this.root.add(drone);
      return drone;
    });
    this.bolts = Array.from({ length: 12 }, (_, i) => {
      const group = new THREE.Group();
      for (let j = 0; j < 6; j++) {
        const cube = new THREE.Mesh(
          box,
          new THREE.MeshBasicMaterial({
            color: j === 0 ? "#fff4cd" : i % 2 ? "#fc67bd" : "#66ffe0",
            transparent: true,
            opacity: 1 - j * 0.13,
            toneMapped: false,
          }),
        );
        cube.scale.set(0.6 - j * 0.06, 0.6 - j * 0.06, 1.7);
        cube.position.z = -j * 1.9;
        group.add(cube);
      }
      this.root.add(group);
      return group;
    });
    this.burst = new THREE.InstancedMesh(
      box,
      new THREE.MeshBasicMaterial({
        color: "#ffd48b",
        transparent: true,
        opacity: 0.9,
      }),
      100,
    );
    this.root.add(this.burst);
  }

  update({ time, progress, frame, active, calm }) {
    this.root.visible = active;
    if (!active) return;
    const { point, tangent, right, normal } = frame;
    const place = (forward, side, height) =>
      point
        .clone()
        .addScaledVector(tangent, forward)
        .addScaledVector(right, side)
        .addScaledVector(normal, height);
    const face = (group) => group.lookAt(place(0, 0, 4));
    // A gentle companion establishes that the world is alive before danger appears.
    const hello = windowEnvelope(progress, 0.1, 0.34, 0.045);
    this.companion.visible = hello > 0;
    this.companion.position.copy(
      place(24, 11 + (1 - hello) * 45, 11 + Math.sin(time * 1.2) * 1.5),
    );
    face(this.companion);
    this.companion.rotation.z += Math.sin(time * 2) * 0.12;

    // The sentinel emerges at the first crest and fires past either side of the car.
    const ambush = windowEnvelope(progress, 0.4, 0.6, 0.04);
    this.sentinel.visible = ambush > 0;
    this.sentinel.position.copy(
      place(
        80 - ambush * 39,
        13 * Math.sin(time * 0.35),
        15 + (1 - ambush) * 55,
      ),
    );
    face(this.sentinel);
    this.sentinel.rotation.z += Math.sin(time * 0.9) * 0.15;

    // A segmented voxel dragon catches up from behind, pulls alongside and overtakes.
    const chase = windowEnvelope(progress, 0.62, 0.92, 0.05);
    const pursuit = clamp((progress - 0.62) / 0.3);
    const dragonForward = -18 + pursuit * 70;
    const dragonSide = 14 + 5 * Math.sin(time * 0.65);
    const dragonHeight = 12 + 4 * Math.sin(time * 0.8);
    this.dragon.visible = chase > 0;
    this.dragon.position.copy(
      place(dragonForward, dragonSide + (1 - chase) * 65, dragonHeight),
    );
    face(this.dragon);
    this.dragon.rotation.z += Math.sin(time * 1.7) * 0.13;
    this.tail.forEach((segment, i) => {
      segment.visible = chase > 0;
      segment.position.copy(
        place(
          dragonForward - (i + 1) * 4.1,
          dragonSide + (1 - chase) * 65 + Math.sin(time * 1.4 - i * 0.65) * 2.5,
          dragonHeight - 2 + Math.sin(time * 1.6 - i * 0.55) * 1.5,
        ),
      );
      segment.lookAt(place(dragonForward - i * 4.1, dragonSide, dragonHeight));
    });
    const squad = windowEnvelope(progress, 0.8, 0.985, 0.035);
    this.wings.forEach((drone, i) => {
      drone.visible = squad > 0;
      drone.position.copy(
        place(
          42 + i * 14 + Math.sin(time * 0.8) * 12,
          (i ? -1 : 1) * (19 + (1 - squad) * 75) +
            Math.sin(time * 1.3 + i * 2) * 5,
          13 + Math.sin(time * 1.1 + i) * 6,
        ),
      );
      face(drone);
      drone.rotation.z += Math.sin(time * 1.8 + i) * 0.25;
    });
    this.bolts.forEach((bolt, i) => {
      const period = calm ? 3.0 : 1.9;
      const flight = (time / period + i / 6) % 1;
      const source = i < 6 ? this.sentinel : this.wings[i % 2];
      const enabled = i < 6 ? ambush > 0.9 && progress > 0.45 : squad > 0.9;
      bolt.visible = enabled && flight < 0.82;
      const origin = source.position.clone().addScaledVector(normal, -2);
      const target = place(-18, (i % 2 ? -1 : 1) * (7 + (i % 3)), 4 + (i % 3));
      bolt.position.lerpVectors(origin, target, Math.min(1, flight / 0.82));
      bolt.lookAt(target);
    });
    // Confetti-like pixels scatter beside the coaster after a scripted near-miss.
    const impact = windowEnvelope(progress, 0.55, 0.58, 0.006);
    this.burst.visible = impact > 0;
    if (impact > 0)
      for (let i = 0; i < 100; i++) {
        const phase = (progress - 0.55) / 0.03;
        const angle = i * 2.39996;
        const position = place(
          14 - phase * 38,
          -12 + Math.cos(angle) * phase * (8 + (i % 17)),
          8 + Math.sin(angle) * phase * (5 + (i % 13)) - phase * phase * 12,
        );
        dummy.position.copy(position);
        dummy.rotation.set(time + i, time * 0.7, i);
        dummy.scale.setScalar(0.4 + (i % 5) * 0.15);
        dummy.updateMatrix();
        this.burst.setMatrixAt(i, dummy.matrix);
      }
    if (impact > 0) this.burst.instanceMatrix.needsUpdate = true;
  }
}
