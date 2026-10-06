import {
  CRASH,
  TUNNELS,
  ARENA,
  BOOSTS,
  JUMPS,
  tunnelCoverage,
  smooth,
} from "./story.js";

import { combatEvents, shotOffsets, shotFlight } from "./combat.js";

export function effectCues(duration, motion) {
  const at = (route) => motion.progressAt(route) * duration;
  const cues = [{ type: "shatter", time: at(CRASH.cameraT), length: 1.8 }];
  cues.push({ type: "warden", time: at(ARENA.start) + 0.6, length: 2.2 });
  cues.push({ type: "warden", time: at(ARENA.chargeStart), length: 1.4 });
  cues.push({ type: "cascade", time: at(ARENA.impact), length: 4.8 });
  for (const shot of ARENA.throws) {
    cues.push({ type: "whoosh", time: at(shot.release), length: 1.1 });
    cues.push({ type: "drum", time: at(shot.pass) - 0.45, length: 1.2 });
  }
  for (const tunnel of TUNNELS) {
    cues.push({ type: "whoosh", time: at(tunnel.start) - 0.35, length: 1.25 });
    cues.push({ type: "whoosh", time: at(tunnel.end) - 0.15, length: 0.85 });
  }
  for (let time = 1; time < at(0.166); time += 0.43)
    cues.push({ type: "tick", time, length: 0.055 });
  for (let time = 0; time < duration; time += 1.9 / 3) {
    const route = motion.sample(time / duration, duration).t;
    if (
      (route > 0.151 && route < CRASH.startT) ||
      (route > 0.695 && route < 0.925)
    )
      cues.push({ type: "bolt", time, length: 0.21 });
  }
  for (const atRoute of BOOSTS)
    cues.push({ type: "boost", time: at(atRoute), length: 1.25 });
  for (const jump of JUMPS) {
    cues.push({ type: "whoosh", time: at(jump.start), length: 0.7 });
    cues.push({ type: "land", time: at(jump.end), length: 0.7 });
  }
  for (const enemy of combatEvents(motion, duration)) {
    for (const offset of shotOffsets)
      cues.push({
        type: "return",
        time: enemy.killTime + offset - shotFlight,
        length: 0.13,
      });
    cues.push({ type: "confirm", time: enemy.killTime, length: 0.36 });
    cues.push({ type: "enemy-shatter", time: enemy.killTime, length: 0.55 });
  }
  return cues.sort((a, b) => a.time - b.time);
}

