// Transient visual effects shared between scene components without triggering React renders.
import { Vector3 } from 'three';

export interface Packet {
  from: Vector3;
  color: string;
  /** Team room slot: the packet travels along that room's cable. */
  slot: number;
  start: number;
  duration: number;
}

export const fx = {
  packets: [] as Packet[],
  /** Clock time (seconds) of the last packet that reached the brain. */
  brainPulse: -10,
  /** Recent arrivals at the brain, newest last. */
  arrivals: [] as { t: number; slot: number }[],
  /** Last time each room sent something, to light up its tower and cable. */
  sent: new Map<number, number>(),
};

/** Seconds a sync packet spends climbing from the desk to the room's tower. */
export const CLIMB = 0.7;

export function sendPacket(from: Vector3, color: string, now: number, slot: number) {
  if (fx.packets.length > 60) fx.packets.shift();
  fx.packets.push({ from: from.clone(), color, slot, start: now, duration: CLIMB + 1.6 + Math.random() * 0.3 });
  fx.sent.set(slot, now);
}

export function arrive(now: number, slot: number) {
  fx.brainPulse = now;
  fx.arrivals.push({ t: now, slot });
  if (fx.arrivals.length > 8) fx.arrivals.shift();
}
