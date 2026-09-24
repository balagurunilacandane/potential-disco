// An agent in its room: sits and types, thinks, uploads to the brain, walks to meetings and coffee breaks.
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AdditiveBlending, Color, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { AgentStatus } from '../../../shared/types.ts';
import { select, useWorld } from '../lib/store.ts';
import { sendPacket } from '../lib/fx.ts';
import { AISLE_X, seatLayout, type SeatLayout } from './layout.ts';
import { VoxelBuilder, voxelMaterial } from './voxels.ts';
import { VoxelPerson, damp, dampAngle, useRig } from './VoxelPerson.tsx';
import { STATUS_META } from '../ui/status.ts';

const WALK_SPEED = 1.9;
const SEAT_LIFT = 0.07;

type Phase = 'seated' | 'standing' | 'walking' | 'atSpot' | 'sitting';

interface Sim {
  x: number;
  z: number;
  rot: number;
  sit: number;
  phase: Phase;
  target: 'seat' | 'spot';
  spotKind: AgentStatus;
  path: [number, number][];
  stride: number;
  spawnAt: number | null;
  lastStatus: AgentStatus;
}

const away = (s: AgentStatus) => s === 'meeting' || s === 'break';
const spotFor = (layout: SeatLayout, s: AgentStatus) => (s === 'break' ? layout.lounge : layout.meeting);

function pathToSpot(sim: Sim, layout: SeatLayout, status: AgentStatus): [number, number][] {
  const spot = spotFor(layout, status).pos;
  if (sim.x > AISLE_X + 0.2) return [[sim.x, layout.aisleZ], [AISLE_X, layout.aisleZ], spot];
  return [spot];
}

function pathToSeat(sim: Sim, layout: SeatLayout): [number, number][] {
  const [cx, cz] = layout.chair;
  if (sim.x < AISLE_X + 0.2) return [[AISLE_X, layout.aisleZ], [cx, layout.aisleZ], [cx, cz]];
  return [[cx, layout.aisleZ], [cx, cz]];
}

// Thought bubble and upload arrow share geometry across all agents.
const bubbleGeometry = new VoxelBuilder()
  .box(0, 0, 0, 0.08, 0.08, 0.08, '#ffffff')
  .box(0.1, 0.12, 0, 0.12, 0.12, 0.12, '#ffffff')
  .box(0.36, 0.3, 0, 0.62, 0.3, 0.18, '#ffffff')
  .box(0.36, 0.26, 0, 0.46, 0.4, 0.18, '#ffffff')
  .build();
const dotGeometry = new VoxelBuilder().box(0, 0, 0, 0.07, 0.07, 0.03, '#2b2d31').build();
const arrowGeometry = new VoxelBuilder()
  .box(0, 0, 0, 0.09, 0.22, 0.09, '#ffffff')
  .box(0, 0.22, 0, 0.3, 0.07, 0.09, '#ffffff')
  .box(0, 0.29, 0, 0.18, 0.07, 0.09, '#ffffff')
  .box(0, 0.36, 0, 0.07, 0.06, 0.09, '#ffffff')
  .build();

function easeOutBounce(x: number) {
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
}

const headPos = new Vector3();

