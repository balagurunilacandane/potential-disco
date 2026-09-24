// The heart of the office: a holographic voxel brain on a projector, wired to every room through an
// input ring, with recent memories orbiting it. Reacts visibly whenever a room uploads something.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  TorusGeometry,
  type Group,
  type Mesh,
  type PointLight,
} from 'three';
import type { Team } from '../../../shared/types.ts';
import { useWorld } from '../lib/store.ts';
import { fx } from '../lib/fx.ts';
import { BRAIN_CORE, HALO_RADIUS, haloPort } from './layout.ts';
import { beamMaterial } from './shaders.ts';

const CYAN = new Color('#39d0ff');
const VIOLET = new Color('#9b6bff');
const PINK = new Color('#ff7ad9');
const PEDESTAL_TOP = 1.06;

const dummy = new Object3D();
const tmp = new Color();

interface Voxel {
  x: number;
  y: number;
  z: number;
  /** Surface normal (unit ellipsoid space). */
  nx: number;
  nz: number;
  phase: number;
  rate: number;
  base: Color;
}

/** Voxel shell of a brain: two hemispheres with a centre fissure and folded ridges. */
function brainVoxels(size = 0.15): Voxel[] {
  const a = 1.3;
  const b = 1.0;
  const c = 1.55;
  const out: Voxel[] = [];
  const n = Math.ceil(c / size) + 1;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      for (let k = -n; k <= n; k++) {
        const x = (i + 0.5) * size;
        const y = j * size;
        const z = k * size;
        const nx = x / a;
        const ny = y / b;
        const nz = z / c;
        if (ny < -0.72) continue; // flatter underside
        if (Math.abs(x) < size && ny > -0.35) continue; // fissure between the hemispheres
        const d = Math.hypot(nx, ny, nz);
        const ridge = 0.07 * Math.sin(x * 7 + z * 3) * Math.sin(y * 6 - z * 5);
        const r = d - ridge;
        if (r > 1 || r < 1 - (size * 1.7) / b) continue;
        const len = d || 1;
        const along = (z / c + 1) / 2;
        const base = along < 0.5 ? CYAN.clone().lerp(VIOLET, along * 2) : VIOLET.clone().lerp(PINK, (along - 0.5) * 2);
        out.push({ x, y, z, nx: nx / len, nz: nz / len, phase: Math.random() * 100, rate: 0.6 + Math.random() * 2.4, base });
      }
    }
  }
  return out;
}

