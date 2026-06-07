import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  TrendingDown, Calendar, ArrowUp, Users, RefreshCw,
  Circle, ArrowUpRight, ArrowDownRight, Minus,
  Archive, RotateCcw, ChevronDown,
} from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const SEGMENTS = [
  { label: 'TRAINEE',        min: 0,     color: '#ef4444' },
  { label: 'CREW',           min: 5000,  color: '#f97316' },
  { label: 'SECOND OFFICER', min: 10000, color: '#eab308' },
  { label: 'CO-PILOT',       min: 15000, color: '#22c55e' },
  { label: 'CAPTAIN',        min: 20000, color: '#06b6d4' },
  { label: 'EXPERT',         min: 30000, color: '#a855f7' },
];
function getRankColor(label) {
  return SEGMENTS.find(s => s.label === label)?.color || 'rgba(255,255,255,0.4)';
}
function fmtILS(n) {
  if (n == null || n === '') return '—';
  const v = Number(n); if (isNaN(v)) return '—';
  if (v >= 1000) return `₪${Math.round(v / 1000)}K`;
  return '₪' + Math.round(v).toLocaleString('he-IL');
}
function fmtFull(n) {
  if (n == null || n === '') return '—';
  const v = Number(n); if (isNaN(v)) return '—';
  return '₪' + Math.round(v).toLocaleString('he-IL');
}
function fmtDate(d) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function monthsAgo(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d)) / (1000 * 60 * 60 * 24 * 30.44));
}
// FIX: handle "2025-04" format safely (append day to avoid cross-browser issues)
function fmtMonth(d) {
  if (!d) return '—';
  try {
    const normalized = /^\d{4}-\d{2}$/.test(String(d)) ? d + '-01' : d;
    return new Date(normalized).toLocaleString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch { return String(d); }
}
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

const HEALTH = {
  green:  { label: 'סבבה',       color: '#4fc38a', bg: 'rgba(79,195,138,0.15)'  },
  yellow: { label: 'צריך יחס',   color: '#F5C118', bg: 'rgba(245,193,24,0.15)'  },
  red:    { label: 'עזרה צמודה', color: '#ff5a72', bg: 'rgba(255,90,114,0.15)'  },
};

// ── Health picker ───────────────────────────────────────────
function HealthPicker({ current, onChange }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const h = current ? HEALTH[current] : null;

  function toggle(e) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 6, left: r.left });
    }
    setOpen(o => !o);
  }
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:opacity-80"
        style={h
          ? { background: h.bg, border: `1px solid ${h.color}44` }
          : { background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)' }}>
        <Circle size={8} style={{ fill: h?.color || 'transparent', color: h?.color || 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        <span className="text-[11px] font-semibold hidden sm:inline" style={{ color: h?.color || 'rgba(255,255,255,0.3)' }}>
          {h ? h.label : 'בריאות'}
        </span>
      </button>
      {open && rect && (
        <div style={{ position: 'fixed', top: rect.top, left: rect.left, zIndex: 9999, minWidth: 140, borderRadius: 12, overflow: 'hidden', background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
          onClick={e => e.stopPropagation()}>
          {[null, 'green', 'yellow', 'red'].map(k => {
            const h2 = k ? HEALTH[k] : null;
            return (
              <button key={k ?? 'none'} onClick={e => { e.stopPropagation(); onChange(k); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition hover:bg-white/5"
                style={{ color: h2?.color || 'rgba(255,255,255,0.35)' }}>
                <Circle size={8} style={{ fill: h2?.color || 'transparent', color: h2?.color || 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                {h2 ? h2.label : 'הסר סימון'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Delta indicator ─────────────────────────────────────────
function Delta({ value, prev }) {
  if (prev == null || prev === 0 || value == null) return null;
  const d = Math.round((value - prev) / Math.abs(prev) * 100);
  if (isNaN(d)) return null;
  const color = d > 0 ? '#86efac' : d < 0 ? '#fca5a5' : 'rgba(255,255,255,0.3)';
  const Icon  = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold mt-1" style={{ color }}>
      <Icon size={10} />{d > 0 ? '+' : ''}{d}%
    </span>
  );
}

// ── Monthly stats panel ─────────────────────────────────────
function MonthlyPanel({ monthly, onUpdateProfile, studentId, enrolled_at, total_paid }) {
  // Ascending: oldest (left) → newest (right)
  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  // Start at the newest month (rightmost tab)
  const [idx, setIdx] = useState(() => Math.max(0, sorted.length - 1));

  // Reset to newest when student changes
  useEffect(() => { setIdx(Math.max(0, sorted.length - 1)); }, [studentId, sorted.length]);

  const cur  = sorted[idx]     ?? null;
  const prev = sorted[idx - 1] ?? null;  // month before current

  // Sparkline — last 6 months, chronological (already ascending)
  const sparkData = sorted.slice(-6);
  const maxIncome = Math.max(...sparkData.map(m => num(m.total_income || m.amount)), 1);

  const curIncome  = cur ? num(cur.total_income  || cur.amount) : 0;
  const prevIncome = prev ? num(prev.total_income || prev.amount) : null;
  const curExp     = cur ? num(cur.software_expenses) + num(cur.variable_expenses) + num(cur.paid_ads) : 0;
  const curNet     = curIncome - curExp;
  const prevNet    = prev ? num(prev.total_income || prev.amount) - num(prev.software_expenses) - num(prev.variable_expenses) - num(prev.paid_ads) : null;
  const incomeD    = prevIncome != null && prevIncome !== 0 ? Math.round((curIncome - prevIncome) / Math.abs(prevIncome) * 100) : null;

  return (
    <div className="px-4 pb-5 pt-3 space-y-4">

      {/* ── Profile fields (enrolled / paid) ── */}
      <div className="flex flex-wrap items-center gap-3 pb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'rgba(255,255,255,0.3)' }}>הצטרף</span>
          {/* FIX: use key to force re-mount when value changes */}
          <input key={`enroll-${studentId}-${enrolled_at}`}
            type="date" defaultValue={enrolled_at || ''}
            onBlur={e => onUpdateProfile(studentId, { enrolled_at: e.target.value || null })}
            className="rounded-lg px-2 py-1 text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'rgba(255,255,255,0.3)' }}>שילם ₪</span>
          <input key={`paid-${studentId}-${total_paid}`}
            type="number" defaultValue={total_paid ?? ''}
            onBlur={e => onUpdateProfile(studentId, { total_paid: e.target.value ? parseInt(e.target.value, 10) : null })}
            placeholder="0"
            className="w-24 rounded-lg px-2 py-1 text-xs outline-none text-white"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }} />
        </div>
      </div>

      {!cur ? (
        <p className="text-xs py-4 text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>אין נתונים חודשיים עדיין</p>
      ) : (<>

        {/* ── Month tabs ── */}
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-1.5 pb-1" style={{ minWidth: 'max-content' }}>
            {sorted.map((m, i) => {
              const isActive = i === idx;
              return (
                <button key={m.month} onClick={() => setIdx(i)}
                  className="rounded-lg px-3 py-1.5 transition-all whitespace-nowrap"
                  style={{
                    background: isActive ? 'rgba(245,193,24,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? 'rgba(245,193,24,0.45)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <span className="text-[11px] font-semibold"
                    style={{ color: isActive ? '#F5C118' : 'rgba(255,255,255,0.45)' }}>
                    {fmtMonth(m.month)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Income hero + sparkline ── */}
        <div className="rounded-2xl px-4 py-3 flex items-end justify-between gap-4"
          style={{ background: 'rgba(245,193,24,0.05)', border: '1px solid rgba(245,193,24,0.15)' }}>
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: 'rgba(245,193,24,0.6)' }}>הכנסה — {fmtMonth(cur.month)}</p>
            <p className="text-3xl font-black leading-none" style={{ color: '#F5C118' }}>{fmtFull(curIncome)}</p>
            {prevIncome != null && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {incomeD != null && (
                  <span className="text-xs font-bold rounded-md px-1.5 py-0.5"
                    style={{
                      background: incomeD > 0 ? 'rgba(134,239,172,0.15)' : incomeD < 0 ? 'rgba(252,165,165,0.15)' : 'rgba(255,255,255,0.08)',
                      color: incomeD > 0 ? '#86efac' : incomeD < 0 ? '#fca5a5' : 'rgba(255,255,255,0.4)',
                    }}>
                    {incomeD > 0 ? '↑' : incomeD < 0 ? '↓' : '–'} {Math.abs(incomeD)}%
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  לעומת {fmtFull(prevIncome)} ({fmtMonth(prev?.month)})
                </span>
              </div>
            )}
          </div>
          {/* Sparkline bars */}
          {sparkData.length > 1 && (
            <div className="flex items-end gap-1 h-10 flex-shrink-0">
              {sparkData.map((m, i) => {
                const barH  = Math.max(4, Math.round(num(m.total_income || m.amount) / maxIncome * 40));
                const isBar = m.month === cur.month;
                return (
                  <div key={i}
                    onClick={() => setIdx(sorted.findIndex(s => s.month === m.month))}
                    title={`${fmtMonth(m.month)}: ${fmtFull(num(m.total_income || m.amount))}`}
                    className="cursor-pointer rounded-sm transition-opacity hover:opacity-80"
                    style={{ width: 8, height: barH, background: isBar ? '#F5C118' : 'rgba(245,193,24,0.25)', flexShrink: 0 }} />
                );
              })}
            </div>
          )}
        </div>

        {/* ── Financials ── */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: 'rgba(255,255,255,0.3)' }}>💰 כספים</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'הכנסה',          value: curIncome,            prev: prevIncome,            color: '#F5C118',              bgCol: 'rgba(245,193,24,0.07)',   bdCol: 'rgba(245,193,24,0.2)',   fmt: fmtFull },
              { label: 'עסקאות חדשות',   value: num(cur.total_new_deals), prev: num(prev?.total_new_deals), color: 'rgba(255,255,255,0.85)', bgCol: 'rgba(255,255,255,0.04)', bdCol: 'rgba(255,255,255,0.07)', fmt: fmtFull },
              { label: 'הוצאות',          value: curExp,               prev: null,                  color: 'rgba(252,165,165,0.85)', bgCol: 'rgba(252,165,165,0.06)', bdCol: 'rgba(252,165,165,0.15)', fmt: fmtFull },
              { label: 'רווח נטו',        value: curNet,               prev: prevNet,               color: curNet >= 0 ? '#4fc38a' : '#ff5a72', bgCol: curNet >= 0 ? 'rgba(79,195,138,0.07)' : 'rgba(255,90,114,0.07)', bdCol: curNet >= 0 ? 'rgba(79,195,138,0.2)' : 'rgba(255,90,114,0.2)', fmt: fmtFull },
            ].map(({ label, value, prev: p, color, bgCol, bdCol, fmt }) => (
              <div key={label} className="rounded-xl p-3" style={{ background: bgCol, border: `1px solid ${bdCol}` }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: color + '99' }}>{label}</p>
                <p className="text-base font-black leading-none" style={{ color }}>{fmt(value)}</p>
                <Delta value={value} prev={p} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Sales ── */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: 'rgba(255,255,255,0.3)' }}>📊 מכירות</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[
              { label: 'הצעות',  value: num(cur.proposals),       prev: num(prev?.proposals),       color: '#818cf8' },
              { label: 'לידים',  value: num(cur.leads),           prev: num(prev?.leads),           color: '#a78bfa' },
              { label: 'שיחות',  value: num(cur.sales_calls_set), prev: num(prev?.sales_calls_set), color: '#6366f1' },
              { label: 'לקוחות', value: num(cur.active_clients),  prev: num(prev?.active_clients),  color: '#34d399' },
              { label: 'דרגה',   value: cur.current_rank || null,  prev: null,                       color: getRankColor(cur.current_rank) },
            ].map(({ label, value, prev: p, color }) => (
              <div key={label} className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                <p className="text-base font-black leading-none" style={{ color }}>{value ?? '—'}</p>
                {p != null && p !== 0 && <Delta value={value ?? 0} prev={p} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: 'rgba(255,255,255,0.3)' }}>📱 תוכן</p>
          <div className="grid grid-cols-3 gap-2">
            {/* FIX: use raw numeric fields for Delta, format for display separately */}
            {[
              {
                label: 'פוסטים',
                rawVal: num(cur.posts_count), rawPrev: num(prev?.posts_count),
                display: cur.posts_count ?? '—',
                color: '#fcd34d',
              },
              {
                label: 'עוקבים',
                rawVal: num(cur.followers), rawPrev: num(prev?.followers),
                display: cur.followers != null ? Number(cur.followers).toLocaleString('he-IL') : '—',
                color: '#e1306c',
              },
              {
                label: 'ריץ׳',
                rawVal: num(cur.reach), rawPrev: num(prev?.reach),
                display: cur.reach >= 1000 ? `${Math.round(cur.reach / 1000)}K` : (cur.reach || '—'),
                color: '#38bdf8',
              },
            ].map(({ label, rawVal, rawPrev, display, color }) => (
              <div key={label} className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                <p className="text-base font-black leading-none" style={{ color }}>{display}</p>
                {rawPrev > 0 && <Delta value={rawVal} prev={rawPrev} />}
              </div>
            ))}
          </div>
        </div>

        {/* Biggest win */}
        {cur.biggest_win && (
          <div className="rounded-xl px-4 py-3"
            style={{ background: 'rgba(245,193,24,0.06)', border: '1px solid rgba(245,193,24,0.2)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#F5C118' }}>🏆 הנצחון הגדול</p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>{cur.biggest_win}</p>
          </div>
        )}
      </>)}
    </div>
  );
}

// ── Student card ─────────────────────────────────────────────
function StudentCard({ student, onHealthChange, onApproveRank, onUpdateProfile, open, onToggle }) {
  const [approving, setApproving] = useState(false);

  const { name, email, monthly, latest_income, latest_rank, health_status,
    rank_request, has_revenue_drop, revenue_drop_pct, missing_report,
    has_data, enrolled_at, total_paid, is_active } = student;

  const rankColor = getRankColor(latest_rank);
  const h = health_status ? HEALTH[health_status] : null;

  const alertItems = [
    rank_request     && { icon: ArrowUp,      color: '#F5C118', tip: 'שדרוג דרגה ממתין' },
    has_revenue_drop && { icon: TrendingDown, color: '#ff5a72', tip: `ירידה -${revenue_drop_pct}%` },
    missing_report   && { icon: Calendar,     color: '#f97316', tip: 'חסר דיווח חודשי' },
  ].filter(Boolean);

  async function handleApprove(e) {
    e.stopPropagation();
    setApproving(true);
    try { await onApproveRank(rank_request); }
    finally { setApproving(false); }
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgb(var(--bg-surface))',
        border: `1px solid ${h ? h.color + '28' : 'rgba(255,255,255,0.07)'}`,
        borderRight: `3px solid ${h ? h.color : 'rgba(255,255,255,0.08)'}`,
      }}>

      {/* ── Row ── */}
      <div className="flex items-center gap-2.5 px-3 py-3">

        {/* Avatar */}
        <div className="h-8 w-8 rounded-full flex-none flex items-center justify-center text-sm font-black"
          style={{ background: h?.bg || 'rgba(255,255,255,0.08)', color: h?.color || 'rgba(255,255,255,0.5)' }}>
          {(name || '?').slice(0, 1).toUpperCase()}
        </div>

        {/* Name + meta */}
        <button onClick={() => has_data && onToggle()}
          className="flex-1 text-right min-w-0 transition hover:opacity-80"
          style={{ cursor: has_data ? 'pointer' : 'default' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white leading-tight">{name}</span>
            {latest_rank && (
              <span className="text-[9px] rounded px-1.5 py-0.5 font-bold hidden sm:inline"
                style={{ background: rankColor + '22', color: rankColor }}>
                {latest_rank}
              </span>
            )}
            {alertItems.length > 0 && (
              <div className="flex items-center gap-1">
                {alertItems.map((a, i) => <a.icon key={i} size={11} style={{ color: a.color }} title={a.tip} />)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] truncate max-w-[140px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{email}</span>
            {has_data && latest_income != null && (
              <span className="text-[11px] font-bold" style={{ color: '#F5C118' }}>{fmtILS(latest_income)}</span>
            )}
            {enrolled_at && (
              <span className="text-[10px] hidden sm:inline" style={{ color: 'rgba(255,255,255,0.22)' }}>
                {fmtDate(enrolled_at)}
              </span>
            )}
          </div>
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {rank_request && (
            <button onClick={handleApprove} disabled={approving}
              className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition hover:opacity-80"
              style={{ background: '#F5C118', color: '#13152A' }}>
              {approving ? '...' : '✓ אשר'}
            </button>
          )}
          <HealthPicker current={health_status} onChange={v => onHealthChange(student.id, v)} />
          <button onClick={() => onUpdateProfile(student.id, { is_active: !is_active })}
            title={is_active ? 'ארכיון' : 'שחזר'}
            className="p-1.5 rounded-lg transition hover:bg-white/10"
            style={{ color: is_active ? 'rgba(255,255,255,0.18)' : '#4fc38a' }}>
            {is_active ? <Archive size={13} /> : <RotateCcw size={13} />}
          </button>
          {has_data && (
            <button onClick={onToggle} className="p-1 rounded transition hover:bg-white/10">
              <ChevronDown size={14} className="transition-transform duration-200"
                style={{ color: 'rgba(255,255,255,0.3)', transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded panel ── FIX: key resets idx when student changes */}
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <MonthlyPanel
            key={student.id}
            monthly={monthly || []}
            studentId={student.id}
            enrolled_at={enrolled_at}
            total_paid={total_paid}
            onUpdateProfile={onUpdateProfile}
          />
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function AdminStudents() {
  const { user } = useUser();
  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [filter,        setFilter]        = useState('all');
  const [openStudentId, setOpenStudentId] = useState(null);

  function toggleStudent(id) {
    setOpenStudentId(prev => prev === id ? null : id);
  }

  if (user && user.id !== ADMIN_ID) {
    return (
      <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
        אין גישה
      </div>
    );
  }

  async function fetchStudents() {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/admin/students', {
        headers: { 'x-admin-id': import.meta.env.VITE_ADMIN_USER_ID || '' },
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || `HTTP ${r.status}`); }
      const { students: s } = await r.json();
      setStudents(s || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchStudents(); }, []);

  async function updateProfile(userId, updates) {
    setStudents(prev => prev.map(s => s.id === userId ? { ...s, ...updates } : s));
    await fetch(`/api/admin/students/${userId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-id': import.meta.env.VITE_ADMIN_USER_ID || '' },
      body: JSON.stringify(updates),
    });
  }

  const handleHealthChange = (userId, health) => updateProfile(userId, { health_status: health });

  async function handleApproveRank(request) {
    await fetch('/api/slack/rank-upgrade', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: request.first_name, current_rank: request.current_rank, proposed_rank: request.proposed_rank, avg_income: request.avg_income }),
    }).catch(() => {});
    await fetchStudents();
  }

  const active    = students.filter(s => s.is_active !== false);
  const archived  = students.filter(s => s.is_active === false);
  const alertList = active.filter(s => s.rank_request || s.has_revenue_drop || s.missing_report);
  const noData    = active.filter(s => !s.has_data);
  const displayed = filter === 'alerts' ? alertList : filter === 'no-data' ? noData : active;

  function StudentList({ list }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
        {list.map(s => {
          const isOpen = openStudentId === s.id;
          return (
            <div key={s.id}>
              <StudentCard
                student={s}
                open={isOpen}
                onToggle={() => toggleStudent(s.id)}
                onHealthChange={handleHealthChange}
                onApproveRank={handleApproveRank}
                onUpdateProfile={updateProfile}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">פאנל תלמידים</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {active.length} פעילים · {archived.length} בארכיון
          </p>
        </div>
        <button onClick={fetchStudents} disabled={loading}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          רענן
        </button>
      </div>

      {/* KPI cards */}
      {students.length > 0 && (() => {
        const withPaid     = students.filter(s => s.total_paid != null);
        const withEnrolled = students.filter(s => s.enrolled_at);
        const totalRevenue = withPaid.reduce((s, x) => s + (x.total_paid || 0), 0);
        const avgLTV       = withPaid.length ? Math.round(totalRevenue / withPaid.length) : null;
        const avgMonths    = withEnrolled.length
          ? Math.round(withEnrolled.reduce((s, x) => s + (monthsAgo(x.enrolled_at) || 0), 0) / withEnrolled.length)
          : null;
        const topStudent = withPaid.length ? [...withPaid].sort((a, b) => (b.total_paid || 0) - (a.total_paid || 0))[0] : null;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: 'הכנסות מהתוכנית', v: totalRevenue > 0 ? `₪${totalRevenue.toLocaleString('he-IL')}` : '—', c: '#F5C118', sub: `${withPaid.length} תלמידים` },
              { l: 'ממוצע LTV',        v: avgLTV ? `₪${avgLTV.toLocaleString('he-IL')}` : '—',               c: '#4fc38a', sub: 'שווי לקוח ממוצע' },
              { l: 'ממוצע שהות',       v: avgMonths != null ? `${avgMonths} חודשים` : '—',                    c: '#a78bfa', sub: `${withEnrolled.length} עם תאריך` },
              { l: 'הכי רווחי',         v: topStudent ? `₪${(topStudent.total_paid || 0).toLocaleString('he-IL')}` : '—', c: '#38bdf8', sub: topStudent?.name || '' },
            ].map(({ l, v, c, sub }) => (
              <div key={l} className="rounded-2xl p-4"
                style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{l}</p>
                <p className="text-xl font-black leading-none" style={{ color: c }}>{v}</p>
                {sub && <p className="text-[10px] mt-1 truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>{sub}</p>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Alert banners */}
      {alertList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { icon: ArrowUp,      color: '#F5C118', count: students.filter(s => s.rank_request).length,     label: 'שדרוג דרגה ממתין' },
            { icon: TrendingDown, color: '#ff5a72', count: students.filter(s => s.has_revenue_drop).length, label: 'ירידה בהכנסות' },
            { icon: Calendar,     color: '#f97316', count: students.filter(s => s.missing_report).length,   label: 'חסר דיווח חודשי' },
          ].filter(a => a.count > 0).map(a => (
            <div key={a.label} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: a.color + '12', border: `1px solid ${a.color}30` }}>
              <a.icon size={16} style={{ color: a.color, flexShrink: 0 }} />
              <div>
                <p className="text-lg font-black leading-none" style={{ color: a.color }}>{a.count}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{a.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {[
          { k: 'all',      l: `כולם (${active.length})` },
          { k: 'alerts',   l: `התראות (${alertList.length})` },
          { k: 'no-data',  l: `ללא נתונים (${noData.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap"
            style={{ background: filter === t.k ? 'rgba(255,255,255,0.12)' : 'transparent', color: filter === t.k ? 'white' : 'rgba(255,255,255,0.35)' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl px-5 py-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>שגיאה בטעינה: {error}</p>
          {error.includes('CLERK_SECRET_KEY') && (
            <p className="text-xs mt-1" style={{ color: 'rgba(252,165,165,0.6)' }}>הוסף CLERK_SECRET_KEY ל-.env</p>
          )}
        </div>
      )}

      {/* Student list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'rgb(var(--bg-surface))' }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Users size={32} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 12px' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {filter === 'all' ? 'אין תלמידים' : 'אין תלמידים בקטגוריה זו'}
          </p>
        </div>
      ) : (
        <StudentList list={displayed} />
      )}

      {/* Archive */}
      {!loading && archived.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none py-2 px-1 rounded-lg hover:bg-white/5 transition"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Archive size={13} />
            <span className="text-xs font-semibold">ארכיון ({archived.length} תלמידים)</span>
            <ChevronDown size={12} className="group-open:rotate-180 transition-transform mr-auto" />
          </summary>
          <div className="mt-2 opacity-60">
            <StudentList list={archived} />
          </div>
        </details>
      )}
    </div>
  );
}
