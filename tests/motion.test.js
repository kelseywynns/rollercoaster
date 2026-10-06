import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { trackPoints } from "../src/world.js";
import { createMotionProfile } from "../src/motion.js";

const curve = new THREE.CatmullRomCurve3(
  trackPoints.map((p) => new THREE.Vector3(...p)),
  false,
  "catmullrom",
  0.4,
);
curve.arcLengthDivisions = 4000;
curve.updateArcLengths();
const motion = createMotionProfile(curve);

test("the ride begins slowly and reserves the first major drop for the build-up", () => {
  assert.ok(motion.sample(0).speed < 4);
  const firstCrestTime = motion.progressAt(0.166) * 110;
  assert.ok(firstCrestTime > 18 && firstCrestTime < 24);
  assert.ok(motion.sample(motion.progressAt(0.155)).height > 140);
});

test("gravity accelerates the descent and reduces speed on the following climb", () => {
  const crest = motion.sample(motion.progressAt(0.166)),
    descent = motion.sample(motion.progressAt(0.234)),
    valley = motion.sample(motion.progressAt(0.47)),
    nextHill = motion.sample(motion.progressAt(0.54));
  assert.ok(descent.height < crest.height - 50);
  assert.ok(descent.speed > crest.speed * 2);
  // This entire hill is beyond the second boost, with no active power injection.
  assert.ok(nextHill.height > valley.height + 60);
  assert.ok(nextHill.speed < valley.speed * 0.8);
});

test("motion is deterministic, continuous and reaches the end for any soundtrack duration", () => {
  let previous = 0;
  for (let frame = 0; frame <= 10800; frame++) {
    const result = motion.sample(frame / 10800);
    assert.ok(Number.isFinite(result.speed) && result.speed > 0);
    assert.ok(result.t >= previous && result.t - previous < 0.002);
    previous = result.t;
  }
  assert.equal(previous, 1);
  assert.equal(motion.sample(0.5, 360).t, motion.sample(0.5, 180).t);
  assert.equal(
    motion.sample(0.5, 360).speed,
    motion.sample(0.5, 180).speed / 2,
  );
});

test("inverse route lookup keeps collision cues aligned at any duration", () => {
  for (const t of [0, 0.166, 0.222, 0.234, 0.51, 0.82, 1]) {
    assert.ok(Math.abs(motion.sample(motion.progressAt(t), 247).t - t) < 1e-8);
  }
});
