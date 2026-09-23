import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MAX_AGENTS_PER_TEAM } from '../../../shared/types.ts';
import { openModal, select, useWorld } from '../lib/store.ts';
import { slotPosition } from '../scene/layout.ts';
import { MEMORY_META, STATUS_META, timeAgo } from './status.ts';

/** Re-render every few seconds so relative times stay fresh. */
export function useNow(interval = 5000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

export function TopBar() {
  const project = useWorld((s) => s.project);
  const connection = useWorld((s) => s.connection);
  const teamCount = useWorld((s) => Object.keys(s.teams).length);
  const agents = useWorld(useShallow((s) => Object.values(s.agents).map((a) => a.status)));
  const stats = useWorld((s) => s.stats);
  const busy = agents.filter((s) => s === 'working' || s === 'syncing' || s === 'thinking').length;

  return (
    <header className="topbar">
      <div className="brand panel">
        <div className="logo" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div>
          <h1>Agent World</h1>
          <button className="project-link" onClick={() => select({ kind: 'brain' }, { x: 0, z: 0, zoom: 32 })}>
            {project?.name ?? 'Connecting…'}
          </button>
        </div>
      </div>
      <div className="stats panel">
        <Stat label="Teams" value={teamCount} />
        <Stat label="Agents" value={agents.length} />
        <Stat label="Busy" value={busy} />
        <Stat label="Tasks done" value={stats.tasksCompleted} />
        <Stat label="Memories" value={stats.memoryCount} />
        <span className={`conn conn-${connection}`} title={`Brain ${connection}`}>
          <i />
          {connection === 'online' ? 'Live' : connection === 'connecting' ? 'Connecting' : 'Offline'}
        </span>
      </div>
      <div className="actions">
        <button className="btn" onClick={() => openModal({ kind: 'team' })}>
          + New team
        </button>
        <button className="btn primary" onClick={() => openModal({ kind: 'agent' })} disabled={teamCount === 0}>
          + Hire agent
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

export function TeamsPanel() {
  const teams = useWorld(useShallow((s) => Object.values(s.teams).sort((a, b) => a.slot - b.slot)));
  const agents = useWorld((s) => s.agents);
  const selection = useWorld((s) => s.selection);
  const [open, setOpen] = useState(true);

  return (
    <aside className={`teams panel${open ? '' : ' collapsed'}`}>
      <div className="panel-head">
        <h2>Teams</h2>
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse teams' : 'Expand teams'}>
          {open ? '−' : '+'}
        </button>
      </div>
      {open && (
        <>
          <button
            className={`team-row brain-row${selection?.kind === 'brain' ? ' active' : ''}`}
            onClick={() => select({ kind: 'brain' }, { x: 0, z: 0, zoom: 32 })}
          >
            <span className="team-swatch brain-swatch">◉</span>
            <span className="team-meta">
              <strong>Central Brain</strong>
              <small>Shared memory for every team</small>
            </span>
          </button>
          <ul className="team-list">
            {teams.map((team) => {
              const members = Object.values(agents).filter((a) => a.teamId === team.id);
              const active = selection?.kind === 'team' && selection.id === team.id;
              const [x, z] = slotPosition(team.slot);
              return (
                <li key={team.id}>
                  <div className={`team-row${active ? ' active' : ''}`}>
                    <button className="team-main" onClick={() => select({ kind: 'team', id: team.id }, { x, z, zoom: 30 })}>
                      <span className="team-swatch" style={{ background: team.color }}>
                        {team.icon}
                      </span>
                      <span className="team-meta">
                        <strong>{team.name}</strong>
                        <small>
                          {members.length}/{MAX_AGENTS_PER_TEAM} agents
                        </small>
                        <span className="dots">
                          {members.map((m) => (
                            <i key={m.id} style={{ background: STATUS_META[m.status].color }} title={`${m.name}: ${STATUS_META[m.status].label}`} />
                          ))}
                        </span>
                      </span>
                    </button>
                    <button
                      className="icon-btn"
                      title={`Hire into ${team.name}`}
                      disabled={members.length >= MAX_AGENTS_PER_TEAM}
                      onClick={() => openModal({ kind: 'agent', teamId: team.id })}
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {teams.length === 0 && <p className="empty">No teams yet. Create one to build your first office room.</p>}
          <button className="btn block" onClick={() => openModal({ kind: 'team' })}>
            + New team room
          </button>
          <div className="legend">
            {Object.values(STATUS_META).map((m) => (
              <span key={m.label}>
                <i style={{ background: m.color }} />
                {m.label}
              </span>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

export function ActivityFeed() {
  const memory = useWorld(useShallow((s) => s.memory.slice(0, 5)));
  const agents = useWorld((s) => s.agents);
  const teams = useWorld((s) => s.teams);
  const now = useNow();
  const [open, setOpen] = useState(true);

  return (
    <section className={`feed panel${open ? '' : ' collapsed'}`}>
      <div className="panel-head">
        <h2>
          <span className="live-dot" /> Brain activity
        </h2>
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse activity' : 'Expand activity'}>
          {open ? '−' : '+'}
        </button>
      </div>
      {open && (
        <ul>
          {memory.map((m) => {
            const agent = m.agentId ? agents[m.agentId] : null;
            const team = m.teamId ? teams[m.teamId] : null;
            return (
              <li key={m.id} style={{ ['--team' as string]: team?.color ?? '#6b7280' }}>
                <div className="feed-line">
                  <span className="kind" style={{ color: MEMORY_META[m.kind].color }}>
                    {MEMORY_META[m.kind].label}
                  </span>
                  <strong>{agent?.name ?? 'Brain'}</strong>
                  {team && <span className="muted">· {team.name}</span>}
                  <time>{timeAgo(m.createdAt, now)}</time>
                </div>
                <p>{m.content}</p>
              </li>
            );
          })}
          {memory.length === 0 && <li className="empty">Waiting for the first memory…</li>}
        </ul>
      )}
    </section>
  );
}

export function Toasts() {
  const toasts = useWorld((s) => s.toasts);
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Splash() {
  const loaded = useWorld((s) => s.loaded);
  const connection = useWorld((s) => s.connection);
  if (loaded) return null;
  return (
    <div className="splash">
      <div className="panel splash-card">
        <div className="spinner" />
        <h2>Connecting to the central brain…</h2>
        {connection === 'offline' && (
          <p>
            The brain server isn't reachable yet. Start everything with <code>npm run dev</code> from the project root.
          </p>
        )}
      </div>
    </div>
  );
}
