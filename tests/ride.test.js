import test from "node:test";
import assert from "node:assert/strict";
import {
  RideClock,
  trackProgress,
  chapterIndex,
  formatTime,
} from "../src/ride.js";

test("a ride pauses without advancing and resumes to completion", () => {
  const ride = new RideClock(150);
  ride.start();
  ride.tick(20);
  ride.pause();
  ride.tick(80);
  assert.equal(ride.elapsed, 20);
  assert.equal(ride.state, "paused");
  ride.resume();
  ride.tick(130);
  assert.equal(ride.state, "complete");
  assert.equal(ride.progress, 1);
  ride.tick(20);
  assert.equal(ride.elapsed, 150);
  ride.stop();
  assert.equal(ride.state, "idle");
  assert.equal(ride.elapsed, 0);
});

test("chapter previews and imported audio duration share a normalized timeline", () => {
  const ride = new RideClock(247);
  ride.start();
  ride.seek(0.5);
  assert.equal(ride.elapsed, 123.5);
  assert.equal(chapterIndex(ride.progress), 2);
  ride.seek(0.75);
  assert.equal(chapterIndex(ride.progress), 3);
  ride.seek(2);
  assert.equal(ride.progress, 1);
  ride.seek(-1);
  assert.equal(ride.progress, 0);
});

test("the camera advances continuously and accelerates throughout the journey", () => {
  let previousDistance = 0,
    previousSpeed = 0;
  for (let i = 1; i <= 1000; i++) {
    const distance = trackProgress(i / 1000);
    const speed = distance - previousDistance;
    assert.ok(distance > previousDistance);
    assert.ok(speed >= previousSpeed - 1e-12);
    previousSpeed = speed;
    previousDistance = distance;
  }
  assert.equal(previousDistance, 1);
  assert.equal(trackProgress(-1), 0);
});

test("time labels handle an album track longer than the demo", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(150), "2:30");
  assert.equal(formatTime(247.9), "4:07");
  assert.equal(formatTime(-10), "0:00");
});
