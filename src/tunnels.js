import * as THREE from "three";
import { TUNNELS, CRASH } from "./story.js";

export const TUNNEL_SECTION = [
  [-12, -3],
  [-12, 12],
  [-8, 18],
  [8, 18],
  [12, 12],
  [12, -3],
];

export function buildTunnels(scene, frameAt, length) {
  const root = new THREE.Group();
  root.name = "Three enclosed neon tunnels";
  scene.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const shell = new THREE.MeshStandardMaterial({
    color: "#182344",
    roughness: 0.5,
    metalness: 0.5,
    side: THREE.DoubleSide,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: "#3a315a",
    roughness: 0.35,
    metalness: 0.7,
  });
  const local = (frame, x, y) =>
    frame.point
      .clone()
      .addScaledVector(frame.right, x)
      .addScaledVector(frame.normal, y);
  const beam = (a, b, width, depth, material, tangent) => {
    const mesh = new THREE.Mesh(box, material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    const along = b.clone().sub(a).normalize();
    const cross = new THREE.Vector3().crossVectors(along, tangent).normalize();
    mesh.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(cross, along, tangent),
    );
    mesh.scale.set(width, a.distanceTo(b) + width * 0.3, depth);
    root.add(mesh);
  };
  for (const tunnel of TUNNELS) {
    const steps = Math.ceil(((tunnel.end - tunnel.start) * length) / 5);
    const positions = [];
    for (let i = 0; i < steps; i++) {
      const f0 = frameAt(
        tunnel.start + ((tunnel.end - tunnel.start) * i) / steps,
      );
      const f1 = frameAt(
        tunnel.start + ((tunnel.end - tunnel.start) * (i + 1)) / steps,
      );
      for (let j = 0; j < TUNNEL_SECTION.length; j++) {
        const s0 = TUNNEL_SECTION[j],
          s1 = TUNNEL_SECTION[(j + 1) % TUNNEL_SECTION.length];
        const a = local(f0, ...s0),
          b = local(f0, ...s1),
          c = local(f1, ...s1),
          d = local(f1, ...s0);
        for (const v of [a, b, c, a, c, d]) positions.push(v.x, v.y, v.z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.computeVertexNormals();
    root.add(new THREE.Mesh(geometry, shell));
    const lights = [tunnel.color, tunnel.accent].map(
      (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    );
    const rings = Math.ceil(((tunnel.end - tunnel.start) * length) / 13);
    for (let i = 0; i <= rings; i++) {
      const frame = frameAt(
        tunnel.start + ((tunnel.end - tunnel.start) * i) / rings,
      );
      for (let j = 0; j < TUNNEL_SECTION.length - 1; j++) {
        const a = local(frame, ...TUNNEL_SECTION[j]),
          b = local(frame, ...TUNNEL_SECTION[j + 1]);
        beam(a, b, 1.05, 1.5, trim, frame.tangent);
        // Slightly inside the shell: luminous strips remain visible from the car.
        const s0 = TUNNEL_SECTION[j],
          s1 = TUNNEL_SECTION[j + 1];
        beam(
          local(frame, s0[0] * 0.93, (s0[1] - 6) * 0.93 + 6),
          local(frame, s1[0] * 0.93, (s1[1] - 6) * 0.93 + 6),
          0.3,
          0.5,
          lights[i % 2],
          frame.tangent,
        );
      }
      if (i === 0 || i === rings) {
        for (const side of [-1, 1])
          beam(
            local(frame, side * 13.5, -3),
            local(frame, side * 13.5, 16),
            3.8,
            6,
            trim,
            frame.tangent,
          );
        beam(
          local(frame, -13.5, 19),
          local(frame, 13.5, 19),
          3.4,
          6,
          trim,
          frame.tangent,
        );
      }
    }
  }
  // A bright warning chevron makes the obstacle in the collision readable.
  const frame = frameAt(CRASH.targetT);
  const warning = new THREE.MeshBasicMaterial({
    color: "#ffb17b",
    toneMapped: false,
  });
  for (let i = 0; i < 3; i++)
    beam(
      local(frame, 12.15, 6 + i * 2.5),
      local(frame, 14.8, 7 + i * 2.5),
      0.45,
      6.3,
      warning,
      frame.tangent,
    );
  return root;
}
