// The Brain: single source of truth for the project, teams, agents and shared memory.
// Persists to a JSON file and emits a ServerEvent for every change.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  AGENT_STATUSES,
  MAX_AGENTS_PER_TEAM,
  type Agent,
  type CreateAgentInput,
  type CreateMemoryInput,
  type CreateTeamInput,
  type MemoryEntry,
  type Project,
  type ServerEvent,
  type Team,
  type UpdateAgentInput,
  type WorldState,
} from '../../shared/types.ts';
import { TEAM_COLORS, TEAM_ICONS, fillTemplate, pick, randomAppearance, roleTemplate } from '../../shared/catalog.ts';

const MEMORY_LIMIT = 5000;
const SNAPSHOT_MEMORY = 60;

interface BrainData {
  version: 1;
  project: Project;
  teams: Team[];
  agents: Agent[];
  memory: MemoryEntry[];
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class Brain extends EventEmitter<{ event: [ServerEvent] }> {
  private data: BrainData;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private file: string) {
    super();
    this.data = this.load();
  }

  // ---------- persistence ----------

  private load(): BrainData {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as BrainData;
      if (raw.version === 1) return raw;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[brain] could not read ${this.file}, starting fresh:`, (err as Error).message);
      }
    }
    return seed();
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 500);
  }

  flush() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  private commit(event: ServerEvent) {
    this.scheduleSave();
    this.emit('event', event);
  }

  // ---------- reads ----------

  snapshot(): WorldState {
    return {
      project: this.data.project,
      teams: this.data.teams,
      agents: this.data.agents,
      memory: this.data.memory.slice(-SNAPSHOT_MEMORY).reverse(),
      stats: this.stats(),
    };
  }

  stats() {
    return {
      memoryCount: this.data.memory.length,
      tasksCompleted: this.data.agents.reduce((sum, a) => sum + a.tasksCompleted, 0),
    };
  }

  get agents(): readonly Agent[] {
    return this.data.agents;
  }

  team(id: string): Team {
    const team = this.data.teams.find((t) => t.id === id);
    if (!team) throw new HttpError(404, `team ${id} not found`);
    return team;
  }

  agent(id: string): Agent {
    const agent = this.data.agents.find((a) => a.id === id);
    if (!agent) throw new HttpError(404, `agent ${id} not found`);
    return agent;
  }

  queryMemory(opts: { teamId?: string; agentId?: string; limit?: number; q?: string }): MemoryEntry[] {
    const q = opts.q?.toLowerCase();
    const out: MemoryEntry[] = [];
    for (let i = this.data.memory.length - 1; i >= 0 && out.length < (opts.limit ?? 100); i--) {
      const m = this.data.memory[i];
      if (opts.teamId && m.teamId !== opts.teamId) continue;
      if (opts.agentId && m.agentId !== opts.agentId) continue;
      if (q && !m.content.toLowerCase().includes(q)) continue;
      out.push(m);
    }
    return out;
  }

  // ---------- writes ----------

  updateProject(patch: Partial<Pick<Project, 'name' | 'description' | 'goal'>>): Project {
    const project = this.data.project;
    if (patch.name !== undefined) project.name = requireText(patch.name, 'name', 80);
    if (patch.description !== undefined) project.description = String(patch.description).slice(0, 1000);
    if (patch.goal !== undefined) project.goal = String(patch.goal).slice(0, 500);
    this.commit({ type: 'project:updated', project });
    return project;
  }

  createTeam(input: CreateTeamInput): Team {
    const used = new Set(this.data.teams.map((t) => t.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const team: Team = {
      id: randomUUID(),
      name: requireText(input.name, 'name', 40),
      description: String(input.description ?? '').slice(0, 300),
      color: isColor(input.color) ? input.color : TEAM_COLORS[slot % TEAM_COLORS.length],
      icon: input.icon ? String(input.icon).slice(0, 3) : TEAM_ICONS[slot % TEAM_ICONS.length],
      slot,
      createdAt: Date.now(),
    };
    this.data.teams.push(team);
    this.commit({ type: 'team:created', team });
    return team;
  }

  deleteTeam(id: string) {
    this.team(id);
    for (const agent of this.data.agents.filter((a) => a.teamId === id)) this.deleteAgent(agent.id);
    this.data.teams = this.data.teams.filter((t) => t.id !== id);
    this.commit({ type: 'team:deleted', id });
  }

  createAgent(input: CreateAgentInput): Agent {
    const team = this.team(String(input.teamId));
    const members = this.data.agents.filter((a) => a.teamId === team.id);
    if (members.length >= MAX_AGENTS_PER_TEAM) {
      throw new HttpError(409, `${team.name} is full (${MAX_AGENTS_PER_TEAM} desks). Create another team.`);
    }
    const seats = new Set(members.map((a) => a.seat));
    let seat = 0;
    while (seats.has(seat)) seat++;
    const role = requireText(input.role, 'role', 40);
    const now = Date.now();
    const agent: Agent = {
      id: randomUUID(),
      name: requireText(input.name, 'name', 32),
      role,
      teamId: team.id,
      seat,
      appearance: { ...randomAppearance(), ...(input.appearance ?? {}) },
      status: 'working',
      currentTask: fillTemplate(pick(roleTemplate(role).tasks)),
      tasksCompleted: 0,
      autopilot: input.autopilot ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.data.agents.push(agent);
    this.commit({ type: 'agent:created', agent });
    return agent;
  }

  updateAgent(id: string, patch: UpdateAgentInput & { tasksCompleted?: number }): Agent {
    const agent = this.agent(id);
    if (patch.name !== undefined) agent.name = requireText(patch.name, 'name', 32);
    if (patch.role !== undefined) agent.role = requireText(patch.role, 'role', 40);
    if (patch.currentTask !== undefined) agent.currentTask = String(patch.currentTask).slice(0, 200);
    if (patch.autopilot !== undefined) agent.autopilot = Boolean(patch.autopilot);
    if (patch.tasksCompleted !== undefined) agent.tasksCompleted = patch.tasksCompleted;
    if (patch.status !== undefined) {
      if (!AGENT_STATUSES.includes(patch.status)) {
        throw new HttpError(400, `status must be one of ${AGENT_STATUSES.join(', ')}`);
      }
      agent.status = patch.status;
    }
    agent.updatedAt = Date.now();
    this.commit({ type: 'agent:updated', agent });
    return agent;
  }

  deleteAgent(id: string) {
    this.agent(id);
    this.data.agents = this.data.agents.filter((a) => a.id !== id);
    this.commit({ type: 'agent:deleted', id });
  }

  remember(input: CreateMemoryInput): MemoryEntry {
    const agent = input.agentId ? this.agent(input.agentId) : null;
    const teamId = input.teamId ?? agent?.teamId ?? null;
    if (teamId) this.team(teamId);
    const entry: MemoryEntry = {
      id: randomUUID(),
      kind: input.kind ?? 'note',
      content: requireText(input.content, 'content', 2000),
      agentId: agent?.id ?? null,
      teamId,
      createdAt: Date.now(),
    };
    this.data.memory.push(entry);
    if (this.data.memory.length > MEMORY_LIMIT) this.data.memory.splice(0, this.data.memory.length - MEMORY_LIMIT);
    this.commit({ type: 'memory:added', entry, stats: this.stats() });
    return entry;
  }
}

function requireText(value: unknown, field: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, `${field} is required`);
  return text.slice(0, max);
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** A starter office so the first launch looks alive. */
function seed(): BrainData {
  const now = Date.now();
  const teams: [string, string, string, string, [string, string][]][] = [
    ['Engineering', 'Builds and ships the product.', TEAM_COLORS[1], '</>', [['Atlas', 'Engineer'], ['Kai', 'Engineer'], ['Mira', 'Designer'], ['Dex', 'Manager'], ['Bolt', 'Engineer'], ['Pixel', 'Designer'], ['Zed', 'Engineer'], ['Ada', 'Engineer']]],
    ['Growth', 'Campaigns, content and social.', TEAM_COLORS[0], '@', [['Luna', 'Marketer'], ['Iris', 'Writer'], ['Nova', 'Marketer'], ['Cleo', 'Marketer'], ['Wren', 'Writer'], ['Ember', 'Analyst']]],
    ['Finance', 'Budgets, runway and billing.', TEAM_COLORS[2], '$', [['Otto', 'Finance'], ['Tess', 'Analyst'], ['Hugo', 'Finance'], ['Gia', 'Support'], ['Finn', 'Finance']]],
    ['Research', 'Market and model research.', TEAM_COLORS[4], '?', [['Orion', 'Researcher'], ['Sage', 'Analyst'], ['Juno', 'Researcher'], ['Vega', 'Researcher'], ['Echo', 'Analyst'], ['Rumi', 'Manager']]],
  ];
  const data: BrainData = {
    version: 1,
    project: {
      name: 'Launch Project Aurora',
      description: 'An AI-run company building and launching a new product. Every team reports its work to the central brain.',
      goal: 'Ship v1 and reach 1,000 customers',
      createdAt: now,
    },
    teams: [],
    agents: [],
    memory: [],
  };
  teams.forEach(([name, description, color, icon, members], slot) => {
    const team: Team = { id: randomUUID(), name, description, color, icon, slot, createdAt: now };
    data.teams.push(team);
    members.forEach(([agentName, role], seat) => {
      data.agents.push({
        id: randomUUID(),
        name: agentName,
        role,
        teamId: team.id,
        seat,
        appearance: randomAppearance(),
        status: 'working',
        currentTask: fillTemplate(pick(roleTemplate(role).tasks)),
        tasksCompleted: 0,
        autopilot: true,
        createdAt: now,
        updatedAt: now,
      });
    });
  });
  data.memory.push({
    id: randomUUID(),
    kind: 'decision',
    content: 'Brain online. All teams connected.',
    agentId: null,
    teamId: null,
    createdAt: now,
  });
  return data;
}
