// A team's office room: walls, lounge, whiteboard and one workstation per agent.
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { Color, MeshBasicMaterial, MeshStandardMaterial, Vector3, type Group } from 'three';
import { MAX_AGENTS_PER_TEAM, type Team } from '../../../shared/types.ts';
import { select, useWorld } from '../lib/store.ts';
import { Character } from './Character.tsx';
import { ROOM_D, ROOM_HD, ROOM_HW, ROOM_W, WALL_H, seatLayout, slotPosition } from './layout.ts';
import { floorTexture, glyphTexture, screenTexture, signTexture, whiteboardTexture } from './textures.ts';
import { VoxelBuilder, chair, plant, voxelMaterial } from './voxels.ts';

const WALL = '#f7f7f5';
const TRIM = '#2a2c30';
const WOOD = '#d8b98a';

function easeOutBack(x: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function tint(hex: string, amount: number, base = '#ffffff') {
  return `#${new Color(base).lerp(new Color(hex), amount).getHexString()}`;
}

function buildRoom(color: string) {
  const b = new VoxelBuilder();
  const hw = ROOM_HW;
  const hd = ROOM_HD;

  // Low partitions on the front (+z) and right (+x) sides, each with a doorway.
  const low = 1.0;
  const front = (x0: number, x1: number) => {
    b.box((x0 + x1) / 2, 0, hd, x1 - x0, low, 0.18, WALL);
    b.box((x0 + x1) / 2, low, hd, x1 - x0 + 0.04, 0.06, 0.22, TRIM);
  };
  const side = (z0: number, z1: number) => {
    b.box(hw, 0, (z0 + z1) / 2, 0.18, low, z1 - z0, WALL);
    b.box(hw, low, (z0 + z1) / 2, 0.22, 0.06, z1 - z0 + 0.04, TRIM);
  };
  front(-hw, -4.4);
  front(-2.4, hw);
  side(-hd, -1);
  side(1, hd);
  for (const [x, z] of [[hw, hd], [-hw, hd], [hw, -hd], [-4.4, hd], [-2.4, hd], [hw, -1], [hw, 1]]) {
    b.box(x, 0, z, 0.24, low + 0.08, 0.24, TRIM);
  }

  // Bookshelf on the left wall.
  const sx = -hw + 0.38;
  b.box(sx, 0, -1.38, 0.42, 2.0, 0.06, '#3a3c40');
  b.box(sx, 0, 0.18, 0.42, 2.0, 0.06, '#3a3c40');
  const books = ['#e5484d', '#3e63dd', '#f5a524', '#30a46c', '#f4f1ea', '#8e4ec6', '#2b2d31'];
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = shelf * 0.5;
    b.box(sx, y, -0.6, 0.42, 0.04, 1.56, '#3a3c40');
    let z = -1.28;
    let i = shelf * 3;
    while (z < 0.0) {
      const w = 0.08 + ((i * 7) % 5) * 0.015;
      const hgt = 0.28 + ((i * 11) % 4) * 0.04;
      if ((i * 13) % 9 !== 0) b.box(sx, y + 0.04, z + w / 2, 0.3, hgt, w, books[i % books.length]);
      z += w + 0.01;
      i++;
    }
  }
  b.box(sx, 2.0, -0.6, 0.42, 0.04, 1.62, '#3a3c40');
  plant(b, sx, 2.04, -1.0, 0.6);

  // Coffee corner.
  b.box(-7.5, 0, 1.0, 0.42, 0.95, 0.42, '#f1f1ef');
  b.box(-7.5, 0.95, 1.0, 0.32, 0.45, 0.32, '#9fd3f5');
  b.box(-7.28, 0.62, 1.0, 0.05, 0.06, 0.08, '#5b9bd5');
  b.box(-7.55, 0, 2.5, 0.55, 0.9, 1.2, '#e9e6df');
  b.box(-7.55, 0.9, 2.5, 0.6, 0.05, 1.25, WOOD);
  b.box(-7.6, 0.95, 2.3, 0.35, 0.45, 0.35, '#2b2d31');
  b.box(-7.42, 1.2, 2.3, 0.02, 0.06, 0.1, '#30a46c');
  b.box(-7.5, 0.95, 2.85, 0.1, 0.12, 0.1, '#f4f1ea');

  // Lounge.
  b.box(-5.5, 0, 2.6, 3.6, 0.015, 4.6, tint(color, 0.35));
  b.box(-5.6, 0, 5.65, 2.6, 0.42, 0.85, '#dedad2');
  b.box(-5.6, 0.42, 6.0, 2.6, 0.5, 0.2, '#d4cfc5');
  b.box(-6.85, 0, 5.65, 0.2, 0.62, 0.85, '#d4cfc5');
  b.box(-4.35, 0, 5.65, 0.2, 0.62, 0.85, '#d4cfc5');
  b.box(-6.3, 0.42, 5.8, 0.42, 0.36, 0.14, color);
  b.box(-4.9, 0.42, 5.8, 0.42, 0.36, 0.14, tint(color, 0.5));
  b.box(-5.6, 0, 4.4, 1.2, 0.34, 0.55, '#2f3136');
  b.box(-5.6, 0.34, 4.4, 1.35, 0.04, 0.65, WOOD);
  b.box(-5.9, 0.38, 4.4, 0.32, 0.05, 0.22, '#e5484d');
  b.box(-5.88, 0.43, 4.42, 0.28, 0.05, 0.2, '#f4f1ea');
  plant(b, -5.2, 0.38, 4.45, 0.45);

  // Rug under the desks and corner plants.
  b.box(2.45, 0, -0.1, 10.4, 0.012, 11.4, tint(color, 0.12, '#f3f1ec'));
  plant(b, -7.4, 0, -5.95, 1.3);
  plant(b, 7.35, 0, -5.9, 1.45);
  plant(b, 7.35, 0, 5.9, 1.2);
  plant(b, -7.4, 0, 5.95, 1.0);

  return b.build();
}

