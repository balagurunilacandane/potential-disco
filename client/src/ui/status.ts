import type { AgentStatus, MemoryKind } from '../../../shared/types.ts';

export const STATUS_META: Record<AgentStatus, { label: string; icon: string; color: string }> = {
  working: { label: 'Working', icon: '⌨', color: '#30a46c' },
  thinking: { label: 'Thinking', icon: '…', color: '#f5a524' },
  syncing: { label: 'Syncing to brain', icon: '⇡', color: '#0ea5e9' },
  meeting: { label: 'In a meeting', icon: '◎', color: '#8e4ec6' },
  break: { label: 'Coffee break', icon: '☕', color: '#a18072' },
};

export const MEMORY_META: Record<MemoryKind, { label: string; color: string }> = {
  artifact: { label: 'Output', color: '#30a46c' },
  insight: { label: 'Insight', color: '#0ea5e9' },
  decision: { label: 'Decision', color: '#8e4ec6' },
  note: { label: 'Note', color: '#6b7280' },
};

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
