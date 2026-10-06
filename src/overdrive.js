import * as THREE from "three";
import { ARENA, GAGS, boostPower, smooth } from "./story.js";

const dummy = new THREE.Object3D();
const box = new THREE.BoxGeometry(1, 1, 1);
const hash = (i) => (((Math.sin(i * 73.71 + 19) * 43758.54) % 1) + 1) % 1;

function caption(text, color, width = 12) {
  if (typeof document === "undefined") return new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#081226";
  ctx.fillRect(0, 0, 768, 144);
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.strokeRect(5, 5, 758, 134);
  ctx.fillStyle = color;
  ctx.font = "900 66px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 384, 74, 720);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sprite.scale.set(width, (width * 144) / 768, 1);
  return sprite;
}

// All motion is a pure function of route/time so the movie, seeks and live ride agree.
export class Overdrive {
  constructor(scene, camera, { frameAt, motion }) {
    this.frameAt = frameAt;
    this.motion = motion;
    this.streaks = new THREE.InstancedMesh(
      box,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
      160,
    );
    this.streaks.frustumCulled = false;
    scene.add(this.streaks);
    for (let i = 0; i < 160; i++)
      this.streaks.setColorAt(
        i,
        new THREE.Color(
          ["#178baa", "#45d9eb", "#894bff", "#f45b32"][i % 4],
        ).multiplyScalar(1.3),
      );
    this.arcs = new THREE.InstancedMesh(
      box,
      new THREE.MeshBasicMaterial({
        color: "#63dfff",
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        toneMapped: false,
      }),
      48,
    );
    this.arcs.frustumCulled = false;
    scene.add(this.arcs);

    this.brake = new THREE.Group();
    camera.add(this.brake);
    const add = (parent, p, s, color) => {
      const m = new THREE.Mesh(
        box,
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.12,
          roughness: 0.3,
          metalness: 0.35,
        }),
      );
      m.position.set(...p);
      m.scale.set(...s);
      parent.add(m);
      return m;
    };
    add(this.brake, [0, 0, 0], [0.32, 0.12, 0.4], "#405875");
    add(this.brake, [0, 0.26, 0], [0.09, 0.6, 0.1], "#788da8");
    add(this.brake, [0, 0.58, 0], [0.46, 0.16, 0.18], "#ff4a35");
    this.brake.scale.setScalar(1.25);
    this.nope = caption("NOPE.", "#ffca43", 1.6);
    this.nope.position.set(0.15, -0.6, -4.5);
    if (this.nope.material) this.nope.material.depthTest = false;
    this.nope.renderOrder = 30;
    camera.add(this.nope);

    this.peel = new THREE.Group();
    scene.add(this.peel);
    // Three peeled golden arms and brown tips: a surviving banana is the boss's punch line.
    add(this.peel, [0, 0, 0], [1.7, 2.4, 1.7], "#ffe632");
    for (let arm = 0; arm < 3; arm++) {
      const a = (arm * Math.PI * 2) / 3;
      for (let n = 0; n < 6; n++) {
        const r = 1.0 + n * 0.85;
        add(
          this.peel,
          [
            Math.cos(a) * r,
            1.2 + Math.sin((n / 5) * Math.PI) * 2.1 - n * 0.36,
            Math.sin(a) * r,
          ],
          [1.25, 1.15, 1.25],
          n === 5 ? "#734718" : n % 2 ? "#ffcf1c" : "#ffee59",
        );
      }
    }
    this.bananaLine = caption("BANANA SPLIT.", "#ffe159", 19);
    scene.add(this.bananaLine);
  }

  update({ route, time, duration, speed, active, calm }) {
    const f = this.frameAt(route);
    const boost = boostPower(route);
    const intensity = smooth((speed - 36) / 75) * smooth((route - 0.15) / 0.07);
    const combatFocus = route > 0.506 && route < 0.65;
    this.streaks.visible = active && !calm && intensity > 0.005;
    if (this.streaks.visible) {
      this.streaks.material.opacity =
        (0.16 + intensity * 0.45) * (combatFocus ? 0.38 : 1);
      const basis = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          f.right,
          f.normal,
          f.tangent.clone().negate(),
        ),
      );
      for (let i = 0; i < 160; i++) {
        const angle = hash(i + 1) * Math.PI * 2;
        const radius = 13 + hash(i + 31) * 31;
        const z = 210 - ((route * this.motion.length * 1.8 + i * 61.79) % 230);
        dummy.position
          .copy(f.point)
          .addScaledVector(f.tangent, z)
          .addScaledVector(f.right, Math.cos(angle) * radius)
          .addScaledVector(f.normal, 4 + Math.sin(angle) * radius);
        dummy.quaternion.copy(basis);
        dummy.scale.set(
          0.035 + hash(i + 7) * 0.075,
          0.035 + hash(i + 7) * 0.075,
          2 + intensity * (7 + hash(i) * 13) + boost * 10,
        );
        dummy.updateMatrix();
        this.streaks.setMatrixAt(i, dummy.matrix);
      }
      this.streaks.instanceMatrix.needsUpdate = true;
    }
    this.arcs.visible = active && !calm && boost > 0.1;
    if (this.arcs.visible) {
      for (let i = 0; i < 48; i++) {
        const side = i < 24 ? -1 : 1,
          j = i % 24;
        const z = 10 + j * 3.8;
        const phase = Math.floor(time * 18);
        const a = f.point
          .clone()
          .addScaledVector(f.tangent, z)
          .addScaledVector(f.right, side * (8.1 + hash(j + phase) * 1.3))
          .addScaledVector(f.normal, 2 + hash(j + phase + 4) * 4);
        const b = f.point
          .clone()
          .addScaledVector(f.tangent, z + 3.8)
          .addScaledVector(f.right, side * (8.1 + hash(j + 1 + phase) * 1.3))
          .addScaledVector(f.normal, 2 + hash(j + 1 + phase + 4) * 4);
        dummy.position.copy(a).add(b).multiplyScalar(0.5);
        dummy.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          b.clone().sub(a).normalize(),
        );
        dummy.scale.set(0.08, a.distanceTo(b), 0.08);
        dummy.updateMatrix();
        this.arcs.setMatrixAt(i, dummy.matrix);
      }
      this.arcs.instanceMatrix.needsUpdate = true;
      this.arcs.material.opacity = boost * 0.65;
    }
    const brakeAge = time - this.motion.progressAt(GAGS.brake) * duration;
    this.brake.visible = active && brakeAge < 1.35;
    this.nope.visible = active && brakeAge > 0.12 && brakeAge < 1.45;
    if (this.nope.material)
      this.nope.material.opacity = 1 - smooth((brakeAge - 1.05) / 0.4);
    const age = Math.max(0, brakeAge);
    this.brake.position.set(
      age * 2.2,
      -1.85 + age * 5 - age * age * 1.6,
      -3.8 - age * 2,
    );
    this.brake.rotation.set(-0.25 + age * 4, age * 2, -age * 3);
    const bananaAge = time - this.motion.progressAt(ARENA.impact) * duration;
    this.peel.visible = this.bananaLine.visible =
      active &&
      bananaAge > GAGS.bananaDelay &&
      bananaAge < GAGS.bananaDelay + GAGS.bananaLength;
    if (this.peel.visible) {
      const p = (bananaAge - GAGS.bananaDelay) / GAGS.bananaLength;
      this.peel.position
        .copy(f.point)
        .addScaledVector(f.tangent, 32 - Math.max(0, (p - 0.6) / 0.4) ** 2 * 65)
        .addScaledVector(f.right, -5 - p * 5)
        .addScaledVector(f.normal, 8 + Math.sin(p * Math.PI) * 4);
      this.peel.rotation.set(0.4, bananaAge * 4, 0.5);
      this.bananaLine.position
        .copy(this.peel.position)
        .addScaledVector(f.normal, 6.5);
    }
  }
}
