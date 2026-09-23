// Transient visual effects shared between scene components without triggering React renders.
import { Vector3 } from 'three';

export interface Packet {
  from: Vector3;
  color: string;
  start: number;
  duration: number;
}

export const fx = {
  packets: [] as Packet[],
  /** Clock time (seconds) of the last packet that reached the brain core. */
  brainPulse: -10,
};

export function sendPacket(from: Vector3, color: string, now: number) {
  if (fx.packets.length > 120) fx.packets.shift();
  fx.packets.push({ from: from.clone(), color, start: now, duration: 1.4 + Math.random() * 0.4 });
}
