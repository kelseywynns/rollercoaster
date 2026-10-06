# PIXELRUSH

A first-person, automatic rollercoaster through a luminous voxel universe. A music promotion prototype by Kelsey Wynns, built with JavaScript, Three.js, Web Audio, and Vite.

**[Enter the ride](https://kelseywynns.github.io/rollercoaster/)**

A midnight arcade world with saturated voxel characters, polished pixel edges, cobalt maze walls, marching invaders, red steel girders and wooden barrels. Character silhouettes follow their classic arcade counterparts: Pac-Man, ghosts, Space Invaders, Galaga-inspired fighters, Centipede and Donkey Kong. All models and scenery are generated in code; no game or movie assets are downloaded or bundled.

## Run locally

Requires Node.js 22.12+ or 24+.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` produces a static site in `dist/`. `npm run preview` serves that build.

## The experience

The built-in ride lasts **1:50**, with a short anticipation beat followed by four stages:

1. **Maze runner** — Pac-Man, power-pellet lanes and pursuing ghosts. The first threat arrives around 11 seconds.
2. **Invader drop** — the first major gravity drop around 21 seconds, marching Space Invaders, green bunkers, a crashing ghost and a neon tunnel.
3. **Barrel trouble** — Donkey Kong winds up and throws three wooden, iron-banded barrels in a red-girder arena. The car shoots each barrel three times, breaking it into its actual wooden pixels, and lands ten hits on Kong. Damage pips, contact chips, recoil, a crouched push-off and the final charge connect the attack to its outcome. Kong collides with an overhead beam and progressively fractures into thousands of cubes and shards.
4. **High score** — diving fighters, faster reciprocal fire, boosters, airborne gaps and a celebratory stage-clear gate. The film ends on the completed score and artist credit.

Motion integrates gravity, drag, chain-lift speed and boosters. Descents accelerate and climbs shed speed. Five visible induction strips provide real acceleration. Three gaps have raised launch ramps, ballistic flight, landing compression and rebound. Speed changes the field of view and peripheral streaks; gentle motion reduces bank, cockpit jolt, shield flashes and blur.

Continuous kerbs and reflective studs line **both sides of the entire route**, including airborne sections. Cobalt maze walls, stepped invader bunkers, red arcade steel and late-stage hangars give each section its own near-field scenery and readable sense of speed. Distant floating islands, a pixel moon and subtle aurora add depth.

Six combat waves contain **28 targets** with distinct ghost pursuit, invader marching and fighter dive patterns. Twin cockpit cannons fire bursts with visible contact and colored voxel destruction. Enemy counterfire brushes the cockpit shield. The arena uses the same firing system for barrel interceptions and Kong hits; its guns hold their aim between volleys. Three enclosed tunnels alternate with open-air action.

The ride is automatic: no gameplay controls are required. Route-based cues keep encounters synchronized when the soundtrack duration changes. The HUD fades after departure, and a single control brings it back.

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

Use the film icon in the lower-right corner. Export choices include **1920 × 1080** or **3840 × 2160**, both at **60 fps**, with a full-ride, 12-second collision-preview, arcade-arena, or boost/combat/jump preview option. The MP4 includes H.264 video and AAC stereo audio, with the selected soundtrack and soft effects baked in and the interface excluded.

Each frame is rendered at its exact timeline position and then encoded with WebCodecs via Mediabunny. This is offline frame-by-frame rendering, not screen recording; an overloaded computer takes longer to finish rather than dropping video frames. Cinematic bloom and 4× multisampling are enabled during export. Keep the tab open until the download appears. Rendering requires browser H.264 and AAC encoding support; Chrome or Edge is recommended.

When running locally with Vite, films are automatically saved to `renders/`, which is excluded from Git. The published site offers a browser download. Uploading a private album track locally does not publish it, but an exported MP4 embeds the selected track.

## Project layout

- `src/world.js` — deterministic voxel scenery, spline track, camera, lighting, bloom.
- `src/ride.js` — playback state, timing, and chapter metadata.
- `src/motion.js` — integrated gravity, drag, chain lifts, and boosters.
- `src/sculpt.js` — recognizable surface-voxel arcade characters, articulated Kong and wooden barrels.
- `src/arena.js` — arcade architecture, physical near misses, light spill and progressive fracture.
- `src/trackside.js` — themed near scenery, booster pads and landing markers.
- `src/combat.js` — automatic twin cannons, enemy waves, retaliation and deterministic destruction.
- `src/stagecraft.js` — in-world chapter marquees, stage-clear score and celebration.
- `src/rush-pass.js` — restrained peripheral speed streaks, without frame history.
- `src/encounters.js` — scripted pixel characters, pursuit, projectiles, and bursts.
- `src/story.js` — shared route markers for collision, tunnels and sound.
- `src/tunnels.js` — enclosed tunnel geometry and illuminated portals.
- `src/materials.js` — glossy pixel materials, luminous seams and subtle internal grid.
- `src/effects-audio.js` — seeded stereo sound design shared by playback and export.
- `src/export-video.js` — deterministic 60 fps MP4 export and offline demo audio.
- `src/render-ui.js` — render settings, progress, cancellation, and download.
- `src/audio.js` — local audio playback, analyser, generated demo soundtrack.
- `src/main.js` — interface and playback coordination.
- `src/style.css` — responsive interface.
- `tests/` — playback timing, progression, and camera/scenery clearance, projectile interceptions, marquee clearance, impact contact and valid debris transforms.

`npm test` runs the Node test suite. Scenery uses instanced meshes to keep draw calls low. Cinematic quality includes bloom; performance quality lowers rendering resolution and disables it. WebGL2 is required.

## Publishing

This project belongs to **[kelseywynns/rollercoaster](https://github.com/kelseywynns/rollercoaster)**. GitHub Actions builds, tests, and deploys `main` to GitHub Pages. Vite uses relative asset paths so the `/rollercoaster/` project URL works without a separate build configuration.

No backend, analytics, API keys, or external storage are used. Google Fonts supplies the interface typefaces, with system fallbacks if unavailable.
