import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AGENT_STATUSES, MAX_AGENTS_PER_TEAM, type MemoryEntry } from '../../../shared/types.ts';
import { api } from '../lib/api.ts';
import { openModal, select, toast, useWorld } from '../lib/store.ts';
import { seatLayout, slotPosition } from '../scene/layout.ts';
import { useNow } from './Hud.tsx';
import { MEMORY_META, STATUS_META, timeAgo } from './status.ts';

export function Inspector() {
  const selection = useWorld((s) => s.selection);
  if (!selection) return null;
  return (
    <aside className="inspector panel" key={selection.kind === 'brain' ? 'brain' : selection.id}>
      <button className="close icon-btn" onClick={() => select(null)} aria-label="Close">
        ×
      </button>
      {selection.kind === 'agent' && <AgentView id={selection.id} />}
      {selection.kind === 'team' && <TeamView id={selection.id} />}
      {selection.kind === 'brain' && <BrainView />}
    </aside>
  );
}

function MemoryList({ entries, showAgent = true }: { entries: MemoryEntry[]; showAgent?: boolean }) {
  const agents = useWorld((s) => s.agents);
  const teams = useWorld((s) => s.teams);
  const now = useNow();
  if (!entries.length) return <p className="empty">Nothing in memory yet.</p>;
  return (
    <ul className="memory-list">
      {entries.map((m) => {
        const team = m.teamId ? teams[m.teamId] : null;
        return (
          <li key={m.id} style={{ ['--team' as string]: team?.color ?? '#6b7280' }}>
            <div className="feed-line">
              <span className="kind" style={{ color: MEMORY_META[m.kind].color }}>
                {MEMORY_META[m.kind].label}
              </span>
              {showAgent && <strong>{(m.agentId && agents[m.agentId]?.name) || team?.name || 'Brain'}</strong>}
              <time>{timeAgo(m.createdAt, now)}</time>
            </div>
            <p>{m.content}</p>
          </li>
        );
      })}
    </ul>
  );
}

