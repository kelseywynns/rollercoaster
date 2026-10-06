import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { VoxelWorld, trackPoints } from "../src/world.js";
import { createMotionProfile } from "../src/motion.js";
import { Encounters } from "../src/encounters.js";
import { CRASH, TUNNELS } from "../src/story.js";
import { buildTunnels } from "../src/tunnels.js";

const world = Object.create(VoxelWorld.prototype);
world.curve = new THREE.CatmullRomCurve3(
  trackPoints.map((p) => new THREE.Vector3(...p)),
  false,
  "catmullrom",
  0.4,
);
world.curve.arcLengthDivisions = 4000;
world.curve.updateArcLengths();
const motion = createMotionProfile(world.curve);

test("the sentinel fractures at the fixed portal and the same pieces replay after a seek", () => {
  const encounters = new Encounters(new THREE.Scene(), {
    frameAt: (t) => world.frameAt(t),
    motion,
  });
  const duration = 150,
    impactTime = motion.progressAt(CRASH.cameraT) * duration;
  const update = (time) => {
    const route = motion.sample(time / duration, duration).t;
    encounters.update({
      time,
      progress: time / duration,
      frame: world.frameAt(route),
      active: true,
      calm: false,
      route,
      duration,
    });
  };
  update(impactTime - 0.01);
  assert.equal(encounters.sentinel.visible, true);
  assert.equal(encounters.burst.visible, false);
  assert.ok(encounters.sentinel.position.distanceTo(encounters.impact) < 0.1);
  update(impactTime);
  assert.equal(encounters.sentinel.visible, false);
  assert.equal(encounters.burst.visible, true);
  assert.equal(
    encounters.burst.count,
    encounters.sentinel.userData.cells.length,
  );
  const matrix = new THREE.Matrix4(),
    position = new THREE.Vector3();
  encounters.burst.getMatrixAt(0, matrix);
  position.setFromMatrixPosition(matrix);
  assert.ok(position.distanceTo(encounters.fragments[0].origin) < 0.001);
  update(impactTime + 0.6);
  const first = Array.from(encounters.burst.instanceMatrix.array);
  update(impactTime - 4);
  update(impactTime + 0.6);
  assert.deepEqual(Array.from(encounters.burst.instanceMatrix.array), first);
  assert.ok(first.every(Number.isFinite));
  update(impactTime + 5);
  assert.equal(encounters.burst.visible, false);
});

test("all three tunnels enclose the camera and their geometry clears the car", () => {
  const scene = new THREE.Scene();
  const tunnels = buildTunnels(scene, (t) => world.frameAt(t), motion.length);
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const tunnel of TUNNELS) {
    const middle = world.frameAt((tunnel.start + tunnel.end) / 2);
    const eye = middle.point.clone().addScaledVector(middle.normal, 3.8);
    ray.set(eye, middle.normal);
    ray.far = 20;
    assert.ok(
      ray.intersectObject(tunnels, true).length > 0,
      "Tunnel must have an actual roof",
    );
    for (let i = 0; i <= 60; i++) {
      const frame = world.frameAt(
        tunnel.start + ((tunnel.end - tunnel.start) * i) / 60,
      );
      const point = frame.point.clone().addScaledVector(frame.normal, 3.8);
      for (const axis of [frame.normal, frame.right, frame.tangent])
        for (const sign of [-1, 1]) {
          ray.set(point, axis.clone().multiplyScalar(sign));
          ray.far = 1.5;
          assert.equal(
            ray.intersectObject(tunnels, true).length,
            0,
            "Tunnel intersects the camera clearance",
          );
        }
    }
  }
});
