import { useState, useEffect, useMemo, useRef } from 'react';
import { useTrackPage } from '../hooks/useTrack.js';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import {
  Loader2, TrendingUp, Users, Target, FileText, DollarSign,
  BarChart3, AlertCircle, CheckCircle2, Clock, Smartphone,
  ArrowUpRight, ArrowDownRight, Minus, Pencil, Check, X,
  ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, ComposedChart, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

// ── Helpers ─────────────────────────────────────────────────────
const MONTH_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
function fmtMonth(d)  { if (!d) return '—'; const dt = new Date(d); return `${MONTH_HE[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`; }
function shortMonth(d){ if (!d) return ''; const dt = new Date(d); return MONTH_HE[dt.getUTCMonth()].slice(0, 3); }
function fmtILS(n)    { const v = Number(n); if (!v && v !== 0) return '—'; if (v >= 1_000_000) return `₪${(v/1_000_000).toFixed(1)}M`; if (v >= 1_000) return `₪${Math.round(v/1_000)}K`; return '₪'+Math.round(v).toLocaleString('he-IL'); }
function fmtFull(n)   { const v = Number(n); if (isNaN(v) || v === 0) return '—'; const abs = Math.abs(Math.round(v)).toLocaleString('he-IL'); return v < 0 ? `-₪${abs}` : `₪${abs}`; }
function fmtFullZero(n){ const v = Number(n); if (isNaN(v)) return '—'; const abs = Math.abs(Math.round(v)).toLocaleString('he-IL'); return v < 0 ? `-₪${abs}` : `₪${abs}`; }
function num(v)       { const n = Number(v); return isNaN(n) ? 0 : n; }
function fmtDate(d)   { if (!d) return '—'; return new Date(d).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'2-digit' }); }

function computeClientPaid(c) {
  const plan = c.installment_plan;
  if (plan?.length) return plan.filter(i => i.paid).reduce((s,i) => s + Math.round((parseFloat(i.percentage)||0)/100*(c.deal_amount||0)), 0);
  return c.paid_amount || 0;
}

// ── Metrics config ───────────────────────────────────────────────
const METRICS = [
  { key: 'deals',         label: 'כסף בעסקאות חדשות', color: '#F5C118',  format: 'ils' },
  { key: 'income',        label: 'הכנסה בפועל',        color: '#4ade80',  format: 'ils' },
  { key: 'expenses',      label: 'הוצאות',              color: '#f87171',  format: 'ils' },
  { key: 'netProfit',     label: 'רווח נטו',            color: '#34d399',  format: 'ils' },
  { key: 'newClients',    label: 'לקוחות חדשים',        color: '#818cf8',  format: 'count' },
  { key: 'activeClients', label: 'לקוחות פעילים',       color: '#38bdf8',  format: 'count' },
];

// ── Chart shared ────────────────────────────────────────────────
const GRID   = <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />;
const XAXIS  = (data) => <XAxis dataKey="month" tick={{ fill:'rgba(255,255,255,0.28)', fontSize:'0.6875rem' }} axisLine={false} tickLine={false} />;

// ── Tabs ────────────────────────────────────────────────────────
const TABS = [
  { k:'overview',  l:'סקירה כללית' },
  { k:'sales',     l:'מכירות' },
  { k:'clients',   l:'לקוחות ופרויקטים' },
  { k:'content',   l:'תוכן' },
];
function TabsBar({ value, onChange }) {
  return (
    <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor:'rgba(255,255,255,0.08)', scrollbarWidth:'none' }}>
      {TABS.map(t => (
        <button key={t.k} onClick={() => onChange(t.k)}
          className="pb-3 px-3 sm:px-4 text-sm sm:text-base font-semibold transition-all relative flex-none"
          style={{ color: value===t.k ? 'white' : 'rgba(255,255,255,0.35)' }}>
          {t.l}
          {value===t.k && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background:'#F5C118' }} />}
        </button>
      ))}
    </div>
  );
}

// ── Range picker (for sales/clients/content tabs) ───────────────
const RANGES = [{ k:'3m', l:'3M' }, { k:'6m', l:'6M' }, { k:'12m', l:'12M' }];
function RangePicker({ value, onChange }) {
  return (
    <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
      {RANGES.map(r => (
        <button key={r.k} onClick={() => onChange(r.k)}
          className="rounded-md px-3 py-1 text-xs font-bold transition-all"
          style={{ background: value===r.k ? 'rgba(255,255,255,0.12)' : 'transparent', color: value===r.k ? 'white' : 'rgba(255,255,255,0.32)' }}>
          {r.l}
        </button>
      ))}
    </div>
  );
}

// ── Section card ────────────────────────────────────────────────
function Section({ title, sub, right, children, noPad }) {
  return (
    <div className="rounded-2xl" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
      <div className={`flex items-center justify-between ${noPad ? 'px-5 pt-5' : 'px-5 pt-5'}`}>
        <div>
          <h2 className="text-base font-bold text-white">{title}</h2>
          {sub && <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.28)' }}>{sub}</p>}
        </div>
        {right}
      </div>
      <div className={noPad ? 'pt-4' : 'p-5 pt-4'}>{children}</div>
    </div>
  );
}

// ── Funnel bar ──────────────────────────────────────────────────
function FunnelRow({ label, value, total, color, sub }) {
  const pct = total > 0 ? Math.min(100, Math.round(value/total*100)) : (value > 0 ? 100 : 0);
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium" style={{ color:'rgba(255,255,255,0.65)' }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color:'rgba(255,255,255,0.35)' }}>{sub}</span>
          <span className="text-base font-bold text-white">{value}</span>
        </div>
      </div>
      <div className="rounded-full h-2" style={{ background:'rgba(255,255,255,0.06)' }}>
        <div className="rounded-full h-2 transition-all duration-500" style={{ width:`${pct}%`, background:color }} />
      </div>
    </div>
  );
}