// One seeded score serves both live playback and frame-by-frame export, including seeks.
export function synthesizeEffects(duration, motion, sampleRate = 48000) {
  const count = Math.ceil(duration * sampleRate);
  const left = new Float32Array(count),
    right = new Float32Array(count);
  let seed = 8219,
    low = 0,
    air = 0,
    previous = 0,
    wind = 0.004,
    rail = 0.002,
    inside = 0;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 2147483648 - 1;
  };
  for (let i = 0; i < count; i++) {
    const time = i / sampleRate;
    if (i % 512 === 0) {
      const state = motion.sample(time / duration, duration);
      const rush = Math.min(1, state.speed / 85);
      inside = tunnelCoverage(state.t);
      wind = 0.006 + Math.pow(rush, 1.7) * 0.09;
      rail = 0.002 + rush * 0.005 + inside * 0.004;
    }
    low += 0.014 * (noise() - low);
    air += 0.18 * (noise() - air);
    const fade = smooth(time / 2) * smooth((duration - time) / 2);
    const roll = Math.sin(time * Math.PI * 2 * (43 + inside * 11)) * rail;
    const value = (low * wind * 2 + air * wind * 0.24 + roll) * fade;
    left[i] = value;
    right[i] = previous * 0.78 + value * 0.22;
    previous = value;
  }
  const cues = effectCues(duration, motion);
  cues.forEach((cue, index) => {
    const start = Math.max(0, Math.round(cue.time * sampleRate));
    const pan = cue.type === "shatter" ? 0.55 : Math.sin(index * 2.4) * 0.4;
    for (let j = 0; j < cue.length * sampleRate && start + j < count; j++) {
      const t = j / sampleRate,
        x = t / cue.length;
      let value = 0;
      if (cue.type === "return")
        value =
          Math.sin(2 * Math.PI * (1250 * t - 2800 * t * t)) *
          0.1 *
          Math.exp(-t * 28) *
          (1 - Math.exp(-t * 400));
      if (cue.type === "confirm")
        value =
          Math.sin(2 * Math.PI * (t < 0.1 ? 1046 : 1568) * t) *
          0.045 *
          Math.exp(-t * 9) *
          (1 - Math.exp(-t * 150));
      if (cue.type === "boost")
        value =
          (Math.sin(2 * Math.PI * (90 * t + 140 * t * t)) * 0.07 +
            noise() * 0.04) *
          Math.sin(Math.PI * x) ** 2;
      if (cue.type === "land")
        value =
          (Math.sin(2 * Math.PI * (65 * t - 20 * t * t)) * 0.19 +
            noise() * 0.08) *
          Math.exp(-t * 12) *
          (1 - Math.exp(-t * 250));
      if (cue.type === "tick")
        value =
          noise() * 0.038 * Math.exp(-t * 85) +
          Math.sin(t * 1100) * 0.018 * Math.exp(-t * 65);
      if (cue.type === "bolt")
        value =
          Math.sin(2 * Math.PI * (900 * t - 1550 * t * t)) *
          0.065 *
          Math.sin(Math.PI * x) ** 2 *
          Math.exp(-x * 2);
      if (cue.type === "whoosh")
        value =
          (noise() * 0.052 + Math.sin(t * 310) * 0.013) *
          Math.sin(Math.PI * x) ** 2;
      if (cue.type === "warden")
        value =
          (Math.sin(2 * Math.PI * 63 * t) +
            0.5 * Math.sin(2 * Math.PI * 94 * t)) *
          0.026 *
          Math.sin(Math.PI * x) ** 2 *
          (0.8 + 0.2 * Math.sin(t * 15));
      if (cue.type === "drum")
        value =
          (Math.sin(t * 480) * 0.035 + noise() * 0.045) *
          Math.sin(Math.PI * x) ** 2;
      if (cue.type === "cascade") {
        value = noise() * 0.18 * Math.exp(-t * 7) * (1 - Math.exp(-t * 120));
        value +=
          Math.sin(2 * Math.PI * (70 * t - 8 * t * t)) *
          0.07 *
          Math.exp(-t * 4);
        for (let chip = 0; chip < 21; chip++) {
          const age = t - chip * 0.17;
          if (age > 0)
            value +=
              Math.sin(2 * Math.PI * (620 + (chip % 7) * 185) * age) *
              0.017 *
              Math.exp(-age * 11) *
              (1 - Math.exp(-age * 130));
        }
      }
      if (cue.type === "shatter" || cue.type === "enemy-shatter") {
        value = noise() * 0.2 * Math.exp(-t * 11) * (1 - Math.exp(-t * 160));
        for (let n = 0; n < 5; n++) {
          const age = t - n * 0.045;
          if (age > 0)
            value +=
              Math.sin(2 * Math.PI * (740 * 2 ** (n / 5)) * age) *
              0.025 *
              Math.exp(-age * 5) *
              (1 - Math.exp(-age * 120));
        }
      }
      const fade = smooth((duration - (start + j) / sampleRate) / 1.5);
      left[start + j] += value * Math.sqrt((1 - pan) / 2) * fade;
      right[start + j] += value * Math.sqrt((1 + pan) / 2) * fade;
    }
  });
  return { channels: [left, right], sampleRate, cues };
}

export function mixChannels(
  music,
  effects,
  { musicGain = 1, effectsGain = 0.175 } = {},
) {
  const output = effects.map((channel, c) => {
    const result = new Float32Array(channel.length),
      source = music[Math.min(c, music.length - 1)];
    for (let i = 0; i < result.length; i++)
      result[i] = (source[i] || 0) * musicGain + channel[i] * effectsGain;
    return result;
  });
  let peak = 0;
  for (const channel of output)
    for (let i = 0; i < channel.length; i++)
      peak = Math.max(peak, Math.abs(channel[i]));
  if (peak > 0.98)
    for (const channel of output)
      for (let i = 0; i < channel.length; i++) channel[i] *= 0.98 / peak;
  return output;
}
