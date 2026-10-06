import {
  CRASH,
  TUNNELS,
  ARENA,
  GAGS,
  BOSS_HITS,
  BARREL_HIT_FRACTIONS,
  BOOSTS,
  JUMPS,
  tunnelCoverage,
  smooth,
} from "./story.js";
import { combatEvents, shotOffsetsFor, shotFlight } from "./combat.js";

export const DEFAULT_MASTER_VOLUME = 0.7;
export const DEFAULT_EFFECTS_VOLUME = 0.85;
const TAU = Math.PI * 2;
const attack = (time, seconds = 0.002) => 1 - Math.exp(-time / seconds);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// A transparent knee preserves quiet music and individual transients. A loud
// collision never turns down the rest of the film, as whole-score normalization did.
export function limitSample(value) {
  const level = Math.abs(value);
  return level <= 0.86
    ? value
    : Math.sign(value) * (0.86 + 0.12 * (1 - Math.exp(-(level - 0.86) / 0.12)));
}

// The live WaveShaper receives audio at one-quarter gain, covering +/-4 with
// the same transfer function used by the offline export mixer.
export function makeLimiterCurve(length = 32769) {
  return Float32Array.from({ length }, (_, i) =>
    limitSample(((i / (length - 1)) * 2 - 1) * 4),
  );
}

export function effectCues(duration, motion) {
  const at = (route) => motion.progressAt(route) * duration;
  const cues = [{ type: "shatter", time: at(CRASH.cameraT), length: 1.8 }];
  cues.push({ type: "warden", time: at(ARENA.start) + 0.25, length: 1.5 });
  cues.push({ type: "warden", time: at(ARENA.chargeStart), length: 1.25 });
  cues.push({ type: "cascade", time: at(ARENA.impact), length: 3.8 });
  cues.push({
    type: "slip",
    time: at(ARENA.impact) + GAGS.bananaDelay,
    length: 0.9,
  });
  cues.push({ type: "spring", time: at(GAGS.brake), length: 0.5 });
  for (const shot of ARENA.throws) {
    cues.push({
      type: "whoosh",
      time: at(shot.release),
      length: 0.7,
      pan: shot.side,
    });
    cues.push({
      type: "drum",
      time: at(shot.pass) - 0.45,
      length: 0.9,
      pan: shot.side,
    });
  }
  for (const [i, route] of BOSS_HITS.entries()) {
    cues.push({
      type: "return",
      time: at(route) - shotFlight,
      length: 0.42,
      pan: i % 2 ? 0.25 : -0.25,
    });
    cues.push({ type: "land", time: at(route), length: 0.35, weight: 0.65 });
  }
  for (const barrel of ARENA.throws)
    for (const [i, f] of BARREL_HIT_FRACTIONS.entries()) {
      const hit =
        at(barrel.release) + (at(barrel.pass) - at(barrel.release)) * f;
      cues.push({ type: "return", time: hit - shotFlight, length: 0.42 });
      cues.push({
        type: i === 2 ? "shatter" : "tick",
        time: hit,
        length: i === 2 ? 0.8 : 0.12,
        weight: i === 2 ? 0.8 : 2.5,
        pan: barrel.side * 0.6,
      });
    }
  for (const tunnel of TUNNELS) {
    cues.push({ type: "whoosh", time: at(tunnel.start) - 0.2, length: 0.75 });
    cues.push({ type: "whoosh", time: at(tunnel.end) - 0.15, length: 0.65 });
  }
  for (let time = 0.5; time < at(0.166); time += 0.31)
    cues.push({ type: "tick", time, length: 0.07 });
  for (let time = 0; time < duration; time += 1.9 / 3) {
    const route = motion.sample(time / duration, duration).t;
    if (
      (route > 0.151 && route < CRASH.startT) ||
      (route > 0.695 && route < 0.925)
    )
      cues.push({ type: "bolt", time, length: 0.24 });
  }
  for (const route of BOOSTS)
    cues.push({
      type: "boost",
      time: at(route) - 0.38,
      length: 1.55,
      releaseIn: 0.38,
    });
  for (const jump of JUMPS) {
    cues.push({ type: "whoosh", time: at(jump.start), length: 0.55 });
    cues.push({ type: "land", time: at(jump.end), length: 0.75 });
  }
  for (const enemy of combatEvents(motion, duration)) {
    for (const [i, offset] of shotOffsetsFor(enemy).entries())
      cues.push({
        type: "return",
        time: enemy.killTime + offset - shotFlight,
        length: 0.42,
        pan: i % 2 ? 0.25 : -0.25,
      });
    cues.push({
      type: "confirm",
      time: enemy.killTime,
      length: 0.3,
      pan: enemy.side * 0.5,
    });
    cues.push({
      type: "enemy-shatter",
      time: enemy.killTime,
      length: 0.75,
      pan: enemy.side * 0.65,
    });
  }
  return cues.sort((a, b) => a.time - b.time);
}

