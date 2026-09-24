// Client-side mirror of the brain, kept live over a WebSocket.
import { create } from 'zustand';
import type { Agent, MemoryEntry, Project, ServerEvent, Team, WorldStats } from '../../../shared/types.ts';
import { DEMO, localBrain } from './demo.ts';
import { INITIAL_RENDER_MODE, applyModeClass, rememberMode, type RenderMode } from './device.ts';

export type Selection = { kind: 'agent'; id: string } | { kind: 'team'; id: string } | { kind: 'brain' } | null;
export type Modal = { kind: 'team' } | { kind: 'agent'; teamId?: string } | null;

/** A camera move. Omitted fields keep their current value. */
export interface CameraGoal {
  x?: number;
  z?: number;
  zoom?: number;
  /** Multiply the current zoom (zoom buttons). */
  zoomScale?: number;
  /** Rotate around the target by this many radians, snapped to the isometric diagonals. */
  rotate?: number;
  /** Angle from straight down (0) towards the horizon. */
  polar?: number;
  /** Frame the whole office. */
  fit?: boolean;
}

export type ViewAngle = 'classic' | 'top' | 'low';

export const VIEW_ANGLES: Record<ViewAngle, { label: string; polar: number; hint: string }> = {
  classic: { label: 'Classic', polar: 0.92, hint: 'Isometric view' },
  top: { label: 'Top', polar: 0.3, hint: 'Look straight down' },
  low: { label: 'Low', polar: 1.18, hint: 'Eye-level view' },
};

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'success';
}

interface WorldStore {
  connection: 'connecting' | 'online' | 'offline';
  loaded: boolean;
  project: Project | null;
  teams: Record<string, Team>;
  agents: Record<string, Agent>;
  memory: MemoryEntry[];
  stats: WorldStats;
  /** Ids created while the client was watching — these get spawn animations. */
  fresh: Set<string>;
  selection: Selection;
  hovered: string | null;
  modal: Modal;
  /** Camera focus request; `key` changes on every request so repeated clicks re-focus. */
  focus: (CameraGoal & { key: number }) | null;
  viewAngle: ViewAngle;
  /** Guided tour: the camera drifts from room to room until the user takes over. */
  touring: boolean;
  /** What the tour is currently showing. */
  tourLabel: string | null;
  /** The browser dropped the WebGL context (usually low graphics memory). */
  graphicsLost: boolean;
  renderMode: RenderMode;
  toasts: Toast[];
}

export const useWorld = create<WorldStore>(() => ({
  connection: 'connecting',
  loaded: false,
  project: null,
  teams: {},
  agents: {},
  memory: [],
  stats: { memoryCount: 0, tasksCompleted: 0 },
  fresh: new Set(),
  selection: null,
  hovered: null,
  modal: null,
  focus: null,
  viewAngle: 'classic',
  touring: false,
  tourLabel: null,
  graphicsLost: false,
  renderMode: INITIAL_RENDER_MODE,
  toasts: [],
}));

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]));
const without = <T>(rec: Record<string, T>, id: string) => {
  const next = { ...rec };
  delete next[id];
  return next;
};

function apply(ev: ServerEvent) {
  const set = useWorld.setState;
  switch (ev.type) {
    case 'snapshot':
      set({
        loaded: true,
        project: ev.state.project,
        teams: byId(ev.state.teams),
        agents: byId(ev.state.agents),
        memory: ev.state.memory,
        stats: ev.state.stats,
      });
      break;
    case 'project:updated':
      set({ project: ev.project });
      break;
    case 'team:created':
      set((s) => ({ teams: { ...s.teams, [ev.team.id]: ev.team }, fresh: new Set(s.fresh).add(ev.team.id) }));
      break;
    case 'team:updated':
      set((s) => ({ teams: { ...s.teams, [ev.team.id]: ev.team } }));
      break;
    case 'team:deleted':
      set((s) => ({
        teams: without(s.teams, ev.id),
        selection: s.selection?.kind === 'team' && s.selection.id === ev.id ? null : s.selection,
      }));
      break;
    case 'agent:created':
      set((s) => ({ agents: { ...s.agents, [ev.agent.id]: ev.agent }, fresh: new Set(s.fresh).add(ev.agent.id) }));
      break;
    case 'agent:updated':
      set((s) => ({ agents: { ...s.agents, [ev.agent.id]: ev.agent } }));
      break;
    case 'agent:deleted':
      set((s) => ({
        agents: without(s.agents, ev.id),
        selection: s.selection?.kind === 'agent' && s.selection.id === ev.id ? null : s.selection,
      }));
      break;
    case 'memory:added':
      set((s) => ({ memory: [ev.entry, ...s.memory].slice(0, 200), stats: ev.stats }));
      break;
  }
}

export function connect() {
  if (DEMO) {
    // Events are cloned so the store never shares objects the brain mutates in place.
    const brain = localBrain();
    apply({ type: 'snapshot', state: structuredClone(brain.snapshot()) });
    brain.on((ev) => apply(structuredClone(ev)));
    useWorld.setState({ connection: 'online' });
    return;
  }
  let retry = 500;
  const open = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}/ws`);
    socket.onopen = () => {
      retry = 500;
      useWorld.setState({ connection: 'online' });
    };
    socket.onmessage = (msg) => apply(JSON.parse(msg.data) as ServerEvent);
    socket.onclose = () => {
      useWorld.setState({ connection: 'offline' });
      setTimeout(open, retry);
      retry = Math.min(retry * 2, 5000);
    };
  };
  open();
}

// ---------- UI actions ----------

let toastId = 0;
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = ++toastId;
  useWorld.setState((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
  setTimeout(() => useWorld.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
}

export function select(selection: Selection, focus?: CameraGoal) {
  useWorld.setState((s) => ({
    selection,
    focus: focus ? { ...focus, key: (s.focus?.key ?? 0) + 1 } : s.focus,
  }));
}

export function moveCamera(goal: CameraGoal) {
  useWorld.setState((s) => ({ focus: { ...goal, key: (s.focus?.key ?? 0) + 1 } }));
}

export function setViewAngle(viewAngle: ViewAngle) {
  useWorld.setState({ viewAngle });
  moveCamera({ polar: VIEW_ANGLES[viewAngle].polar });
}

export function setTouring(touring: boolean) {
  useWorld.setState(touring ? { touring, viewAngle: 'classic' } : { touring });
}

export function openModal(modal: Modal) {
  useWorld.setState({ modal });
}

export function setRenderMode(renderMode: RenderMode) {
  rememberMode(renderMode);
  applyModeClass(renderMode);
  useWorld.setState({ renderMode, graphicsLost: false });
}
