import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import {
  Loader2, TrendingUp, Users, Target, FileText, DollarSign,
  BarChart3, AlertCircle, CheckCircle2, Clock, Smartphone,
  ArrowUpRight, ArrowDownRight, Minus, Pencil, Check, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

// ── Helpers ─────────────────────────────────────────────────────
const MONTH_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
function fmtMonth(d)  { if (!d) return '—'; const dt = new Date(d); return `${MONTH_HE[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`; }
function shortMonth(d){ if (!d) return ''; const dt = new Date(d); return `${MONTH_HE[dt.getUTCMonth()].slice(0,3)}`; }
function fmtILS(n)    { const v = Number(n); if (!v && v !== 0) return '—'; if (v >= 1_000_000) return `₪${(v/1_000_000).toFixed(1)}M`; if (v >= 1_000) return `₪${Math.round(v/1_000)}K`; return '₪'+Math.round(v).toLocaleString('he-IL'); }
function fmtFull(n)   { const v = Number(n); if (isNaN(v)) return '—'; return '₪'+Math.round(v).toLocaleString('he-IL'); }
function num(v)       { const n = Number(v); return isNaN(n) ? 0 : n; }
function fmtDate(d)   { if (!d) return '—'; return new Date(d).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'2-digit' }); }

function computeClientPaid(c) {
  const plan = c.installment_plan;
  if (plan?.length) return plan.filter(i => i.paid).reduce((s,i) => s + Math.round((parseFloat(i.percentage)||0)/100*(c.deal_amount||0)), 0);
  return c.paid_amount || 0;
}

// ── Range picker ────────────────────────────────────────────────
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

// ── Tabs ────────────────────────────────────────────────────────
const TABS = [
  { k:'overview',  l:'סקירה כללית' },
  { k:'sales',     l:'מכירות' },
  { k:'clients',   l:'לקוחות ופרויקטים' },
  { k:'content',   l:'תוכן' },
];
function Tabs({ value, onChange }) {
  return (
    <div className="flex gap-1 border-b" style={{ borderColor:'rgba(255,255,255,0.08)' }}>
      {TABS.map(t => (
        <button key={t.k} onClick={() => onChange(t.k)}
          className="pb-3 px-4 text-sm font-semibold transition-all relative"
          style={{ color: value===t.k ? 'white' : 'rgba(255,255,255,0.35)' }}>
          {t.l}
          {value===t.k && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background:'#F5C118' }} />}
        </button>
      ))}
    </div>
  );
}

