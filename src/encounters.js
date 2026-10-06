import * as THREE from "three";
import { clamp } from "./ride.js";
import { pixelGeometry, pixelMaterial } from "./materials.js";
import {
  makeSentry,
  makeCompanion,
  makeDrake,
  voxelEllipsoid,
} from "./sculpt.js";
import { CRASH, tunnelCoverage } from "./story.js";

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
          position: new THREE.Vector3(
            (x - (row.length - 1) / 2) * size,
            ((pattern.length - 1) / 2 - y) * size,
            cell === "E" ? size * 1.1 : 0,
          ),
          scale: new THREE.Vector3(
            size * 0.93,
            size * 0.93,
            size * (cell === "E" ? 0.6 : 2),
          ),
          color: palette[cell] || palette.X,
          cell,
        });
    }),
  );
  for (const key of Object.keys(palette)) {
    const matching = cells.filter((c) => c.cell === key);
    const material = pixelMaterial(
      palette[key],
      key === "E" ? 1.65 : key === "K" ? 0.1 : 0.85,
    );
    const mesh = new THREE.InstancedMesh(
      pixelGeometry,
      material,
      matching.length,
    );
    matching.forEach((cell, i) => {
      dummy.position.copy(cell.position);
      dummy.scale.copy(cell.scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    group.add(mesh);
  }
  group.userData.cells = cells;
  return group;
}

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
  constructor(scene, { frameAt, motion }) {
    this.frameAt = frameAt;
    this.motion = motion;
    const portal = frameAt(CRASH.targetT);
    this.impact = portal.point
      .clone()
      .addScaledVector(portal.right, CRASH.side)
      .addScaledVector(portal.normal, CRASH.height);
    const crashCamera = frameAt(CRASH.cameraT);
    const pose = new THREE.Object3D();
    pose.position.copy(this.impact);
    pose.lookAt(
      crashCamera.point.clone().addScaledVector(crashCamera.normal, 3.8),
    );
    pose.rotateZ(-0.32);
    this.crashRotation = pose.quaternion.clone();
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.sentinel = makeSentry();
    this.root.add(this.sentinel);
    this.sentinelLight = new THREE.PointLight("#ff174d", 270, 50, 2);
    this.sentinelLight.position.set(0, -2, 7);
    this.sentinel.add(this.sentinelLight);
    this.companion = makeCompanion();
    this.root.add(this.companion);
    this.dragon = makeDrake();
    this.root.add(this.dragon);
    this.tail = Array.from({ length: 12 }, (_, i) => {
      const segment = new THREE.Group();
      voxelEllipsoid(
        segment,
        [0, 0, 0],
        [2.3 - i * 0.11, 2.1 - i * 0.1, 2.7],
        i % 2 ? "#638632" : "#a4b827",
        0.68,
        0.4,
      );
      voxelEllipsoid(
        segment,
        [2.6 - i * 0.09, -1.9, 0],
        [1.4, 0.45, 0.6],
        "#b93154",
        0.5,
        0.6,
      );
      this.root.add(segment);
      return segment;
    });
    this.wings = [-1, 1].map((side) => {
      const drone = sprite(
        wingPattern,
        { X: side < 0 ? "#7625ff" : "#ff7700", E: "#fff039", K: "#54214d" },
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
            color: j === 0 ? "#fff4cd" : i % 2 ? "#ff009d" : "#00ffc8",
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
    this.fragments = this.sentinel.userData.cells.map((cell, i) => {
      const angle = i * 2.39996;
      return {
        ...cell,
        origin: cell.position
          .clone()
          .applyQuaternion(this.crashRotation)
          .add(this.impact),
        velocity: new THREE.Vector3(
          Math.cos(angle) * (6 + (i % 9)),
          4 + (i % 11) * 0.9,
          Math.sin(angle) * (7 + (i % 8)),
        ),
      };
    });
    this.burst = new THREE.InstancedMesh(
      pixelGeometry,
      pixelMaterial("#ffffff", 1.15, true),
      this.fragments.length,
    );
    this.burst.frustumCulled = false;
    this.fragments.forEach((piece, i) =>
      this.burst.setColorAt(i, color.set(piece.color)),
    );
    this.root.add(this.burst);
    this.shockwave = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.12, 8),
      new THREE.MeshBasicMaterial({
        color: "#ffe1b2",
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.shockwave.position.copy(this.impact);
    this.shockwave.quaternion.copy(this.crashRotation);
    this.root.add(this.shockwave);
  }

  update({ time, progress, frame, active, calm, route, duration }) {
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
    const hello = windowEnvelope(route, 0.015, 0.13, 0.018);
    this.companion.visible = hello > 0;
    this.companion.position.copy(
      place(26, 5 + (1 - hello) * 35, 8 + Math.sin(time * 1.2) * 1.2),
    );
    face(this.companion);
    this.companion.userData.frames.forEach(
      (g, i) => (g.visible = i === Math.floor(time * 5) % 2),
    );
    this.companion.rotation.z += Math.sin(time * 2) * 0.12;

    // The sentinel dives into the fixed right-hand tunnel pillar, then truly fractures.
    const ambush = windowEnvelope(route, 0.137, CRASH.cameraT + 0.004, 0.012);
    this.sentinel.visible =
      route > 0.137 && time < this.motion.progressAt(CRASH.cameraT) * duration;
    this.sentinel.position.copy(
      place(
        56 - ambush * 14,
        -12 + 9 * Math.sin(time * 0.35),
        14 + (1 - ambush) * 38,
      ),
    );
    face(this.sentinel);
    this.sentinel.rotation.z += Math.sin(time * 0.9) * 0.15;
    if (route >= CRASH.startT && route < CRASH.cameraT) {
      const dive = ease(
        (route - CRASH.startT) / (CRASH.cameraT - CRASH.startT),
      );
      const from = this.frameAt(CRASH.startT);
      const startTime = this.motion.progressAt(CRASH.startT) * duration;
      const start = from.point
        .clone()
        .addScaledVector(from.tangent, 42)
        .addScaledVector(from.right, -12 + 9 * Math.sin(startTime * 0.35))
        .addScaledVector(from.normal, 14);
      this.sentinel.position
        .lerpVectors(start, this.impact, dive)
        .addScaledVector(normal, Math.sin(dive * Math.PI) * 9);
      this.sentinel.quaternion.slerp(this.crashRotation, dive);
    }

    // A segmented voxel dragon catches up from behind, pulls alongside and overtakes.
    const chase = windowEnvelope(route, 0.35, 0.468, 0.025);
    const pursuit = clamp((route - 0.35) / 0.118);
    const dragonForward = -18 + pursuit * 70;
    const shelter = tunnelCoverage(route);
    const dragonSide = 14 + 5 * Math.sin(time * 0.65) + shelter * 12;
    const dragonHeight = 12 + 4 * Math.sin(time * 0.8) + shelter * 16;
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
    const squad = windowEnvelope(route, 0.66, 0.96, 0.035);
    this.wings.forEach((drone, i) => {
      drone.visible = squad > 0;
      drone.position.copy(
        place(
          42 + i * 14 + Math.sin(time * 0.8) * 12,
          (i ? -1 : 1) * (19 + (1 - squad) * 75 + shelter * 10) +
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
      const enabled =
        i < 6 ? ambush > 0.9 && route < CRASH.startT : squad > 0.9;
      bolt.visible = enabled && flight < 0.82;
      const origin = source.position.clone().addScaledVector(normal, -2);
      const target = place(-18, (i % 2 ? -1 : 1) * (7 + (i % 3)), 4 + (i % 3));
      bolt.position.lerpVectors(origin, target, Math.min(1, flight / 0.82));
      bolt.lookAt(target);
    });
    const age = time - this.motion.progressAt(CRASH.cameraT) * duration;
    this.burst.visible = age >= 0 && age < 4;
    this.shockwave.visible = age >= 0 && age < 0.8;
    if (this.shockwave.visible) {
      this.shockwave.scale.setScalar(1 + age * 25);
      this.shockwave.material.opacity = (1 - age / 0.8) * 0.55;
    }
    if (this.burst.visible) {
      this.fragments.forEach((piece, i) => {
        dummy.position.copy(piece.origin).addScaledVector(piece.velocity, age);
        dummy.position.y -= 4.905 * age * age;
        dummy.quaternion.copy(this.crashRotation);
        dummy.rotateX(age * (1 + (i % 3)));
        dummy.rotateY(age * (i % 2 ? -1.7 : 1.3));
        dummy.scale
          .copy(piece.scale)
          .multiplyScalar(1 - ease((age - 2.4) / 1.6));
        dummy.updateMatrix();
        this.burst.setMatrixAt(i, dummy.matrix);
      });
      this.burst.instanceMatrix.needsUpdate = true;
    }
  }
}
