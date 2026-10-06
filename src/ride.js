export const DEFAULT_DURATION = 110;

export const CHAPTERS = [
  {
    name: "Maze runner",
    tag: "FOLLOW THE POWER PELLETS",
    description: "Pac-Man leads the way.",
    color: "#9be4ce",
    start: 0,
  },
  {
    name: "Invader drop",
    tag: "THEY CAME FROM THE ARCADE",
    description: "A formation breaks. The rails fall away.",
    color: "#d2a7ff",
    start: 0.2,
  },
  {
    name: "Barrel trouble",
    tag: "DONKEY KONG IS WAITING",
    description: "Shoot the barrels. Hold your nerve.",
    color: "#ffab80",
    start: 0.53,
  },
  {
    name: "High score",
    tag: "ONE LAST CREDIT",
    description: "Break formation. Chase the light.",
    color: "#ff789f",
    start: 0.76,
  },
];

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
export function chapterIndex(progress) {
  return CHAPTERS.findLastIndex((chapter) => clamp(progress) >= chapter.start);
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
