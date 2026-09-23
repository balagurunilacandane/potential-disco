// Builds merged, vertex-coloured box geometry so a whole room of voxels costs a single draw call.
import { BufferGeometry, Color, Float32BufferAttribute, MeshStandardMaterial } from 'three';

type V3 = [number, number, number];

// Each face: normal n and in-plane axes u, v with u × v = n (counter-clockwise from outside).
const FACES: { n: V3; u: V3; v: V3 }[] = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

interface Frame {
  x: number;
  y: number;
  z: number;
  rot: number;
}

const tmp = new Color();

export class VoxelBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];
  private stack: Frame[] = [{ x: 0, y: 0, z: 0, rot: 0 }];

  /** Enter a local frame translated by (x, y, z) and rotated `rot` radians around Y. */
  push(x: number, y: number, z: number, rot = 0) {
    const f = this.frame;
    const [wx, wz] = rotate(x, z, f.rot);
    this.stack.push({ x: f.x + wx, y: f.y + y, z: f.z + wz, rot: f.rot + rot });
    return this;
  }

  pop() {
    this.stack.pop();
    return this;
  }

  private get frame() {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Adds a box whose *bottom* centre is at (x, y, z) in the current frame.
   * `shade` randomly varies brightness for a hand-built voxel look.
   */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, shade = 0) {
    const f = this.frame;
    const [cx, cz] = rotate(x, z, f.rot);
    const center: V3 = [f.x + cx, f.y + y + h / 2, f.z + cz];
    const half: V3 = [w / 2, h / 2, d / 2];
    tmp.set(color);
    if (shade) tmp.multiplyScalar(1 + (Math.random() * 2 - 1) * shade);

    for (const { n, u, v } of FACES) {
      const base = this.pos.length / 3;
      const [nx, nz] = rotate(n[0], n[2], f.rot);
      for (const [a, b] of CORNERS) {
        const lx = (n[0] + u[0] * a + v[0] * b) * half[0];
        const ly = (n[1] + u[1] * a + v[1] * b) * half[1];
        const lz = (n[2] + u[2] * a + v[2] * b) * half[2];
        const [rx, rz] = rotate(lx, lz, f.rot);
        this.pos.push(center[0] + rx, center[1] + ly, center[2] + rz);
        this.nor.push(nx, n[1], nz);
        this.col.push(tmp.r, tmp.g, tmp.b);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

function rotate(x: number, z: number, rot: number): [number, number] {
  if (!rot) return [x, z];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x * c + z * s, -x * s + z * c];
}

export const voxelMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });

// ---------- shared furniture pieces ----------

const LEAF = ['#3f8f4a', '#4fa35a', '#2f7a3d', '#62b46a'];

/** A potted plant with a voxel foliage cluster. */
export function plant(b: VoxelBuilder, x: number, y: number, z: number, size = 1) {
  const s = size;
  b.box(x, y, z, 0.42 * s, 0.45 * s, 0.42 * s, '#f1efea');
  b.box(x, y + 0.45 * s, z, 0.46 * s, 0.05 * s, 0.46 * s, '#3b3b3b');
  const leaves: V3[] = [
    [0, 0.5, 0], [0.18, 0.62, 0.1], [-0.2, 0.7, -0.05], [0.05, 0.85, -0.18], [-0.1, 0.95, 0.15],
    [0.2, 1.0, -0.1], [0, 1.15, 0], [-0.24, 0.55, 0.2], [0.26, 0.8, 0.22], [-0.15, 1.1, -0.2],
  ];
  leaves.forEach(([lx, ly, lz], i) => {
    const w = (0.22 + (i % 3) * 0.05) * s;
    b.box(x + lx * s, y + ly * s, z + lz * s, w, w * 0.9, w, LEAF[i % LEAF.length], 0.06);
  });
}

/** Office chair with the backrest on local -z (the sitter faces +z). */
export function chair(b: VoxelBuilder, x: number, z: number, color = '#2b2d31') {
  b.box(x, 0, z, 0.5, 0.05, 0.5, '#1d1f22');
  b.box(x, 0.05, z, 0.07, 0.36, 0.07, '#8b8f96');
  b.box(x, 0.41, z, 0.52, 0.08, 0.5, color);
  b.box(x, 0.5, z - 0.26, 0.5, 0.62, 0.08, color);
  b.box(x - 0.28, 0.5, z, 0.05, 0.2, 0.36, '#1d1f22');
  b.box(x + 0.28, 0.5, z, 0.05, 0.2, 0.36, '#1d1f22');
}
