// Office floor plan: where rooms, desks and gathering spots live.
import { Vector3 } from 'three';

export const CELL_X = 22;
export const CELL_Z = 20;
export const ROOM_W = 16;
export const ROOM_D = 13;
export const ROOM_HW = ROOM_W / 2;
export const ROOM_HD = ROOM_D / 2;
export const WALL_H = 2.8;
export const BRAIN_HALF = 6.5;
export const BRAIN_CORE = new Vector3(0, 3.6, 0);

// ---------- room slots spiral out from the brain at the centre ----------

const cells: [number, number][] = [];
for (let r = 1; r <= 8; r++) {
  const ring: [number, number][] = [];
  for (let x = -r; x <= r; x++) {
    for (let z = -r; z <= r; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) === r) ring.push([x, z]);
    }
  }
  // Rooms behind the brain first (never occlude it), then sides, then the front.
  const score = ([x, z]: [number, number]) => Math.abs(x) + Math.abs(z) + (x + z) * 0.01 + (x > 0 ? 0.001 : 0);
  ring.sort((a, b) => score(a) - score(b));
  cells.push(...ring);
}

export function slotPosition(slot: number): [number, number] {
  const [cx, cz] = cells[slot % cells.length];
  return [cx * CELL_X, cz * CELL_Z];
}

/** Half-size of the square that contains every used slot — used to size shadows and camera fit. */
export function worldExtent(slots: number[]): number {
  let r = 0;
  for (const s of slots) {
    const [cx, cz] = cells[s % cells.length];
    r = Math.max(r, Math.abs(cx), Math.abs(cz));
  }
  return (r + 0.5) * CELL_X;
}

/** Point on the room's wall-top closest to the brain, where its data link leaves the room. */
export function roomUplink(slot: number): Vector3 {
  const [x, z] = slotPosition(slot);
  const len = Math.hypot(x, z) || 1;
  const dx = -x / len;
  const dz = -z / len;
  const t = Math.min(dx ? ROOM_HW / Math.abs(dx) : Infinity, dz ? ROOM_HD / Math.abs(dz) : Infinity) - 0.4;
  return new Vector3(x + dx * t, WALL_H + 0.1, z + dz * t);
}

// ---------- desks inside a room (room-local coordinates) ----------

export const DESK_COLS = [-1.8, 1.1, 4.0, 6.7];
export const DESK_ROWS = [-3.9, -0.1, 3.7];
export const CHAIR_OFFSET = -0.85;
/** Vertical corridor between the lounge and the first desk column. */
export const AISLE_X = -3.3;

export interface SeatLayout {
  desk: [number, number];
  chair: [number, number];
  /** Walkway behind the chair. */
  aisleZ: number;
  meeting: { pos: [number, number]; rot: number };
  lounge: { pos: [number, number]; rot: number };
}

const LOUNGE_CENTER: [number, number] = [-5.5, 1.9];

export function seatLayout(seat: number): SeatLayout {
  const col = seat % DESK_COLS.length;
  const row = Math.floor(seat / DESK_COLS.length) % DESK_ROWS.length;
  const x = DESK_COLS[col];
  const z = DESK_ROWS[row];

  // Standing crowd in front of the whiteboard, facing it.
  const mx = -6.5 + (seat % 3) * 1.1;
  const mz = -4.6 + Math.floor(seat / 3) * 1.0;

  // Loose circle around the water cooler / coffee corner, facing its centre.
  const lx = -6.6 + (seat % 3) * 1.1 + (Math.floor(seat / 3) % 2) * 0.3;
  const lz = 0.4 + Math.floor(seat / 3) * 0.95;
  const lrot = Math.atan2(LOUNGE_CENTER[0] - lx, LOUNGE_CENTER[1] - lz);

  return {
    desk: [x, z],
    chair: [x, z + CHAIR_OFFSET],
    aisleZ: z - 1.95,
    meeting: { pos: [mx, mz], rot: Math.PI },
    lounge: { pos: [lx, lz], rot: lrot },
  };
}
