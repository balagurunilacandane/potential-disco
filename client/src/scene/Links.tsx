// Each room is wired to the brain: a comms tower beside the room, a glowing cable up to the brain's
// input ring, and a light strip in the walkway floor. Sync packets travel desk → tower → cable → brain.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
  type Mesh,
} from 'three';
import type { Team } from '../../../shared/types.ts';
import { CLIMB, arrive, fx } from '../lib/fx.ts';
import { TOWER_HEIGHT, linkCurve, towerBase, walkway } from './layout.ts';
import { flowMaterial } from './shaders.ts';
import { VoxelBuilder, voxelMaterial } from './voxels.ts';

const dummy = new Object3D();
const tmpColor = new Color();
const KNOWLEDGE = '#7fe3ff';

const towerCache = new Map<string, ReturnType<VoxelBuilder['build']>>();

/** Lattice comms mast with a band in the team colour. */
function towerGeometry(color: string) {
  const hit = towerCache.get(color);
  if (hit) return hit;
  const b = new VoxelBuilder();
  const steel = '#3a3f48';
  b.box(0, 0, 0, 1.1, 0.22, 1.1, '#2c3038');
  b.box(0, 0.22, 0, 0.8, 0.08, 0.8, color);
  for (const [x, z] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) {
    b.box(x, 0.3, z, 0.08, TOWER_HEIGHT - 0.55, 0.08, steel);
  }
  for (let y = 0.9; y < TOWER_HEIGHT - 0.4; y += 0.75) {
    b.box(0, y, -0.24, 0.52, 0.05, 0.05, steel);
    b.box(0, y, 0.24, 0.52, 0.05, 0.05, steel);
    b.box(-0.24, y, 0, 0.05, 0.05, 0.52, steel);
    b.box(0.24, y, 0, 0.05, 0.05, 0.52, steel);
  }
  b.box(0, TOWER_HEIGHT - 0.3, 0, 0.72, 0.12, 0.72, '#2c3038');
  b.box(0, 1.6, 0, 0.6, 0.14, 0.6, color);
  // Small dish facing outwards.
  b.box(0.42, TOWER_HEIGHT - 1.1, 0, 0.08, 0.42, 0.42, '#e7eaee');
  b.box(0.5, TOWER_HEIGHT - 0.95, 0, 0.1, 0.12, 0.12, '#9aa0a8');
  const g = b.build();
  towerCache.set(color, g);
  return g;
}

function Link({ team }: { team: Team }) {
  const curve = useMemo(() => linkCurve(team.slot), [team.slot]);
  const length = useMemo(() => curve.getLength(), [curve]);
  const base = useMemo(() => towerBase(team.slot), [team.slot]);
  const path = useMemo(() => walkway(team.slot), [team.slot]);

  const core = useMemo(() => new TubeGeometry(curve, 96, 0.055, 6, false), [curve]);
  const halo = useMemo(() => new TubeGeometry(curve, 96, 0.2, 8, false), [curve]);
  const coreMat = useMemo(() => flowMaterial({ color: team.color, tip: KNOWLEDGE, length, alpha: 1 }), [team.color, length]);
  const haloMat = useMemo(() => flowMaterial({ color: team.color, tip: KNOWLEDGE, length, alpha: 0.16 }), [team.color, length]);
  const strip = useMemo(() => new PlaneGeometry(0.2, Math.max(0.1, path.length - 0.6)), [path.length]);
  const stripMat = useMemo(
    () => flowMaterial({ color: team.color, tip: KNOWLEDGE, length: path.length, alpha: 0.9, axis: 1, speed: 3.5 }),
    [team.color, path.length],
  );
  const beacon = useRef<Mesh>(null!);
  const beaconMat = useMemo(() => new MeshBasicMaterial({ color: team.color, toneMapped: false }), [team.color]);
  const baseColor = useMemo(() => new Color(team.color), [team.color]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const sent = fx.sent.get(team.slot) ?? -10;
    // The cable flares while this room's latest upload is on its way.
    const since = t - sent;
    const boost = since < 0 ? 0 : Math.exp(-Math.max(0, since - CLIMB) * 1.6) * (since > CLIMB * 0.6 ? 1 : 0.3);
    for (const m of [coreMat, haloMat, stripMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uBoost.value = boost;
    }
    const blink = Math.sin(t * 3 + team.slot) > 0.2 ? 1 : 0.4;
    const flash = Math.exp(-Math.max(0, since - CLIMB) * 3) * (since >= 0 ? 1 : 0);
    beaconMat.color.copy(baseColor).multiplyScalar(1.2 + blink * 1.3 + flash * 5);
    beacon.current.scale.setScalar(1 + flash * 0.6);
  });

  return (
    <group>
      <mesh geometry={core} material={coreMat} renderOrder={3} />
      <mesh geometry={halo} material={haloMat} renderOrder={3} />
      <group position={[base.x, 0, base.z]}>
        <mesh geometry={towerGeometry(team.color)} material={voxelMaterial} castShadow receiveShadow />
        <mesh ref={beacon} position-y={TOWER_HEIGHT + 0.12} material={beaconMat}>
          <boxGeometry args={[0.34, 0.34, 0.34]} />
        </mesh>
      </group>
      {path.length > 1 && (
        <group position={[path.x, 0.045, path.z]} rotation-y={path.angle}>
          <mesh geometry={strip} material={stripMat} rotation-x={Math.PI / 2} renderOrder={2} />
        </group>
      )}
    </group>
  );
}