/** Random connections between voxels, drawn as flickering lines inside the brain. */
function synapses(voxels: Voxel[], count: number) {
  const positions = new Float32Array(count * 6);
  const colors = new Float32Array(count * 6);
  const params: { phase: number; rate: number }[] = [];
  let made = 0;
  let guard = 0;
  while (made < count && guard++ < count * 50) {
    const p = voxels[Math.floor(Math.random() * voxels.length)];
    const q = voxels[Math.floor(Math.random() * voxels.length)];
    const dist = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
    if (dist < 0.6 || dist > 1.7) continue;
    positions.set([p.x * 0.85, p.y * 0.85, p.z * 0.85, q.x * 0.85, q.y * 0.85, q.z * 0.85], made * 6);
    params.push({ phase: Math.random() * 100, rate: 0.8 + Math.random() * 2 });
    made++;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setDrawRange(0, made * 2);
  return { geometry, params };
}

/** How strongly each recent arrival is still echoing (0..1). */
function arrivalEnergy(t: number, since: number, decay = 3) {
  return since < 0 ? 0 : Math.exp(-(t - since) * decay);
}

function BrainHologram() {
  const group = useRef<Group>(null!);
  const mesh = useRef<InstancedMesh>(null!);
  const inner = useRef<Mesh>(null!);
  const voxels = useMemo(() => brainVoxels(), []);
  const links = useMemo(() => synapses(voxels, 90), [voxels]);
  const geometry = useMemo(() => new BoxGeometry(0.12, 0.12, 0.12), []);
  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  const lineMaterial = useMemo(
    () => new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );
  const innerMaterial = useMemo(() => new MeshBasicMaterial({ color: '#dff8ff', toneMapped: false }), []);
  const innerGeometry = useMemo(() => new IcosahedronGeometry(0.42, 0), []);

  useLayoutEffect(() => {
    voxels.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      mesh.current.setColorAt(i, v.base);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [voxels]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = arrivalEnergy(t, fx.brainPulse, 3.5);
    const ry = t * 0.22;
    group.current.rotation.y = ry;
    group.current.position.y = BRAIN_CORE.y + Math.sin(t * 1.1) * 0.1;
    group.current.scale.setScalar(1 + pulse * 0.12 + Math.sin(t * 2.2) * 0.012);

    // Directions (in brain-local space) that data recently arrived from.
    const hits = fx.arrivals
      .filter((a) => t - a.t < 1.5)
      .map((a) => {
        const p = haloPort(a.slot);
        const len = Math.hypot(p.x, p.z) || 1;
        const wx = p.x / len;
        const wz = p.z / len;
        return {
          lx: wx * Math.cos(ry) - wz * Math.sin(ry),
          lz: wx * Math.sin(ry) + wz * Math.cos(ry),
          e: arrivalEnergy(t, a.t, 2.5),
        };
      });

    // A "thought" sweeps from front to back every few seconds.
    const cycle = (t % 4.5) / 1.8;
    const sweepZ = cycle < 1 ? -1.7 + cycle * 3.4 : 99;

    voxels.forEach((v, i) => {
      const fire = Math.max(0, Math.sin(t * v.rate + v.phase));
      let glow = 0.75 + Math.pow(fire, 18) * 2.8;
      glow += Math.exp(-((v.z - sweepZ) ** 2) / 0.05) * 1.3;
      for (const h of hits) glow += Math.pow(Math.max(0, v.nx * h.lx + v.nz * h.lz), 3) * h.e * 3.5;
      glow += pulse * 0.8;
      mesh.current.setColorAt(i, tmp.copy(v.base).multiplyScalar(glow));
    });
    mesh.current.instanceColor!.needsUpdate = true;

    const colors = links.geometry.getAttribute('color') as BufferAttribute;
    links.params.forEach((p, i) => {
      const f = Math.pow(Math.max(0, Math.sin(t * p.rate + p.phase)), 10) * 2.2 + 0.08 + pulse * 0.6;
      tmp.copy(CYAN).lerp(PINK, (i % 5) / 8).multiplyScalar(f);
      colors.setXYZ(i * 2, tmp.r, tmp.g, tmp.b);
      colors.setXYZ(i * 2 + 1, tmp.r, tmp.g, tmp.b);
    });
    colors.needsUpdate = true;

    inner.current.rotation.set(t * 0.7, t * 0.9, 0);
    inner.current.scale.setScalar(0.9 + Math.sin(t * 3) * 0.08 + pulse * 0.5);
    innerMaterial.color.set('#bff3ff').multiplyScalar(2.2 + pulse * 3);
  });

  return (
    <group ref={group} position={BRAIN_CORE}>
      <mesh ref={inner} geometry={innerGeometry} material={innerMaterial} />
      <instancedMesh ref={mesh} args={[geometry, material, voxels.length]} />
      <lineSegments geometry={links.geometry} material={lineMaterial} />
    </group>
  );
}

/** Light beam from the pedestal with particles rising into the brain. */
function Projector() {
  const beam = useMemo(() => beamMaterial('#39d0ff'), []);
  const height = BRAIN_CORE.y - 0.9 - PEDESTAL_TOP;
  const beamGeometry = useMemo(() => new CylinderGeometry(1.7, 0.55, height, 40, 1, true), [height]);
  const motes = useRef<InstancedMesh>(null!);
  const seeds = useMemo(() => Array.from({ length: 42 }, () => [Math.random() * Math.PI * 2, 0.2 + Math.random() * 0.8, 0.25 + Math.random() * 0.5, Math.random()]), []);
  const moteGeometry = useMemo(() => new BoxGeometry(0.07, 0.07, 0.07), []);
  const moteMaterial = useMemo(() => new MeshBasicMaterial({ color: new Color('#aef0ff').multiplyScalar(3), toneMapped: false }), []);
  const disc = useRef<Mesh>(null!);
  const discMaterial = useMemo(
    () => new MeshBasicMaterial({ color: new Color('#39d0ff').multiplyScalar(2), transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = arrivalEnergy(t, fx.brainPulse, 3);
    beam.uniforms.uTime.value = t;
    beam.uniforms.uBoost.value = pulse;
    seeds.forEach(([angle, radius, speed, offset], i) => {
      const k = (t * speed + offset) % 1;
      const r = (0.4 + k * 1.1) * radius;
      dummy.position.set(Math.cos(angle + t * 0.4) * r, PEDESTAL_TOP + k * (height + 0.9), Math.sin(angle + t * 0.4) * r);
      dummy.scale.setScalar(Math.sin(k * Math.PI));
      dummy.rotation.set(t, t, 0);
      dummy.updateMatrix();
      motes.current.setMatrixAt(i, dummy.matrix);
    });
    motes.current.instanceMatrix.needsUpdate = true;
    disc.current.rotation.z = t * 0.6;
    discMaterial.opacity = 0.45 + Math.sin(t * 2) * 0.1 + pulse * 0.5;
  });

  return (
    <group>
      <mesh geometry={beamGeometry} material={beam} position-y={PEDESTAL_TOP + height / 2} renderOrder={4} />
      <mesh ref={disc} rotation-x={-Math.PI / 2} position-y={PEDESTAL_TOP + 0.02} material={discMaterial}>
        <ringGeometry args={[0.35, 0.62, 6]} />
      </mesh>
      <instancedMesh ref={motes} args={[moteGeometry, moteMaterial, seeds.length]} frustumCulled={false} />
    </group>
  );
}

/** Input ring around the brain; each room's cable plugs into its own glowing port. */
function InputRing({ teams }: { teams: Team[] }) {
  const ring = useMemo(() => new TorusGeometry(HALO_RADIUS, 0.035, 6, 160), []);
  const ringMaterial = useMemo(() => new MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(1.8), toneMapped: false }), []);
  const ticks = useRef<Group>(null!);
  const ports = useRef<(Mesh | null)[]>([]);
  const spokes = useRef<(Mesh | null)[]>([]);
  const portMaterials = useMemo(() => teams.map((t) => new MeshBasicMaterial({ color: t.color, toneMapped: false })), [teams]);
  const spokeMaterials = useMemo(
    () => teams.map((t) => new MeshBasicMaterial({ color: t.color, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false })),
    [teams],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = arrivalEnergy(t, fx.brainPulse, 3);
    ringMaterial.color.copy(CYAN).multiplyScalar(1.5 + pulse * 2.5 + Math.sin(t * 2) * 0.2);
    ticks.current.rotation.y = -t * 0.3;
    teams.forEach((team, i) => {
      const last = [...fx.arrivals].reverse().find((a) => a.slot === team.slot);
      const e = last ? arrivalEnergy(t, last.t, 2.2) : 0;
      portMaterials[i].color.set(team.color).multiplyScalar(1.6 + e * 5 + Math.sin(t * 2.5 + i) * 0.3);
      ports.current[i]?.scale.setScalar(1 + e * 0.8);
      spokeMaterials[i].opacity = e * 0.9;
    });
  });

  return (
    <group>
      <mesh geometry={ring} material={ringMaterial} position-y={BRAIN_CORE.y} rotation-x={Math.PI / 2} />
      <group ref={ticks} position-y={BRAIN_CORE.y}>
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * (HALO_RADIUS + 0.28), 0, Math.sin(a) * (HALO_RADIUS + 0.28)]} rotation-y={-a} material={ringMaterial}>
              <boxGeometry args={[0.06, 0.06, i % 3 === 0 ? 0.3 : 0.14]} />
            </mesh>
          );
        })}
      </group>
      {teams.map((team, i) => {
        const p = haloPort(team.slot);
        const angle = Math.atan2(p.x, p.z);
        return (
          <group key={team.id}>
            <mesh ref={(m) => void (ports.current[i] = m)} position={p} rotation-y={angle} material={portMaterials[i]}>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
            </mesh>
            {/* Energy spoke from the port into the brain, visible when data arrives. */}
            <mesh
              ref={(m) => void (spokes.current[i] = m)}
              position={[p.x / 2, p.y, p.z / 2]}
              rotation={[Math.PI / 2, 0, -angle]}
              material={spokeMaterials[i]}
            >
              <cylinderGeometry args={[0.07, 0.07, HALO_RADIUS - 0.8, 6, 1, true]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

const SHARDS = 48;

/** The latest memories orbit the brain as small cubes coloured by the team that wrote them. */
function MemoryShards() {
  const mesh = useRef<InstancedMesh>(null!);
  const items = useWorld(
    useShallow((s) => s.memory.slice(0, SHARDS).map((m) => `${m.id}|${(m.teamId && s.teams[m.teamId]?.color) || '#7fe3ff'}`)),
  );
  const born = useRef(new Map<string, number>());
  const geometry = useMemo(() => new BoxGeometry(0.17, 0.17, 0.17), []);
  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  const parsed = useMemo(
    () =>
      items.map((key) => {
        const [id, color] = key.split('|');
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
        return { id, color: new Color(color), angle: (h % 628) / 100, radius: 3.6 + ((h >> 3) % 60) / 100, lift: (((h >> 5) % 140) - 70) / 100, speed: 0.12 + ((h >> 7) % 12) / 100 };
      }),
    [items],
  );

  useLayoutEffect(() => {
    for (let i = 0; i < SHARDS; i++) mesh.current.setColorAt(i, tmp.set('#ffffff'));
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    parsed.forEach((s, i) => {
      if (!born.current.has(s.id)) born.current.set(s.id, born.current.size < SHARDS && t < 1 ? -10 : t);
      const age = t - born.current.get(s.id)!;
      const grow = Math.min(1, age / 0.6);
      const a = s.angle + t * s.speed;
      // New shards shoot out of the brain before settling into orbit.
      const r = s.radius * (0.3 + 0.7 * (1 - Math.pow(1 - grow, 3)));
      dummy.position.set(Math.cos(a) * r, BRAIN_CORE.y + s.lift + Math.sin(t * 0.8 + s.angle) * 0.12, Math.sin(a) * r);
      dummy.rotation.set(t + i, t * 1.3, 0);
      dummy.scale.setScalar(grow * (1 + Math.max(0, 1 - age) * 0.8));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      mesh.current.setColorAt(i, tmp.copy(s.color).multiplyScalar(1.4 + Math.max(0, 1 - age) * 4));
    });
    mesh.current.count = parsed.length;
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor!.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, SHARDS]} frustumCulled={false} />;
}

const WAVES = 4;

/** Rings that ripple out across the floor and around the brain when data arrives. */
function Shockwaves() {
  const floor = useRef<(Mesh | null)[]>([]);
  const air = useRef<(Mesh | null)[]>([]);
  const floorGeometry = useMemo(() => new RingGeometry(0.92, 1, 64), []);
  const airGeometry = useMemo(() => new TorusGeometry(1, 0.02, 4, 96), []);
  const materials = useMemo(
    () =>
      Array.from({ length: WAVES * 2 }, () =>
        new MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(2.5), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      ),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const recent = fx.arrivals.slice(-WAVES);
    for (let i = 0; i < WAVES; i++) {
      const a = recent[i];
      const age = a ? t - a.t : 99;
      const k = Math.min(1, age / 1.4);
      const alive = age < 1.4;
      const f = floor.current[i];
      const r = air.current[i];
      if (f) {
        f.visible = alive;
        f.scale.setScalar(1 + k * 5.5);
        materials[i].opacity = (1 - k) * 0.7;
      }
      if (r) {
        r.visible = alive;
        r.scale.setScalar(1.4 + k * 3.2);
        materials[WAVES + i].opacity = (1 - k) * 0.9;
      }
    }
  });

  return (
    <group>
      {Array.from({ length: WAVES }, (_, i) => (
        <group key={i}>
          <mesh ref={(m) => void (floor.current[i] = m)} geometry={floorGeometry} material={materials[i]} rotation-x={-Math.PI / 2} position-y={0.1} visible={false} />
          <mesh ref={(m) => void (air.current[i] = m)} geometry={airGeometry} material={materials[WAVES + i]} rotation-x={Math.PI / 2} position-y={BRAIN_CORE.y} visible={false} />
        </group>
      ))}
    </group>
  );
}

export function CoreAssembly() {
  const teams = useWorld(useShallow((s) => Object.values(s.teams).sort((a, b) => a.slot - b.slot)));
  const light = useRef<PointLight>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    light.current.intensity = 16 + arrivalEnergy(t, fx.brainPulse, 3) * 40 + Math.sin(t * 2) * 2;
  });
  return (
    <group>
      <BrainHologram />
      <Projector />
      <InputRing teams={teams} />
      <MemoryShards />
      <Shockwaves />
      <pointLight ref={light} position={BRAIN_CORE} color="#8fdcff" distance={18} decay={1.6} intensity={16} />
    </group>
  );
}