function AgentView({ id }: { id: string }) {
  const agent = useWorld((s) => s.agents[id]);
  const team = useWorld((s) => (agent ? s.teams[agent.teamId] : undefined));
  const memories = useWorld(useShallow((s) => s.memory.filter((m) => m.agentId === id).slice(0, 8)));
  const now = useNow();
  if (!agent || !team) return null;
  const meta = STATUS_META[agent.status];

  const update = (patch: Parameters<typeof api.updateAgent>[1]) =>
    api.updateAgent(id, patch).catch((e: Error) => toast(e.message, 'error'));

  const fire = async () => {
    if (!confirm(`Remove ${agent.name} from ${team.name}?`)) return;
    try {
      await api.deleteAgent(id);
      toast(`${agent.name} left the office`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <>
      <div className="insp-head">
        <div className="avatar" style={{ background: agent.appearance.shirt, color: agent.appearance.hair }}>
          <span style={{ background: agent.appearance.skin }} />
        </div>
        <div>
          <h2>{agent.name}</h2>
          <p className="muted">
            {agent.role} ·{' '}
            <button className="link" style={{ color: team.color }} onClick={() => {
              const [x, z] = slotPosition(team.slot);
              select({ kind: 'team', id: team.id }, { x, z, zoom: 30 });
            }}>
              {team.name}
            </button>
          </p>
        </div>
      </div>

      <div className="status-card" style={{ ['--status' as string]: meta.color }}>
        <span className="status-pill">
          {meta.icon} {meta.label}
        </span>
        <p>{agent.currentTask}</p>
      </div>

      <div className="kv">
        <div>
          <strong>{agent.tasksCompleted}</strong>
          <span>tasks done</span>
        </div>
        <div>
          <strong>#{agent.seat + 1}</strong>
          <span>desk</span>
        </div>
        <div>
          <strong>{timeAgo(agent.createdAt, now).replace(' ago', '')}</strong>
          <span>tenure</span>
        </div>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={agent.autopilot} onChange={(e) => update({ autopilot: e.target.checked })} />
        <span>
          <strong>Autopilot</strong>
          <small>{agent.autopilot ? 'The brain simulates this agent’s work loop.' : 'Driven externally through the API.'}</small>
        </span>
      </label>

      {!agent.autopilot && (
        <div className="status-buttons">
          {AGENT_STATUSES.map((s) => (
            <button
              key={s}
              className={`chip${agent.status === s ? ' active' : ''}`}
              style={{ ['--status' as string]: STATUS_META[s].color }}
              onClick={() => update({ status: s })}
            >
              {STATUS_META[s].icon} {STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}

      <h3>Recent memories</h3>
      <MemoryList entries={memories} showAgent={false} />

      <details className="api-hint">
        <summary>Connect a real agent</summary>
        <p>Turn autopilot off, then report progress from your agent runtime:</p>
        <pre>{`curl -X PATCH ${location.origin}/api/agents/${agent.id} \\
  -H 'content-type: application/json' \\
  -d '{"status":"working","currentTask":"…"}'

curl -X POST ${location.origin}/api/memory \\
  -H 'content-type: application/json' \\
  -d '{"agentId":"${agent.id}","kind":"insight","content":"…"}'`}</pre>
      </details>

      <button className="btn danger block" onClick={fire}>
        Remove agent
      </button>
    </>
  );
}

function TeamView({ id }: { id: string }) {
  const team = useWorld((s) => s.teams[id]);
  const members = useWorld(useShallow((s) => Object.values(s.agents).filter((a) => a.teamId === id).sort((a, b) => a.seat - b.seat)));
  const memories = useWorld(useShallow((s) => s.memory.filter((m) => m.teamId === id).slice(0, 8)));
  if (!team) return null;
  const [x, z] = slotPosition(team.slot);

  const remove = async () => {
    if (!confirm(`Close the ${team.name} room and remove its ${members.length} agents?`)) return;
    try {
      await api.deleteTeam(id);
      toast(`${team.name} room closed`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <>
      <div className="insp-head">
        <div className="team-swatch big" style={{ background: team.color }}>
          {team.icon}
        </div>
        <div>
          <h2>{team.name}</h2>
          <p className="muted">{team.description || 'No description'}</p>
        </div>
      </div>

      <div className="kv">
        <div>
          <strong>{members.length}</strong>
          <span>agents</span>
        </div>
        <div>
          <strong>{MAX_AGENTS_PER_TEAM - members.length}</strong>
          <span>free desks</span>
        </div>
        <div>
          <strong>{members.reduce((s, a) => s + a.tasksCompleted, 0)}</strong>
          <span>tasks done</span>
        </div>
      </div>

      <h3>Members</h3>
      <ul className="member-list">
        {members.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => {
                const [cx, cz] = seatLayout(a.seat).chair;
                select({ kind: 'agent', id: a.id }, { x: x + cx, z: z + cz, zoom: 55 });
              }}
            >
              <i style={{ background: STATUS_META[a.status].color }} />
              <strong>{a.name}</strong>
              <span className="muted">{a.role}</span>
              <small>{STATUS_META[a.status].label}</small>
            </button>
          </li>
        ))}
        {members.length === 0 && <li className="empty">This room is empty — hire the first agent.</li>}
      </ul>
      <button
        className="btn primary block"
        disabled={members.length >= MAX_AGENTS_PER_TEAM}
        onClick={() => openModal({ kind: 'agent', teamId: id })}
      >
        + Hire agent into {team.name}
      </button>

      <h3>Team memory</h3>
      <MemoryList entries={memories} />

      <button className="btn danger block" onClick={remove}>
        Close room
      </button>
    </>
  );
}

function BrainView() {
  const project = useWorld((s) => s.project);
  const stats = useWorld((s) => s.stats);
  const teams = useWorld(useShallow((s) => Object.values(s.teams).sort((a, b) => a.slot - b.slot)));
  const statuses = useWorld(useShallow((s) => Object.values(s.agents).map((a) => a.status)));
  const live = useWorld(useShallow((s) => s.memory.slice(0, 30)));
  const [draft, setDraft] = useState(project);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [results, setResults] = useState<MemoryEntry[] | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!editing) setDraft(project);
  }, [project, editing]);

  // Search the brain's full history on the server; otherwise show the live stream.
  useEffect(() => {
    if (!q && !teamFilter) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      api
        .memory({ q, teamId: teamFilter, limit: 50 })
        .then(setResults)
        .catch((e: Error) => toast(e.message, 'error'));
    }, 250);
    return () => clearTimeout(handle);
  }, [q, teamFilter, stats.memoryCount]);

  if (!project || !draft) return null;

  const save = async () => {
    try {
      await api.updateProject({ name: draft.name, goal: draft.goal, description: draft.description });
      setEditing(false);
      toast('Project updated in the brain', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.remember({ content: note, kind: 'note', teamId: teamFilter || null });
      setNote('');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const counts = AGENT_STATUSES.map((s) => [s, statuses.filter((x) => x === s).length] as const);

  return (
    <>
      <div className="insp-head">
        <div className="brain-orb" />
        <div>
          <p className="eyebrow">Central brain</p>
          <h2>{project.name}</h2>
        </div>
      </div>

      {editing ? (
        <div className="form">
          <label>
            Project name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} />
          </label>
          <label>
            Goal
            <input value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} maxLength={500} />
          </label>
          <label>
            Description
            <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <div className="row">
            <button className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={save}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="project-card">
          <p>
            <span className="eyebrow">Goal</span>
            {project.goal || '—'}
          </p>
          <p className="muted">{project.description}</p>
          <button className="link" onClick={() => setEditing(true)}>
            Edit project
          </button>
        </div>
      )}

      <div className="kv">
        <div>
          <strong>{teams.length}</strong>
          <span>teams</span>
        </div>
        <div>
          <strong>{stats.memoryCount.toLocaleString()}</strong>
          <span>memories</span>
        </div>
        <div>
          <strong>{stats.tasksCompleted.toLocaleString()}</strong>
          <span>tasks done</span>
        </div>
      </div>

      {statuses.length > 0 && (
        <>
          <div className="status-bar" role="img" aria-label="Agents by status">
            {counts.map(([s, n]) => n > 0 && <span key={s} style={{ flex: n, background: STATUS_META[s].color }} title={`${STATUS_META[s].label}: ${n}`} />)}
          </div>
          <div className="legend compact">
            {counts.map(([s, n]) => (
              <span key={s}>
                <i style={{ background: STATUS_META[s].color }} />
                {STATUS_META[s].label} {n}
              </span>
            ))}
          </div>
        </>
      )}

      <h3>Memory</h3>
      <div className="search">
        <input placeholder="Search the brain…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label="Filter by team">
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="note-form">
        <input
          placeholder="Add a note to the brain…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
        />
        <button className="btn" onClick={addNote} disabled={!note.trim()}>
          Save
        </button>
      </div>
      <MemoryList entries={results ?? live} />
    </>
  );
}
