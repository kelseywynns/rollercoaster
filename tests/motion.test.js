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
  assert.ok(motion.sample(0.25).t < 0.1);
  assert.ok(motion.sample(0.4).height > 130);
});

test("gravity accelerates the descent and reduces speed on the following climb", () => {
  const crest = motion.sample(0.4),
    descent = motion.sample(0.5),
    nextHill = motion.sample(0.6);
  assert.ok(descent.height < crest.height - 50);
  assert.ok(descent.speed > crest.speed * 2);
  assert.ok(nextHill.height > descent.height + 50);
  assert.ok(nextHill.speed < descent.speed * 0.6);
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
