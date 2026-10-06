import { clamp } from "./ride.js";

// Solve speed from changes in potential energy, then integrate dt = ds / v.
// A chain lift sets the opening pace; later hills exchange height for speed.
export function createMotionProfile(curve, samples = 3600) {
  const length = curve.getLength(),
    ds = length / samples;
  const times = new Float64Array(samples + 1);
  const speeds = new Float64Array(samples + 1);
  const heights = new Float64Array(samples + 1);
  let speed = 2.5,
    elapsed = 0;
  speeds[0] = speed;
  heights[0] = curve.getPointAt(0).y;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    heights[i] = curve.getPointAt(t).y;
    const previousSpeed = speed,
      dh = heights[i] - heights[i - 1];
    if (t < 0.012) {
      speed = 2.5 + 6.5 * Math.sin(((t / 0.012) * Math.PI) / 2);
    } else if (t < 0.166) {
      speed = 10.5 + (1.5 * t) / 0.166;
    } else {
      const boost = t > 0.66 ? 4.8 : 0.75;
      const drag = 0.00065 * speed * speed;
      const liftFloor = t > 0.66 ? 30 : 11;
      speed = Math.sqrt(
        Math.max(
          liftFloor * liftFloor,
          speed * speed - 2 * 9.81 * dh + 2 * (boost - drag) * ds,
        ),
      );
      speed = Math.min(speed, t > 0.66 ? 88 : 73);
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
    sample(progress, duration = 180) {
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
