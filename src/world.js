import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { clamp } from "./ride.js";
import { createMotionProfile, flightPose, railLift } from "./motion.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  pixelMaterial,
  setPixelEnvironment,
  setCrystalTime,
} from "./materials.js";
import { buildTunnels } from "./tunnels.js";
import { tunnelCoverage, boostPower, inRailGap } from "./story.js";
import { Trackside } from "./trackside.js";
import { ArcadeCombat } from "./combat.js";
import { makeRushPass } from "./rush-pass.js";
import { ArcadeArena } from "./arena.js";
import { Encounters } from "./encounters.js";

const up = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
const tempColor = new THREE.Color();
const rand = (x, y = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export class VoxelBatch {
  constructor(scene, glowing = false) {
    this.scene = scene;
    this.glowing = glowing;
    this.items = [];
  }
  add(x, y, z, sx, sy, sz, color, rotation = 0) {
    this.items.push({ x, y, z, sx, sy, sz, color, rotation });
  }
  build() {
    const material = this.glowing
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.85,
          metalness: 0.06,
          flatShading: true,
        });
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      material,
      this.items.length,
    );
    this.items.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.rotation.set(0, b.rotation, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tempColor.set(b.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.scene.add(mesh);
    return mesh;
  }
}

export const trackPoints = [
  [0, 24, 130],
  [0, 24, 40],
  [8, 28, -65],
  [45, 39, -160],
  [123, 58, -260],
  [186, 85, -370],
  [190, 112, -485],
  [140, 137, -575],
  [52, 145, -660],
  [-55, 127, -730],
  [-130, 76, -810],
  [-146, 36, -940],
  [-76, 35, -1060],
  [45, 55, -1150],
  [163, 92, -1250],
  [185, 122, -1375],
  [95, 140, -1480],
  [-25, 134, -1560],
  [-105, 111, -1660],
  [-125, 64, -1800],
  [-10, 29, -1900],
  [155, 43, -1990],
  [262, 95, -2100],
  [235, 122, -2240],
  [85, 73, -2350],
  [-85, 37, -2430],
  [-194, 96, -2560],
  [-133, 167, -2680],
  [0, 115, -2780],
  [178, 42, -2890],
  [240, 65, -3020],
  [140, 125, -3140],
  [-15, 89, -3240],
  [-150, 48, -3360],
  [-100, 92, -3480],
  [0, 160, -3640],
  [0, 218, -3820],
  [0, 250, -4050],
];

