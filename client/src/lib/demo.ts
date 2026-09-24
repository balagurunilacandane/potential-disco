// Demo mode: the whole brain runs inside the page, so the office works with no server.
import { BrainCore } from '../../../shared/brain.ts';
import { startSimulation } from '../../../shared/simulation.ts';

export const DEMO = import.meta.env.VITE_DEMO === '1';

let brain: BrainCore | null = null;

export function localBrain(): BrainCore {
  if (!brain) {
    brain = new BrainCore();
    startSimulation(brain);
  }
  return brain;
}

/** Runs a brain call like a network request: async, with copies instead of live objects. */
export async function local<T>(fn: (brain: BrainCore) => T): Promise<T> {
  const result = fn(localBrain());
  return result === undefined ? result : structuredClone(result);
}
