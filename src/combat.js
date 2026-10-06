import * as THREE from "three";
import { TARGETS, SKIRMISHES, smooth } from "./story.js";
import { crystalMaterial, pixelGeometry } from "./materials.js";
import { flightPose } from "./motion.js";

const dummy = new THREE.Object3D(),
  color = new THREE.Color();
const box = new THREE.BoxGeometry(1, 1, 1);
const patterns = [
  // Space Invaders crab, squid and octopus: the silhouettes carry the identity.
  [
    "..X.....X..",
    "...X...X...",
    "..XXXXXXX..",
    ".XX.XXX.XX.",
    "XXXXXXXXXXX",
    "X.XXXXXXX.X",
    "X.X.....X.X",
    "...XX.XX...",
  ],
  [
    "...XX...",
    "..XXXX..",
    ".XXXXXX.",
    "XX.XX.XX",
    "XXXXXXXX",
    "..X..X..",
    ".X.XX.X.",
    "X.X..X.X",
  ],
  [
    "..XXXXXX..",
    ".XXXXXXXX.",
    "XXXXXXXXXX",
    "XX..XX..XX",
    "XXXXXXXXXX",
    "..XX..XX..",
    ".XX.XX.XX.",
    "XX......XX",
  ],
];
const fighterPattern = [
  "R....R",
  "RR..RR",
  "RY..YR",
  ".RYYR.",
  "..CC..",
  ".CWWC.",
  "CC..CC",
  "C....C",
];
const ghostPattern = [
  "..XXXX..",
  ".XXXXXX.",
  "XXXXXXXX",
  "XXWWWWXX",
  "XXWBWBXX",
  "XXXXXXXX",
  "XXXXXXXX",
  "XX.XX.XX",
];
const random = (i) => {
  const n = Math.sin(i * 93.13) * 43617.33;
  return n - Math.floor(n);
};
export const shotOffsets = [-0.81, -0.54, -0.27, 0];
export const shotFlight = 0.2;
export function combatEvents(motion, duration) {
  return TARGETS.map((cue, i) => ({
    ...cue,
    id: i,
    spawnTime: motion.progressAt(cue.spawn) * duration,
    killTime: motion.progressAt(cue.kill) * duration,
  }));
}
export function shotOffsetsFor(cue) {
  return cue.kind === "ghost"
    ? [-0.45, 0]
    : cue.kind === "invader"
      ? [-0.44, -0.22, 0]
      : [-0.66, -0.44, -0.22, 0];
}
function makeTarget(cue, id) {
  const pattern =
    cue.kind === "ghost"
      ? ghostPattern
      : cue.kind === "fighter"
        ? fighterPattern
        : patterns[id % patterns.length];
  const cells = [];
  const tint =
    cue.kind === "ghost"
      ? cue.index % 2
        ? "#04b9d2"
        : "#ec588b"
      : ["#8fe52c", "#36cabb", "#b877e6"][id % 3];
  const turret = false;
  for (let y = 0; y < pattern.length; y++)
    for (let x = 0; x < pattern[y].length; x++) {
      const c = pattern[y][x];
      if (c === ".") continue;
      for (let z = -1; z <= 1; z++) {
        if (z === 0 && c === "K") continue;
        cells.push({
          position: new THREE.Vector3(
            (x - (pattern[y].length - 1) / 2) * 0.8,
            (3.5 - y) * 0.8,
            z * 0.65,
          ),
          color:
            {
              W: "#d6e4ec",
              B: "#182c90",
              R: "#d93740",
              Y: "#deb941",
              C: "#185da4",
            }[c] || tint,
          size: 0.74,
        });
      }
    }
  if (turret)
    for (let z = 2; z < 7; z++)
      for (let x = -1; x <= 1; x++)
        cells.push({
          position: new THREE.Vector3(x * 0.62, -1, z * 0.62),
          color: "#ff7c18",
          size: 0.74,
        });
  const mesh = new THREE.InstancedMesh(
    pixelGeometry,
    crystalMaterial(0.15),
    cells.length,
  );
  cells.forEach((c, i) => {
    dummy.position.copy(c.position);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(c.size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.set(c.color));
  });
  const group = new THREE.Group();
  group.add(mesh);
  return { group, cells, mesh, turret, tint };
}
function beam(tint, width = 0.52) {
  const group = new THREE.Group();
  // A narrow hot filament sits inside colored plasma. Only the faint fringe
  // adds light: adding the whole sheath washed the shot and target to white.
  for (const [scale, shade, opacity, additive] of [
    [0.2, "#d9fff4", 1, false],
    [1, tint, 0.78, false],
    [2.5, tint, 0.065, true],
    [4.5, tint, 0.012, true],
  ]) {
    const layer = new THREE.Mesh(
      box,
      new THREE.MeshBasicMaterial({
        color: shade,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity === 1,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        toneMapped: false,
      }),
    );
    layer.scale.set(width * scale, width * scale, 1);
    group.add(layer);
  }
  return group;
}

