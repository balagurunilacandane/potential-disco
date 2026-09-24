// The central server room: glass walls, blinking racks and database stacks around the brain hologram.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { select, useWorld } from '../lib/store.ts';
import { fx } from '../lib/fx.ts';
import { BRAIN_HALF, WALL_H } from './layout.ts';
import { CoreAssembly } from './BrainCore.tsx';
import { brainSignTexture, floorTexture } from './textures.ts';
import { VoxelBuilder, voxelMaterial } from './voxels.ts';

const FRAME = '#1b1d22';
const CYAN = new Color('#39d0ff');

interface Rack {
  x: number;
  z: number;
  rot: number;
}

const RACKS: Rack[] = [
  ...[-4.9, -3.6, -2.3, 2.3, 3.6, 4.9].map((x) => ({ x, z: -5.5, rot: 0 })),
  ...[-3.6, -2.3, 2.3, 3.6].map((z) => ({ x: -5.5, z, rot: Math.PI / 2 })),
];
const DB_STACKS: [number, number][] = [
  [4.6, -2.8],
  [4.6, 2.8],
  [-2.8, 4.6],
  [2.8, 4.6],
];

function buildShell() {
  const b = new VoxelBuilder();
  const h = BRAIN_HALF;
  b.box(0, 0, 0, h * 2 + 0.4, 0.06, h * 2 + 0.4, '#141820');
  // Glass frame: posts, top rail and a sill around each side.
  const posts = [-h, -h / 2, h / 2, h];
  for (const p of posts) {
    for (const q of [-h, h]) {
      b.box(p, 0, q, 0.14, WALL_H, 0.14, FRAME);
      b.box(q, 0, p, 0.14, WALL_H, 0.14, FRAME);
    }
  }
  for (const q of [-h, h]) {
    b.box(0, WALL_H, q, h * 2 + 0.14, 0.1, 0.14, FRAME);
    b.box(q, WALL_H, 0, 0.14, 0.1, h * 2 + 0.14, FRAME);
    for (const [a, c] of [[-h, -1.1], [1.1, h]]) {
      b.box((a + c) / 2, 0, q, c - a, 0.12, 0.14, FRAME);
      b.box(q, 0, (a + c) / 2, 0.14, 0.12, c - a, FRAME);
    }
  }
  // Server racks.
  for (const r of RACKS) {
    b.push(r.x, 0, r.z, r.rot);
    b.box(0, 0, 0, 1.2, 2.3, 0.9, '#15171c');
    for (let i = 0; i < 6; i++) b.box(0, 0.25 + i * 0.34, 0.451, 1.02, 0.05, 0.01, '#2b303a');
    b.box(0, 2.3, 0, 1.24, 0.05, 0.94, '#2b303a');
    b.pop();
  }
  // Core pedestal.
  b.box(0, 0.06, 0, 2.6, 0.24, 2.6, '#20242d');
  b.box(0, 0.3, 0, 1.9, 0.5, 1.9, '#2a2f3a');
  b.box(0, 0.8, 0, 1.3, 0.25, 1.3, '#333946');
  // Database stacks.
  for (const [x, z] of DB_STACKS) {
    for (let i = 0; i < 3; i++) b.box(x, 0.06 + i * 0.52, z, 1.1, 0.44, 1.1, '#2a2f3a');
    b.box(x, 1.62, z, 1.14, 0.06, 1.14, '#3a4150');
  }
  return b.build();
}

const dummy = new Object3D();

