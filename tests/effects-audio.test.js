import test from "node:test";
import assert from "node:assert/strict";
import {
  effectCues,
  synthesizeEffects,
  mixChannels,
} from "../src/effects-audio.js";
import { CRASH } from "../src/story.js";

const motion = {
  progressAt: (t) => t,
  sample: (p) => ({ t: p, speed: 3 + p * 80 }),
};
test("soft effects are deterministic, stereo, and synchronized when duration changes", () => {
  const a = synthesizeEffects(12, motion, 8000),
    b = synthesizeEffects(12, motion, 8000);
  assert.deepEqual(a.channels, b.channels);
  assert.equal(a.channels[0].length, 96000);
  assert.notDeepEqual(a.channels[0], a.channels[1]);
  const square =
    a.channels[0].reduce((sum, v) => sum + v * v, 0) / a.channels[0].length;
  assert.ok(Math.sqrt(square) < 0.04, "Effects bed must remain soft");
  assert.ok(
    a.channels.every((c) =>
      c.every((v) => Number.isFinite(v) && Math.abs(v) < 0.5),
    ),
  );
  assert.equal(
    effectCues(240, motion).find((c) => c.type === "shatter").time,
    CRASH.cameraT * 240,
  );
});
test("exports honor independent effects volume and prevent audio clipping", () => {
  const music = [new Float32Array([0.7, -0.4])],
    effects = [new Float32Array([1, 1]), new Float32Array([-1, -1])];
  const muted = mixChannels(music, effects, { musicGain: 1, effectsGain: 0 });
  assert.deepEqual(muted, [music[0], music[0]]);
  const full = mixChannels(music, effects, { musicGain: 1, effectsGain: 1 });
  assert.ok(
    full.every((channel) => channel.every((v) => Math.abs(v) <= 0.981)),
  );
});
