import * as THREE from "three";
import { TARGETS, smooth } from "./story.js";
import { crystalMaterial, pixelGeometry } from "./materials.js";
import { flightPose } from "./motion.js";

const dummy = new THREE.Object3D(),
  color = new THREE.Color();
const box = new THREE.BoxGeometry(1, 1, 1);
const pattern = [
  "..X.......X..",
  ".XXX.....XXX.",
  "XXXXXXXXXXXXX",
  ".XXOOXXXOOXX.",
  "..XXXXXXXXX..",
  "...XXKKKXX...",
  "..XXX...XXX..",
  ".XX.......XX.",
];
const random = (i) => {
  const n = Math.sin(i * 93.13) * 43617.33;
  return n - Math.floor(n);
};
export const shotOffsets = [-0.81, -0.54, -0.27, 0];
export const shotFlight = 0.22;
export function combatEvents(motion, duration) {
  return TARGETS.map((cue, i) => ({
    ...cue,
    id: i,
    spawnTime: motion.progressAt(cue.spawn) * duration,
    killTime: motion.progressAt(cue.kill) * duration,
  }));
}

const patterns = [
  pattern,
  [
    "......X......",
    "..XX.XXX.XX..",
    ".XXXXXXXXXXX.",
    "XXXOOXXXOOXXX",
    ".XXXXXXXXXXX.",
    "..XXKKKKKXX..",
    "...XX...XX...",
    "....X...X....",
  ],
  [
    "X.....X.....X",
    "XX...XXX...XX",
    ".XXXXXXXXXXX.",
    "..XXOXXXOXX..",
    "...XXXXXXX...",
    "..XXXKKKXXX..",
    ".XX..XXX..XX.",
    "X.....X.....X",
  ],
];
function makeTarget(cue, id) {
  const pattern = patterns[id % patterns.length];
  const cells = [];
  const tint = ["#ee136e", "#7230f3", "#fa6208", "#176aff", "#db186b"][
    cue.wave
  ];
  const turret = id % 4 === 3;
  for (let y = 0; y < pattern.length; y++)
    for (let x = 0; x < pattern[y].length; x++) {
      const c = pattern[y][x];
      if (c === ".") continue;
      for (let z = -1; z <= 1; z++) {
        if (z === 0 && c === "K") continue;
        cells.push({
          position: new THREE.Vector3(
            (x - 6) * 0.62,
            (3.5 - y) * 0.62,
            z * 0.58 + (c === "O" ? 0.27 : 0),
          ),
          color: c === "O" ? "#91ffc2" : c === "K" ? "#19112f" : tint,
          size: 0.56,
        });
      }
    }
  if (turret)
    for (let z = 2; z < 7; z++)
      for (let x = -1; x <= 1; x++)
        cells.push({
          position: new THREE.Vector3(x * 0.62, -1, z * 0.62),
          color: "#ff7c18",
          size: 0.56,
        });
  const mesh = new THREE.InstancedMesh(
    pixelGeometry,
    crystalMaterial(0.28),
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
  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.22, 0.12),
    new THREE.MeshBasicMaterial({ color: "#b6ffd2", toneMapped: false }),
  );
  eye.position.set(0, -0.12, 0.98);
  group.add(eye);
  return { group, cells, mesh, turret, tint };
}
function beam(tint, width = 0.18) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    box,
    new THREE.MeshBasicMaterial({ color: tint, toneMapped: false }),
  );
  core.scale.set(width, width, 1);
  group.add(core);
  const glow = new THREE.Mesh(
    box,
    new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.scale.set(width * 3, width * 3, 1);
  group.add(glow);
  return group;
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
        new THREE.RingGeometry(1, 1.08, 16),
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
    this.shots = Array.from({ length: 16 }, (_, i) => {
      const b = beam(i % 2 ? "#8affdb" : "#39c9ff", 0.16);
      this.root.add(b);
      return b;
    });
    this.enemyShots = Array.from({ length: 8 }, () => {
      const b = beam("#ff256e", 0.33);
      this.root.add(b);
      return b;
    });
    this.weapons = [-1, 1].map((side) => {
      const gun = new THREE.Group();
      gun.position.set(side * 1.55, -1.3, -2.8);
      camera.add(gun);
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.56, 1.35),
        new THREE.MeshStandardMaterial({
          color: "#576a82",
          metalness: 0.65,
          roughness: 0.22,
        }),
      );
      shell.position.z = 0.35;
      gun.add(shell);
      const barrel = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.24, 1.7),
        new THREE.MeshStandardMaterial({
          color: "#267c96",
          metalness: 0.75,
          roughness: 0.19,
        }),
      );
      barrel.position.z = 1.2;
      gun.add(barrel);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.09, 0.72),
        new THREE.MeshBasicMaterial({ color: "#02d2df" }),
      );
      stripe.position.set(0, 0.31, 0.38);
      gun.add(stripe);
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.32, 0.7),
        new THREE.MeshStandardMaterial({
          color: "#ff7534",
          metalness: 0.4,
          roughness: 0.3,
        }),
      );
      panel.position.set(side * 0.31, 0, 0.35);
      gun.add(panel);
      for (let n = 0; n < 3; n++) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.05, 0.1),
          new THREE.MeshBasicMaterial({ color: "#50eaff" }),
        );
        vent.position.set(0, 0.3, 0.1 + n * 0.22);
        gun.add(vent);
      }
      const muzzle = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.36, 0),
        new THREE.MeshBasicMaterial({ color: "#b8ffdf", toneMapped: false }),
      );
      muzzle.position.z = 2.1;
      gun.add(muzzle);
      return { gun, muzzle, side };
    });
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
    const p = f.point
      .clone()
      .addScaledVector(f.tangent, 39 + Math.max(0, phase) * 8)
      .addScaledVector(
        f.right,
        cue.side * (9 + Math.sin(time * 2.7 + cue.index) * 5),
      )
      .addScaledVector(f.normal, 10 + Math.sin(time * 2.2 + cue.wave) * 3);
    return { position: p, frame: f };
  }
  update({ time, duration, active, calm, landing = 0 }) {
    this.root.visible = active;
    this.weapons.forEach((v) => (v.gun.visible = active));
    this.shield.visible = active;
    this.muzzleLight.intensity = 0;
    if (!active) return;
    if (this.eventDuration !== duration) {
      this.events = combatEvents(this.motion, duration);
      this.eventDuration = duration;
    }
    const events = this.events;
    this.shots.forEach((b) => (b.visible = false));
    this.enemyShots.forEach((b) => (b.visible = false));
    if (this.score) this.score.visible = false;
    let n = 0,
      enemyN = 0,
      flash = 0,
      shield = 0,
      aim = null;
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
      for (const offset of shotOffsets) {
        const hit = event.killTime + offset,
          launch = hit - shotFlight,
          dt = time - launch;
        const hitPose = this.pose(target.cue, hit, duration);
        if (dt >= 0 && dt < shotFlight && n < this.shots.length) {
          const r = this.motion.sample(launch / duration, duration).t;
          const from = flightPose(
            r,
            launch,
            duration,
            this.motion,
            this.frameAt,
          );
          const side = (target.id + Math.round(offset * 100)) % 2 ? 1 : -1;
          const origin = from.position
            .clone()
            .addScaledVector(from.frame.tangent, 5)
            .addScaledVector(from.frame.right, side * 1.55)
            .addScaledVector(from.frame.normal, -1.2);
          const q = dt / shotFlight;
          const a = origin
              .clone()
              .lerp(hitPose.position, Math.max(0, q - 0.28)),
            b = origin.clone().lerp(hitPose.position, q);
          const mesh = this.shots[n++];
          mesh.visible = true;
          setBeam(mesh, a, b);
          flash = Math.max(flash, Math.exp(-dt * 45));
        }
        const impactAge = time - hit;
        if (impactAge >= 0 && impactAge < 0.12) {
          target.ring.visible = true;
          target.ring.position.copy(hitPose.position);
          target.ring.lookAt(this.camera.position);
          target.ring.scale.setScalar(1 + impactAge * 24);
          target.ring.material.opacity = (1 - impactAge / 0.12) * 0.75;
          target.group.position.addScaledVector(
            frame.normal,
            Math.sin(impactAge * 40) * 0.6,
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
        shield = Math.max(shield, (1 - shieldAge / 0.2) * 0.22);
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
            .multiplyScalar(6 + random(i + target.id * 400) * 14)
            .add(new THREE.Vector3(0, 5, 0));
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
        if (age < 0.36) {
          target.ring.visible = true;
          target.ring.position.copy(death.position);
          target.ring.lookAt(this.camera.position);
          target.ring.scale.setScalar(2 + age * 22);
          target.ring.material.opacity = (1 - age / 0.36) * 0.7;
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
    this.camera.updateMatrixWorld(true);
    this.weapons.forEach(({ gun, muzzle, side }) => {
      gun.position.z = -2.8 + flash * 0.13;
      gun.position.y = -1.3 - (calm ? 0 : landing * 0.18);
      if (aim) gun.lookAt(aim.point);
      else gun.quaternion.identity();
      // Mesh +Z is its barrel direction; parked guns point forward in camera space.
      if (!aim) gun.rotation.y = Math.PI;
      muzzle.visible = flash > 0.05;
      muzzle.scale.setScalar(0.6 + flash * 0.7);
      muzzle.rotation.z = time * 30 * side;
    });
    this.muzzleLight.intensity = flash * 14;
    this.shield.material.opacity = shield * (calm ? 0.25 : 1);
  }
}
