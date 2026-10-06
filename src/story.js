// Route positions keep scenery, choreography and sound locked together when a song changes length.
export const CRASH = {
  startT: 0.205,
  cameraT: 0.222,
  targetT: 0.234,
  side: 13.5,
  height: 9,
};
export const TUNNELS = [
  { start: 0.234, end: 0.272, color: "#65fff0", accent: "#ff83c7" },
  { start: 0.47, end: 0.51, color: "#d397ff", accent: "#ffc584" },
  { start: 0.76, end: 0.82, color: "#ffb678", accent: "#72ffd9" },
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
