const midi = (note) => 440 * 2 ** ((note - 69) / 12);

export class Soundtrack {
  constructor() {
    this.volume = 0.5;
    this.muted = false;
    this.file = null;
    this.url = null;
    this.element = new Audio();
    this.element.preload = "auto";
    this.active = false;
    this.lastBeat = -1;
  }

  async init() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.master.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.mediaSource = this.context.createMediaElementSource(this.element);
      this.mediaSource.connect(this.master);
      this.delay = this.context.createDelay(1);
      this.delay.delayTime.value = 0.375;
      this.feedback = this.context.createGain();
      this.feedback.gain.value = 0.24;
      this.wet = this.context.createGain();
      this.wet.gain.value = 0.2;
      this.delay.connect(this.feedback);
      this.feedback.connect(this.delay);
      this.delay.connect(this.wet);
      this.wet.connect(this.master);
    }
    if (this.context.state !== "running") await this.context.resume();
  }

  async load(file) {
    const candidate = URL.createObjectURL(file);
    const probe = new Audio();
    probe.preload = "metadata";
    probe.src = candidate;
    try {
      await new Promise((resolve, reject) => {
        probe.onloadedmetadata = () =>
          Number.isFinite(probe.duration) && probe.duration > 0
            ? resolve()
            : reject(new Error("This file has no playable duration."));
        probe.onerror = () =>
          reject(
            new Error(
              "This audio format could not be loaded. Try MP3, WAV, or M4A.",
            ),
          );
      });
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = candidate;
      this.file = file;
      this.element.src = candidate;
      return probe.duration;
    } catch (error) {
      URL.revokeObjectURL(candidate);
      throw error;
    } finally {
      probe.removeAttribute("src");
      probe.load();
    }
  }

  useDemo() {
    this.pause();
    this.file = null;
    this.element.removeAttribute("src");
    this.element.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
  async play(elapsed = 0) {
    await this.init();
    this.active = true;
    this.lastBeat = Math.floor(elapsed * 2.6667) - 1;
    if (this.file) {
      this.element.currentTime = elapsed;
      await this.element.play();
    }
  }
  pause() {
    this.active = false;
    this.element.pause();
    if (this.context?.state === "running") this.context.suspend();
  }
  stop() {
    this.pause();
    if (this.file) this.element.currentTime = 0;
    this.lastBeat = -1;
  }
  seek(seconds) {
    if (this.file) this.element.currentTime = seconds;
    this.lastBeat = Math.floor(seconds * 2.6667) - 1;
  }
  setVolume(value) {
    this.volume = value;
    this.updateGain();
  }
  toggleMute() {
    this.muted = !this.muted;
    this.updateGain();
    return this.muted;
  }
  updateGain() {
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.context.currentTime,
        0.04,
      );
  }

  tone(note, duration, volume, type = "sine") {
    const now = this.context.currentTime,
      oscillator = this.context.createOscillator(),
      gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = midi(note);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    gain.connect(this.delay);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  update(elapsed, progress) {
    if (!this.active || !this.context) return 0;
    if (!this.file) {
      const beat = Math.floor(elapsed * 2.6667);
      if (beat !== this.lastBeat) {
        this.lastBeat = beat;
        const sequence = [
          0, 7, 12, 16, 19, 16, 12, 7, 0, 7, 14, 16, 21, 19, 14, 7,
        ];
        const roots = [48, 45, 41, 43],
          root = roots[Math.floor(beat / 32) % 4];
        if (beat % (progress < 0.25 ? 2 : 1) === 0)
          this.tone(root + sequence[beat % 16] + 12, 0.7, 0.055, "triangle");
        if (beat % 8 === 0) {
          this.tone(root, 2.4, 0.11);
          this.tone(root + 7, 2.2, 0.035);
          this.tone(root + 16, 2.2, 0.025);
        }
        if (progress > 0.4 && beat % 4 === 0) this.tone(30, 0.19, 0.2);
        if (progress > 0.72 && beat % 2 === 1)
          this.tone(94, 0.05, 0.018, "triangle");
      }
    }
    this.analyser.getByteFrequencyData(this.data);
    return this.data.slice(0, 40).reduce((a, b) => a + b, 0) / (40 * 255);
  }
}
