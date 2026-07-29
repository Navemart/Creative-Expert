import { useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';

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
  if (v >= 1000) return `₪${Math.round(v / 1000)}K`;
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
      background: 'rgba(255,255,255,0.06)', fontSize: 28, fontWeight: 900, color: 'rgba(255,255,255,0.2)' }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ── Stat tile (like Scale20's big numbers) ─────────────────────
function Stat({ label, value, sub, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontSize: 11, color: muted, margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 900, color: valueColor || white, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: muted, margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: border, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{title}</p>
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
                      <span style={{ fontSize: 13, color: white }}>{fmtMonth(m.month)}</span>
                      {m.current_rank && <span style={{ fontSize: 10, fontWeight: 700, color: RANK_COLORS[m.current_rank] || muted, background: (RANK_COLORS[m.current_rank] || muted) + '18', padding: '1px 7px', borderRadius: 10 }}>{m.current_rank}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 20, textAlign: 'left' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#F5C118' }}>{fmt(inc)}</span>
                      <span style={{ fontSize: 12, color: net >= 0 ? '#4fc38a' : '#ff5a72', fontWeight: 600 }}>{fmt(net)} נטו</span>
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
                  <p style={{ fontSize: 11, color: muted, margin: '0 0 4px', fontWeight: 600 }}>{l}</p>
                  <p style={{ fontSize: 13, color: dim, lineHeight: 1.6, margin: 0 }}>{v}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Right column: admin notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="הערות אדמין" action={<span style={{ fontSize: 10, color: muted }}>פרטי — התלמיד לא רואה</span>}>
          <textarea placeholder="הוסף הערות על התלמיד — הקשר משיחות, דברים למעקב, דגלים פנימיים..."
            style={{ width: '100%', minHeight: 180, background: 'transparent', border: 'none', outline: 'none', color: dim, fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }} />
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

  const allMonths = useMemo(() => {
    if (!student.enrolled_at) return sorted.map(s => s.month?.slice(0, 7)).filter(Boolean);
    const start = new Date(student.enrolled_at);
    const end   = new Date();
    const months = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return months.reverse();
  }, [student.enrolled_at]);

  const subMap = useMemo(() => {
    const m = {};
    (student.monthly || []).forEach(s => { if (s.month) m[s.month.slice(0, 7)] = s; });
    return m;
  }, [student.monthly]);

  const COLS = ['חודש', 'הכנסה', 'הוצאות', 'רווח נטו', 'לידים', 'הגיעו', 'נסגרו', 'עוקבים', 'דרגה'];

  return (
    <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderBottom: border, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>נתונים חודשיים</p>
        <span style={{ fontSize: 11, color: muted }}>{sorted.length} / {allMonths.length} הוגשו</span>
      </div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(8, 1fr)', padding: '9px 18px', borderBottom: border, background: 'rgba(255,255,255,0.015)' }}>
        {COLS.map(c => <span key={c} style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</span>)}
      </div>
      {allMonths.map((m, i) => {
        const sub     = subMap[m];
        const missing = !sub;
        const income  = sub ? num(sub.total_income || sub.amount) : 0;
        const exp     = sub ? num(sub.software_expenses) + num(sub.variable_expenses) + num(sub.paid_ads) : 0;
        const net     = income - exp;
        const rc      = RANK_COLORS[sub?.current_rank] || muted;

        return (
          <div key={m} style={{ display: 'grid', gridTemplateColumns: '150px repeat(8, 1fr)', padding: '12px 18px', borderBottom: i < allMonths.length - 1 ? border : 'none', background: missing ? 'rgba(239,68,68,0.03)' : 'transparent', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: missing ? 'rgba(239,68,68,0.55)' : white }}>{fmtMonth(m)}</span>
            {missing
              ? <span style={{ fontSize: 12, color: 'rgba(239,68,68,0.4)', gridColumn: '2 / -1' }}>לא הוגש</span>
              : <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F5C118' }}>{fmt(income)}</span>
                  <span style={{ fontSize: 13, color: dim }}>{fmt(exp)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: net >= 0 ? '#4fc38a' : '#ff5a72' }}>{fmt(net)}</span>
                  <span style={{ fontSize: 13, color: dim }}>{sub.leads ?? '—'}</span>
                  <span style={{ fontSize: 13, color: dim }}>{sub.sales_calls_showed ?? '—'}</span>
                  <span style={{ fontSize: 13, color: dim }}>{sub.closings_count ?? '—'}</span>
                  <span style={{ fontSize: 13, color: dim }}>{sub.followers != null ? Number(sub.followers).toLocaleString('he-IL') : '—'}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: rc }}>{sub.current_rank || '—'}</span>
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
  const wins = [...(student.wins || [])].sort((a, b) => (b.week_date || '').localeCompare(a.week_date || ''));
  if (!wins.length) return <Empty text="אין נצחונות שבועיים עדיין" />;
  return (
    <div style={{ borderRadius: 12, border, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: border, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>נצחונות שבועיים — {wins.length} דיווחים</p>
      </div>
      {wins.map((w, i) => (
        <div key={i} style={{ padding: '16px 18px', borderBottom: i < wins.length - 1 ? border : 'none' }}>
          <p style={{ fontSize: 11, color: muted, margin: '0 0 10px', fontWeight: 600 }}>{fmtDate(w.week_date)}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['נצחון 1', w.win_1], ['נצחון 2', w.win_2], ['נצחון 3', w.win_3], ['פוקוס שבוע הבא', w.focus_next_week], ['חוסם', w.blocker]].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 11, color: muted, flexShrink: 0, minWidth: 100, fontWeight: 600, paddingTop: 1 }}>{l}</span>
                <span style={{ fontSize: 13, color: dim, lineHeight: 1.5 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
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
        <p style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>עסקאות — {deals.length}</p>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#4fc38a' }}>סה״כ {fmt(total)}</span>
      </div>
      {deals.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < deals.length - 1 ? border : 'none' }}>
          <div>
            <p style={{ fontSize: 13, color: white, margin: '0 0 4px', fontWeight: 600 }}>{d.notes || 'עסקה'}</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: muted }}>{fmtDate(d.created_at)}</span>
              {d.next_rank && <span style={{ fontSize: 10, fontWeight: 700, color: RANK_COLORS[d.next_rank] || muted }}>→ {d.next_rank}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#4fc38a', margin: 0 }}>{fmt(d.total_amount)}</p>
            {d.received_amount && <p style={{ fontSize: 11, color: muted, margin: '2px 0 0' }}>נכנס: {fmt(d.received_amount)}</p>}
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
          <span style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>התקדמות כללית</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: white }}>{totalDone}/{allTasks.length} ({totalPct}%)</span>
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: white }}>{phase.title}</span>
                </div>
                <span style={{ fontSize: 11, color: pDone === pTasks.length && pTasks.length > 0 ? '#4fc38a' : muted, fontWeight: 600 }}>
                  {pDone}/{pTasks.length}
                </span>
              </button>

              {isOpen && weeks.map((week, wi) => {
                const tasks = [...(tasksMap[week.id] || [])].sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <div key={week.id} style={{ borderTop: border, padding: '10px 16px 12px 28px' }}>
                    <p style={{ fontSize: 11, color: muted, margin: '0 0 8px', fontWeight: 600 }}>{week.title}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {tasks.map(task => {
                        const done = completions.has(task.id);
                        return (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {done
                              ? <CheckSquare size={13} style={{ color: '#4fc38a', flexShrink: 0 }} />
                              : <Square size={13} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />}
                            <span style={{ fontSize: 12, color: done ? dim : 'rgba(255,255,255,0.3)' }}>{task.title}</span>
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
  return <div style={{ padding: '60px 0', textAlign: 'center', color: muted, fontSize: 13 }}>{text}</div>;
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
        <span style={{ fontSize: 12, fontWeight: 700, color: cur.color }}>{saving ? 'שומר...' : cur.label}</span>
        <ChevronDown size={11} style={{ color: cur.color + '80' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'rgb(var(--bg-chrome))', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, minWidth: 130, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', zIndex: 200, overflow: 'hidden' }}>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }}
              style={{ width: '100%', textAlign: 'right', padding: '10px 14px', fontSize: 12, fontWeight: 700, color: v.color, background: k === value ? v.color + '12' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
  const { state }   = useLocation();
  const student     = state?.student     || null;
  const roadmap     = state?.roadmap     || null;
  const slackPhotos = state?.slackPhotos || {};
  const [tab, setTab]           = useState('overview');
  const [memberStatus, setMemberStatus] = useState(student?.member_status || 'active');
  const [cadence, setCadence]   = useState(student?.checkin_cadence_days ?? 14);
  const [savingCadence, setSavingCadence] = useState(false);
  const [saving, setSaving]     = useState(false);

  if (!student) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
        <p style={{ color: muted, fontSize: 13 }}>לא נמצאו נתונים</p>
        <button onClick={() => navigate('/admin/members')}
          style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border, color: dim, cursor: 'pointer', fontSize: 13 }}>← חזרה לתלמידים</button>
      </div>
    );
  }

  const photoSrc  = student.email ? (slackPhotos[student.email.toLowerCase()] || student.image_url) : student.image_url;
  const sm        = STATUS_META[memberStatus] || STATUS_META.active;
  const rankColor = RANK_COLORS[student.latest_rank] || '#9ca3af';

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
        alert(`שגיאה בשמירה: ${err.error || res.status}`);
        return;
      }
      setMemberStatus(newStatus);
    } catch (e) {
      alert(`שגיאה: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" style={{ padding: '24px 28px', maxWidth: 1080, margin: '0 auto' }}>

      {/* Back */}
      <button onClick={() => navigate('/admin/members')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 13, marginBottom: 20, padding: 0 }}>
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
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0 }}>{student.name}</h1>
            <StatusPicker value={memberStatus} onChange={saveStatus} saving={saving} />
            {student.latest_rank && (
              <span style={{ fontSize: 10, fontWeight: 700, color: rankColor, background: rankColor + '18', border: `1px solid ${rankColor}30`, padding: '3px 9px', borderRadius: 20 }}>
                {student.latest_rank}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            {student.email      && <span style={{ fontSize: 12, color: muted }}>{student.email}</span>}
            {student.enrolled_at && <span style={{ fontSize: 12, color: muted }}>הצטרף {fmtDate(student.enrolled_at)}</span>}
            {student.total_paid  && <span style={{ fontSize: 12, color: '#4fc38a', fontWeight: 700 }}>שילם {fmt(student.total_paid)}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: muted }}>
              צ׳קאין כל
              <select
                value={cadence}
                onChange={e => saveCadence(e.target.value)}
                disabled={savingCadence}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'white', fontSize: 12, padding: '2px 6px', cursor: 'pointer' }}
              >
                {[7, 10, 14, 21, 30].map(d => <option key={d} value={d}>{d} ימים</option>)}
              </select>
              {savingCadence && <span style={{ fontSize: 10, color: muted }}>שומר...</span>}
            </span>
          </div>
        </div>

        {/* Membership box */}
        {(() => {
          const trackedDeals = (student.deals || []).filter(d => (d.created_at || '') >= '2025-12');
          const totalIncome = trackedDeals.reduce((s, d) => s + num(d.total_amount), 0);
          return (
            <div style={{ flexShrink: 0, padding: '14px 18px', borderRadius: 10, border, minWidth: 160 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>סה״כ מאז הצטרפות</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#F5C118', margin: '0 0 4px' }}>{fmt(totalIncome)}</p>
              <p style={{ fontSize: 11, color: muted, margin: 0 }}>{trackedDeals.length} עסקאות (דצמבר 25 →)</p>
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: border }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: tab === t.k ? 700 : 500, background: 'none', border: 'none', cursor: 'pointer',
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
