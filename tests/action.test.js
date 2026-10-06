import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { VoxelWorld, trackPoints } from "../src/world.js";
import { createMotionProfile, flightPose } from "../src/motion.js";
import { Trackside } from "../src/trackside.js";
import { ArcadeCombat, combatEvents } from "../src/combat.js";
import { BOOSTS, JUMPS } from "../src/story.js";

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
  frameAt = (t) => world.frameAt(t);

test("nearby landmarks remain present on BOTH sides for the entire route, including gaps", () => {
  const sides = new Trackside(new THREE.Scene(), frameAt, motion.length);
  for (let i = 0; i <= 1000; i++)
    for (const side of [-1, 1]) {
      const route = i / 1000,
        f = frameAt(route);
      const nearest = sides.landmarks
        .filter((v) => v.side === side)
        .reduce((a, b) =>
          Math.abs(b.route - route) < Math.abs(a.route - route) ? b : a,
        );
      const offset = nearest.position.clone().sub(f.point);
      assert.ok(
        offset.dot(f.right) * side > 7.5,
        "Landmark must be on its intended side",
      );
      assert.ok(
        offset.length() < 11,
        "No empty stretches, even on the outer side of bends",
      );
    }
  for (const items of sides.items)
    for (const item of items) assert.ok(item.matrix.determinant() > 0);
});

test("visible boost pads produce measurable speed gain, even on climbing sections", () => {
  for (const t of BOOSTS) {
    const before = motion.sample(motion.progressAt(t)).speed;
    const after = motion.sample(motion.progressAt(t + 0.018)).speed;
    assert.ok(
      after > before + 2,
      `Boost at ${t} should add speed: ${before} to ${after}`,
    );
  }
});

test("airborne arcs bridge real rail gaps continuously and land with suspension rebound", () => {
  for (const duration of [150, 240])
    for (const jump of JUMPS) {
      const start = motion.progressAt(jump.start) * duration,
        end = motion.progressAt(jump.end) * duration;
      const poseAt = (time) =>
        flightPose(
          motion.sample(time / duration, duration).t,
          time,
          duration,
          motion,
          frameAt,
        );
      for (const t of [start, end])
        assert.ok(
          poseAt(t - 0.00001).position.distanceTo(
            poseAt(t + 0.00001).position,
          ) < 0.005,
        );
      const mid = poseAt((start + end) / 2);
      assert.ok(
        mid.airborne && mid.lift >= jump.height && mid.lift < jump.height + 3,
      );
      assert.ok(poseAt(end + 0.08).landing > 0.4);
      assert.equal(poseAt(end + 1).landing, 0);
    }
});

test("combat kills persist, replay exactly after seeks, and never create singular fragments", () => {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  scene.add(camera);
  const combat = new ArcadeCombat(scene, camera, { frameAt, motion });
  const events = combatEvents(motion, 150);
  assert.ok(events.length >= 20);
  for (const event of events) {
    const update = (time) => {
      camera.position.copy(frameAt(motion.sample(time / 150).t).point);
      combat.update({ time, duration: 150, active: true, calm: false });
    };
    update(event.killTime - 0.3);
    assert.equal(combat.targets[event.id].group.visible, true);
    update(event.killTime + 0.3);
    const target = combat.targets[event.id];
    assert.equal(target.group.visible, false);
    assert.equal(target.debris.visible, true);
    const first = Array.from(target.debris.instanceMatrix.array),
      mat = new THREE.Matrix4();
    for (let i = 0; i < target.debris.count; i++) {
      target.debris.getMatrixAt(i, mat);
      assert.ok(mat.determinant() > 0);
    }
    update(event.killTime - 2);
    update(event.killTime + 0.3);
    assert.deepEqual(Array.from(target.debris.instanceMatrix.array), first);
    update(event.killTime + 3);
    assert.equal(target.debris.visible, false);
  }
});

test("all new scenery clears the complete airborne camera path by 1.5 units", () => {
  const scenery = new Trackside(new THREE.Scene(), frameAt, motion.length);
  const cells = scenery.items.flat().map((v) => ({
    position: new THREE.Vector3().setFromMatrixPosition(v.matrix),
    inverse: v.matrix.clone().invert(),
    scale: new THREE.Vector3().setFromMatrixScale(v.matrix),
  }));
  for (let i = 0; i <= 1800; i++) {
    const route = i / 1800,
      time = motion.progressAt(route) * 150;
    const p = flightPose(route, time, 150, motion, frameAt).position;
    for (const cell of cells) {
      if (cell.position.distanceToSquared(p) > 1600) continue;
      const q = p.clone().applyMatrix4(cell.inverse);
      const hit =
        Math.abs(q.x) < 0.5 + 1.5 / cell.scale.x &&
        Math.abs(q.y) < 0.5 + 1.5 / cell.scale.y &&
        Math.abs(q.z) < 0.5 + 1.5 / cell.scale.z;
      assert.equal(hit, false, `New scenery clips camera at ${route}`);
    }
  }
});