// ── Hero KPI card ───────────────────────────────────────────────
function KpiCard({ label, value, sub, color='#F5C118', trend, icon: Icon }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
      style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
      {/* Icon (right) + label */}
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-none" style={{ background:`${color}18` }}>
            <Icon size={14} style={{ color }} />
          </div>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.38)' }}>{label}</p>
      </div>
      {/* Value */}
      <p className="text-2xl sm:text-[1.85rem] font-black leading-none tracking-tight" style={{ color:'white' }}>{value}</p>
      {/* Sub + trend */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {sub && <p className="text-[11px] leading-snug" style={{ color:'rgba(255,255,255,0.32)' }}>{sub}</p>}
        {trend != null && (
          <div className="flex items-center gap-1 flex-none">
            {trend > 0
              ? <ArrowUpRight size={12} style={{ color:'#86efac' }} />
              : trend < 0
              ? <ArrowDownRight size={12} style={{ color:'#fca5a5' }} />
              : <Minus size={12} style={{ color:'rgba(255,255,255,0.25)' }} />}
            <span className="text-[10px] font-bold" style={{ color: trend>0?'#86efac':trend<0?'#fca5a5':'rgba(255,255,255,0.25)' }}>
              {trend>0?'+':''}{trend}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section card ────────────────────────────────────────────────
function Section({ title, sub, right, children, noPad }) {
  return (
    <div className="rounded-2xl" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
      <div className={`flex items-center justify-between ${noPad ? 'px-5 pt-5' : 'px-5 pt-5'}`}>
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          {sub && <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.28)' }}>{sub}</p>}
        </div>
        {right}
      </div>
      <div className={noPad ? 'pt-4' : 'p-5 pt-4'}>{children}</div>
    </div>
  );
}

// ── Chart shared ────────────────────────────────────────────────
const TIP = {
  contentStyle: { background:'rgba(8,9,22,0.97)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, color:'white', fontSize:12, direction:'rtl' },
  cursor: { stroke:'rgba(255,255,255,0.07)', strokeWidth:1 },
};
const GRID = <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />;
const XAXIS = <XAxis dataKey="month" tick={{ fill:'rgba(255,255,255,0.28)', fontSize:11 }} axisLine={false} tickLine={false} />;
const YILS  = <YAxis tick={{ fill:'rgba(255,255,255,0.22)', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>v===0?'₪0':`₪${Math.round(v/1000)}K`} width={44} />;
const YCNT  = <YAxis tick={{ fill:'rgba(255,255,255,0.22)', fontSize:10 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />;

// ── Funnel bar ──────────────────────────────────────────────────
function FunnelRow({ label, value, total, color, sub }) {
  const pct = total > 0 ? Math.min(100, Math.round(value/total*100)) : (value > 0 ? 100 : 0);
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium" style={{ color:'rgba(255,255,255,0.65)' }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color:'rgba(255,255,255,0.35)' }}>{sub}</span>
          <span className="text-sm font-bold text-white">{value}</span>
        </div>
      </div>
      <div className="rounded-full h-2" style={{ background:'rgba(255,255,255,0.06)' }}>
        <div className="rounded-full h-2 transition-all duration-500" style={{ width:`${pct}%`, background:color }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
export default function Analytics() {
  const { user }   = useUser();
  const userId     = user?.id;

  const [months,        setMonths]        = useState([]);
  const [clients,       setClients]       = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [pipelineLeads, setPipelineLeads] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [range,      setRange]      = useState('6m');
  const [tab,        setTab]        = useState('overview');
  const [salesRange,    setSalesRange]    = useState('6m');
  const [selIdx,     setSelIdx]     = useState(null);

  // ── Desired salary (localStorage) ────────────────────────────
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

  // ── Annual goal (localStorage) ────────────────────────────────
  const goalKey = userId ? `annual_goal_${userId}` : null;
  const [annualGoal,     setAnnualGoal]     = useState(0);
  const [editingGoal,    setEditingGoal]    = useState(false);
  const [goalDraft,      setGoalDraft]      = useState('');
  const goalInputRef = useRef(null);

  useEffect(() => {
    if (!goalKey) return;
    const saved = localStorage.getItem(goalKey);
    if (saved) setAnnualGoal(parseInt(saved, 10) || 0);
  }, [goalKey]);

  function openGoalEdit() {
    setGoalDraft(annualGoal > 0 ? String(annualGoal) : '');
    setEditingGoal(true);
    setTimeout(() => goalInputRef.current?.select(), 50);
  }
  function saveGoal() {
    const v = parseInt(goalDraft.replace(/[^0-9]/g, ''), 10) || 0;
    setAnnualGoal(v);
    if (goalKey) localStorage.setItem(goalKey, String(v));
    setEditingGoal(false);
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

  // ── Sorted submissions ────────────────────────────────────────
  const sorted = useMemo(() => [...months].sort((a,b) => new Date(a.month)-new Date(b.month)), [months]);
  const rangeN  = range==='3m' ? 3 : range==='6m' ? 6 : 12;
  const slice   = useMemo(() => [...sorted].reverse().slice(0, rangeN).reverse(), [sorted, rangeN]);

  const latest  = sorted[sorted.length-1] ?? null;
  const prev    = sorted[sorted.length-2] ?? null;

  // ── Month navigator ───────────────────────────────────────────
  const effIdx   = selIdx !== null ? selIdx : sorted.length - 1;
  const selMonth = sorted[effIdx] ?? null;
  const selPrev  = sorted[effIdx - 1] ?? null;
  useEffect(() => { if (sorted.length) setSelIdx(sorted.length - 1); }, [sorted.length]);

  // ── Current month ─────────────────────────────────────────────
  const curIncome  = num(latest?.total_income || latest?.amount);
  const curExp     = num(latest?.software_expenses) + num(latest?.variable_expenses) + num(latest?.paid_ads);
  const curNet     = curIncome - curExp;
  const curNetPct  = curIncome > 0 ? Math.round(curNet / curIncome * 100) : 0;
  const prevIncome    = num(prev?.total_income || prev?.amount);
  const incomeTrend   = prevIncome > 0 ? Math.round((curIncome - prevIncome) / prevIncome * 100) : null;

  const prevNet       = prevIncome - (num(prev?.software_expenses) + num(prev?.variable_expenses) + num(prev?.paid_ads));
  const netTrend      = prevIncome > 0 ? Math.round((curNet - prevNet) / Math.abs(prevNet || 1) * 100) : null;

  const curDeals      = num(latest?.total_new_deals);
  const prevDeals     = num(prev?.total_new_deals);
  const dealsTrend    = prevDeals > 0 ? Math.round((curDeals - prevDeals) / prevDeals * 100) : null;

  // ── Selected month KPI values (for hero cards) ────────────────
  const selIncome  = num(selMonth?.total_income || selMonth?.amount);
  const selExp     = num(selMonth?.software_expenses) + num(selMonth?.variable_expenses) + num(selMonth?.paid_ads);
  const selNet     = selIncome - selExp;
  const selNetPct  = selIncome > 0 ? Math.round(selNet / selIncome * 100) : 0;
  const selPrevInc = num(selPrev?.total_income || selPrev?.amount);
  const selIncTrend = selPrevInc > 0 ? Math.round((selIncome - selPrevInc) / selPrevInc * 100) : null;
  const selPrevNet = selPrevInc - (num(selPrev?.software_expenses) + num(selPrev?.variable_expenses) + num(selPrev?.paid_ads));
  const selNetTrend = selPrevInc > 0 ? Math.round((selNet - selPrevNet) / Math.abs(selPrevNet || 1) * 100) : null;
  const selDeals   = num(selMonth?.total_new_deals);
  const selPrevDeals = num(selPrev?.total_new_deals);
  const selDealsTrend = selPrevDeals > 0 ? Math.round((selDeals - selPrevDeals) / selPrevDeals * 100) : null;

  // ── YTD ───────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const ytdSubs     = sorted.filter(m => new Date(m.month).getUTCFullYear() === currentYear);
  const ytdIncome   = ytdSubs.reduce((s,m) => s + num(m.total_income||m.amount), 0);
  const ytdExp      = ytdSubs.reduce((s,m) => s + num(m.software_expenses) + num(m.variable_expenses) + num(m.paid_ads), 0);
  const ytdNet      = ytdIncome - ytdExp;

  // ── Average margin from monthly data ─────────────────────────
  const avgMarginPct = useMemo(() => {
    const subs = sorted.filter(m => num(m.total_income||m.amount) > 0);
    if (!subs.length) return null;
    const margins = subs.map(m => {
      const inc = num(m.total_income||m.amount);
      const exp = num(m.software_expenses)+num(m.variable_expenses)+num(m.paid_ads);
      return inc > 0 ? (inc-exp)/inc*100 : null;
    }).filter(x => x !== null);
    return margins.length ? Math.round(margins.reduce((a,b)=>a+b,0)/margins.length) : null;
  }, [sorted]);

  // ── Outstanding payments (from clients + installment_plan) ───
  const outstandingItems = useMemo(() => {
    const items = [];

    // From clients table
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

    // From projects table — installment_plan on each project
    projects.forEach(p => {
      const plan = p.installment_plan;
      if (!plan?.length) return;
      // Find the client name
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

  // ── Sales funnel ──────────────────────────────────────────────
  const funnelTotals = useMemo(() => {
    const subs = slice;
    return {
      leads:          subs.reduce((s,m)=>s+num(m.leads),0),
      calls_set:      subs.reduce((s,m)=>s+num(m.sales_calls_set),0),
      calls_showed:   subs.reduce((s,m)=>s+num(m.sales_calls_showed),0),
      proposals:      subs.reduce((s,m)=>s+num(m.proposals),0),
      quotes_sent:    subs.reduce((s,m)=>s+num(m.price_quotes_sent),0),
      quotes_approved:subs.reduce((s,m)=>s+num(m.price_quotes_approved),0),
    };
  }, [slice]);

  // Closing rate — single source to avoid double counting:
  // Priority 1: closings_count from monthly form (explicit input)
  // Priority 2: pipeline leads marked 'נסגר' (fallback when form not filled)
  const { closingRate, newClientsTotal } = useMemo(() => {
    // Check if ANY month in the slice has closings_count filled
    const hasMonthlyData = slice.some(m => m.closings_count != null);

    let totalClosings;
    if (hasMonthlyData) {
      // Use monthly form data — user explicitly filled it
      totalClosings = slice.reduce((s,m) => s + num(m.closings_count), 0);
    } else {
      // Fallback: pipeline leads marked as closed
      totalClosings = pipelineLeads.filter(l => l.call_status === 'נסגר').length;
    }

    const totalCalls = slice.reduce((s,m) => s + num(m.sales_calls_showed), 0);
    const rate = totalCalls > 0 ? Math.min(100, Math.round(totalClosings / totalCalls * 100)) : null;
    return { closingRate: rate, newClientsTotal: totalClosings };
  }, [sorted, slice, pipelineLeads]);

  // Conversion rates (defined after newClientsTotal)
  const convLeadToCall   = funnelTotals.leads > 0
    ? Math.round(funnelTotals.calls_set / funnelTotals.leads * 100) : null;
  const convCallToClose  = funnelTotals.calls_showed > 0
    ? Math.round(newClientsTotal / funnelTotals.calls_showed * 100) : null;
  const convQuoteToClose = funnelTotals.quotes_sent > 0
    ? Math.round(funnelTotals.quotes_approved / funnelTotals.quotes_sent * 100) : null;

  // Latest active clients
  const activeClients = latest ? num(latest.active_clients) : null;

  // ── LTV — avg revenue per unique client ──────────────────────
  const ltv = useMemo(() => {
    // From clients table: sum of all deal amounts / number of clients
    if (!clients.length) return null;
    const totalRevenue = clients.reduce((s,c) => s + num(c.deal_amount || c.total_amount), 0);
    if (!totalRevenue) return null;
    return Math.round(totalRevenue / clients.length);
  }, [clients]);

  // Average project value (from projects table)
  const avgProjectValue = useMemo(() => {
    const p = projects.filter(p => num(p.total_amount) > 0);
    if (!p.length) return null;
    return Math.round(p.reduce((s,p) => s + num(p.total_amount), 0) / p.length);
  }, [projects]);

  // ── Next month expected income (from installment dates) ──────
  const nextMonthExpected = useMemo(() => {
    const now = new Date();
    const nextMonth = now.getMonth() + 1; // 0-indexed, could be 12
    const nextYear  = nextMonth === 12 ? now.getFullYear() + 1 : now.getFullYear();
    const nm        = nextMonth === 12 ? 0 : nextMonth;
    return outstandingItems
      .filter(item => {
        if (!item.date) return false;
        const d = new Date(item.date);
        return d.getMonth() === nm && d.getFullYear() === nextYear;
      })
      .reduce((s, item) => s + item.amount, 0);
  }, [outstandingItems]);

  // ── Annual goal progress ──────────────────────────────────────
  const goalPct = annualGoal > 0 ? Math.min(100, Math.round(ytdIncome / annualGoal * 100)) : 0;
  const goalRemaining = annualGoal > 0 ? Math.max(0, annualGoal - ytdIncome) : 0;
  const currentYearMonth = new Date().getMonth() + 1; // 1-12
  const monthlyNeeded = goalRemaining > 0 && currentYearMonth <= 12
    ? Math.round(goalRemaining / Math.max(1, 12 - currentYearMonth + 1))
    : 0;

  // ── Chart data ────────────────────────────────────────────────
  const revenueData = useMemo(() => slice.map(m => ({
    month: shortMonth(m.month), fullLabel: fmtMonth(m.month),
    הכנסה:  num(m.total_income||m.amount),
    נטו:    num(m.total_income||m.amount) - num(m.software_expenses) - num(m.variable_expenses) - num(m.paid_ads),
    הוצאות: num(m.software_expenses)+num(m.variable_expenses)+num(m.paid_ads),
  })), [slice]);

  const salesN    = salesRange==='1m' ? 1 : salesRange==='3m' ? 3 : salesRange==='6m' ? 6 : 12;
  const salesSlice = useMemo(() => [...sorted].reverse().slice(0, salesN).reverse(), [sorted, salesN]);

  const salesData = useMemo(() => {
    // Build month → pipeline closures map (using call_date as the closing date)
    const pipelineByMonth = {};
    pipelineLeads
      .filter(l => l.call_status === 'נסגר' && l.call_date)
      .forEach(l => {
        const key = String(l.call_date).substring(0, 7); // "2025-04"
        pipelineByMonth[key] = (pipelineByMonth[key] || 0) + 1;
      });

    return salesSlice.map(m => {
      const monthKey = m.month ? String(m.month).substring(0, 7) : '';
      // Priority 1: closings_count from monthly form
      // Priority 2: pipeline leads marked נסגר with call_date in this month
      const closings = m.closings_count != null
        ? num(m.closings_count)
        : (pipelineByMonth[monthKey] || 0);

      return {
        month:     shortMonth(m.month),
        fullMonth: fmtMonth(m.month),
        הצעות:    num(m.proposals),
        לידים:    num(m.leads),
        שיחות:    num(m.sales_calls_set),
        סגירות:   closings,
      };
    });
  }, [salesSlice, pipelineLeads]);

  const clientData = useMemo(() => slice.map(m => ({
    month: shortMonth(m.month),
    'לקוחות פעילים': num(m.active_clients),
  })), [slice]);

  const igData = useMemo(() => slice.map(m => ({
    month: shortMonth(m.month), fullLabel: fmtMonth(m.month),
    עוקבים: num(m.followers),
    פוסטים: num(m.posts_count),
  })), [slice]);

  // ── Revenue tooltip ───────────────────────────────────────────
  function RevTip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-xl px-4 py-3 shadow-xl" style={{ background:'rgba(8,9,22,0.97)', border:'1px solid rgba(245,193,24,0.2)', minWidth:160 }}>
        <p className="text-xs font-bold text-white mb-2">{d.fullLabel}</p>
        <p className="text-base font-black" style={{ color:'#fcd34d' }}>{fmtFull(d.הכנסה)}</p>
        {d.הוצאות > 0 && <>
          <p className="text-[11px] mt-1" style={{ color:'rgba(252,165,165,0.7)' }}>הוצאות {fmtILS(d.הוצאות)}</p>
          <p className="text-[11px] mt-0.5 font-semibold" style={{ color: d.נטו>=0?'#86efac':'#fca5a5' }}>
            נטו {fmtFull(d.נטו)} ({d.הכנסה>0?Math.round(d.נטו/d.הכנסה*100):0}%)
          </p>
        </>}
      </div>
    );
  }

  // ── Loading / empty ───────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 size={26} className="animate-spin" style={{ color:'rgba(255,255,255,0.18)' }} /></div>;
  if (!months.length) return (
    <div className="w-full space-y-6">
      <h1 className="text-3xl font-bold text-white">נתונים עסקיים</h1>
      <div className="rounded-2xl p-16 flex flex-col items-center gap-4" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.08)' }}>
        <BarChart3 size={40} style={{ color:'rgba(255,255,255,0.1)' }} />
        <p className="text-sm font-semibold text-white">אין עדיין נתונים</p>
        <p className="text-xs text-center leading-relaxed" style={{ color:'rgba(255,255,255,0.32)' }}>מלא דוח חודשי בדשבורד כדי לראות את הנתונים שלך כאן</p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div className="w-full space-y-5" dir="rtl">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">נתונים עסקיים</h1>
      </div>


      {/* ── Hero KPIs ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelIdx(i => Math.max(0, (i ?? sorted.length-1) - 1))}
            disabled={effIdx <= 0}
            className="rounded-lg p-1.5 transition"
            style={{ background:'rgba(255,255,255,0.06)', opacity: effIdx <= 0 ? 0.3 : 1 }}
          >
            <ChevronRight size={16} color="white" />
          </button>
          <span className="text-sm font-semibold text-white" style={{ minWidth: 110, textAlign:'center' }}>
            {selMonth ? fmtMonth(selMonth.month) : '—'}
          </span>
          <button
            onClick={() => setSelIdx(i => Math.min(sorted.length-1, (i ?? sorted.length-1) + 1))}
            disabled={effIdx >= sorted.length - 1}
            className="rounded-lg p-1.5 transition"
            style={{ background:'rgba(255,255,255,0.06)', opacity: effIdx >= sorted.length-1 ? 0.3 : 1 }}
          >
            <ChevronLeft size={16} color="white" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="סך העסקאות החודש"
          value={selDeals > 0 ? fmtFull(selDeals) : '—'}
          sub="עסקאות חדשות שנסגרו"
          color="#F5C118"
          trend={selDealsTrend}
          icon={TrendingUp}
        />
        <KpiCard
          label="כסף שנכנס בפועל"
          value={selIncome > 0 ? fmtFull(selIncome) : '—'}
          sub={fmtMonth(selMonth?.month)}
          trend={selIncTrend}
          color="#4ade80"
          icon={DollarSign}
        />
        <KpiCard
          label="צפוי לחודש הבא"
          value={nextMonthExpected > 0 ? fmtFull(nextMonthExpected) : '—'}
          sub={nextMonthExpected > 0 ? 'לפי תשלומים מתוזמנים' : 'אין תשלומים מתוזמנים'}
          color="#38bdf8"
          icon={Clock}
        />
        <KpiCard
          label="רווח אחרי הוצאות"
          value={selIncome > 0 ? fmtFull(selNet) : '—'}
          sub={selIncome > 0 ? `${selNetPct}% מרווח` : '—'}
          color={selNet >= 0 ? '#86efac' : '#fca5a5'}
          trend={selNetTrend}
          icon={Target}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────── */}
      <Tabs value={tab} onChange={setTab} />

      {/* ══════════════ TAB: OVERVIEW ══════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-4">

          {/* ① ANNUAL GOAL + CHART SIDE BY SIDE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Goal card */}
            <div className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color:'rgba(255,255,255,0.28)' }}>
                    הכנסה {new Date().getFullYear()} עד כה
                  </p>
                  <p className="text-4xl font-black text-white leading-none tracking-tight">
                    {fmtFull(ytdIncome)}
                  </p>
                  <p className="text-sm mt-1.5" style={{ color:'rgba(255,255,255,0.35)' }}>
                    רווח נטו {fmtILS(ytdNet)}
                    {ytdIncome > 0 && <span style={{ color:'rgba(255,255,255,0.22)' }}> · {Math.round(ytdNet/ytdIncome*100)}% מרווח</span>}
                  </p>
                </div>
                <div className="flex-none">
                  {editingGoal ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color:'rgba(255,255,255,0.5)' }}>₪</span>
                      <input ref={goalInputRef} type="number" min="0" value={goalDraft}
                        onChange={e => setGoalDraft(e.target.value)}
                        onKeyDown={e => { if (e.key==='Enter') saveGoal(); if (e.key==='Escape') setEditingGoal(false); }}
                        className="rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none w-28"
                        style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(245,193,24,0.4)' }} placeholder="מטרה שנתית" />
                      <button onClick={saveGoal} className="p-1.5 rounded-lg hover:bg-white/10"><Check size={14} style={{ color:'#F5C118' }} /></button>
                      <button onClick={() => setEditingGoal(false)} className="p-1.5 rounded-lg hover:bg-white/10"><X size={14} style={{ color:'rgba(255,255,255,0.35)' }} /></button>
                    </div>
                  ) : (
                    <button onClick={openGoalEdit} className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition hover:bg-white/08"
                      style={{ border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.45)' }}>
                      <Pencil size={11} />
                      {annualGoal > 0 ? `מטרה: ${fmtFull(annualGoal)}` : 'הכנס מטרה שנתית ל-2026'}
                    </button>
                  )}
                </div>
              </div>

              {annualGoal > 0 ? (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold" style={{ color:'rgba(255,255,255,0.4)' }}>
                      {goalPct >= 100 ? '🎉 השגת את המטרה!' : `נותר ${fmtFull(goalRemaining)}`}
                    </span>
                    <span className="text-lg font-black" style={{ color: goalPct>=100?'#4ade80':'#F5C118' }}>{goalPct}%</span>
                  </div>
                  <div className="rounded-full h-2.5 overflow-hidden mb-2" style={{ background:'rgba(255,255,255,0.06)' }}>
                    <div className="h-2.5 rounded-full transition-all duration-700" style={{
                      width:`${goalPct}%`,
                      background: goalPct>=100 ? 'linear-gradient(90deg,#4ade80,#86efac)'
                        : goalPct>=75 ? 'linear-gradient(90deg,#F5C118,#fcd34d)'
                        : goalPct>=40 ? 'linear-gradient(90deg,#f97316,#F5C118)'
                        : 'linear-gradient(90deg,#ef4444,#f97316)'
                    }} />
                  </div>
                  {monthlyNeeded > 0 && (
                    <p className="text-[11px]" style={{ color:'rgba(255,255,255,0.25)' }}>
                      כדי להגיע למטרה — ממוצע של {fmtILS(monthlyNeeded)} בחודש שנותר
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color:'rgba(255,255,255,0.2)' }}>הכנס מטרה שנתית ל-2026 כדי לראות את ההתקדמות שלך</p>
              )}
            </div>

            {/* Revenue trend chart */}
            <div className="rounded-2xl p-5" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">מגמת הכנסות</h2>
                  <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.25)' }}>{rangeN} חודשים אחרונים</p>
                </div>
                <RangePicker value={range} onChange={setRange} />
              </div>

              {/* Chart */}
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={revenueData} margin={{ top:6, right:4, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#F5C118" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#F5C118" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    {GRID}{XAXIS}{YILS}
                    <Tooltip content={<RevTip />} />
                    <Area type="monotone" dataKey="הכנסה" stroke="#F5C118" strokeWidth={2} fill="url(#revG)"
                      dot={{ r:3, fill:'#F5C118', stroke:'rgb(var(--bg-surface))', strokeWidth:1.5 }} />
                    <Area type="monotone" dataKey="נטו" stroke="#86efac" strokeWidth={1.5} fill="none"
                      strokeDasharray="4 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* מקרא */}
              <div className="flex gap-5 mt-3 pt-3 flex-wrap" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }} dir="rtl">
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-5 rounded" style={{ background:'#F5C118' }} />
                  <span className="text-[11px]" style={{ color:'rgba(255,255,255,0.45)' }}>הכנסה ברוטו — כל הכסף שנכנס</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-px w-5" style={{ borderTop:'1.5px dashed #86efac' }} />
                  <span className="text-[11px]" style={{ color:'rgba(255,255,255,0.45)' }}>רווח נטו — אחרי הפחתת הוצאות</span>
                </div>
              </div>
            </div>
          </div>

          {/* ② OUTSTANDING PAYMENTS (table) + SALES FUNNEL (visual) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Outstanding payments — table with dates */}
            <div className="rounded-2xl overflow-hidden" style={{
              background: totalOutstanding > 0 ? 'rgba(239,68,68,0.04)' : 'rgb(var(--bg-surface))',
              border: `1px solid ${totalOutstanding > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)'}`,
            }}>
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-sm font-bold text-white">תשלומים ממתינים</h2>
                <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.28)' }}>
                  {totalOutstanding > 0 ? `סה״כ ${fmtFull(totalOutstanding)} · ${outstandingItems.length} תשלומים` : 'אין תשלומים פתוחים'}
                </p>
              </div>
              {outstandingItems.length === 0 ? (
                <div className="px-5 pb-5 flex items-center gap-2">
                  <CheckCircle2 size={16} style={{ color:'#4ade80' }} />
                  <span className="text-sm" style={{ color:'rgba(255,255,255,0.4)' }}>כל התשלומים הושלמו ✓</span>
                </div>
              ) : (
                <>
                  <div className="grid px-5 pb-2" style={{ gridTemplateColumns:'1fr 80px 88px' }}>
                    {['לקוח','סכום','תאריך'].map(h => (
                      <span key={h} className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.18)' }}>{h}</span>
                    ))}
                  </div>
                  {outstandingItems.map((item, i) => {
                    const overdue = item.date && new Date(item.date) < new Date();
                    return (
                      <div key={i} className="grid px-5 py-2.5 items-center" style={{ gridTemplateColumns:'1fr 80px 88px', borderTop:'1px solid rgba(255,255,255,0.04)', background: overdue ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{item.clientName}</p>
                          <p className="text-[10px]" style={{ color:'rgba(255,255,255,0.28)' }}>{item.label}</p>
                        </div>
                        <p className="text-sm font-bold" style={{ color:'#fcd34d' }}>{fmtFull(item.amount)}</p>
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
                    <span className="text-sm font-black" style={{ color:'#fcd34d' }}>{fmtFull(totalOutstanding)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Financial health card */}
            {(() => {
              const businessProfit = curNet - desiredSalary;
              const expSoftware   = num(latest?.software_expenses);
              const expVariable   = num(latest?.variable_expenses);
              const expAds        = num(latest?.paid_ads);
              const yearMarginPct = ytdIncome > 0 ? Math.round(ytdNet / ytdIncome * 100) : null;
              const salaryPct     = curIncome > 0 ? Math.round(desiredSalary / curIncome * 100) : 0;
              const businessPct   = curIncome > 0 ? Math.round(businessProfit / curIncome * 100) : 0;

              return (
                <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white">בריאות פיננסית</h2>
                      <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.25)' }}>
                        נתוני <span style={{ color:'rgba(255,255,255,0.45)', fontWeight:600 }}>{fmtMonth(latest?.month)}</span> — החודש האחרון במערכת
                      </p>
                    </div>
                  </div>

                  {/* 3 numbers + bar */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { l:'הכנסה',   v:fmtFull(curIncome), c:'#F5C118' },
                      { l:'הוצאות',  v:fmtILS(curExp),     c:'rgba(255,255,255,0.55)' },
                      { l:'רווח נטו',v:fmtFull(curNet),    c: curNet>=0?'#4fc38a':'#ff5a72' },
                    ].map(({ l, v, c }) => (
                      <div key={l} className="rounded-xl px-3 py-2.5 text-center" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] mb-1" style={{ color:'rgba(255,255,255,0.3)' }}>{l}</p>
                        <p className="text-sm font-black leading-none" style={{ color:c }}>{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Visual bar: expenses | salary | business */}
                  {curIncome > 0 && (
                    <div className="rounded-full h-3 overflow-hidden flex gap-px" style={{ background:'rgba(255,255,255,0.06)' }}>
                      <div style={{ width:`${Math.min(100,Math.round(curExp/curIncome*100))}%`, background:'#ff5a72' }} />
                      {desiredSalary > 0 && <div style={{ width:`${Math.min(100-Math.round(curExp/curIncome*100), Math.round(desiredSalary/curIncome*100))}%`, background:'#F5C118' }} />}
                      <div style={{ flex:1, background:'#4fc38a' }} />
                    </div>
                  )}

                  {/* Salary row */}
                  <div className="flex items-center justify-between gap-3 pt-1" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2 flex-none">
                      <span className="text-xs" style={{ color:'rgba(255,255,255,0.38)' }}>משכורת חודשית לבית</span>
                      <div className="relative group">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold cursor-help"
                          style={{ background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.4)' }}>?</span>
                        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background:'rgba(8,9,22,0.97)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.7)' }} dir="rtl">
                          הסכום שאתה רוצה לקחת הביתה מהעסק כל חודש — כמה אתה צריך כדי לכסות את ההוצאות האישיות שלך: שכר דירה, אוכל, חשבונות, ולאיפה שאתה רוצה להגיע.
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
                        <span className="text-sm font-black" style={{ color: businessProfit>=0?'#4fc38a':'#ff5a72' }}>{fmtFull(businessProfit)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>



        </div>
      )}

      {/* ══════════════ TAB: SALES ══════════════════════ */}
      {tab === 'sales' && (
        <div className="space-y-4">

          {/* ── Conversion rates — front and center ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Leads → Calls */}
            <div className="rounded-2xl p-5" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(129,140,248,0.25)' }}>
              <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color:'rgba(255,255,255,0.35)' }}>המרה: לידים → שיחות מכירה</p>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-4xl font-black" style={{ color:'#818cf8' }}>
                  {convLeadToCall != null ? `${convLeadToCall}%` : '—'}
                </span>
                <span className="text-sm mb-1.5" style={{ color:'rgba(255,255,255,0.35)' }}>
                  {funnelTotals.calls_set} שיחות מתוך {funnelTotals.leads} לידים
                </span>
              </div>
              <div className="rounded-full h-2 overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-2 rounded-full transition-all duration-500" style={{ width:`${convLeadToCall ?? 0}%`, background:'#818cf8' }} />
              </div>
            </div>

            {/* Calls → Closings */}
            <div className="rounded-2xl p-5" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(74,222,128,0.25)' }}>
              <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color:'rgba(255,255,255,0.35)' }}>המרה: שיחות → סגירות</p>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-4xl font-black" style={{ color:'#4ade80' }}>
                  {convCallToClose != null ? `${convCallToClose}%` : '—'}
                </span>
                <span className="text-sm mb-1.5" style={{ color:'rgba(255,255,255,0.35)' }}>
                  {newClientsTotal} סגירות מתוך {funnelTotals.calls_showed} שיחות
                </span>
              </div>
              <div className="rounded-full h-2 overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-2 rounded-full transition-all duration-500" style={{ width:`${convCallToClose ?? 0}%`, background:'#4ade80' }} />
              </div>
            </div>
          </div>

          {/* ── Sales funnel chart ── */}
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
                  {GRID}
                  <XAxis dataKey="month" tick={{ fill:'rgba(255,255,255,0.28)', fontSize:11 }} axisLine={false} tickLine={false} />
                  {YCNT}
                  <Tooltip
                    contentStyle={{ background:'rgba(8,9,22,0.97)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, color:'white', fontSize:12, direction:'rtl' }}
                    cursor={{ fill:'rgba(30,58,120,0.35)' }}
                    formatter={(v, name) => [v, name]}
                  />
                  <Bar dataKey="הצעות" fill="#F5C118"          radius={[3,3,0,0]} />
                  <Bar dataKey="לידים"  fill="rgba(167,139,250,0.75)" radius={[3,3,0,0]} />
                  <Bar dataKey="שיחות" fill="rgba(99,102,241,0.75)"  radius={[3,3,0,0]} />
                  <Bar dataKey="סגירות" fill="#4ade80"          radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex gap-5 mt-2 flex-wrap" dir="rtl">
              {[
                { c:'#F5C118',                    l:'הצעות שהצעתי (כל סוג)' },
                { c:'rgba(167,139,250,0.9)',        l:'לידים שהגיעו' },
                { c:'rgba(99,102,241,0.9)',         l:'שיחות מכירה' },
                { c:'#4ade80',                    l:'סגירות' },
              ].map(x => (
                <div key={x.l} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background:x.c }} />
                  <span className="text-[11px]" style={{ color:'rgba(255,255,255,0.38)' }}>{x.l}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Price quotes (separate) ── */}
          <Section title="הצעות מחיר" sub="הצעות מחיר פורמליות שנשלחו ונסגרו">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { l:'נשלחו', v:funnelTotals.quotes_sent, c:'#38bdf8' },
                { l:'אושרו / נסגרו', v:funnelTotals.quotes_approved, c:'#4ade80' },
                { l:'אחוז סגירה', v:convQuoteToClose!=null ? `${convQuoteToClose}%` : '—', c:'#f472b6' },
              ].map(({l,v,c}) => (
                <div key={l} className="rounded-xl p-4 text-center" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color:'rgba(255,255,255,0.28)' }}>{l}</p>
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
        // Most profitable clients (by paid amount)
        const clientsRanked = [...clients]
          .map(c => ({
            name: c.name || 'לא ידוע',
            paid: computeClientPaid(c),
            total: num(c.deal_amount),
            outstanding: Math.max(0, num(c.deal_amount) - computeClientPaid(c)),
          }))
          .filter(c => c.total > 0)
          .sort((a, b) => b.paid - a.paid);

        const topClient = clientsRanked[0] ?? null;

        // New clients per month (delta in active_clients)
        const newClientsData = slice.map((m, i) => ({
          month: shortMonth(m.month),
          חדשים: i === 0 ? 0 : Math.max(0, num(m.active_clients) - num(slice[i-1]?.active_clients)),
        }));

        // Clients with outstanding debt
        const debtClients = clientsRanked.filter(c => c.outstanding > 0);

        return (
          <div className="space-y-4">

            {/* ── Hero metrics ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l:'לקוחות פעילים', v: activeClients ?? '—', c:'#34d399', sub:'לפי דיווח אחרון' },
                { l:'לקוחות חדשים', v: newClientsTotal > 0 ? `+${newClientsTotal}` : '—', c:'#F5C118', sub:`${rangeN} חודשים` },
                { l:'LTV ממוצע', v: ltv ? fmtILS(ltv) : '—', c:'#a78bfa', sub:`${clients.length} לקוחות` },
                { l:'הכי רווחי', v: topClient ? fmtILS(topClient.paid) : '—', c:'#38bdf8', sub: topClient?.name ?? '' },
              ].map(({ l, v, c, sub }) => (
                <div key={l} className="rounded-2xl p-4" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color:'rgba(255,255,255,0.28)' }}>{l}</p>
                  <p className="text-xl font-black leading-none" style={{ color:c }}>{v}</p>
                  {sub && <p className="text-[10px] mt-1" style={{ color:'rgba(255,255,255,0.28)' }}>{sub}</p>}
                </div>
              ))}
            </div>

            {/* ── Active clients trend + new clients ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="לקוחות פעילים לאורך זמן">
                <div dir="ltr">
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={clientData} margin={{ top:6, right:4, left:0, bottom:0 }}>
                      <defs>
                        <linearGradient id="clG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#34d399" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      {GRID}{XAXIS}{YCNT}
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
                      {GRID}{XAXIS}{YCNT}
                      <Tooltip {...TIP} formatter={v=>[v,'לקוחות חדשים']} cursor={{ fill:'rgba(30,58,120,0.35)' }} />
                      <Bar dataKey="חדשים" fill="#F5C118" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            {/* ── Top clients by revenue ── */}
            {clientsRanked.length > 0 && (
              <Section title="לקוחות לפי רווחיות" sub="לפי סכום ששולם בפועל" noPad>
                <div className="grid px-5 pb-2 mt-4" style={{ gridTemplateColumns:'1fr 90px 90px' }}>
                  {['לקוח','שולם','שווי עסקה'].map(h=>(
                    <span key={h} className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.2)' }}>{h}</span>
                  ))}
                </div>
                {clientsRanked.slice(0, 5).map((c, i) => (
                  <div key={i} className="grid px-5 py-3 items-center" style={{ gridTemplateColumns:'1fr 90px 90px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-none"
                        style={{ background: i===0?'rgba(245,193,24,0.15)':'rgba(255,255,255,0.06)', color: i===0?'#F5C118':'rgba(255,255,255,0.35)' }}>
                        {i+1}
                      </div>
                      <p className="text-sm font-semibold text-white">{c.name}</p>
                    </div>
                    <p className="text-sm font-bold" style={{ color:'#4fc38a' }}>{fmtFull(c.paid)}</p>
                    <p className="text-sm" style={{ color:'rgba(255,255,255,0.45)' }}>{fmtFull(c.total)}</p>
                  </div>
                ))}
              </Section>
            )}

            {/* ── Outstanding payments ── */}
            <Section
              title="לקוחות עם יתרה לתשלום"
              sub={debtClients.length > 0 ? `${debtClients.length} לקוחות · סה״כ ${fmtFull(totalOutstanding)}` : 'כל התשלומים הושלמו ✓'}
              noPad
            >
              {outstandingItems.length === 0 ? (
                <div className="flex items-center gap-3 p-5">
                  <CheckCircle2 size={18} style={{ color:'#4ade80' }} />
                  <span className="text-sm" style={{ color:'rgba(255,255,255,0.45)' }}>אין יתרות פתוחות</span>
                </div>
              ) : (
                <div>
                  <div className="grid gap-3 px-5 pb-2 mt-4" style={{ gridTemplateColumns:'1fr 80px 90px' }}>
                    {['לקוח / תיאור','סכום','תאריך'].map(h=>(
                      <span key={h} className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.2)' }}>{h}</span>
                    ))}
                  </div>
                  {outstandingItems.map((item, i) => {
                    const overdue = item.date && new Date(item.date) < new Date();
                    return (
                      <div key={i} className="grid gap-3 px-5 py-3 items-center"
                        style={{ gridTemplateColumns:'1fr 80px 90px', borderTop:'1px solid rgba(255,255,255,0.04)', background: overdue?'rgba(239,68,68,0.04)':'transparent' }}>
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight">{item.clientName}</p>
                          <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,0.32)' }}>{item.label}</p>
                        </div>
                        <p className="text-sm font-bold" style={{ color:'#fcd34d' }}>{fmtFull(item.amount)}</p>
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

          {/* Followers + posts chart */}
          <Section title="צמיחה ברשת החברתית" sub="עוקבים ופוסטים לאורך זמן">
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={igData} margin={{ top:8, right:4, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="igG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#e1306c" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#e1306c" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  {GRID}{XAXIS}
                  <YAxis yAxisId="left" tick={{ fill:'rgba(255,255,255,0.22)', fontSize:10 }} axisLine={false} tickLine={false}
                    tickFormatter={v=>v>=1000?`${Math.round(v/1000)}K`:v} width={40} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill:'rgba(255,255,255,0.22)', fontSize:10 }}
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
                  <span className="text-[10px]" style={{ color:'rgba(255,255,255,0.32)' }}>{x.l}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Content stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { l:'פוסטים בתקופה', v: slice.reduce((s,m)=>s+num(m.posts_count),0), c:'#fcd34d', sub:`${rangeN} חודשים` },
              { l:'ממוצע חודשי', v: slice.length>0 ? Math.round(slice.reduce((s,m)=>s+num(m.posts_count),0)/slice.length) : 0, c:'#a78bfa', sub:'פוסטים לחודש' },
              { l:'עוקבים נוכחיים', v: latest?.followers ? num(latest.followers).toLocaleString('he-IL') : '—', c:'#e1306c', sub:fmtMonth(latest?.month) },
            ].map(({l,v,c,sub})=>(
              <div key={l} className="rounded-xl p-4" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color:'rgba(255,255,255,0.28)' }}>{l}</p>
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
