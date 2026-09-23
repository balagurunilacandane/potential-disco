import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { MAX_AGENTS_PER_TEAM, type Appearance, type HairStyle } from '../../../shared/types.ts';
import {
  AGENT_NAMES,
  HAIR_COLORS,
  HAIR_STYLES,
  ROLE_NAMES,
  SHIRT_COLORS,
  SKIN_TONES,
  TEAM_COLORS,
  TEAM_ICONS,
  pick,
  randomAppearance,
} from '../../../shared/catalog.ts';
import { api } from '../lib/api.ts';
import { openModal, select, toast, useWorld } from '../lib/store.ts';
import { seatLayout, slotPosition } from '../scene/layout.ts';
import { VoxelPerson, useRig } from '../scene/VoxelPerson.tsx';

export function Modals() {
  const modal = useWorld((s) => s.modal);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openModal(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);
  if (!modal) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && openModal(null)}>
      {modal.kind === 'team' ? <CreateTeam /> : <HireAgent initialTeamId={modal.teamId} />}
    </div>
  );
}

function Dialog({ title, subtitle, children, onSubmit }: { title: string; subtitle: string; children: ReactNode; onSubmit: (e: FormEvent) => void }) {
  return (
    <form className="modal panel" onSubmit={onSubmit} role="dialog" aria-label={title}>
      <button type="button" className="close icon-btn" onClick={() => openModal(null)} aria-label="Close">
        ×
      </button>
      <h2>{title}</h2>
      <p className="muted">{subtitle}</p>
      {children}
    </form>
  );
}

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button
          type="button"
          key={c}
          role="radio"
          aria-checked={value === c}
          className={value === c ? 'active' : ''}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
    </div>
  );
}

function CreateTeam() {
  const count = useWorld((s) => Object.keys(s.teams).length);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TEAM_COLORS[count % TEAM_COLORS.length]);
  const [icon, setIcon] = useState(TEAM_ICONS[count % TEAM_ICONS.length]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const team = await api.createTeam({ name, description, color, icon });
      openModal(null);
      const [x, z] = slotPosition(team.slot);
      select({ kind: 'team', id: team.id }, { x, z, zoom: 26 });
      toast(`${team.name} room is being built — hire its first agent!`, 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="New team room" subtitle="Each team gets its own office room, wired to the central brain." onSubmit={submit}>
      <div className="team-preview" style={{ ['--team' as string]: color }}>
        <span className="team-swatch big" style={{ background: color }}>
          {icon}
        </span>
        <strong>{name || 'Team name'}</strong>
      </div>
      <label>
        Name
        <input autoFocus required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Success" />
      </label>
      <label>
        What does this team do?
        <input maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
      </label>
      <div className="field">
        <span>Colour</span>
        <Swatches colors={TEAM_COLORS} value={color} onChange={setColor} label="Team colour" />
      </div>
      <div className="field">
        <span>Icon</span>
        <div className="icons" role="radiogroup" aria-label="Team icon">
          {TEAM_ICONS.map((i) => (
            <button type="button" key={i} role="radio" aria-checked={icon === i} className={icon === i ? 'active' : ''} onClick={() => setIcon(i)}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <div className="row end">
        <button type="button" className="btn" onClick={() => openModal(null)}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy || !name.trim()}>
          {busy ? 'Building…' : 'Build room'}
        </button>
      </div>
    </Dialog>
  );
}

function PreviewPerson({ appearance }: { appearance: Appearance }) {
  const rig = useRig();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!rig.root.current) return;
    rig.root.current.rotation.y = Math.sin(t * 0.6) * 0.5;
    rig.armR.current.rotation.x = -2.6 + Math.sin(t * 6) * 0.25;
    rig.armR.current.rotation.z = 0.25;
    rig.armL.current.rotation.x = Math.sin(t * 1.5) * 0.05;
    rig.head.current.rotation.z = Math.sin(t * 1.2) * 0.08;
    rig.body.current.position.y = Math.abs(Math.sin(t * 2)) * 0.03;
  });
  return <VoxelPerson appearance={appearance} rig={rig} />;
}

function AvatarPreview({ appearance }: { appearance: Appearance }) {
  return (
    <div className="avatar-preview">
      <Canvas orthographic camera={{ position: [3, 2.4, 5], zoom: 115 }} dpr={[1, 2]}>
        <hemisphereLight args={['#ffffff', '#9aa4b2', 2.2]} />
        <directionalLight position={[3, 5, 4]} intensity={2} />
        <group position={[0, -0.9, 0]}>
          <PreviewPerson appearance={appearance} />
        </group>
      </Canvas>
    </div>
  );
}