/** Blinking LEDs on every rack plus glowing bands on the database stacks. */
function Lights() {
  const leds = useRef<InstancedMesh>(null!);
  const positions = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const r of RACKS) {
      const c = Math.cos(r.rot);
      const s = Math.sin(r.rot);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
          const lx = -0.42 + col * 0.1;
          const lz = 0.46;
          out.push([r.x + lx * c + lz * s, 0.35 + row * 0.34, r.z - lx * s + lz * c]);
        }
      }
    }
    return out;
  }, []);
  const seeds = useMemo(() => positions.map(() => [Math.random() * 10, 0.5 + Math.random() * 3, Math.random()]), [positions]);
  const green = useMemo(() => new Color('#3dff9a').multiplyScalar(2.5), []);
  const amber = useMemo(() => new Color('#ffb224').multiplyScalar(2.5), []);
  const off = useMemo(() => new Color('#1d2a24'), []);

  useLayoutEffect(() => {
    positions.forEach((p, i) => {
      dummy.position.set(...p);
      dummy.updateMatrix();
      leds.current.setMatrixAt(i, dummy.matrix);
      leds.current.setColorAt(i, green);
    });
    leds.current.instanceMatrix.needsUpdate = true;
  }, [positions, green]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const burst = Math.exp(-(t - fx.brainPulse) * 4);
    seeds.forEach(([phase, speed, kind], i) => {
      const on = Math.sin(t * speed * (1 + burst * 4) + phase) > -0.2;
      leds.current.setColorAt(i, on ? (kind > 0.85 ? amber : green) : off);
    });
    leds.current.instanceColor!.needsUpdate = true;
  });

  const band = useMemo(() => new MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(2), toneMapped: false }), []);
  useFrame((state) => {
    band.color.copy(CYAN).multiplyScalar(1.4 + Math.sin(state.clock.elapsedTime * 3) * 0.6 + Math.exp(-(state.clock.elapsedTime - fx.brainPulse) * 3) * 2);
  });

  return (
    <>
      <instancedMesh args={[undefined, undefined, positions.length]} ref={leds}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {DB_STACKS.flatMap(([x, z]) =>
        [0, 1, 2].map((i) => (
          <mesh key={`${x}-${z}-${i}`} position={[x, 0.53 + i * 0.52, z]} material={band}>
            <boxGeometry args={[1.12, 0.05, 1.12]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 1.08, 0]} material={band}>
        <boxGeometry args={[1.34, 0.04, 1.34]} />
      </mesh>
    </>
  );
}

export function Brain() {
  const shell = useMemo(buildShell, []);
  const memoryCount = useWorld((s) => s.stats.memoryCount);
  const selected = useWorld((s) => s.selection?.kind === 'brain');
  // An <Html> label mounted on the scene's very first frame never paints, so mount it a tick later.
  const [labelReady, setLabelReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setLabelReady(true), 0);
    return () => clearTimeout(id);
  }, []);
  const glass = useMemo(
    () => new MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }),
    [],
  );
  const floor = useMemo(() => {
    const tex = floorTexture(true).clone();
    tex.repeat.set(BRAIN_HALF * 2, BRAIN_HALF * 2);
    tex.needsUpdate = true;
    return new MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.3 });
  }, []);
  const sign = useMemo(() => new MeshBasicMaterial({ map: brainSignTexture(), toneMapped: false }), []);
  const h = BRAIN_HALF;
  const panes: [number, number, number, number][] = [];
  for (const [a, c] of [[-h, -1.1], [1.1, h]]) {
    panes.push([(a + c) / 2, -h, c - a, 0], [(a + c) / 2, h, c - a, 0], [-h, (a + c) / 2, c - a, 1], [h, (a + c) / 2, c - a, 1]);
  }

  const open = () => select({ kind: 'brain' }, { x: 0, z: 0, zoom: 32 });

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta < 5) open();
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh geometry={shell} material={voxelMaterial} castShadow receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position-y={0.065} material={floor} receiveShadow>
        <planeGeometry args={[h * 2, h * 2]} />
      </mesh>
      {panes.map(([x, z, len, axis], i) => (
        <mesh key={i} position={[x, 0.12 + (WALL_H - 0.12) / 2, z]} material={glass} renderOrder={2}>
          <boxGeometry args={axis ? [0.04, WALL_H - 0.12, len] : [len, WALL_H - 0.12, 0.04]} />
        </mesh>
      ))}
      <mesh position={[0, WALL_H + 0.75, -h]} material={sign}>
        <planeGeometry args={[5.2, 1.02]} />
      </mesh>
      <CoreAssembly />
      <Lights />
      {labelReady && (
        <Html position={[0, 7.4, 0]} center zIndexRange={[10, 0]}>
          <button
            className={`brain-label${selected ? ' selected' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            <span className="brain-dot" />
            Central Brain · {memoryCount.toLocaleString()} memories
          </button>
        </Html>
      )}
    </group>
  );
}