// Procedural layers have separate envelopes: crack, mechanical body, low-end
// impulse and spatial tail. Seeded variations avoid machine-gun repetition.
export function synthesizeEffect(cue, sampleRate = 48000, variant = 0) {
  const count = Math.ceil(cue.length * sampleRate);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  let seed = (8219 + variant * 8713) | 0,
    low = 0,
    mid = 0,
    sideLow = 0;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 2147483648 - 1;
  };
  const loRate = 1 - Math.exp((-TAU * 280) / sampleRate);
  const midRate = 1 - Math.exp((-TAU * 1600) / sampleRate);
  const pitch = 0.94 + ((variant * 37) % 17) / 125;
  const basePan = cue.pan ?? Math.sin(variant * 2.4) * 0.45;
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate,
      x = t / cue.length;
    const n = noise(),
      sideNoise = noise();
    low += loRate * (n - low);
    mid += midRate * (n - mid);
    sideLow += midRate * (sideNoise - sideLow);
    const high = n - mid;
    let value = 0,
      spread = 0,
      pan = basePan;
    switch (cue.type) {
      case "return": {
        const crack = (high * 0.62 + mid * 0.24) * Math.exp(-t * 110);
        const bodyPhase = TAU * pitch * (170 * t - 90 * t * t);
        const body =
          Math.tanh(
            Math.sin(bodyPhase) * 2.2 + Math.sin(bodyPhase * 1.53) * 0.35,
          ) *
          0.27 *
          Math.exp(-t * 20);
        const sub =
          Math.sin(TAU * (53 * t + 0.5 * (1 - Math.exp(-t * 40)))) *
          0.39 *
          Math.exp(-t * 12);
        const metal =
          Math.sin(TAU * pitch * (1650 * t - 900 * t * t)) *
          0.11 *
          Math.exp(-t * 48);
        const electric =
          Math.sin(TAU * pitch * (980 * t - 1050 * t * t)) *
          0.1 *
          Math.exp(-t * 15);
        const tail = Math.max(0, t - 0.026);
        value =
          (crack + body + sub + metal + electric) * attack(t, 0.0006) +
          low * 0.2 * Math.exp(-tail * 12) * attack(tail, 0.012);
        spread = sideLow * 0.11 * Math.exp(-tail * 9) * attack(tail, 0.012);
        break;
      }
      case "confirm": {
        const note = t < 0.075 ? 1046.5 : t < 0.15 ? 1568 : 2093;
        value =
          (Math.sin(TAU * note * t) + Math.sin(TAU * note * 2 * t) * 0.16) *
          0.1 *
          Math.exp(-t * 8) *
          attack(t, 0.002);
        break;
      }
      case "boost": {
        const release = cue.releaseIn ?? 0.38;
        if (t < release) {
          const q = t / release;
          value =
            (Math.sin(TAU * (95 * t + 800 * t * t)) * 0.15 +
              Math.sin(TAU * (190 * t + 1600 * t * t)) * 0.055 +
              mid * 0.11) *
            q *
            q;
          spread = sideLow * 0.12 * q * q;
        } else {
          const a = t - release;
          const thrust =
            Math.sin(TAU * (47 * a + 0.95 * (1 - Math.exp(-a * 32)))) *
            0.48 *
            Math.exp(-a * 6);
          const jet =
            (mid * 0.5 + high * 0.16) *
            Math.exp(-a * 2.7) *
            (0.82 + 0.18 * Math.sin(TAU * 42 * a));
          const zap =
            Math.sin(TAU * (500 * a + 320 * a * a)) * 0.11 * Math.exp(-a * 7);
          value = (thrust + jet + zap) * attack(a, 0.001);
          spread = sideLow * 0.3 * Math.exp(-a * 2.5) * attack(a, 0.003);
        }
        pan = 0;
        break;
      }
      case "land": {
        const weight = cue.weight ?? 1;
        const slam =
          Math.sin(TAU * (42 * t + 0.72 * (1 - Math.exp(-t * 34)))) *
          0.61 *
          Math.exp(-t * 8.5);
        const chassis =
          (Math.sin(TAU * 133 * t) * 0.17 + mid * 0.32 + high * 0.13) *
          Math.exp(-t * 27);
        const rattle = Math.max(0, t - 0.085);
        value =
          (slam + chassis) * attack(t, 0.0009) * weight +
          mid * 0.11 * Math.exp(-rattle * 15) * attack(rattle, 0.005) * weight;
        spread = sideLow * 0.1 * Math.exp(-t * 15) * attack(t, 0.003);
        pan = 0;
        break;
      }
      case "tick":
        value =
          (high * 0.058 * Math.exp(-t * 115) +
            Math.sin(TAU * 510 * t) * 0.075 * Math.exp(-t * 55) +
            Math.sin(TAU * 1270 * t) * 0.027 * Math.exp(-t * 80)) *
          attack(t, 0.0005) *
          (cue.weight ?? 1);
        break;
      case "bolt": {
        const env = Math.sin(Math.PI * x) ** 2;
        value =
          (Math.sin(TAU * (1700 * t - 2100 * t * t)) * 0.1 + high * 0.13) * env;
        pan = (variant % 2 ? 1 : -1) * (0.85 - x * 1.7);
        spread = sideLow * 0.06 * env;
        break;
      }
      case "whoosh": {
        const env = Math.sin(Math.PI * x) ** 2;
        value =
          (mid * 0.41 +
            low * 0.5 +
            high * 0.05 +
            Math.sin(TAU * (130 * t - 60 * t * t)) * 0.045) *
          env;
        pan = (basePan < 0 ? -1 : 1) * 0.96 * Math.tanh((0.5 - x) * 5);
        spread = sideLow * 0.18 * env;
        break;
      }
      case "warden": {
        const growl = Math.sin(TAU * 53 * t + Math.sin(TAU * 7.5 * t) * 0.9);
        const chest =
          Math.sin(TAU * 82 * t) * 0.55 + Math.sin(TAU * 117 * t) * 0.28;
        value =
          (Math.tanh((growl + chest) * 1.6) * 0.15 + low * 0.17) *
          Math.sin(Math.PI * x) ** 2 *
          (0.83 + 0.17 * Math.sin(TAU * 11 * t));
        spread = sideLow * 0.06 * Math.sin(Math.PI * x) ** 2;
        break;
      }
      case "drum": {
        const env = Math.sin(Math.PI * x) ** 2;
        const spin = Math.sin(TAU * (120 * t - 35 * t * t));
        value =
          (spin * 0.16 + mid * 0.34 + Math.sin(TAU * 420 * t) * 0.055) * env;
        pan = (basePan < 0 ? -1 : 1) * (x * 1.8 - 0.9);
        spread = sideLow * 0.11 * env;
        break;
      }
      case "cascade": {
        const boom =
          Math.sin(TAU * (35 * t + 1.1 * (1 - Math.exp(-t * 25)))) *
          0.7 *
          Math.exp(-t * 3.9);
        const crash = (mid * 0.62 + high * 0.25) * Math.exp(-t * 5);
        value = (boom + crash) * attack(t, 0.001);
        spread = sideLow * 0.35 * Math.exp(-t * 3) * attack(t, 0.006);
        for (let chip = 0; chip < 15; chip++) {
          const age = t - 0.1 - chip * 0.16;
          if (age > 0)
            value +=
              Math.sin(TAU * (530 + (chip % 7) * 173) * age) *
              0.038 *
              Math.exp(-age * 12) *
              attack(age, 0.003);
        }
        pan = 0;
        break;
      }
      case "shatter":
      case "enemy-shatter": {
        const weight = cue.weight ?? (cue.type === "shatter" ? 1 : 0.76);
        const punch =
          Math.sin(TAU * (58 * t + 0.62 * (1 - Math.exp(-t * 40)))) *
          0.44 *
          Math.exp(-t * 10);
        value =
          (punch +
            mid * 0.58 * Math.exp(-t * 13) +
            high * 0.24 * Math.exp(-t * 21)) *
          attack(t, 0.0007) *
          weight;
        spread = sideLow * 0.23 * Math.exp(-t * 7) * attack(t, 0.004) * weight;
        for (let n = 0; n < 6; n++) {
          const age = t - 0.025 - n * 0.033;
          if (age > 0)
            value +=
              Math.sin(TAU * (680 * 2 ** (n / 5)) * age) *
              0.045 *
              Math.exp(-age * 12) *
              attack(age, 0.002);
        }
        break;
      }
      case "slip": {
        if (t < 0.55) {
          const q = t / 0.55;
          value =
            Math.sin(
              TAU * (1450 * t - 1000 * t * t) + Math.sin(TAU * 12 * t) * 0.12,
            ) *
            0.17 *
            Math.sin(Math.PI * q) ** 0.6;
        }
        const tap = t - 0.57;
        if (tap >= 0)
          value +=
            (Math.sin(TAU * 690 * tap) * 0.28 +
              Math.sin(TAU * 1123 * tap) * 0.12 +
              high * 0.09) *
            Math.exp(-tap * 45) *
            attack(tap, 0.0007);
        pan = -0.25;
        break;
      }
      case "spring": {
        const bend =
          TAU * (850 * t - 650 * t * t) +
          Math.sin(TAU * 23 * t) * 4 * Math.exp(-t * 7);
        value =
          (Math.sin(bend) * 0.22 + Math.sin(bend * 1.71) * 0.08) *
            Math.exp(-t * 7) *
            attack(t, 0.001) +
          high * 0.22 * Math.exp(-t * 125) * attack(t, 0.0004);
        pan = 0.1 + x * 0.8;
        break;
      }
    }
    const fade = Math.min(1, (cue.length - t) / 0.012);
    left[i] = (value * Math.sqrt((1 - clamp(pan, -1, 1)) / 2) + spread) * fade;
    right[i] = (value * Math.sqrt((1 + clamp(pan, -1, 1)) / 2) - spread) * fade;
  }
  return [left, right];
}

