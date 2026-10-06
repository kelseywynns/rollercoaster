import test from "node:test";
import assert from "node:assert/strict";
import {
  effectCues,
  synthesizeEffects,
  synthesizeEffect,
  mixChannels,
  limitSample,
  makeLimiterCurve,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_EFFECTS_VOLUME,
} from "../src/effects-audio.js";
import { CRASH, ARENA, GAGS, BOOSTS } from "../src/story.js";

const motion = {
  progressAt: (t) => t,
  sample: (p) => ({ t: p, speed: 3 + p * 160 }),
};
const rms = (channel, from = 0, to = channel.length) => {
  let square = 0;
  for (let i = from; i < to; i++) square += channel[i] ** 2;
  return Math.sqrt(square / (to - from));
};

test("effects are deterministic, stereo, and synchronized when duration changes", () => {
  const a = synthesizeEffects(12, motion, 8000);
  const b = synthesizeEffects(12, motion, 8000);
  assert.deepEqual(a.channels, b.channels);
  assert.equal(a.channels[0].length, 96000);
  assert.notDeepEqual(a.channels[0], a.channels[1]);
  assert.ok(a.channels.every((c) => c.every(Number.isFinite)));
  assert.equal(
    effectCues(240, motion).find((c) => c.type === "shatter").time,
    CRASH.cameraT * 240,
  );
  assert.equal(
    effectCues(240, motion).find((c) => c.type === "slip").time,
    ARENA.impact * 240 + GAGS.bananaDelay,
  );
  for (const [i, cue] of effectCues(240, motion)
    .filter((c) => c.type === "boost")
    .entries())
    assert.ok(
      Math.abs(cue.time + cue.releaseIn - BOOSTS[i] * 240) < 1e-9,
      "Boost release must hit the physical pad after its anticipation sound",
    );
});

test("plasma cannon has a strong transient, low-frequency body, and decaying tail", () => {
  const sampleRate = 48000;
  const [shot] = synthesizeEffect({ type: "return", length: 0.42 }, sampleRate);
  const transient = shot.subarray(0, sampleRate * 0.065);
  assert.ok(
    Math.max(...transient.map(Math.abs)) > 0.55,
    "The shot must have real transient headroom rather than a tiny UI beep",
  );
  let low = 0;
  const lowBand = new Float32Array(shot.length);
  const coefficient = 1 - Math.exp((-2 * Math.PI * 180) / sampleRate);
  shot.forEach((value, i) => {
    low += coefficient * (value - low);
    lowBand[i] = low;
  });
  assert.ok(
    rms(lowBand) > rms(shot) * 0.45,
    "Cannon body must carry weight below 180Hz",
  );
  assert.ok(
    rms(shot, sampleRate * 0.2) < rms(transient) * 0.12,
    "Tail must release space for the next hit and the soundtrack",
  );
  assert.equal(shot[0], 0);
  assert.ok(Math.abs(shot.at(-1)) < 0.0001);
});

test("passbys travel across the stereo field instead of staying at a static pan", () => {
  const [left, right] = synthesizeEffect(
    { type: "whoosh", length: 0.7, pan: 1 },
    16000,
  );
  const half = left.length / 2;
  assert.ok(rms(right, 0, half) > rms(left, 0, half) * 1.2);
  assert.ok(rms(left, half) > rms(right, half) * 1.2);
});

test("mixing honors independent effects volume without normalizing the entire score", () => {
  const music = [new Float32Array([0.25, 0.9, -0.4])];
  const effects = [new Float32Array([0, 8, 0]), new Float32Array([0, -8, 0])];
  const muted = mixChannels(music, effects, { musicGain: 1, effectsGain: 0 });
  assert.equal(muted[0][0], music[0][0]);
  const full = mixChannels(music, effects, { musicGain: 1, effectsGain: 1 });
  assert.ok(
    full.every((channel) => channel.every((v) => Math.abs(v) <= 0.981)),
  );
  assert.equal(
    full[0][0],
    music[0][0],
    "A later overload must not turn down the earlier soundtrack",
  );
  assert.equal(
    full[0][2],
    music[0][2],
    "The mix should recover immediately after the overload",
  );
  assert.ok(DEFAULT_EFFECTS_VOLUME * DEFAULT_MASTER_VOLUME > 0.55);
});

test("live limiter curve matches the export transfer function and leaves headroom transparent", () => {
  const curve = makeLimiterCurve();
  for (let value = -3.9; value < 3.9; value += 0.0017) {
    const at = (value / 8 + 0.5) * (curve.length - 1);
    const lo = Math.floor(at),
      fraction = at - lo;
    const live = curve[lo] * (1 - fraction) + curve[lo + 1] * fraction;
    assert.ok(Math.abs(live - limitSample(value)) < 0.000002);
  }
  for (const value of [-0.8, -0.1, 0, 0.1, 0.8])
    assert.equal(limitSample(value), value);
});
