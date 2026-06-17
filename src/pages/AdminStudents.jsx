import { useEffect, useState, useRef, useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';
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

// ── Stat chip ────────────────────────────────────────────────
function Chip({ label, value, prev, color = 'rgba(255,255,255,0.85)', fmt = v => v }) {
  const display = value == null || value === '' ? '—' : fmt(value);
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] mb-1 leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
      <p className="text-sm font-black leading-none" style={{ color }}>{display}</p>
      {prev != null && prev !== '' && value != null && <Delta value={num(value)} prev={num(prev)} />}
    </div>
  );
}

// ── Slider display ────────────────────────────────────────────
function SliderDisplay({ value, color = '#F5C118' }) {
  const v = num(value);
  if (!v) return <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: `${v * 10}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{v}/10</span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
      {label}
    </p>
  );
}

// ── Monthly stats panel ─────────────────────────────────────
function MonthlyPanel({ monthly, onUpdateProfile, studentId, enrolled_at, total_paid }) {
  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  const [idx, setIdx] = useState(() => Math.max(0, sorted.length - 1));
  useEffect(() => { setIdx(Math.max(0, sorted.length - 1)); }, [studentId, sorted.length]);

  const cur  = sorted[idx]     ?? null;
  const prev = sorted[idx - 1] ?? null;

  const sparkData = sorted.slice(-6);
  const maxIncome = Math.max(...sparkData.map(m => num(m.total_income || m.amount)), 1);
  const curIncome  = cur ? num(cur.total_income || cur.amount) : 0;
  const prevIncome = prev ? num(prev.total_income || prev.amount) : null;
  const curExp     = cur ? num(cur.software_expenses) + num(cur.variable_expenses) + num(cur.paid_ads) : 0;
  const curNet     = curIncome - curExp;
  const prevNet    = prev ? num(prev.total_income || prev.amount) - num(prev.software_expenses) - num(prev.variable_expenses) - num(prev.paid_ads) : null;
  const incomeD    = prevIncome != null && prevIncome !== 0 ? Math.round((curIncome - prevIncome) / Math.abs(prevIncome) * 100) : null;

  return (
    <div className="px-4 pb-6 pt-3 space-y-5">

      {/* ── Profile meta ── */}
      <div className="flex flex-wrap items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>הצטרף</span>
          <input key={`enroll-${studentId}-${enrolled_at}`} type="date" defaultValue={enrolled_at || ''}
            onBlur={e => onUpdateProfile(studentId, { enrolled_at: e.target.value || null })}
            className="rounded-lg px-2 py-1 text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>שילם ₪</span>
          <input key={`paid-${studentId}-${total_paid}`} type="number" defaultValue={total_paid ?? ''} placeholder="0"
            onBlur={e => onUpdateProfile(studentId, { total_paid: e.target.value ? parseInt(e.target.value, 10) : null })}
            className="w-24 rounded-lg px-2 py-1 text-xs outline-none text-white"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }} />
        </div>
      </div>

      {!cur ? (
        <p className="text-xs py-4 text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>אין נתונים חודשיים עדיין</p>
      ) : (<>

        {/* ── Month tabs ── */}
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1.5 pb-1" style={{ minWidth: 'max-content' }}>
            {sorted.map((m, i) => {
              const isActive = i === idx;
              return (
                <button key={m.month} onClick={() => setIdx(i)}
                  className="rounded-lg px-3 py-1.5 transition-all whitespace-nowrap"
                  style={{ background: isActive ? 'rgba(245,193,24,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isActive ? 'rgba(245,193,24,0.45)' : 'rgba(255,255,255,0.07)'}` }}>
                  <span className="text-[11px] font-semibold" style={{ color: isActive ? '#F5C118' : 'rgba(255,255,255,0.45)' }}>
                    {fmtMonth(m.month)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ HERO ROW — הנתונים הכי חשובים ══ */}
        <div className="grid grid-cols-4 gap-3">
          {/* הכנסה — הגדול */}
          <div className="col-span-1 rounded-2xl p-5 flex flex-col justify-between"
            style={{ background: 'rgba(245,193,24,0.08)', border: '1px solid rgba(245,193,24,0.25)' }}>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'rgba(245,193,24,0.6)' }}>הכנסה חודשית</p>
            <p className="text-4xl font-black leading-none" style={{ color: '#F5C118' }}>{fmtFull(curIncome)}</p>
            {incomeD != null && (
              <span className="mt-2 self-start text-xs font-bold rounded-lg px-2 py-1"
                style={{ background: incomeD > 0 ? 'rgba(134,239,172,0.15)' : 'rgba(252,165,165,0.15)', color: incomeD > 0 ? '#86efac' : '#fca5a5' }}>
                {incomeD > 0 ? '↑' : '↓'} {Math.abs(incomeD)}% לעומת {fmtMonth(prev?.month)}
              </span>
            )}
          </div>
          {/* רווח נטו */}
          <div className="rounded-2xl p-5 flex flex-col justify-between"
            style={{ background: curNet >= 0 ? 'rgba(79,195,138,0.07)' : 'rgba(255,90,114,0.07)', border: `1px solid ${curNet >= 0 ? 'rgba(79,195,138,0.25)' : 'rgba(255,90,114,0.25)'}` }}>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>רווח נטו</p>
            <p className="text-3xl font-black leading-none" style={{ color: curNet >= 0 ? '#4fc38a' : '#ff5a72' }}>{fmtFull(curNet)}</p>
            <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>הוצ׳ {fmtFull(curExp)}</p>
          </div>
          {/* דרגה */}
          <div className="rounded-2xl p-5 flex flex-col justify-between"
            style={{ background: getRankColor(cur.current_rank) + '12', border: `1px solid ${getRankColor(cur.current_rank)}40` }}>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>דרגה נוכחית</p>
            <p className="text-2xl font-black leading-none" style={{ color: getRankColor(cur.current_rank) }}>{cur.current_rank || '—'}</p>
          </div>
          {/* ספארקליין */}
          {sparkData.length > 1 && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'rgba(255,255,255,0.28)' }}>היסטוריה</p>
              <div className="flex items-end gap-1.5 h-12">
                {sparkData.map((m, i) => {
                  const barH = Math.max(6, Math.round(num(m.total_income || m.amount) / maxIncome * 48));
                  const isActive = m.month === cur.month;
                  return (
                    <div key={i} onClick={() => setIdx(sorted.findIndex(s => s.month === m.month))}
                      title={`${fmtMonth(m.month)}: ${fmtFull(num(m.total_income || m.amount))}`}
                      className="cursor-pointer rounded transition-opacity hover:opacity-80 flex-1"
                      style={{ height: barH, background: isActive ? '#F5C118' : 'rgba(245,193,24,0.2)' }} />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ══ לבלוט — תוכן ══ */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.15)' }}>
          <p className="text-xs font-bold mb-3" style={{ color: '#f97316' }}>🎬 לבלוט — תוכן</p>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'עוקבים',  value: cur.followers,    prev: prev?.followers,   color: '#e1306c', fmt: v => Number(v).toLocaleString('he-IL') },
              { label: 'חשיפה',   value: cur.reach,        prev: prev?.reach,       color: '#38bdf8', fmt: v => num(v) >= 1000 ? `${Math.round(num(v)/1000)}K` : String(v) },
              { label: 'פוסטים',  value: cur.posts_count,  prev: prev?.posts_count, color: '#fcd34d', fmt: v => v },
              { label: 'ממומן',   value: cur.paid_ads,     prev: prev?.paid_ads,    color: '#f97316', fmt: fmtFull },
            ].map(({ label, value, prev: p, color, fmt }) => (
              <div key={label}>
                <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                <p className="text-2xl font-black" style={{ color }}>{value != null && value !== '' ? fmt(value) : '—'}</p>
                {p != null && p !== '' && value != null && <Delta value={num(value)} prev={num(p)} />}
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>ביטחון בתוכן</p>
            <SliderDisplay value={cur.content_confidence} color="#f97316" />
          </div>
        </div>

        {/* ══ להוביל — מכירות ══ */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <p className="text-xs font-bold mb-3" style={{ color: '#8b5cf6' }}>🤝 להוביל — מכירות</p>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
            {[
              { label: 'לידים',          value: cur.leads,                prev: prev?.leads,                color: '#a78bfa' },
              { label: 'הצעות',          value: cur.proposals,            prev: prev?.proposals,            color: '#818cf8' },
              { label: 'שיחות נקבעו',    value: cur.sales_calls_set,      prev: prev?.sales_calls_set,      color: '#6366f1' },
              { label: 'הגיעו לשיחה',    value: cur.sales_calls_showed,   prev: prev?.sales_calls_showed,   color: '#6366f1' },
              { label: 'נסגרו',          value: cur.closings_count,       prev: prev?.closings_count,       color: '#4ade80' },
              { label: 'הצ״מ נשלחו',    value: cur.price_quotes_sent,    prev: prev?.price_quotes_sent,    color: '#c4b5fd' },
              { label: 'הצ״מ אושרו',    value: cur.price_quotes_approved,prev: prev?.price_quotes_approved,color: '#c4b5fd' },
              { label: 'שיחות אסטרטגיה',value: cur.strategy_calls,       prev: prev?.strategy_calls,       color: '#818cf8' },
            ].map(({ label, value, prev: p, color }) => (
              <div key={label}>
                <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                <p className="text-2xl font-black" style={{ color }}>{value != null && value !== '' ? value : '—'}</p>
                {p != null && p !== '' && value != null && <Delta value={num(value)} prev={num(p)} />}
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>ביטחון בתהליך המכירה</p>
            <SliderDisplay value={cur.sales_confidence} color="#8b5cf6" />
          </div>
        </div>

        {/* ══ לשלוט + לספק — שורה אחת ══ */}
        <div className="grid grid-cols-2 gap-3">
          {/* לשלוט */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#22c55e' }}>📋 לשלוט — לקוחות</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'לקוחות חדשים',    value: cur.new_clients,     prev: prev?.new_clients,     color: '#4ade80' },
                { label: 'לקוחות פעילים',   value: cur.active_clients,  prev: prev?.active_clients,  color: '#34d399' },
                { label: 'ריטיינרים (מס׳)', value: cur.retainers_count, prev: prev?.retainers_count, color: '#2dd4bf' },
              ].map(({ label, value, prev: p, color }) => (
                <div key={label}>
                  <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                  <p className="text-2xl font-black" style={{ color }}>{value != null && value !== '' ? value : '—'}</p>
                  {p != null && p !== '' && value != null && <Delta value={num(value)} prev={num(p)} />}
                </div>
              ))}
            </div>
            {cur.main_project && (
              <div className="rounded-xl px-3 py-2 mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>פרויקט מרכזי</p>
                <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{cur.main_project}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>שביעות רצון לקוחות</p>
              <SliderDisplay value={cur.client_satisfaction} color="#22c55e" />
            </div>
          </div>

          {/* לספק */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#3b82f6' }}>💰 לספק — עסקים</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'עסקאות חדשות', value: cur.total_new_deals,  prev: prev?.total_new_deals, color: 'rgba(255,255,255,0.85)', fmt: fmtFull },
                { label: 'ריטיינרים (₪)',value: cur.retainers,        prev: prev?.retainers,       color: '#fcd34d',                fmt: fmtFull },
                { label: 'הוצ׳ תוכנות',  value: cur.software_expenses,prev: null,                  color: '#fca5a5',                fmt: fmtFull },
                { label: 'הוצ׳ משתנות',  value: cur.variable_expenses,prev: null,                  color: '#fca5a5',                fmt: fmtFull },
              ].map(({ label, value, prev: p, color, fmt }) => (
                <div key={label}>
                  <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                  <p className="text-lg font-black leading-tight" style={{ color }}>{value != null && value !== '' ? fmt(value) : '—'}</p>
                  {p != null && value != null && <Delta value={num(value)} prev={num(p)} />}
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>ביטחון בביצועים העסקיים</p>
              <SliderDisplay value={cur.business_confidence} color="#3b82f6" />
            </div>
          </div>
        </div>

        {/* ══ רפלקשן ══ */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.15)' }}>
          <div className="flex items-start justify-between gap-6 mb-4">
            <p className="text-xs font-bold" style={{ color: '#ec4899' }}>🔮 רפלקשן</p>
            <div className="flex items-center gap-3">
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>NPS</p>
              <div className="flex items-center gap-2" style={{ minWidth: 180 }}>
                <SliderDisplay value={cur.nps} color="#ec4899" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: '🏆 הנצחון הגדול',         value: cur.biggest_win,      color: '#F5C118' },
              { label: '👤 למי ימליץ להצטרף',     value: cur.recommendation,   color: 'rgba(255,255,255,0.78)' },
              { label: '🛠 כלים / הכוונה שצריך',  value: cur.systems_needed,   color: 'rgba(255,255,255,0.78)' },
              { label: '🎯 פוקוס לחודש הבא',       value: cur.focus_next_month, color: '#38bdf8' },
              { label: '💬 פידבק לתוכנית',         value: cur.program_feedback, color: 'rgba(255,255,255,0.6)' },
            ].filter(f => f.value).map(({ label, value, color }) => (
              <div key={label} className="rounded-xl px-3 py-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                <p className="text-sm leading-relaxed font-medium" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

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

// ── Weekly Wins Table ─────────────────────────────────────────
function WeeklyWinsTable({ students }) {
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState('week_date');
  const [sortDir, setSortDir] = useState(-1);

  const rows = useMemo(() => {
    const flat = students.flatMap(s =>
      (s.wins || []).map(w => ({ ...w, name: s.name }))
    );
    return flat
      .filter(r => !search || r.name?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
        return String(av).localeCompare(String(bv), 'he') * sortDir;
      });
  }, [students, search, sortKey, sortDir]);

  const [expanded, setExpanded] = useState(null);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1); else { setSortKey(key); setSortDir(-1); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-[200px]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם..."
            className="bg-transparent outline-none text-sm w-full text-white placeholder:text-white/30" />
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{rows.length} ניצחונות</span>
      </div>

      <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { k: 'name',         l: 'שם' },
                { k: 'week_date',    l: 'שבוע' },
                { k: 'win_1',        l: 'ניצחון #1' },
                { k: 'submitted_at', l: 'הוגש' },
              ].map(c => (
                <th key={c.k} onClick={() => toggleSort(c.k)}
                  className="px-4 py-3 text-right cursor-pointer select-none hover:bg-white/5 transition whitespace-nowrap"
                  style={{ color: sortKey === c.k ? '#F5C118' : 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
                  {c.l}{sortKey === c.k && <span className="mr-1">{sortDir === -1 ? '↓' : '↑'}</span>}
                </th>
              ))}
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>אין נתונים</td></tr>
              : rows.map((r, i) => {
                  const key     = `${r.user_id}-${r.week_date}-${i}`;
                  const isOpen  = expanded === key;
                  const hasMore = r.win_2 || r.win_3 || r.focus_next_week || r.blocker;
                  return (
                    <>
                      <tr key={key}
                        style={{ borderBottom: isOpen ? 'none' : '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', cursor: hasMore ? 'pointer' : 'default' }}
                        className="hover:bg-white/[0.03] transition"
                        onClick={() => hasMore && setExpanded(isOpen ? null : key)}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'white' }}>{r.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{fmtDate(r.week_date)}</td>
                        <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.85)', maxWidth: 380 }}>
                          {r.win_1 || <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{fmtDate(r.submitted_at)}</td>
                        <td className="px-4 py-3 text-center">
                          {hasMore && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"
                              style={{ display: 'inline', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={key + '-detail'} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(245,193,24,0.03)' : 'rgba(245,193,24,0.04)' }}>
                          <td colSpan={5} className="px-6 pb-4 pt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {r.win_2 && (
                                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>ניצחון #2</p>
                                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{r.win_2}</p>
                                </div>
                              )}
                              {r.win_3 && (
                                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>ניצחון #3</p>
                                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{r.win_3}</p>
                                </div>
                              )}
                              {r.focus_next_week && (
                                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>פוקוס שבוע הבא</p>
                                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{r.focus_next_week}</p>
                                </div>
                              )}
                              {r.blocker && (
                                <div className="rounded-xl p-3" style={{ background: 'rgba(255,90,114,0.06)', border: '1px solid rgba(255,90,114,0.15)' }}>
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#ff5a72' }}>חסם</p>
                                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{r.blocker}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Deals Table ───────────────────────────────────────────────
function DealsTable({ students }) {
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState(-1);

  const rows = useMemo(() => {
    const flat = students.flatMap(s =>
      (s.deals || []).map(d => ({ ...d, name: s.name }))
    );
    return flat
      .filter(r => !search || r.name?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
        if (!isNaN(Number(av)) && !isNaN(Number(bv))) return (Number(av) - Number(bv)) * sortDir;
        return String(av).localeCompare(String(bv), 'he') * sortDir;
      });
  }, [students, search, sortKey, sortDir]);

  const totalAmount   = rows.reduce((s, r) => s + num(r.total_amount), 0);
  const totalReceived = rows.reduce((s, r) => s + num(r.received_amount), 0);

  const COLS = [
    { key: 'name',            label: 'שם',            align: 'right' },
    { key: 'created_at',      label: 'תאריך',         align: 'right', fmt: v => fmtDate(v) },
    { key: 'total_amount',    label: 'סכום עסקה',     align: 'left',  fmt: v => v != null ? `₪${num(v).toLocaleString('he-IL')}` : '—', color: '#F5C118' },
    { key: 'received_amount', label: 'התקבל',         align: 'left',  fmt: v => v != null ? `₪${num(v).toLocaleString('he-IL')}` : '—', color: '#4fc38a' },
    { key: 'description',     label: 'תיאור',         align: 'right', fmt: v => v || '—' },
    { key: 'client_name',     label: 'לקוח',          align: 'right', fmt: v => v || '—' },
  ];

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1); else { setSortKey(key); setSortDir(-1); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-[200px]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם..."
            className="bg-transparent outline-none text-sm w-full text-white placeholder:text-white/30" />
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {rows.length} עסקאות · סה״כ: <span style={{ color: '#F5C118', fontWeight: 700 }}>₪{totalAmount.toLocaleString('he-IL')}</span>
          {' · '}התקבל: <span style={{ color: '#4fc38a', fontWeight: 700 }}>₪{totalReceived.toLocaleString('he-IL')}</span>
        </span>
      </div>
      <AdminTable cols={COLS} rows={rows} rowKey={r => `${r.user_id}-${r.id || r.created_at}`} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
    </div>
  );
}

// ── Checklist View ────────────────────────────────────────────
function ChecklistView({ students, roadmap }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const { phases, weeks, tasks } = roadmap;
  const totalTasks = tasks.length;

  const filtered = students.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  function getProgress(completions) {
    if (!totalTasks) return 0;
    return Math.round((completions.length / totalTasks) * 100);
  }

  function getCurrentTask(completions) {
    const completedSet = new Set(completions);
    const sortedPhases = [...phases].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const phase of sortedPhases) {
      const phaseWeeks = [...weeks].filter(w => w.phase_id === phase.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      for (const week of phaseWeeks) {
        const weekTasks = [...tasks].filter(t => t.week_id === week.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        for (const task of weekTasks) {
          if (!completedSet.has(task.id)) {
            return { phase: phase.title, week: week.title, task: task.title };
          }
        }
      }
    }
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-[200px]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם..."
            className="bg-transparent outline-none text-sm w-full text-white placeholder:text-white/30" />
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{filtered.length} תלמידים · {totalTasks} משימות במפת הדרכים</span>
      </div>

      <div className="space-y-2">
        {filtered.map(s => {
          const pct     = getProgress(s.completions || []);
          const current = getCurrentTask(s.completions || []);
          const isOpen  = expanded === s.id;

          return (
            <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
              {/* Row */}
              <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition text-right"
                onClick={() => setExpanded(isOpen ? null : s.id)}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{s.name}</p>
                  {current ? (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {current.phase} · {current.week} · <span style={{ color: 'rgba(255,255,255,0.6)' }}>{current.task}</span>
                    </p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: '#4fc38a' }}>✓ השלים הכל</p>
                  )}
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-3 flex-none">
                  <div className="w-32 rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#4fc38a' : '#F5C118', borderRadius: 999, transition: 'width 0.4s' }} />
                  </div>
                  <span className="text-sm font-bold w-10 text-left" style={{ color: pct === 100 ? '#4fc38a' : '#F5C118' }}>{pct}%</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{(s.completions || []).length}/{totalTasks}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"
                    style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded: per-phase breakdown */}
              {isOpen && (
                <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {[...phases].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(phase => {
                    const phaseWeeks = [...weeks].filter(w => w.phase_id === phase.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                    const phaseTasks = phaseWeeks.flatMap(w => tasks.filter(t => t.week_id === w.id));
                    const phaseDone  = phaseTasks.filter(t => (s.completions || []).includes(t.id)).length;
                    const phaseTotal = phaseTasks.length;
                    const phasePct   = phaseTotal ? Math.round(phaseDone / phaseTotal * 100) : 0;
                    return (
                      <div key={phase.id} className="pt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{phase.title}</span>
                          <span className="text-[11px]" style={{ color: phasePct === 100 ? '#4fc38a' : 'rgba(255,255,255,0.3)' }}>{phaseDone}/{phaseTotal}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {phaseWeeks.map(week => {
                            const weekTasks = [...tasks].filter(t => t.week_id === week.id);
                            const done = weekTasks.filter(t => (s.completions || []).includes(t.id)).length;
                            const all  = weekTasks.length;
                            const full = done === all && all > 0;
                            return (
                              <span key={week.id} className="rounded-lg px-2.5 py-1 text-[11px] font-medium"
                                style={{ background: full ? 'rgba(79,195,138,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${full ? 'rgba(79,195,138,0.3)' : 'rgba(255,255,255,0.08)'}`, color: full ? '#4fc38a' : 'rgba(255,255,255,0.5)' }}>
                                {full ? '✓ ' : ''}{week.title} ({done}/{all})
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared admin table ────────────────────────────────────────
function AdminTable({ cols, rows, rowKey, sortKey, sortDir, onSort }) {
  return (
    <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {cols.map(col => (
              <th key={col.key} onClick={() => onSort(col.key)}
                className="px-3 py-3 cursor-pointer select-none hover:bg-white/5 transition whitespace-nowrap"
                style={{ textAlign: col.align || 'right', color: sortKey === col.key ? '#F5C118' : 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
                {col.label}{sortKey === col.key && <span className="mr-1">{sortDir === -1 ? '↓' : '↑'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>אין נתונים</td></tr>
            : rows.map((r, i) => (
              <tr key={rowKey(r)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
                className="hover:bg-white/[0.03] transition">
                {cols.map(col => {
                  const val = r[col.key];
                  const display = col.fmt ? col.fmt(val) : (val ?? '—');
                  return (
                    <td key={col.key} className="px-3 py-2.5 whitespace-nowrap"
                      style={{ textAlign: col.align || 'right', color: col.color || (val == null || val === '' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)'), fontSize: 13 }}>
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

// ── Coming Soon placeholder ───────────────────────────────────
function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3" style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16 }}>
      <p className="text-2xl font-bold text-white/20">{label}</p>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>בקרוב</p>
    </div>
  );
}

// ── Monthly Table ─────────────────────────────────────────────
const MT_COLS = [
  { key: 'name',                label: 'שם',              fmt: v => v,                          align: 'right' },
  { key: 'month',               label: 'חודש',            fmt: v => fmtMonth(v),                align: 'right' },
  { key: 'total_income',        label: 'הכנסה',           fmt: v => v != null ? `₪${num(v).toLocaleString('he-IL')}` : '—', align: 'left', color: '#F5C118' },
  { key: 'net',                 label: 'נטו',             fmt: v => v != null ? `₪${num(v).toLocaleString('he-IL')}` : '—', align: 'left', color: '#4fc38a' },
  { key: 'total_new_deals',     label: 'עסקאות חדשות',   fmt: v => v != null ? `₪${num(v).toLocaleString('he-IL')}` : '—', align: 'left' },
  { key: 'retainers',          label: 'ריטיינרים',        fmt: v => v != null ? `₪${num(v).toLocaleString('he-IL')}` : '—', align: 'left' },
  { key: 'paid_ads',            label: 'ממומן',           fmt: v => v != null ? `₪${num(v).toLocaleString('he-IL')}` : '—', align: 'left' },
  { key: 'new_clients',         label: 'לקוחות חדשים',   fmt: v => v ?? '—', align: 'center' },
  { key: 'active_clients',      label: 'פעילים',          fmt: v => v ?? '—', align: 'center' },
  { key: 'leads',               label: 'לידים',           fmt: v => v ?? '—', align: 'center' },
  { key: 'sales_calls_set',     label: 'שיחות נקבעו',    fmt: v => v ?? '—', align: 'center' },
  { key: 'sales_calls_showed',  label: 'הגיעו',           fmt: v => v ?? '—', align: 'center' },
  { key: 'closings_count',      label: 'סגירות',          fmt: v => v ?? '—', align: 'center' },
  { key: 'current_rank',        label: 'דרגה',            fmt: v => v || '—', align: 'center' },
];

function MonthlyTable({ students }) {
  const [search,  setSearch]  = useState('');
  const [period,  setPeriod]  = useState('all');
  const [sortKey, setSortKey] = useState('month');
  const [sortDir, setSortDir] = useState(-1); // -1 = desc

  const allMonths = useMemo(() => {
    const months = new Set();
    students.forEach(s => (s.monthly || []).forEach(m => months.add(m.month?.slice(0, 7))));
    return [...months].sort().reverse();
  }, [students]);

  const rows = useMemo(() => {
    const flat = students.flatMap(s =>
      (s.monthly || []).map(m => ({
        ...m,
        name: s.name,
        net: num(m.total_income || m.amount) - num(m.software_expenses) - num(m.variable_expenses) - num(m.paid_ads),
      }))
    );

    return flat
      .filter(r => {
        if (search && !r.name?.toLowerCase().includes(search.toLowerCase())) return false;
        if (period !== 'all') {
          const rMonth = r.month?.slice(0, 7);
          if (period === 'month' && allMonths[0] && rMonth !== allMonths[0]) return false;
          if (period === '3m') {
            const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
            if (new Date(r.month) < cutoff) return false;
          }
          if (period === '6m') {
            const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6);
            if (new Date(r.month) < cutoff) return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        if (typeof av === 'number' || !isNaN(Number(av))) return (Number(av) - Number(bv)) * sortDir;
        return String(av).localeCompare(String(bv), 'he') * sortDir;
      });
  }, [students, search, period, sortKey, sortDir, allMonths]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
  }

  const totalIncome = rows.reduce((s, r) => s + num(r.total_income || r.amount), 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-[180px]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם..."
            className="bg-transparent outline-none text-sm w-full text-white placeholder:text-white/30" />
        </div>

        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {[
            { k: 'all',   l: 'כל הזמן' },
            { k: 'month', l: 'חודש אחרון' },
            { k: '3m',    l: '3 חודשים' },
            { k: '6m',    l: '6 חודשים' },
          ].map(t => (
            <button key={t.k} onClick={() => setPeriod(t.k)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap"
              style={{ background: period === t.k ? 'rgba(255,255,255,0.12)' : 'transparent', color: period === t.k ? 'white' : 'rgba(255,255,255,0.35)' }}>
              {t.l}
            </button>
          ))}
        </div>

        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {rows.length} דיווחים · הכנסה כוללת: <span style={{ color: '#F5C118', fontWeight: 700 }}>₪{totalIncome.toLocaleString('he-IL')}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {MT_COLS.map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)}
                  className="px-3 py-3 cursor-pointer select-none hover:bg-white/5 transition whitespace-nowrap"
                  style={{ textAlign: col.align || 'right', color: sortKey === col.key ? '#F5C118' : 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', userSelect: 'none' }}>
                  {col.label}
                  {sortKey === col.key && <span className="mr-1">{sortDir === -1 ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={MT_COLS.length} className="py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>אין נתונים</td></tr>
            ) : rows.map((r, i) => (
              <tr key={`${r.user_id}-${r.month}-${i}`}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
                className="hover:bg-white/[0.03] transition">
                {MT_COLS.map(col => {
                  const val = r[col.key];
                  const display = col.fmt(val);
                  return (
                    <td key={col.key} className="px-3 py-2.5 whitespace-nowrap"
                      style={{ textAlign: col.align || 'right', color: col.color || (val == null || val === '' || val === '—' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)'), fontSize: 13 }}>
                      {col.key === 'current_rank' && val ? (
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: getRankColor(val) + '20', color: getRankColor(val), border: `1px solid ${getRankColor(val)}40` }}>
                          {val}
                        </span>
                      ) : display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [roadmap,       setRoadmap]       = useState({ phases: [], weeks: [], tasks: [] });
  const location = useLocation();
  const view = location.pathname.includes('/monthly')   ? 'monthly'
             : location.pathname.includes('/wins')      ? 'wins'
             : location.pathname.includes('/deals')     ? 'deals'
             : location.pathname.includes('/checklist') ? 'checklist'
             : 'students';

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
      const { students: s, roadmap: rm } = await r.json();
      setStudents(s || []);
      if (rm) setRoadmap(rm);
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
      <div className="space-y-2 w-full">
        {list.map(s => {
          const isOpen = openStudentId === s.id;
          return (
            <StudentCard
              key={s.id}
              student={s}
              open={isOpen}
              onToggle={() => toggleStudent(s.id)}
              onHealthChange={handleHealthChange}
              onApproveRank={handleApproveRank}
              onUpdateProfile={updateProfile}
            />
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
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {{ students: 'תלמידים', monthly: 'נתונים חודשיים', wins: 'נצחונות שבועיים', deals: 'עסקאות חדשות', checklist: 'צ׳קליסט' }[view]}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {active.length} פעילים · {archived.length} בארכיון
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStudents} disabled={loading}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            רענן
          </button>
        </div>
      </div>

      {/* KPI cards — students view only */}
      {view === 'students' && students.length > 0 && (() => {
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

      {/* Alert banners — students view only */}
      {view === 'students' && alertList.length > 0 && (
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

      {/* Filter — only in students view */}
      {view === 'students' && <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
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
      </div>}

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

      {/* Sub-page views */}
      {view === 'monthly'   && !loading && <MonthlyTable   students={students.filter(s => s.is_active !== false)} />}
      {view === 'wins'      && !loading && <WeeklyWinsTable students={students.filter(s => s.is_active !== false)} />}
      {view === 'deals'     && !loading && <DealsTable      students={students.filter(s => s.is_active !== false)} />}
      {view === 'checklist' && !loading && <ChecklistView   students={students.filter(s => s.is_active !== false)} roadmap={roadmap} />}

      {/* Student list view */}
      {view === 'students' && (loading ? (
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
      ))}

      {/* Archive */}
      {view === 'students' && !loading && archived.length > 0 && (
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
