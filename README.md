# PIXELRUSH

A first-person, automatic rollercoaster through a luminous voxel universe. A music promotion prototype by Kelsey Wynns, built with JavaScript, Three.js, Web Audio, and Vite.

**[Enter the ride](https://kelseywynns.github.io/rollercoaster/)**

The visual direction combines cinematic arcade nostalgia with original procedural scenery: floating gardens, pink voxel trees, falling water, pixel creatures, a striped sunset, and illuminated rails. All artwork is generated in code; there are no downloaded game or movie assets.

## Run locally

Requires Node.js 22.12+ or 24+.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` produces a static site in `dist/`. `npm run preview` serves that build.

## The experience

The built-in ride lasts 2:30 and progresses through four acts:

1. **The awakening** — a slow departure through floating gardens with a curious pixel companion.
2. **Neon ascent** — an accelerating chain-lift climb, cool crystalline colors, and a sentinel appearing at the crest.
3. **Pixel freefall** — gravity-driven drops, a firing sentinel, and a sentinel smashing into a tunnel pillar, bursting into its individual cubes.
4. **Hyperdrive** — a segmented voxel dragon chasing alongside the car, attacking drones, and illuminated boost gates.

Motion is integrated from gravitational potential energy, drag, lift speed, and late-ride boosters. Descents gain speed and subsequent climbs lose it. The opening spends roughly the first 39 seconds building anticipation before the first large drop. Character encounters are scripted; no shooting controls or gameplay are needed.

Three enclosed, faceted tunnels punctuate the route with alternating neon ribs. Enemy pixels have beveled edges, glossy reflections and emissive cores; the collision uses the sentinel’s actual colored cubes and a fixed obstacle. Encounters and effects follow route positions, so they stay synchronized when the soundtrack changes length.

Select a chapter on the opening screen to preview that section. Once aboard, drag to look around, scrub the timeline, or hide the controls.

| Control | Action                    |
| ------- | ------------------------- |
| Space   | Pause / resume            |
| M       | Mute / unmute             |
| F       | Fullscreen                |
| H       | Hide / show ride controls |
| Escape  | Leave the ride            |

The settings panel includes gentle motion and performance rendering. OS reduced-motion preferences enable the gentler camera by default. Small screens start in performance mode. Switching browser tabs pauses playback.

## Try an album track

Open **The soundtrack** and choose an audio file. Supported formats depend on the browser; MP3 and WAV are good starting points. The file stays on your device and is never uploaded. The track's playback time drives camera position, so pausing and seeking keep the music and visuals together. The full route is stretched across the track duration, and an analyser adds subtle audio-driven glow.

Soft wind, rail clicks, tunnel rushes, passing shots and a glassy pixel shatter sit beneath the music. **Soft sound effects** in the soundtrack panel controls their level independently, including in exported films.

The default soundtrack, **Daydream circuit**, is a simple generative ambient demo created with Web Audio oscillators. It is a placeholder for the album, not a finished production soundtrack.

For a public album campaign, the next pass should add the chosen mastered track, artist/album artwork and links, and deliberate musical cue points. Importing a file here previews it locally; it does not publish or embed that track for visitors.

## Render a video

Use the film icon in the lower-right corner. Export choices include **1920 × 1080** or **3840 × 2160**, both at **60 fps**, with a full-ride or 12-second collision-preview option. The MP4 includes H.264 video and AAC stereo audio, with the selected soundtrack and soft effects baked in and the interface excluded.

Each frame is rendered at its exact timeline position and then encoded with WebCodecs via Mediabunny. This is offline frame-by-frame rendering, not screen recording; an overloaded computer takes longer to finish rather than dropping video frames. Cinematic bloom and 4× multisampling are enabled during export. Keep the tab open until the download appears. Rendering requires browser H.264 and AAC encoding support; Chrome or Edge is recommended.

When running locally with Vite, films are automatically saved to `renders/`, which is excluded from Git. The published site offers a browser download. Uploading a private album track locally does not publish it, but an exported MP4 embeds the selected track.

## Project layout

- `src/world.js` — deterministic voxel scenery, spline track, camera, lighting, bloom.
- `src/ride.js` — playback state, timing, and chapter metadata.
- `src/motion.js` — integrated gravity, drag, chain lifts, and boosters.
- `src/encounters.js` — scripted pixel characters, pursuit, projectiles, and bursts.
- `src/story.js` — shared route markers for collision, tunnels and sound.
- `src/tunnels.js` — enclosed tunnel geometry and illuminated portals.
- `src/materials.js` — glossy, emissive pixel materials.
- `src/effects-audio.js` — seeded stereo sound design shared by playback and export.
- `src/export-video.js` — deterministic 60 fps MP4 export and offline demo audio.
- `src/render-ui.js` — render settings, progress, cancellation, and download.
- `src/audio.js` — local audio playback, analyser, generated demo soundtrack.
- `src/main.js` — interface and playback coordination.
- `src/style.css` — responsive interface.
- `tests/` — playback timing, progression, and camera/scenery clearance.

`npm test` runs the Node test suite. Scenery uses instanced meshes to keep draw calls low. Cinematic quality includes bloom; performance quality lowers rendering resolution and disables it. WebGL2 is required.

## Publishing

This project belongs to **[kelseywynns/rollercoaster](https://github.com/kelseywynns/rollercoaster)**. GitHub Actions builds, tests, and deploys `main` to GitHub Pages. Vite uses relative asset paths so the `/rollercoaster/` project URL works without a separate build configuration.

No backend, analytics, API keys, or external storage are used. Google Fonts supplies the interface typefaces, with system fallbacks if unavailable.