export function Character({
  agentId,
  teamColor,
  slot,
  roomX,
  roomZ,
}: {
  agentId: string;
  teamColor: string;
  slot: number;
  roomX: number;
  roomZ: number;
}) {
  const agent = useWorld((s) => s.agents[agentId]);
  const selected = useWorld((s) => s.selection?.kind === 'agent' && s.selection.id === agentId);
  const hovered = useWorld((s) => s.hovered === agentId);
  const [fresh] = useState(() => useWorld.getState().fresh.has(agentId));
  const rig = useRig();
  const layout = useMemo(() => seatLayout(agent.seat), [agent.seat]);
  const phaseSeed = useMemo(() => agent.seat * 1.37 + agentId.charCodeAt(0) * 0.1, [agent.seat, agentId]);

  const bubble = useRef<Group>(null!);
  const dots = useRef<Mesh[]>([]);
  const arrow = useRef<Group>(null!);
  const ring = useRef<Mesh>(null!);
  const beam = useRef<Mesh>(null!);
  const status = useRef(agent.status);
  status.current = agent.status;

  const glow = useMemo(() => new Color(teamColor).multiplyScalar(3), [teamColor]);

  const sim = useRef<Sim>(null!);
  if (!sim.current) {
    // Agents that are already away when the page loads start at their spot.
    const out = away(agent.status) && !fresh;
    const spot = spotFor(layout, agent.status);
    sim.current = {
      x: out ? spot.pos[0] : layout.chair[0],
      z: out ? spot.pos[1] : layout.chair[1],
      rot: out ? spot.rot : 0,
      sit: out ? 0 : 1,
      phase: out ? 'atSpot' : 'seated',
      target: out ? 'spot' : 'seat',
      spotKind: agent.status,
      path: [],
      stride: 0,
      spawnAt: fresh ? -1 : null,
      lastStatus: agent.status,
    };
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;
    const s = sim.current;
    const st = status.current;
    const { root, body, head, armL, armR, legL, legR, mug } = rig;
    if (!root.current) return;

    if (st !== s.lastStatus) {
      if (st === 'syncing') {
        head.current.getWorldPosition(headPos);
        headPos.y += 0.6;
        sendPacket(headPos, teamColor, t, slot);
      }
      s.lastStatus = st;
    }

    // ---- decide where to be ----
    if (away(st)) {
      if (s.phase === 'seated' || s.phase === 'sitting') s.phase = 'standing';
      else if ((s.phase === 'walking' && s.target === 'seat') || (s.phase === 'atSpot' && s.spotKind !== st)) {
        s.path = s.phase === 'atSpot' ? [spotFor(layout, st).pos] : pathToSpot(s, layout, st);
        s.phase = 'walking';
        s.target = 'spot';
      }
      s.spotKind = st;
    } else if (s.phase === 'atSpot' || (s.phase === 'walking' && s.target === 'spot')) {
      s.path = pathToSeat(s, layout);
      s.phase = 'walking';
      s.target = 'seat';
    } else if (s.phase === 'standing') {
      s.phase = 'sitting';
    }

    // ---- move ----
    let moving = false;
    if (s.phase === 'standing') {
      s.sit = Math.max(0, s.sit - dt * 3);
      if (s.sit === 0) {
        s.path = pathToSpot(s, layout, st);
        s.phase = 'walking';
        s.target = 'spot';
      }
    } else if (s.phase === 'sitting') {
      s.sit = Math.min(1, s.sit + dt * 3);
      s.rot = dampAngle(s.rot, 0, 10, dt);
      if (s.sit === 1) s.phase = 'seated';
    } else if (s.phase === 'walking') {
      const next = s.path[0];
      if (!next) {
        if (s.target === 'spot') s.phase = 'atSpot';
        else {
          s.phase = 'sitting';
          [s.x, s.z] = layout.chair;
        }
      } else {
        const dx = next[0] - s.x;
        const dz = next[1] - s.z;
        const dist = Math.hypot(dx, dz);
        const step = WALK_SPEED * dt;
        if (dist <= step) {
          s.x = next[0];
          s.z = next[1];
          s.path.shift();
        } else {
          s.x += (dx / dist) * step;
          s.z += (dz / dist) * step;
          s.rot = dampAngle(s.rot, Math.atan2(dx, dz), 12, dt);
        }
        moving = dist > 0.001;
      }
    } else if (s.phase === 'atSpot') {
      s.rot = dampAngle(s.rot, spotFor(layout, s.spotKind).rot, 6, dt);
    } else {
      s.rot = dampAngle(s.rot, 0, 8, dt);
    }

    if (moving) s.stride += dt * 9;
    const swing = moving ? Math.sin(s.stride) * 0.6 : 0;
    const seated = s.phase === 'seated';
    const k = s.sit;

    // ---- pose ----
    let armLx = swing * 0.8;
    let armRx = -swing * 0.8;
    let armRz = 0;
    let headY = 0;
    let headX = 0;
    let headZ = 0;
    let bubbleOn = false;
    let arrowOn = false;
    let mugOn = false;

    if (seated) {
      if (st === 'thinking') {
        armLx = -1.15;
        armRx = -2.0;
        armRz = -0.35;
        headX = -0.12;
        headZ = 0.12 + Math.sin(t * 1.3 + phaseSeed) * 0.04;
        headY = 0.1;
        bubbleOn = true;
      } else {
        const speed = st === 'syncing' ? 26 : 16;
        armLx = -1.25 + Math.sin(t * speed + phaseSeed) * 0.1;
        armRx = -1.25 + Math.sin(t * speed + phaseSeed + 1.7) * 0.1;
        headY = 0.35 + Math.sin(t * 0.45 + phaseSeed) * 0.15;
        headX = 0.08 + Math.sin(t * 3 + phaseSeed) * 0.02;
        arrowOn = st === 'syncing';
      }
    } else if (s.phase === 'atSpot') {
      if (s.spotKind === 'break') {
        mugOn = true;
        const sip = Math.sin(t * 0.9 + phaseSeed) > 0.75;
        armRx = sip ? -2.2 : -1.3;
        armRz = sip ? -0.3 : 0;
        headX = sip ? -0.15 : Math.sin(t * 1.5 + phaseSeed) * 0.05;
        headY = Math.sin(t * 0.7 + phaseSeed) * 0.3;
      } else {
        const gesture = Math.sin(t * 0.8 + phaseSeed) > 0.6;
        armRx = gesture ? -1.7 + Math.sin(t * 6) * 0.15 : Math.sin(t * 1.2 + phaseSeed) * 0.05;
        armLx = Math.sin(t * 1.1 + phaseSeed) * 0.05;
        headX = Math.sin(t * 2 + phaseSeed) * 0.07;
        headY = Math.sin(t * 0.5 + phaseSeed) * 0.2;
      }
    }

    const r = 14;
    legL.current.rotation.x = damp(legL.current.rotation.x, -Math.PI / 2 * k + swing * (1 - k), r, dt);
    legR.current.rotation.x = damp(legR.current.rotation.x, -Math.PI / 2 * k - swing * (1 - k), r, dt);
    armL.current.rotation.x = damp(armL.current.rotation.x, armLx, r, dt);
    armR.current.rotation.x = damp(armR.current.rotation.x, armRx, r, dt);
    armR.current.rotation.z = damp(armR.current.rotation.z, armRz, r, dt);
    head.current.rotation.x = damp(head.current.rotation.x, headX, 8, dt);
    head.current.rotation.y = damp(head.current.rotation.y, headY, 6, dt);
    head.current.rotation.z = damp(head.current.rotation.z, headZ, 8, dt);
    body.current.position.y = SEAT_LIFT * k + (moving ? Math.abs(Math.sin(s.stride)) * 0.05 : 0) + Math.sin(t * 2 + phaseSeed) * 0.006;
    mug.current.visible = mugOn;

    // ---- overlays ----
    const bs = damp(bubble.current.scale.x, bubbleOn ? 1 : 0, 10, dt);
    bubble.current.scale.setScalar(bs);
    bubble.current.visible = bs > 0.02;
    bubble.current.position.y = 1.62 + Math.sin(t * 2) * 0.04;
    dots.current.forEach((d, i) => d.scale.setScalar(Math.floor(t * 3) % 4 > i ? 1 : 0.001));
    const as = damp(arrow.current.scale.x, arrowOn ? 1 : 0, 10, dt);
    arrow.current.scale.setScalar(as);
    arrow.current.visible = as > 0.02;
    arrow.current.position.y = 1.72 + ((t * 1.5) % 1) * 0.25;

    ring.current.visible = selected || hovered;
    ring.current.rotation.z = t * 0.8;
    ring.current.scale.setScalar(1 + Math.sin(t * 4) * 0.06);

    // ---- spawn: drop in from the sky on a beam of light ----
    let y = 0;
    let scale = 1;
    if (s.spawnAt !== null) {
      if (s.spawnAt < 0) s.spawnAt = t;
      const p = Math.min(1, (t - s.spawnAt) / 1.1);
      y = 6 * (1 - easeOutBounce(p));
      scale = 0.5 + 0.5 * Math.min(1, p * 2);
      const fade = Math.max(0, 1 - (t - s.spawnAt) / 1.8);
      beam.current.visible = fade > 0;
      (beam.current.material as MeshBasicMaterial).opacity = fade * 0.5;
      beam.current.scale.set(1 + (1 - fade) * 0.6, 1, 1 + (1 - fade) * 0.6);
      if (fade === 0) s.spawnAt = null;
    }

    root.current.position.set(s.x, y, s.z);
    root.current.rotation.y = s.rot;
    root.current.scale.setScalar(scale);
  });

  const meta = STATUS_META[agent.status];

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 5) return;
        select({ kind: 'agent', id: agentId }, { x: roomX + sim.current.x, z: roomZ + sim.current.z, zoom: 55 });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        useWorld.setState({ hovered: agentId });
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
        if (useWorld.getState().hovered === agentId) useWorld.setState({ hovered: null });
      }}
    >
      <VoxelPerson appearance={agent.appearance} rig={rig}>
        <group ref={bubble} position={[0.3, 1.62, 0.05]} visible={false}>
          <mesh geometry={bubbleGeometry} material={voxelMaterial} />
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              ref={(m) => {
                if (m) dots.current[i] = m;
              }}
              geometry={dotGeometry}
              material={voxelMaterial}
              position={[0.22 + i * 0.14, 0.42, 0.1]}
            />
          ))}
        </group>
        <group ref={arrow} visible={false}>
          <mesh geometry={arrowGeometry}>
            <meshBasicMaterial color={glow} toneMapped={false} />
          </mesh>
        </group>
        <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.03} visible={false}>
          <ringGeometry args={[0.46, 0.58, 6]} />
          <meshBasicMaterial color={teamColor} toneMapped={false} />
        </mesh>
        <mesh ref={beam} position-y={4} visible={false}>
          <cylinderGeometry args={[0.55, 0.55, 8, 8, 1, true]} />
          <meshBasicMaterial color={teamColor} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        {(hovered || selected) && (
          <Html position={[0, 2.35, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="nametag">
              <strong>{agent.name}</strong>
              <span>{agent.role}</span>
              <em style={{ color: meta.color }}>
                {meta.icon} {meta.label}
              </em>
            </div>
          </Html>
        )}
      </VoxelPerson>
    </group>
  );
}
