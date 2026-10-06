import * as THREE from "three";
import { crystalMaterial, pixelGeometry } from "./materials.js";
import { BOOSTS, TUNNELS, JUMPS } from "./story.js";

const box = new THREE.BoxGeometry(1, 1, 1);
const rand = (i, n = 0) => {
  const v = Math.sin(i * 91.73 + n * 17.13) * 43758.54;
  return v - Math.floor(v);
};

// Four instanced batches keep thousands of close landmarks inexpensive.
export class Trackside {
  constructor(scene, frameAt, length) {
    this.landmarks = [];
    this.items = [[], [], [], []];
    this.root = new THREE.Group();
    scene.add(this.root);
    const add = (frame, offset, size, color, batch = 0) => {
      const o = new THREE.Object3D();
      o.position
        .copy(frame.point)
        .addScaledVector(frame.right, offset[0])
        .addScaledVector(frame.normal, offset[1])
        .addScaledVector(frame.tangent, offset[2] || 0);
      o.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          frame.right,
          frame.normal,
          frame.tangent.clone().negate(),
        ),
      );
      o.scale.set(...size);
      o.updateMatrix();
      this.items[batch].push({ matrix: o.matrix.clone(), color });
    };
    // Paired kerbs and reflective studs every six metres, including next to jumps.
    const count = Math.ceil(length / 6);
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        f = frameAt(t),
        hue =
          t < 0.16
            ? "#ff157d"
            : t < 0.5
              ? "#644bff"
              : t < 0.66
                ? "#ff571d"
                : "#00d6ab";
      for (const side of [-1, 1]) {
        this.landmarks.push({
          route: t,
          side,
          position: f.point.clone().addScaledVector(f.right, side * 9.2),
        });
        const color = side < 0 ? hue : "#00cfff";
        add(f, [side * 8.6, -0.8], [2.1, 1.5, 5.9], "#17284c");
        add(f, [side * 8.6, 0.04], [0.3, 0.15, 4.3], color, 1);
        if (i % 2 === 0) {
          add(f, [side * 9.2, 2.2], [0.8, 4.4, 0.85], "#192650");
          add(f, [side * 9.2, 4.6], [1.2, 0.8, 1.2], color, 1);
          add(f, [side * 9.2, 2.5], [0.94, 0.35, 1], "#ffae32", 1);
        }
        const inside = TUNNELS.some(
          (q) => t > q.start - 0.002 && t < q.end + 0.002,
        );
        if (inside || (t > 0.506 && t < 0.65)) continue;
        if (i % 3 === 0) {
          const h = 7 + rand(i, side) * 10;
          const x = side * (19 + rand(i, 5) * 5);
          add(f, [x, -4], [15, 5, 17], "#172448");
          add(f, [x, -1.35], [15, 0.4, 17], "#143c69");
          if (t < 0.16) {
            // Tiny blossom gardens frame the lift, with branch and leaf silhouettes.
            add(f, [x, h / 2], [1.8, h, 1.8], "#55265e");
            for (let a = -1; a <= 1; a++)
              for (let b = -1; b <= 1; b++) {
                add(
                  f,
                  [x + a * 3.5, h + (1 - Math.abs(a)) * 2.7, b * 3.2],
                  [3.6, 3.3, 3.6],
                  ["#d00879", "#fa1689", "#a612dd"][(i + a + b + 8) % 3],
                  2,
                );
              }
            add(f, [x, h + 3], [0.65, 1.4, 0.65], "#ff9d20", 1);
          } else if (t < 0.5) {
            // Irregular surface-voxel geodes: low clusters reveal the islands,
            // occasional branching formations create a close, taller silhouette.
            const tall = i % 9 === 0;
            const unit = 1.05;
            const palette =
              side < 0
                ? ["#6821da", "#9715c8", "#c51d98"]
                : ["#034bd1", "#077db4", "#1dbdc2"];
            for (let c = 0; c < (tall ? 3 : 2); c++) {
              const levels =
                Math.floor((tall ? h * 0.82 : h * 0.27) / unit) +
                (c === 1 ? 2 : 0);
              for (let y = 0; y < levels; y++) {
                const taper = y > levels - 3 ? 0 : 1;
                for (let u = -taper; u <= taper; u++)
                  for (let v = -taper; v <= taper; v++) {
                    if (u === 0 && v === 0 && y > 0 && y < levels - 1) continue;
                    const lean = Math.floor(y / 4) * (c - 1) * 0.75;
                    add(
                      f,
                      [
                        x + (c - 1) * 3.3 + u * unit + lean,
                        y * unit + 0.6,
                        v * unit + (c - 1) * 2,
                      ],
                      [unit * 0.94, unit * 0.94, unit * 0.94],
                      palette[(y + u + v + c + 12) % 3],
                      3,
                    );
                  }
              }
            }
            for (let chip = 0; chip < 5; chip++)
              add(
                f,
                [
                  x + (rand(i, chip) - 0.5) * 11,
                  -0.45,
                  (rand(chip, i) - 0.5) * 10,
                ],
                [1.1, 0.85, 1.1],
                palette[chip % 3],
                3,
              );
          } else {
            // Arcade buildings: inset windows, stepped roofs, luminous side fins.
            add(f, [x, h / 2], [7, h, 7], "#23255d");
            add(f, [x, h + 1.2], [5.1, 2.4, 5.1], "#383285");
            for (let w = -1; w <= 1; w++)
              for (let y = 3; y < h; y += 3.3)
                add(
                  f,
                  [x + w * 1.9, y, 3.56],
                  [1.0, 1.3, 0.12],
                  (w + i) % 3 ? "#066cb9" : "#fc198e",
                  1,
                );
            add(f, [x - side * 3.6, h / 2], [0.25, h * 0.7, 2.2], color, 1);
          }
        }
        if (i % 15 === 0) {
          // Larger second-depth landmarks provide parallax against the small kerbs.
          const x = side * (36 + rand(i, 13) * 10),
            h = 14 + rand(i, 8) * 22;
          for (let k = 0; k < 4; k++)
            add(
              f,
              [x, -8 + ((k + 0.5) * h) / 4],
              [14 - k * 2, h / 4, 13 - k],
              ["#132b57", "#233378", "#272256", "#403272"][k],
            );
          add(f, [x, h - 6], [5, 0.5, 5], color, 1);
          // Original pixel sigils break up the skyline without filling the sky.
          const glyph =
            i % 2
              ? ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."]
              : [".XX..", "XXX..", ".XXX.", "..XX.", ".X..."];
          glyph.forEach((row, y) =>
            [...row].forEach((v, k) => {
              if (v === "X")
                add(
                  f,
                  [x + (k - 2) * 1.2, h - 1 - y * 1.2, 7],
                  [1.05, 1.05, 0.65],
                  side < 0 ? "#ee176f" : "#06cfa2",
                  3,
                );
            }),
          );
        }
      }
    }
    // Booster pads are physical chevrons, followed by induction pylons.
    for (const start of BOOSTS) {
      for (let k = 0; k < 7; k++) {
        const f = frameAt(start + k * 0.0024);
        for (const side of [-1, 1]) {
          for (let q = 0; q < 4; q++)
            add(
              f,
              [side * (q + 0.7), 0.14, -q * 0.85],
              [0.82, 0.25, 1.2],
              "#baff31",
              1,
            );
          add(f, [side * 7, 1.8], [1.4, 3.6, 1.4], "#31497a");
          add(f, [side * 7, 3.8], [1.7, 0.5, 1.7], "#99ff13", 1);
        }
      }
    }
    for (const jump of JUMPS) {
      // Warning teeth and split landing wings make the track separation legible.
      for (const t of [jump.start - 0.001, jump.end + 0.001]) {
        const f = frameAt(t);
        for (const side of [-1, 1]) {
          add(f, [side * 6.4, -0.2], [2, 1.5, 6], "#ffc422", 2);
          for (let q = 0; q < 3; q++)
            add(
              f,
              [side * 6.4, 0.65, -q * 1.8],
              [2.1, 0.18, 0.7],
              "#ff9d11",
              1,
            );
          add(f, [side * 6.4, 0.7], [2.1, 0.2, 2], "#ff493d", 1);
        }
      }
    }
    const materials = [
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.35,
        roughness: 0.47,
      }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.18,
        roughness: 0.34,
        emissive: 0xffffff,
        emissiveIntensity: 0.045,
        vertexColors: false,
      }),
      crystalMaterial(0.11),
    ];
    this.meshes = this.items.map((items, n) => {
      const mesh = new THREE.InstancedMesh(
        n === 3 ? pixelGeometry : box,
        materials[n],
        items.length,
      );
      items.forEach((v, i) => {
        mesh.setMatrixAt(i, v.matrix);
        mesh.setColorAt(i, new THREE.Color(v.color));
      });
      mesh.computeBoundingSphere();
      this.root.add(mesh);
      return mesh;
    });
  }
}