const TRAIL = 7;
const MAX_PACKETS = 60;
const DOWNLINKS = 2;

/** Position of a packet `u` (0..1) along its route: a hop up to the tower, then the cable. */
function packetPoint(from: Vector3, slot: number, u: number, climb: number, out: Vector3) {
  const curve = linkCurve(slot);
  if (u < climb) {
    const k = u / climb;
    const e = k * k * (3 - 2 * k);
    const a = 1 - e;
    const top = curve.v0;
    const cx = (from.x + top.x) / 2;
    const cz = (from.z + top.z) / 2;
    const cy = Math.max(from.y, top.y) + 2.2;
    return out.set(
      a * a * from.x + 2 * a * e * cx + e * e * top.x,
      a * a * from.y + 2 * a * e * cy + e * e * top.y,
      a * a * from.z + 2 * a * e * cz + e * e * top.z,
    );
  }
  const k = (u - climb) / (1 - climb);
  return curve.getPoint(Math.min(1, k * k * (1.6 - 0.6 * k)), out);
}

export function Links({ teams }: { teams: Team[] }) {
  const mesh = useRef<InstancedMesh>(null!);
  const count = MAX_PACKETS * TRAIL + teams.length * DOWNLINKS * TRAIL;
  const geometry = useMemo(() => new BoxGeometry(0.26, 0.26, 0.26), []);
  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  const knowledge = useMemo(() => new Color(KNOWLEDGE), []);
  const pos = useMemo(() => new Vector3(), []);

  useLayoutEffect(() => {
    // Allocate the colour buffer up front so the shader compiles with instance colours.
    for (let i = 0; i < count; i++) mesh.current.setColorAt(i, tmpColor.set('#ffffff'));
    mesh.current.count = 0;
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    let n = 0;
    const put = (p: Vector3, scale: number, color: Color, bright: number, spin: number) => {
      dummy.position.copy(p);
      dummy.rotation.set(spin, spin * 1.3, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(n, dummy.matrix);
      mesh.current.setColorAt(n, tmpColor.copy(color).multiplyScalar(bright));
      n++;
    };

    // Uploads from agents: bright comets in the team colour.
    fx.packets = fx.packets.filter((pk) => {
      const u = (t - pk.start) / pk.duration;
      if (u >= 1) {
        arrive(t, pk.slot);
        return false;
      }
      if (u < 0 || n >= MAX_PACKETS * TRAIL) return true;
      const climb = CLIMB / pk.duration;
      const color = tmpColor.set(pk.color).clone();
      for (let k = 0; k < TRAIL; k++) {
        const uk = u - k * 0.014;
        if (uk < 0) break;
        const fade = 1 - k / TRAIL;
        put(packetPoint(pk.from, pk.slot, uk, climb, pos), (uk < 0.05 ? uk * 20 : 1) * (0.35 + 0.65 * fade) * (k === 0 ? 1.15 : 1), color, 1.5 + fade * 3, t * 4);
      }
      return true;
    });

    // Knowledge flowing back from the brain to every room.
    for (const team of teams) {
      const curve = linkCurve(team.slot);
      for (let d = 0; d < DOWNLINKS; d++) {
        const u = 1 - ((t * 0.16 + d / DOWNLINKS + team.slot * 0.13) % 1);
        for (let k = 0; k < TRAIL - 2; k++) {
          const uk = u + k * 0.012;
          if (uk > 1) break;
          const fade = 1 - k / (TRAIL - 2);
          put(curve.getPoint(uk, pos), 0.45 * (0.4 + 0.6 * fade), knowledge, 1 + fade * 1.8, t * 2);
        }
      }
    }

    mesh.current.count = n;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <>
      {teams.map((t) => (
        <Link key={t.id} team={t} />
      ))}
      <instancedMesh key={count} ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
    </>
  );
}
