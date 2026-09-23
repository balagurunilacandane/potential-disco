// Data links from every room to the brain, plus the packets agents upload when they sync.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
} from 'three';
import type { Team } from '../../../shared/types.ts';
import { fx } from '../lib/fx.ts';
import { BRAIN_CORE, roomUplink } from './layout.ts';

const dummy = new Object3D();
const tmpColor = new Color();
const DOWNLINK = new Color('#7fe3ff').multiplyScalar(2.2);
const PULSES_UP = 3;
const PULSES_DOWN = 1;

function linkCurve(slot: number) {
  const start = roomUplink(slot);
  const mid = start.clone().lerp(BRAIN_CORE, 0.5);
  mid.y = Math.max(start.y, BRAIN_CORE.y) + 4 + start.distanceTo(BRAIN_CORE) * 0.12;
  return new QuadraticBezierCurve3(start, mid, BRAIN_CORE.clone());
}

function Link({ team }: { team: Team }) {
  const curve = useMemo(() => linkCurve(team.slot), [team.slot]);
  const tube = useMemo(() => new TubeGeometry(curve, 48, 0.045, 5, false), [curve]);
  const start = curve.v0;
  return (
    <group>
      <mesh geometry={tube}>
        <meshBasicMaterial color={team.color} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh position={[start.x, start.y + 0.12, start.z]} castShadow>
        <boxGeometry args={[0.6, 0.24, 0.6]} />
        <meshStandardMaterial color="#23262b" />
      </mesh>
      <mesh position={[start.x, start.y + 0.25, start.z]}>
        <boxGeometry args={[0.3, 0.03, 0.3]} />
        <meshBasicMaterial color={new Color(team.color).multiplyScalar(2.5)} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Links({ teams }: { teams: Team[] }) {
  const pulses = useRef<InstancedMesh>(null!);
  const curves = useMemo(
    () => teams.map((t) => ({ curve: linkCurve(t.slot), color: new Color(t.color).multiplyScalar(2.6), speed: 0.18 + (t.slot % 3) * 0.03 })),
    [teams],
  );
  const count = Math.max(1, teams.length * (PULSES_UP + PULSES_DOWN));
  const geometry = useMemo(() => new BoxGeometry(0.2, 0.2, 0.2), []);
  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    let i = 0;
    const p = new Vector3();
    for (const { curve, color, speed } of curves) {
      for (let k = 0; k < PULSES_UP + PULSES_DOWN; k++) {
        const up = k < PULSES_UP;
        let u = (t * speed + k / (PULSES_UP + PULSES_DOWN)) % 1;
        if (!up) u = 1 - u;
        curve.getPoint(u, p);
        dummy.position.copy(p);
        dummy.rotation.set(t * 2 + k, t * 3, 0);
        dummy.scale.setScalar(up ? 1 : 0.7);
        dummy.updateMatrix();
        pulses.current.setMatrixAt(i, dummy.matrix);
        pulses.current.setColorAt(i, up ? color : DOWNLINK);
        i++;
      }
    }
    pulses.current.count = i;
    pulses.current.instanceMatrix.needsUpdate = true;
    if (pulses.current.instanceColor) pulses.current.instanceColor.needsUpdate = true;
  });

  return (
    <>
      {teams.map((t) => (
        <Link key={t.id} team={t} />
      ))}
      <instancedMesh key={count} ref={pulses} args={[geometry, material, count]} frustumCulled={false} />
    </>
  );
}

const MAX_PACKETS = 128;

export function Packets() {
  const mesh = useRef<InstancedMesh>(null!);
  const geometry = useMemo(() => new BoxGeometry(0.28, 0.28, 0.28), []);
  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  const control = useMemo(() => new Vector3(), []);
  const pos = useMemo(() => new Vector3(), []);

  useLayoutEffect(() => {
    // Allocate the colour buffer up front so the shader compiles with instance colours.
    for (let i = 0; i < MAX_PACKETS; i++) mesh.current.setColorAt(i, tmpColor.set('#ffffff'));
    mesh.current.count = 0;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    let n = 0;
    fx.packets = fx.packets.filter((pk) => {
      const u = (t - pk.start) / pk.duration;
      if (u >= 1) {
        fx.brainPulse = t;
        return false;
      }
      if (u < 0 || n >= MAX_PACKETS) return true;
      // Quadratic bezier arc from the agent's desk up and into the core.
      control.copy(pk.from).lerp(BRAIN_CORE, 0.5);
      control.y = Math.max(pk.from.y, BRAIN_CORE.y) + 6;
      const e = u * u * (3 - 2 * u);
      const a = 1 - e;
      pos.set(
        a * a * pk.from.x + 2 * a * e * control.x + e * e * BRAIN_CORE.x,
        a * a * pk.from.y + 2 * a * e * control.y + e * e * BRAIN_CORE.y,
        a * a * pk.from.z + 2 * a * e * control.z + e * e * BRAIN_CORE.z,
      );
      dummy.position.copy(pos);
      dummy.rotation.set(t * 4, t * 5, 0);
      dummy.scale.setScalar(u < 0.1 ? u * 10 : 1 - u * 0.4);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(n, dummy.matrix);
      mesh.current.setColorAt(n, tmpColor.set(pk.color).multiplyScalar(3.5));
      n++;
      return true;
    });
    mesh.current.count = n;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, MAX_PACKETS]} frustumCulled={false} />;
}
