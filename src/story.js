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
