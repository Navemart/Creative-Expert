import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';
import { useDialog } from '../components/Dialog.jsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Dot,
} from 'recharts';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const STATUS_META = {
  active:    { label: 'פעיל',   color: '#22c55e' },
  graduated: { label: 'בוגר',   color: '#06b6d4' },
  churned:   { label: 'עזב',    color: '#eab308' },
  ghosted:   { label: 'נעלם',   color: '#f97316' },
  removed:   { label: 'הוצאתי', color: '#ef4444' },
};

const RANK_COLORS = {
  'TRAINEE':        '#9ca3af',
  'CREW':           '#9ca3af',
  'SECOND OFFICER': '#eab308',
  'CO-PILOT':       '#3b82f6',
  'CAPTAIN':        '#22c55e',
  'EXPERT':         '#a855f7',
};

const TABS = [
  { k: 'overview',    l: 'סקירה' },
  { k: 'monthly',     l: 'נתונים חודשיים' },
  { k: 'wins',        l: 'נצחונות' },
  { k: 'deals',       l: 'עסקאות' },
  { k: 'attendance',  l: 'פגישות' },
  { k: 'confidence',  l: 'ביטחון' },
  { k: 'roadmap',     l: 'רודמאפ' },
];

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function fmt(n) {
  if (n == null || n === '') return '—';
  const v = num(n);
  if (v === 0) return '₪0';
  return '₪' + Math.round(v).toLocaleString('he-IL');
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function fmtMonth(d) {
  if (!d) return '—';
  try {
    const s = /^\d{4}-\d{2}$/.test(String(d)) ? d + '-01' : d;
    return new Date(s).toLocaleString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch { return String(d); }
}

const border = '1px solid rgba(255,255,255,0.08)';
const muted  = 'rgba(255,255,255,0.35)';
const dim    = 'rgba(255,255,255,0.55)';
const white  = 'rgba(255,255,255,0.88)';

function Photo({ name, src }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed)
    return <img src={src} alt={name} onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.06)', fontSize: '2.5rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)' }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ── Stat tile (like Scale20's big numbers) ─────────────────────
