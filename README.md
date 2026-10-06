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

1. **The awakening** — a gentle departure through floating gardens.
2. **Neon ascent** — climbing turns and cool, crystalline colors.
3. **Pixel freefall** — steep descents through warm coral scenery.
4. **Hyperdrive** — sweeping turns and a sequence of illuminated gates.

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

The default soundtrack, **Daydream circuit**, is a simple generative ambient demo created with Web Audio oscillators. It is a placeholder for the album, not a finished production soundtrack.

For a public album campaign, the next pass should add the chosen mastered track, artist/album artwork and links, and deliberate musical cue points. Importing a file here previews it locally; it does not publish or embed that track for visitors.

## Project layout

- `src/world.js` — deterministic voxel scenery, spline track, camera, lighting, bloom.
- `src/ride.js` — playback state, timing, acceleration, chapter metadata.
- `src/audio.js` — local audio playback, analyser, generated demo soundtrack.
- `src/main.js` — interface and playback coordination.
- `src/style.css` — responsive interface.
- `tests/` — playback timing, progression, and camera/scenery clearance.

`npm test` runs the Node test suite. Scenery uses instanced meshes to keep draw calls low. Cinematic quality includes bloom; performance quality lowers rendering resolution and disables it. WebGL2 is required.

## Publishing

This project belongs to **[kelseywynns/rollercoaster](https://github.com/kelseywynns/rollercoaster)**. GitHub Actions builds, tests, and deploys `main` to GitHub Pages. Vite uses relative asset paths so the `/rollercoaster/` project URL works without a separate build configuration.

No backend, analytics, API keys, or external storage are used. Google Fonts supplies the interface typefaces, with system fallbacks if unavailable.
