import type {
  Agent,
  CreateAgentInput,
  CreateMemoryInput,
  CreateTeamInput,
  MemoryEntry,
  Project,
  Team,
  UpdateAgentInput,
  WorldState,
} from '../../../shared/types.ts';
import { DEMO, local } from './demo.ts';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `${method} ${url} failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const remote = {
  state: () => request<WorldState>('GET', '/state'),
  updateProject: (patch: Partial<Pick<Project, 'name' | 'description' | 'goal'>>) =>
    request<Project>('PATCH', '/project', patch),
  createTeam: (input: CreateTeamInput) => request<Team>('POST', '/teams', input),
  deleteTeam: (id: string) => request<void>('DELETE', `/teams/${id}`),
  createAgent: (input: CreateAgentInput) => request<Agent>('POST', '/agents', input),
  updateAgent: (id: string, patch: UpdateAgentInput) => request<Agent>('PATCH', `/agents/${id}`, patch),
  deleteAgent: (id: string) => request<void>('DELETE', `/agents/${id}`),
  memory: (query: { teamId?: string; agentId?: string; q?: string; limit?: number }) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
    return request<MemoryEntry[]>('GET', `/memory?${params}`);
  },
  remember: (input: CreateMemoryInput) => request<MemoryEntry>('POST', '/memory', input),
};

/** Same calls answered by the in-page brain (demo build). */
const inPage: typeof remote = {
  state: () => local((b) => b.snapshot()),
  updateProject: (patch) => local((b) => b.updateProject(patch)),
  createTeam: (input) => local((b) => b.createTeam(input)),
  deleteTeam: (id) => local((b) => b.deleteTeam(id)),
  createAgent: (input) => local((b) => b.createAgent(input)),
  updateAgent: (id, patch) => local((b) => b.updateAgent(id, patch)),
  deleteAgent: (id) => local((b) => b.deleteAgent(id)),
  memory: (query) => local((b) => b.queryMemory({ ...query, limit: query.limit ?? 100 })),
  remember: (input) => local((b) => b.remember(input)),
};

export const api = DEMO ? inPage : remote;
