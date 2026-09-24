import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MAX_AGENTS_PER_TEAM } from '../../../shared/types.ts';
import { DEMO } from '../lib/demo.ts';
import { VIEW_ANGLES, moveCamera, openModal, select, setTouring, setViewAngle, useWorld, type ViewAngle } from '../lib/store.ts';
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

export function TopBar({ onHelp }: { onHelp: () => void }) {
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
          {connection === 'online' ? (DEMO ? 'Demo' : 'Live') : connection === 'connecting' ? 'Connecting' : 'Offline'}
        </span>
      </div>
      <div className="actions">
        <button className="btn icon-only" onClick={onHelp} title="How this works" aria-label="How this works">
          ?
        </button>
        <button className="btn" onClick={() => openModal({ kind: 'team' })}>
          + <span className="long">New team</span>
          <span className="short">Team</span>
        </button>
        <button className="btn primary" onClick={() => openModal({ kind: 'agent' })} disabled={teamCount === 0}>
          + <span className="long">Hire agent</span>
          <span className="short">Hire</span>
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
  const [open, setOpen] = useState(() => window.innerWidth > 760);

  return (
    <aside className={`teams panel${open ? '' : ' collapsed'}`}>
      <div className="panel-head">
        <h2>Teams · {teams.length}</h2>
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? 'Hide teams' : 'Show teams'} aria-expanded={open}>
          {open ? '▴' : '▾'}
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
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? 'Hide activity' : 'Show activity'} aria-expanded={open}>
          {open ? '▴' : '▾'}
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

const ROTATE = Math.PI / 2;

/** On-screen camera controls, so nobody needs to know mouse gestures. */
export function CameraBar() {
  const viewAngle = useWorld((s) => s.viewAngle);
  const touring = useWorld((s) => s.touring);
  const inspectorOpen = useWorld((s) => s.selection !== null);
  return (
    <div className={`camera-dock${inspectorOpen ? ' with-inspector' : ''}`}>
    <nav className="camera-bar panel" aria-label="Camera">
      <button className="cam-btn wide" onClick={() => moveCamera({ fit: true })} title="Show the whole office (F)">
        <span aria-hidden>⤢</span> Fit all
      </button>
      <span className="cam-sep" />
      <button className="cam-btn" onClick={() => moveCamera({ rotate: -ROTATE })} title="Rotate left (Q)" aria-label="Rotate left">
        ↺
      </button>
      <button className="cam-btn" onClick={() => moveCamera({ rotate: ROTATE })} title="Rotate right (E)" aria-label="Rotate right">
        ↻
      </button>
      <span className="cam-sep" />
      <button className="cam-btn" onClick={() => moveCamera({ zoomScale: 1 / 1.35 })} title="Zoom out (−)" aria-label="Zoom out">
        −
      </button>
      <button className="cam-btn" onClick={() => moveCamera({ zoomScale: 1.35 })} title="Zoom in (+)" aria-label="Zoom in">
        +
      </button>
      <span className="cam-sep" />
      <div className="segmented" role="radiogroup" aria-label="View angle">
        {(Object.keys(VIEW_ANGLES) as ViewAngle[]).map((key, i) => (
          <button
            key={key}
            role="radio"
            aria-checked={viewAngle === key}
            className={viewAngle === key ? 'active' : ''}
            onClick={() => setViewAngle(key)}
            title={`${VIEW_ANGLES[key].hint} (${i + 1})`}
          >
            {VIEW_ANGLES[key].label}
          </button>
        ))}
      </div>
      <span className="cam-sep" />
      <button
        className={`cam-btn wide tour${touring ? ' active' : ''}`}
        onClick={() => setTouring(!touring)}
        title="Let the camera show you around (T)"
        aria-pressed={touring}
      >
        <span aria-hidden>{touring ? '■' : '▶'}</span> {touring ? 'Stop tour' : 'Tour'}
      </button>
    </nav>
    </div>
  );
}

export function TourCaption() {
  const label = useWorld((s) => (s.touring ? s.tourLabel : null));
  const agents = useWorld((s) => s.agents);
  const teams = useWorld((s) => s.teams);
  if (!label) return null;
  const team = Object.values(teams).find((t) => t.name === label);
  const members = team ? Object.values(agents).filter((a) => a.teamId === team.id) : [];
  const busy = members.filter((a) => a.status === 'working' || a.status === 'syncing' || a.status === 'thinking').length;
  return (
    <div className="tour-caption" key={label} style={{ ['--team' as string]: team?.color ?? '#39d0ff' }}>
      <span className="eyebrow">Now showing</span>
      <strong>{label}</strong>
      <small>
        {team
          ? `${members.length} agents · ${busy} busy right now`
          : 'Where every team stores what it learns'}
      </small>
    </div>
  );
}

const WELCOME_KEY = 'agent-world:welcomed';

function readWelcomed() {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

export function useWelcome() {
  const [open, setOpen] = useState(() => !readWelcomed());
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // Private windows may block storage; the card simply shows again next time.
    }
  };
  return { open, show: () => setOpen(true), close };
}

export function Welcome({ onClose }: { onClose: () => void }) {
  const steps = [
    { icon: '▦', title: 'Each team has its own room', text: 'Use “New team” to add a room to the office.' },
    { icon: '☺', title: 'Each AI agent is a worker', text: 'Use “Hire agent” to give someone a desk. Click any worker to see what they are doing.' },
    { icon: '◉', title: 'The Central Brain remembers everything', text: 'Click the glowing core in the middle to read what every team has learned.' },
  ];
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal panel welcome" role="dialog" aria-label="Welcome">
        <p className="eyebrow">Welcome</p>
        <h2>Your AI office, at a glance</h2>
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.title}>
              <span className="step-icon" aria-hidden>
                {s.icon}
              </span>
              <span>
                <strong>{s.title}</strong>
                <small>{s.text}</small>
              </span>
            </li>
          ))}
        </ol>
        <p className="muted small">
          Move around by dragging and scrolling, or use the buttons at the bottom of the screen.
        </p>
        <div className="row end">
          <button className="btn" onClick={onClose}>
            Explore on my own
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onClose();
              setTouring(true);
            }}
          >
            ▶ Show me around
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown if the browser drops the 3D view, usually when the device runs low on graphics memory. */
export function GraphicsNotice() {
  const lost = useWorld((s) => s.graphicsLost);
  if (!lost) return null;
  return <SceneMessage title="The 3D view stopped" text="Your device ran low on graphics memory. Reload to start it again; your teams and agents are kept." />;
}

export function SceneMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="splash">
      <div className="panel splash-card" role="alert">
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}