/**
 * The two tall walls (back = -z, left = -x). They are separate meshes so they can drop to
 * knee height when the camera is rotated to look through them.
 */
function buildWalls(color: string) {
  const hw = ROOM_HW;
  const hd = ROOM_HD;
  const back = new VoxelBuilder()
    .box(0, 0, -hd, ROOM_W + 0.3, WALL_H, 0.3, WALL)
    .box(0, WALL_H, -hd, ROOM_W + 0.34, 0.07, 0.34, TRIM)
    .box(0.15, 0, -hd + 0.16, ROOM_W - 0.3, 0.14, 0.02, color)
    .box(0.15, 0, -hd - 0.16, ROOM_W - 0.3, 0.14, 0.02, color)
    .build();
  const left = new VoxelBuilder()
    .box(-hw, 0, 0, 0.3, WALL_H, ROOM_D + 0.3, WALL)
    .box(-hw, WALL_H, 0, 0.34, 0.07, ROOM_D + 0.34, TRIM)
    .box(-hw + 0.16, 0, 0.15, 0.02, 0.14, ROOM_D - 0.3, color)
    .box(-hw - 0.16, 0, 0.15, 0.02, 0.14, ROOM_D - 0.3, color)
    .build();
  return { back, left };
}

const whiteboardFrame = new VoxelBuilder()
  .box(-5.4, 0.85, -ROOM_HD + 0.2, 3.1, 1.5, 0.06, '#9aa0a8')
  .box(-5.4, 0.8, -ROOM_HD + 0.28, 2.0, 0.05, 0.12, '#9aa0a8')
  .box(-5.9, 0.85, -ROOM_HD + 0.3, 0.14, 0.04, 0.04, '#e5484d')
  .box(-5.6, 0.85, -ROOM_HD + 0.3, 0.14, 0.04, 0.04, '#3e63dd')
  .build();

const viewDir = new Vector3();
/** Wall height when cut away. */
const CUT = 0.18;

