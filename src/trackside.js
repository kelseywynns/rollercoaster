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
          t < 0.234
            ? "#285cba"
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
        const color = side < 0 ? hue : "#147b98";
        add(f, [side * 8.6, -0.8], [2.1, 1.5, 5.9], "#17284c");
        add(f, [side * 8.6, 0.04], [0.3, 0.15, 4.3], color, 1);
        if (i % 2 === 0) {
          add(f, [side * 9.2, 2.2], [0.8, 4.4, 0.85], "#192650");
          add(f, [side * 9.2, 4.6], [0.6, 0.25, 0.6], color, 1);
          add(f, [side * 9.2, 2.5], [0.85, 0.16, 0.88], "#ffae32", 1);
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
          if (t < 0.234) {
            // Pac-Man maze walls: deep cobalt turns and warm dotted pellet lanes.
            const mazeHeight = i % 9 === 0 ? 7 : 3.5;
            add(f, [x, mazeHeight / 2], [10, mazeHeight, 10], "#101b54");
            for (const z of [-4.8, 4.8])
              add(
                f,
                [x, mazeHeight + 0.05, z],
                [10.2, 0.18, 0.18],
                "#2860f0",
                1,
              );
            for (const edge of [-4.8, 4.8])
              add(
                f,
                [x + edge, mazeHeight + 0.05, 0],
                [0.18, 0.18, 10.2],
                "#2860f0",
                1,
              );
            // Negative-space square openings keep the maze silhouette legible.
            if (i % 9 === 0) {
              add(f, [x, mazeHeight + 3, -3.8], [10, 6, 2.2], "#13236c");
              add(
                f,
                [x, mazeHeight + 6.1, -3.8],
                [10.2, 0.22, 2.4],
                "#315fff",
                1,
              );
            }
            for (let pellet = 0; pellet < 4; pellet++)
              add(
                f,
                [side * 12.7, 0.8, pellet * 3 - 4.5],
                [0.7, 0.7, 0.7],
                pellet === 0 && i % 12 === 0 ? "#ffd862" : "#bc9253",
                3,
              );
          } else if (t < 0.5) {
            // Invader bunkers: stepped emerald shelters, with the iconic arch cutout.
            const rows = [
              "..XXXXXXX..",
              ".XXXXXXXXX.",
              "XXXXXXXXXXX",
              "XXXXXXXXXXX",
              "XXXX...XXXX",
              "XXX.....XXX",
            ];
            rows.forEach((row, y) =>
              [...row].forEach((v, k) => {
                if (v === "X")
                  add(
                    f,
                    [x + (k - 5) * 0.88, 5.2 - y * 0.88, 0],
                    [0.84, 0.84, 4.4],
                    ["#286644", "#318455", "#52a46a"][(y + k) % 3],
                    3,
                  );
              }),
            );
            if (i % 9 === 0) {
              for (let level = 0; level < 4; level++)
                add(
                  f,
                  [x + side * 7, level * 2.4 + 1.2, -2],
                  [2.1, 2.2, 2.1],
                  level % 2 ? "#232c66" : "#343f7a",
                );
              add(f, [x + side * 7, 10, -2], [2.5, 0.25, 2.5], "#756eb2", 1);
            }
          } else {
            // Arcade buildings: inset windows, stepped roofs, luminous side fins.
            add(f, [x, h / 2], [7, h, 7], "#182747");
            add(f, [x, h + 1.2], [5.1, 2.4, 5.1], "#273751");
            for (let w = -1; w <= 1; w++)
              for (let y = 3; y < h; y += 3.3)
                add(
                  f,
                  [x + w * 1.9, y, 3.56],
                  [1.0, 1.3, 0.12],
                  (w + i) % 3 ? "#1c718b" : "#af6230",
                  1,
                );
            add(f, [x - side * 3.6, h / 2], [0.14, h * 0.7, 0.65], color, 1);
          }
        }
        if (i % 15 === 0 && t > 0.272 && t < 0.47) {
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
