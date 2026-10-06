import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";

export async function makeDemoAudio(duration) {
  const context = new OfflineAudioContext(
    2,
    Math.ceil(duration * 48000),
    48000,
  );
  const master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
  const delay = context.createDelay(1),
    feedback = context.createGain(),
    wet = context.createGain();
  delay.delayTime.value = 0.375;
  feedback.gain.value = 0.24;
  wet.gain.value = 0.2;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(master);
  const tone = (note, time, length, volume, type = "sine") => {
    const end = Math.min(duration, time + length);
    if (end - time < 0.03) return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(gain);
    gain.connect(master);
    gain.connect(delay);
    oscillator.start(time);
    oscillator.stop(end);
  };
  const sequence = [0, 7, 12, 16, 19, 16, 12, 7, 0, 7, 14, 16, 21, 19, 14, 7];
  for (let beat = 0; beat / (8 / 3) < duration; beat++) {
    const time = beat / (8 / 3),
      progress = time / duration,
      root = [48, 45, 41, 43][Math.floor(beat / 32) % 4];
    if (beat % (progress < 0.25 ? 2 : 1) === 0)
      tone(root + sequence[beat % 16] + 12, time, 0.7, 0.055, "triangle");
    if (beat % 8 === 0) {
      tone(root, time, 2.4, 0.11);
      tone(root + 7, time, 2.2, 0.035);
      tone(root + 16, time, 2.2, 0.025);
    }
    if (progress > 0.4 && beat % 4 === 0) tone(30, time, 0.19, 0.2);
    if (progress > 0.72 && beat % 2 === 1)
      tone(94, time, 0.05, 0.018, "triangle");
  }
  // A short fade makes the video master end cleanly.
  master.gain.setValueAtTime(0.5, Math.max(0, duration - 2.5));
  master.gain.linearRampToValueAtTime(0, duration);
  return context.startRendering();
}

export async function renderVideo({
  world,
  duration,
  file,
  width = 1920,
  height = 1080,
  fps = 60,
  signal,
  onProgress,
  preview = false,
}) {
  if (!(await canEncodeVideo("avc", { width, height, frameRate: fps })))
    throw new Error(
      "This browser cannot encode H.264 video. Open the experience in Chrome or Edge to render.",
    );
  if (
    !(await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48000 }))
  )
    throw new Error(
      "This browser cannot encode AAC audio. Open the experience in Chrome or Edge to render.",
    );
  onProgress({ percent: 0, label: "Preparing soundtrack…" });
  let audio;
  if (file) {
    const decoder = new OfflineAudioContext(2, 48000, 48000);
    audio = await decoder.decodeAudioData(await file.arrayBuffer());
  } else audio = await makeDemoAudio(duration);
  if (signal.aborted) throw new DOMException("Render cancelled", "AbortError");

  const renderDuration = preview ? 12 : duration;
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  const video = new CanvasSource(canvas, {
    codec: "avc",
    quality: new Quality({ bitrate: height >= 2160 ? 70000000 : 24000000 }),
    latencyMode: "quality",
    keyFrameInterval: 2,
    hardwareAcceleration: "prefer-hardware",
  });
  const audioSource = new AudioBufferSource({
    codec: "aac",
    quality: new Quality({ bitrate: 256000 }),
  });
  output.addVideoTrack(video, { frameRate: fps });
  output.addAudioTrack(audioSource);
  output.setMetadataTags({
    title: "PIXELRUSH — A ride beyond reality",
    artist: "Kelsey Wynns",
    comment: "Frame-exact 1080p60 voxel ride. Three.js + WebCodecs.",
  });
  const previous = {
    ratio: world.renderer.getPixelRatio(),
    quality: world.quality || "cinematic",
    reducedMotion: world.reducedMotion,
  };
  world.exportSize = { width, height };
  world.reducedMotion = false;
  world.renderer.setPixelRatio(1);
  world.bloom.enabled = true;
  world.composer.renderTarget1.samples = 4;
  world.composer.renderTarget2.samples = 4;
  world.resize();
  world.look.set(0, 0);
  world.energy = 0;
  const samples = audio.getChannelData(0),
    frames = Math.ceil(renderDuration * fps),
    started = performance.now();
  try {
    await output.start();
    if (preview) {
      const clip = new AudioBuffer({
        length: Math.round(renderDuration * audio.sampleRate),
        sampleRate: audio.sampleRate,
        numberOfChannels: audio.numberOfChannels,
      });
      for (let c = 0; c < audio.numberOfChannels; c++)
        clip.copyToChannel(
          audio
            .getChannelData(c)
            .subarray(
              Math.floor(duration * 0.48 * audio.sampleRate),
              Math.floor(duration * 0.48 * audio.sampleRate) + clip.length,
            ),
          c,
        );
      await audioSource.add(clip);
    } else await audioSource.add(audio);
    audioSource.close();
    for (let frame = 0; frame < frames; frame++) {
      if (signal.aborted)
        throw new DOMException("Render cancelled", "AbortError");
      const timestamp = frame / fps,
        storyTime = preview ? duration * 0.48 + timestamp : timestamp;
      const offset = Math.floor(storyTime * audio.sampleRate);
      let squareSum = 0;
      for (let i = 0; i < 1024; i++)
        squareSum += (samples[offset + i] || 0) ** 2;
      const energy = Math.min(1, Math.sqrt(squareSum / 1024) * 5);
      world.render({
        time: storyTime,
        progress: Math.min(1, storyTime / duration),
        mode: "riding",
        energy,
        delta: 1 / fps,
        duration,
      });
      context.drawImage(world.renderer.domElement, 0, 0, width, height);
      if (!preview) {
        const fade = Math.max(
          0,
          1 - timestamp / 1.5,
          (timestamp - duration + 2.5) / 2.5,
        );
        if (fade > 0) {
          context.fillStyle = `rgba(10,13,27,${Math.min(1, fade)})`;
          context.fillRect(0, 0, width, height);
        }
      }
      await video.add(timestamp, 1 / fps);
      if (frame % 30 === 0) {
        const elapsed = (performance.now() - started) / 1000;
        onProgress({
          percent: Math.floor(((frame + 1) / frames) * 100),
          frame: frame + 1,
          total: frames,
          label: `Rendering frame ${(frame + 1).toLocaleString()} / ${frames.toLocaleString()}`,
          remaining:
            frame > 0 ? (elapsed / (frame + 1)) * (frames - frame - 1) : 0,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    video.close();
    onProgress({ percent: 100, label: "Finishing the MP4…" });
    await output.finalize();
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (error) {
    await output.cancel();
    throw error;
  } finally {
    world.exportSize = null;
    world.reducedMotion = previous.reducedMotion;
    world.composer.renderTarget1.samples = 0;
    world.composer.renderTarget2.samples = 0;
    world.setQuality(previous.quality);
    world.renderer.setPixelRatio(previous.ratio);
    world.resize();
  }
}