// Desk variants: props differ by seat so rooms don't look copy-pasted.
const deskCache = new Map<number, ReturnType<VoxelBuilder['build']>>();
function buildDesk(variant: number) {
  const hit = deskCache.get(variant);
  if (hit) return hit;
  const b = new VoxelBuilder();
  b.box(0, 0.74, 0, 1.7, 0.08, 0.8, WOOD);
  b.box(-0.8, 0, 0, 0.06, 0.74, 0.72, '#2f3136');
  b.box(0.8, 0, 0, 0.06, 0.74, 0.72, '#2f3136');
  b.box(0, 0.3, 0.3, 1.54, 0.4, 0.03, '#2f3136');
  // Monitor turned towards the chair.
  b.push(0.42, 0.82, 0.12, 0.41);
  b.box(0, 0, 0.05, 0.3, 0.03, 0.2, '#2a2c30');
  b.box(0, 0.03, 0.08, 0.05, 0.18, 0.05, '#2a2c30');
  b.box(0, 0.18, 0, 0.74, 0.46, 0.05, '#1b1d22');
  b.pop();
  b.box(-0.12, 0.82, -0.2, 0.5, 0.03, 0.16, '#e5e7eb');
  b.box(0.26, 0.82, -0.22, 0.07, 0.03, 0.11, '#e5e7eb');
  switch (variant % 4) {
    case 0:
      plant(b, -0.64, 0.82, 0.2, 0.42);
      break;
    case 1:
      b.box(-0.6, 0.82, 0.15, 0.3, 0.06, 0.22, '#3e63dd');
      b.box(-0.6, 0.88, 0.15, 0.28, 0.06, 0.2, '#f5a524');
      b.box(-0.58, 0.94, 0.14, 0.26, 0.05, 0.2, '#f4f1ea');
      break;
    case 2:
      b.box(-0.62, 0.82, 0.1, 0.12, 0.14, 0.12, '#f4f1ea');
      b.box(-0.54, 0.85, 0.1, 0.04, 0.07, 0.03, '#f4f1ea');
      b.box(-0.35, 0.82, 0.22, 0.3, 0.01, 0.22, '#ffffff');
      break;
    case 3:
      b.box(-0.66, 0.82, 0.2, 0.16, 0.03, 0.16, '#2a2c30');
      b.box(-0.66, 0.85, 0.2, 0.04, 0.42, 0.04, '#2a2c30');
      b.box(-0.58, 1.22, 0.2, 0.22, 0.1, 0.14, '#f5a524');
      break;
  }
  chair(b, 0, -0.85);
  const g = b.build();
  deskCache.set(variant, g);
  return g;
}

function Workstation({ agentId, seat, color, icon }: { agentId: string; seat: number; color: string; icon: string }) {
  const layout = seatLayout(seat);
  const status = useWorld((s) => s.agents[agentId]?.status ?? 'working');
  const [fresh] = useState(() => useWorld.getState().fresh.has(agentId));
  const group = useRef<Group>(null!);
  const born = useRef<number | null>(fresh ? -1 : null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const screen = useMemo(() => {
    const tex = screenTexture(color);
    return new MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 1, roughness: 0.4 });
  }, [color]);
  const logo = useMemo(() => new MeshBasicMaterial({ map: glyphTexture(icon, color), toneMapped: false }), [icon, color]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const st = statusRef.current;
    let target = 1;
    if (st === 'working') target = 0.9 + Math.sin(t * 13 + seat) * 0.08;
    else if (st === 'thinking') target = 0.55 + Math.sin(t * 2 + seat) * 0.15;
    else if (st === 'syncing') target = Math.sin(t * 18) > 0 ? 2.6 : 1.2;
    else target = 0.18;
    screen.emissiveIntensity += (target - screen.emissiveIntensity) * Math.min(1, dt * 10);
    logo.color.setScalar(st === 'syncing' ? 1.6 + Math.sin(t * 18) * 0.8 : 0.6 + screen.emissiveIntensity * 0.35);

    if (born.current !== null) {
      if (born.current < 0) born.current = t;
      const p = Math.min(1, (t - born.current) / 0.6);
      group.current.scale.setScalar(Math.max(0.001, easeOutBack(p)));
      if (p === 1) born.current = null;
    }
  });

  return (
    <group ref={group} position={[layout.desk[0], 0, layout.desk[1]]}>
      <mesh geometry={buildDesk(seat)} material={voxelMaterial} castShadow receiveShadow />
      <group position={[0.42, 0.82, 0.12]} rotation-y={0.41}>
        <mesh position={[0, 0.41, -0.03]} rotation-y={Math.PI} material={screen}>
          <planeGeometry args={[0.66, 0.38]} />
        </mesh>
        <mesh position={[0, 0.41, 0.028]} material={logo}>
          <planeGeometry args={[0.18, 0.18]} />
        </mesh>
      </group>
    </group>
  );
}

