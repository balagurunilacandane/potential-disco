// Static catalogs: team palettes, icons, roles with work templates, and appearance options.
import type { Appearance, HairStyle } from './types.ts';

export const TEAM_COLORS = [
  '#e5484d', // red
  '#3e63dd', // blue
  '#30a46c', // green
  '#f76b15', // orange
  '#8e4ec6', // purple
  '#12a594', // teal
  '#d6409f', // pink
  '#ffb224', // amber
];

/** Glyphs that render in any system font — used on room signs and monitors. */
export const TEAM_ICONS = ['</>', '$', '#', '@', '%', '★', '∞', '✎', '♪', '?', '▲', '◆'];

export interface RoleTemplate {
  role: string;
  tasks: string[];
  insights: string[];
}

export const ROLES: RoleTemplate[] = [
  {
    role: 'Engineer',
    tasks: [
      'Implement the auth middleware',
      'Refactor the billing service',
      'Fix flaky integration tests',
      'Add caching to the search API',
      'Review pull request #{n}',
      'Migrate the jobs queue',
    ],
    insights: [
      'p95 latency dropped {p}% after adding the cache',
      'The legacy importer is the main source of test flakiness',
      'Batching writes cut database load by {p}%',
    ],
  },
  {
    role: 'Designer',
    tasks: [
      'Sketch the onboarding flow',
      'Polish the dashboard empty states',
      'Build the icon set',
      'Prototype the mobile nav',
      'Run a usability review',
    ],
    insights: [
      'Users miss the secondary CTA — move it above the fold',
      'Dark mode contrast fails on 3 components',
      'Shorter forms raised completion by {p}%',
    ],
  },
  {
    role: 'Marketer',
    tasks: [
      'Draft the launch campaign',
      'Schedule social posts for the week',
      'Write the newsletter',
      'Plan the influencer outreach',
      'A/B test landing headlines',
    ],
    insights: [
      'Short-form video drives {p}% more sign-ups than static posts',
      'Tuesday mornings get the best open rates',
      'Headline B beat A by {p}%',
    ],
  },
  {
    role: 'Analyst',
    tasks: [
      'Build the weekly KPI report',
      'Analyze the churn cohort',
      'Model the pricing experiment',
      'Clean the events dataset',
      'Forecast Q{q} revenue',
    ],
    insights: [
      'Churn is concentrated in the first {n} days',
      'Annual plans retain {p}% better than monthly',
      'Activation predicts retention better than sign-up source',
    ],
  },
  {
    role: 'Researcher',
    tasks: [
      'Survey competitor features',
      'Summarize the latest papers',
      'Interview {n} customers',
      'Map the market landscape',
      'Benchmark the new model',
    ],
    insights: [
      'Two competitors shipped the same feature this month',
      'Customers value reliability over new features',
      'The new model is {p}% cheaper at equal quality',
    ],
  },
  {
    role: 'Writer',
    tasks: [
      'Write the product docs',
      'Draft the blog post',
      'Edit the release notes',
      'Script the demo video',
      'Update the help center',
    ],
    insights: [
      'Docs pages with examples get {p}% fewer support tickets',
      'Readers drop off after 800 words',
    ],
  },
  {
    role: 'Finance',
    tasks: [
      'Reconcile the monthly ledger',
      'Prepare the budget review',
      'Audit vendor invoices',
      'Update the runway model',
      'File the tax estimates',
    ],
    insights: [
      'Cloud spend grew {p}% month over month',
      'Runway extends {n} months with the new plan',
      'Three vendors are billing for unused seats',
    ],
  },
  {
    role: 'Support',
    tasks: [
      'Triage the ticket queue',
      'Write macro responses',
      'Escalate the billing bug',
      'Call {n} key accounts',
      'Update the FAQ',
    ],
    insights: [
      'Password resets are {p}% of all tickets',
      'Response time improved after the new macros',
    ],
  },
  {
    role: 'Manager',
    tasks: [
      'Plan the sprint',
      'Run the team retro',
      'Align roadmap with the brain',
      'Write the weekly update',
      'Unblock the release',
    ],
    insights: [
      'The team is over-committed by {n} story points',
      'Cross-team handoffs are the main bottleneck',
    ],
  },
];

export const ROLE_NAMES = ROLES.map((r) => r.role);

export function roleTemplate(role: string): RoleTemplate {
  return ROLES.find((r) => r.role.toLowerCase() === role.toLowerCase()) ?? {
    role,
    tasks: ['Work on the backlog', 'Research the next milestone', 'Review teammate output', 'Document findings'],
    insights: ['Found a faster way to finish recurring work', 'Shared learnings with the team'],
  };
}

export const MEETING_DECISIONS = [
  'Team agreed to prioritise {task}',
  'Decided to ship {task} by Friday',
  'Split {task} into smaller milestones',
  'Paired up on {task} to unblock it',
];

export const AGENT_NAMES = [
  'Nova', 'Atlas', 'Iris', 'Orion', 'Luna', 'Kai', 'Mira', 'Zed', 'Aria', 'Leo', 'Juno', 'Rex',
  'Sage', 'Echo', 'Ivy', 'Milo', 'Nia', 'Otto', 'Pixel', 'Quinn', 'Rumi', 'Tess', 'Vega', 'Wren',
  'Ada', 'Bolt', 'Cleo', 'Dex', 'Ember', 'Finn', 'Gia', 'Hugo',
];

export const SKIN_TONES = ['#f5d0b0', '#eab897', '#d7a07a', '#b97a55', '#8d5a3b', '#5f3b26'];
export const HAIR_COLORS = ['#1c1a1a', '#3b2418', '#6b3a1f', '#9a4a22', '#c9a36b', '#d9d2c5', '#b8322e'];
export const SHIRT_COLORS = ['#f4f1ea', '#1f2937', '#2563eb', '#16a34a', '#dc2626', '#e8b4c8', '#7c3aed', '#0f766e', '#f59e0b'];
export const PANTS_COLORS = ['#1f2937', '#374151', '#1e3a8a', '#44403c', '#57534e'];
export const HAIR_STYLES: HairStyle[] = ['short', 'long', 'bun', 'spiky', 'cap', 'bald'];

export function pick<T>(list: readonly T[], rand: () => number = Math.random): T {
  return list[Math.floor(rand() * list.length)];
}

export function randomAppearance(rand: () => number = Math.random): Appearance {
  return {
    skin: pick(SKIN_TONES, rand),
    hair: pick(HAIR_COLORS, rand),
    hairStyle: pick(HAIR_STYLES, rand),
    shirt: pick(SHIRT_COLORS, rand),
    pants: pick(PANTS_COLORS, rand),
    glasses: rand() < 0.35,
    headphones: rand() < 0.25,
    beard: rand() < 0.15,
  };
}

/** Fills `{n}`, `{p}`, `{q}` and `{task}` placeholders in a template string. */
export function fillTemplate(template: string, vars: { task?: string } = {}, rand: () => number = Math.random): string {
  return template
    .replace(/\{n\}/g, () => String(2 + Math.floor(rand() * 40)))
    .replace(/\{p\}/g, () => String(5 + Math.floor(rand() * 45)))
    .replace(/\{q\}/g, () => String(1 + Math.floor(rand() * 4)))
    .replace(/\{task\}/g, () => (vars.task ?? 'the backlog').toLowerCase());
}
