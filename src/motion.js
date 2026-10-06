import { clamp } from "./ride.js";
import { boostPower, JUMPS } from "./story.js";

// Solve speed from changes in potential energy, then integrate dt = ds / v.
// A chain lift sets the opening pace; later hills exchange height for speed.
export function createMotionProfile(curve, samples = 3600) {
  const length = curve.getLength(),
    ds = length / samples;
  const times = new Float64Array(samples + 1);
  const speeds = new Float64Array(samples + 1);
  const heights = new Float64Array(samples + 1);
  let speed = 3.2,
    elapsed = 0;
  speeds[0] = speed;
  heights[0] = curve.getPointAt(0).y;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    heights[i] = curve.getPointAt(t).y;
    const previousSpeed = speed,
      dh = heights[i] - heights[i - 1];
    if (t < 0.012) {
      speed = 3.2 + 27.8 * Math.sin(((t / 0.012) * Math.PI) / 2);
    } else if (t < 0.166) {
      const crest = clamp((t - 0.135) / 0.031);
      speed = (38 + (18 * t) / 0.166) * (1 - 0.62 * crest * crest);
    } else {
      const boost = (t > 0.66 ? 5.4 : 0.75) + boostPower(t) * 46;
      const drag = 0.00065 * speed * speed;
      const liftFloor = t > 0.66 ? 30 : 11;
      speed = Math.sqrt(
        Math.max(
          liftFloor * liftFloor,
          speed * speed - 2 * 13.2 * dh + 2 * (boost - drag) * ds,
        ),
      );
      speed = Math.min(speed, t > 0.66 ? 113 : 88);
    }
    elapsed += ds / ((previousSpeed + speed) / 2);
    times[i] = elapsed;
    speeds[i] = speed;
  }
  const naturalDuration = elapsed;
  for (let i = 0; i <= samples; i++) times[i] /= naturalDuration;
  return {
    naturalDuration,
    length,
    progressAt(t) {
      const index = clamp(t) * samples;
      const lo = Math.min(samples - 1, Math.floor(index));
      return times[lo] + (times[lo + 1] - times[lo]) * (index - lo);
    },
    sample(progress, duration = 150) {
      const p = clamp(progress);
      let lo = 0,
        hi = samples;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= p) lo = mid;
        else hi = mid;
      }
      const blend = clamp(
        (p - times[lo]) / Math.max(1e-10, times[hi] - times[lo]),
      );
      const scale = naturalDuration / duration;
      return {
        t: (lo + blend) / samples,
        speed: (speeds[lo] * (1 - blend) + speeds[hi] * blend) * scale,
        height: heights[lo] * (1 - blend) + heights[hi] * blend,
      };
    },
  };
}

// The visible ramp's slope matches the extra upward launch velocity.
export function launchHeight(jump, motion) {
  const rampTime =
    motion.progressAt(jump.start) - motion.progressAt(jump.start - 0.004);
  const flightTime =
    motion.progressAt(jump.end) - motion.progressAt(jump.start);
  return (4 * jump.height * rampTime) / (2 * flightTime + rampTime);
}
export function railLift(route, motion) {
  for (const jump of JUMPS)
    if (route >= jump.start - 0.004 && route <= jump.start) {
      const x =
        (motion.progressAt(route) - motion.progressAt(jump.start - 0.004)) /
        (motion.progressAt(jump.start) - motion.progressAt(jump.start - 0.004));
      return launchHeight(jump, motion) * x * x;
    }
  return 0;
}

// Pure timeline pose: frame stepping, scrubbing and audio-length changes agree.
export function flightPose(route, time, duration, motion, frameAt) {
  const frame = frameAt(route);
  const position = frame.point.clone().addScaledVector(frame.normal, 3.8);
  const ramp = railLift(route, motion);
  position.y += ramp;
  let lift = ramp,
    landing = 0,
    airborne = false,
    pitch = 0;
  for (const jump of JUMPS) {
    const takeoff = motion.progressAt(jump.start) * duration;
    const touchdown = motion.progressAt(jump.end) * duration;
    if (route >= jump.start && route <= jump.end) {
      const x = clamp((time - takeoff) / (touchdown - takeoff));
      const a = frameAt(jump.start),
        b = frameAt(jump.end);
      // A ballistic arc bridges the missing track; the rails fall away underneath.
      lift =
        4 * jump.height * x * (1 - x) + launchHeight(jump, motion) * (1 - x);
      position
        .lerpVectors(a.point, b.point, x)
        .addScaledVector(frame.normal, 3.8);
      position.y += lift;
      pitch = (1 - 2 * x) * 0.09;
      airborne = true;
    }
    const age = time - touchdown;
    if (age > 0 && age < 0.8) {
      landing = Math.max(landing, Math.exp(-age * 7));
      position.addScaledVector(
        frame.normal,
        -0.7 * Math.sin(age * 22) * Math.exp(-age * 7),
      );
    }
  }
  return { position, frame, lift, landing, airborne, pitch };
}