function Stat({ label, value, sub, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontSize: '0.75rem', color: muted, margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 900, color: valueColor || white, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.75rem', color: muted, margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: border, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{title}</p>
        {action}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

// ── Tab: סקירה ─────────────────────────────────────────────────
function OverviewTab({ student, adminNotes, setAdminNotes, saveAdminNotes, savingNotes }) {
  const sorted = [...(student.monthly || [])].sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  const latest = sorted[0] || null;
  const prev   = sorted[1] || null;
  const curIncome  = latest ? num(latest.total_income || latest.amount) : 0;
  const prevIncome = prev   ? num(prev.total_income   || prev.amount)   : null;
  const pct = prevIncome ? Math.round((curIncome - prevIncome) / prevIncome * 100) : null;
  const curExp = latest ? num(latest.software_expenses) + num(latest.variable_expenses) + num(latest.paid_ads) : 0;
  const curNet = curIncome - curExp;
  const avgIncome = sorted.length ? Math.round(sorted.reduce((s, m) => s + num(m.total_income || m.amount), 0) / sorted.length) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Big stats row */}
        <Section title="נתונים עסקיים — חודש אחרון">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, paddingTop: 4 }}>
            <Stat label="הכנסה" value={fmt(curIncome)} valueColor="#F5C118"
              sub={pct != null ? `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% מהחודש הקודם` : null} />
            <Stat label="רווח נטו" value={fmt(curNet)} valueColor={curNet >= 0 ? '#4fc38a' : '#ff5a72'}
              sub={`הוצאות: ${fmt(curExp)}`} />
            <Stat label="ממוצע" value={fmt(avgIncome)} sub={`${sorted.length} חודשים`} />
            <Stat label="שיא" value={fmt(Math.max(0, ...sorted.map(m => num(m.total_income || m.amount))))} />
          </div>
        </Section>

        {/* Sales */}
        {latest && (
          <Section title="מכירות — חודש אחרון">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, paddingTop: 4 }}>
              <Stat label="לידים"        value={latest.leads              ?? '—'} />
              <Stat label="שיחות נקבעו"  value={latest.sales_calls_set    ?? '—'} />
              <Stat label="הגיעו"        value={latest.sales_calls_showed ?? '—'} />
              <Stat label="נסגרו"        value={latest.closings_count     ?? '—'} valueColor="#F5C118" />
            </div>
          </Section>
        )}

        {/* Recent sessions (like Scale20 Attendance list) */}
        {sorted.length > 0 && (
          <Section title="היסטוריה חודשית — אחרונות">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {sorted.slice(0, 6).map((m, i) => {
                const inc = num(m.total_income || m.amount);
                const exp = num(m.software_expenses) + num(m.variable_expenses) + num(m.paid_ads);
                const net = inc - exp;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < 5 ? border : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4fc38a', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', color: white }}>{fmtMonth(m.month)}</span>
                      {m.current_rank && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: RANK_COLORS[m.current_rank] || muted, background: (RANK_COLORS[m.current_rank] || muted) + '18', padding: '1px 7px', borderRadius: 10 }}>{m.current_rank}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 20, textAlign: 'left' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F5C118' }}>{fmt(inc)}</span>
                      <span style={{ fontSize: '0.75rem', color: net >= 0 ? '#4fc38a' : '#ff5a72', fontWeight: 600 }}>{fmt(net)} נטו</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Reflection */}
        {latest && (latest.biggest_win || latest.focus_next_month || latest.program_feedback) && (
          <Section title={`רפלקשן — ${fmtMonth(latest.month)}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
              {[['נצחון גדול', latest.biggest_win], ['פוקוס הבא', latest.focus_next_month], ['פידבק', latest.program_feedback]].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}>
                  <p style={{ fontSize: '0.75rem', color: muted, margin: '0 0 4px', fontWeight: 600 }}>{l}</p>
                  <p style={{ fontSize: '0.875rem', color: dim, lineHeight: 1.6, margin: 0 }}>{v}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Right column: admin notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="הערות אדמין" action={<span style={{ fontSize: '0.625rem', color: savingNotes ? '#F5C118' : muted }}>{savingNotes ? 'שומר...' : 'פרטי — התלמיד לא רואה'}</span>}>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            onBlur={e => saveAdminNotes(e.target.value)}
            placeholder="הוסף הערות על התלמיד — הקשר משיחות, דברים למעקב, דגלים פנימיים..."
            style={{ width: '100%', minHeight: 180, background: 'transparent', border: 'none', outline: 'none', color: dim, fontSize: '0.875rem', lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }} />
        </Section>

        {/* Content */}
        {latest && (latest.followers != null || latest.posts_count != null) && (
          <Section title="תוכן — חודש אחרון">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
              <Stat label="עוקבים"  value={latest.followers != null ? Number(latest.followers).toLocaleString('he-IL') : '—'} />
              <Stat label="פוסטים"  value={latest.posts_count ?? '—'} />
              {latest.paid_ads != null && <Stat label="פרסום ממומן" value={fmt(latest.paid_ads)} />}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Monthly detail panel ───────────────────────────────────────
function MonthlyDetail({ sub }) {
  const income = num(sub.total_income || sub.amount);
  const exp    = num(sub.software_expenses) + num(sub.variable_expenses) + num(sub.paid_ads);
  const net    = income - exp;

  const sections = [
    { title: 'כספים', items: [
      { label: 'הכנסה כוללת',       value: fmt(income) },
      { label: 'הוצאות תוכנה',      value: fmt(sub.software_expenses) },
      { label: 'הוצאות משתנות',     value: fmt(sub.variable_expenses) },
      { label: 'פרסום ממומן',        value: fmt(sub.paid_ads) },
      { label: 'רווח נטו',          value: fmt(net), highlight: net >= 0 ? '#4fc38a' : '#ff5a72' },
    ]},
    { title: 'מכירות', items: [
      { label: 'לידים',              value: sub.leads ?? '—' },
      { label: 'שיחות שנקבעו',      value: sub.sales_calls_set ?? '—' },
      { label: 'שיחות שהגיעו',      value: sub.sales_calls_showed ?? '—' },
      { label: 'שיחות אסטרטגיה',    value: sub.strategy_calls ?? '—' },
      { label: 'הצעות מחיר שנשלחו', value: sub.price_quotes_sent ?? '—' },
      { label: 'הצעות שאושרו',       value: sub.price_quotes_approved ?? '—' },
      { label: 'סגירות',             value: sub.closings_count ?? '—' },
      { label: 'לקוחות פעילים',     value: sub.active_clients ?? '—' },
      { label: 'לקוחות חדשים',      value: sub.new_clients ?? '—' },
      { label: 'ריטיינרים',          value: sub.retainers_count ?? '—' },
    ]},
    { title: 'תוכן', items: [
      { label: 'עוקבים',             value: sub.followers != null ? Number(sub.followers).toLocaleString('he-IL') : '—' },
      { label: 'חשיפה (reach)',      value: sub.reach != null ? Number(sub.reach).toLocaleString('he-IL') : '—' },
      { label: 'פוסטים',            value: sub.posts_count ?? '—' },
      { label: 'ממוצע צפיות',       value: sub.avg_views ?? '—' },
      { label: 'engagement',         value: sub.engagement_rate != null ? `${sub.engagement_rate}%` : '—' },
    ]},
    { title: 'ביטחון', items: [
      { label: 'ביטחון עסקי',       value: sub.business_confidence != null ? `${sub.business_confidence}/10` : '—' },
      { label: 'ביטחון בתוכן',      value: sub.content_confidence  != null ? `${sub.content_confidence}/10`  : '—' },
      { label: 'ביטחון במכירות',    value: sub.sales_confidence    != null ? `${sub.sales_confidence}/10`    : '—' },
    ]},
    { title: 'לקוחות', items: [
      { label: 'שביעות רצון לקוחות', value: sub.client_satisfaction != null ? `${sub.client_satisfaction}/10` : '—' },
      { label: 'עמידה בזמנים',       value: sub.on_time_delivery    != null ? `${sub.on_time_delivery}/10`    : '—' },
      { label: 'המלצות',             value: sub.recommendation      != null ? `${sub.recommendation}/10`      : '—' },
    ]},
    { title: 'פרוגרם', items: [
      { label: 'NPS',                value: sub.nps != null ? `${sub.nps}/10` : '—' },
      { label: 'דרגה',               value: sub.current_rank || '—' },
    ]},
  ];

  const textFields = [
    { label: 'הנצחון הגדול של החודש', value: sub.biggest_win },
    { label: 'פרויקט עיקרי',          value: sub.main_project },
    { label: 'מה צריך לשפר',          value: sub.systems_needed },
    { label: 'פידבק על התוכנית',      value: sub.program_feedback },
    { label: 'פוקוס לחודש הבא',       value: sub.focus_next_month },
  ].filter(f => f.value);

  return (
    <div style={{ padding: '20px 18px', background: 'rgba(245,193,24,0.03)', borderTop: '1px solid rgba(245,193,24,0.15)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: textFields.length ? 20 : 0 }}>
        {sections.map(sec => (
          <div key={sec.title}>
            <p style={{ margin: '0 0 8px', fontSize: '0.625rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{sec.title}</p>
            {sec.items.map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: '0.75rem', color: muted }}>{item.label}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: item.highlight || dim }}>{item.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {textFields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: border, paddingTop: 16 }}>
          {textFields.map(f => (
            <div key={f.label}>
              <p style={{ margin: '0 0 3px', fontSize: '0.625rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: dim, lineHeight: 1.6 }}>{f.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: נתונים חודשיים ────────────────────────────────────────
function MonthlyTab({ student }) {
  const [expandedMonth, setExpandedMonth] = useState(null);
  const sorted = [...(student.monthly || [])].sort((a, b) => (b.month || '').localeCompare(a.month || ''));

  const subMap = useMemo(() => {
    const m = {};
    (student.monthly || []).forEach(s => { if (s.month) m[s.month.slice(0, 7)] = s; });
    return m;
  }, [student.monthly]);

  // Build month list: max(Dec 2025, month before enrolled_at) → current month
  // Show row only if: has submission OR (overdue = past 10th of following month)
  const rows = useMemo(() => {
    const today  = new Date();
    const result = [];

    // Earliest possible start: December 2025
    const programStart = new Date(2025, 11, 1);

    // Student's start: one month before enrolled_at (or program start if no enrolled_at)
    let studentStart = programStart;
    if (student.enrolled_at) {
      const e = new Date(student.enrolled_at);
      const oneMonthBefore = new Date(e.getFullYear(), e.getMonth() - 1, 1);
      studentStart = oneMonthBefore > programStart ? oneMonthBefore : programStart;
    }

    // Add any submissions that exist before studentStart (student reported voluntarily)
    const keysInRange = new Set();
    const cur = new Date(studentStart);
    while (cur.getFullYear() < today.getFullYear() ||
           (cur.getFullYear() === today.getFullYear() && cur.getMonth() <= today.getMonth())) {
      const key      = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      keysInRange.add(key);
      const hasSub   = !!subMap[key];
      const deadline = new Date(cur.getFullYear(), cur.getMonth() + 1, 10);
      const isOverdue = today >= deadline;
      if (hasSub || isOverdue) result.push({ key, hasSub, isOverdue });
      cur.setMonth(cur.getMonth() + 1);
    }
    // Submissions outside the expected range — show them, never mark missing
    Object.keys(subMap).forEach(key => {
      if (!keysInRange.has(key)) result.push({ key, hasSub: true, isOverdue: false });
    });
    return result.sort((a, b) => b.key.localeCompare(a.key));
  }, [subMap, student.enrolled_at]);

  const submittedCount = rows.filter(r => r.hasSub).length;
  const expectedCount  = rows.filter(r => r.hasSub || r.isOverdue).length;

  const COLS = ['חודש', 'הכנסה', 'הוצאות', 'רווח נטו', 'לידים', 'הגיעו', 'נסגרו', 'עוקבים', 'דרגה'];

  return (
    <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderBottom: border, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>נתונים חודשיים</p>
        <span style={{ fontSize: '0.75rem', color: muted }}>{submittedCount} / {expectedCount} הוגשו</span>
      </div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(8, 1fr)', padding: '9px 18px', borderBottom: border, background: 'rgba(255,255,255,0.015)' }}>
        {COLS.map(c => <span key={c} style={{ fontSize: '0.625rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</span>)}
      </div>
      {rows.map(({ key: m, hasSub, isOverdue }, i) => {
        const sub     = subMap[m];
        const missing = !hasSub && isOverdue;
        const income  = sub ? num(sub.total_income || sub.amount) : 0;
        const exp     = sub ? num(sub.software_expenses) + num(sub.variable_expenses) + num(sub.paid_ads) : 0;
        const net     = income - exp;
        const rc      = RANK_COLORS[sub?.current_rank] || muted;
        const isOpen  = expandedMonth === m;

        return (
          <div key={m} style={{ borderBottom: i < rows.length - 1 ? border : 'none' }}>
            <div
              onClick={() => hasSub && setExpandedMonth(isOpen ? null : m)}
              style={{ display: 'grid', gridTemplateColumns: '150px repeat(8, 1fr)', padding: '12px 18px', background: isOpen ? 'rgba(245,193,24,0.05)' : missing ? 'rgba(239,68,68,0.03)' : 'transparent', alignItems: 'center', cursor: hasSub ? 'pointer' : 'default' }}
              onMouseEnter={e => { if (hasSub) e.currentTarget.style.background = isOpen ? 'rgba(245,193,24,0.07)' : 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isOpen ? 'rgba(245,193,24,0.05)' : missing ? 'rgba(239,68,68,0.03)' : 'transparent'; }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', fontWeight: 600, color: missing ? 'rgba(239,68,68,0.55)' : white }}>
                {hasSub && <ChevronRight size={13} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: muted, flexShrink: 0 }} />}
                {fmtMonth(m)}
              </span>
              {missing
                ? <span style={{ fontSize: '0.75rem', color: 'rgba(239,68,68,0.4)', gridColumn: '2 / -1' }}>לא הוגש</span>
                : <>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#F5C118' }}>{fmt(income)}</span>
                    <span style={{ fontSize: '0.875rem', color: dim }}>{fmt(exp)}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: net >= 0 ? '#4fc38a' : '#ff5a72' }}>{fmt(net)}</span>
                    <span style={{ fontSize: '0.875rem', color: dim }}>{sub.leads ?? '—'}</span>
                    <span style={{ fontSize: '0.875rem', color: dim }}>{sub.sales_calls_showed ?? '—'}</span>
                    <span style={{ fontSize: '0.875rem', color: dim }}>{sub.closings_count ?? '—'}</span>
                    <span style={{ fontSize: '0.875rem', color: dim }}>{sub.followers != null ? Number(sub.followers).toLocaleString('he-IL') : '—'}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: rc }}>{sub.current_rank || '—'}</span>
                  </>
              }
            </div>
            {isOpen && sub && <MonthlyDetail sub={sub} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: נצחונות ───────────────────────────────────────────────
function WinsTab({ student }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const enrolledAt = student.enrolled_at || student.created_at;

  // Build Sundays starting from the week AFTER the enrollment week
  const weeks = useMemo(() => {
    if (!enrolledAt) return [];
    const result = [];
    const d = new Date(enrolledAt);
    d.setHours(0, 0, 0, 0);
    // Find the Sunday that ends the enrollment week
    const daysToSunday = d.getDay() === 0 ? 0 : 7 - d.getDay();
    d.setDate(d.getDate() + daysToSunday);
    // Skip enrollment week → first required Sunday is the one after
    d.setDate(d.getDate() + 7);

    // Never start before the last Sunday of December 2025 (Dec 28)
    const programStart = new Date(2025, 11, 28);
    if (d < programStart) d.setTime(programStart.getTime());

    const now = new Date();
    const thisWeekSunday = new Date(now);
    thisWeekSunday.setDate(now.getDate() - now.getDay());
    thisWeekSunday.setHours(23, 59, 59, 999);

    let cur = new Date(d);
    while (cur <= thisWeekSunday) {
      result.push(cur.toISOString().slice(0, 10));
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 7);
    }
    return result.reverse();
  }, [enrolledAt]);

  const winsByDate = useMemo(() => {
    const map = {};
    for (const w of student.wins || []) {
      const key = (w.week_date || w.submitted_at || '').slice(0, 10);
      if (key) map[key] = w;
    }
    return map;
  }, [student.wins]);

  // Find win for a given Sunday key (±1 day tolerance)
  function findWin(sundayKey) {
    if (winsByDate[sundayKey]) return winsByDate[sundayKey];
    const d = new Date(sundayKey);
    for (let delta = -1; delta <= 1; delta++) {
      const t = new Date(d); t.setDate(t.getDate() + delta);
      const k = t.toISOString().slice(0, 10);
      if (winsByDate[k]) return winsByDate[k];
    }
    return null;
  }

  // Late = submitted from Monday of the FOLLOWING week onwards.
  // בזמן: anywhere Sunday (week start) through Sunday of the next week at 23:59.
  // איחר: Monday of the next week or later.
  function isLateSubmission(win, sundayKey) {
    if (!win?.submitted_at) return false;
    const deadline = new Date(sundayKey);
    deadline.setDate(deadline.getDate() + 7); // next Sunday (last moment before Monday = "late")
    deadline.setHours(23, 59, 59, 999);
    return new Date(win.submitted_at) > deadline;
  }

  // Wins outside the expected weeks range (submitted voluntarily before enrollment week)
  const weekSet = useMemo(() => new Set(weeks), [weeks]);
  const extraWins = useMemo(() => {
    return (student.wins || []).filter(w => {
      const key = (w.week_date || w.submitted_at || '').slice(0, 10);
      const d = new Date(key);
      for (let delta = -1; delta <= 1; delta++) {
        const t = new Date(d); t.setDate(t.getDate() + delta);
        if (weekSet.has(t.toISOString().slice(0, 10))) return false;
      }
      return true;
    });
  }, [student.wins, weekSet]);

  const onTime  = weeks.filter(wk => { const w = findWin(wk); return w && !isLateSubmission(w, wk); }).length;
  const late    = weeks.filter(wk => { const w = findWin(wk); return w && isLateSubmission(w, wk); }).length;
  const missing = weeks.filter(wk => !findWin(wk) && new Date() > new Date(new Date(wk).setHours(23,59,59,999))).length;

  const thStyle = {
    padding: '10px 14px', fontSize: '0.75rem', fontWeight: 700, color: muted,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    textAlign: 'right', background: 'rgba(255,255,255,0.02)',
    borderBottom: border, whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '11px 14px', fontSize: '0.875rem', verticalAlign: 'top', textAlign: 'right' };
  const truncate = (s, n = 55) => s && s.length > n ? s.slice(0, n) + '…' : s;
  const fmtWeek = key => new Date(key).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', timeZone: 'UTC' });

  // All rows: expected weeks + extra wins, sorted newest first
  const allRows = [
    ...weeks.map(key => ({ key, expected: true })),
    ...extraWins.map(w => ({ key: (w.week_date || w.submitted_at || '').slice(0, 10), expected: false, win: w })),
  ].sort((a, b) => b.key.localeCompare(a.key));

  return (
    <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: border, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>נצחונות שבועיים</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#4fc38a', fontWeight: 600 }}>{onTime} בזמן</span>
          {late > 0 && <span style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 600 }}>{late} באיחור</span>}
          {missing > 0 && <span style={{ fontSize: '0.75rem', color: 'rgba(239,68,68,0.7)', fontWeight: 600 }}>{missing} חסר</span>}
          <span style={{ fontSize: '0.75rem', color: muted }}>/ {weeks.length}</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 130 }}>שבוע</th>
              <th style={{ ...thStyle, width: 80 }}>סטטוס</th>
              <th style={thStyle}>נצחון ראשי</th>
              <th style={{ ...thStyle, width: 220 }}>פוקוס שבוע הבא</th>
              <th style={{ ...thStyle, width: 180 }}>חוסם</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map(({ key: weekKey, expected }, i) => {
              const win      = expected ? findWin(weekKey) : extraWins.find(w => (w.week_date || w.submitted_at || '').slice(0, 10) === weekKey);
              const deadline = new Date(new Date(weekKey).setHours(23, 59, 59, 999));
              const pastDeadline = new Date() > deadline;
              const isMissing = expected && !win && pastDeadline;
              const isLate    = win && expected && isLateSubmission(win, weekKey);
              const isOnTime  = win && !isLate;
              const isExp     = expandedIdx === i;

              // Skip: not yet past deadline, no submission, in expected range
              if (expected && !win && !pastDeadline) return null;

              const rowBg = isMissing ? 'rgba(239,68,68,0.05)' : isExp ? 'rgba(245,193,24,0.06)' : 'transparent';
              const sideBar = isMissing ? '3px solid rgba(239,68,68,0.5)' : isLate ? '3px solid rgba(249,115,22,0.5)' : isExp ? '3px solid rgba(245,193,24,0.5)' : '3px solid transparent';

              return (
                <>
                  <tr
                    key={weekKey}
                    onClick={() => win && setExpandedIdx(isExp ? null : i)}
                    style={{ background: rowBg, cursor: win ? 'pointer' : 'default', borderBottom: (isExp && win) ? 'none' : border, borderRight: sideBar, transition: 'background 0.12s' }}
                    onMouseEnter={e => { if (win) e.currentTarget.style.background = isExp ? 'rgba(245,193,24,0.08)' : 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                  >
                    <td style={{ ...tdStyle, color: isMissing ? 'rgba(239,68,68,0.7)' : muted, fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {fmtWeek(weekKey)}
                    </td>
                    <td style={{ ...tdStyle }}>
                      {isMissing && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(239,68,68,0.7)', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 6 }}>חסר</span>}
                      {isLate    && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,0.1)', padding: '2px 8px', borderRadius: 6 }}>איחר</span>}
                      {isOnTime  && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4fc38a', background: 'rgba(79,195,138,0.1)', padding: '2px 8px', borderRadius: 6 }}>✓</span>}
                      {!expected && win && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: 6 }}>בונוס</span>}
                    </td>
                    <td style={{ ...tdStyle, color: isMissing ? 'rgba(255,255,255,0.2)' : white }}>
                      {win ? truncate(win.win_1) : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: dim, fontSize: '0.75rem' }}>
                      {win && truncate(win.focus_next_week, 50)}
                    </td>
                    <td style={{ ...tdStyle, color: dim, fontSize: '0.75rem' }}>
                      {win && truncate(win.blocker, 45)}
                    </td>
                  </tr>
                  {isExp && win && (
                    <tr key={weekKey + '_exp'} style={{ background: 'rgba(245,193,24,0.04)', borderBottom: border }}>
                      <td colSpan={5} style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {[['נצחון 1', win.win_1], ['נצחון 2', win.win_2], ['נצחון 3', win.win_3], ['פוקוס שבוע הבא', win.focus_next_week], ['חוסם', win.blocker]]
                            .filter(([, v]) => v)
                            .map(([l, v]) => (
                              <div key={l} style={{ display: 'flex', gap: 14 }}>
                                <span style={{ fontSize: '0.75rem', color: muted, flexShrink: 0, minWidth: 120, fontWeight: 700, paddingTop: 2 }}>{l}</span>
                                <span style={{ fontSize: '0.875rem', color: white, lineHeight: 1.6 }}>{v}</span>
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: עסקאות ────────────────────────────────────────────────
function DealsTab({ student }) {
  const deals = [...(student.deals || [])].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const total  = deals.reduce((s, d) => s + num(d.total_amount), 0);
  if (!deals.length) return <Empty text="אין עסקאות עדיין" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 12, border, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: border, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>עסקאות — {deals.length}</p>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#4fc38a' }}>סה״כ {fmt(total)}</span>
      </div>
      {deals.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < deals.length - 1 ? border : 'none' }}>
          <div>
            <p style={{ fontSize: '0.875rem', color: white, margin: '0 0 4px', fontWeight: 600 }}>{d.notes || 'עסקה'}</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: muted }}>{fmtDate(d.created_at)}</span>
              {d.next_rank && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: RANK_COLORS[d.next_rank] || muted }}>→ {d.next_rank}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '1rem', fontWeight: 900, color: '#4fc38a', margin: 0 }}>{fmt(d.total_amount)}</p>
            {d.received_amount && <p style={{ fontSize: '0.75rem', color: muted, margin: '2px 0 0' }}>נכנס: {fmt(d.received_amount)}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: ביטחון ─────────────────────────────────────────────────
const CONFIDENCE_SERIES = [
  { key: 'business_confidence', label: 'עסקי',    color: '#F5C118' },
  { key: 'content_confidence',  label: 'תוכן',    color: '#3b82f6' },
  { key: 'sales_confidence',    label: 'מכירות',  color: '#22c55e' },
];

const HE_MONTHS = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצ'];

function fmtReportMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-').map(Number);
  return `${HE_MONTHS[(mo || 1) - 1]} ${String(y).slice(2)}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgb(30,32,50)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', direction: 'rtl' }}>
      <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.85)' }}>{p.name}</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: p.color, marginRight: 'auto' }}>{p.value}/10</span>
        </div>
      ))}
    </div>
  );
}

