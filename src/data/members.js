// ---------------------------------------------------------------------------
// Placeholder member data. Replace this file (or the imports in Members.jsx
// and MemberDetail.jsx) with a real /api/members query once Supabase is wired.
//
// Each member has enough structure to support both the grid card and the
// detail page without changing shape.
// ---------------------------------------------------------------------------

export const STATUS_META = {
  active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  trial: { label: 'Trial', dot: 'bg-amber-500', text: 'text-amber-700' },
  inactive: { label: 'Inactive', dot: 'bg-rose-500', text: 'text-rose-700' },
  archived: { label: 'Archived', dot: 'bg-slate-400', text: 'text-slate-600' },
};

export const TIER_STYLES = {
  Standard: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  Pro: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200',
  Enterprise: 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200',
};

// A small palette of muted avatar backgrounds. Cycle through by index so
// each member gets a stable color without us hand-picking.
const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
  'bg-lime-100 text-lime-700',
];

export function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const MEMBERS = [
  {
    id: 'example-member-a',
    name: 'Example Member A',
    status: 'active',
    tier: 'Pro',
    monthlyValue: 0,
    monthlyLabel: '$0/mo',
    email: 'member-a@example.com',
    phone: '+1 (000) 000-0000',
    location: 'City, Country',
    company: 'Example Co.',
    bio: 'Example member profile. Replace with your own data once /api/members is wired up.',
    socials: { instagram: 'example', youtube: '@example' },
    startedAt: 'Jan 1, 2026',
    revenue: 0,
    mrr: 0,
    activeClients: 0,
    followers: 0,
    newClients: 0,
    progressNow: 0,
    progressBest: 0,
    checklist: { done: 0, total: 0 },
    training: { done: 0, total: 0 },
    submissions: [
      { label: 'Monthly Totals', when: '—' },
      { label: 'Weekly Update', when: 'Never' },
    ],
    activity: [
      { text: 'Example activity item', meta: '—', when: '—' },
    ],
  },
  {
    id: 'example-member-b',
    name: 'Example Member B',
    status: 'trial',
    tier: 'Standard',
    monthlyValue: 0,
    monthlyLabel: '$0/mo',
  },
];

export function getMember(id) {
  return MEMBERS.find((m) => m.id === id);
}