function HireAgent({ initialTeamId }: { initialTeamId?: string }) {
  const teams = useWorld(useShallow((s) => Object.values(s.teams).sort((a, b) => a.slot - b.slot)));
  const agents = useWorld((s) => s.agents);
  const taken = useMemo(() => new Set(Object.values(agents).map((a) => a.name)), [agents]);
  const suggestName = () => {
    const free = AGENT_NAMES.filter((n) => !taken.has(n));
    return pick(free.length ? free : AGENT_NAMES);
  };
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of Object.values(agents)) c[a.teamId] = (c[a.teamId] ?? 0) + 1;
    return c;
  }, [agents]);

  const firstOpen = teams.find((t) => (counts[t.id] ?? 0) < MAX_AGENTS_PER_TEAM)?.id ?? '';
  const [teamId, setTeamId] = useState(initialTeamId ?? firstOpen);
  const [name, setName] = useState(suggestName);
  const [role, setRole] = useState(ROLE_NAMES[0]);
  const [appearance, setAppearance] = useState<Appearance>(() => randomAppearance());
  const [autopilot, setAutopilot] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Appearance>) => setAppearance((a) => ({ ...a, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const agent = await api.createAgent({ name, role, teamId, appearance, autopilot });
      const team = teams.find((t) => t.id === agent.teamId)!;
      openModal(null);
      const [x, z] = slotPosition(team.slot);
      const [cx, cz] = seatLayout(agent.seat).chair;
      select({ kind: 'agent', id: agent.id }, { x: x + cx, z: z + cz, zoom: 50 });
      toast(`Welcome ${agent.name} to ${team.name}!`, 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Hire an agent" subtitle="A new worker gets a desk in their team room and reports to the brain." onSubmit={submit}>
      <div className="hire-grid">
        <div>
          <AvatarPreview appearance={appearance} />
          <button type="button" className="btn block" onClick={() => setAppearance(randomAppearance())}>
            🎲 Randomize
          </button>
        </div>
        <div className="hire-fields">
          <label>
            Name
            <div className="input-row">
              <input required maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
              <button type="button" className="icon-btn" onClick={() => setName(suggestName())} title="Suggest a name">
                ↻
              </button>
            </div>
          </label>
          <label>
            Role
            <input list="roles" required maxLength={40} value={role} onChange={(e) => setRole(e.target.value)} />
            <datalist id="roles">
              {ROLE_NAMES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <label>
            Team
            <select required value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => {
                const full = (counts[t.id] ?? 0) >= MAX_AGENTS_PER_TEAM;
                return (
                  <option key={t.id} value={t.id} disabled={full}>
                    {t.icon} {t.name} ({counts[t.id] ?? 0}/{MAX_AGENTS_PER_TEAM}){full ? ' — full' : ''}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
      </div>

      <div className="look">
        <div className="field">
          <span>Skin</span>
          <Swatches colors={SKIN_TONES} value={appearance.skin} onChange={(skin) => set({ skin })} label="Skin tone" />
        </div>
        <div className="field">
          <span>Hair</span>
          <Swatches colors={HAIR_COLORS} value={appearance.hair} onChange={(hair) => set({ hair })} label="Hair colour" />
        </div>
        <div className="field">
          <span>Outfit</span>
          <Swatches colors={SHIRT_COLORS} value={appearance.shirt} onChange={(shirt) => set({ shirt })} label="Shirt colour" />
        </div>
        <div className="field">
          <span>Style</span>
          <div className="chips">
            {HAIR_STYLES.map((h: HairStyle) => (
              <button type="button" key={h} className={`chip${appearance.hairStyle === h ? ' active' : ''}`} onClick={() => set({ hairStyle: h })}>
                {h}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Extras</span>
          <div className="chips">
            {(['glasses', 'headphones', 'beard'] as const).map((k) => (
              <button type="button" key={k} className={`chip${appearance[k] ? ' active' : ''}`} onClick={() => set({ [k]: !appearance[k] })}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={autopilot} onChange={(e) => setAutopilot(e.target.checked)} />
        <span>
          <strong>Autopilot</strong>
          <small>Let the brain simulate this agent. Turn off to drive it from a real AI agent via the API.</small>
        </span>
      </label>

      <div className="row end">
        <button type="button" className="btn" onClick={() => openModal(null)}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy || !teamId || !name.trim()}>
          {busy ? 'Hiring…' : 'Hire agent'}
        </button>
      </div>
    </Dialog>
  );
}