// One seeded stereo score serves live playback, seeking and exact-frame export.
export function synthesizeEffects(duration, motion, sampleRate = 48000) {
  const count = Math.ceil(duration * sampleRate);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  let seed = 8219,
    low = 0,
    air = 0,
    other = 0,
    rush = 0,
    inside = 0;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 2147483648 - 1;
  };
  const lowRate = 1 - Math.exp((-TAU * 110) / sampleRate);
  const airRate = 1 - Math.exp((-TAU * 1600) / sampleRate);
  for (let i = 0; i < count; i++) {
    const time = i / sampleRate;
    if (i % 512 === 0) {
      const state = motion.sample(time / duration, duration);
      rush = Math.min(1.35, state.speed / 135);
      inside = tunnelCoverage(state.t);
    }
    low += lowRate * (noise() - low);
    air += airRate * (noise() - air);
    other += airRate * (noise() - other);
    const wind = 0.009 + rush ** 1.6 * 0.12;
    const fade = smooth(time / 0.7) * smooth((duration - time) / 1.4);
    const roll =
      (Math.sin(TAU * (41 + inside * 12) * time) +
        Math.sin(TAU * 79 * time) * 0.25) *
      (0.002 + rush * 0.005 + inside * 0.006);
    left[i] = (low * wind * 1.5 + air * wind * 0.5 + roll) * fade;
    right[i] = (low * wind * 1.5 + other * wind * 0.5 + roll) * fade;
  }
  const cues = effectCues(duration, motion);
  cues.forEach((cue, index) => {
    const offset = Math.round(cue.time * sampleRate);
    const channels = synthesizeEffect(cue, sampleRate, index);
    for (
      let i = Math.max(0, -offset);
      i < channels[0].length && offset + i < count;
      i++
    ) {
      const fade = smooth((duration - (offset + i) / sampleRate) / 0.65);
      left[offset + i] += channels[0][i] * fade;
      right[offset + i] += channels[1][i] * fade;
    }
  });
  return { channels: [left, right], sampleRate, cues };
}

export function mixChannels(
  music,
  effects,
  {
    musicGain = 1,
    effectsGain = DEFAULT_EFFECTS_VOLUME * DEFAULT_MASTER_VOLUME,
  } = {},
) {
  return effects.map((channel, c) => {
    const result = new Float32Array(channel.length);
    const source = music[Math.min(c, music.length - 1)];
    for (let i = 0; i < result.length; i++)
      result[i] = limitSample(
        (source?.[i] || 0) * musicGain + channel[i] * effectsGain,
      );
    return result;
  });
}
