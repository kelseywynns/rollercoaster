import * as THREE from "three";
import { ARENA, smooth } from "./story.js";
import { makeTitan, voxelEllipsoid, collectVoxels, hash } from "./sculpt.js";
import { crystalMaterial } from "./materials.js";

const up = new THREE.Vector3(0, 1, 0),
  dummy = new THREE.Object3D();
const box = new THREE.BoxGeometry(1, 1, 1);
const at = (frame, x, y, z = 0) =>
  frame.point
    .clone()
    .addScaledVector(frame.right, x)
    .addScaledVector(frame.normal, y)
    .addScaledVector(frame.tangent, z);

class Architecture {
  constructor(root) {
    this.root = root;
    this.batches = new Map();
  }
  add(position, scale, quaternion, material) {
    if (!this.batches.has(material)) this.batches.set(material, []);
    this.batches.get(material).push({ position, scale, quaternion });
  }
  beam(a, b, width, material, depth = width) {
    if (a.distanceToSquared(b) < 1e-8) return;
    this.add(
      a.clone().add(b).multiplyScalar(0.5),
      new THREE.Vector3(width, a.distanceTo(b), depth),
      new THREE.Quaternion().setFromUnitVectors(
        up,
        b.clone().sub(a).normalize(),
      ),
      material,
    );
  }
  block(frame, x, y, w, h, d, material) {
    this.add(
      at(frame, x, y),
      new THREE.Vector3(w, h, d),
      new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          frame.right,
          frame.normal,
          frame.tangent.clone().negate(),
        ),
      ),
      material,
    );
  }
  finish() {
    for (const [material, items] of this.batches) {
      const mesh = new THREE.InstancedMesh(box, material, items.length);
      items.forEach((item, i) => {
        dummy.position.copy(item.position);
        dummy.scale.copy(item.scale);
        dummy.quaternion.copy(item.quaternion);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.computeBoundingSphere();
      this.root.add(mesh);
    }
  }
}

export class ArcadeArena {
  constructor(scene, { frameAt, motion }) {
    this.frameAt = frameAt;
    this.motion = motion;
    this.structure = new THREE.Group();
    this.structure.name = "Midnight arcade arena";
    scene.add(this.structure);
    this.actors = new THREE.Group();
    scene.add(this.actors);
    this.makeArchitecture();
    this.boss = makeTitan();
    this.actors.add(this.boss);
    this.focusTarget = new THREE.Vector3();
    this.focusWeight = 0;
    this.warmLight = new THREE.PointLight("#ff830d", 350, 110, 2);
    this.warmLight.position.set(0, 18, 22);
    scene.add(this.warmLight);
    this.impactLight = new THREE.PointLight("#45ffdc", 0, 145, 2);
    scene.add(this.impactLight);
    this.poseBoss(ARENA.impact);
    this.impactCells = collectVoxels(this.boss, true);
    this.impactFrame = frameAt(ARENA.gantry);
    this.impactPoint = at(this.impactFrame, 0, 43);
    this.impactLight.position.copy(this.impactPoint);
    this.makeFracture();
    this.projectiles = ARENA.throws.map((cue, i) => {
      this.poseBoss(cue.release);
      const hand =
        this.boss.userData.parts[cue.side < 0 ? "leftHand" : "rightHand"];
      this.boss.updateWorldMatrix(true, true);
      const origin = hand.localToWorld(new THREE.Vector3(0, 0, 10));
      const passFrame = frameAt(cue.pass),
        target = at(passFrame, cue.side * 12, 4.5);
      const group = new THREE.Group();
      group.name = "Thrown plasma drum";
      voxelEllipsoid(
        group,
        [0, 0, 0],
        [4.6, 4.6, 6],
        (x, y, z) =>
          Math.abs(z) > 3.1 && Math.abs(z) < 4.6
            ? "#167dff"
            : Math.abs(z) > 4.6
              ? "#ffda55"
              : "#ff4f0b",
        0.74,
        0.75,
      );
      const light = new THREE.PointLight("#ff6715", 380, 42, 2);
      scene.add(light);
      this.actors.add(group);
      return {
        group,
        cue,
        origin,
        target,
        normal: passFrame.normal.clone(),
        baseFlight:
          (motion.progressAt(cue.pass) - motion.progressAt(cue.release)) * 150,
        light,
      };
    });
  }

  makeArchitecture() {
    const metal = new THREE.MeshStandardMaterial({
      color: "#8a1137",
      metalness: 0.6,
      roughness: 0.24,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#101837",
      metalness: 0.55,
      roughness: 0.32,
    });
    const floor = new THREE.MeshStandardMaterial({
      color: "#5c102c",
      metalness: 0.48,
      roughness: 0.18,
    });
    const cyan = new THREE.MeshBasicMaterial({
      color: "#00acb9",
      toneMapped: false,
    });
    const amber = new THREE.MeshBasicMaterial({
      color: "#ff710c",
      toneMapped: false,
    });
    const build = new Architecture(this.structure);
    const count = 76,
      step = (ARENA.end - ARENA.start) / count;
    for (let i = 0; i <= count; i++) {
      const t = ARENA.start + step * i,
        f = this.frameAt(t),
        next = this.frameAt(Math.min(ARENA.end, t + step));
      // The polished bridge receives the orange light of the passing projectiles.
      build.block(f, 0, -4.2, 31, 1.1, 13, floor);
      for (const side of [-1, 1]) {
        build.beam(at(f, side * 16, -4), at(next, side * 16, -4), 1.2, metal);
        build.beam(at(f, side * 16, -9), at(next, side * 16, -9), 1.1, metal);
        build.beam(at(f, side * 16, -9), at(next, side * 16, -4), 0.7, metal);
        build.beam(
          at(f, side * 16, -3.55),
          at(next, side * 16, -3.55),
          0.16,
          cyan,
        );
        if (i % 5 === 0) {
          const base = at(f, side * 53, -70),
            top = at(f, side * 53, 94);
          build.beam(base, top, 3, dark);
          for (const y of [-8, 27, 64]) {
            build.block(f, side * 51, y, 32, 2.4, 30, floor);
            build.beam(
              at(f, side * 34, y - 5),
              at(f, side * 67, y - 5),
              1.4,
              metal,
            );
            build.beam(at(f, side * 34, y), at(f, side * 67, y), 1.5, metal);
            for (let k = 0; k < 4; k++)
              build.beam(
                at(f, side * (34 + k * 8), y - 5),
                at(f, side * (42 + k * 8), y),
                0.8,
                metal,
              );
            build.beam(
              at(f, side * 34, y + 1.3),
              at(f, side * 67, y + 1.3),
              0.22,
              amber,
            );
          }
          // Cyan ladders provide human-readable scale against the monumental girders.
          for (const offset of [-1.7, 1.7])
            build.beam(
              at(f, side * 41 + offset, -7, 9),
              at(f, side * 41 + offset, 66, 9),
              0.28,
              cyan,
            );
          for (let y = -6; y <= 64; y += 2.8)
            build.beam(
              at(f, side * 41 - 1.7, y, 9),
              at(f, side * 41 + 1.7, y, 9),
              0.24,
              cyan,
            );
        }
      }
      if (i % 10 === 0) {
        build.beam(at(f, -72, 99), at(f, 72, 99), 3, metal);
        build.beam(at(f, -72, 105), at(f, 72, 105), 2, metal);
        for (let x = -70; x < 70; x += 14)
          build.beam(at(f, x, 99), at(f, x + 14, 105), 1.1, metal);
      }
    }
    const f = this.frameAt(ARENA.gantry);
    for (const side of [-1, 1]) {
      build.beam(at(f, side * 39, -25), at(f, side * 39, 53), 5, metal);
      build.beam(at(f, side * 20, 43), at(f, side * 47, 43), 5, metal);
      build.beam(at(f, side * 20, 49), at(f, side * 47, 49), 3, metal);
      build.beam(at(f, side * 21, 43), at(f, side * 38, 49), 1.4, metal);
      build.beam(
        at(f, side * 39 - 1.5, -20),
        at(f, side * 39 - 1.5, 43),
        0.45,
        cyan,
      );
    }
    build.finish();
    this.breakBeam = new THREE.Mesh(box, metal);
    this.breakBeam.position.copy(at(f, 0, 45));
    this.breakBeam.scale.set(40, 6, 7);
    this.breakBeam.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        f.right,
        f.normal,
        f.tangent.clone().negate(),
      ),
    );
    this.structure.add(this.breakBeam);
  }

  rootPose(route) {
    const t = Math.max(0.568, route + 0.018),
      frame = this.frameAt(t);
    const position = at(frame, 38, -10);
    const view = at(this.frameAt(route), 0, 4).sub(position);
    view.addScaledVector(frame.normal, -view.dot(frame.normal)).normalize();
    const side = new THREE.Vector3()
      .crossVectors(frame.normal, view)
      .normalize();
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(side, frame.normal, view),
    );
    if (route >= ARENA.chargeStart) {
      const start = this.rootPose(ARENA.chargeStart - 0.000001),
        end = this.frameAt(ARENA.gantry);
      const phase = smooth(
        (route - ARENA.chargeStart) / (ARENA.impact - ARENA.chargeStart),
      );
      position
        .lerpVectors(start.position, at(end, 0, -14), phase)
        .addScaledVector(end.normal, Math.sin(phase * Math.PI) * 12);
      const endRotation = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          end.right,
          end.normal,
          end.tangent.clone().negate(),
        ),
      );
      quaternion.copy(start.quaternion).slerp(endRotation, phase);
    }
    return { position, quaternion };
  }

  poseBoss(route) {
    const pose = this.rootPose(route),
      parts = this.boss.userData.parts;
    this.boss.position.copy(pose.position);
    this.boss.quaternion.copy(pose.quaternion);
    const charge = smooth(
      (route - ARENA.chargeStart) / (ARENA.impact - ARENA.chargeStart),
    );
    parts.torso.rotation.set(
      0,
      0,
      Math.sin(route * 240) * 0.025 * (1 - charge),
    );
    parts.head.rotation.set(
      0.04 * Math.sin(route * 180) * (1 - charge),
      Math.sin(route * 140) * 0.065 * (1 - charge),
      0,
    );
    for (const [name, side] of [
      ["leftArm", -1],
      ["rightArm", 1],
    ]) {
      parts[name].rotation.set(
        -0.15 - charge * 1.45,
        0,
        -side * (0.09 + charge * 0.28),
      );
      for (const cue of ARENA.throws)
        if (cue.side === side && route >= cue.windup && route < cue.pass) {
          const windup = smooth(
            (route - cue.windup) / (cue.release - cue.windup),
          );
          const follow = 1 - smooth((route - cue.release) / 0.007);
          parts[name].rotation.x = -2.3 * windup * follow;
          parts[name].rotation.z = side * 0.12 * windup * follow;
        }
    }
    this.boss.updateWorldMatrix(true, true);
  }

  makeFracture() {
    this.debris = this.impactCells.map((cell, i) => {
      const distance = cell.position.distanceTo(this.impactPoint);
      const radial = cell.position.clone().sub(this.impactPoint).normalize();
      return {
        ...cell,
        delay: distance / 60 + hash(i + 6) * 0.28,
        velocity: radial
          .multiplyScalar(12 + hash(i + 12) * 19)
          .add(
            new THREE.Vector3(
              (hash(i + 5) - 0.5) * 12,
              -5 - hash(i + 9) * 10,
              (hash(i + 8) - 0.5) * 12,
            ),
          ),
        spin: new THREE.Vector3(
          hash(i + 2) * 4 - 2,
          hash(i + 4) * 5 - 2.5,
          hash(i + 3) * 3 - 1.5,
        ),
        split: i % 4 === 0,
      };
    });
    this.fragments = new THREE.InstancedMesh(
      box,
      crystalMaterial(0.75),
      this.debris.length,
    );
    this.fragments.frustumCulled = false;
    this.actors.add(this.fragments);
    this.microData = [];
    this.debris.forEach((cell, i) => {
      this.fragments.setColorAt(i, cell.color);
      if (cell.split)
        for (let j = 0; j < 8; j++) {
          const offset = new THREE.Vector3(
            j & 1 ? 0.25 : -0.25,
            j & 2 ? 0.25 : -0.25,
            j & 4 ? 0.25 : -0.25,
          )
            .multiply(cell.scale)
            .applyQuaternion(cell.rotation);
          this.microData.push({
            cell,
            offset,
            extra: new THREE.Vector3(
              hash(i * 8 + j) * 12 - 6,
              hash(i * 8 + j + 1) * 9 - 4.5,
              hash(i * 8 + j + 3) * 12 - 6,
            ),
          });
        }
    });
    this.micro = new THREE.InstancedMesh(
      box,
      crystalMaterial(0.55),
      this.microData.length,
    );
    this.micro.frustumCulled = false;
    this.microData.forEach(({ cell }, i) =>
      this.micro.setColorAt(i, cell.color),
    );
    this.actors.add(this.micro);
  }

  update({ route, time, duration, active }) {
    this.actors.visible =
      active && route > ARENA.start - 0.005 && route < ARENA.end + 0.012;
    const age = time - this.motion.progressAt(ARENA.impact) * duration;
    this.breakBeam.visible = age < 0.14 || !active;
    this.focusWeight =
      0.3 *
      smooth((route - 0.51) / 0.013) *
      (1 - smooth((route - 0.603) / 0.022));
    this.poseBoss(Math.min(route, ARENA.impact));
    this.focusTarget
      .copy(this.boss.position)
      .addScaledVector(
        this.frameAt(Math.max(0.568, Math.min(route, ARENA.impact) + 0.018))
          .normal,
        43,
      );
    this.boss.visible = age < 0;
    this.warmLight.position.copy(
      this.boss.localToWorld(new THREE.Vector3(0, 18, 22)),
    );
    this.warmLight.intensity = this.actors.visible && age < 0 ? 350 : 0;
    this.fragments.visible = this.micro.visible = age >= 0 && age < 7;
    this.impactLight.intensity =
      this.actors.visible && age >= 0 ? 1700 * Math.exp(-age * 2) : 0;
    if (this.fragments.visible) {
      this.debris.forEach((cell, i) => {
        const life = Math.max(0, age - cell.delay);
        dummy.position.copy(cell.position).addScaledVector(cell.velocity, life);
        dummy.position.y -= 4.905 * life * life;
        dummy.quaternion.copy(cell.rotation);
        dummy.rotateX(cell.spin.x * life);
        dummy.rotateY(cell.spin.y * life);
        dummy.rotateZ(cell.spin.z * life);
        const fade = 1 - smooth((life - 3.8) / 2.5);
        // A tiny positive scale keeps GPU normals valid while hiding split cells.
        dummy.scale
          .copy(cell.scale)
          .multiplyScalar(
            cell.split && life > 0 ? 0.00001 : Math.max(0.00001, fade),
          );
        dummy.updateMatrix();
        this.fragments.setMatrixAt(i, dummy.matrix);
      });
      this.microData.forEach(({ cell, offset, extra }, i) => {
        const life = age - cell.delay;
        dummy.position
          .copy(cell.position)
          .add(offset)
          .addScaledVector(cell.velocity, Math.max(0, life))
          .addScaledVector(extra, Math.max(0, life));
        dummy.position.y -= 4.905 * Math.max(0, life) ** 2;
        dummy.quaternion.copy(cell.rotation);
        dummy.rotateX(cell.spin.x * Math.max(0, life) * 2);
        dummy.rotateY(cell.spin.y * Math.max(0, life) * 2);
        dummy.scale
          .copy(cell.scale)
          .multiplyScalar(
            life > 0
              ? Math.max(0.00001, 0.47 * (1 - smooth((life - 3) / 2.6)))
              : 0.00001,
          );
        dummy.updateMatrix();
        this.micro.setMatrixAt(i, dummy.matrix);
      });
      this.fragments.instanceMatrix.needsUpdate = true;
      this.micro.instanceMatrix.needsUpdate = true;
    }
    this.projectiles.forEach(
      ({ group, cue, origin, target, normal, baseFlight, light }) => {
        const releaseTime = this.motion.progressAt(cue.release) * duration,
          passTime = this.motion.progressAt(cue.pass) * duration;
        const flight = (time - releaseTime) / (passTime - releaseTime);
        group.visible = route >= cue.windup && flight < 1.65;
        if (flight < 0) {
          const hand =
            this.boss.userData.parts[cue.side < 0 ? "leftHand" : "rightHand"];
          group.position.copy(hand.localToWorld(new THREE.Vector3(0, 0, 10)));
        } else
          group.position
            .lerpVectors(origin, target, flight)
            .addScaledVector(
              normal,
              0.5 * 9.81 * baseFlight ** 2 * flight * (1 - flight),
            );
        group.rotation.set(flight * 8, flight * 3.2, flight * 1.4);
        light.position.copy(group.position);
        light.intensity = this.actors.visible && group.visible ? 380 : 0;
      },
    );
  }
}