function makeCannon(camera, side) {
  const gun = new THREE.Group();
  gun.name =
    side < 0
      ? "Thunder / left plasma cannon"
      : "Lightning / right plasma cannon";
  gun.position.set(side * 2.2, -1.53, -3.15);
  camera.add(gun);
  const body = new THREE.MeshStandardMaterial({
    color: "#183146",
    metalness: 0.66,
    roughness: 0.38,
  });
  const armor = new THREE.MeshStandardMaterial({
    color: "#426279",
    metalness: 0.72,
    roughness: 0.34,
  });
  const orange = new THREE.MeshStandardMaterial({
    color: "#ef721d",
    metalness: 0.35,
    roughness: 0.4,
  });
  const black = new THREE.MeshStandardMaterial({
    color: "#071525",
    metalness: 0.5,
    roughness: 0.36,
  });
  const energy = new THREE.MeshBasicMaterial({
    color: side < 0 ? "#27e4ff" : "#a3ff56",
    toneMapped: false,
  });
  const hot = new THREE.MeshBasicMaterial({
    color: "#dcfff1",
    toneMapped: false,
  });
  const block = (parent, pos, size, mat) => {
    const m = new THREE.Mesh(pixelGeometry, mat);
    m.position.set(...pos);
    m.scale.set(...size);
    parent.add(m);
    return m;
  };
  // A broad, stepped receiver with armored cheeks and an underslung hydraulic shoe.
  block(gun, [0, -0.04, 0], [1.02, 0.78, 1.42], body);
  block(gun, [0, -0.43, 0.26], [0.7, 0.23, 1.76], black);
  for (const edge of [-1, 1]) {
    block(gun, [edge * 0.5, 0.04, 0.15], [0.19, 0.64, 1.5], armor);
    block(gun, [edge * 0.51, 0.38, 0.21], [0.2, 0.16, 1.05], orange);
    block(gun, [edge * 0.43, -0.26, 0.1], [0.09, 0.065, 1.4], energy);
  }
  block(gun, [side * 0.72, -0.04, -0.1], [0.44, 0.56, 1.02], orange);
  for (let i = 0; i < 4; i++)
    block(gun, [side * 0.73, 0.26, -0.46 + i * 0.22], [0.4, 0.1, 0.095], black);
  // A visible reactor instead of a featureless tube; split armor exposes its glow.
  const chamber = block(gun, [0, 0.08, 0.97], [0.48, 0.48, 0.9], energy);
  for (const z of [0.59, 1.32]) {
    block(gun, [0, 0.11, z], [0.83, 0.77, 0.18], black);
    for (const edge of [-1, 1])
      block(gun, [edge * 0.31, 0.09, z - 0.04], [0.08, 0.55, 0.21], energy);
  }
  const cooling = [];
  for (let i = 0; i < 4; i++) {
    const fin = block(
      gun,
      [0, 0.46, 0.53 + i * 0.23],
      [0.72, 0.075, 0.085],
      armor,
    );
    cooling.push(fin);
  }
  const sleeve = new THREE.Group();
  sleeve.position.z = 1.38;
  gun.add(sleeve);
  const rotor = new THREE.Group();
  sleeve.add(rotor);
  // Three separated barrel rails leave a readable, rotating silhouette.
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const x = Math.cos(angle) * 0.3,
      y = Math.sin(angle) * 0.3;
    block(rotor, [x, y, 0.53], [0.32, 0.32, 1.52], armor);
    block(rotor, [x, y, 0.39], [0.19, 0.19, 1.76], black);
    block(rotor, [x, y, 1.19], [0.34, 0.34, 0.24], orange);
    block(rotor, [x, y, 1.32], [0.16, 0.16, 0.035], energy);
  }
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.51, 0.075, 4, 8),
    armor,
  );
  collar.position.z = 0.87;
  rotor.add(collar);
  const muzzle = new THREE.Group();
  muzzle.position.z = 2.78;
  gun.add(muzzle);
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), hot);
  flash.scale.set(0.68, 0.68, 1.8);
  muzzle.add(flash);
  for (let i = 0; i < 4; i++) {
    const petal = block(muzzle, [0, 0, 0.1], [0.11, 1.32, 0.11], energy);
    petal.rotation.z = (i / 4) * Math.PI;
  }
  const muzzleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.53, 8),
    new THREE.MeshBasicMaterial({
      color: side < 0 ? "#38dfff" : "#b4ff55",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  muzzleRing.position.z = 2.8;
  gun.add(muzzleRing);
  const vapor = new THREE.InstancedMesh(
    pixelGeometry,
    new THREE.MeshBasicMaterial({
      color: "#81ced8",
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
    6,
  );
  vapor.frustumCulled = false;
  gun.add(vapor);
  // A small stamped joke belongs to the machine, not the view over the track.
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#102131";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#ffb44e";
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "center";
    ctx.fillText(side < 0 ? "PEW DEPT." : "VERY SUBTLE", 128, 43);
    const map = new THREE.CanvasTexture(canvas);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.195),
      new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }),
    );
    label.position.set(0, 0.1, -0.724);
    label.rotation.y = Math.PI;
    gun.add(label);
  }
  // Fixed armor shares a handful of draws; only the mechanism remains articulated.
  const batchBoxes = (parent, keep = new Set()) => {
    const batches = new Map();
    for (const child of [...parent.children]) {
      if (
        child.geometry !== pixelGeometry ||
        child.isInstancedMesh ||
        keep.has(child)
      )
        continue;
      if (!batches.has(child.material)) batches.set(child.material, []);
      child.updateMatrix();
      batches.get(child.material).push(child.matrix.clone());
      parent.remove(child);
    }
    for (const [material, transforms] of batches) {
      const mesh = new THREE.InstancedMesh(
        pixelGeometry,
        material,
        transforms.length,
      );
      transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.computeBoundingSphere();
      parent.add(mesh);
    }
  };
  batchBoxes(gun, new Set([chamber, ...cooling]));
  batchBoxes(rotor);
  batchBoxes(muzzle);
  return {
    gun,
    muzzle,
    muzzleRing,
    sleeve,
    rotor,
    chamber,
    cooling,
    vapor,
    side,
  };
}

