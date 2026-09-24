// Drives autopilot agents through a work loop: work → think → sync results to the brain → meet → break.
// Agents with autopilot=false are left alone so real AI agents can report their own state via the API.
import type { AgentStatus } from './types.ts';
import { MEETING_DECISIONS, fillTemplate, pick, roleTemplate } from './catalog.ts';
import type { BrainCore } from './brain.ts';

/** Seconds each status lasts. Meeting/break include the walk to and from the desk. */
const DURATION: Record<AgentStatus, [number, number]> = {
  working: [8, 18],
  thinking: [4, 8],
  syncing: [2.5, 3.5],
  meeting: [16, 24],
  break: [14, 20],
};

const NEXT: Record<AgentStatus, [AgentStatus, number][]> = {
  working: [['thinking', 0.35], ['syncing', 0.35], ['meeting', 0.15], ['break', 0.15]],
  thinking: [['working', 0.6], ['syncing', 0.4]],
  syncing: [['working', 1]],
  meeting: [['working', 0.6], ['syncing', 0.4]],
  break: [['working', 1]],
};

function weighted(options: [AgentStatus, number][]): AgentStatus {
  let r = Math.random() * options.reduce((s, [, w]) => s + w, 0);
  for (const [status, w] of options) {
    if ((r -= w) <= 0) return status;
  }
  return options[0][0];
}

function duration(status: AgentStatus) {
  const [min, max] = DURATION[status];
  return (min + Math.random() * (max - min)) * 1000;
}

export function startSimulation(brain: BrainCore) {
  const nextChange = new Map<string, number>();

  // Newly hired agents get a moment to settle in before their first status change.
  const unsubscribe = brain.on((ev) => {
    if (ev.type === 'agent:created') nextChange.set(ev.agent.id, Date.now() + 6000 + Math.random() * 4000);
    if (ev.type === 'agent:deleted') nextChange.delete(ev.id);
  });

  const tick = () => {
    const now = Date.now();
    for (const agent of brain.agents) {
      if (!agent.autopilot) continue;
      const due = nextChange.get(agent.id);
      if (due === undefined) {
        // Stagger agents on startup so they don't all move in lockstep.
        nextChange.set(agent.id, now + Math.random() * 8000);
        continue;
      }
      if (now < due) continue;

      const prev = agent.status;
      const status = weighted(NEXT[prev]);
      const template = roleTemplate(agent.role);
      nextChange.set(agent.id, now + duration(status));

      if (status === 'syncing') {
        // Push the finished work into the brain's shared memory.
        const insight = Math.random() < 0.35;
        brain.remember({
          agentId: agent.id,
          kind: insight ? 'insight' : 'artifact',
          content: insight ? fillTemplate(pick(template.insights)) : `Completed: ${agent.currentTask}`,
        });
        brain.updateAgent(agent.id, {
          status,
          tasksCompleted: insight ? agent.tasksCompleted : agent.tasksCompleted + 1,
        });
      } else if (prev === 'meeting' && Math.random() < 0.5) {
        brain.remember({
          agentId: agent.id,
          kind: 'decision',
          content: fillTemplate(pick(MEETING_DECISIONS), { task: agent.currentTask }),
        });
        brain.updateAgent(agent.id, { status });
      } else if (prev === 'syncing' && status === 'working') {
        brain.updateAgent(agent.id, { status, currentTask: fillTemplate(pick(template.tasks)) });
      } else {
        brain.updateAgent(agent.id, { status });
      }
    }
  };

  const timer = setInterval(tick, 1000);
  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}
