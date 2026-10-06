import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { VoxelWorld, VoxelBatch, trackPoints } from "../src/world.js";

test("the full ride camera clears all scenery with a 1.5-unit margin", () => {
  // Build only procedural scenery data; a GPU and browser are not needed.
  const world = Object.create(VoxelWorld.prototype);
  world.scene = new THREE.Scene();
  world.solids = new VoxelBatch(world.scene);
  world.glows = new VoxelBatch(world.scene, true);
  world.curve = new THREE.CatmullRomCurve3(
    trackPoints.map((p) => new THREE.Vector3(...p)),
    false,
    "catmullrom",
    0.4,
  );
  world.curve.arcLengthDivisions = 4000;
  world.curve.updateArcLengths();
  world.makeWorld();
  for (let i = 0; i <= 1600; i++) {
    const { point, normal } = world.frameAt(i / 1600);
    point.addScaledVector(normal, 3.8);
    const hit = world.solids.items.find(
      (b) =>
        Math.abs(point.x - b.x) < b.sx / 2 + 1.5 &&
        Math.abs(point.y - b.y) < b.sy / 2 + 1.5 &&
        Math.abs(point.z - b.z) < b.sz / 2 + 1.5,
    );
    assert.equal(
      hit,
      undefined,
      `Scenery intersects camera at track progress ${i / 1600}`,
    );
  }
});