// ── Main Chart Tooltip ───────────────────────────────────────────
function MainChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-xl px-4 py-3 shadow-xl" style={{ background:'rgba(8,9,22,0.97)', border:'1px solid rgba(255,255,255,0.12)', minWidth:180, direction:'rtl' }}>
      <p className="text-xs font-bold mb-2" style={{ color:'rgba(255,255,255,0.55)' }}>{d?.fullMonth}</p>
      {payload.map(p => {
        const m = METRICS.find(x => x.key === p.dataKey);
        if (p.value == null) return null;
        const val = m?.format === 'ils' ? fmtFull(p.value) : p.value;
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
            <span className="text-[11px]" style={{ color:'rgba(255,255,255,0.45)' }}>{m?.label}</span>
            <span className="text-xs font-bold" style={{ color: p.color }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
export default function Analytics() {
  useTrackPage('נתונים עסקיים');
  const { user }   = useUser();
  const userId     = user?.id;
  const navigate   = useNavigate();

  const [months,        setMonths]        = useState([]);
  const [clients,       setClients]       = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [pipelineLeads, setPipelineLeads] = useState([]);
  const [loading,       setLoading]       = useState(true);

  // Overview state
  const [selectedHeaderMonth, setSelectedHeaderMonth] = useState('');
  const [chartStartMonth,     setChartStartMonth]     = useState('');
  const [chartEndMonth,       setChartEndMonth]       = useState('');
  const [activeMetrics,       setActiveMetrics]       = useState(['income', 'deals']);
  const [chartType,           setChartType]           = useState('line');
  const [metricsOpen,         setMetricsOpen]         = useState(false);
  const metricsRef = useRef(null);

  // Sales/clients/content range pickers
  const [range,      setRange]      = useState('6m');
  const [salesRange, setSalesRange] = useState('6m');
  const [tab,        setTab]        = useState('overview');

  // Desired salary (localStorage)
  const salaryKey = userId ? `desired_salary_${userId}` : null;
  const [desiredSalary,  setDesiredSalary]  = useState(0);
  const [editingSalary,  setEditingSalary]  = useState(false);
  const [salaryDraft,    setSalaryDraft]    = useState('');
  const salaryRef = useRef(null);

  useEffect(() => {
    if (!salaryKey) return;
    const saved = localStorage.getItem(salaryKey);
    if (saved) setDesiredSalary(parseInt(saved, 10) || 0);
  }, [salaryKey]);

  function saveSalary() {
    const v = parseInt(salaryDraft.replace(/[^0-9]/g, ''), 10) || 0;
    setDesiredSalary(v);
    if (salaryKey) localStorage.setItem(salaryKey, String(v));
    setEditingSalary(false);
  }

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      supabase.from('monthly_submissions').select('*').eq('user_id', userId).order('month'),
      supabase.from('clients').select('*').eq('user_id', userId),
      supabase.from('projects').select('*').eq('user_id', userId),
      supabase.from('leads').select('call_status, created_at').eq('user_id', userId),
    ]).then(([{ data:m }, { data:c }, { data:p }, { data:l }]) => {
      setMonths(m || []);
      setClients(c || []);
      setProjects(p || []);
      setPipelineLeads(l || []);
    }).finally(() => setLoading(false));
  }, [userId]);

  // Sorted submissions
  const sorted = useMemo(() => [...months].sort((a,b) => new Date(a.month)-new Date(b.month)), [months]);

  // Available header month options (newest first, from earliest submission to now)
  const availableMonthOptions = useMemo(() => {
    const now = new Date();
    const earliest = sorted[0]?.month?.slice(0, 7);
    if (!earliest) return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
    const opts = [];
    let y = now.getFullYear(), m = now.getMonth() + 1;
    const [sy, sm] = earliest.split('-').map(Number);
    while (y > sy || (y === sy && m >= sm)) {
      opts.push(`${y}-${String(m).padStart(2, '0')}`);
      m--; if (m === 0) { m = 12; y--; }
      if (opts.length > 60) break;
    }
    return opts;
  }, [sorted]);

  // Init: header month = latest submitted, chart range = first → latest submitted
  useEffect(() => {
    if (!months.length) return;
    const earliest = sorted[0]?.month?.slice(0, 7);
    const latest   = sorted[sorted.length - 1]?.month?.slice(0, 7);
    if (latest)   setSelectedHeaderMonth(latest);
    if (earliest) setChartStartMonth(earliest);
    if (latest)   setChartEndMonth(latest);
  }, [months.length]);

  // Close metrics dropdown on outside click
  useEffect(() => {
    if (!metricsOpen) return;
    function handler(e) {
      if (metricsRef.current && !metricsRef.current.contains(e.target)) setMetricsOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [metricsOpen]);

  // Fast lookup: "YYYY-MM" → submission object
  const subMap = useMemo(() => {
    const map = {};
    sorted.forEach(s => { if (s.month) map[s.month.slice(0, 7)] = s; });
    return map;
  }, [sorted]);

  // All months from first to last submission (oldest→newest), used for chart
  const reportingRangeKeys = useMemo(() => {
    if (!sorted.length) return [];
    const firstKey = sorted[0].month?.slice(0, 7);
    const lastKey  = sorted[sorted.length - 1].month?.slice(0, 7);
    if (!firstKey || !lastKey) return [];
    const keys = [];
    let [y, m] = firstKey.split('-').map(Number);
    const [ey, em] = lastKey.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      keys.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
      if (keys.length > 120) break;
    }
    return keys;
  }, [sorted]);

  // Main chart data: one entry per month in reporting range
  // undefined metric values = not submitted (gap in line); numeric 0 = real submitted zero
  const mainChartData = useMemo(() => reportingRangeKeys.map(key => {
    const [ky, km] = key.split('-').map(Number);
    const sub = subMap[key] ?? null;
    const base = {
      month:     MONTH_HE[km - 1].slice(0, 3),
      fullMonth: `${MONTH_HE[km - 1]} ${ky}`,
      monthKey:  key,
      hasData:   sub !== null,
    };
    if (sub === null) return base;
    const income   = num(sub.total_income || sub.amount);
    const expenses = num(sub.software_expenses) + num(sub.variable_expenses) + num(sub.paid_ads);
    return {
      ...base,
      deals:         num(sub.total_new_deals),
      income,
      expenses,
      netProfit:     income - expenses,
      newClients:    num(sub.new_clients),
      activeClients: num(sub.active_clients),
      _sub: sub,
    };
  }), [reportingRangeKeys, subMap]);

  // Chart display data filtered by user's chosen range
  const chartDisplayData = useMemo(() =>
    chartStartMonth && chartEndMonth
      ? mainChartData.filter(r => r.monthKey >= chartStartMonth && r.monthKey <= chartEndMonth)
      : mainChartData,
  [mainChartData, chartStartMonth, chartEndMonth]);

  // ── Table rows: full history from first submission to latest, newest first ──
  const tableRows = useMemo(() => {
    if (!sorted.length) return [];
    const firstKey = sorted[0].month?.slice(0, 7);
    const lastKey  = sorted[sorted.length - 1].month?.slice(0, 7);
    if (!firstKey || !lastKey) return [];
    const rows = [];
    let [y, m] = lastKey.split('-').map(Number);
    const [sy, sm] = firstKey.split('-').map(Number);
    while (y > sy || (y === sy && m >= sm)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      rows.push({ monthKey: key, sub: subMap[key] ?? null, hasData: !!subMap[key] });
      m--; if (m === 0) { m = 12; y--; }
    }
    return rows;
  }, [sorted, subMap]);

  // Current month key
  const nowDate  = new Date();
  const curKey   = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;

  // Latest month (global, for financial health)
  const latest = sorted[sorted.length - 1] ?? null;
  const curIncome  = num(latest?.total_income || latest?.amount);
  const curExp     = num(latest?.software_expenses) + num(latest?.variable_expenses) + num(latest?.paid_ads);
  const curNet     = curIncome - curExp;

  // Outstanding payments
  const outstandingItems = useMemo(() => {
    const items = [];
    clients.forEach(c => {
      const plan = c.installment_plan;
      if (plan?.length) {
        plan.filter(i => !i.paid && (i.amount||i.percentage)).forEach(inst => {
          const amt = inst.amount
            ? parseFloat(inst.amount)
            : Math.round((parseFloat(inst.percentage)||0)/100*(c.deal_amount||0));
          if (amt > 0) items.push({ clientName: c.name||'לקוח', amount: amt, date: inst.date||null, label: inst.label||'תשלום' });
        });
      } else {
        const outstanding = Math.max(0, (c.deal_amount||0) - computeClientPaid(c));
        if (outstanding > 0) items.push({ clientName: c.name||'לקוח', amount: outstanding, date: null, label: 'יתרה' });
      }
    });
    projects.forEach(p => {
      const plan = p.installment_plan;
      if (!plan?.length) return;
      const clientName = clients.find(c => c.id === p.client_id)?.name || p.name || 'פרויקט';
      plan.filter(i => !i.paid && (i.amount || i.percentage)).forEach(inst => {
        const amt = inst.amount
          ? parseFloat(inst.amount)
          : Math.round((parseFloat(inst.percentage)||0)/100*(p.total_amount||0));
        if (amt > 0) items.push({ clientName, amount: amt, date: inst.date||null, label: inst.label || p.name || 'תשלום' });
      });
    });
    return items.sort((a,b) => {
      if (a.date && b.date) return new Date(a.date)-new Date(b.date);
      if (a.date) return -1; if (b.date) return 1; return 0;
    });
  }, [clients, projects]);
  const totalOutstanding = outstandingItems.reduce((s,i)=>s+i.amount,0);

  // ── Sales/clients/content tab data (unchanged logic) ────────
  const rangeN      = range==='3m' ? 3 : range==='6m' ? 6 : 12;
  const slice       = useMemo(() => [...sorted].slice(-rangeN).reverse(), [sorted, rangeN]);
  const salesN      = salesRange==='1m' ? 1 : salesRange==='3m' ? 3 : salesRange==='6m' ? 6 : 12;
  const salesSlice  = useMemo(() => [...sorted].slice(-salesN).reverse(), [sorted, salesN]);

  const currentYear  = new Date().getFullYear();
  const ytdSubs      = sorted.filter(m => new Date(m.month).getUTCFullYear() === currentYear);
  const ytdIncome    = ytdSubs.reduce((s,m) => s + num(m.total_income||m.amount), 0);
  const ytdExp       = ytdSubs.reduce((s,m) => s + num(m.software_expenses) + num(m.variable_expenses) + num(m.paid_ads), 0);
  const ytdNet       = ytdIncome - ytdExp;

  const funnelTotals = useMemo(() => ({
    leads:           slice.reduce((s,m)=>s+num(m.leads),0),
    calls_set:       slice.reduce((s,m)=>s+num(m.sales_calls_set),0),
    calls_showed:    slice.reduce((s,m)=>s+num(m.sales_calls_showed),0),
    proposals:       slice.reduce((s,m)=>s+num(m.proposals),0),
    quotes_sent:     slice.reduce((s,m)=>s+num(m.price_quotes_sent),0),
    quotes_approved: slice.reduce((s,m)=>s+num(m.price_quotes_approved),0),
  }), [slice]);

  const { closingRate, newClientsTotal } = useMemo(() => {
    const hasMonthlyData = slice.some(m => m.closings_count != null);
    let totalClosings = hasMonthlyData
      ? slice.reduce((s,m) => s + num(m.closings_count), 0)
      : pipelineLeads.filter(l => l.call_status === 'נסגר').length;
    const totalCalls = slice.reduce((s,m) => s + num(m.sales_calls_showed), 0);
    const rate = totalCalls > 0 ? Math.min(100, Math.round(totalClosings / totalCalls * 100)) : null;
    return { closingRate: rate, newClientsTotal: totalClosings };
  }, [sorted, slice, pipelineLeads]);

  const convLeadToCall   = funnelTotals.leads > 0 ? Math.round(funnelTotals.calls_set / funnelTotals.leads * 100) : null;
  const convCallToClose  = funnelTotals.calls_showed > 0 ? Math.round(newClientsTotal / funnelTotals.calls_showed * 100) : null;
  const convQuoteToClose = funnelTotals.quotes_sent > 0 ? Math.round(funnelTotals.quotes_approved / funnelTotals.quotes_sent * 100) : null;

  const activeClients = latest ? num(latest.active_clients) : null;

  const ltv = useMemo(() => {
    if (!clients.length) return null;
    const totalRevenue = clients.reduce((s,c) => s + num(c.deal_amount || c.total_amount), 0);
    if (!totalRevenue) return null;
    return Math.round(totalRevenue / clients.length);
  }, [clients]);

  const salesData = useMemo(() => {
    const pipelineByMonth = {};
    pipelineLeads.filter(l => l.call_status === 'נסגר' && l.call_date)
      .forEach(l => { const key = String(l.call_date).substring(0, 7); pipelineByMonth[key] = (pipelineByMonth[key] || 0) + 1; });
    return salesSlice.map(m => {
      const monthKey = m.month ? String(m.month).substring(0, 7) : '';
      const closings = m.closings_count != null ? num(m.closings_count) : (pipelineByMonth[monthKey] || 0);
      return { month: shortMonth(m.month), fullMonth: fmtMonth(m.month), הצעות: num(m.proposals), לידים: num(m.leads), שיחות: num(m.sales_calls_set), סגירות: closings };
    });
  }, [salesSlice, pipelineLeads]);

  const clientData = useMemo(() => slice.map(m => ({ month: shortMonth(m.month), 'לקוחות פעילים': num(m.active_clients) })), [slice]);

  const igData = useMemo(() => slice.map(m => ({ month: shortMonth(m.month), fullLabel: fmtMonth(m.month), עוקבים: num(m.followers), פוסטים: num(m.posts_count) })), [slice]);

  const avgProjectValue = useMemo(() => {
    const p = projects.filter(p => num(p.total_amount) > 0);
    if (!p.length) return null;
    return Math.round(p.reduce((s,p) => s + num(p.total_amount), 0) / p.length);
  }, [projects]);

  // ── Metric toggle ────────────────────────────────────────────
  function toggleMetric(key) {
    setActiveMetrics(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev
        : [...prev, key]
    );
  }

  // ── Loading / empty ───────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 size={26} className="animate-spin" style={{ color:'rgba(255,255,255,0.18)' }} /></div>;
  if (!months.length) return (
    <div className="w-full space-y-6">
      <h1 className="text-3xl font-bold text-white">נתונים עסקיים</h1>
      <div className="rounded-2xl p-16 flex flex-col items-center gap-4" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.08)' }}>
        <BarChart3 size={40} style={{ color:'rgba(255,255,255,0.1)' }} />
        <p className="text-base font-semibold text-white">אין עדיין נתונים</p>
        <p className="text-xs text-center leading-relaxed" style={{ color:'rgba(255,255,255,0.32)' }}>מלא דוח חודשי בדשבורד כדי לראות את הנתונים שלך כאן</p>
        <button onClick={() => navigate('/?openMonthly=1')} className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:opacity-90" style={{ background:'#F5C118', color:'#13152A' }}>עדכן נתוני החודש</button>
      </div>
    </div>
  );

  const border = '1px solid rgba(255,255,255,0.07)';
  const TIP = {
    contentStyle: { background:'rgba(8,9,22,0.97)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, color:'white', fontSize:'0.75rem', direction:'rtl' },
    cursor: { stroke:'rgba(255,255,255,0.07)', strokeWidth:1 },
  };
  const XAXIS_PROPS = { dataKey:'month', tick:{ fill:'rgba(255,255,255,0.28)', fontSize:'0.6875rem' }, axisLine:false, tickLine:false };
  const YILS_PROPS  = { tick:{ fill:'rgba(255,255,255,0.22)', fontSize:'0.75rem' }, axisLine:false, tickLine:false, tickFormatter:v=>v===0?'₪0':`₪${Math.round(v/1000)}K`, width:44 };
  const YCNT_PROPS  = { tick:{ fill:'rgba(255,255,255,0.22)', fontSize:'0.75rem' }, axisLine:false, tickLine:false, allowDecimals:false, width:24 };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div className="w-full space-y-5" dir="rtl">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">נתונים עסקיים</h1>
        <div className="flex items-center gap-2 flex-none">
          {/* Month+year selector */}
          <div className="relative">
            <select
              value={selectedHeaderMonth}
              onChange={e => setSelectedHeaderMonth(e.target.value)}
              className="appearance-none rounded-xl px-4 py-2.5 text-sm font-semibold text-white outline-none cursor-pointer"
              style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', direction:'rtl', minWidth:140, paddingLeft:28 }}
            >
              {availableMonthOptions.map(key => {
                const [y, m] = key.split('-').map(Number);
                return <option key={key} value={key}>{MONTH_HE[m-1]} {y}</option>;
              })}
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color:'rgba(255,255,255,0.3)' }} />
          </div>
          {/* Submit button */}
          <button
            onClick={() => navigate('/?openMonthly=1')}
            className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:opacity-90 whitespace-nowrap"
            style={{ background:'#F5C118', color:'#13152A' }}
          >
            הגשת נתוני חודש
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────── */}
      <TabsBar value={tab} onChange={setTab} />

      {/* ══════════════ TAB: OVERVIEW ══════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-4">

          {/* ① MAIN CHART CARD */}
          <div className="rounded-2xl overflow-hidden" style={{ background:'rgb(var(--bg-surface))', border }}>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 gap-3 flex-wrap sm:flex-nowrap" style={{ borderBottom:'1px solid rgba(255,255,255,0.08)', minHeight:60 }}>

              {/* RIGHT: Metrics dropdown + date range */}
              <div className="flex items-center gap-2 flex-wrap py-3 sm:py-0">

                {/* Metrics multi-select */}
                <div className="relative" ref={metricsRef}>
                  <button
                    onClick={() => setMetricsOpen(v => !v)}
                    className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all"
                    style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'white' }}
                  >
                    מדדים {activeMetrics.length}
                    <ChevronDown size={13} style={{ color:'rgba(255,255,255,0.4)', transform: metricsOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }} />
                  </button>
                  {metricsOpen && (
                    <div className="absolute top-full right-0 mt-1.5 rounded-2xl shadow-2xl z-50 py-1.5 min-w-[210px]"
                      style={{ background:'rgba(10,12,26,0.98)', border:'1px solid rgba(255,255,255,0.12)', direction:'rtl' }}>
                      {METRICS.map(m => {
                        const active = activeMetrics.includes(m.key);
                        return (
                          <button key={m.key} onClick={() => toggleMetric(m.key)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-right transition-all hover:bg-white/5"
                            style={{ color: active ? 'white' : 'rgba(255,255,255,0.45)' }}>
                            <div className="w-3.5 h-3.5 rounded flex items-center justify-center flex-none"
                              style={{ background: active ? m.color : 'transparent', border: `1.5px solid ${active ? m.color : 'rgba(255,255,255,0.2)'}` }}>
                              {active && <Check size={9} strokeWidth={3.5} style={{ color:'#13152A' }} />}
                            </div>
                            <div className="w-2 h-2 rounded-full flex-none" style={{ background: m.color }} />
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Date range */}
                <div className="flex items-center gap-1.5">
                  <select value={chartStartMonth} onChange={e => setChartStartMonth(e.target.value)}
                    className="appearance-none rounded-lg px-2.5 py-2 text-xs font-semibold text-white outline-none cursor-pointer"
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', direction:'rtl' }}>
                    {reportingRangeKeys.map(k => {
                      const [ky, km] = k.split('-').map(Number);
                      return <option key={k} value={k}>{MONTH_HE[km - 1]} {ky}</option>;
                    })}
                  </select>
                  <span className="text-xs" style={{ color:'rgba(255,255,255,0.28)' }}>עד</span>
                  <select value={chartEndMonth} onChange={e => setChartEndMonth(e.target.value)}
                    className="appearance-none rounded-lg px-2.5 py-2 text-xs font-semibold text-white outline-none cursor-pointer"
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', direction:'rtl' }}>
                    {reportingRangeKeys.map(k => {
                      const [ky, km] = k.split('-').map(Number);
                      return <option key={k} value={k}>{MONTH_HE[km - 1]} {ky}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* LEFT: Line / Bar segmented toggle */}
              <div className="flex rounded-xl overflow-hidden flex-none" style={{ border:'1px solid rgba(255,255,255,0.1)' }}>
                {[{ k:'line', l:'קו' }, { k:'bar', l:'עמודות' }].map((t, ti) => (
                  <button key={t.k} onClick={() => setChartType(t.k)}
                    className="px-5 py-2 text-sm font-bold transition-all"
                    style={{
                      background: chartType === t.k ? 'rgba(255,255,255,0.14)' : 'transparent',
                      color: chartType === t.k ? 'white' : 'rgba(255,255,255,0.32)',
                      borderRight: ti === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    }}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="px-4 pt-6 pb-2" dir="ltr">
              <ResponsiveContainer width="100%" height={390}>
                {chartType === 'line' ? (
                  <LineChart data={chartDisplayData} margin={{ top:8, right:12, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis {...XAXIS_PROPS} />
                    <YAxis
                      tick={{ fill:'rgba(255,255,255,0.18)', fontSize:'0.75rem' }}
                      axisLine={false} tickLine={false} width={52}
                      tickFormatter={v => {
                        const hasIls = activeMetrics.some(k => METRICS.find(m=>m.key===k)?.format==='ils');
                        if (!hasIls) return v;
                        return v===0 ? '0' : `₪${Math.round(v/1000)}K`;
                      }}
                    />
                    <Tooltip content={<MainChartTooltip />} />
                    {activeMetrics.map(key => {
                      const m = METRICS.find(x => x.key === key);
                      return (
                        <Line key={key} dataKey={key} stroke={m.color} strokeWidth={2.5}
                          connectNulls={false} type="monotone"
                          dot={{ r:4, fill:m.color, stroke:'rgb(var(--bg-surface))', strokeWidth:2 }}
                          activeDot={{ r:5.5 }} />
                      );
                    })}
                  </LineChart>
                ) : (
                  <BarChart data={chartDisplayData} barGap={2} barCategoryGap="22%" margin={{ top:8, right:12, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis {...XAXIS_PROPS} />
                    <YAxis
                      tick={{ fill:'rgba(255,255,255,0.18)', fontSize:'0.75rem' }}
                      axisLine={false} tickLine={false} width={52}
                      tickFormatter={v => {
                        const hasIls = activeMetrics.some(k => METRICS.find(m=>m.key===k)?.format==='ils');
                        if (!hasIls) return v;
                        return v===0 ? '0' : `₪${Math.round(v/1000)}K`;
                      }}
                    />
                    <Tooltip content={<MainChartTooltip />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
                    {activeMetrics.map(key => {
                      const m = METRICS.find(x => x.key === key);
                      return <Bar key={key} dataKey={key} fill={m.color} radius={[4,4,0,0]} />;
                    })}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Legend — centered below chart */}
            <div className="flex justify-center gap-6 px-5 pb-5 pt-1 flex-wrap" dir="rtl">
              {activeMetrics.map(key => {
                const m = METRICS.find(x => x.key === key);
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className="h-0.5 w-5 rounded-full" style={{ background: m.color }} />
                    <span className="text-xs" style={{ color:'rgba(255,255,255,0.45)' }}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ② MONTHLY TOTALS TABLE — full history, newest first */}
          <div className="rounded-2xl overflow-hidden" style={{ background:'rgb(var(--bg-surface))', border }}>
            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="text-base font-bold text-white">היסטוריית דיווחים</h2>
                <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.28)' }}>מהדיווח האחרון עד הראשון — לחץ על שורה לעריכה</p>
              </div>
              <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background:'rgba(245,193,24,0.12)', color:'#F5C118', border:'1px solid rgba(245,193,24,0.25)' }}>
                {sorted.length}/{tableRows.length} הוגשו
              </span>
            </div>

            {/* Table — overflow-x for small screens */}
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    {['חודש','כסף בעסקאות חדשות','הכנסה בפועל','הוצאות','רווח נטו','לקוחות חדשים','לקוחות פעילים'].map(h => (
                      <th key={h} style={{
                        padding:'8px 16px', textAlign:'right',
                        fontSize:'0.6875rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em',
                        color:'rgba(255,255,255,0.25)', whiteSpace:'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(row => {
                    const [ry, rm]  = row.monthKey.split('-').map(Number);
                    const sub        = row.sub;
                    const isMissing  = !row.hasData;
                    const isLatest   = row.monthKey === tableRows[0]?.monthKey;
                    const isCurMonth = row.monthKey === curKey;

                    // Compute values only when sub exists — 0 is a real value, null means missing
                    const income   = sub !== null ? num(sub.total_income || sub.amount) : null;
                    const expenses = sub !== null ? num(sub.software_expenses) + num(sub.variable_expenses) + num(sub.paid_ads) : null;
                    const netProfit = (income !== null && expenses !== null) ? income - expenses : null;

                    const rowBg = isCurMonth
                      ? 'rgba(245,193,24,0.04)'
                      : isLatest
                        ? 'rgba(255,255,255,0.02)'
                        : 'transparent';

                    return (
                      <tr key={row.monthKey}
                        onClick={() => navigate(`/?openMonthly=${row.monthKey}`)}
                        style={{
                          borderBottom:'1px solid rgba(255,255,255,0.04)',
                          background: rowBg,
                          cursor:'pointer',
                          transition:'background 0.12s',
                          opacity: isMissing ? 0.5 : 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                      >
                        {/* Month label */}
                        <td style={{ padding:'12px 16px', whiteSpace:'nowrap' }}>
                          <div className="flex items-center gap-2">
                            {isCurMonth && <span style={{ width:6, height:6, borderRadius:'50%', background:'#F5C118', display:'inline-block', flexShrink:0 }} />}
                            <span style={{ fontWeight:600, fontSize:'0.875rem', color: isCurMonth ? '#F5C118' : isMissing ? 'rgba(255,255,255,0.45)' : 'white' }}>
                              {MONTH_HE[rm - 1]} {ry}
                            </span>
                            {isMissing && (
                              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)' }}>
                                לא הוגש
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Deals — show ₪0 for submitted zero, — for missing */}
                        <td style={{ padding:'12px 16px', textAlign:'right' }}>
                          <span style={{ fontSize:'0.875rem', fontWeight:600, color: sub ? '#F5C118' : 'rgba(255,255,255,0.15)' }}>
                            {sub !== null ? fmtFullZero(num(sub.total_new_deals)) : '—'}
                          </span>
                        </td>
                        {/* Income */}
                        <td style={{ padding:'12px 16px', textAlign:'right' }}>
                          <span style={{ fontSize:'0.875rem', fontWeight:600, color: sub ? '#4ade80' : 'rgba(255,255,255,0.15)' }}>
                            {sub !== null ? fmtFullZero(income) : '—'}
                          </span>
                        </td>
                        {/* Expenses */}
                        <td style={{ padding:'12px 16px', textAlign:'right' }}>
                          <span style={{ fontSize:'0.875rem', color: sub && expenses > 0 ? '#f87171' : sub ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)' }}>
                            {sub !== null ? fmtFullZero(expenses) : '—'}
                          </span>
                        </td>
                        {/* Net profit */}
                        <td style={{ padding:'12px 16px', textAlign:'right' }}>
                          {sub !== null ? (
                            <span style={{ fontSize:'0.875rem', fontWeight:700, color: netProfit > 0 ? '#34d399' : netProfit < 0 ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
                              {fmtFullZero(netProfit)}
                            </span>
                          ) : <span style={{ color:'rgba(255,255,255,0.15)' }}>—</span>}
                        </td>
                        {/* New clients */}
                        <td style={{ padding:'12px 16px', textAlign:'right' }}>
                          <span style={{ fontSize:'0.875rem', color: sub && num(sub.new_clients) > 0 ? '#818cf8' : sub ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)' }}>
                            {sub !== null ? num(sub.new_clients) : '—'}
                          </span>
                        </td>
                        {/* Active clients */}
                        <td style={{ padding:'12px 16px', textAlign:'right' }}>
                          <span style={{ fontSize:'0.875rem', color: sub && num(sub.active_clients) > 0 ? '#38bdf8' : sub ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)' }}>
                            {sub !== null ? num(sub.active_clients) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ③ FINANCIAL HEALTH + OUTSTANDING PAYMENTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Financial health */}
            {(() => {
              const businessProfit = curNet - desiredSalary;
              return (
                <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background:'rgb(var(--bg-surface))', border }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">בריאות פיננסית</h2>
                      <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.25)' }}>
                        נתוני <span style={{ color:'rgba(255,255,255,0.45)', fontWeight:600 }}>{fmtMonth(latest?.month)}</span> — החודש האחרון במערכת
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { l:'הכנסה',    v:fmtFull(curIncome), c:'#F5C118' },
                      { l:'הוצאות',   v:fmtILS(curExp),     c:'rgba(255,255,255,0.55)' },
                      { l:'רווח נטו', v:fmtFull(curNet),    c: curNet>=0?'#4fc38a':'#ff5a72' },
                    ].map(({ l, v, c }) => (
                      <div key={l} className="rounded-xl px-3 py-2.5 text-center" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[11px] mb-1" style={{ color:'rgba(255,255,255,0.3)' }}>{l}</p>
                        <p className="text-base font-black leading-none" style={{ color:c }}>{v}</p>
                      </div>
                    ))}
                  </div>

                  {curIncome > 0 && (
                    <div className="rounded-full h-3 overflow-hidden flex gap-px" style={{ background:'rgba(255,255,255,0.06)' }}>
                      <div style={{ width:`${Math.min(100,Math.round(curExp/curIncome*100))}%`, background:'#ff5a72' }} />
                      {desiredSalary > 0 && <div style={{ width:`${Math.min(100-Math.round(curExp/curIncome*100), Math.round(desiredSalary/curIncome*100))}%`, background:'#F5C118' }} />}
                      <div style={{ flex:1, background:'#4fc38a' }} />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-1" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2 flex-none">
                      <span className="text-xs" style={{ color:'rgba(255,255,255,0.38)' }}>משכורת חודשית לבית</span>
                      <div className="relative group">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full text-[11px] font-bold cursor-help"
                          style={{ background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.4)' }}>?</span>
                        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background:'rgba(8,9,22,0.97)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.7)' }} dir="rtl">
                          הסכום שאתה רוצה לקחת הביתה מהעסק כל חודש — כמה אתה צריך כדי לכסות את ההוצאות האישיות שלך.
                        </div>
                      </div>
                      {editingSalary ? (
                        <div className="flex items-center gap-1">
                          <input ref={salaryRef} type="number" min="0" value={salaryDraft}
                            onChange={e => setSalaryDraft(e.target.value)}
                            onKeyDown={e => { if(e.key==='Enter') saveSalary(); if(e.key==='Escape') setEditingSalary(false); }}
                            className="rounded-md px-2 py-1 text-xs font-bold text-white outline-none w-20"
                            style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(245,193,24,0.4)' }} />
                          <button onClick={saveSalary}><Check size={12} style={{ color:'#F5C118' }} /></button>
                          <button onClick={() => setEditingSalary(false)}><X size={12} style={{ color:'rgba(255,255,255,0.3)' }} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setSalaryDraft(desiredSalary>0?String(desiredSalary):''); setEditingSalary(true); setTimeout(()=>salaryRef.current?.select(),50); }}
                          className="flex items-center gap-1 text-xs rounded-md px-2 py-0.5 transition hover:bg-white/08"
                          style={{ border:'1px solid rgba(255,255,255,0.1)', color: desiredSalary>0?'#F5C118':'rgba(255,255,255,0.35)' }}>
                          <Pencil size={9} />
                          {desiredSalary > 0 ? fmtILS(desiredSalary) : 'הגדר'}
                        </button>
                      )}
                    </div>
                    {desiredSalary > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]" style={{ color:'rgba(255,255,255,0.35)' }}>נשאר לעסק</span>
                        <span className="text-base font-black" style={{ color: businessProfit>=0?'#4fc38a':'#ff5a72' }}>{fmtFull(businessProfit)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Outstanding payments */}
            <div className="rounded-2xl overflow-hidden" style={{
              background: totalOutstanding > 0 ? 'rgba(239,68,68,0.04)' : 'rgb(var(--bg-surface))',
              border: `1px solid ${totalOutstanding > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)'}`,
            }}>
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-base font-bold text-white">תשלומים ממתינים</h2>
                <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.28)' }}>
                  {totalOutstanding > 0 ? `סה״כ ${fmtFull(totalOutstanding)} · ${outstandingItems.length} תשלומים` : 'אין תשלומים פתוחים'}
                </p>
              </div>
              {outstandingItems.length === 0 ? (
                <div className="px-5 pb-5 flex items-center gap-2">
                  <CheckCircle2 size={16} style={{ color:'#4ade80' }} />
                  <span className="text-base" style={{ color:'rgba(255,255,255,0.4)' }}>כל התשלומים הושלמו ✓</span>
                </div>
              ) : (
                <>
                  <div className="grid px-5 pb-2" style={{ gridTemplateColumns:'1fr minmax(60px,80px) minmax(70px,88px)' }}>
                    {['לקוח','סכום','תאריך'].map(h => (
                      <span key={h} className="text-[11px] font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.18)' }}>{h}</span>
                    ))}
                  </div>
                  {outstandingItems.map((item, i) => {
                    const overdue = item.date && new Date(item.date) < new Date();
                    return (
                      <div key={i} className="grid px-5 py-2.5 items-center" style={{ gridTemplateColumns:'1fr 80px 88px', borderTop:'1px solid rgba(255,255,255,0.04)', background: overdue ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-white truncate">{item.clientName}</p>
                          <p className="text-[11px]" style={{ color:'rgba(255,255,255,0.28)' }}>{item.label}</p>
                        </div>
                        <p className="text-base font-bold" style={{ color:'#fcd34d' }}>{fmtFull(item.amount)}</p>
                        <div className="flex items-center gap-1">
                          {overdue ? <AlertCircle size={10} style={{ color:'#fca5a5' }} /> : <Clock size={10} style={{ color:'rgba(255,255,255,0.2)' }} />}
                          <span className="text-[11px]" style={{ color: overdue ? '#fca5a5' : 'rgba(255,255,255,0.38)' }}>
                            {item.date ? fmtDate(item.date) : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between px-5 py-2.5" style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
                    <span className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>סה״כ</span>
                    <span className="text-base font-black" style={{ color:'#fcd34d' }}>{fmtFull(totalOutstanding)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════ TAB: SALES ══════════════════════ */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(129,140,248,0.25)' }}>
              <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color:'rgba(255,255,255,0.35)' }}>המרה: לידים → שיחות מכירה</p>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-4xl font-black" style={{ color:'#818cf8' }}>
                  {convLeadToCall != null ? `${convLeadToCall}%` : '—'}
                </span>
                <span className="text-base mb-1.5" style={{ color:'rgba(255,255,255,0.35)' }}>
                  {funnelTotals.calls_set} שיחות מתוך {funnelTotals.leads} לידים
                </span>
              </div>
              <div className="rounded-full h-2 overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-2 rounded-full transition-all duration-500" style={{ width:`${convLeadToCall ?? 0}%`, background:'#818cf8' }} />
              </div>
            </div>
            <div className="rounded-2xl p-5" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(74,222,128,0.25)' }}>
              <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color:'rgba(255,255,255,0.35)' }}>המרה: שיחות → סגירות</p>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-4xl font-black" style={{ color:'#4ade80' }}>
                  {convCallToClose != null ? `${convCallToClose}%` : '—'}
                </span>
                <span className="text-base mb-1.5" style={{ color:'rgba(255,255,255,0.35)' }}>
                  {newClientsTotal} סגירות מתוך {funnelTotals.calls_showed} שיחות
                </span>
              </div>
              <div className="rounded-full h-2 overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-2 rounded-full transition-all duration-500" style={{ width:`${convCallToClose ?? 0}%`, background:'#4ade80' }} />
              </div>
            </div>
          </div>

          <Section
            title="פאנל מכירות"
            sub="ככל שמציעים יותר — מקבלים יותר לידים, שיחות וסגירות"
            right={
              <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                {[{k:'1m',l:'חודש'},{k:'3m',l:'3M'},{k:'6m',l:'6M'},{k:'12m',l:'12M'}].map(r => (
                  <button key={r.k} onClick={() => setSalesRange(r.k)}
                    className="rounded-md px-3 py-1 text-xs font-bold transition-all"
                    style={{ background: salesRange===r.k ? 'rgba(255,255,255,0.12)' : 'transparent', color: salesRange===r.k ? 'white' : 'rgba(255,255,255,0.32)' }}>
                    {r.l}
                  </button>
                ))}
              </div>
            }
          >
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={salesData} barGap={2} barCategoryGap="25%" margin={{ top:8, right:4, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis {...XAXIS_PROPS} />
                  <YAxis {...YCNT_PROPS} />
                  <Tooltip contentStyle={TIP.contentStyle} cursor={{ fill:'rgba(30,58,120,0.35)' }} formatter={(v, name) => [v, name]} />
                  <Bar dataKey="הצעות" fill="#F5C118" radius={[3,3,0,0]} />
                  <Bar dataKey="לידים" fill="rgba(167,139,250,0.75)" radius={[3,3,0,0]} />
                  <Bar dataKey="שיחות" fill="rgba(99,102,241,0.75)" radius={[3,3,0,0]} />
                  <Bar dataKey="סגירות" fill="#4ade80" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-5 mt-2 flex-wrap" dir="rtl">
              {[{c:'#F5C118',l:'הצעות'},{c:'rgba(167,139,250,0.9)',l:'לידים'},{c:'rgba(99,102,241,0.9)',l:'שיחות'},{c:'#4ade80',l:'סגירות'}].map(x => (
                <div key={x.l} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background:x.c }} />
                  <span className="text-[11px]" style={{ color:'rgba(255,255,255,0.38)' }}>{x.l}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="הצעות מחיר" sub="הצעות מחיר פורמליות שנשלחו ונסגרו">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {[
                { l:'נשלחו', v:funnelTotals.quotes_sent, c:'#38bdf8' },
                { l:'אושרו / נסגרו', v:funnelTotals.quotes_approved, c:'#4ade80' },
                { l:'אחוז סגירה', v:convQuoteToClose!=null ? `${convQuoteToClose}%` : '—', c:'#f472b6' },
              ].map(({l,v,c}) => (
                <div key={l} className="rounded-xl p-4 text-center" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color:'rgba(255,255,255,0.28)' }}>{l}</p>
                  <p className="text-2xl font-black" style={{ color:c }}>{v}</p>
                </div>
              ))}
            </div>
            {funnelTotals.quotes_sent > 0 && (
              <div className="rounded-full h-2 overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-2 rounded-full transition-all" style={{ width:`${convQuoteToClose ?? 0}%`, background:'linear-gradient(90deg,#38bdf8,#4ade80)' }} />
              </div>
            )}
            {funnelTotals.quotes_sent === 0 && (
              <p className="text-xs text-center py-2" style={{ color:'rgba(255,255,255,0.22)' }}>אין נתוני הצעות מחיר עדיין — מלא בדוח החודשי</p>
            )}
          </Section>
        </div>
      )}

      {/* ══════════════ TAB: CLIENTS ═══════════════════ */}
      {tab === 'clients' && (() => {
        const clientsRanked = [...clients]
          .map(c => ({ name: c.name || 'לא ידוע', paid: computeClientPaid(c), total: num(c.deal_amount), outstanding: Math.max(0, num(c.deal_amount) - computeClientPaid(c)) }))
          .filter(c => c.total > 0).sort((a, b) => b.paid - a.paid);
        const topClient = clientsRanked[0] ?? null;
        const newClientsData = slice.map((m, i) => ({
          month: shortMonth(m.month),
          חדשים: i === 0 ? 0 : Math.max(0, num(m.active_clients) - num(slice[i-1]?.active_clients)),
        }));
        const debtClients = clientsRanked.filter(c => c.outstanding > 0);

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l:'לקוחות פעילים', v: activeClients ?? '—', c:'#34d399', sub:'לפי דיווח אחרון' },
                { l:'לקוחות חדשים', v: newClientsTotal > 0 ? `+${newClientsTotal}` : '—', c:'#F5C118', sub:`${rangeN} חודשים` },
                { l:'LTV ממוצע', v: ltv ? fmtILS(ltv) : '—', c:'#a78bfa', sub:`${clients.length} לקוחות` },
                { l:'הכי רווחי', v: topClient ? fmtILS(topClient.paid) : '—', c:'#38bdf8', sub: topClient?.name ?? '' },
              ].map(({ l, v, c, sub }) => (
                <div key={l} className="rounded-2xl p-4" style={{ background:'rgb(var(--bg-surface))', border }}>
                  <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color:'rgba(255,255,255,0.28)' }}>{l}</p>
                  <p className="text-xl font-black leading-none" style={{ color:c }}>{v}</p>
                  {sub && <p className="text-[11px] mt-1" style={{ color:'rgba(255,255,255,0.28)' }}>{sub}</p>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="לקוחות פעילים לאורך זמן">
                <div dir="ltr">
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={clientData} margin={{ top:6, right:4, left:0, bottom:0 }}>
                      <defs>
                        <linearGradient id="clG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis {...XAXIS_PROPS} />
                      <YAxis {...YCNT_PROPS} />
                      <Tooltip {...TIP} formatter={v=>[v,'פעילים']} />
                      <Area type="monotone" dataKey="לקוחות פעילים" stroke="#34d399" strokeWidth={2} fill="url(#clG)"
                        dot={{ r:3, fill:'#34d399', stroke:'rgb(var(--bg-surface))', strokeWidth:1.5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="לקוחות חדשים לפי חודש">
                <div dir="ltr">
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={newClientsData} barSize={20} margin={{ top:6, right:4, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis {...XAXIS_PROPS} />
                      <YAxis {...YCNT_PROPS} />
                      <Tooltip {...TIP} formatter={v=>[v,'לקוחות חדשים']} cursor={{ fill:'rgba(30,58,120,0.35)' }} />
                      <Bar dataKey="חדשים" fill="#F5C118" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            {clientsRanked.length > 0 && (
              <Section title="לקוחות לפי רווחיות" sub="לפי סכום ששולם בפועל" noPad>
                <div className="grid px-5 pb-2 mt-4" style={{ gridTemplateColumns:'1fr minmax(65px,90px) minmax(65px,90px)' }}>
                  {['לקוח','שולם','שווי עסקה'].map(h=>(
                    <span key={h} className="text-[11px] font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.2)' }}>{h}</span>
                  ))}
                </div>
                {clientsRanked.slice(0, 5).map((c, i) => (
                  <div key={i} className="grid px-5 py-3 items-center" style={{ gridTemplateColumns:'1fr 90px 90px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-none"
                        style={{ background: i===0?'rgba(245,193,24,0.15)':'rgba(255,255,255,0.06)', color: i===0?'#F5C118':'rgba(255,255,255,0.35)' }}>
                        {i+1}
                      </div>
                      <p className="text-base font-semibold text-white">{c.name}</p>
                    </div>
                    <p className="text-base font-bold" style={{ color:'#4fc38a' }}>{fmtFull(c.paid)}</p>
                    <p className="text-base" style={{ color:'rgba(255,255,255,0.45)' }}>{fmtFull(c.total)}</p>
                  </div>
                ))}
              </Section>
            )}

            <Section
              title="לקוחות עם יתרה לתשלום"
              sub={debtClients.length > 0 ? `${debtClients.length} לקוחות · סה״כ ${fmtFull(totalOutstanding)}` : 'כל התשלומים הושלמו ✓'}
              noPad
            >
              {outstandingItems.length === 0 ? (
                <div className="flex items-center gap-3 p-5">
                  <CheckCircle2 size={18} style={{ color:'#4ade80' }} />
                  <span className="text-base" style={{ color:'rgba(255,255,255,0.45)' }}>אין יתרות פתוחות</span>
                </div>
              ) : (
                <div>
                  <div className="grid gap-3 px-5 pb-2 mt-4" style={{ gridTemplateColumns:'1fr minmax(60px,80px) minmax(65px,90px)' }}>
                    {['לקוח / תיאור','סכום','תאריך'].map(h=>(
                      <span key={h} className="text-[11px] font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.2)' }}>{h}</span>
                    ))}
                  </div>
                  {outstandingItems.map((item, i) => {
                    const overdue = item.date && new Date(item.date) < new Date();
                    return (
                      <div key={i} className="grid gap-3 px-5 py-3 items-center"
                        style={{ gridTemplateColumns:'1fr 80px 90px', borderTop:'1px solid rgba(255,255,255,0.04)', background: overdue?'rgba(239,68,68,0.04)':'transparent' }}>
                        <div>
                          <p className="text-base font-semibold text-white leading-tight">{item.clientName}</p>
                          <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.32)' }}>{item.label}</p>
                        </div>
                        <p className="text-base font-bold" style={{ color:'#fcd34d' }}>{fmtFull(item.amount)}</p>
                        <div className="flex items-center gap-1.5">
                          {overdue ? <AlertCircle size={11} style={{ color:'#fca5a5' }} /> : <Clock size={11} style={{ color:'rgba(255,255,255,0.25)' }} />}
                          <span className="text-xs" style={{ color: overdue?'#fca5a5':'rgba(255,255,255,0.42)' }}>
                            {item.date ? fmtDate(item.date) : 'ללא תאריך'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center px-5 py-3" style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
                    <span className="text-xs font-semibold" style={{ color:'rgba(255,255,255,0.35)' }}>סה״כ</span>
                    <span className="text-base font-black" style={{ color:'#fcd34d' }}>{fmtFull(totalOutstanding)}</span>
                  </div>
                </div>
              )}
            </Section>
          </div>
        );
      })()}

      {/* ══════════════ TAB: CONTENT ════════════════════ */}
      {tab === 'content' && (
        <div className="space-y-4">
          <Section title="צמיחה ברשת החברתית" sub="עוקבים ופוסטים לאורך זמן">
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={igData} margin={{ top:8, right:4, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="igG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e1306c" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#e1306c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis {...XAXIS_PROPS} />
                  <YAxis yAxisId="left" tick={{ fill:'rgba(255,255,255,0.22)', fontSize: '0.75rem' }} axisLine={false} tickLine={false}
                    tickFormatter={v=>v>=1000?`${Math.round(v/1000)}K`:v} width={40} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill:'rgba(255,255,255,0.22)', fontSize: '0.75rem' }}
                    axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                  <Tooltip {...TIP} formatter={(v,n)=>[n==='עוקבים'?v.toLocaleString('he-IL'):v, n]} />
                  <Area yAxisId="left" type="monotone" dataKey="עוקבים"
                    stroke="#e1306c" strokeWidth={2.5} fill="url(#igG)"
                    dot={{ r:3.5, fill:'#e1306c', stroke:'rgb(var(--bg-surface))', strokeWidth:2 }} />
                  <Bar yAxisId="right" dataKey="פוסטים" fill="rgba(245,193,24,0.5)" radius={[4,4,0,0]} barSize={14} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-5 mt-1" dir="rtl">
              {[{c:'#e1306c',l:'עוקבים',line:true},{c:'rgba(245,193,24,0.7)',l:'פוסטים',line:false}].map(x=>(
                <div key={x.l} className="flex items-center gap-1.5">
                  <div className={x.line?'h-0.5 w-4 rounded':'h-2.5 w-2.5 rounded-sm'} style={{ background:x.c }} />
                  <span className="text-[11px]" style={{ color:'rgba(255,255,255,0.32)' }}>{x.l}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { l:'פוסטים בתקופה', v: slice.reduce((s,m)=>s+num(m.posts_count),0), c:'#fcd34d', sub:`${rangeN} חודשים` },
              { l:'ממוצע חודשי', v: slice.length>0 ? Math.round(slice.reduce((s,m)=>s+num(m.posts_count),0)/slice.length) : 0, c:'#a78bfa', sub:'פוסטים לחודש' },
              { l:'עוקבים נוכחיים', v: latest?.followers ? num(latest.followers).toLocaleString('he-IL') : '—', c:'#e1306c', sub:fmtMonth(latest?.month) },
            ].map(({l,v,c,sub})=>(
              <div key={l} className="rounded-xl p-4" style={{ background:'rgb(var(--bg-surface))', border }}>
                <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color:'rgba(255,255,255,0.28)' }}>{l}</p>
                <p className="text-2xl font-black" style={{ color:c }}>{v}</p>
                <p className="text-[11px] mt-1" style={{ color:'rgba(255,255,255,0.28)' }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
