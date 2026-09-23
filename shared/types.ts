// Domain model shared by the brain server and the office client.

export const MAX_AGENTS_PER_TEAM = 12;

export type AgentStatus = 'working' | 'thinking' | 'syncing' | 'meeting' | 'break';

export const AGENT_STATUSES: AgentStatus[] = ['working', 'thinking', 'syncing', 'meeting', 'break'];

export type HairStyle = 'short' | 'long' | 'bun' | 'spiky' | 'cap' | 'bald';

export interface Appearance {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants: string;
  glasses: boolean;
  headphones: boolean;
  beard: boolean;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  teamId: string;
  /** Desk index inside the team room (0..MAX_AGENTS_PER_TEAM-1). */
  seat: number;
  appearance: Appearance;
  status: AgentStatus;
  currentTask: string;
  tasksCompleted: number;
  /** When true the brain's simulation drives this agent; external agents set it false. */
  autopilot: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  /** Position of the room in the office grid, spiralling out from the brain. */
  slot: number;
  createdAt: number;
}

export type MemoryKind = 'artifact' | 'insight' | 'decision' | 'note';

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  content: string;
  agentId: string | null;
  teamId: string | null;
  createdAt: number;
}

export interface Project {
  name: string;
  description: string;
  goal: string;
  createdAt: number;
}

export interface WorldStats {
  memoryCount: number;
  tasksCompleted: number;
}

export interface WorldState {
  project: Project;
  teams: Team[];
  agents: Agent[];
  /** Most recent memories, newest first. */
  memory: MemoryEntry[];
  stats: WorldStats;
}

export type ServerEvent =
  | { type: 'snapshot'; state: WorldState }
  | { type: 'project:updated'; project: Project }
  | { type: 'team:created'; team: Team }
  | { type: 'team:updated'; team: Team }
  | { type: 'team:deleted'; id: string }
  | { type: 'agent:created'; agent: Agent }
  | { type: 'agent:updated'; agent: Agent }
  | { type: 'agent:deleted'; id: string }
  | { type: 'memory:added'; entry: MemoryEntry; stats: WorldStats };

export interface CreateTeamInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface CreateAgentInput {
  name: string;
  role: string;
  teamId: string;
  appearance?: Partial<Appearance>;
  autopilot?: boolean;
}

export interface UpdateAgentInput {
  name?: string;
  role?: string;
  status?: AgentStatus;
  currentTask?: string;
  autopilot?: boolean;
}

export interface CreateMemoryInput {
  content: string;
  kind?: MemoryKind;
  agentId?: string | null;
  teamId?: string | null;
}