function setBeam(mesh, a, b) {
  mesh.position.lerpVectors(a, b, 0.5);
  mesh.lookAt(b);
  mesh.scale.set(1, 1, Math.max(0.001, a.distanceTo(b)));
}

export class ArcadeCombat {
  constructor(scene, camera, { frameAt, motion }) {
    this.frameAt = frameAt;
    this.motion = motion;
    this.camera = camera;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.targets = TARGETS.map((cue, id) => {
      const target = { ...makeTarget(cue, id), cue, id };
      this.root.add(target.group);
      const debris = new THREE.InstancedMesh(
        pixelGeometry,
        crystalMaterial(0.4),
        target.cells.length,
      );
      debris.frustumCulled = false;
      target.cells.forEach((c, i) => debris.setColorAt(i, color.set(c.color)));
      this.root.add(debris);
      target.debris = debris;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.16, 12),
        new THREE.MeshBasicMaterial({
          color: "#78ffe1",
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      this.root.add(ring);
      target.ring = ring;
      return target;
    });
    this.formations = ["invader", "fighter"].flatMap((kind) =>
      Array.from({ length: 12 }, (_, i) => {
        const model = makeTarget({ kind, wave: 1, index: i }, i);
        model.group.scale.setScalar(0.68);
        this.root.add(model.group);
        return { ...model, kind, index: i };
      }),
    );
    this.shots = Array.from({ length: 16 }, (_, i) => {
      const b = beam(i % 2 ? "#c0ff59" : "#35dfff", 0.52);
      this.root.add(b);
      return b;
    });
    this.enemyShots = Array.from({ length: 8 }, () => {
      const b = beam("#ff286e", 0.43);
      this.root.add(b);
      return b;
    });
    this.arenaBursts = Array.from({ length: 5 }, () => {
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.88, 1.08, 12),
        new THREE.MeshBasicMaterial({
          color: "#d9ff75",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(1, 0),
        new THREE.MeshBasicMaterial({
          color: "#efffcc",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      group.add(ring, core);
      this.root.add(group);
      return { group, ring, core };
    });
    this.weapons = [-1, 1].map((side) => makeCannon(camera, side));
    this.shotKick = 0;
    this.recoil = 0;
    this.impact = 0;
    this.shield = new THREE.Mesh(
      new THREE.RingGeometry(2.3, 2.34, 6),
      new THREE.MeshBasicMaterial({
        color: "#14ddff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.shield.position.z = -3.5;
    camera.add(this.shield);
    this.muzzleLight = new THREE.PointLight("#18e9ff", 0, 24, 2);
    camera.add(this.muzzleLight);
    this.muzzleLight.position.set(0, -0.5, -4);
    // A small in-world arcade confirmation, included in the clean video too.
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.font = "bold 42px monospace";
      ctx.fillStyle = "#89ffdc";
      ctx.textAlign = "center";
      ctx.fillText("+100", 128, 47);
      const map = new THREE.CanvasTexture(canvas);
      map.minFilter = THREE.LinearFilter;
      this.score = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      this.score.scale.set(9, 2.25, 1);
      this.root.add(this.score);
    }
  }
  pose(cue, time, duration) {
    const route = this.motion.sample(time / duration, duration).t;
    const f = this.frameAt(route);
    const kill = this.motion.progressAt(cue.kill) * duration;
    const phase = kill - time;
    const age = Math.max(
      0,
      time - this.motion.progressAt(cue.spawn) * duration,
    );
    const kind = cue.kind;
    const march = Math.round(Math.sin(time * 2.1) * 2) * 2;
    const dive = kind === "fighter" ? Math.max(0, 1 - phase / 1.4) : 0;
    const side =
      kind === "invader"
        ? cue.side * (8 + march)
        : cue.side * (16 - 10 * dive + Math.sin(age * 3) * 2);
    const forward =
      kind === "fighter"
        ? 59 - 32 * dive
        : kind === "ghost"
          ? 32
          : 46 + Math.max(0, phase) * 6;
    const height =
      kind === "fighter"
        ? 19 - 12 * dive
        : kind === "ghost"
          ? 8
          : 12 + (cue.index % 2) * 4;
    const p = f.point
      .clone()
      .addScaledVector(f.tangent, forward)
      .addScaledVector(f.right, side)
      .addScaledVector(f.normal, height);
    return { position: p, frame: f };
  }
  update({ time, duration, active, calm, landing = 0, arena }) {
    this.root.visible = active;
    this.weapons.forEach((v) => (v.gun.visible = active));
    this.shield.visible = active;
    this.muzzleLight.intensity = 0;
    this.shotKick = this.recoil = this.impact = 0;
    if (!active) return;
    if (this.eventDuration !== duration) {
      this.events = combatEvents(this.motion, duration);
      this.eventDuration = duration;
    }
    const events = this.events;
    const routeNow = this.motion.sample(time / duration, duration).t;
    const band = SKIRMISHES.findIndex(
      ([a, b]) => routeNow > a - 0.009 && routeNow < b,
    );
    const kind = SKIRMISHES[band]?.[3];
    const formationFrame = this.frameAt(routeNow);
    const cleared = events.filter(
      (e) => e.wave === band && time >= e.killTime,
    ).length;
    this.formations.forEach((m) => {
      m.group.visible = active && m.kind === kind && m.index >= cleared * 2;
      if (!m.group.visible) return;
      const row = Math.floor(m.index / 4),
        col = m.index % 4;
      m.group.position
        .copy(formationFrame.point)
        .addScaledVector(formationFrame.tangent, 96 + row * 14)
        .addScaledVector(
          formationFrame.right,
          (col - 1.5) * 12 + Math.round(Math.sin(time * 1.3) * 2) * 2,
        )
        .addScaledVector(formationFrame.normal, 16 + row * 7);
      m.group.lookAt(this.camera.position);
      if (kind === "fighter")
        m.group.rotation.z += Math.sin(time * 2 + col) * 0.18;
    });
    this.shots.forEach((b) => (b.visible = false));
    this.enemyShots.forEach((b) => (b.visible = false));
    this.arenaBursts.forEach((v) => {
      v.group.visible = false;
    });
    if (this.score) this.score.visible = false;
    let n = 0,
      enemyN = 0,
      flash = 0,
      shield = 0,
      aim = null;
    const gunPulses = [0, 0],
      gunAges = [Infinity, Infinity],
      gunCharges = [0, 0];
    const firingPulse = (launch, side) => {
      const dt = time - launch,
        slot = side < 0 ? 0 : 1;
      if (dt >= -0.12 && dt < 0)
        gunCharges[slot] = Math.max(gunCharges[slot], 1 + dt / 0.12);
      if (dt < 0 || dt > 0.42) return;
      gunAges[slot] = Math.min(gunAges[slot], dt);
      gunPulses[slot] = Math.max(gunPulses[slot], Math.exp(-dt * 14));
      this.shotKick = Math.max(this.shotKick, Math.exp(-dt * 27));
      this.recoil = Math.max(this.recoil, Math.exp(-dt * 11));
    };
    for (const target of this.targets) {
      const event = events[target.id],
        age = time - event.killTime;
      if (
        time < Math.min(event.spawnTime - 0.6, event.killTime - 1.1) ||
        age >= 2.4
      ) {
        target.group.visible = false;
        target.debris.visible = false;
        target.ring.visible = false;
        continue;
      }
      const { position, frame } = this.pose(
        target.cue,
        Math.min(time, event.killTime),
        duration,
      );
      target.group.visible = time >= event.spawnTime - 0.6 && age < 0;
      target.group.position.copy(position);
      target.group.lookAt(
        frame.point.clone().addScaledVector(frame.normal, 3.8),
      );
      target.group.rotateZ(Math.sin(time * 5 + target.id) * 0.2);
      target.group.scale.setScalar(target.turret ? 1.18 : 1);
      if (target.group.visible && (!aim || event.killTime < aim.killTime))
        aim = { point: position, killTime: event.killTime };
      target.ring.visible = false;
      // Four staggered hits, each fired from the car's position at emission time.
      for (const offset of shotOffsetsFor(target.cue)) {
        const hit = event.killTime + offset,
          launch = hit - shotFlight,
          dt = time - launch;
        const hitPose = this.pose(target.cue, hit, duration);
        const shotSide = (target.id + Math.round(offset * 100)) % 2 ? 1 : -1;
        firingPulse(launch, shotSide);
        if (dt >= 0 && dt < shotFlight && n < this.shots.length) {
          const r = this.motion.sample(launch / duration, duration).t;
          const from = flightPose(
            r,
            launch,
            duration,
            this.motion,
            this.frameAt,
          );
          const side = shotSide;
          const origin = from.position
            .clone()
            .addScaledVector(from.frame.tangent, 5.9)
            .addScaledVector(from.frame.right, side * 2.2)
            .addScaledVector(from.frame.normal, -1.53);
          const q = dt / shotFlight;
          const a = origin
              .clone()
              .lerp(hitPose.position, Math.max(0, q - 0.42)),
            b = origin.clone().lerp(hitPose.position, q);
          const mesh = this.shots[n++];
          mesh.visible = true;
          setBeam(mesh, a, b);
          flash = Math.max(flash, Math.exp(-dt * 45));
        }
        const impactAge = time - hit;
        if (impactAge >= 0 && impactAge < 0.2) {
          target.ring.visible = true;
          target.ring.position.copy(hitPose.position);
          target.ring.lookAt(this.camera.position);
          target.ring.scale.setScalar(1.2 + impactAge * 35);
          target.ring.material.opacity = (1 - impactAge / 0.2) * 0.68;
          target.group.position.addScaledVector(
            frame.normal,
            Math.sin(impactAge * 40) * 1.2,
          );
        }
      }
      // Magenta fire crosses the cockpit; a blue shield catches the near miss.
      const threat = event.killTime - 0.57,
        dt = time - threat,
        travel = 0.42;
      if (dt >= 0 && dt < travel && enemyN < this.enemyShots.length) {
        const from = this.pose(target.cue, threat, duration).position;
        const future = threat + travel,
          r = this.motion.sample(future / duration, duration).t;
        const destination = flightPose(
          r,
          future,
          duration,
          this.motion,
          this.frameAt,
        );
        const end = destination.position
          .clone()
          .addScaledVector(destination.frame.right, target.cue.side * 2.9);
        const q = dt / travel,
          a = from.clone().lerp(end, Math.max(0, q - 0.14)),
          b = from.clone().lerp(end, q);
        const mesh = this.enemyShots[enemyN++];
        mesh.visible = true;
        setBeam(mesh, a, b);
      }
      const shieldAge = dt - travel;
      if (shieldAge >= 0 && shieldAge < 0.2)
        shield = Math.max(shield, (1 - shieldAge / 0.2) * 0.35);
      target.debris.visible = age >= 0 && age < 2.4;
      if (target.debris.visible) {
        target.group.updateMatrixWorld(true);
        // Snapshot the death orientation; replaying a seek produces the same fragments.
        const death = this.pose(target.cue, event.killTime, duration);
        const basis = new THREE.Object3D();
        basis.position.copy(death.position);
        basis.lookAt(death.frame.point);
        basis.rotateZ(Math.sin(event.killTime * 5 + target.id) * 0.2);
        basis.scale.setScalar(target.turret ? 1.18 : 1);
        basis.updateMatrixWorld(true);
        target.cells.forEach((cell, i) => {
          const radial = cell.position.clone().normalize();
          const velocity = radial
            .multiplyScalar(10 + random(i + target.id * 400) * 24)
            .add(new THREE.Vector3(0, 8, 0));
          dummy.position
            .copy(cell.position)
            .applyMatrix4(basis.matrixWorld)
            .addScaledVector(velocity, age);
          dummy.position.y -= 8.4 * age * age;
          dummy.rotation.set(
            age * (random(i) * 8 - 4),
            age * (random(i + 3) * 8 - 4),
            age * 2,
          );
          dummy.scale.setScalar(
            Math.max(0.0001, cell.size * (1 - smooth(age - 1.4))),
          );
          dummy.updateMatrix();
          target.debris.setMatrixAt(i, dummy.matrix);
        });
        target.debris.instanceMatrix.needsUpdate = true;
        if (age < 0.52) {
          this.impact = Math.max(this.impact, Math.exp(-age * 8));
          target.ring.visible = true;
          target.ring.position.copy(death.position);
          target.ring.lookAt(this.camera.position);
          target.ring.scale.setScalar(2.5 + age * 38);
          target.ring.material.opacity = (1 - age / 0.52) * 0.8;
        }
        if (this.score && age < 0.65) {
          this.score.visible = true;
          this.score.position
            .copy(death.position)
            .addScaledVector(death.frame.normal, 6 + age * 5);
          this.score.material.opacity = 1 - age / 0.65;
        }
      }
    }
    let burstIndex = 0;
    for (const event of arena?.fireEvents || []) {
      const launch = event.hitTime - shotFlight,
        dt = time - launch;
      firingPulse(launch, event.target % 2 ? 1 : -1);
      const hitAge = time - event.hitTime;
      if (
        hitAge >= 0 &&
        hitAge < 0.36 &&
        burstIndex < this.arenaBursts.length
      ) {
        const { group, ring, core } = this.arenaBursts[burstIndex++];
        group.visible = true;
        group.position.copy(event.point);
        group.lookAt(this.camera.position);
        const power = event.final ? 1.5 : 1;
        ring.scale.setScalar((1.4 + hitAge * 27) * power);
        ring.material.opacity = (1 - hitAge / 0.36) * 0.62;
        ring.material.color.set(
          event.kind === "barrel" ? "#7fffee" : "#ffb44b",
        );
        core.scale.setScalar(
          Math.max(0.001, (1 - hitAge / 0.12) * 2.4 * power),
        );
        core.material.opacity = Math.max(0, 1 - hitAge / 0.12) * 0.8;
      }
      if (event.final && hitAge >= 0 && hitAge < 0.45)
        this.impact = Math.max(this.impact, Math.exp(-hitAge * 9));
      if (dt < -0.25 || dt > shotFlight) continue;
      if (dt < 0) {
        aim = { point: event.point, killTime: event.hitTime };
        continue;
      }
      const route = this.motion.sample(launch / duration, duration).t;
      const from = flightPose(
        route,
        launch,
        duration,
        this.motion,
        this.frameAt,
      );
      const origin = from.position
        .clone()
        .addScaledVector(from.frame.tangent, 5.9)
        .addScaledVector(from.frame.right, event.target % 2 ? 2.2 : -2.2)
        .addScaledVector(from.frame.normal, -1.53);
      const q = dt / shotFlight;
      if (n < this.shots.length) {
        const shot = this.shots[n++];
        shot.visible = true;
        setBeam(
          shot,
          origin.clone().lerp(event.point, Math.max(0, q - 0.42)),
          origin.clone().lerp(event.point, q),
        );
      }
      flash = Math.max(flash, Math.exp(-dt * 40));
      aim = { point: event.point, killTime: event.hitTime };
    }
    if (
      arena?.actors.visible &&
      arena.boss.visible &&
      arena.fireEvents.length
    ) {
      const next =
        arena.fireEvents.find((e) => e.hitTime > time) ||
        arena.fireEvents.at(-1);
      const prev =
        arena.fireEvents.findLast((e) => e.hitTime <= time) ||
        arena.fireEvents[0];
      const blend = smooth((time - (next.hitTime - shotFlight - 0.26)) / 0.24);
      aim = {
        point: prev.point.clone().lerp(next.point, blend),
        killTime: next.hitTime,
      };
    }
    this.camera.updateMatrixWorld(true);
    this.weapons.forEach(
      (
        {
          gun,
          muzzle,
          muzzleRing,
          sleeve,
          rotor,
          chamber,
          cooling,
          vapor,
          side,
        },
        index,
      ) => {
        const pulse = gunPulses[index],
          age = gunAges[index],
          charge = gunCharges[index];
        gun.position.z = -3.15 + pulse * 0.26;
        gun.position.y = -1.53 - (calm ? 0 : landing * 0.18) - pulse * 0.07;
        if (aim) gun.lookAt(aim.point);
        else {
          gun.quaternion.identity();
          gun.rotation.y = Math.PI;
        }
        // All motion is a pure function of timeline: scrubbing never leaves a hot barrel behind.
        sleeve.position.z = 1.38 - pulse * 0.32;
        rotor.rotation.z = side * (time * 1.5 + pulse * 0.68);
        chamber.scale.set(0.48 + charge * 0.1, 0.48 + charge * 0.1, 0.9);
        chamber.material.color
          .set(side < 0 ? "#27e4ff" : "#a3ff56")
          .multiplyScalar(0.72 + charge * 0.65 + pulse * 0.75);
        cooling.forEach((fin, i) => {
          fin.position.y = 0.46 + pulse * (0.09 + i * 0.015);
        });
        muzzle.visible = age < 0.105;
        muzzle.scale.setScalar(0.65 + pulse * 0.6);
        muzzle.rotation.z = side * time * 36;
        muzzleRing.visible = age < 0.22;
        muzzleRing.scale.setScalar(1 + Math.min(age, 0.22) * 5);
        muzzleRing.position.z = 2.8 + Math.min(age, 0.22) * 3;
        muzzleRing.material.opacity = age < 0.22 ? (1 - age / 0.22) * 0.7 : 0;
        vapor.visible = age > 0.08 && age < 0.4;
        if (vapor.visible) {
          for (let i = 0; i < 6; i++) {
            const life = Math.max(0, age - i * 0.016);
            dummy.position.set(
              side * (0.55 + life * 1.2),
              0.27 + life * 1.4,
              0.25 + i * 0.16,
            );
            dummy.rotation.set(time + i, i, time * 2);
            dummy.scale.setScalar(Math.max(0.001, 0.035 + life * 0.14));
            dummy.updateMatrix();
            vapor.setMatrixAt(i, dummy.matrix);
          }
          vapor.instanceMatrix.needsUpdate = true;
        }
      },
    );
    this.muzzleLight.intensity = Math.max(...gunPulses) * 38;
    this.impact = Math.max(this.impact, shield * 1.7);
    this.shield.material.opacity = shield * (calm ? 0.25 : 1);
  }
}
