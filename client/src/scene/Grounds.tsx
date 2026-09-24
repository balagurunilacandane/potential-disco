// The building the office sits in: a floating floor slab with walkways to the brain and landscaping.
import { useMemo } from 'react';
import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Team } from '../../../shared/types.ts';
import { select } from '../lib/store.ts';
import { CELL_X, CELL_Z, ROOM_D, ROOM_W, slotPosition, walkway } from './layout.ts';
import { plazaTexture, softShadowTexture } from './textures.ts';
import { VoxelBuilder, plant, voxelMaterial } from './voxels.ts';

const SLAB_DEPTH = 1.6;

function tree(b: VoxelBuilder, x: number, z: number, size = 1, planter = true) {
  const s = size;
  if (planter) {
    b.box(x, 0, z, 1.3 * s, 0.45 * s, 1.3 * s, '#e9e5de');
    b.box(x, 0.45 * s, z, 1.36 * s, 0.06 * s, 1.36 * s, '#5b4a3a');
  }
  b.box(x, planter ? 0.5 * s : 0.1, z, 0.24 * s, (planter ? 1.5 : 1.9) * s, 0.24 * s, '#7a5a3c');
  const canopy: [number, number, number, number][] = [
    [0, 1.7, 0, 1.5], [0.35, 1.95, 0.2, 1.0], [-0.4, 2.05, -0.1, 1.05], [0.1, 2.5, -0.3, 1.1], [-0.15, 2.9, 0.15, 0.85], [0.25, 3.25, 0, 0.55],
  ];
  const greens = ['#3f8f4a', '#4fa35a', '#2f7a3d', '#5cae62'];
  canopy.forEach(([cx, cy, cz, w], i) => b.box(x + cx * s, cy * s, z + cz * s, w * s, w * 0.8 * s, w * s, greens[i % greens.length], 0.05));
}

function bench(b: VoxelBuilder, x: number, z: number, rot: number) {
  b.push(x, 0, z, rot);
  b.box(-0.8, 0, 0, 0.1, 0.4, 0.5, '#3a3c40');
  b.box(0.8, 0, 0, 0.1, 0.4, 0.5, '#3a3c40');
  b.box(0, 0.4, 0, 2.0, 0.08, 0.55, '#c99a63');
  b.pop();
}

/** A small park that fills a grid cell no team uses yet. */
function garden(b: VoxelBuilder, x: number, z: number, seed: number) {
  const w = ROOM_W;
  const d = ROOM_D;
  const lawn = ['#9ccc84', '#a3d08a', '#96c67f'][seed % 3];
  b.box(x, 0, z, w, 0.14, d, '#d9d2c4');
  b.box(x, 0, z, w - 0.5, 0.16, d - 0.5, lawn);
  b.box(x, 0, z, 1.6, 0.17, d - 0.5, '#efe9df');
  b.box(x, 0, z, w - 0.5, 0.17, 1.6, '#efe9df');
  // Fountain in the middle.
  b.box(x, 0.17, z, 3.2, 0.45, 3.2, '#dcd6cc');
  b.box(x, 0.17, z, 2.7, 0.5, 2.7, '#7cc3e8');
  b.box(x, 0.62, z, 0.5, 0.7, 0.5, '#dcd6cc');
  b.box(x, 1.32, z, 1.0, 0.12, 1.0, '#dcd6cc');
  b.box(x, 1.44, z, 0.3, 0.3, 0.3, '#9fd8f2');
  // Trees and hedges in each quarter, varied per cell.
  for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const jitter = ((seed * 7 + qx * 3 + qz * 5) % 3) * 0.5;
    tree(b, x + qx * (4.6 + jitter), z + qz * 3.4, 0.95 + jitter * 0.1, false);
    if ((seed + qx + qz) % 2 === 0) tree(b, x + qx * 6.6, z + qz * (1.9 + jitter), 0.75, false);
    b.box(x + qx * 2.6, 0.16, z + qz * 4.9, 2.2, 0.5, 0.8, '#5a9e55', 0.05);
  }
  bench(b, x, z - 2.7, 0);
  bench(b, x, z + 2.7, Math.PI);
}

