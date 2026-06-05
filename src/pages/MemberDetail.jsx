import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Instagram, Youtube, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import {
  MEMBERS,
  STATUS_META,
  TIER_STYLES,
  avatarColor,
  initials,
  getMember,
} from '../data/members.js';

// Fill-in defaults so any placeholder member without deep data still renders
// a realistic-looking detail page.
function hydrate(member) {
  return {
    email: `${member.id.replace(/-/g, '.')}@example.com`,
    phone: '+1 (415) 555-0100',
    location: 'Remote',
    company: 'Independent',
    bio: 'Example profile. Replace with your own data.',
    socials: { instagram: member.id, youtube: `@${member.id}` },
    startedAt: '—',
    revenue: 0,
    mrr: member.monthlyValue || 0,
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
    ...member,
  };
}

const TABS = ['Overview', 'Activity', 'Billing', 'Notes'];

function formatMoney(n) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompact(n) {
  return n.toLocaleString('en-US');
}

function ProgressBar({ now, best }) {
  // Segmented tier bar. "Now" and "Best" markers sit on top.
  const total = Math.max(best * 1.1, now);
  const nowPct = Math.min(100, (now / total) * 100);
  const bestPct = Math.min(100, (best / total) * 100);

  return (
    <div className="relative">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-rose-300" style={{ width: '20%' }} />
        <div className="h-full bg-amber-300" style={{ width: '25%' }} />
        <div className="h-full bg-emerald-300" style={{ width: '30%' }} />
        <div className="h-full bg-sky-300" style={{ width: '25%' }} />
      </div>

      {/* Now marker */}
      <div
        className="absolute -top-1 -translate-x-1/2"
        style={{ left: `${nowPct}%` }}
      >
        <div className="h-4 w-1 rounded-full bg-slate-900" />
      </div>
      <div
        className="absolute top-4 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-slate-900"
        style={{ left: `${nowPct}%` }}
      >
        Now: ${(now / 1000).toFixed(1)}K
      </div>

      {/* Best marker */}
      <div
        className="absolute -top-1 -translate-x-1/2"
        style={{ left: `${bestPct}%` }}
      >
        <div className="h-4 w-1 rounded-full bg-slate-400" />
      </div>
      <div
        className="absolute top-4 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-500"
        style={{ left: `${bestPct}%` }}
      >
        Best: ${(best / 1000).toFixed(1)}K
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

function ProgressCard({ title, percent, subtitle }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-slate-900">{title}</h3>
        <span className="text-2xl font-semibold tracking-tight text-slate-900">
          {percent}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-accent"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

function InfoItem({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <Icon size={14} className="flex-none text-slate-400" />
      <span className="truncate">{children}</span>
    </div>
  );
}

export default function MemberDetail() {
  const { id } = useParams();
  const base = getMember(id);
  const [activeTab, setActiveTab] = useState(TABS[0]);

  if (!base) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-12 text-center">
        <p className="text-sm text-slate-500">Member not found.</p>
        <Link to="/members" className="text-sm text-slate-900 underline">
          Back to Members
        </Link>
      </div>
    );
  }

  const member = hydrate(base);
  const status = STATUS_META[member.status];
  const avatarIdx = MEMBERS.findIndex((m) => m.id === member.id);
  const checklistPct = Math.round((member.checklist.done / member.checklist.total) * 100);
  const trainingPct =
    member.training.total === 0
      ? 0
      : Math.round((member.training.done / member.training.total) * 100);

  return (
    <div className="w-full space-y-8">
      <Link
        to="/members"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={14} />
        Back to Members
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-16 w-16 flex-none items-center justify-center rounded-full text-xl font-semibold ${avatarColor(avatarIdx)}`}
          >
            {initials(member.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {member.name}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLES[member.tier] || TIER_STYLES.Standard}`}
              >
                {member.tier}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {member.monthlyValue && (
                <span className="text-sm text-slate-600">
                  · ${member.monthlyValue.toLocaleString()}/mo
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              <InfoItem icon={Mail}>{member.email}</InfoItem>
              <InfoItem icon={Phone}>{member.phone}</InfoItem>
              <InfoItem icon={MapPin}>{member.location}</InfoItem>
              <InfoItem icon={Building2}>{member.company}</InfoItem>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <a
                href="#"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Instagram"
              >
                <Instagram size={15} />
              </a>
              <a
                href="#"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="YouTube"
              >
                <Youtube size={15} />
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-sm lg:text-right">
          <div className="text-xs text-slate-500">Started: {member.startedAt}</div>
          <p className="mt-1 text-sm text-slate-600">{member.bio}</p>
        </div>
      </div>

      {/* Progress bar */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Revenue Progress
          </h2>
          <span className="text-xs text-slate-400">MRR journey</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-6 pt-6 pb-10">
          <ProgressBar now={member.progressNow} best={member.progressBest} />
        </div>
      </section>

      {/* Stats row */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Revenue" value={formatMoney(member.revenue)} />
          <StatTile label="MRR" value={`$${member.mrr.toLocaleString()}`} />
          <StatTile label="Active Clients" value={member.activeClients} />
          <StatTile label="Followers" value={formatCompact(member.followers)} />
          <StatTile label="New Clients" value={member.newClients} />
        </div>
      </section>

      {/* Tabs */}
      <section>
        <div className="border-b border-slate-200">
          <div className="-mb-px flex flex-wrap gap-x-1 overflow-x-auto">
            {TABS.map((tab) => {
              const selected = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={
                    selected
                      ? 'whitespace-nowrap border-b-2 border-slate-900 px-3 py-2 text-sm font-medium text-slate-900'
                      : 'whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-slate-500 hover:text-slate-700'
                  }
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            [Data for <span className="font-medium text-slate-700">{activeTab}</span> will display here]
          </p>
        </div>
      </section>

      {/* Bottom cards */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ProgressCard
          title="Checklist Progress"
          percent={checklistPct}
          subtitle={`${member.checklist.done}/${member.checklist.total}`}
        />
        <ProgressCard
          title="Training Progress"
          percent={trainingPct}
          subtitle={`${member.training.done}/${member.training.total}`}
        />
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-medium text-slate-900">Last Submissions</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {member.submissions.map((sub) => (
              <li
                key={sub.label}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-slate-700">{sub.label}</span>
                <span className="text-slate-500">{sub.when}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-3 flex items-baseline justify-between border-b border-slate-200 pb-2">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Recent Activity
          </h2>
        </div>
        <ol className="space-y-3">
          {member.activity.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-4 py-3"
            >
              <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-900">{item.text}</div>
                <div className="text-xs text-slate-500">{item.meta}</div>
              </div>
              <div className="text-xs text-slate-500">{item.when}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
