import { useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  AlertTriangle, TrendingDown, Calendar, ChevronLeft, ChevronRight,
  ArrowUp, Users, RefreshCw, Circle, TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Archive, RotateCcw,
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
  if (v >= 1000) return `₪${Math.round(v/1000)}K`;
  return '₪' + Math.round(v).toLocaleString('he-IL');
}
function fmtFull(n) {
  if (n == null || n === '') return '—';
  const v = Number(n); if (isNaN(v)) return '—';
  return '₪' + Math.round(v).toLocaleString('he-IL');
}
function fmtDate(d) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return d; }
}
function monthsAgo(d) {
  if (!d) return null;
  const months = Math.floor((Date.now() - new Date(d)) / (1000*60*60*24*30.44));
  return months;
}
function fmtMonth(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('he-IL', { month: 'long', year: 'numeric', timeZone:'UTC' }); }
  catch { return d; }
}
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

const HEALTH = {
  green:  { label: 'סבבה', color: '#4fc38a', bg: 'rgba(79,195,138,0.15)' },
  yellow: { label: 'צריך יחס', color: '#F5C118', bg: 'rgba(245,193,24,0.15)' },
  red:    { label: 'עזרה צמודה', color: '#ff5a72', bg: 'rgba(255,90,114,0.15)' },
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-80"
        style={h
          ? { background: h.bg, color: h.color, border: `1px solid ${h.color}44` }
          : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px dashed rgba(255,255,255,0.15)' }}>
        <Circle size={7} style={{ fill: h?.color || 'transparent', color: h?.color || 'rgba(255,255,255,0.25)' }} />
        {h ? h.label : 'בריאות'}
      </button>
      {open && rect && (
        <div
          style={{ position:'fixed', top: rect.top, left: rect.left, zIndex:9999, minWidth:130, borderRadius:12, overflow:'hidden', background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.15)', boxShadow:'0 12px 40px rgba(0,0,0,0.6)' }}
          onClick={e => e.stopPropagation()}>
          {[null, 'green', 'yellow', 'red'].map(k => {
            const h2 = k ? HEALTH[k] : null;
            return (
              <button key={k ?? 'none'} onClick={e => { e.stopPropagation(); onChange(k); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition hover:bg-white/08"
                style={{ color: h2?.color || 'rgba(255,255,255,0.35)' }}>
                <Circle size={7} style={{ fill: h2?.color||'transparent', color: h2?.color||'rgba(255,255,255,0.25)', flexShrink:0 }} />
                {h2 ? h2.label : 'הסר סימון'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Monthly stats panel ─────────────────────────────────────
function MonthlyPanel({ monthly, studentName }) {
  const sorted = [...monthly].sort((a,b) => b.month.localeCompare(a.month));
  const [idx, setIdx] = useState(0);

  const cur  = sorted[idx]   ?? null;
  const prev = sorted[idx+1] ?? null;

  function delta(field) {
    const c = num(cur?.[field]), p = num(prev?.[field]);
    if (!cur || !prev || p === 0) return null;
    return Math.round((c - p) / p * 100);
  }

  function Stat({ label, value, field, color = 'white', format = 'ils' }) {
    const d = field ? delta(field) : null;
    const val = format === 'ils' ? fmtFull(value) : value != null ? String(value) : '—';
    return (
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</p>
        <p className="text-lg font-black leading-none" style={{ color }}>{val}</p>
        {d != null && (
          <div className="flex items-center gap-1 mt-1.5">
            {d > 0
              ? <ArrowUpRight size={10} style={{ color:'#86efac' }} />
              : d < 0
              ? <ArrowDownRight size={10} style={{ color:'#fca5a5' }} />
              : <Minus size={10} style={{ color:'rgba(255,255,255,0.25)' }} />}
            <span className="text-[10px] font-semibold" style={{ color: d>0?'#86efac':d<0?'#fca5a5':'rgba(255,255,255,0.25)' }}>
              {d>0?'+':''}{d}%
            </span>
          </div>
        )}
      </div>
    );
  }

  if (!cur) return <p className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>אין נתונים</p>;

  const income   = num(cur.total_income || cur.amount);
  const expenses = num(cur.software_expenses) + num(cur.variable_expenses) + num(cur.paid_ads);
  const net      = income - expenses;

  return (
    <div className="px-4 pb-5 pt-3 space-y-4">

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setIdx(i => Math.min(i+1, sorted.length-1))} disabled={idx >= sorted.length-1}
          className="p-1.5 rounded-lg transition hover:bg-white/10 disabled:opacity-20">
          <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{fmtMonth(cur.month)}</p>
          {prev && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>השוואה מול {fmtMonth(prev.month)}</p>}
        </div>
        <button onClick={() => setIdx(i => Math.max(i-1, 0))} disabled={idx <= 0}
          className="p-1.5 rounded-lg transition hover:bg-white/10 disabled:opacity-20">
          <ChevronLeft size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
        </button>
      </div>

      {/* Financial */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color:'rgba(255,255,255,0.25)' }}>כספים</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="הכנסה כוללת"     value={income}              field="total_income"    color="#F5C118" />
          <Stat label="עסקאות חדשות"    value={cur.total_new_deals} field="total_new_deals" color="rgba(255,255,255,0.8)" />
          <Stat label="הוצאות"           value={expenses}            color="rgba(252,165,165,0.8)" />
          <Stat label="רווח נטו"         value={net}                 color={net>=0?'#4fc38a':'#ff5a72'} />
        </div>
      </div>

      {/* Sales */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color:'rgba(255,255,255,0.25)' }}>מכירות</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <Stat label="הצעות"          value={cur.proposals}       field="proposals"       color="#818cf8" format="num" />
          <Stat label="לידים"          value={cur.leads}           field="leads"           color="#a78bfa" format="num" />
          <Stat label="שיחות שנקבעו"  value={cur.sales_calls_set} field="sales_calls_set" color="#6366f1" format="num" />
          <Stat label="לקוחות פעילים" value={cur.active_clients}  field="active_clients"  color="#34d399" format="num" />
          <Stat label="דרגה"           value={cur.current_rank || '—'} color={getRankColor(cur.current_rank)} format="num" />
        </div>
      </div>

      {/* Content */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color:'rgba(255,255,255,0.25)' }}>תוכן</p>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="פוסטים"  value={cur.posts_count} field="posts_count" color="#fcd34d" format="num" />
          <Stat label="עוקבים"  value={cur.followers?.toLocaleString('he-IL')||'—'} color="#e1306c" format="num" />
          <Stat label="ריץ׳"    value={cur.reach >= 1000 ? `${Math.round(cur.reach/1000)}K` : cur.reach || '—'} color="#38bdf8" format="num" />
        </div>
      </div>

      {/* Biggest win */}
      {cur.biggest_win && (
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(245,193,24,0.06)', border: '1px solid rgba(245,193,24,0.15)' }}>
          <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#F5C118' }}>🏆 הנצחון הגדול</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{cur.biggest_win}</p>
        </div>
      )}
    </div>
  );
}

// ── Inline editable field ───────────────────────────────────
function InlineEdit({ value, onSave, placeholder, type = 'text', prefix }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const ref = useRef(null);

  function open(e) { e.stopPropagation(); setDraft(value || ''); setEditing(true); setTimeout(()=>ref.current?.select(),30); }
  function save(e) { e.stopPropagation(); onSave(draft.trim()||null); setEditing(false); }

  if (editing) return (
    <span className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
      {prefix && <span className="text-[11px]" style={{color:'rgba(255,255,255,0.35)'}}>{prefix}</span>}
      <input ref={ref} type={type} value={draft} onChange={e=>setDraft(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter')save(e);if(e.key==='Escape'){e.stopPropagation();setEditing(false);}}}
        onBlur={save}
        className="rounded px-1.5 py-0.5 text-xs text-white outline-none w-24"
        style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(245,193,24,0.4)'}} />
    </span>
  );

  return (
    <button onClick={open} className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition hover:bg-white/08"
      style={{color: value ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.08)'}}>
      {prefix && <span>{prefix}</span>}
      {value || placeholder}
    </button>
  );
}

// ── Student row ─────────────────────────────────────────────
function StudentCard({ student, onHealthChange, onApproveRank, onUpdateProfile }) {
  const [open, setOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  const { name, email, monthly, latest_income, latest_rank, health_status,
          rank_request, has_revenue_drop, revenue_drop_pct, missing_report, has_data,
          enrolled_at, total_paid, is_active } = student;

  const rankColor = getRankColor(latest_rank);
  const h = health_status ? HEALTH[health_status] : null;

  const alertIcons = [
    rank_request     && { icon: ArrowUp,      color: '#F5C118', tip: 'שדרוג דרגה' },
    has_revenue_drop && { icon: TrendingDown, color: '#ff5a72', tip: `-${revenue_drop_pct}%` },
    missing_report   && { icon: Calendar,     color: '#f97316', tip: 'חסר דיווח' },
  ].filter(Boolean);

  async function handleApprove(e) {
    e.stopPropagation();
    setApproving(true);
    try { await onApproveRank(rank_request); }
    finally { setApproving(false); }
  }

  return (
    <div className="rounded-xl"
      style={{ background:'rgb(var(--bg-surface))', border:`1px solid ${h ? h.color+'30' : 'rgba(255,255,255,0.07)'}` }}>

      {/* Single thin row */}
      <div className="flex items-center gap-3 px-4 py-2.5">

        {/* Avatar */}
        <div className="h-7 w-7 rounded-full flex-none flex items-center justify-center text-xs font-black"
          style={{ background: h?.bg || 'rgba(255,255,255,0.08)', color: h?.color || 'rgba(255,255,255,0.5)' }}>
          {name.slice(0,1).toUpperCase()}
        </div>

        {/* Name — clickable to expand */}
        <button onClick={() => setOpen(o => !o)}
          className="flex-1 text-right flex items-center gap-3 min-w-0 hover:opacity-80 transition">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-white">{name}</span>
            <span className="text-[11px] mr-2" style={{ color:'rgba(255,255,255,0.3)' }}>{email}</span>
          </div>

          {/* Stats inline */}
          {has_data && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-black" style={{ color:'#F5C118' }}>{fmtILS(latest_income)}</span>
              {latest_rank && (
                <span className="text-[10px] rounded px-1.5 py-0.5 font-bold hidden sm:inline"
                  style={{ background: rankColor+'22', color: rankColor }}>{latest_rank}</span>
              )}
            </div>
          )}

          {/* Alert icons */}
          {alertIcons.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {alertIcons.map((a, i) => (
                <a.icon key={i} size={12} style={{ color: a.color }} title={a.tip} />
              ))}
            </div>
          )}

          {/* Expand indicator */}
          {has_data && (
            <ChevronRight size={13} style={{ color:'rgba(255,255,255,0.2)', flexShrink:0, transform: open ? 'rotate(90deg)' : 'none', transition:'transform 0.2s' }} />
          )}
        </button>

        {/* Approve button */}
        {rank_request && (
          <button onClick={handleApprove} disabled={approving}
            className="rounded-lg px-2.5 py-1 text-[10px] font-bold transition hover:opacity-80 flex-shrink-0"
            style={{ background:'#F5C118', color:'#13152A' }}>
            {approving ? '...' : 'אשר'}
          </button>
        )}

        {/* Enrolled + paid — inline editable */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0" onClick={e=>e.stopPropagation()}>
          <InlineEdit
            value={enrolled_at}
            onSave={v => onUpdateProfile(student.id, { enrolled_at: v })}
            placeholder="תאריך הצטרפות"
            type="date"
          />
          <InlineEdit
            value={total_paid != null ? String(total_paid) : ''}
            onSave={v => onUpdateProfile(student.id, { total_paid: v ? parseInt(v,10) : null })}
            placeholder="שילם ₪"
            prefix="₪"
          />
        </div>

        {/* Health picker — right side */}
        <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
          <HealthPicker current={health_status} onChange={v => onHealthChange(student.id, v)} />
        </div>

        {/* Archive / restore */}
        <button
          onClick={e => { e.stopPropagation(); onUpdateProfile(student.id, { is_active: !is_active }); }}
          title={is_active ? 'העבר לארכיון' : 'שחזר לפעיל'}
          className="p-1.5 rounded-lg transition hover:bg-white/10 flex-shrink-0"
          style={{ color: is_active ? 'rgba(255,255,255,0.2)' : '#4fc38a' }}>
          {is_active ? <Archive size={13} /> : <RotateCcw size={13} />}
        </button>
      </div>

      {/* Expanded monthly panel */}
      {open && has_data && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <MonthlyPanel monthly={monthly} studentName={name} />
        </div>
      )}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────
export default function AdminStudents() {
  const { user } = useUser();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [filter,   setFilter]   = useState('all');

  if (user && user.id !== ADMIN_ID) {
    return <div className="flex h-64 items-center justify-center text-sm" style={{ color:'rgba(255,255,255,0.3)' }}>אין גישה</div>;
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
      headers: { 'Content-Type':'application/json', 'x-admin-id': import.meta.env.VITE_ADMIN_USER_ID || '' },
      body: JSON.stringify(updates),
    });
  }

  const handleHealthChange = (userId, health) => updateProfile(userId, { health_status: health });

  async function handleApproveRank(request) {
    await fetch('/api/slack/rank-upgrade', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name:request.first_name, current_rank:request.current_rank, proposed_rank:request.proposed_rank, avg_income:request.avg_income }),
    }).catch(()=>{});
    await fetchStudents();
  }

  const active   = students.filter(s => s.is_active !== false);
  const archived = students.filter(s => s.is_active === false);
  const alerts   = active.filter(s => s.rank_request || s.has_revenue_drop || s.missing_report);
  const noData   = active.filter(s => !s.has_data);
  const displayed = filter==='alerts' ? alerts : filter==='no-data' ? noData : active;

  return (
    <div className="w-full space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">פאנל תלמידים</h1>
          <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,0.35)' }}>
            {active.length} פעילים · {archived.length} בארכיון
          </p>
        </div>
        <button onClick={fetchStudents} disabled={loading}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-80"
          style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.7)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          רענן
        </button>
      </div>

      {/* ── 4 KPIs ── */}
      {students.length > 0 && (() => {
        const withPaid     = students.filter(s => s.total_paid != null);
        const withEnrolled = students.filter(s => s.enrolled_at);
        const totalRevenue = withPaid.reduce((s,x) => s + (x.total_paid||0), 0);
        const avgLTV       = withPaid.length ? Math.round(totalRevenue / withPaid.length) : null;
        const avgMonths    = withEnrolled.length
          ? Math.round(withEnrolled.reduce((s,x) => s + (monthsAgo(x.enrolled_at)||0), 0) / withEnrolled.length)
          : null;
        const topStudent   = withPaid.length ? [...withPaid].sort((a,b)=>(b.total_paid||0)-(a.total_paid||0))[0] : null;

        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l:'סה״כ הכנסות מהתוכנית', v: totalRevenue > 0 ? `₪${totalRevenue.toLocaleString('he-IL')}` : '—', c:'#F5C118', sub:`${withPaid.length} תלמידים` },
              { l:'ממוצע שווי לקוח',       v: avgLTV ? `₪${avgLTV.toLocaleString('he-IL')}` : '—', c:'#4fc38a', sub:'LTV ממוצע' },
              { l:'ממוצע שהות בתוכנית',    v: avgMonths != null ? `${avgMonths} חודשים` : '—', c:'#a78bfa', sub:`${withEnrolled.length} עם תאריך` },
              { l:'הכי רווחי',              v: topStudent ? `₪${(topStudent.total_paid||0).toLocaleString('he-IL')}` : '—', c:'#38bdf8', sub: topStudent?.name || '' },
            ].map(({ l, v, c, sub }) => (
              <div key={l} className="rounded-2xl p-4" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color:'rgba(255,255,255,0.28)' }}>{l}</p>
                <p className="text-xl font-black leading-none" style={{ color:c }}>{v}</p>
                {sub && <p className="text-[10px] mt-1 truncate" style={{ color:'rgba(255,255,255,0.28)' }}>{sub}</p>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Alert summary */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon:ArrowUp,      color:'#F5C118', count:students.filter(s=>s.rank_request).length,    label:'שדרוג דרגה ממתין' },
            { icon:TrendingDown, color:'#ff5a72', count:students.filter(s=>s.has_revenue_drop).length,label:'ירידה דרסטית בהכנסות' },
            { icon:Calendar,     color:'#f97316', count:students.filter(s=>s.missing_report).length,  label:'לא הגישו נתונים חודשיים' },
          ].filter(a=>a.count>0).map(a=>(
            <div key={a.label} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background:a.color+'12', border:`1px solid ${a.color}30` }}>
              <a.icon size={16} style={{ color:a.color, flexShrink:0 }} />
              <div>
                <p className="text-base font-black" style={{ color:a.color }}>{a.count}</p>
                <p className="text-[11px]" style={{ color:'rgba(255,255,255,0.45)' }}>{a.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background:'rgba(255,255,255,0.05)' }}>
        {[
          { k:'all',     l:`כולם (${students.length})` },
          { k:'alerts',  l:`התראות (${alerts.length})` },
          { k:'no-data', l:`ללא נתונים (${noData.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setFilter(t.k)}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold transition"
            style={{ background:filter===t.k?'rgba(255,255,255,0.12)':'transparent', color:filter===t.k?'white':'rgba(255,255,255,0.35)' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl px-5 py-4" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-sm font-semibold" style={{ color:'#fca5a5' }}>שגיאה: {error}</p>
          {error.includes('CLERK_SECRET_KEY') && (
            <p className="text-xs mt-1" style={{ color:'rgba(252,165,165,0.6)' }}>הוסף CLERK_SECRET_KEY ל-.env</p>
          )}
        </div>
      )}

      {/* Grid 3 columns */}
      {!loading && !error && (
        displayed.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ border:'1px dashed rgba(255,255,255,0.1)' }}>
            <Users size={32} style={{ color:'rgba(255,255,255,0.1)', margin:'0 auto 12px' }} />
            <p className="text-sm" style={{ color:'rgba(255,255,255,0.3)' }}>
              {filter==='all' ? 'אין תלמידים' : 'אין תלמידים בקטגוריה זו'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
            {displayed.map((s,i) => (
              <StudentCard key={s.id} student={s} index={i}
                onHealthChange={handleHealthChange}
                onApproveRank={handleApproveRank}
                onUpdateProfile={updateProfile} />
            ))}
          </div>
        )
      )}

      {/* Archive section */}
      {!loading && archived.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none py-2 px-1 rounded-lg hover:bg-white/05 transition"
            style={{ color:'rgba(255,255,255,0.3)' }}>
            <Archive size={13} />
            <span className="text-xs font-semibold">ארכיון ({archived.length} תלמידים)</span>
            <ChevronRight size={12} className="group-open:rotate-90 transition-transform mr-auto" />
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 items-start">
            {archived.map((s,i) => (
              <div key={s.id} className="opacity-50 hover:opacity-80 transition-opacity">
                <StudentCard student={s} index={i}
                  onHealthChange={handleHealthChange}
                  onApproveRank={handleApproveRank}
                  onUpdateProfile={updateProfile} />
              </div>
            ))}
          </div>
        </details>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[1,2,3,4,5,6].map(i=>(
            <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background:'rgb(var(--bg-surface))' }} />
          ))}
        </div>
      )}
    </div>
  );
}