function buildGrounds(teams: Team[], halfX: number, halfZ: number, ring: number) {
  const b = new VoxelBuilder();
  const sx = halfX * 2;
  const sz = halfZ * 2;

  // Floating slab: a pale lip, a light body and a darker foot so it reads as a diorama base.
  b.box(0, -0.18, 0, sx + 0.24, 0.18, sz + 0.24, '#f6f4f0');
  b.box(0, -SLAB_DEPTH + 0.3, 0, sx, SLAB_DEPTH - 0.48, sz, '#d9dee6');
  b.box(0, -SLAB_DEPTH, 0, sx - 0.2, 0.3, sz - 0.2, '#b8c0cc');

  // Parks in every cell of the grid that has no room yet.
  const used = new Set(teams.map((t) => slotPosition(t.slot).join(',')));
  for (let cx = -ring; cx <= ring; cx++) {
    for (let cz = -ring; cz <= ring; cz++) {
      if (cx === 0 && cz === 0) continue;
      const x = cx * CELL_X;
      const z = cz * CELL_Z;
      if (!used.has(`${x},${z}`)) garden(b, x, z, Math.abs(cx * 3 + cz * 5));
    }
  }

  // Walkways from each room to the brain, with a channel for the running light strip.
  for (const team of teams) {
    const w = walkway(team.slot);
    if (w.length <= 0.5) continue;
    b.push(w.x, 0, w.z, w.angle);
    b.box(0, 0, 0, 2.4, 0.02, w.length, '#d6cdbf');
    b.box(0, 0, 0, 2.1, 0.03, w.length, '#f8f5ef');
    b.box(0, 0, 0, 0.34, 0.034, w.length - 0.4, '#2c3038');
    b.box(0.2, 0, 0, 0.06, 0.036, w.length - 0.4, team.color);
    b.box(-0.2, 0, 0, 0.06, 0.036, w.length - 0.4, team.color);
    b.pop();
  }

  // Planters and benches at corridor crossings, trees on the corners.
  const reachX = halfX - 2.5;
  const reachZ = halfZ - 2.5;
  for (let i = -8; i <= 8; i++) {
    for (let j = -8; j <= 8; j++) {
      const gx = (i + 0.5) * CELL_X;
      const gz = (j + 0.5) * CELL_Z;
      if (Math.abs(gx) > reachX || Math.abs(gz) > reachZ) continue;
      // Crossings next to the brain carry the diagonal walkways.
      if (Math.max(Math.abs(i + 0.5), Math.abs(j + 0.5)) < 1.5) continue;
      if ((i + j) % 2 === 0) plant(b, gx, 0, gz, 2.4);
      else bench(b, gx, gz, (i % 2) * (Math.PI / 2));
    }
  }
  for (const ex of [-1, 1]) {
    for (const ez of [-1, 1]) tree(b, ex * (halfX - 1.4), ez * (halfZ - 1.4), 1.0);
  }
  return b.build();
}

export function Grounds({ teams, extent }: { teams: Team[]; extent: number }) {
  const ring = Math.max(1, Math.round(extent / CELL_X - 0.5));
  const halfX = (ring + 0.5) * CELL_X + 1.5;
  const halfZ = (ring + 0.5) * CELL_Z + 1.5;
  const half = Math.max(halfX, halfZ);
  const geometry = useMemo(() => buildGrounds(teams, halfX, halfZ, ring), [teams, halfX, halfZ, ring]);
  const floor = useMemo(() => {
    const tex = plazaTexture().clone();
    tex.repeat.set(halfX / 2, halfZ / 2);
    tex.needsUpdate = true;
    return new MeshStandardMaterial({ map: tex, roughness: 0.95 });
  }, [halfX, halfZ]);
  const shadow = useMemo(
    () => new MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false }),
    [],
  );

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.002}
        material={floor}
        receiveShadow
        onClick={(e) => {
          if (e.delta < 5) select(null);
        }}
      >
        <planeGeometry args={[halfX * 2, halfZ * 2]} />
      </mesh>
      <mesh geometry={geometry} material={voxelMaterial} castShadow receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position-y={-SLAB_DEPTH - 0.4} material={shadow} renderOrder={-1}>
        <planeGeometry args={[half * 3.2, half * 3.2]} />
      </mesh>
    </group>
  );
}
