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

export const api = {
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
