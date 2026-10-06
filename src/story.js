// Route positions keep scenery, choreography and sound locked together when a song changes length.
export const CRASH = {
  startT: 0.205,
  cameraT: 0.222,
  targetT: 0.234,
  side: 13.5,
  height: 9,
};
export const TUNNELS = [
  { start: 0.234, end: 0.272, color: "#00f7df", accent: "#ff008c" },
  { start: 0.47, end: 0.51, color: "#9934ff", accent: "#ff9600" },
  { start: 0.76, end: 0.82, color: "#ff7000", accent: "#00ffa3" },
];
export const smooth = (x) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
export function tunnelCoverage(t) {
  return Math.max(
    ...TUNNELS.map(
      ({ start, end }) =>
        smooth((t - start) / 0.002) * smooth((end - t) / 0.002),
    ),
  );
}

export const ARENA = {
  start: 0.506,
  end: 0.65,
  chargeStart: 0.586,
  impact: 0.603,
  gantry: 0.618,
  throws: [
    { windup: 0.516, release: 0.527, pass: 0.542, side: -1 },
    { windup: 0.538, release: 0.548, pass: 0.565, side: 1 },
    { windup: 0.56, release: 0.573, pass: 0.589, side: -1 },
  ],
};

// Visible induction pads, real bursts of acceleration, and short broken-rail jumps.
export const BOOSTS = [0.281, 0.409, 0.678, 0.842, 0.925];
export const JUMPS = [
  { start: 0.321, end: 0.334, height: 6.5 },
  { start: 0.708, end: 0.723, height: 9 },
  { start: 0.869, end: 0.886, height: 11 },
];
export const inRailGap = (t) => JUMPS.some((j) => t > j.start && t < j.end);
export function boostPower(t) {
  return Math.max(
    0,
    ...BOOSTS.map((at) => {
      const x = (t - at) / 0.018;
      return x > 0 && x < 1 ? Math.sin(Math.PI * x) : 0;
    }),
  );
}
// Enemy waves leave the opening and the giant's reveal room to breathe.
export const SKIRMISHES = [
  [0.184, 0.202],
  [0.286, 0.352],
  [0.393, 0.448],
  [0.66, 0.752],
  [0.822, 0.951],
];
export const TARGETS = SKIRMISHES.flatMap(([start, end], wave) =>
  Array.from({ length: wave === 0 ? 2 : wave === 4 ? 7 : 5 }, (_, i) => ({
    spawn: start + ((end - start) * i) / (wave === 0 ? 2 : wave === 4 ? 7 : 5),
    kill:
      start +
      ((end - start) * (i + 0.9)) / (wave === 0 ? 2 : wave === 4 ? 7 : 5),
    side: i % 2 ? 1 : -1,
    wave,
    index: i,
  })),
);
