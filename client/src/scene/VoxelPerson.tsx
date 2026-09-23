// A chibi voxel worker. Geometry is generated from an Appearance; animation is driven through the Rig refs.
import { useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { Color, type BufferGeometry, type Group, type Mesh } from 'three';
import type { Appearance } from '../../../shared/types.ts';
import { VoxelBuilder, voxelMaterial } from './voxels.ts';

export interface Rig {
  root: RefObject<Group>;
  body: RefObject<Group>;
  head: RefObject<Group>;
  armL: RefObject<Group>;
  armR: RefObject<Group>;
  legL: RefObject<Group>;
  legR: RefObject<Group>;
  mug: RefObject<Mesh>;
}

export function useRig(): Rig {
  return {
    root: useRef<Group>(null!),
    body: useRef<Group>(null!),
    head: useRef<Group>(null!),
    armL: useRef<Group>(null!),
    armR: useRef<Group>(null!),
    legL: useRef<Group>(null!),
    legR: useRef<Group>(null!),
    mug: useRef<Mesh>(null!),
  };
}

/** Joint heights (root-local, standing). */
export const HIP_Y = 0.42;
export const SHOULDER_Y = 0.84;
export const NECK_Y = 0.88;

interface Parts {
  head: BufferGeometry;
  torso: BufferGeometry;
  arm: BufferGeometry;
  leg: BufferGeometry;
}

const partsCache = new Map<string, Parts>();

function shade(hex: string, k: number) {
  return `#${new Color(hex).multiplyScalar(k).getHexString()}`;
}

function buildParts(a: Appearance): Parts {
  const key = JSON.stringify(a);
  const hit = partsCache.get(key);
  if (hit) return hit;

  // Head — pivot at the neck, face towards +z.
  const h = new VoxelBuilder();
  h.box(0, 0, 0, 0.16, 0.04, 0.14, a.skin);
  h.box(0, 0.02, 0, 0.56, 0.52, 0.52, a.skin);
  if (a.glasses) {
    for (const x of [-0.12, 0.12]) {
      h.box(x, 0.18, 0.272, 0.18, 0.15, 0.02, '#15171a');
      h.box(x, 0.2, 0.284, 0.13, 0.11, 0.01, '#cfe2f5');
      h.box(x, 0.22, 0.291, 0.05, 0.07, 0.01, '#1b1b1b');
    }
    h.box(0, 0.27, 0.272, 0.08, 0.025, 0.02, '#15171a');
  } else {
    for (const x of [-0.12, 0.12]) {
      h.box(x, 0.19, 0.265, 0.07, 0.11, 0.02, '#1b1b1b');
      h.box(x - 0.015, 0.265, 0.277, 0.025, 0.03, 0.01, '#ffffff');
    }
  }
  for (const x of [-0.19, 0.19]) h.box(x, 0.13, 0.262, 0.08, 0.04, 0.012, '#f2a0a0');
  h.box(0, 0.09, 0.262, 0.07, 0.025, 0.012, '#8a4b3a');

  const hair = a.hair;
  const shortHair = () => {
    h.box(0, 0.5, 0, 0.6, 0.14, 0.56, hair);
    h.box(0, 0.14, -0.27, 0.6, 0.46, 0.08, hair);
    h.box(0, 0.42, 0.27, 0.6, 0.12, 0.06, hair);
    h.box(-0.1, 0.36, 0.28, 0.2, 0.08, 0.04, hair);
    for (const x of [-0.29, 0.29]) h.box(x, 0.28, -0.02, 0.05, 0.28, 0.5, hair);
  };
  switch (a.hairStyle) {
    case 'short':
      shortHair();
      break;
    case 'long':
      shortHair();
      for (const x of [-0.305, 0.305]) h.box(x, -0.08, -0.04, 0.07, 0.62, 0.46, hair);
      h.box(0, -0.12, -0.28, 0.62, 0.7, 0.1, hair);
      break;
    case 'bun':
      shortHair();
      h.box(0, 0.62, -0.14, 0.26, 0.22, 0.26, hair);
      break;
    case 'spiky':
      shortHair();
      for (const [x, z, s] of [[-0.18, -0.1, 0.16], [0, 0.06, 0.18], [0.18, -0.12, 0.15], [-0.05, -0.2, 0.14], [0.12, 0.14, 0.13]]) {
        h.box(x, 0.6, z, s, s, s, hair);
      }
      break;
    case 'cap': {
      const cap = shade(a.shirt, 0.55);
      h.box(0, 0.14, -0.27, 0.6, 0.36, 0.08, hair);
      for (const x of [-0.29, 0.29]) h.box(x, 0.2, -0.04, 0.05, 0.28, 0.44, hair);
      h.box(0, 0.44, -0.01, 0.62, 0.22, 0.6, cap);
      h.box(0, 0.44, 0.36, 0.56, 0.05, 0.26, cap);
      h.box(0, 0.52, 0.305, 0.14, 0.08, 0.01, '#f4f1ea');
      break;
    }
    case 'bald':
      for (const x of [-0.29, 0.29]) h.box(x, 0.22, -0.04, 0.05, 0.16, 0.4, hair);
      break;
  }
  if (a.beard) {
    h.box(0, 0.0, 0.25, 0.56, 0.15, 0.07, hair);
    h.box(0, 0.12, 0.283, 0.22, 0.04, 0.02, hair);
  }
  if (a.headphones) {
    const top = a.hairStyle === 'bald' ? 0.54 : 0.64;
    h.box(0, top, 0, 0.66, 0.06, 0.1, '#23262b');
    for (const x of [-0.32, 0.32]) {
      h.box(x, 0.3, 0, 0.05, top - 0.3, 0.06, '#23262b');
      h.box(x, 0.12, 0, 0.1, 0.22, 0.22, '#23262b');
      h.box(x * 1.16, 0.16, 0, 0.01, 0.14, 0.14, '#e5484d');
    }
  }

  // Torso — pivot at the hip.
  const t = new VoxelBuilder();
  t.box(0, 0, 0, 0.44, 0.08, 0.26, a.pants);
  t.box(0, 0.06, 0, 0.44, 0.4, 0.26, a.shirt);
  t.box(0, 0.12, 0.131, 0.04, 0.3, 0.01, shade(a.shirt, 0.8));

  // Arm — pivot at the shoulder, hangs down.
  const arm = new VoxelBuilder();
  arm.box(0, -0.24, 0, 0.14, 0.26, 0.16, a.shirt);
  arm.box(0, -0.42, 0, 0.12, 0.18, 0.13, a.skin);

  // Leg — pivot at the hip, hangs down.
  const leg = new VoxelBuilder();
  leg.box(0, -0.34, 0, 0.17, 0.36, 0.2, a.pants);
  leg.box(0, -0.42, 0.02, 0.18, 0.08, 0.24, '#2a2a2a');

  const parts = { head: h.build(), torso: t.build(), arm: arm.build(), leg: leg.build() };
  partsCache.set(key, parts);
  return parts;
}

const mugGeometry = new VoxelBuilder()
  .box(0, 0, 0, 0.12, 0.14, 0.12, '#f4f1ea')
  .box(0.08, 0.03, 0, 0.04, 0.07, 0.03, '#f4f1ea')
  .box(0, 0.13, 0, 0.09, 0.012, 0.09, '#5a3a24')
  .build();

export function VoxelPerson({ appearance, rig, children }: { appearance: Appearance; rig: Rig; children?: ReactNode }) {
  const parts = useMemo(() => buildParts(appearance), [appearance]);
  return (
    <group ref={rig.root}>
      <group ref={rig.body}>
        <group ref={rig.legL} position={[-0.1, HIP_Y, 0]}>
          <mesh geometry={parts.leg} material={voxelMaterial} castShadow />
        </group>
        <group ref={rig.legR} position={[0.1, HIP_Y, 0]}>
          <mesh geometry={parts.leg} material={voxelMaterial} castShadow />
        </group>
        <mesh geometry={parts.torso} material={voxelMaterial} position={[0, HIP_Y, 0]} castShadow />
        <group ref={rig.armL} position={[-0.29, SHOULDER_Y, 0]}>
          <mesh geometry={parts.arm} material={voxelMaterial} castShadow />
        </group>
        <group ref={rig.armR} position={[0.29, SHOULDER_Y, 0]}>
          <mesh geometry={parts.arm} material={voxelMaterial} castShadow />
          <mesh ref={rig.mug} geometry={mugGeometry} material={voxelMaterial} position={[0, -0.5, 0.08]} visible={false} />
        </group>
        <group ref={rig.head} position={[0, NECK_Y, 0]}>
          <mesh geometry={parts.head} material={voxelMaterial} castShadow />
        </group>
      </group>
      {children}
    </group>
  );
}

/** Frame-rate independent smoothing toward a target. */
export function damp(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export function dampAngle(current: number, target: number, rate: number, dt: number) {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-rate * dt));
}
