import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const COLUMNS = [
  {
    key:   'green',
    label: 'רץ',
    emoji: '🟢',
    color: '#22c55e',
    bg:    'rgba(34,197,94,0.08)',
    border:'rgba(34,197,94,0.25)',
    desc:  'בשליטה, מגיע לפגישות, משתף נצחונות',
  },
  {
    key:   'orange',
    label: 'צריך תשומת לב',
    emoji: '🟠',
    color: '#f97316',
    bg:    'rgba(249,115,22,0.08)',
    border:'rgba(249,115,22,0.25)',
    desc:  'מעורב אך לא עד הסוף, תקוע איפשהו',
  },
  {
    key:   'red',
    label: 'נעלם',
    emoji: '🔴',
    color: '#ef4444',
    bg:    'rgba(239,68,68,0.08)',
    border:'rgba(239,68,68,0.25)',
    desc:  'לא מגיע, צריך פנייה מיידית',
  },
];

const RANK_ORDER = ['EXPERT','CAPTAIN','CO-PILOT','SECOND OFFICER','CREW','TRAINEE'];

function fmtILS(n) {
  if (!n) return '₪0';
  return '₪' + Number(n).toLocaleString('he-IL');
}

function RankBadge({ rank }) {
  const map = {
    TRAINEE:        { label: 'Trainee',        color: '#6b7280' },
    CREW:           { label: 'Crew',            color: '#60a5fa' },
    'SECOND OFFICER':{ label: 'Second Officer', color: '#a78bfa' },
    'CO-PILOT':     { label: 'Co-Pilot',        color: '#34d399' },
    CAPTAIN:        { label: 'Captain',         color: '#F5C118' },
    EXPERT:         { label: 'Expert',          color: '#f97316' },
  };
  const m = map[rank] || map['TRAINEE'];
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: m.color + '22', color: m.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {m.label}
    </span>
  );
}

function MemberCard({ member, onDragStart }) {
  const col = COLUMNS.find(c => c.key === member.status) || COLUMNS[0];

  return (
    <div draggable onDragStart={e => onDragStart(e, member)}
      className="rounded-2xl p-3 cursor-grab active:cursor-grabbing select-none transition-all hover:scale-[1.01]"
      style={{ background: 'rgb(var(--bg-elevated))', border: `1px solid rgba(255,255,255,0.07)`,
        borderRight: `3px solid ${col.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>

      {/* פרופיל */}
      <div className="flex items-center gap-2.5 mb-3">
        {member.profile_image_url
          ? <img src={member.profile_image_url} alt="" className="rounded-full flex-none"
              style={{ width: 36, height: 36, objectFit: 'cover' }} />
          : <div className="rounded-full flex-none flex items-center justify-center text-sm font-bold"
              style={{ width: 36, height: 36, background: col.color + '22', color: col.color }}>
              {(member.full_name || '?')[0].toUpperCase()}
            </div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">{member.full_name}</p>
          <RankBadge rank={member.rank} />
        </div>
      </div>

      {/* נתונים */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>הכנסה חודשית</p>
          <p className="text-sm font-bold" style={{ color: '#F5C118' }}>{fmtILS(member.last_monthly)}</p>
        </div>
        <div className="rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>עסקאות</p>
          <p className="text-sm font-bold text-white">{member.deals_count}
            <span className="text-[10px] font-normal mr-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {fmtILS(member.deals_total)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Column({ col, members, onDragStart, onDrop }) {
  const [over, setOver] = useState(false);

  return (
    <div className="flex flex-col rounded-2xl" style={{ flex: 1, minWidth: 260 }}>
      {/* כותרת עמודה */}
      <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl"
        style={{ background: col.bg, border: `1px solid ${col.border}`, borderBottom: 'none' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{col.emoji}</span>
          <div>
            <p className="text-sm font-bold text-white">{col.label}</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{col.desc}</p>
          </div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ background: col.color + '33', color: col.color }}>{members.length}</span>
      </div>

      {/* אזור drop */}
      <div className="flex flex-col gap-2 flex-1 p-2 rounded-b-2xl transition-colors"
        style={{
          background: over ? col.color + '08' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${over ? col.color : 'rgba(255,255,255,0.06)'}`,
          borderTop: 'none', minHeight: 120,
        }}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { setOver(false); onDrop(e, col.key); }}>
        {members.map(m => (
          <MemberCard key={m.user_id} member={m} onDragStart={onDragStart} />
        ))}
        {members.length === 0 && (
          <p className="text-center py-6 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            גרור לכאן
          </p>
        )}
      </div>
    </div>
  );
}

export default function AdminTrafficLights() {
  const { user } = useUser();
  const isAdmin = user?.id === ADMIN_ID;

  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const dragging = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/traffic-lights');
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }

  async function updateStatus(userId, status) {
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, status } : m));
    await fetch(`/api/traffic-lights/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  function onDragStart(e, member) {
    dragging.current = member;
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDrop(e, newStatus) {
    e.preventDefault();
    if (dragging.current && dragging.current.status !== newStatus) {
      updateStatus(dragging.current.user_id, newStatus);
    }
    dragging.current = null;
  }

  const q = search.toLowerCase();
  const filtered = members.filter(m =>
    !q || m.full_name?.toLowerCase().includes(q)
  );

  // sort within each column by rank then name
  const sorted = [...filtered].sort((a, b) => {
    const ri = RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
    if (ri !== 0) return ri;
    return (a.full_name || '').localeCompare(b.full_name || '', 'he');
  });

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'rgba(255,255,255,0.3)' }}>גישה מוגבלת</p>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-5 pb-8">

      {/* כותרת */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">רמזור תנועה</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {members.length} תלמידים — גרור בין עמודות לשינוי סטטוס
          </p>
        </div>
        {/* סיכום */}
        <div className="flex items-center gap-3">
          {COLUMNS.map(c => {
            const count = filtered.filter(m => m.status === c.key).length;
            return (
              <div key={c.key} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
                style={{ background: c.color + '15', border: `1px solid ${c.color}33` }}>
                <span style={{ fontSize: 13 }}>{c.emoji}</span>
                <span className="text-sm font-bold" style={{ color: c.color }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* חיפוש */}
      <div className="relative">
        <svg className="absolute" style={{ right: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש תלמיד..."
          className="w-full rounded-xl py-2.5 text-sm outline-none text-right"
          style={{ paddingRight: 36, paddingLeft: 14, background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />
      </div>

      {loading && (
        <p className="text-center py-12 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>טוען תלמידים...</p>
      )}

      {/* קנבן */}
      {!loading && (
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 16, minWidth: COLUMNS.length * 280 + 'px' }}>
            {COLUMNS.map(col => (
              <Column key={col.key} col={col}
                members={sorted.filter(m => m.status === col.key)}
                onDragStart={onDragStart}
                onDrop={onDrop}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
