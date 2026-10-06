import * as THREE from "three";
import { TARGETS, ARENA, smooth } from "./story.js";
export const FINAL_SCORE =
  TARGETS.length * 100 + ARENA.throws.length * 500 + 5000;
export const FINAL_GATE_ROUTE = 0.956;

export class Stagecraft {
  constructor(scene, frameAt) {
    this.frameAt = frameAt;
    this.root = new THREE.Group();
    scene.add(this.root);
    const metal = new THREE.MeshStandardMaterial({
      color: "#101b2d",
      roughness: 0.3,
      metalness: 0.55,
    });
    const glow = new THREE.MeshBasicMaterial({
      color: "#16769c",
      toneMapped: false,
    });
    const add = (parent, x, y, z, w, h, d, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const signs = [
      [0.023, "READY, PLAYER ONE", "BRAKES SOLD SEPARATELY", "#e5bd57"],
      [0.164, "SPEED LIMIT: LOL", "GRAVITY HAS THE WHEEL", "#ff8137"],
      [0.275, "INCOMING", "PEW PEW DEPARTMENT", "#83c59c"],
      [0.512, "DONKEY KONG", "EXPRESS BARREL DELIVERY", "#e5a25a"],
      [0.824, "FINAL WAVE", "PHYSICS HAS LEFT THE CHAT", "#5ec7e4"],
      [
        FINAL_GATE_ROUTE,
        "STAGE CLEAR",
        `${FINAL_SCORE.toLocaleString("en-US")}  /  PERFECT RUN`,
        "#e5bd57",
      ],
    ];
    for (const [t, title, sub, tint] of signs) {
      const f = frameAt(t),
        group = new THREE.Group();
      group.position.copy(f.point);
      group.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          f.right,
          f.normal,
          f.tangent.clone().negate(),
        ),
      );
      for (const side of [-1, 1]) {
        add(group, side * 15, 7, 0, 1.5, 14, 1.5, metal);
        add(group, side * 15, 7, 1, 0.2, 13, 0.2, glow);
      }
      add(group, 0, 15, 0, 32, 4.9, 1.7, metal);
      add(
        group,
        0,
        17.5,
        0,
        32,
        0.14,
        1.9,
        new THREE.MeshBasicMaterial({ color: tint }),
      );
      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 160;
        const c = canvas.getContext("2d");
        c.fillStyle = tint;
        c.textAlign = "center";
        c.font = "bold 62px monospace";
        c.fillText(title, 512, 70);
        c.font = "25px monospace";
        c.fillStyle = "#a9b7c5";
        c.fillText(sub, 512, 122);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(29, 4.5),
          new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        sign.position.set(0, 15, 1.01);
        group.add(sign);
      }
      this.root.add(group);
    }
    const count = 160;
    this.celebration = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      count,
    );
    this.celebration.frustumCulled = false;
    scene.add(this.celebration);
    for (let i = 0; i < count; i++)
      this.celebration.setColorAt(
        i,
        new THREE.Color(["#df8b32", "#52bdc1", "#d34d73"][i % 3]),
      );
  }
  update({ route, time, active }) {
    this.celebration.visible = active && route > 0.952;
    if (!this.celebration.visible) return;
    const f = this.frameAt(route),
      dummy = new THREE.Object3D();
    for (let i = 0; i < 160; i++) {
      const phase = (time * 0.55 + i * 0.071) % 1,
        side = i % 2 ? 1 : -1;
      dummy.position
        .copy(f.point)
        .addScaledVector(f.tangent, 20 + (i % 9) * 10)
        .addScaledVector(f.right, side * (15 + phase * 10))
        .addScaledVector(f.normal, 2 + Math.sin(phase * Math.PI) * 24);
      dummy.rotation.set(time + i, time * 0.8, 0);
      dummy.scale.setScalar(0.22 + Math.sin(phase * Math.PI) * 0.42);
      dummy.updateMatrix();
      this.celebration.setMatrixAt(i, dummy.matrix);
    }
    this.celebration.instanceMatrix.needsUpdate = true;
  }
}