function ConfidenceTab({ student }) {
  const data = useMemo(() => {
    const subMap = {};
    for (const s of (student.monthly || [])) {
      if (s.report_month) subMap[s.report_month] = s;
    }
    // Build continuous month range: Dec 2025 → today
    const start = new Date(2025, 11, 1);
    const now   = new Date();
    const rows  = [];
    const cur   = new Date(start);
    while (cur <= now) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`;
      const s   = subMap[key] || {};
      rows.push({
        month:   fmtReportMonth(key),
        עסקי:   s.business_confidence ?? null,
        תוכן:   s.content_confidence  ?? null,
        מכירות: s.sales_confidence    ?? null,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return rows;
  }, [student.monthly]);

  if (!data.length) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
        אין דיווחי ביטחון עדיין
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 0' }}>
      <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>כל הזמנים</p>
      <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>ציוני ביטחון</h3>
      <p style={{ margin: '0 0 28px', fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)' }}>
        דיווח עצמי 1-10 לפי תחום — מכל דיווח חודשי
      </p>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="month"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[0, 10]} ticks={[0,2,4,6,8,10]}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 20, fontSize: '0.875rem', direction: 'rtl' }}
            formatter={(value, entry) => (
              <span style={{ color: entry.color }}>{value}</span>
            )}
          />
          {CONFIDENCE_SERIES.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.label}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 4, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 28 }}>
        {CONFIDENCE_SERIES.map(s => {
          const vals = data.map(d => d[s.label]).filter(v => v != null);
          if (!vals.length) return null;
          const last  = vals[vals.length - 1];
          const first = vals[0];
          const diff  = last - first;
          return (
            <div key={s.key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 18px', border: `1px solid ${s.color}30` }}>
              <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              <p style={{ margin: '0 0 4px', fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{last}<span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>/10</span></p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
                {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '— ללא שינוי'} מאז ההתחלה
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: פגישות ────────────────────────────────────────────────
function AttendanceTab({ student }) {
  const [meetings, setMeetings]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    const email = student.email || '';
    const name  = student.name  || '';
    const params = new URLSearchParams();
    if (email)               params.set('email',      email);
    if (name)                params.set('name',       name);
    if (student.enrolled_at) params.set('enrolled_at', student.enrolled_at);
    fetch(`/api/zoom/attendance?${params}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then(data => { setMeetings(data.meetings || []); setLoading(false); })
      .catch(e  => { setError(e.error || 'שגיאה בטעינה'); setLoading(false); });
  }, [student.email, student.name]);

  if (loading) return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: muted, fontSize: '0.875rem' }}>
      טוען נתוני פגישות...
    </div>
  );
  if (error) return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(239,68,68,0.6)', fontSize: '0.875rem' }}>{error}</div>
  );
  if (!meetings?.length) return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: muted, fontSize: '0.875rem' }}>אין פגישות מינואר 2026</div>
  );

  const attended = meetings.filter(m => m.attended === true).length;
  const missed   = meetings.filter(m => m.attended === false).length;
  const unknown  = meetings.filter(m => m.attended === null).length;
  const pct      = meetings.length ? Math.round(attended / (attended + missed || 1) * 100) : 0;

  function fmtDuration(min) {
    if (!min) return '—';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h}ש׳ ${m ? m + 'ד׳' : ''}`.trim() : `${m}ד׳`;
  }

  const thStyle = {
    padding: '10px 14px', fontSize: '0.75rem', fontWeight: 700, color: muted,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    textAlign: 'right', background: 'rgba(255,255,255,0.02)',
    borderBottom: border, whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '11px 14px', fontSize: '0.875rem', verticalAlign: 'middle', textAlign: 'right' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'הגיע', value: attended, color: '#4fc38a' },
          { label: 'לא הגיע', value: missed,   color: '#ef4444' },
          { label: 'סה״כ',   value: meetings.length - unknown, color: white },
          { label: 'אחוז נוכחות', value: `${pct}%`, color: pct >= 70 ? '#4fc38a' : pct >= 40 ? '#f97316' : '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ borderRadius: 12, border, padding: '14px 18px', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontSize: '0.75rem', color: muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>תאריך</th>
                <th style={thStyle}>פגישה</th>
                <th style={{ ...thStyle, width: 90 }}>נוכחות</th>
              </tr>
            </thead>
            <tbody>
              {meetings.filter(m => m.attended !== null).map((m, i, arr) => {
                const isAtt    = m.attended === true;
                const isMissed = m.attended === false;
                const rowBg    = isMissed ? 'rgba(239,68,68,0.04)' : 'transparent';
                const sideBar  = isMissed ? '3px solid rgba(239,68,68,0.4)' : '3px solid rgba(79,195,138,0.4)';
                const date     = new Date(m.start_time).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });

                return (
                  <tr key={m.uuid || i} style={{ background: rowBg, borderBottom: i < arr.length - 1 ? border : 'none', borderRight: sideBar }}>
                    <td style={{ ...tdStyle, color: muted, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{date}</td>
                    <td style={{ ...tdStyle, color: white }}>{m.topic}</td>
                    <td style={tdStyle}>
                      {isAtt    && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4fc38a', background: 'rgba(79,195,138,0.1)', padding: '2px 10px', borderRadius: 6 }}>הגיע ✓</span>}
                      {isMissed && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 10px', borderRadius: 6 }}>לא הגיע</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: רודמאפ ────────────────────────────────────────────────
function RoadmapTab({ student, roadmap }) {
  const [openPhases, setOpenPhases] = useState({});
  const completions = new Set(student.completions || []);
  if (!roadmap?.phases?.length) return <Empty text="אין מידע על רודמאפ" />;

  const phases   = [...roadmap.phases].sort((a, b) => a.sort_order - b.sort_order);
  const weeksMap = {};
  (roadmap.weeks || []).forEach(w => { (weeksMap[w.phase_id] = weeksMap[w.phase_id] || []).push(w); });
  const tasksMap = {};
  (roadmap.tasks || []).forEach(t => { (tasksMap[t.week_id] = tasksMap[t.week_id] || []).push(t); });

  const allTasks  = phases.flatMap(p => (weeksMap[p.id] || []).flatMap(w => tasksMap[w.id] || []));
  const totalDone = allTasks.filter(t => completions.has(t.id)).length;
  const totalPct  = allTasks.length ? Math.round(totalDone / allTasks.length * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Overall */}
      <div style={{ padding: '14px 18px', borderRadius: 12, border, background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>התקדמות כללית</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: white }}>{totalDone}/{allTasks.length} ({totalPct}%)</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ height: '100%', borderRadius: 2, background: '#F5C118', width: `${totalPct}%`, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Phases */}
      <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
        {phases.map((phase, pi) => {
          const weeks    = [...(weeksMap[phase.id] || [])].sort((a, b) => a.sort_order - b.sort_order);
          const pTasks   = weeks.flatMap(w => tasksMap[w.id] || []);
          const pDone    = pTasks.filter(t => completions.has(t.id)).length;
          const isOpen   = openPhases[phase.id] !== false;

          return (
            <div key={phase.id} style={{ borderBottom: pi < phases.length - 1 ? border : 'none' }}>
              <button onClick={() => setOpenPhases(p => ({ ...p, [phase.id]: !isOpen }))}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'rgba(255,255,255,0.02)', border: 'none', cursor: 'pointer', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isOpen ? <ChevronDown size={13} style={{ color: muted }} /> : <ChevronRight size={13} style={{ color: muted }} />}
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: white }}>{phase.title}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: pDone === pTasks.length && pTasks.length > 0 ? '#4fc38a' : muted, fontWeight: 600 }}>
                  {pDone}/{pTasks.length}
                </span>
              </button>

              {isOpen && weeks.map((week, wi) => {
                const tasks = [...(tasksMap[week.id] || [])].sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <div key={week.id} style={{ borderTop: border, padding: '10px 16px 12px 28px' }}>
                    <p style={{ fontSize: '0.75rem', color: muted, margin: '0 0 8px', fontWeight: 600 }}>{week.title}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {tasks.map(task => {
                        const done = completions.has(task.id);
                        return (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {done
                              ? <CheckSquare size={13} style={{ color: '#4fc38a', flexShrink: 0 }} />
                              : <Square size={13} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />}
                            <span style={{ fontSize: '0.75rem', color: done ? dim : 'rgba(255,255,255,0.3)' }}>{task.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: '60px 0', textAlign: 'center', color: muted, fontSize: '0.875rem' }}>{text}</div>;
}

// ── Rank picker ────────────────────────────────────────────────
const ALL_RANKS = ['TRAINEE','CREW','SECOND OFFICER','CO-PILOT','CAPTAIN','EXPERT'];

function RankPicker({ value, autoRank, onChange, saving }) {
  const [open, setOpen] = useState(false);
  const display = value || autoRank || 'TRAINEE';
  const color   = RANK_COLORS[display] || '#9ca3af';
  const isAuto  = !value;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} disabled={saving}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: `1px solid ${color}55`, background: color + '18', cursor: 'pointer' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{saving ? 'שומר...' : display}</span>
        {isAuto && <span style={{ fontSize: '0.5625rem', color: color + 'aa', fontWeight: 600 }}>אוטו׳</span>}
        <ChevronDown size={11} style={{ color: color + '80' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'rgb(var(--bg-chrome))', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, minWidth: 180, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', zIndex: 200, overflow: 'hidden' }}>
          <button onClick={() => { onChange(null); setOpen(false); }}
            style={{ width: '100%', textAlign: 'right', padding: '10px 14px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', background: !value ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>אוטומטי ({autoRank || 'TRAINEE'})</span>
            {!value && <span style={{ fontSize: '0.625rem' }}>✓</span>}
          </button>
          {ALL_RANKS.map(r => {
            const c = RANK_COLORS[r] || '#9ca3af';
            return (
              <button key={r} onClick={() => { onChange(r); setOpen(false); }}
                style={{ width: '100%', textAlign: 'right', padding: '10px 14px', fontSize: '0.75rem', fontWeight: 700, color: c, background: value === r ? c + '12' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>{r}</span>
                {value === r && <span style={{ fontSize: '0.625rem' }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Status picker ──────────────────────────────────────────────
function StatusPicker({ value, onChange, saving }) {
  const [open, setOpen] = useState(false);
  const cur = STATUS_META[value] || STATUS_META.active;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} disabled={saving}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: `1px solid ${cur.color}55`, background: cur.color + '18', cursor: 'pointer' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cur.color }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cur.color }}>{saving ? 'שומר...' : cur.label}</span>
        <ChevronDown size={11} style={{ color: cur.color + '80' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'rgb(var(--bg-chrome))', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, minWidth: 130, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', zIndex: 200, overflow: 'hidden' }}>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }}
              style={{ width: '100%', textAlign: 'right', padding: '10px 14px', fontSize: '0.75rem', fontWeight: 700, color: v.color, background: k === value ? v.color + '12' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────
export default function AdminMemberDetail() {
  const navigate    = useNavigate();
  const dialog      = useDialog();
  const { state }   = useLocation();
  const { userId: studentId } = useParams();
  const [freshStudent, setFreshStudent] = useState(null);
  const student     = freshStudent || state?.student || null;
  const roadmap     = state?.roadmap     || {};
  const slackPhotos = state?.slackPhotos || {};
  const [tab, setTab]           = useState('overview');
  const [memberStatus, setMemberStatus] = useState(student?.member_status || 'active');
  const [cadence, setCadence]         = useState(student?.checkin_cadence_days ?? 14);
  const [enrolledAt, setEnrolledAt]   = useState(student?.enrolled_at ? student.enrolled_at.slice(0, 10) : '');
  const [adminRank, setAdminRank]     = useState(student?.admin_rank || null);
  const [adminNotes, setAdminNotes]   = useState(student?.admin_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingCadence, setSavingCadence]     = useState(false);
  const [savingEnrolled, setSavingEnrolled]   = useState(false);
  const [savingRank, setSavingRank]           = useState(false);
  const [saving, setSaving]     = useState(false);

  // Always re-fetch fresh data so new submissions appear without needing to reload the grid
  useEffect(() => {
    if (!studentId) return;
    fetch('/api/admin/students', { headers: { 'x-admin-id': ADMIN_ID || '' } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.students) return;
        const found = data.students.find(s => s.id === studentId);
        if (found) {
          setFreshStudent(found);
          setMemberStatus(found.member_status || 'active');
          setCadence(found.checkin_cadence_days ?? 14);
          setEnrolledAt(found.enrolled_at ? found.enrolled_at.slice(0, 10) : '');
          setAdminRank(found.admin_rank || null);
          setAdminNotes(found.admin_notes || '');
        }
      })
      .catch(() => {});
  }, [studentId]);

  if (!student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
        <p style={{ color: muted, fontSize: '0.875rem' }}>לא נמצאו נתונים</p>
        <button onClick={() => navigate('/admin/members')}
          style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border, color: dim, cursor: 'pointer', fontSize: '0.875rem' }}>← חזרה לתלמידים</button>
      </div>
    );
  }

  const photoSrc      = student.email ? (slackPhotos[student.email.toLowerCase()] || student.image_url) : student.image_url;
  const sm            = STATUS_META[memberStatus] || STATUS_META.active;
  const effectiveRank = adminRank || student.auto_rank || student.latest_rank || null;
  const rankColor     = RANK_COLORS[effectiveRank] || '#9ca3af';

  async function saveAdminNotes(notes) {
    setSavingNotes(true);
    try {
      await fetch(`/api/admin/students/${student.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ admin_notes: notes }),
      });
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveAdminRank(rank) {
    setSavingRank(true);
    try {
      await fetch(`/api/admin/students/${student.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ admin_rank: rank }),
      });
      setAdminRank(rank);
    } finally {
      setSavingRank(false);
    }
  }

  async function saveEnrolledAt(date) {
    setSavingEnrolled(true);
    try {
      await fetch(`/api/admin/students/${student.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ enrolled_at: date }),
      });
      setEnrolledAt(date);
    } finally {
      setSavingEnrolled(false);
    }
  }

  async function saveCadence(days) {
    setSavingCadence(true);
    try {
      await fetch(`/api/admin/students/${student.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ checkin_cadence_days: Number(days) }),
      });
      setCadence(Number(days));
    } finally {
      setSavingCadence(false);
    }
  }

  async function saveStatus(newStatus) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/students/${student.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ member_status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        await dialog.alert(`שגיאה בשמירה: ${err.error || res.status}`);
        return;
      }
      setMemberStatus(newStatus);
    } catch (e) {
      await dialog.alert(`שגיאה: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" style={{ padding: '24px 28px', maxWidth: 1080, margin: '0 auto' }}>

      {/* Back */}
      <button onClick={() => navigate('/admin/members')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: '0.875rem', marginBottom: 20, padding: 0 }}>
        <ArrowRight size={13} />
        חזרה לתלמידים
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: border }}>
        {/* Photo */}
        <div style={{ width: 88, height: 88, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border }}>
          <Photo name={student.name} src={photoSrc} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', margin: 0 }}>{student.name}</h1>
            <StatusPicker value={memberStatus} onChange={saveStatus} saving={saving} />
            <RankPicker value={adminRank} autoRank={student.auto_rank || student.latest_rank} onChange={saveAdminRank} saving={savingRank} />
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            {student.email && <span style={{ fontSize: '0.75rem', color: muted }}>{student.email}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: muted }}>
              הצטרף
              <input
                type="date"
                value={enrolledAt}
                onChange={e => setEnrolledAt(e.target.value)}
                onBlur={e => { if (e.target.value) saveEnrolledAt(e.target.value); }}
                disabled={savingEnrolled}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'white', fontSize: '0.75rem', padding: '2px 6px', cursor: 'pointer', colorScheme: 'dark' }}
              />
              {savingEnrolled && <span style={{ fontSize: '0.625rem', color: muted }}>שומר...</span>}
            </span>
            {student.total_paid  && <span style={{ fontSize: '0.75rem', color: '#4fc38a', fontWeight: 700 }}>שילם {fmt(student.total_paid)}</span>}
          </div>
        </div>

        {/* Membership box */}
        {(() => {
          const trackedDeals = (student.deals || []).filter(d => (d.created_at || '') >= '2025-12');
          const totalIncome = trackedDeals.reduce((s, d) => s + num(d.total_amount), 0);
          return (
            <div style={{ flexShrink: 0, padding: '14px 18px', borderRadius: 10, border, minWidth: 160 }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>סה״כ מאז הצטרפות</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F5C118', margin: '0 0 4px' }}>{fmt(totalIncome)}</p>
              <p style={{ fontSize: '0.75rem', color: muted, margin: 0 }}>{trackedDeals.length} עסקאות (דצמבר 25 →)</p>
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: border }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: '9px 18px', fontSize: '0.875rem', fontWeight: tab === t.k ? 700 : 500, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${tab === t.k ? '#F5C118' : 'transparent'}`,
              color: tab === t.k ? '#F5C118' : muted,
              marginBottom: -1, transition: 'all 0.12s' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && <OverviewTab student={student} adminNotes={adminNotes} setAdminNotes={setAdminNotes} saveAdminNotes={saveAdminNotes} savingNotes={savingNotes} />}
      {tab === 'monthly'  && <MonthlyTab  student={student} />}
      {tab === 'wins'       && <WinsTab       student={student} />}
      {tab === 'deals'      && <DealsTab      student={student} />}
      {tab === 'attendance'  && <AttendanceTab  student={student} />}
      {tab === 'confidence'  && <ConfidenceTab  student={student} />}
      {tab === 'roadmap'    && <RoadmapTab    student={student} roadmap={roadmap} />}
    </div>
  );
}