export class VoxelWorld {
  constructor(container, { reducedMotion = false } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.energy = 0;
    this.look = new THREE.Vector2();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2("#080d29", 0.0008);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 2600);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.setClearColor("#030717");
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "An animated 3D voxel rollercoaster through floating islands and glowing arcade worlds",
    );
    this.curve = new THREE.CatmullRomCurve3(
      trackPoints.map((p) => new THREE.Vector3(...p)),
      false,
      "catmullrom",
      0.4,
    );
    this.curve.arcLengthDivisions = 4000;
    this.curve.updateArcLengths();
    this.length = this.curve.getLength();
    this.motion = createMotionProfile(this.curve);
    this.solids = new VoxelBatch(this.scene);
    this.glows = new VoxelBatch(this.scene, true);
    this.floaters = [];
    this.makeSky();
    this.makeLighting();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const studio = new RoomEnvironment();
    this.environment = pmrem.fromScene(studio, 0.04);
    setPixelEnvironment(this.environment.texture);
    studio.dispose();
    pmrem.dispose();
    this.makeWorld();
    this.makeTrack();
    this.trackside = new Trackside(
      this.scene,
      (t) => this.frameAt(t),
      this.length,
    );
    buildTunnels(this.scene, (t) => this.frameAt(t), this.length);
    this.makeCreatures();
    this.makeParticles();
    this.solids.build();
    this.glowMesh = this.glows.build();
    this.encounters = new Encounters(this.scene, {
      frameAt: (t) => this.frameAt(t),
      motion: this.motion,
    });
    this.arena = new ArcadeArena(this.scene, {
      frameAt: (t) => this.frameAt(t),
      motion: this.motion,
    });
    this.makeCar();
    this.combat = new ArcadeCombat(this.scene, this.camera, {
      frameAt: (t) => this.frameAt(t),
      motion: this.motion,
    });
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.5, 0.6);
    this.composer.addPass(this.bloom);
    this.rushPass = makeRushPass();
    this.composer.addPass(this.rushPass);
    this.composer.addPass(new OutputPass());
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  makeLighting() {
    this.scene.add(new THREE.HemisphereLight("#819dff", "#250643", 0.85));
    const moonlight = new THREE.DirectionalLight("#adc9ff", 1.8);
    moonlight.position.set(300, 430, -400);
    this.scene.add(moonlight);
    const rim = new THREE.DirectionalLight("#ff137f", 1.35);
    rim.position.set(-200, 120, 100);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight("#44aaff", 0.95);
    fill.position.set(20, 190, 280);
    this.scene.add(fill);
  }

  makeCar() {
    this.scene.add(this.camera);
    this.car = new THREE.Group();
    this.camera.add(this.car);
    this.headlight = new THREE.PointLight("#28bfff", 55, 45, 2);
    this.headlight.position.set(0, 3, -10);
    this.camera.add(this.headlight);
    const navy = new THREE.MeshStandardMaterial({
      color: "#172e43",
      roughness: 0.4,
      metalness: 0.4,
    });
    const mint = new THREE.MeshStandardMaterial({
      color: "#00cdb9",
      roughness: 0.35,
      metalness: 0.3,
    });
    const coral = new THREE.MeshBasicMaterial({ color: "#ff378d" });
    const add = (x, y, z, w, h, d, mat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      this.car.add(mesh);
    };
    add(0, -2.2, -3.9, 4.5, 0.65, 0.6, navy);
    add(0, -1.85, -3.9, 4.6, 0.12, 0.65, mint);
    add(0, -1.91, -3.54, 4.2, 0.08, 0.06, coral);
    for (const side of [-1, 1]) {
      add(side * 2.18, -1.95, -2.7, 0.28, 0.8, 2.8, navy);
      add(side * 2.18, -1.51, -2.7, 0.32, 0.08, 2.8, mint);
      add(side * 1.4, -1.85, -2.2, 0.16, 0.9, 0.16, navy);
    }
    add(0, -1.4, -2.2, 2.95, 0.17, 0.17, navy);
    this.car.visible = false;
  }

  makeSky() {
    const geometry = new THREE.SphereGeometry(2300, 32, 24);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color("#020413") },
        horizonColor: { value: new THREE.Color("#101443") },
        bottomColor: { value: new THREE.Color("#020714") },
      },
      vertexShader:
        "varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: `
        varying vec3 vPosition;
        uniform vec3 topColor, horizonColor, bottomColor;
        void main() {
          vec3 direction = normalize(vPosition);
          float h = direction.y;
          vec3 c = mix(horizonColor, topColor, smoothstep(0.0, 0.7, h));
          c = mix(c, bottomColor, 1.0 - smoothstep(-0.4, 0.0, h));
          // A faint aurora gives the dark sky depth without lifting its black level.
          float longitude = atan(direction.x, direction.z);
          float ribbon = 0.22 + sin(longitude * 3.0) * 0.07 + sin(longitude * 7.0) * 0.018;
          float veil = exp(-pow((h - ribbon) / 0.07, 2.0));
          c += mix(vec3(0.008, 0.005, 0.045), vec3(0.0, 0.032, 0.027), sin(longitude * 2.0) * 0.5 + 0.5) * veil;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geometry, material);
    this.scene.add(this.sky);
    this.moon = new THREE.Group();
    const moonBatch = new VoxelBatch(this.moon, true);
    const unit = 9;
    for (let y = -10; y <= 10; y++)
      for (let x = -10; x <= 10; x++) {
        if (x * x + y * y > 99) continue;
        // The shifted shadow forms a chunky crescent, with subtle blue crater pixels.
        const shadow = (x - 4) ** 2 + (y + 1) ** 2 < 87;
        const crater =
          (x + 4) ** 2 + (y - 3) ** 2 < 7 || (x + 5) ** 2 + (y + 4) ** 2 < 4;
        const color = shadow ? "#10244d" : crater ? "#168cca" : "#38c8ff";
        moonBatch.add(x * unit, y * unit, 0, unit + 0.2, unit + 0.2, 8, color);
      }
    moonBatch.build().material.fog = false;
    this.scene.add(this.moon);
    const stars = new VoxelBatch(this.scene, true);
    for (let i = 0; i < 460; i++) {
      const x = (rand(i, 83) - 0.5) * 3600,
        y = 180 + rand(i, 72) * 1350,
        z = -600 - rand(i, 55) * 1500;
      const size = i % 19 === 0 ? 2.8 : 1.25;
      const color = ["#399dff", "#8266ff", "#34edd2", "#b3ccff"][i % 4];
      stars.add(x, y, z, size, size, size, color);
      if (i % 37 === 0) {
        stars.add(x, y, z, 7, 1, 1, color);
        stars.add(x, y, z, 1, 7, 1, color);
      }
    }
    this.stars = stars.build();
    this.stars.material.fog = false;
  }

  makeWorld() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(8000, 11000),
      new THREE.MeshStandardMaterial({
        color: "#050d26",
        roughness: 0.28,
        metalness: 0.52,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -76, -2000);
    this.scene.add(water);
    // Small separated reflections retain the chunky, arcade-like material language.
    for (let i = 0; i < 850; i++) {
      const x = (rand(i, 25) - 0.5) * 1400,
        z = 300 - rand(i, 26) * 4550;
      this.glows.add(
        x,
        -75.7,
        z,
        3 + rand(i, 27) * 18,
        0.1,
        1.2,
        rand(i, 28) > 0.5 ? "#153f7c" : "#652373",
      );
    }
    const islands = [
      [115, -5, -75, 93, 0],
      [-124, -5, -130, 99, 0],
      [240, 6, -250, 125, 0],
      [-210, 16, -340, 124, 0],
      [350, 50, -545, 132, 1],
      [-80, 50, -575, 93, 0],
      [-285, 24, -730, 108, 1],
      [108, -6, -880, 95, 0],
      [-268, 32, -1040, 128, 1],
      [212, 44, -1130, 110, 1],
      [-80, 72, -1300, 95, 1],
      [360, 82, -1450, 122, 1],
      [-256, 80, -1550, 113, 1],
      [90, 17, -1725, 142, 2],
      [-260, -6, -1870, 118, 2],
      [265, -5, -1970, 90, 2],
      [35, 23, -2160, 116, 2],
      [-250, 23, -2260, 133, 2],
      [220, 30, -2420, 150, 2],
      [-360, 30, -2600, 105, 3],
      [30, 29, -2710, 88, 3],
      [365, 21, -2875, 112, 3],
      [-100, 30, -3020, 125, 3],
      [290, 36, -3220, 118, 3],
      [-320, 58, -3375, 119, 3],
      [165, 100, -3550, 130, 3],
      [-130, 124, -3760, 130, 3],
    ];
    islands.forEach((island, index) => this.island(...island, index));
    // Monumental, hazy stepped mesas make the horizon feel bigger than the ride.
    for (let i = 0; i < 85; i++) {
      const side = i % 2 ? 1 : -1,
        x = side * (460 + rand(i, 10) * 340),
        z = 100 - i * 56;
      const h = 70 + rand(i, 11) * 185,
        width = 55 + rand(i, 12) * 100;
      for (let j = 0; j < 5; j++)
        this.solids.add(
          x,
          -85 + (h * (j + 0.5)) / 5,
          z,
          width * (1 - j * 0.13),
          h / 5,
          width * (1 - j * 0.13),
          ["#111f49", "#1a245d", "#232068"][i % 3],
        );
    }
    // Floating stepping-stone islands.
    for (let i = 0; i < 95; i++) {
      const x = (rand(i, 94) - 0.5) * 1000,
        z = -rand(i, 95) * 4200,
        y = 35 + rand(i, 96) * 250,
        s = 6 + rand(i, 97) * 16;
      if (Math.abs(x) < 300) continue;
      this.solids.add(x, y, z, s, s * 0.65, s, "#222454");
      this.solids.add(x, y + s * 0.39, z, s, 2, s, "#168b9a");
    }
  }

  island(cx, cy, cz, radius, biome, seed) {
    const palettes = [
      {
        top: ["#007253", "#00aa64", "#00df7f", "#26f997"],
        rock: ["#15113a", "#251446", "#382051"],
        leaves: ["#ff007d", "#ff299f", "#b90083", "#e700e2"],
      },
      {
        top: ["#203c9a", "#2e42cf", "#006caf", "#5145df"],
        rock: ["#17153e", "#261b51", "#332060"],
        leaves: ["#0077ff", "#7025ff", "#19c2ff", "#3333ff"],
      },
      {
        top: ["#91365b", "#bc2c59", "#e74457", "#73254d"],
        rock: ["#321137", "#481346", "#66184c"],
        leaves: ["#ff6a00", "#ffb000", "#ff284a", "#ff8800"],
      },
      {
        top: ["#006580", "#007d8e", "#009d9e", "#00cbb0"],
        rock: ["#0d1c3d", "#16254a", "#2c2358"],
        leaves: ["#00f4b0", "#21ff84", "#00bd98", "#00dfff"],
      },
    ];
    const palette = palettes[biome],
      cell = 9;
    const tops = [];
    for (let ix = -Math.ceil(radius / cell); ix <= radius / cell; ix++)
      for (let iz = -Math.ceil(radius / cell); iz <= radius / cell; iz++) {
        const x = ix * cell,
          z = iz * cell,
          d = Math.sqrt((x / radius) ** 2 + (z / (radius * 0.75)) ** 2);
        if (d > 0.87 + rand(ix + seed * 22, iz) * 0.16) continue;
        const level = Math.floor((1 - d) * 3 + rand(ix + seed, iz + 18) * 0.6);
        const top = cy + level * 7;
        const depth =
          12 + Math.floor((1 - d) * 6) * 8 + rand(ix, iz + seed) * 5;
        this.solids.add(
          cx + x,
          top - depth / 2,
          cz + z,
          cell - 0.13,
          depth,
          cell - 0.13,
          palette.rock[Math.floor(rand(ix + seed, iz + 7) * 3)],
        );
        this.solids.add(
          cx + x,
          top + 1.5,
          cz + z,
          cell,
          3,
          cell,
          palette.top[Math.floor(rand(ix, iz + seed * 3) * 4)],
        );
        tops.push({ x: cx + x, y: top + 3, z: cz + z, d });
        if (rand(ix + seed * 4, iz + 88) > 0.96) {
          this.glows.add(
            cx + x,
            top + 4.2,
            cz + z,
            1.6,
            2.6,
            1.6,
            ["#ffae00", "#ff229e", "#00ffe0"][biome % 3],
          );
          this.solids.add(cx + x, top + 3.5, cz + z, 0.7, 1.5, 0.7, "#7bc7a0");
        }
      }
    for (let t = 0; t < 9; t++) {
      const point = tops[Math.floor(rand(seed * 13 + t, 42) * tops.length)];
      if (point.d > 0.84) continue;
      this.tree(
        point.x,
        point.y,
        point.z,
        0.8 + rand(t, seed) * 0.65,
        palette.leaves,
        seed * 10 + t,
      );
    }
    for (let c = 0; c < 5; c++) {
      const p = tops[Math.floor(rand(seed + c, 83) * tops.length)];
      const h = 5 + rand(seed, c) * 12;
      this.glows.add(
        p.x,
        p.y + h / 2,
        p.z,
        2.2,
        h,
        2.2,
        biome % 2 ? "#00cfff" : "#ff3388",
        0.3,
      );
      this.solids.add(p.x + 3, p.y + h / 4, p.z + 3, 3, h / 2, 3, "#4865ff");
    }
    if (seed % 3 === 0) {
      const fallx = cx + radius * 0.48,
        fallz = cz + radius * 0.47;
      for (let f = 0; f < 8; f++) {
        this.glows.add(
          fallx + (f % 3) * 3,
          cy - f * 7 - 3,
          fallz,
          2.7,
          13,
          2,
          f % 2 ? "#007eff" : "#00d6ff",
        );
      }
      for (let s = 0; s < 9; s++)
        this.glows.add(
          fallx + (rand(seed, s) - 0.5) * 20,
          cy - 60 - rand(s, seed) * 12,
          fallz + rand(seed + s, 35) * 12,
          2,
          2,
          2,
          "#217bff",
        );
    }
  }

  tree(x, y, z, scale, palette, seed) {
    const height = 17 * scale,
      unit = 5 * scale;
    this.solids.add(
      x,
      y + height / 2,
      z,
      3.3 * scale,
      height,
      3.3 * scale,
      "#3e205d",
    );
    this.solids.add(
      x + 3 * scale,
      y + height * 0.77,
      z,
      9 * scale,
      2 * scale,
      2 * scale,
      "#6b2579",
    );
    for (let ix = -2; ix <= 2; ix++)
      for (let iy = -1; iy <= 2; iy++)
        for (let iz = -2; iz <= 2; iz++) {
          if (
            ix * ix + iy * iy * 1.3 + iz * iz >
            5.8 + rand(ix + seed, iz + iy) * 1.8
          )
            continue;
          this.solids.add(
            x + ix * unit,
            y + height + iy * unit,
            z + iz * unit,
            unit - 0.13,
            unit - 0.13,
            unit - 0.13,
            palette[Math.floor(rand(ix + seed + iy, iz) * palette.length)],
          );
          if (iy === -1 && rand(ix + seed, iz) > 0.7)
            this.glows.add(
              x + ix * unit,
              y + height - unit * 1.8,
              z + iz * unit,
              1.2,
              unit,
              1.2,
              palette[1],
            );
        }
  }

  frameAt(t) {
    const point = this.curve.getPointAt(clamp(t));
    const tangent = this.curve.getTangentAt(clamp(t)).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();
    return { point, tangent, right, normal };
  }

  makeTrack() {
    const railSegments = [];
    let railPoints = [[], []];
    let wasGap = false;
    const deckPositions = [],
      deckColors = [];
    for (let i = 0; i <= 1800; i++) {
      const t = i / 1800,
        { point, right, normal } = this.frameAt(t);
      point.y += railLift(t, this.motion);
      const gap = inRailGap(t);
      if (gap && !wasGap) {
        railSegments.push(railPoints);
        railPoints = [[], []];
      }
      wasGap = gap;
      if (!gap)
        for (let side = 0; side < 2; side++)
          railPoints[side].push(
            point.clone().addScaledVector(right, side === 0 ? -4.15 : 4.15),
          );
      if (i % 2 === 0 && !gap) {
        const a = point.clone().addScaledVector(right, -5.0),
          b = point.clone().addScaledVector(right, 5.0);
        const next = this.frameAt(
          Math.min(1, t + 0.00055),
        ).point.addScaledVector(normal, -0.45);
        next.y += railLift(Math.min(1, t + 0.00055), this.motion);
        const c = next.clone().addScaledVector(right, 5),
          d = next.clone().addScaledVector(right, -5);
        for (const v of [a, b, c, a, c, d]) {
          deckPositions.push(v.x, v.y - 0.5, v.z);
          deckColors.push(0.23, 0.25, 0.39);
        }
      }
      if (i % 16 === 0 && i < 1800 && !gap) {
        const supportHeight = Math.max(20, point.y + 65);
        this.solids.add(
          point.x,
          point.y - supportHeight / 2 - 2,
          point.z,
          2.5,
          supportHeight,
          2.5,
          "#4f426f",
        );
        const yaw = Math.atan2(-right.z, right.x);
        this.solids.add(
          point.x,
          point.y - 2.2,
          point.z,
          12,
          1.8,
          2,
          "#343f6a",
          yaw,
        );
      }
    }
    const deckGeometry = new THREE.BufferGeometry();
    deckGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(deckPositions, 3),
    );
    deckGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(deckColors, 3),
    );
    deckGeometry.computeVertexNormals();
    this.scene.add(
      new THREE.Mesh(
        deckGeometry,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          metalness: 0.5,
          roughness: 0.5,
        }),
      ),
    );
    railSegments.push(railPoints);
    railSegments.forEach((segment) =>
      segment.forEach((points, i) => {
        if (points.length < 2) return;
        const line = new THREE.CatmullRomCurve3(points);
        this.scene.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(
              line,
              Math.max(8, points.length * 2),
              0.47,
              5,
              false,
            ),
            new THREE.MeshBasicMaterial({
              color: i ? "#ff238c" : "#00dbff",
              toneMapped: false,
            }),
          ),
        );
        const base = new THREE.Mesh(
          new THREE.TubeGeometry(
            line,
            Math.max(8, points.length),
            0.95,
            4,
            false,
          ),
          new THREE.MeshStandardMaterial({
            color: "#28355c",
            metalness: 0.6,
            roughness: 0.3,
          }),
        );
        base.position.y = -0.8;
        this.scene.add(base);
      }),
    );
    // Illuminated gates accelerate in frequency as the ride reaches its final act.
    for (let i = 0; i < 27; i++) {
      const t = i < 6 ? 0.035 + i * 0.12 : 0.68 + (i - 6) * 0.0137;
      if (t > 0.994) continue;
      const { point, right, tangent } = this.frameAt(t);
      const gate = new THREE.Group(),
        color = i % 3 === 0 ? "#ff7800" : i % 3 === 1 ? "#7e27ff" : "#00f2ca";
      const blocks = new VoxelBatch(gate, true);
      for (let side of [-1, 1]) {
        blocks.add(side * 11, 7, 0, 1, 14, 1, color);
        blocks.add(side * 9, 15, 0, 4, 1, 1, color);
        blocks.add(side * 7, 17, 0, 1, 4, 1, color);
      }
      blocks.add(0, 19, 0, 14, 1, 1, color);
      blocks.build();
      gate.position.copy(point);
      gate.rotation.y = Math.atan2(-right.z, right.x);
      this.scene.add(gate);
      if (tangent.y > 0.2) gate.rotation.x = -Math.asin(tangent.y) * 0.5;
    }
  }

  makeCreatures() {
    const sprite = [
      "...X.....X...",
      "....X...X....",
      "...XXXXXXX...",
      "..XX.XXX.XX..",
      ".XXXXXXXXXXX.",
      ".X.XXXXXXX.X.",
      ".X.X.....X.X.",
      "....XX.XX....",
    ];
    const places = [
      [134, 102, -115, 3.6, "#ff9400"],
      [-170, 164, -490, 4, "#8e2bff"],
      [100, 234, -1200, 4, "#ff1398"],
      [310, 166, -2050, 5, "#ffad00"],
      [-250, 233, -2690, 4.5, "#00ffae"],
      [135, 263, -3630, 5.5, "#ff6700"],
    ];
    places.forEach(([x, y, z, scale, color], i) => {
      const group = new THREE.Group(),
        batch = new VoxelBatch(group);
      for (let row = 0; row < sprite.length; row++)
        for (let col = 0; col < sprite[row].length; col++) {
          if (sprite[row][col] !== "X") continue;
          batch.add(
            (col - 6) * scale,
            (4 - row) * scale,
            0,
            scale * 0.94,
            scale * 0.94,
            scale * 1.8,
            color,
          );
        }
      const pixels = batch.build();
      pixels.material.dispose();
      pixels.material = pixelMaterial(color, 0.8);
      pixels.material.color.set("#ffffff");
      group.position.set(x, y, z);
      group.rotation.y = -0.15;
      this.scene.add(group);
      this.floaters.push({ group, y, phase: i * 2 });
      for (let j = 0; j < 14; j++)
        this.glows.add(
          x + (rand(i + j, 91) - 0.5) * 65,
          y - 30 - rand(i + j, 92) * 27,
          z + (rand(j, i) - 0.5) * 24,
          1.8,
          1.8,
          1.8,
          color,
        );
    });
    // Tiny voxel birds gather around the first island.
    for (let i = 0; i < 15; i++) {
      const x = -20 + rand(i, 67) * 380,
        y = 80 + rand(i, 68) * 45,
        z = -80 - rand(i, 69) * 600;
      this.glows.add(x, y, z, 2, 2, 2, "#ffc62b");
      this.glows.add(x - 3, y + 2, z, 4, 1, 1, "#ffc62b");
      this.glows.add(x + 3, y + 2, z, 4, 1, 1, "#ffc62b");
    }
  }

  makeParticles() {
    const positions = [],
      colors = [];
    for (let i = 0; i < 950; i++) {
      positions.push(
        (rand(i, 301) - 0.5) * 650,
        rand(i, 302) * 330 - 10,
        -rand(i, 303) * 4700,
      );
      const c = new THREE.Color(["#ff4266", "#9a35ff", "#00eec5"][i % 3]);
      colors.push(c.r, c.g, c.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 1.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        depthWrite: false,
      }),
    );
    this.scene.add(this.particles);
  }

  setQuality(quality) {
    this.quality = quality;
    this.renderer.setPixelRatio(
      quality === "performance" ? 0.85 : Math.min(window.devicePixelRatio, 1.5),
    );
    this.bloom.enabled = quality !== "performance";
    this.resize();
  }

  resize() {
    const w = this.exportSize?.width || this.container.clientWidth,
      h = this.exportSize?.height || this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, !this.exportSize);
    this.composer?.setSize(w, h);
  }

  render({
    time,
    progress,
    mode,
    energy = 0,
    gentle = false,
    delta = 0.016,
    duration = 150,
  }) {
    this.energy += (energy - this.energy) * Math.min(1, delta * 5);
    const calm = gentle || this.reducedMotion;
    this.car.visible = mode !== "idle";
    setCrystalTime(time);
    const motion = this.motion.sample(progress, duration);
    this.arena.update({
      route: motion.t,
      time,
      duration,
      active: mode !== "idle",
    });
    let landing = 0;
    if (mode === "idle") {
      const sway = calm ? 0 : Math.sin(time * 0.12) * 3;
      this.camera.position.set(
        -47 + sway,
        61 + (calm ? 0 : Math.sin(time * 0.2) * 1.1),
        162,
      );
      this.camera.lookAt(67, 66, -245);
      this.camera.fov = this.camera.aspect < 0.8 ? 72 : 59;
    } else {
      const { t, speed } = this.motion.sample(progress, duration),
        { point, tangent, normal } = this.frameAt(t);
      const pose = flightPose(t, time, duration, this.motion, (v) =>
        this.frameAt(v),
      );
      landing = pose.landing;
      this.camera.position.copy(pose.position);
      this.car.position.y = calm ? 0 : -landing * 0.18;
      this.car.rotation.x = calm ? 0 : -landing * 0.045;
      const target = this.curve.getPointAt(
        Math.min(1, t + (calm ? 0.009 : 0.005)),
      );
      target.addScaledVector(normal, 3.8);
      target.y += pose.lift * 0.88;
      if (this.arena.focusWeight > 0)
        target.lerp(
          this.arena.focusTarget,
          this.arena.focusWeight * (calm ? 0.55 : 1),
        );
      if (t > 0.997) target.copy(this.camera.position).add(tangent);
      this.camera.up.copy(up);
      this.camera.lookAt(target);
      const nextTangent = this.curve.getTangentAt(Math.min(1, t + 0.008));
      const turn = tangent.x * nextTangent.z - tangent.z * nextTangent.x;
      this.camera.rotateZ(calm ? 0 : clamp(turn * 3.0, -0.36, 0.36));
      this.camera.rotateY(this.look.x * 0.34);
      this.camera.rotateX(this.look.y * 0.19 + (calm ? 0 : pose.pitch));
      const rush = clamp((speed - 12) / 65);
      this.camera.fov = calm
        ? 65
        : 59 +
          rush * 20 +
          boostPower(t) * 6 +
          pose.landing * 2 +
          this.energy * 1.0;
      // A restrained vertical tremor reads as track contact; lift hills feel steadier.
      if (!calm)
        this.camera.position.addScaledVector(
          normal,
          Math.sin(time * 27) * (pose.airborne ? 0 : 0.028 * rush) +
            Math.sin(time * 43) * pose.landing * 0.11,
        );
    }
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.combat.update({
      time,
      duration,
      active: mode !== "idle",
      calm,
      landing,
    });
    this.rushPass.uniforms.amount.value =
      calm || mode === "idle"
        ? 0
        : clamp((motion.speed - 35) / 75) * 0.038 +
          boostPower(motion.t) * 0.022;
    this.sky.position.copy(this.camera.position);
    this.moon.position.set(
      this.camera.position.x + 360,
      410 + this.camera.position.y * 0.12,
      this.camera.position.z - 1150,
    );
    this.stars.position.z = this.camera.position.z * 0.95;
    this.encounters.update({
      time,
      progress,
      frame: this.frameAt(motion.t),
      active: mode !== "idle",
      calm,
      route: motion.t,
      duration,
    });
    if (!calm)
      this.floaters.forEach(({ group, y, phase }) => {
        group.position.y = y + Math.sin(time * 0.8 + phase) * 3.5;
        group.rotation.y = -0.15 + Math.sin(time * 0.35 + phase) * 0.1;
      });
    const inside = mode === "idle" ? 0 : tunnelCoverage(motion.t);
    this.scene.fog.color
      .set("#080d29")
      .lerp(new THREE.Color("#040b20"), inside);
    this.scene.fog.density = 0.0008 + inside * 0.002;
    this.headlight.visible = mode !== "idle";
    this.headlight.intensity = this.arena.actors.visible ? 24 : 55;
    this.bloom.strength = 0.42 + this.energy * 0.12;
    this.composer.render();
  }
}
