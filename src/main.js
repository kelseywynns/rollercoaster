import "./style.css";
import { VoxelWorld } from "./world.js";
import { Soundtrack } from "./audio.js";
import { installRenderUI } from "./render-ui.js";
import {
  DEFAULT_MASTER_VOLUME,
  DEFAULT_EFFECTS_VOLUME,
} from "./effects-audio.js";
import {
  CHAPTERS,
  DEFAULT_DURATION,
  RideClock,
  chapterIndex,
  formatTime,
} from "./ride.js";

const icons = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  volume:
    '<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 4-6 5H2v6h3l6 5zM16 9l6 6m0-6-6 6"/>',
  full: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  headphones:
    '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12h3v8H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm16 0h-3v8h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  back: '<path d="M19 12H4m6-6-6 6 6 6"/>',
  replay: '<path d="M4 10a8 8 0 1 1 0 5M4 3v7h7"/>',
  spark:
    '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
};
const icon = (name, extra = "") =>
  `<svg ${extra} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const equalizer =
  '<span class="equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';

document.querySelector("#app").innerHTML = `
  <main class="experience" data-mode="idle">
    <div id="world"></div>
    <div class="scene-shade"></div>
    <div class="grain" aria-hidden="true"></div>
    <header class="header">
      <a class="wordmark" href="./" aria-label="Pixelrush home"><span class="brand-icon" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>PIXELRUSH<span class="wordmark-dot">✳</span></a>
      <span class="header-caption">ONE CREDIT. ALL IN.</span>
      <nav aria-label="Main navigation"><button class="nav-link active" id="explore-button">The experience</button><button class="nav-link" id="sound-button">The soundtrack <span class="small-dot"></span></button><button class="icon-button" id="settings-button" aria-label="Experience settings">${icon("settings")}</button></nav>
    </header>

    <section class="intro" aria-labelledby="hero-title">
      <div class="eyebrow"><span class="status-dot"></span> AN AUTOMATIC ARCADE RIDE</div>
      <h1 id="hero-title">One credit.<br>Zero <span>brakes.</span></h1>
      <p>Arcade legends. Impossible drops.<br>A first-person ride through the games you remember,<br class="desktop-break"> with your soundtrack at the controls.</p>
      <div class="hero-actions"><button id="start-button" class="primary-button" disabled>Building your world <span class="loading-dots">···</span></button><span class="ride-length"><span id="duration-label">${formatTime(DEFAULT_DURATION)}</span> OF ARCADE CHAOS<br><span>Automatic ride. Cannons included.</span></span></div>
      <button id="headphone-button" class="headphone-note">${icon("headphones")} Better with headphones <span>↗</span></button>
    </section>

    <div class="world-caption"><span class="crosshair">+</span><div><span>WORLD 01</span><strong>The neon maze</strong></div><span class="world-coordinates">01 / 04<br>READY PLAYER ONE</span></div>
    <div class="live-badge"><span class="status-dot"></span> LIVE 3D WORLD <span>/</span> <span>8-BIT SOUL</span></div>

    <section class="journey" aria-label="Your journey">
      <div class="journey-heading"><span>FOUR STAGES. ONE CREDIT.</span><span class="journey-meta">FROM MAZE RUN TO BOSS FIGHT ${icon("arrow")}</span></div>
      <div class="chapter-grid">${CHAPTERS.map((c, i) => `<button class="chapter-card ${i === 0 ? "selected" : ""}" data-chapter="${i}" disabled style="--chapter-color:${c.color}" aria-label="Preview ${c.name}"><span class="chapter-number">0${i + 1}</span><div class="chapter-copy"><strong>${c.name}</strong><span>${["Follow the power pellets", "Break the formation", "Take on Donkey Kong", "Chase the high score"][i]}</span></div><span class="intensity-icon" aria-hidden="true">${Array.from({ length: 5 }, (_, n) => `<i class="${n <= i ? "lit" : ""}"></i>`).join("")}</span></button>`).join("")}</div>
    </section>

    <footer class="footer"><div class="audio-credit">${equalizer}<span id="footer-track">Daydream circuit</span><span class="credit-label">ORIGINAL DEMO SOUND</span></div><span class="footer-middle">MADE OF PIXELS. MEANT TO BE FELT.</span><div class="footer-controls"><button id="mute-button" class="icon-button" aria-label="Mute sound" title="Mute (M)">${icon("volume")}</button><span class="control-divider"></span><button id="fullscreen-button" class="icon-button" aria-label="Enter fullscreen" title="Fullscreen (F)">${icon("full")}</button></div></footer>

    <section class="ride-hud" aria-label="Ride controls" hidden>
      <div class="ride-top"><button class="secondary-button" id="exit-button">${icon("back")} Leave the ride</button><div class="ride-chapter"><span id="ride-chapter-tag"></span><strong id="ride-chapter-name"></strong></div><button class="icon-button" id="hide-hud-button" aria-label="Hide ride controls" title="Hide controls (H)">${icon("close")}</button></div>
      <div class="ride-bottom"><button id="pause-button" class="round-button" aria-label="Pause ride">${icon("pause")}</button><div class="ride-timeline"><div class="timeline-labels"><span id="ride-time">0:00</span><span id="ride-now-playing">DAYDREAM CIRCUIT</span><span id="ride-total">${formatTime(DEFAULT_DURATION)}</span></div><input id="progress" aria-label="Ride progress" type="range" min="0" max="1000" value="0" step="1" /><div class="timeline-chapters"><span>MAZE RUN</span><span>INVADERS</span><span>KONG</span><span>HIGH SCORE</span></div></div><div class="speed-stat"><strong id="speed-value">24</strong><span>KM/H</span></div></div>
      <div class="ride-hint">DRAG TO LOOK AROUND <span>·</span> SPACE TO PAUSE <span>·</span> H TO HIDE</div>
    </section>
    <button id="show-hud-button" class="secondary-button" hidden>Show controls</button>
    <div class="pause-notice" hidden><span>TAKE A BREATH</span><strong>The world can wait.</strong><button class="primary-button" id="resume-button">Keep going ${icon("play")}</button></div>

    <section class="finish-screen" hidden aria-labelledby="finish-title"><span class="eyebrow">STAGE CLEAR</span><h2 id="finish-title">Credit<br><em>complete.</em></h2><p>One more run. One more track.</p><button id="replay-button" class="primary-button">Ride it again ${icon("replay")}</button><button id="finish-home-button" class="text-button">Back to the arcade ${icon("arrow")}</button></section>
    <div id="toast" role="status" aria-live="polite"></div>
    <div id="webgl-error" hidden><h2>A world worth waiting for.</h2><p>This experience needs WebGL. Enable hardware acceleration in your browser and reload to step inside.</p><button class="primary-button" onclick="location.reload()">Try again</button></div>
  </main>

  <dialog id="sound-dialog" aria-labelledby="sound-title"><button class="dialog-close icon-button" data-close aria-label="Close soundtrack settings">${icon("close")}</button><div class="eyebrow">THE OTHER HALF OF THE EXPERIENCE</div><h2 id="sound-title">A world for<br>your sound.</h2><p>Every journey deserves a soundtrack. Try the ambient demo, or bring a song of your own.</p><button id="demo-button" class="track-option selected">${equalizer}<span><strong>Daydream circuit</strong><small>Generative ambient · Built-in demo</small></span><span class="track-check">✓</span></button><label class="upload-area" for="audio-file">${icon("upload")}<strong>Bring your own track</strong><span>Choose an MP3, WAV, OGG, or M4A</span><small>Your audio stays on this device.</small><input id="audio-file" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" /></label><div id="loaded-track" hidden><span>YOUR TRACK</span><strong id="loaded-track-name"></strong><small id="loaded-track-duration"></small></div><label class="volume-label" for="volume">Volume <span id="volume-value">${DEFAULT_MASTER_VOLUME * 100}%</span></label><input id="volume" type="range" min="0" max="100" value="${DEFAULT_MASTER_VOLUME * 100}" /><label class="volume-label" for="effects-volume">Arcade sound effects <span id="effects-volume-value">${DEFAULT_EFFECTS_VOLUME * 100}%</span></label><input id="effects-volume" type="range" min="0" max="100" value="${DEFAULT_EFFECTS_VOLUME * 100}" /><div class="sound-note">${icon("spark")} The ride follows your track’s duration. Its energy adds a subtle glow to the world.</div><button class="primary-button dialog-done" data-close>Sounds good ${icon("arrow")}</button></dialog>

  <dialog id="settings-dialog" aria-labelledby="settings-title"><button class="dialog-close icon-button" data-close aria-label="Close experience settings">${icon("close")}</button><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2 id="settings-title">Your kind<br>of escape.</h2><div class="setting-row"><div><strong>Gentle motion</strong><p>Level camera, wider turns, softer pace of change.</p></div><label class="switch"><input id="gentle-motion" type="checkbox" /><span></span><span class="sr-only">Gentle motion</span></label></div><div class="setting-row"><div><strong>Visual quality</strong><p>Find the right balance for your device.</p></div><select id="quality" aria-label="Visual quality"><option value="cinematic">Cinematic</option><option value="performance">Performance</option></select></div><div class="keyboard-guide"><span><kbd>SPACE</kbd> Pause</span><span><kbd>M</kbd> Sound</span><span><kbd>F</kbd> Fullscreen</span><span><kbd>ESC</kbd> Exit ride</span></div><button class="primary-button dialog-done" data-close>All set ${icon("arrow")}</button></dialog>
