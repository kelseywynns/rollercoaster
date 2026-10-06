export const DEFAULT_DURATION = 150;

export const CHAPTERS = [
  {
    name: "The awakening",
    tag: "DRIFT INTO THE DREAM",
    description: "Floating gardens. Endless possibility.",
    color: "#9be4ce",
    start: 0,
  },
  {
    name: "Neon ascent",
    tag: "A LITTLE CLOSER TO THE STARS",
    description: "Climb above a world of electric color.",
    color: "#d2a7ff",
    start: 0.25,
  },
  {
    name: "Pixel freefall",
    tag: "LET EVERYTHING GO",
    description: "The horizon falls away. You follow.",
    color: "#ffab80",
    start: 0.5,
  },
  {
    name: "Hyperdrive",
    tag: "BECOME THE FREQUENCY",
    description: "One last rush into the infinite.",
    color: "#ff789f",
    start: 0.75,
  },
];

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
export function trackProgress(progress) {
  const p = clamp(progress);
  return 0.38 * p + 0.62 * p * p;
}
export function chapterIndex(progress) {
  return Math.min(3, Math.floor(clamp(progress) * 4));
}
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export class RideClock {
  constructor(duration = DEFAULT_DURATION) {
    this.duration = duration;
    this.elapsed = 0;
    this.state = "idle";
  }
  get progress() {
    return clamp(this.elapsed / this.duration);
  }
  start() {
    this.elapsed = 0;
    this.state = "riding";
  }
  pause() {
    if (this.state === "riding") this.state = "paused";
  }
  resume() {
    if (this.state === "paused") this.state = "riding";
  }
  stop() {
    this.elapsed = 0;
    this.state = "idle";
  }
  seek(progress) {
    this.elapsed = clamp(progress) * this.duration;
  }
  tick(delta) {
    if (this.state !== "riding") return;
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, delta));
    if (this.elapsed >= this.duration) this.state = "complete";
  }
}
