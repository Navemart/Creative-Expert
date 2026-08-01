import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';
import { useDialog } from '../components/Dialog.jsx';

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
  { k: 'overview', l: 'סקירה' },
  { k: 'monthly',  l: 'נתונים חודשיים' },
  { k: 'wins',     l: 'נצחונות' },
  { k: 'deals',    l: 'עסקאות' },
  { k: 'roadmap',  l: 'רודמאפ' },
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
      background: 'rgba(255,255,255,0.06)', fontSize: '1.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)' }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ── Stat tile (like Scale20's big numbers) ─────────────────────
function Stat({ label, value, sub, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontSize: '0.6875rem', color: muted, margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: '1.625rem', fontWeight: 900, color: valueColor || white, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.6875rem', color: muted, margin: 0 }}>{sub}</p>}
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
function OverviewTab({ student }) {
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
                      <span style={{ fontSize: '0.8125rem', color: white }}>{fmtMonth(m.month)}</span>
                      {m.current_rank && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: RANK_COLORS[m.current_rank] || muted, background: (RANK_COLORS[m.current_rank] || muted) + '18', padding: '1px 7px', borderRadius: 10 }}>{m.current_rank}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 20, textAlign: 'left' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#F5C118' }}>{fmt(inc)}</span>
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
                  <p style={{ fontSize: '0.6875rem', color: muted, margin: '0 0 4px', fontWeight: 600 }}>{l}</p>
                  <p style={{ fontSize: '0.8125rem', color: dim, lineHeight: 1.6, margin: 0 }}>{v}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Right column: admin notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="הערות אדמין" action={<span style={{ fontSize: '0.625rem', color: muted }}>פרטי — התלמיד לא רואה</span>}>
          <textarea placeholder="הוסף הערות על התלמיד — הקשר משיחות, דברים למעקב, דגלים פנימיים..."
            style={{ width: '100%', minHeight: 180, background: 'transparent', border: 'none', outline: 'none', color: dim, fontSize: '0.8125rem', lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }} />
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

// ── Tab: נתונים חודשיים ────────────────────────────────────────
function MonthlyTab({ student }) {
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
        <span style={{ fontSize: '0.6875rem', color: muted }}>{submittedCount} / {expectedCount} הוגשו</span>
      </div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(8, 1fr)', padding: '9px 18px', borderBottom: border, background: 'rgba(255,255,255,0.015)' }}>
        {COLS.map(c => <span key={c} style={{ fontSize: '0.625rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</span>)}
      </div>
      {rows.map(({ key: m, hasSub, isOverdue }, i) => {
        const sub    = subMap[m];
        const missing = !hasSub && isOverdue;
        const income = sub ? num(sub.total_income || sub.amount) : 0;
        const exp    = sub ? num(sub.software_expenses) + num(sub.variable_expenses) + num(sub.paid_ads) : 0;
        const net    = income - exp;
        const rc     = RANK_COLORS[sub?.current_rank] || muted;

        return (
          <div key={m} style={{ display: 'grid', gridTemplateColumns: '150px repeat(8, 1fr)', padding: '12px 18px', borderBottom: i < rows.length - 1 ? border : 'none', background: missing ? 'rgba(239,68,68,0.03)' : 'transparent', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: missing ? 'rgba(239,68,68,0.55)' : white }}>{fmtMonth(m)}</span>
            {missing
              ? <span style={{ fontSize: '0.75rem', color: 'rgba(239,68,68,0.4)', gridColumn: '2 / -1' }}>לא הוגש</span>
              : <>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#F5C118' }}>{fmt(income)}</span>
                  <span style={{ fontSize: '0.8125rem', color: dim }}>{fmt(exp)}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: net >= 0 ? '#4fc38a' : '#ff5a72' }}>{fmt(net)}</span>
                  <span style={{ fontSize: '0.8125rem', color: dim }}>{sub.leads ?? '—'}</span>
                  <span style={{ fontSize: '0.8125rem', color: dim }}>{sub.sales_calls_showed ?? '—'}</span>
                  <span style={{ fontSize: '0.8125rem', color: dim }}>{sub.closings_count ?? '—'}</span>
                  <span style={{ fontSize: '0.8125rem', color: dim }}>{sub.followers != null ? Number(sub.followers).toLocaleString('he-IL') : '—'}</span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: rc }}>{sub.current_rank || '—'}</span>
                </>
            }
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: נצחונות ───────────────────────────────────────────────
function WinsTab({ student }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  // Build all Sundays since enrolled_at up to this week
  const enrolledAt = student.enrolled_at || student.created_at;
  const weeks = useMemo(() => {
    if (!enrolledAt) return [];
    const result = [];
    const start = new Date(enrolledAt);
    start.setHours(0, 0, 0, 0);
    // Advance to the next Sunday on or after enrolled_at
    const day = start.getDay();
    if (day !== 0) start.setDate(start.getDate() + (7 - day));
    const now = new Date();
    const thisWeekSunday = new Date(now);
    thisWeekSunday.setDate(now.getDate() - now.getDay());
    thisWeekSunday.setHours(0, 0, 0, 0);
    let cur = new Date(start);
    while (cur <= thisWeekSunday) {
      result.push(cur.toISOString().slice(0, 10));
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 7);
    }
    return result.reverse(); // newest first
  }, [enrolledAt]);

  const winsByDate = useMemo(() => {
    const map = {};
    for (const w of student.wins || []) {
      const key = (w.week_date || w.submitted_at || '').slice(0, 10);
      if (key) map[key] = w;
    }
    return map;
  }, [student.wins]);

  // Find closest win for a given Sunday key
  function findWin(sundayKey) {
    if (winsByDate[sundayKey]) return winsByDate[sundayKey];
    // Also check ±1 day tolerance
    const d = new Date(sundayKey);
    for (let delta = -1; delta <= 1; delta++) {
      const t = new Date(d); t.setDate(t.getDate() + delta);
      const k = t.toISOString().slice(0, 10);
      if (winsByDate[k]) return winsByDate[k];
    }
    return null;
  }

  const submitted = (student.wins || []).length;
  const total = weeks.length;

  const thStyle = {
    padding: '10px 14px', fontSize: '0.6875rem', fontWeight: 700, color: muted,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    textAlign: 'right', background: 'rgba(255,255,255,0.02)',
    borderBottom: border, whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '11px 14px', fontSize: '0.8125rem', verticalAlign: 'top', textAlign: 'right' };
  const truncate = (s, n = 55) => s && s.length > n ? s.slice(0, n) + '…' : s;

  return (
    <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: border, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
          נצחונות שבועיים
        </p>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: muted }}>{submitted} / {total}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 120 }}>שבוע</th>
              <th style={thStyle}>נצחון ראשי</th>
              <th style={{ ...thStyle, width: 220 }}>פוקוס שבוע הבא</th>
              <th style={{ ...thStyle, width: 200 }}>חוסם</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((weekKey, i) => {
              const win = findWin(weekKey);
              const missed = !win;
              const isExp = expandedIdx === i;
              const rowBg = missed
                ? 'rgba(239,68,68,0.07)'
                : isExp ? 'rgba(245,193,24,0.06)' : 'transparent';
              const textColor = missed ? 'rgba(239,68,68,0.55)' : white;

              return (
                <>
                  <tr
                    key={weekKey}
                    onClick={() => !missed && setExpandedIdx(isExp ? null : i)}
                    style={{
                      background: rowBg, cursor: missed ? 'default' : 'pointer',
                      borderBottom: (isExp && !missed) ? 'none' : border,
                      borderRight: missed ? '3px solid rgba(239,68,68,0.5)' : isExp ? '3px solid rgba(245,193,24,0.5)' : '3px solid transparent',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!missed) e.currentTarget.style.background = isExp ? 'rgba(245,193,24,0.08)' : 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                  >
                    <td style={{ ...tdStyle, color: missed ? 'rgba(239,68,68,0.7)' : muted, fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(weekKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ ...tdStyle, color: textColor }}>
                      {missed ? 'No submission' : truncate(win.win_1)}
                    </td>
                    <td style={{ ...tdStyle, color: dim, fontSize: '0.75rem' }}>
                      {!missed && truncate(win.focus_next_week, 50)}
                    </td>
                    <td style={{ ...tdStyle, color: dim, fontSize: '0.75rem' }}>
                      {!missed && truncate(win.blocker, 45)}
                    </td>
                  </tr>
                  {isExp && win && (
                    <tr key={weekKey + '_exp'} style={{ background: 'rgba(245,193,24,0.04)', borderBottom: border }}>
                      <td colSpan={4} style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {[['נצחון 1', win.win_1], ['נצחון 2', win.win_2], ['נצחון 3', win.win_3], ['פוקוס שבוע הבא', win.focus_next_week], ['חוסם', win.blocker]]
                            .filter(([, v]) => v)
                            .map(([l, v]) => (
                              <div key={l} style={{ display: 'flex', gap: 14 }}>
                                <span style={{ fontSize: '0.6875rem', color: muted, flexShrink: 0, minWidth: 120, fontWeight: 700, paddingTop: 2 }}>{l}</span>
                                <span style={{ fontSize: '0.8125rem', color: white, lineHeight: 1.6 }}>{v}</span>
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
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4fc38a' }}>סה״כ {fmt(total)}</span>
      </div>
      {deals.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < deals.length - 1 ? border : 'none' }}>
          <div>
            <p style={{ fontSize: '0.8125rem', color: white, margin: '0 0 4px', fontWeight: 600 }}>{d.notes || 'עסקה'}</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '0.6875rem', color: muted }}>{fmtDate(d.created_at)}</span>
              {d.next_rank && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: RANK_COLORS[d.next_rank] || muted }}>→ {d.next_rank}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '1rem', fontWeight: 900, color: '#4fc38a', margin: 0 }}>{fmt(d.total_amount)}</p>
            {d.received_amount && <p style={{ fontSize: '0.6875rem', color: muted, margin: '2px 0 0' }}>נכנס: {fmt(d.received_amount)}</p>}
          </div>
        </div>
      ))}
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
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: white }}>{totalDone}/{allTasks.length} ({totalPct}%)</span>
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
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: white }}>{phase.title}</span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: pDone === pTasks.length && pTasks.length > 0 ? '#4fc38a' : muted, fontWeight: 600 }}>
                  {pDone}/{pTasks.length}
                </span>
              </button>

              {isOpen && weeks.map((week, wi) => {
                const tasks = [...(tasksMap[week.id] || [])].sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <div key={week.id} style={{ borderTop: border, padding: '10px 16px 12px 28px' }}>
                    <p style={{ fontSize: '0.6875rem', color: muted, margin: '0 0 8px', fontWeight: 600 }}>{week.title}</p>
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
  return <div style={{ padding: '60px 0', textAlign: 'center', color: muted, fontSize: '0.8125rem' }}>{text}</div>;
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
        }
      })
      .catch(() => {});
  }, [studentId]);

  if (!student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
        <p style={{ color: muted, fontSize: '0.8125rem' }}>לא נמצאו נתונים</p>
        <button onClick={() => navigate('/admin/members')}
          style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border, color: dim, cursor: 'pointer', fontSize: '0.8125rem' }}>← חזרה לתלמידים</button>
      </div>
    );
  }

  const photoSrc      = student.email ? (slackPhotos[student.email.toLowerCase()] || student.image_url) : student.image_url;
  const sm            = STATUS_META[memberStatus] || STATUS_META.active;
  const effectiveRank = adminRank || student.auto_rank || student.latest_rank || null;
  const rankColor     = RANK_COLORS[effectiveRank] || '#9ca3af';

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
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: '0.8125rem', marginBottom: 20, padding: 0 }}>
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
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', margin: 0 }}>{student.name}</h1>
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
              <p style={{ fontSize: '1.375rem', fontWeight: 900, color: '#F5C118', margin: '0 0 4px' }}>{fmt(totalIncome)}</p>
              <p style={{ fontSize: '0.6875rem', color: muted, margin: 0 }}>{trackedDeals.length} עסקאות (דצמבר 25 →)</p>
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: border }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: '9px 18px', fontSize: '0.8125rem', fontWeight: tab === t.k ? 700 : 500, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${tab === t.k ? '#F5C118' : 'transparent'}`,
              color: tab === t.k ? '#F5C118' : muted,
              marginBottom: -1, transition: 'all 0.12s' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && <OverviewTab student={student} />}
      {tab === 'monthly'  && <MonthlyTab  student={student} />}
      {tab === 'wins'     && <WinsTab     student={student} />}
      {tab === 'deals'    && <DealsTab    student={student} />}
      {tab === 'roadmap'  && <RoadmapTab  student={student} roadmap={roadmap} />}
    </div>
  );
}