export function Room({ team }: { team: Team }) {
  const [x, z] = slotPosition(team.slot);
  const agentIds = useWorld(
    useShallow((s) =>
      Object.values(s.agents)
        .filter((a) => a.teamId === team.id)
        .sort((a, b) => a.seat - b.seat)
        .map((a) => a.id),
    ),
  );
  const seats = useWorld(useShallow((s) => agentIds.map((id) => s.agents[id]?.seat ?? 0)));
  const working = useWorld((s) => agentIds.filter((id) => s.agents[id]?.status === 'working').length);
  const selected = useWorld((s) => s.selection?.kind === 'team' && s.selection.id === team.id);
  const [fresh] = useState(() => useWorld.getState().fresh.has(team.id));

  const geometry = useMemo(() => buildRoom(team.color), [team.color]);
  const walls = useMemo(() => buildWalls(team.color), [team.color]);
  const backWall = useRef<Group>(null!);
  const leftWall = useRef<Group>(null!);
  const backDecor = useRef<Group>(null!);
  const floor = useMemo(() => {
    const tex = floorTexture().clone();
    tex.repeat.set(ROOM_W / 1.3, ROOM_D / 1.3);
    tex.needsUpdate = true;
    return new MeshStandardMaterial({ map: tex, color: tint(team.color, 0.05), roughness: 0.9 });
  }, [team.color]);
  const sign = useMemo(
    () => new MeshStandardMaterial({ map: signTexture(team.name, team.icon, team.color), roughness: 0.6 }),
    [team.name, team.icon, team.color],
  );
  const board = useMemo(
    () => new MeshStandardMaterial({ map: whiteboardTexture(team.name, team.color), roughness: 0.5 }),
    [team.name, team.color],
  );

  const shell = useRef<Group>(null!);
  const born = useRef<number | null>(fresh ? -1 : null);
  useFrame((state, dt) => {
    // Cut a tall wall down when the camera looks through it into the room.
    state.camera.getWorldDirection(viewDir);
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8);
    const back = backWall.current.scale;
    back.y += ((viewDir.z > 0.15 ? CUT : 1) - back.y) * k;
    backDecor.current.visible = back.y > 0.7;
    const left = leftWall.current.scale;
    left.y += ((viewDir.x > 0.15 ? CUT : 1) - left.y) * k;

    if (born.current === null) return;
    const t = state.clock.elapsedTime;
    if (born.current < 0) born.current = t;
    const p = Math.min(1, (t - born.current) / 1.1);
    const xz = easeOutBack(Math.min(1, p * 1.6));
    const y = easeOutBack(Math.max(0, (p - 0.35) / 0.65));
    shell.current.scale.set(Math.max(0.001, xz), Math.max(0.001, y), Math.max(0.001, xz));
    if (p === 1) born.current = null;
  });

  const focusRoom = () => select({ kind: 'team', id: team.id }, { x, z, zoom: 30 });

  return (
    <group position={[x, 0, z]}>
      <group ref={shell}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.005} material={floor} receiveShadow onClick={(e) => {
            e.stopPropagation();
            if (e.delta < 5) focusRoom();
          }}>
          <planeGeometry args={[ROOM_W, ROOM_D]} />
        </mesh>
        <mesh geometry={geometry} material={voxelMaterial} castShadow receiveShadow />
        <group ref={backWall}>
          <mesh geometry={walls.back} material={voxelMaterial} castShadow receiveShadow />
        </group>
        <group ref={leftWall}>
          <mesh geometry={walls.left} material={voxelMaterial} castShadow receiveShadow />
        </group>
        <group ref={backDecor}>
          <mesh geometry={whiteboardFrame} material={voxelMaterial} castShadow />
          <mesh position={[-5.4, 1.6, -ROOM_HD + 0.24]} material={board}>
            <planeGeometry args={[2.95, 1.38]} />
          </mesh>
          <mesh position={[3.2, 1.95, -ROOM_HD + 0.17]} material={sign}>
            <planeGeometry args={[4.4, 1.1]} />
          </mesh>
        </group>
        {agentIds.map((id, i) => (
          <Workstation key={id} agentId={id} seat={seats[i]} color={team.color} icon={team.icon} />
        ))}
        {agentIds.map((id) => (
          <Character key={id} agentId={id} teamColor={team.color} slot={team.slot} roomX={x} roomZ={z} />
        ))}
      </group>
      <Html position={[0, WALL_H + 1.6, -ROOM_HD]} center zIndexRange={[10, 0]}>
        <button
          className={`room-label${selected ? ' selected' : ''}`}
          style={{ ['--team' as string]: team.color }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            // Keep the click from reaching the 3D scene underneath, which would clear the selection.
            e.stopPropagation();
            focusRoom();
          }}
        >
          <span className="room-icon">{team.icon}</span>
          <span className="room-name">{team.name}</span>
          <span className="room-count">
            {working}/{agentIds.length} working · {MAX_AGENTS_PER_TEAM - agentIds.length} desks free
          </span>
        </button>
      </Html>
    </group>
  );
}
