import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, LayoutGrid, List, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const STATUS_META = {
  active:   { label: 'Active',   dot: 'bg-emerald-400' },
  inactive: { label: 'Inactive', dot: 'bg-slate-300'   },
  trial:    { label: 'Trial',    dot: 'bg-amber-400'   },
  archived: { label: 'Archived', dot: 'bg-slate-300'   },
};

const COLORS = [
  'bg-violet-800 text-violet-200',
  'bg-sky-800 text-sky-200',
  'bg-emerald-800 text-emerald-200',
  'bg-amber-800 text-amber-200',
  'bg-rose-800 text-rose-200',
  'bg-indigo-800 text-indigo-200',
];

function avatarColor(i) { return COLORS[i % COLORS.length]; }
function initials(name) { return name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(); }

const FILTERS = [
  { key: 'active', label: 'פעיל', statuses: ['active'] },
  { key: 'all', label: 'הכל', statuses: null },
  { key: 'trial', label: 'ניסיון', statuses: ['trial'] },
  { key: 'archived', label: 'ארכיון', statuses: ['archived', 'inactive'] },
];

function Avatar({ name, index, size = 'md' }) {
  const sizes = {
    md: 'h-16 w-16 text-base',
    sm: 'h-10 w-10 text-sm',
  };
  return (
    <div
      className={`flex ${sizes[size]} items-center justify-center rounded-full font-semibold ${avatarColor(index)}`}
    >
      {initials(name)}
    </div>
  );
}

function MemberCard({ member, index }) {
  const status = STATUS_META[member.status];
  return (
    <Link
      to={`/members/${member.id}`}
      className="group flex flex-col items-center rounded-lg p-5 text-center transition-colors"
      style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <Avatar name={member.name} index={index} />
      <div className="mt-3 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
        <h3 className="text-sm font-medium tracking-tight text-slate-900 group-hover:text-slate-950">
          {member.name}
        </h3>
      </div>
      <div className="mt-1 text-xs text-slate-500">{member.role}</div>
    </Link>
  );
}

export default function Members() {
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMembers() {
      const { data, error } = await supabase.from('members').select('*');
      if (!error) setMembers(data);
      setLoading(false);
    }
    fetchMembers();
  }, []);

  const activeFilter = FILTERS.find((f) => f.key === filter);

  const filtered = useMemo(() => {
    let list = activeFilter.statuses
      ? members.filter((m) => activeFilter.statuses.includes(m.status))
      : members;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeFilter, query, members]);

  const activeCount = members.filter((m) => m.status === 'active').length;

  if (loading) return <div className="p-8 text-sm text-slate-500">טוען חברים…</div>;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          חברים
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          עיין ונהל את החברים שלך.
        </p>
      </div>

      {/* Filter tabs + count */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const selected = f.key === filter;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={
                  selected
                    ? 'rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground'
                    : 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <span className="text-sm text-slate-500">
          <span className="font-medium text-slate-700">{activeCount}</span> חברים פעילים
        </span>
      </div>

      {/* Search + view toggle + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש חברים..."
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            className={`rounded-md p-2 transition ${
              view === 'grid'
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
            className={`rounded-md p-2 transition ${
              view === 'list'
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <List size={16} />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            שם א–ת
            <ChevronDown size={14} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Grid */}
      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {filtered.map((member, i) => (
            <MemberCard key={member.id} member={member} index={i} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ul className="divide-y divide-slate-100">
            {filtered.map((member, i) => {
              const status = STATUS_META[member.status];
              return (
                <li key={member.id}>
                  <Link
                    to={`/members/${member.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <Avatar name={member.name} index={i} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        <span className="truncate text-sm font-medium text-slate-900">
                          {member.name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{status.label}</div>
                    </div>
                    <div className="text-sm text-slate-600">{member.role}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="rounded-lg p-12 text-center" style={{ border: '1px dashed rgba(255,255,255,0.15)', background: 'rgb(var(--bg-surface))' }}>
          <p className="text-sm text-slate-500">אין חברים התואמים לפילטרים אלה.</p>
        </div>
      )}
    </div>
  );
}
