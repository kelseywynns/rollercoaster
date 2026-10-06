import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { VoxelWorld, trackPoints } from "../src/world.js";
import { createMotionProfile } from "../src/motion.js";
import { ArcadeArena } from "../src/arena.js";
import { ARENA } from "../src/story.js";
import { effectCues } from "../src/effects-audio.js";

const world = Object.create(VoxelWorld.prototype);
world.curve = new THREE.CatmullRomCurve3(
  trackPoints.map((p) => new THREE.Vector3(...p)),
  false,
  "catmullrom",
  0.4,
);
world.curve.arcLengthDivisions = 4000;
world.curve.updateArcLengths();
const motion = createMotionProfile(world.curve),
  scene = new THREE.Scene();
const arena = new ArcadeArena(scene, {
  frameAt: (t) => world.frameAt(t),
  motion,
});
scene.updateMatrixWorld(true);
const update = (time, duration = 150) =>
  arena.update({
    time,
    duration,
    route: motion.sample(time / duration, duration).t,
    active: true,
  });

test("the sculpted titan actually contacts the breakable overhead beam", () => {
  const inverse = arena.breakBeam.matrixWorld.clone().invert();
  const contacts = arena.impactCells.filter((cell) =>
    cell.position
      .clone()
      .applyMatrix4(inverse)
      .toArray()
      .every((value) => Math.abs(value) < 0.5),
  );
  assert.ok(contacts.length > 20);
  assert.ok(arena.impactCells.length > 5000);
  assert.ok(arena.micro.count > 10000);
});

test("all three thrown drums pass beside the coaster with clearance", () => {
  for (const projectile of arena.projectiles) {
    let nearest = Infinity;
    const release = motion.progressAt(projectile.cue.release) * 150;
    const pass = motion.progressAt(projectile.cue.pass) * 150;
    for (let time = release; time < pass + 0.6; time += 1 / 60) {
      update(time);
      const frame = world.frameAt(motion.sample(time / 150).t);
      const eye = frame.point.clone().addScaledVector(frame.normal, 3.8);
      nearest = Math.min(nearest, eye.distanceTo(projectile.group.position));
    }
    assert.ok(nearest > 9, "Drum radius plus car clearance must be maintained");
    assert.ok(nearest < 15, "Pass should still read as a close call");
  }
});

test("arena structures clear the full camera path and have no singular transforms", () => {
  const matrices = [];
  arena.structure.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
      const matrix = new THREE.Matrix4();
      if (mesh.isInstancedMesh) {
        mesh.getMatrixAt(i, matrix);
        matrix.premultiply(mesh.matrixWorld);
      } else matrix.copy(mesh.matrixWorld);
      assert.ok(
        Number.isFinite(matrix.determinant()) && matrix.determinant() > 0,
        "Zero-sized geometry corrupts normals and bloom",
      );
      const scale = new THREE.Vector3().setFromMatrixScale(matrix);
      matrices.push({ inverse: matrix.invert(), scale });
    }
  });
  for (let i = 0; i <= 120; i++) {
    const route = ARENA.start + ((ARENA.end - ARENA.start) * i) / 120;
    const frame = world.frameAt(route),
      eye = frame.point.clone().addScaledVector(frame.normal, 3.8);
    for (const { inverse, scale } of matrices) {
      const p = eye.clone().applyMatrix4(inverse);
      assert.ok(
        Math.abs(p.x) >= 0.5 + 1.5 / scale.x ||
          Math.abs(p.y) >= 0.5 + 1.5 / scale.y ||
          Math.abs(p.z) >= 0.5 + 1.5 / scale.z,
        `Arena blocks the car at ${route}`,
      );
    }
  }
});

test("the progressive breakup replays after seeking without invalid GPU transforms", () => {
  const impact = motion.progressAt(ARENA.impact) * 150;
  update(impact - 0.02);
  assert.equal(arena.boss.visible, true);
  assert.equal(arena.fragments.visible, false);
  update(impact + 0.5);
  assert.equal(arena.boss.visible, false);
  assert.equal(arena.fragments.visible, true);
  assert.equal(arena.breakBeam.visible, false);
  const snapshot = Array.from(arena.micro.instanceMatrix.array);
  update(impact + 4);
  update(impact - 10);
  update(impact + 0.5);
  assert.deepEqual(Array.from(arena.micro.instanceMatrix.array), snapshot);
  const matrix = new THREE.Matrix4();
  for (const mesh of [arena.fragments, arena.micro])
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      assert.ok(matrix.elements.every(Number.isFinite));
      assert.ok(
        matrix.determinant() > 0,
        "Hidden debris must retain valid normals",
      );
    }
  update(impact + 0.5, 150);
  const position = arena.fragments.instanceMatrix.array.slice(0, 16);
  update(((impact + 0.5) / 150) * 240, 240);
  // Destruction is timed in seconds after impact; the impact cue itself stays at its route position.
  assert.equal(
    effectCues(240, motion).find((c) => c.type === "cascade").time,
    motion.progressAt(ARENA.impact) * 240,
  );
  assert.ok(position.every(Number.isFinite));
  arena.update({ route: 0, time: 0, duration: 150, active: false });
  assert.equal(arena.warmLight.intensity, 0);
  assert.equal(arena.impactLight.intensity, 0);
  assert.ok(arena.projectiles.every((p) => p.light.intensity === 0));
});