`;

const $ = (selector) => document.querySelector(selector);
const experience = $(".experience");
const ride = new RideClock();
const soundtrack = new Soundtrack();
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
$("#gentle-motion").checked = reducedMotion;
let world,
  lastTime = 0,
  animationTime = 0,
  currentChapter = -1,
  hudHidden = false,
  soundFailed = false;
let toastTimer, hudTimer;
let exporting = false;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
}

function openDialog(id) {
  if (ride.state === "riding") pauseRide();
  $(id).showModal();
}
$("#sound-button").addEventListener("click", () => openDialog("#sound-dialog"));
$("#headphone-button").addEventListener("click", () =>
  openDialog("#sound-dialog"),
);
$("#settings-button").addEventListener("click", () =>
  openDialog("#settings-dialog"),
);
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      )
        dialog.close();
    }
  }),
);

async function startRide(start = 0) {
  if (!world) return;
  ride.start();
  ride.seek(start);
  experience.dataset.mode = "riding";
  $(".ride-hud").hidden = false;
  $(".finish-screen").hidden = true;
  $(".pause-notice").hidden = true;
  hudHidden = false;
  $(".ride-hud").classList.remove("is-hidden");
  $("#show-hud-button").hidden = true;
  $("#pause-button").innerHTML = icon("pause");
  $("#pause-button").setAttribute("aria-label", "Pause ride");
  $("#ride-total").textContent = formatTime(ride.duration);
  soundFailed = false;
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => {
    if (ride.state === "riding" && !hudHidden) toggleHud();
  }, 5000);
  try {
    await soundtrack.play(ride.elapsed, ride.duration);
    if (ride.state !== "riding") soundtrack.pause();
  } catch {
    soundFailed = true;
    toast("Sound could not start. The ride will continue silently.");
  }
}
function exitRide() {
  clearTimeout(hudTimer);
  ride.stop();
  soundtrack.stop();
  experience.dataset.mode = "idle";
  $(".ride-hud").hidden = true;
  $(".finish-screen").hidden = true;
  $(".pause-notice").hidden = true;
  $("#show-hud-button").hidden = true;
  world?.look.set(0, 0);
  $("#start-button").focus();
}
function pauseRide() {
  if (ride.state === "riding") {
    ride.pause();
    soundtrack.pause();
    $(".pause-notice").hidden = false;
    $("#pause-button").innerHTML = icon("play");
    $("#pause-button").setAttribute("aria-label", "Resume ride");
  } else if (ride.state === "paused") resumeRide();
}
async function resumeRide() {
  $(".pause-notice").hidden = true;
  ride.resume();
  $("#pause-button").innerHTML = icon("pause");
  $("#pause-button").setAttribute("aria-label", "Pause ride");
  try {
    await soundtrack.play(ride.elapsed, ride.duration);
    if (ride.state !== "riding") soundtrack.pause();
    soundFailed = false;
  } catch {
    soundFailed = true;
    toast("Sound is unavailable. Continuing silently.");
  }
}
function finishRide() {
  soundtrack.stop();
  experience.dataset.mode = "complete";
  $(".ride-hud").hidden = true;
  $(".finish-screen").hidden = false;
  $("#show-hud-button").hidden = true;
  $("#replay-button").focus();
}
$("#start-button").addEventListener("click", () => startRide());
$("#replay-button").addEventListener("click", () => startRide());
$("#exit-button").addEventListener("click", exitRide);
$("#finish-home-button").addEventListener("click", exitRide);
$("#explore-button").addEventListener("click", () => {
  if (ride.state !== "idle") exitRide();
  else
    $(".intro").animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 500 });
});
$("#pause-button").addEventListener("click", pauseRide);
$("#resume-button").addEventListener("click", resumeRide);
document
  .querySelectorAll("[data-chapter]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      startRide(CHAPTERS[Number(button.dataset.chapter)].start),
    ),
  );
$("#progress").addEventListener("input", (e) => {
  const progress = Math.min(0.999, Number(e.target.value) / 1000);
  ride.seek(progress);
  soundtrack.seek(ride.elapsed);
});

function toggleHud() {
  if (!["riding", "paused"].includes(ride.state)) return;
  hudHidden = !hudHidden;
  $(".ride-hud").classList.toggle("is-hidden", hudHidden);
  $("#show-hud-button").hidden = !hudHidden;
}
$("#hide-hud-button").addEventListener("click", toggleHud);
$("#show-hud-button").addEventListener("click", toggleHud);
function toggleMute() {
  const muted = soundtrack.toggleMute();
  $("#mute-button").innerHTML = icon(muted ? "muted" : "volume");
  $("#mute-button").setAttribute(
    "aria-label",
    muted ? "Unmute sound" : "Mute sound",
  );
  $(".audio-credit").classList.toggle("muted", muted);
}
$("#mute-button").addEventListener("click", toggleMute);
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("Fullscreen is not available in this browser.");
  } catch {
    toast("Fullscreen is not available in this window.");
  }
}
$("#fullscreen-button").addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () =>
  $("#fullscreen-button").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
  ),
);
$("#effects-volume").addEventListener("input", (e) => {
  soundtrack.setEffectsVolume(Number(e.target.value) / 100);
  $("#effects-volume-value").textContent = `${e.target.value}%`;
});
$("#volume").addEventListener("input", (e) => {
  soundtrack.setVolume(Number(e.target.value) / 100);
  $("#volume-value").textContent = `${e.target.value}%`;
});
$("#quality").addEventListener("change", (e) =>
  world?.setQuality(e.target.value),
);
$("#gentle-motion").addEventListener("change", (e) => {
  if (world) world.reducedMotion = e.target.checked;
});

$("#audio-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const uploadLabel = $(".upload-area strong");
  uploadLabel.textContent = "Opening your track…";
  try {
    const duration = await soundtrack.load(file);
    ride.duration = duration;
    if (ride.state !== "idle") exitRide();
    const name = file.name.replace(/\.[^.]+$/, "");
    $("#loaded-track").hidden = false;
    $("#loaded-track-name").textContent = name;
    $("#loaded-track-duration").textContent =
      `${formatTime(duration)} · Ready for your ride`;
    $("#footer-track").textContent = name;
    $("#ride-now-playing").textContent = name.toUpperCase();
    $(".credit-label").textContent = "YOUR SOUNDTRACK";
    $("#duration-label").textContent = formatTime(duration);
    $("#demo-button").classList.remove("selected");
    toast("Your track is ready. Start the ride to hear it.");
  } catch (error) {
    toast(error.message);
  } finally {
    uploadLabel.textContent = "Bring your own track";
    e.target.value = "";
  }
});
$("#demo-button").addEventListener("click", () => {
  soundtrack.useDemo();
  ride.duration = DEFAULT_DURATION;
  if (ride.state !== "idle") exitRide();
  $("#loaded-track").hidden = true;
  $("#demo-button").classList.add("selected");
  $("#footer-track").textContent = "Daydream circuit";
  $("#ride-now-playing").textContent = "DAYDREAM CIRCUIT";
  $(".credit-label").textContent = "ORIGINAL DEMO SOUND";
  $("#duration-label").textContent = formatTime(DEFAULT_DURATION);
});

document.addEventListener("keydown", (e) => {
  if (
    document.querySelector("dialog[open]") ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)
  )
    return;
  if (e.code === "Space" && ["riding", "paused"].includes(ride.state)) {
    e.preventDefault();
    pauseRide();
  }
  if (e.key.toLowerCase() === "m") toggleMute();
  if (e.key.toLowerCase() === "f") toggleFullscreen();
  if (e.key.toLowerCase() === "h") toggleHud();
  if (e.key === "Escape" && ride.state !== "idle") exitRide();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && ride.state === "riding") pauseRide();
  lastTime = performance.now();
});
let pointerStart = null;
$("#world").addEventListener("pointerdown", (e) => {
  if (ride.state !== "riding") return;
  pointerStart = { x: e.clientX, y: e.clientY };
  $("#world").setPointerCapture(e.pointerId);
});
$("#world").addEventListener("pointermove", (e) => {
  if (pointerStart && world) {
    world.look.x = Math.max(
      -1,
      Math.min(1, (pointerStart.x - e.clientX) / 200),
    );
    world.look.y = Math.max(
      -1,
      Math.min(1, (pointerStart.y - e.clientY) / 200),
    );
  }
});
const releaseLook = () => {
  pointerStart = null;
  world?.look.set(0, 0);
};
$("#world").addEventListener("pointerup", releaseLook);
$("#world").addEventListener("pointercancel", releaseLook);

function animate(now) {
  requestAnimationFrame(animate);
  if (exporting) {
    lastTime = now;
    return;
  }
  const delta = Math.min((now - (lastTime || now)) / 1000, 0.05);
  lastTime = now;
  if (!document.hidden && ride.state !== "paused") animationTime += delta;
  const previousState = ride.state;
  // Uploaded tracks are the clock: buffering cannot make the visuals run ahead of the music.
  if (ride.state === "riding" && soundtrack.file && !soundFailed) {
    ride.elapsed = Math.min(ride.duration, soundtrack.element.currentTime);
    if (soundtrack.element.ended) ride.state = "complete";
  } else ride.tick(delta);
  if (previousState === "riding" && ride.state === "complete") finishRide();
  const energy = soundtrack.update(ride.elapsed, ride.progress);
  if (!document.hidden && world)
    world.render({
      time: ride.state === "idle" ? animationTime : ride.elapsed,
      progress: ride.progress,
      mode: ride.state,
      energy,
      gentle: $("#gentle-motion").checked,
      duration: ride.duration,
      delta,
    });
  if (ride.state === "riding" || ride.state === "paused") {
    const index = chapterIndex(ride.progress);
    if (index !== currentChapter) {
      currentChapter = index;
      $("#ride-chapter-name").textContent = CHAPTERS[index].name;
      $("#ride-chapter-tag").textContent =
        `0${index + 1} / ${CHAPTERS[index].tag}`;
    }
    $("#ride-time").textContent = formatTime(ride.elapsed);
    if (document.activeElement !== $("#progress"))
      $("#progress").value = Math.round(ride.progress * 1000);
    $("#progress").style.setProperty("--progress", `${ride.progress * 100}%`);
    const speed = world.motion.sample(ride.progress, ride.duration).speed * 3.6;
    $("#speed-value").textContent = Math.round(
      ride.state === "paused" ? 0 : speed,
    );
  }
  $(".audio-credit").classList.toggle(
    "playing",
    ride.state === "riding" && !soundtrack.muted,
  );
}

// Yield once so the shell paints before constructing the voxel scenery.
requestAnimationFrame(() =>
  setTimeout(() => {
    try {
      world = new VoxelWorld($("#world"), { reducedMotion });
      soundtrack.configureEffects(world.motion);
      // A narrow desktop panel still deserves the full radiant arcade look.
      world.setQuality("cinematic");
      $("#start-button").disabled = false;
      $("#start-button").innerHTML = `Enter the ride ${icon("arrow")}`;
      document
        .querySelectorAll("[data-chapter]")
        .forEach((button) => (button.disabled = false));
      world.renderer.domElement.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        if (ride.state === "riding") pauseRide();
        $("#webgl-error").hidden = false;
      });
      requestAnimationFrame(animate);
    } catch (error) {
      console.error("Unable to initialize the 3D world:", error);
      $("#webgl-error").hidden = false;
      $("#start-button").textContent = "3D unavailable";
    }
  }, 30),
);

// Development-only diagnostics support repeatable scene inspection without shipping test controls.
if (import.meta.env.DEV)
  window.__PIXELRUSH__ = {
    ride,
    soundtrack,
    get world() {
      return world;
    },
    startRide,
    exitRide,
  };

installRenderUI({
  getWorld: () => world,
  ride,
  soundtrack,
  pauseRide,
  setExporting: (value) => {
    exporting = value;
  },
  toast,
});
