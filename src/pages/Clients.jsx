import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useDialog } from '../components/Dialog.jsx';
import {
  Plus, Edit2, Trash2, X, Phone, Mail,
  TrendingUp, CheckCircle, AlertCircle, Briefcase,
  Calendar, ChevronDown, Check, FolderOpen, Clock, Archive, Eye, GripVertical,
  ExternalLink, LayoutTemplate, ChevronRight,
} from 'lucide-react';

// ── Client status ─────────────────────────────────────────────
const STATUS = {
  green:    { label: 'בריא',           color: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.30)'   },
  orange:   { label: 'דרוש תשומת לב', color: '#f97316', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.30)'  },
  red:      { label: 'לטפל דחוף',     color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.30)'   },
  inactive: { label: 'לא פעיל',       color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.20)' },
};
function normStatus(s) {
  if (STATUS[s]) return s;
  return { '#22c55e': 'green', '#f97316': 'orange', '#ef4444': 'red' }[s] || 'green';
}

// ── Project types ─────────────────────────────────────────────
const PROJECT_TYPES = {
  website:  { label: 'אתר',     color: '#60a5fa' },
  branding: { label: 'מיתוג',  color: '#f472b6' },
  logo:     { label: 'לוגו',   color: '#a78bfa' },
  ui:       { label: 'UI/UX',  color: '#34d399' },
  social:   { label: 'סושיאל', color: '#fb923c' },
  other:    { label: 'אחר',    color: '#94a3b8' },
};

// ── Project status ────────────────────────────────────────────
const PROJECT_STATUS = {
  not_started: { label: 'לא התחיל',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
  in_progress: { label: 'בעבודה',     color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)'  },
  review:      { label: 'פידבק לקוח', color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)'  },
  revisions:   { label: 'תיקונים',    color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)'  },
  completed:   { label: 'הושלם',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)'   },
  on_hold:     { label: 'מוקפא',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'   },
  cancelled:   { label: 'בוטל',       color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
};


const PRIORITY_GROUPS = [
  { key: 'now',   label: 'עכשיו',  color: '#22c55e', desc: 'בטיפול פעיל' },
  { key: 'soon',  label: 'בקרוב',  color: '#f59e0b', desc: 'בתור הבא'    },
  { key: 'later', label: 'אחר כך', color: '#64748b', desc: 'מתוכנן להמשך' },
];

// ── Forms ─────────────────────────────────────────────────────
// Client: only contact info — financials live in projects
const EMPTY_FORM = {
  name: '', phone: '', email: '', status: 'green', notes: '',
};
const EMPTY_PROJECT = {
  name: '', client_id: '', type: [], status: 'not_started',
  total_amount: '', received_amount: '', estimated_hours: '',
  installment_plan: [],
  stages: [],
  start_date: '', deadline: '', notes: '',
};

// ── Helpers ───────────────────────────────────────────────────
function fmt(n) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return '₪' + Number(n).toLocaleString('he-IL');
}
function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}
// Uses direct amount if stored, otherwise computes from percentage
function instAmt(inst, total) {
  if (!total) return 0;
  return (inst.amount != null && inst.amount !== 0 && inst.amount !== '0')
    ? Number(inst.amount)
    : Math.round((parseFloat(inst.percentage) || 0) / 100 * total);
}
function computePaid(plan, deal) {
  return plan.filter(i => i.paid).reduce((s, i) => s + instAmt(i, deal), 0);
}
function projectPaid(proj) {
  const hasPlan = proj.installment_plan?.length > 0;
  return hasPlan ? computePaid(proj.installment_plan, proj.total_amount) : (proj.received_amount || 0);
}

// ── StatusDot ─────────────────────────────────────────────────
function StatusDot({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const key = normStatus(status);
  const st  = STATUS[key];

  function handleOpen(e) {
    e.stopPropagation();
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  }

  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (
        dropRef.current    && !dropRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="relative flex-none">
      <button ref={triggerRef} onClick={handleOpen}
        title={st.label}
        className="flex items-center gap-0.5 rounded-full px-1.5 py-1 transition-all hover:bg-white/10"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: st.color, boxShadow: key === 'inactive' ? 'none' : `0 0 5px ${st.color}88` }} />
        <ChevronDown size={7} style={{ color: 'rgba(255,255,255,0.35)' }} />
      </button>
      {open && (
        <div ref={dropRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left,
            zIndex: 9999,
            background: 'rgb(var(--bg-elevated))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            borderRadius: 12, overflow: 'hidden', padding: '4px 0',
            minWidth: 160,
          }}>
          {Object.entries(STATUS).map(([k, s]) => (
            <button key={k} onClick={e => { e.stopPropagation(); onChange(k); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition hover:bg-white/5"
              style={{ color: 'rgba(255,255,255,0.75)' }}>
              <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: s.color }} />
              <span className="flex-1 text-right">{s.label}</span>
              {k === key && <Check size={11} style={{ color: s.color }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ProjectStatusBadge ────────────────────────────────────────
function ProjectStatusBadge({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const st = PROJECT_STATUS[status] || PROJECT_STATUS.not_started;

  function handleOpen(e) {
    e.stopPropagation();
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  }

  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (
        dropRef.current    && !dropRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="relative flex-none">
      <button ref={triggerRef} onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all"
        style={{ background: st.bg, border: `1px solid ${st.border}` }}>
        <span className="h-2 w-2 rounded-full flex-none" style={{ background: st.color }} />
        <span className="text-xs font-semibold" style={{ color: st.color }}>{st.label}</span>
        <ChevronDown size={10} style={{ color: st.color, opacity: 0.7 }} />
      </button>
      {open && (
        <div ref={dropRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left,
            zIndex: 9999,
            background: 'rgb(var(--bg-elevated))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            borderRadius: 12, overflow: 'hidden', padding: '4px 0',
            minWidth: 160,
          }}>
          {Object.entries(PROJECT_STATUS).map(([k, s]) => (
            <button key={k} onClick={e => { e.stopPropagation(); onChange(k); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition hover:bg-white/5"
              style={{ color: 'rgba(255,255,255,0.75)' }}>
              <span className="h-2 w-2 rounded-full flex-none" style={{ background: s.color }} />
              <span className="flex-1 text-right">{s.label}</span>
              {k === status && <Check size={11} style={{ color: s.color }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── InstallmentBuilder ────────────────────────────────────────
function InstallmentBuilder({ plan, dealAmount, onChange }) {
  const deal    = parseFloat(dealAmount) || 0;
  const usedPct = plan.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0);
  const usedAmt = plan.reduce((s, i) => s + (parseFloat(i.amount)     || 0), 0);
  const isValid = plan.length === 0 || (Math.abs(usedPct - 100) < 0.5 && (deal === 0 || Math.abs(usedAmt - deal) < 1));

  function add() {
    // Use exact ₪ remainder so totals always sum perfectly (no rounding gaps)
    const remainAmt = deal > 0 ? Math.max(0, deal - usedAmt) : 0;
    const remainPct = deal > 0 && remainAmt > 0
      ? parseFloat((remainAmt / deal * 100).toFixed(1))
      : Math.max(0, parseFloat((100 - usedPct).toFixed(1)));
    onChange([...plan, { id: Date.now(), label: '', percentage: String(remainPct), amount: deal > 0 ? String(remainAmt) : '', paid: false, date: '' }]);
  }
  function remove(id) {
    const newPlan = plan.filter(i => i.id !== id);
    // After removal, redistribute so total stays at 100% — scale last item if deal is set
    if (newPlan.length > 0 && deal > 0) {
      const newUsed = newPlan.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0);
      if (Math.abs(newUsed - 100) > 0.5) {
        const last = { ...newPlan[newPlan.length - 1] };
        const otherPct = newPlan.slice(0, -1).reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0);
        const fillPct  = parseFloat(Math.max(0, 100 - otherPct).toFixed(1));
        last.percentage = String(fillPct);
        last.amount     = String(Math.round(fillPct / 100 * deal));
        newPlan[newPlan.length - 1] = last;
      }
    }
    onChange(newPlan);
  }
  function updatePct(id, raw) {
    const otherPct = plan.filter(i => i.id !== id).reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0);
    const otherAmt = plan.filter(i => i.id !== id).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    let pct = raw === '' ? '' : Math.min(Math.max(0, parseFloat(raw) || 0), 100 - otherPct);
    let amt = '';
    if (pct !== '' && deal > 0) {
      const remaining = deal - otherAmt;
      amt = String(Math.min(Math.round(pct / 100 * deal), remaining));
      pct = Math.round(parseFloat(amt) / deal * 1000) / 10;
    }
    onChange(plan.map(i => i.id === id ? { ...i, percentage: pct === '' ? '' : String(pct), amount: amt } : i));
  }
  function updateAmt(id, raw) {
    const otherAmt = plan.filter(i => i.id !== id).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const amt = raw === '' ? '' : Math.min(Math.max(0, parseFloat(raw) || 0), deal > 0 ? deal - otherAmt : Infinity);
    const pct = amt !== '' && deal > 0 ? String(Math.round(amt / deal * 1000) / 10) : '';
    onChange(plan.map(i => i.id === id ? { ...i, amount: amt === '' ? '' : String(amt), percentage: pct } : i));
  }

  return (
    <div className="space-y-2">
      {plan.length > 0 && (
        <div className="flex items-center gap-1.5 mb-1 px-1">
          <div className="w-5 flex-none" />
          <div className="flex-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>תיאור</div>
          <div className="w-16 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>₪</div>
          <div className="w-12 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>%</div>
          <div className="w-14 text-center text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>תאריך</div>
          <div className="w-5 flex-none" />
        </div>
      )}
      {plan.map((inst, idx) => (
        <div key={inst.id} className="flex items-center gap-1.5">
          <button type="button" onClick={() => onChange(plan.map(i => i.id === inst.id ? { ...i, paid: !i.paid } : i))}
            className="h-5 w-5 rounded-full border-2 flex items-center justify-center flex-none transition"
            style={{ borderColor: inst.paid ? '#22c55e' : 'rgba(255,255,255,0.2)', background: inst.paid ? '#22c55e' : 'transparent' }}>
            {inst.paid && <Check size={10} strokeWidth={3} color="#fff" />}
          </button>
          <input placeholder={idx === 0 ? 'מקדמה' : 'תיאור'} value={inst.label}
            onChange={e => onChange(plan.map(i => i.id === inst.id ? { ...i, label: e.target.value } : i))}
            className="flex-1 min-w-0 rounded-lg px-2 py-2 text-sm outline-none"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
          <div className="relative flex-none w-16">
            <input type="number" min="0" value={inst.amount} onChange={e => updateAmt(inst.id, e.target.value)}
              onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} onWheel={e => e.currentTarget.blur()}
              className="w-full rounded-lg py-2 text-xs text-center outline-none"
              style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white', paddingLeft: 4, paddingRight: 14 }} />
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }}>₪</span>
          </div>
          <div className="relative flex-none w-12">
            <input type="number" min="0" max="100" value={inst.percentage} onChange={e => updatePct(inst.id, e.target.value)}
              onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} onWheel={e => e.currentTarget.blur()}
              className="w-full rounded-lg py-2 text-xs text-center outline-none"
              style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white', paddingLeft: 4, paddingRight: 14 }} />
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }}>%</span>
          </div>
          <input type="date" value={inst.date || ''} onChange={e => onChange(plan.map(i => i.id === inst.id ? { ...i, date: e.target.value } : i))}
            className="flex-none w-14 rounded-lg py-1.5 text-xs outline-none"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: inst.date ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)', paddingLeft: 2, paddingRight: 2, fontSize: 10 }} />
          <button type="button" onClick={() => remove(inst.id)} className="rounded-md p-1 hover:bg-red-500/20 transition flex-none" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs transition hover:opacity-70" style={{ color: 'rgba(255,255,255,0.45)' }}>
          <Plus size={12} /> הוסף תשלום
        </button>
        {plan.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            {deal > 0 && <span style={{ color: 'rgba(255,255,255,0.3)' }}>{fmt(usedAmt)} / {fmt(deal)}</span>}
            <span style={{ color: isValid ? '#86efac' : '#fcd34d', fontWeight: 600 }}>
              {isValid ? '✓ 100%' : deal > 0 && usedAmt > deal ? `חריגה של ${fmt(usedAmt - deal)}` : `${Math.round(usedPct * 10) / 10}% (חסר ${fmt(deal - usedAmt)})`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }}>
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-none"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.5)' }}><X size={18} /></button>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
        {/* Sticky footer */}
        {footer && (
          <div className="flex-none px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' };
const labelStyle = { color: 'rgba(255,255,255,0.5)' };
function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs" style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ── Workflow Templates (localStorage per user, up to 3) ───────
const MAX_WF = 3;
function loadWf(uid)      { try { return JSON.parse(localStorage.getItem(`wf_${uid}`) || '[]'); } catch { return []; } }
function saveWf(uid, tpl) { localStorage.setItem(`wf_${uid}`, JSON.stringify(tpl)); }

function StepListInput({ steps, onChange }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const inp = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 11px', fontSize: 13, color: 'rgba(255,255,255,0.9)', outline: 'none', fontFamily: 'inherit', flex: 1 };
  function addStep() {
    const t = draft.trim();
    if (!t) return;
    onChange([...steps, t]);
    setDraft('');
    inputRef.current?.focus();
  }
  return (
    <div>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgba(245,193,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#f5c518', flexShrink: 0 }}>{i + 1}</div>
          <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{s}</span>
          <button type="button" onClick={() => onChange(steps.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(252,165,165,0.5)', padding: 2, display: 'flex' }}><X size={12} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: steps.length ? 8 : 0 }}>
        <input
          ref={inputRef} style={inp} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
          placeholder={steps.length === 0 ? 'כתוב שלב ולחץ Enter או +' : 'שלב נוסף...'}
          dir="rtl"
        />
        <button type="button" onClick={addStep} style={{ background: '#f5c518', border: 'none', borderRadius: 8, width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={14} color="#000" />
        </button>
      </div>
    </div>
  );
}

function WfTemplateEditor({ template, onSave, onClose }) {
  const initSteps = template?.steps ? template.steps.split('\n').filter(Boolean) : [];
  const [name,  setName]  = useState(template?.name || '');
  const [steps, setSteps] = useState(initSteps);
  const base = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: 'rgba(255,255,255,0.9)', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
  return (
    <div onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{template ? 'עריכת תבנית' : 'תבנית חדשה'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={16} /></button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>שם התבנית</div>
          <input style={base} value={name} onChange={e => setName(e.target.value)} placeholder='למשל: "מיתוג" או "בניית אתר"' autoFocus />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>שלבי התהליך</div>
          <StepListInput steps={steps} onChange={setSteps} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>ביטול</button>
          <button onClick={() => name.trim() && steps.length && onSave({ name: name.trim(), steps: steps.join('\n') })}
            style={{ padding: '9px 18px', borderRadius: 8, background: '#f5c518', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, opacity: name.trim() && steps.length ? 1 : 0.4 }}>
            שמור תבנית
          </button>
        </div>
      </div>
    </div>
  );
}

function WfPanel({ userId, onApplyTemplate }) {
  const [templates,   setTemplates]   = useState(() => loadWf(userId));
  const [selectedId,  setSelectedId]  = useState(null);   // selected template id
  const [editorTpl,   setEditorTpl]   = useState(null);
  const [editingIdx,  setEditingIdx]  = useState(null);
  const [oneOff,      setOneOff]      = useState([]);      // one-time workflow steps

  function save({ name, steps }) {
    const updated = editingIdx !== null
      ? templates.map((t, i) => i === editingIdx ? { ...t, name, steps } : t)
      : [...templates, { id: Date.now(), name, steps }];
    saveWf(userId, updated); setTemplates(updated); setEditorTpl(null); setEditingIdx(null);
  }
  function del(idx) {
    const tpl     = templates[idx];
    const updated = templates.filter((_, i) => i !== idx);
    saveWf(userId, updated); setTemplates(updated);
    if (selectedId === tpl?.id) setSelectedId(null);
  }

  const selectedTpl = templates.find(t => t.id === selectedId);

  return (
    <div>
      {/* ── Saved templates ────────────────────────────────── */}
      {templates.map((tpl, idx) => {
        const isSel  = selectedId === tpl.id;
        const lines  = tpl.steps.split('\n').filter(Boolean);
        return (
          <div key={tpl.id} style={{ background: isSel ? 'rgba(245,193,24,0.07)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isSel ? 'rgba(245,193,24,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, overflow: 'hidden', marginBottom: 6, transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px' }}>
              {/* Selection toggle — also applies stages to project */}
              <button
                onClick={() => {
                  const next = isSel ? null : tpl.id;
                  setSelectedId(next);
                  if (onApplyTemplate) onApplyTemplate(next ? lines : []);
                }}
                style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${isSel ? '#f5c518' : 'rgba(255,255,255,0.2)'}`, background: isSel ? '#f5c518' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                {isSel && <Check size={11} color="#000" strokeWidth={3} />}
              </button>
              <span
                style={{ flex: 1, fontSize: 13, fontWeight: 600, color: isSel ? '#f5c518' : 'rgba(255,255,255,0.85)', cursor: 'pointer' }}
                onClick={() => {
                  const next = isSel ? null : tpl.id;
                  setSelectedId(next);
                  if (onApplyTemplate) onApplyTemplate(next ? lines : []);
                }}
              >
                {tpl.name}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{lines.length} שלבים</span>
              <button onClick={() => { setEditorTpl(tpl); setEditingIdx(idx); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 3, display: 'flex' }}><Edit2 size={11} /></button>
              <button onClick={() => del(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(252,165,165,0.5)', padding: 3, display: 'flex' }}><Trash2 size={11} /></button>
            </div>
            {/* Expanded steps when selected */}
            {isSel && (
              <div style={{ borderTop: '1px solid rgba(245,193,24,0.15)', padding: '10px 14px 12px' }}>
                {lines.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgba(245,193,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#f5c518', flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add template button */}
      {templates.length < MAX_WF
        ? <button onClick={() => { setEditorTpl({}); setEditingIdx(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed rgba(245,193,24,0.35)', borderRadius: 8, padding: '7px 13px', color: '#f5c518', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: templates.length ? 4 : 0 }}>
            <Plus size={12} /> {templates.length === 0 ? 'הוסף תבנית לתהליך עבודה' : `הוסף תבנית (${templates.length}/${MAX_WF})`}
          </button>
        : <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>מקסימום 3 תבניות — מחק אחת כדי להוסיף חדשה.</div>
      }

      {/* ── One-time workflow ──────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 14, paddingTop: 14 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>תהליך חד-פעמי לפרויקט זה</div>
        <StepListInput steps={oneOff} onChange={setOneOff} />
      </div>

      {editorTpl !== null && <WfTemplateEditor template={editingIdx !== null ? templates[editingIdx] : null} onSave={save} onClose={() => { setEditorTpl(null); setEditingIdx(null); }} />}
    </div>
  );
}

// ── ClientCard ────────────────────────────────────────────────
function ClientCard({ client, linkedProjects, onEdit, onDelete, onStatusChange, onViewProjects, onToggleProjectInstallment, onToggleFullPayment }) {
  const key = normStatus(client.status);
  const st  = STATUS[key];

  const totalValue     = linkedProjects.reduce((s, p) => s + (p.total_amount || 0), 0);
  const ltv            = linkedProjects.reduce((s, p) => s + projectPaid(p), 0);
  const totalRemaining = totalValue - ltv;

  // top-level card open/close
  const [isOpen,             setIsOpen]             = useState(false);
  // accordion state: which project installment drawers are open
  const [openAccordion,      setOpenAccordion]      = useState({});
  const toggleAccordion = id => setOpenAccordion(prev => ({ ...prev, [id]: !prev[id] }));
  // confirmation before marking inactive
  const [showInactiveConfirm, setShowInactiveConfirm] = useState(false);

  // links
  const [links,      setLinks]      = useState(client.links || []);
  const [addingLink, setAddingLink] = useState(false);
  const [newLink,    setNewLink]    = useState({ label: '', url: '' });
  const [savingLink, setSavingLink] = useState(false);

  async function persistLinks(updated) {
    setLinks(updated);
    await supabase.from('clients').update({ links: updated }).eq('id', client.id);
  }
  async function addLink() {
    const rawUrl = newLink.url.trim();
    if (!rawUrl) return;
    setSavingLink(true);
    const finalUrl = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
    const label    = newLink.label.trim() || finalUrl;
    await persistLinks([...links, { label, url: finalUrl }]);
    setNewLink({ label: '', url: '' });
    setAddingLink(false);
    setSavingLink(false);
  }
  async function removeLink(idx) {
    await persistLinks(links.filter((_, i) => i !== idx));
  }

  function handleStatusChange(s) {
    if (s === 'inactive') {
      const hasUnfinished = linkedProjects.some(p => p.status !== 'completed');
      const hasUnpaid     = totalRemaining > 0;
      if (hasUnfinished || hasUnpaid) {
        setShowInactiveConfirm(true);
        return;
      }
    }
    onStatusChange(client.id, s);
  }

  const joinDate = client.created_at
    ? new Date(client.created_at).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' })
    : null;

  const isInactive = key === 'inactive';

  return (
    <div className="rounded-2xl overflow-hidden group w-full"
      style={{
        background: 'rgb(var(--bg-surface))',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRight: `3px solid ${st.color}`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.25)',
        opacity: isInactive ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}>

      {/* ── COLLAPSED CARD (always visible) ── */}
      <div className="px-4 pt-3 pb-2 cursor-pointer" onClick={() => setIsOpen(o => !o)}>

        {/* Row 1: Name + meta  |  Status */}
        <div className="flex items-start gap-3 mb-2.5">

          {/* Right: eye + name + projects pill */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <Eye size={12} className="flex-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <span className="text-[14px] font-bold truncate leading-snug"
                style={{ color: isInactive ? 'rgba(255,255,255,0.5)' : 'white' }}>
                {client.name}
              </span>
              {linkedProjects.length > 0 && (
                <span className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 flex-none"
                  style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                  {linkedProjects.length} פרויקטים פעילים
                </span>
              )}
              {isInactive && (
                <span className="flex-none flex items-center gap-1 text-[10px] font-semibold rounded-md px-1.5 py-0.5"
                  style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' }}>
                  <Archive size={9} />לא פעיל
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {client.phone && (
                <a href={`tel:${client.phone}`} onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs transition hover:opacity-70"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Phone size={10} />{client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs transition hover:opacity-70"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Mail size={10} />{client.email}
                </a>
              )}
              {!client.phone && !client.email && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>אין פרטי קשר</span>
              )}
              {joinDate && (
                <span className="flex items-center gap-1 text-xs"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Calendar size={10} />הצטרף {joinDate}
                </span>
              )}
            </div>
          </div>

          {/* Edit/Delete — appear on hover, sit to the right of status in RTL */}
          <div className="flex-none flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
            onClick={e => e.stopPropagation()}>
            <button onClick={e => { e.stopPropagation(); onEdit(client); }}
              className="rounded-md p-1 hover:bg-white/10 transition" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <Edit2 size={11} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(client.id); }}
              className="rounded-md p-1 hover:bg-red-500/20 transition" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Trash2 size={11} />
            </button>
          </div>

          {/* Status — leftmost in RTL */}
          <div className="flex-none" onClick={e => e.stopPropagation()}>
            {isInactive ? (
              <button
                onClick={() => onStatusChange(client.id, 'green')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-80"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                הפוך לפעיל
              </button>
            ) : (
              <StatusDot status={key} onChange={handleStatusChange} />
            )}
          </div>
        </div>

        {/* ── Quick-links chips ── */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>

          {/* Existing link chips */}
          {links.map((lnk, idx) => (
            <span key={idx} className="group/chip relative inline-flex">
              <a href={lnk.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full text-[11px] font-medium px-2.5 py-0.5 transition hover:opacity-85"
                style={{ background: 'rgba(167,139,250,0.1)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.2)' }}>
                <ExternalLink size={9} />
                {lnk.label}
              </a>
              <button
                onClick={e => { e.stopPropagation(); removeLink(idx); }}
                className="absolute -top-1.5 -left-0.5 h-3.5 w-3.5 rounded-full hidden group-hover/chip:flex items-center justify-center"
                style={{ background: '#ef4444', color: 'white', border: '2px solid rgb(var(--bg-surface))' }}>
                <X size={7} strokeWidth={3} />
              </button>
            </span>
          ))}

          {/* + button — invisible until card hover */}
          {!addingLink && (
            <button
              onClick={() => setAddingLink(true)}
              className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] transition hover:opacity-80 ${links.length === 0 ? 'opacity-0 group-hover:opacity-100' : ''}`}
              style={{ color: 'rgba(167,139,250,0.5)', border: '1px dashed rgba(167,139,250,0.22)' }}>
              <Plus size={9} />
              {links.length === 0 && <span>קישור</span>}
            </button>
          )}

        </div>

        {/* Row 2: Remaining + progress bar */}
        {totalValue > 0 && (
          <div className="space-y-1.5 mt-3">
            <div className="flex items-center justify-between">
              {/* Right: label + remaining amount inline */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.32)' }}>נותר לתשלום</span>
                <span className="text-xs font-bold tabular-nums"
                  style={{ color: totalRemaining > 0 ? '#fcd34d' : '#86efac' }}>
                  {totalRemaining > 0 ? fmt(totalRemaining) : '✓ שולם הכל'}
                </span>
              </div>
              {/* Left: total project value */}
              <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {fmt(totalValue)}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, totalValue > 0 ? Math.round(ltv / totalValue * 100) : 0)}%`,
                  background: totalRemaining > 0
                    ? 'linear-gradient(to left, #fcd34d, #f59e0b)'
                    : '#22c55e',
                }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer: expand toggle */}
      <div className="px-3 py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setIsOpen(o => !o)}
          className="flex items-center gap-1 text-xs transition hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.28)' }}>
          <ChevronDown size={13} className="transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          {isOpen ? 'סגור' : 'פרטים נוספים'}
        </button>
      </div>

      {/* ── EXPANDED BODY ── */}
      {isOpen && (
        <>
          {/* Notes */}
          {client.notes && (
            <div className="px-4 pb-3 pt-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {client.notes}
              </span>
            </div>
          )}

          {/* Stats strip */}
          {linkedProjects.length > 0 && (
            <div className="flex"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex-1 px-3 py-3 text-center">
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(245,193,24,0.5)' }}>שווי לקוח כולל</div>
                <div className="text-base font-bold leading-none" style={{ color: ltv > 0 ? '#F5C118' : 'rgba(245,193,24,0.25)' }}>
                  {ltv > 0 ? fmt(ltv) : '₪0'}
                </div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
              <div className="flex-1 px-3 py-3 text-center">
                <div className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: totalRemaining > 0 ? 'rgba(252,211,77,0.45)' : 'rgba(134,239,172,0.45)' }}>
                  {totalRemaining > 0 ? 'נותר לתשלום' : 'שולם הכל'}
                </div>
                <div className="text-base font-bold leading-none"
                  style={{ color: totalRemaining > 0 ? '#fcd34d' : '#86efac' }}>
                  {fmt(totalRemaining > 0 ? totalRemaining : ltv)}
                </div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
              <div className="flex-1 px-3 py-3 text-center">
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(167,139,250,0.5)' }}>פרויקטים</div>
                <div className="text-base font-bold leading-none" style={{ color: '#a78bfa' }}>{linkedProjects.length}</div>
              </div>
            </div>
          )}

          {/* Projects + installments — always visible, no extra click needed */}
          {linkedProjects.length > 0 && (
            <div className="mx-4 mb-3 space-y-2" style={{ paddingTop: 12 }}>
              {linkedProjects.map(proj => {
                const plan      = proj.installment_plan || [];
                const hasPlan   = plan.length > 0;
                const fullPaid  = !hasPlan && (proj.received_amount || 0) >= (proj.total_amount || 1) && proj.total_amount > 0;
                const paidCount = plan.filter(i => i.paid).length;
                const allPaid   = hasPlan ? paidCount === plan.length : fullPaid;
                const nextIdx   = plan.findIndex(i => !i.paid);
                const pst       = PROJECT_STATUS[proj.status] || PROJECT_STATUS.not_started;
                const paidAmt   = projectPaid(proj);
                const paidPct   = proj.total_amount > 0 ? Math.min(Math.round(paidAmt / proj.total_amount * 100), 100) : 0;
                const iAmt      = inst => instAmt(inst, proj.total_amount);

                return (
                  <div key={proj.id} className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)' }}>

                    {/* ── Project header ── */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      {/* progress bar dot */}
                      <div className="flex-none w-1.5 h-1.5 rounded-full"
                        style={{ background: allPaid ? '#22c55e' : pst.color }} />
                      <span className="flex-1 text-xs font-semibold truncate"
                        style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {proj.name}
                      </span>
                      <span className="flex-none text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: pst.color, background: pst.bg, border: `1px solid ${pst.border}` }}>
                        {pst.label}
                      </span>
                      {proj.total_amount > 0 && (
                        <span className="flex-none text-[10px] tabular-nums font-semibold"
                          style={{ color: allPaid ? '#86efac' : '#fcd34d' }}>
                          {fmt(paidAmt)}<span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}> / {fmt(proj.total_amount)}</span>
                        </span>
                      )}
                      <button onClick={e => { e.stopPropagation(); onViewProjects(client.id); }}
                        className="flex-none text-xs opacity-30 hover:opacity-70 transition-opacity"
                        style={{ color: 'white' }} title="עבור לפרויקט">←</button>
                    </div>

                    {/* ── Payment progress bar ── */}
                    {proj.total_amount > 0 && (
                      <div className="h-[2px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full transition-all duration-500"
                          style={{ width: `${paidPct}%`, background: allPaid ? '#22c55e' : 'linear-gradient(to left, #fcd34d, #f59e0b)' }} />
                      </div>
                    )}

                    {/* ── Installments — always visible ── */}
                    {(hasPlan || proj.total_amount > 0) && (
                      <div className="px-3 pt-2 pb-3 space-y-1">

                        {/* No plan — single full payment */}
                        {!hasPlan && proj.total_amount > 0 && (
                          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                            style={{
                              background: fullPaid ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${fullPaid ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                            }}>
                            <button onClick={() => onToggleFullPayment(proj.id)}
                              className="h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center flex-none transition-all inst-check-btn"
                              style={{ borderColor: fullPaid ? '#22c55e' : 'rgba(255,255,255,0.3)', background: fullPaid ? '#22c55e' : 'transparent' }}>
                              {fullPaid && <Check size={8} strokeWidth={3.5} color="#fff" />}
                            </button>
                            <span className="flex-1 text-xs font-semibold"
                              style={{ color: fullPaid ? '#86efac' : 'rgba(255,255,255,0.8)' }}>
                              {fullPaid ? 'שולם במלואו ✓' : 'סמן כשולם'}
                            </span>
                            <span className="text-sm font-bold flex-none"
                              style={{ color: fullPaid ? '#86efac' : '#fcd34d' }}>
                              {fmt(proj.total_amount)}
                            </span>
                          </div>
                        )}

                        {/* Installment plan — all rows always visible */}
                        {hasPlan && plan.map((inst, idx) => {
                          const isPaid = inst.paid;
                          const isNext = idx === nextIdx;
                          const amt    = iAmt(inst);
                          return (
                            <div key={idx} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                              style={{
                                background: isNext && !isPaid ? 'rgba(255,255,255,0.04)' : 'transparent',
                                border: `1px solid ${isNext && !isPaid ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
                              }}>
                              <button onClick={() => onToggleProjectInstallment(proj.id, idx)}
                                className="h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center flex-none transition-all inst-check-btn"
                                style={{
                                  borderColor: isPaid ? '#22c55e' : isNext ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
                                  background: isPaid ? '#22c55e' : 'transparent',
                                  flexShrink: 0,
                                }}>
                                {isPaid && <Check size={8} strokeWidth={3.5} color="#fff" />}
                              </button>
                              <span className="flex-1 text-xs truncate"
                                style={{
                                  color: isPaid ? 'rgba(255,255,255,0.22)' : isNext ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
                                  textDecoration: isPaid ? 'line-through' : 'none',
                                  fontWeight: isNext && !isPaid ? 600 : 400,
                                }}>
                                {inst.label || `תשלום ${idx + 1}`}
                              </span>
                              {inst.date && !isPaid && (
                                <span className="flex-none text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                  {fmtDate(inst.date)}
                                </span>
                              )}
                              {amt > 0 && (
                                <span className="flex-none text-xs font-bold tabular-nums"
                                  style={{ color: isPaid ? 'rgba(255,255,255,0.15)' : isNext ? '#fcd34d' : 'rgba(255,255,255,0.35)' }}>
                                  {fmt(amt)}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* All paid banner */}
                        {hasPlan && allPaid && (
                          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 mt-1"
                            style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                            <Check size={12} strokeWidth={2.5} style={{ color: '#86efac' }} />
                            <span className="text-xs font-semibold" style={{ color: '#86efac' }}>כל התשלומים התקבלו</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {linkedProjects.length === 0 && (
            <div className="px-4 pb-4 pt-2 flex flex-col items-center gap-2 text-center">
              <Briefcase size={22} style={{ color: 'rgba(255,255,255,0.1)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>אין פרויקטים עדיין</span>
              <button onClick={() => onViewProjects(client.id)}
                className="text-xs font-semibold hover:opacity-80 transition"
                style={{ color: 'rgba(167,139,250,0.7)' }}>
                + הוסף פרויקט ראשון
              </button>
            </div>
          )}

          {/* Footer */}
          {linkedProjects.length > 0 && (
            <div className="px-4 py-2.5 flex items-center"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={() => onViewProjects(client.id)}
                className="flex items-center gap-1.5 text-xs hover:opacity-80 transition"
                style={{ color: 'rgba(167,139,250,0.6)' }}>
                <FolderOpen size={11} /> כל הפרויקטים ←
              </button>
            </div>
          )}
        </>
      )}

      {/* ── ADD LINK MODAL ── */}
      {addingLink && (
        <Modal
          title={`הוספת קישור — ${client.name}`}
          onClose={() => { setAddingLink(false); setNewLink({ label: '', url: '' }); }}>
          <div className="space-y-4">
            <Field label="שם הקישור">
              <input
                autoFocus
                value={newLink.label}
                onChange={e => setNewLink(n => ({ ...n, label: e.target.value }))}
                placeholder="לדוגמה: אתר, דרייב, תיק לקוח..."
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle} />
            </Field>
            <Field label="כתובת URL">
              <input
                value={newLink.url}
                onChange={e => setNewLink(n => ({ ...n, url: e.target.value }))}
                placeholder="https://..."
                onKeyDown={e => { if (e.key === 'Enter') addLink(); }}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle} />
            </Field>
            <button
              onClick={addLink}
              disabled={!newLink.url.trim() || savingLink}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-30 bg-accent text-accent-foreground">
              {savingLink ? 'שומר...' : 'הוסף קישור'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── INACTIVE CONFIRMATION POPUP ── */}
      {showInactiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setShowInactiveConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={18} style={{ color: '#f97316', flexShrink: 0 }} />
              <h3 className="text-sm font-semibold text-white">להעביר ללא פעיל?</h3>
            </div>
            <div className="mb-5 space-y-2">
              {linkedProjects.some(p => p.status !== 'completed') && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  ⚠️ ל<span className="font-bold text-white">{client.name}</span> יש פרויקטים שלא הסתיימו
                </p>
              )}
              {totalRemaining > 0 && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  💰 נותר תשלום פתוח של <span className="font-bold" style={{ color: '#fcd34d' }}>{fmt(totalRemaining)}</span>
                </p>
              )}
              <p className="text-xs pt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                האם אתה בטוח שברצונך להעביר לקוח זה ללא פעיל?
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowInactiveConfirm(false)}
                className="flex-1 rounded-lg py-2 text-sm font-semibold transition hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                ביטול
              </button>
              <button onClick={() => { setShowInactiveConfirm(false); onStatusChange(client.id, 'inactive'); }}
                className="flex-1 rounded-lg py-2 text-sm font-semibold transition hover:opacity-90"
                style={{ background: 'rgba(100,116,139,0.2)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.35)' }}>
                הפוך ללא פעיל
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ProjectCard ───────────────────────────────────────────────
function ProjectCard({ project, client, onEdit, onDelete, onStatusChange, onToggleStage }) {
  const [isOpen, setIsOpen] = useState(false);

  const types     = (Array.isArray(project.type) ? project.type : (project.type ? [project.type] : []))
                      .filter(k => PROJECT_TYPES[k])
                      .map(k => ({ key: k, ...PROJECT_TYPES[k] }));
  const type      = types[0] || { color: 'rgba(255,255,255,0.15)' }; // primary color for border
  const pst       = PROJECT_STATUS[project.status] || PROJECT_STATUS.not_started;
  const paidAmt   = projectPaid(project);
  const pct       = project.total_amount > 0 ? Math.min(Math.round(paidAmt / project.total_amount * 100), 100) : 0;
  const stages    = project.stages || [];
  const doneCount = stages.filter(s => s.done).length;
  const stagePct  = stages.length > 0 ? Math.round(doneCount / stages.length * 100) : 0;
  const isOverdue = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'completed';

  // Stage groups
  const withIdx   = stages.map((s, i) => ({ ...s, _idx: i }));
  const doneStages = withIdx.filter(s => s.done);
  const undone    = withIdx.filter(s => !s.done);
  const nextStage = undone[0] || null;
  const nextIdx   = nextStage ? nextStage._idx : -1;
  const upcoming  = undone.slice(1, 3);

  return (
    <div className="rounded-xl overflow-hidden group"
      style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)', borderRight: `3px solid ${type.color}`, boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>

      {/* ── Collapsed bar — table row layout ── */}
      <div className="transition-colors hover:bg-white/[0.03]">
        <div className="flex items-stretch">

          {/* Main clickable area */}
          <button onClick={() => setIsOpen(o => !o)}
            className="flex-1 flex items-stretch min-w-0 text-right">

            {/* Col A: name + client */}
            <div className="flex items-center gap-2 flex-1 min-w-0 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-semibold truncate text-white leading-tight">{project.name}</span>
                  {isOverdue && <span className="text-xs flex-none" style={{ color: '#ef4444' }}>⏰</span>}
                </div>
                {client && (
                  <div className="text-xs mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.38)' }}>{client.name}</div>
                )}
              </div>
            </div>

            {/* Col B: type badges */}
            {types.length > 0 && (
              <div className="hidden sm:flex items-center flex-none px-4 py-3"
                style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex flex-wrap gap-1.5">
                  {types.map(t => (
                    <span key={t.key}
                      className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-lg leading-none whitespace-nowrap"
                      style={{ background: t.color + '22', color: t.color, border: `1px solid ${t.color}40` }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Col C: paid / total */}
            {project.total_amount > 0 && (
              <div className="hidden sm:flex flex-col justify-center items-end flex-none px-4 py-3"
                style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] leading-none mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>שולם / סה״כ</span>
                <span className="text-[13px] font-semibold tabular-nums leading-none">
                  <span style={{ color: pct >= 100 ? '#86efac' : '#fcd34d' }}>{fmt(paidAmt)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}> / {fmt(project.total_amount)}</span>
                </span>
              </div>
            )}

            {/* Col C: estimated hours — sm+ */}
            {project.estimated_hours > 0 && (
              <div className="hidden sm:flex flex-col justify-center items-center w-16 flex-none px-3 py-3"
                style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] leading-none mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>שעות</span>
                <span className="flex items-center gap-0.5 text-sm font-bold leading-none" style={{ color: '#c4b5fd' }}>
                  <Clock size={10} className="flex-none" />{project.estimated_hours}
                </span>
              </div>
            )}

            {/* Col D: stage completion % — sm+ */}
            {stages.length > 0 && (
              <div className="hidden sm:flex flex-col justify-center items-center w-14 flex-none px-2 py-3"
                style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] leading-none mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>הושלם</span>
                <span className="text-sm font-bold tabular-nums leading-none"
                  style={{ color: stagePct === 100 ? '#86efac' : '#34d399' }}>
                  {stagePct === 100 ? '✓' : `${stagePct}%`}
                </span>
              </div>
            )}

            {/* Chevron */}
            <div className="flex items-center px-2 flex-none">
              <ChevronDown size={14} className="flex-none transition-transform duration-200"
                style={{ color: 'rgba(255,255,255,0.25)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
          </button>

          {/* Status badge + edit/delete */}
          <div className="flex items-center gap-1 px-2 flex-none"
            style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <ProjectStatusBadge status={project.status} onChange={s => onStatusChange(project.id, s)} />
            <div className="flex items-center gap-2 mr-2">
              <button onClick={e => { e.stopPropagation(); onEdit(project); }}
                className="rounded-lg p-1.5 hover:bg-white/10 transition" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <Edit2 size={13} />
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(project.id); }}
                className="rounded-lg p-1.5 hover:bg-red-500/20 transition" style={{ color: '#ef4444' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Full-width stage progress bar */}
        {stages.length > 0 && (
          <div className="h-1.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full transition-all duration-700"
              style={{
                width: `${stagePct}%`,
                background: stagePct === 100
                  ? '#22c55e'
                  : `linear-gradient(to left, #34d399, #10b981)`,
                boxShadow: stagePct > 0 ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
              }} />
          </div>
        )}
      </div>

      {/* ── Expanded body ── */}
      {isOpen && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Payment line */}
          {project.total_amount > 0 && (
            <div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
              <span className="text-xs font-bold" style={{ color: pct >= 100 ? '#86efac' : '#fcd34d' }}>
                {fmt(paidAmt)}
              </span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>שולם מתוך</span>
              <span className="text-xs font-semibold text-white">{fmt(project.total_amount)}</span>
              {pct >= 100
                ? <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>✓</span>
                : <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>({pct}%)</span>
              }
            </div>
          )}

          {/* Stages checklist */}
          {stages.length > 0 && (
            <div className="mx-4 mb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>

              {/* Done stages */}
              {doneStages.map(stage => (
                <div key={stage.id ?? stage._idx} className="flex items-center gap-2 mb-1.5">
                  <button onClick={() => onToggleStage(project.id, stage._idx)}
                    className="h-4 w-4 rounded-full border-2 flex items-center justify-center flex-none transition-all"
                    style={{ borderColor: '#22c55e', background: '#22c55e', flexShrink: 0 }} title="בטל סימון">
                    <Check size={8} strokeWidth={3.5} color="#fff" />
                  </button>
                  <span className="flex-1 text-xs truncate"
                    style={{ color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>
                    {stage.label}
                  </span>
                </div>
              ))}

              {doneStages.length > 0 && undone.length > 0 && (
                <div className="mb-2" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
              )}

              {/* Next stage */}
              {nextStage && (
                <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-1.5"
                  style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <button onClick={() => onToggleStage(project.id, nextIdx)}
                    className="h-[18px] w-[18px] rounded-full border-2 flex-none"
                    style={{ borderColor: 'rgba(52,211,153,0.7)', background: 'transparent', flexShrink: 0 }}
                    title="סמן כהושלם" />
                  <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {nextStage.label}
                  </span>
                  <span className="text-xs flex-none" style={{ color: 'rgba(52,211,153,0.45)' }}>
                    שלב {nextIdx + 1}
                  </span>
                </div>
              )}

              {/* Upcoming stages */}
              {upcoming.map(stage => (
                <div key={stage.id ?? stage._idx} className="flex items-center gap-2 mt-1 px-1">
                  <div className="h-3.5 w-3.5 rounded-full border flex-none"
                    style={{ borderColor: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                  <span className="text-xs flex-1 truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {stage.label}
                  </span>
                </div>
              ))}

              {!nextStage && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <Check size={14} strokeWidth={2.5} style={{ color: '#86efac' }} />
                  <span className="text-xs font-semibold" style={{ color: '#86efac' }}>כל השלבים הושלמו</span>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {(project.deadline || project.estimated_hours || project.notes) && (
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-0.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {project.deadline && (
                <span className="flex items-center gap-1 text-xs"
                  style={{ color: isOverdue ? '#fca5a5' : 'rgba(255,255,255,0.28)' }}>
                  <Calendar size={10} />{fmtDate(project.deadline)}
                </span>
              )}
              {project.estimated_hours > 0 && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  <Clock size={10} />{project.estimated_hours} שעות
                </span>
              )}
              {project.notes && (
                <span className="text-xs truncate max-w-[200px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {project.notes}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Clients() {
  const { user } = useUser();
  const userId   = user?.id;
  const location = useLocation();
  const dialog   = useDialog();

  // Clients state
  const [clients,      setClients]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [modal,        setModal]        = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);

  // Projects state
  const [tab,              setTab]              = useState('clients');
  const [projects,         setProjects]         = useState([]);
  const [projModal,        setProjModal]        = useState(null);
  const [projectForm,      setProjectForm]      = useState(EMPTY_PROJECT);
  const [filterProjStatus, setFilterProjStatus] = useState('all');
  const [filterClientId,   setFilterClientId]   = useState('all');
  const [projSaving,       setProjSaving]       = useState(false);

  const [noClientWarn,     setNoClientWarn]     = useState(false); // shown when trying to add project with no clients
  const [pendingProjForm,  setPendingProjForm]  = useState(null);  // project form saved while user creates a new client

  // Priority groups + drag state
  const [projGroups,    setProjGroups]    = useState({ now: [], soon: [], later: [] });
  const [draggingId,    setDraggingId]    = useState(null);
  const [draggingGroup, setDraggingGroup] = useState(null);
  const [dragOverId,    setDragOverId]    = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);

  useEffect(() => { if (userId) { loadClients(); loadProjects(); } }, [userId]);

  // Load saved priority groups from localStorage
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(`proj_groups_${userId}`);
      if (saved) setProjGroups(JSON.parse(saved));
    } catch {}
  }, [userId]);

  // Auto-open new client modal when navigated from Pipeline with a closed lead
  useEffect(() => {
    if (location.state?.openNewClient) {
      const prefill = location.state.prefillName || '';
      setForm({ ...EMPTY_FORM, name: prefill });
      setModal({ mode: 'add' });
      window.history.replaceState({}, '');
    }
    // Auto-open new project modal when navigated from Dashboard after new deal
    if (location.state?.openNewProject) {
      setTab('projects');
      setProjectForm({
        ...EMPTY_PROJECT,
        total_amount:    location.state.prefillTotalAmount    || '',
        received_amount: location.state.prefillReceivedAmount || '',
      });
      setProjModal({ mode: 'add' });
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  async function loadClients() {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    setClients(data || []);
    setLoading(false);
  }

  async function loadProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) console.error('[loadProjects] error:', error);
    setProjects(data || []);
  }

  // ── Client CRUD ───────────────────────────────────────────
  function openAdd() { setForm(EMPTY_FORM); setModal({ mode: 'add' }); }
  function openEdit(client) {
    setForm({
      name:   client.name   || '',
      phone:  client.phone  || '',
      email:  client.email  || '',
      status: normStatus(client.status),
      notes:  client.notes  || '',
    });
    setModal({ mode: 'edit', client });
  }
  async function saveClient() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        name:    form.name.trim(),
        phone:   form.phone.trim(),
        email:   form.email.trim(),
        status:  form.status,
        notes:   form.notes.trim(),
      };
      if (modal.mode === 'add') {
        const { data, error } = await supabase.from('clients').insert(payload).select().single();
        if (error) throw error;
        if (data) {
          setClients(prev => [data, ...prev]);
          // If we came from the project modal — reopen it with the new client pre-selected
          if (pendingProjForm !== null) {
            const saved = pendingProjForm;
            setPendingProjForm(null);
            setModal(null);
            setTab('projects');
            setProjectForm({ ...saved, client_id: data.id });
            setProjModal({ mode: 'add' });
            return;
          }
        }
      } else {
        const { error } = await supabase.from('clients').update(payload).eq('id', modal.client.id);
        if (error) throw error;
        setClients(prev => prev.map(c => c.id === modal.client.id ? { ...c, ...payload } : c));
      }
      setModal(null);
    } catch (err) { await dialog.alert('שגיאה: ' + err.message); }
    finally { setSaving(false); }
  }
  async function removeClient(id) {
    if (!await dialog.confirm('הלקוח ימחק לצמיתות.', { title: 'מחיקת לקוח', confirmText: 'מחיקה' })) return;
    setClients(prev => prev.filter(c => c.id !== id));
    await supabase.from('clients').delete().eq('id', id);
  }
  async function quickStatusChange(clientId, s) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: s } : c));
    // if client is being reactivated while the inactive filter is on, reset the filter so it appears
    if (s !== 'inactive' && filterStatus === 'inactive') setFilterStatus('all');
    await supabase.from('clients').update({ status: s }).eq('id', clientId);
  }

  // ── Project CRUD ──────────────────────────────────────────
  function openAddProject(clientId = '') {
    setProjectForm({ ...EMPTY_PROJECT, client_id: clientId });
    setProjModal({ mode: 'add' });
  }

  // Guard: can't open a project without at least one client
  function tryOpenAddProject(clientId = '') {
    if (clients.length === 0) {
      setNoClientWarn(true);
      setTab('clients');
    } else {
      setNoClientWarn(false);
      openAddProject(clientId);
    }
  }
  function openEditProject(project) {
    setProjectForm({
      name:             project.name       || '',
      client_id:        project.client_id  || '',
      type:             Array.isArray(project.type) ? project.type : (project.type ? [project.type] : []),
      status:           project.status     || 'not_started',
      total_amount:     project.total_amount     != null ? String(project.total_amount)     : '',
      received_amount:  project.received_amount  != null ? String(project.received_amount)  : '',
      estimated_hours:  project.estimated_hours  != null ? String(project.estimated_hours)  : '',
      installment_plan: (project.installment_plan || []).map((inst, i) => ({
        id: i, label: inst.label || '',
        percentage: String(parseFloat(inst.percentage) || ''),
        amount:     String(parseFloat(inst.amount) || ''),
        paid: inst.paid || false, date: inst.date || '',
      })),
      stages:     (project.stages || []).map((s, i) => ({ id: s.id ?? i, label: s.label, done: s.done || false })),
      start_date: project.start_date || '',
      deadline:   project.deadline   || '',
      notes:      project.notes      || '',
    });
    setProjModal({ mode: 'edit', project });
  }
  async function saveProject() {
    if (!projectForm.name.trim()) return;
    setProjSaving(true);
    try {
      const planToSave = projectForm.installment_plan.map(({ id, ...r }) => ({
        label: r.label, percentage: parseFloat(r.percentage) || 0,
        amount: parseFloat(r.amount) || 0, paid: r.paid, date: r.date || null,
      }));
      const computedReceived = planToSave.length > 0
        ? computePaid(planToSave, parseFloat(projectForm.total_amount) || 0)
        : parseFloat(projectForm.received_amount) || 0;

      const payload = {
        user_id:         userId,
        name:            projectForm.name.trim(),
        client_id:       projectForm.client_id || null,
        type:            projectForm.type,
        status:          projectForm.status,
        total_amount:    parseFloat(projectForm.total_amount) || 0,
        received_amount: computedReceived,
        estimated_hours: parseFloat(projectForm.estimated_hours) || null,
        installment_plan: planToSave,
        stages:          (projectForm.stages || []).map(({ id, ...s }) => s),
        start_date:      projectForm.start_date || null,
        deadline:        projectForm.deadline   || null,
        notes:           projectForm.notes.trim(),
      };
      if (projModal.mode === 'add') {
        const { data, error } = await supabase.from('projects').insert(payload).select().single();
        if (error) throw error;
        if (data) setProjects(prev => [data, ...prev]);
      } else {
        const { error } = await supabase.from('projects').update(payload).eq('id', projModal.project.id);
        if (error) throw error;
        setProjects(prev => prev.map(p => p.id === projModal.project.id ? { ...p, ...payload } : p));
      }
      setProjModal(null);
      // Brief success toast
      const t = document.createElement('div');
      t.textContent = projModal.mode === 'add' ? '✅ פרויקט נוסף בהצלחה' : '✅ הפרויקט עודכן';
      Object.assign(t.style, { position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', background:'#22c55e', color:'#fff', fontWeight:700, fontSize:'14px', padding:'10px 24px', borderRadius:'12px', zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.3)', transition:'opacity 0.3s' });
      document.body.appendChild(t);
      setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
    } catch (err) {
      console.error('[saveProject]', err);
      await dialog.alert('שגיאה בשמירה: ' + err.message);
    }
    finally { setProjSaving(false); }
  }
  async function removeProject(id) {
    if (!await dialog.confirm('הפרויקט ימחק לצמיתות.', { title: 'מחיקת פרויקט', confirmText: 'מחיקה' })) return;
    setProjects(prev => prev.filter(p => p.id !== id));
    await supabase.from('projects').delete().eq('id', id);
  }
  async function quickProjStatusChange(projId, s) {
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, status: s } : p));
    await supabase.from('projects').update({ status: s }).eq('id', projId);
  }
  async function toggleStage(projId, idx) {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    const newStages = (proj.stages || []).map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, stages: newStages } : p));
    await supabase.from('projects').update({ stages: newStages }).eq('id', projId);
  }
  async function toggleProjectInstallment(projId, idx) {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    const newPlan     = (proj.installment_plan || []).map((inst, i) => i === idx ? { ...inst, paid: !inst.paid } : inst);
    const newReceived = computePaid(newPlan, proj.total_amount || 0);
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, installment_plan: newPlan, received_amount: newReceived } : p));
    await supabase.from('projects').update({ installment_plan: newPlan, received_amount: newReceived }).eq('id', projId);
  }
  // Toggle full payment for projects with no installment plan
  async function toggleProjectFullPayment(projId) {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    const alreadyPaid = (proj.received_amount || 0) >= (proj.total_amount || 0) && proj.total_amount > 0;
    const newReceived = alreadyPaid ? 0 : (proj.total_amount || 0);
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, received_amount: newReceived } : p));
    await supabase.from('projects').update({ received_amount: newReceived }).eq('id', projId);
  }

  // ── Stats ─────────────────────────────────────────────────
  const totalProjValue    = projects.reduce((s, p) => s + (p.total_amount || 0), 0);
  const totalProjReceived = projects.reduce((s, p) => s + projectPaid(p), 0);
  const inProgressCount   = projects.filter(p => p.status === 'in_progress').length;
  const overdueCount      = projects.filter(p => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'completed').length;
  const redCount          = clients.filter(c => normStatus(c.status) === 'red').length;

  // ממוצע LTV: לכל לקוח מחשבים כמה שילם → ממוצעים את כולם
  const activeClientsForLtv = clients.filter(c => normStatus(c.status) !== 'inactive');
  const avgLTV = (() => {
    if (activeClientsForLtv.length === 0) return 0;
    const perClient = activeClientsForLtv.map(c => {
      const clientProjects = projects.filter(p => p.client_id === c.id);
      return clientProjects.reduce((s, p) => s + projectPaid(p), 0);
    });
    return Math.round(perClient.reduce((s, v) => s + v, 0) / perClient.length);
  })();

  // ── Filtered lists ────────────────────────────────────────
  const activeClients   = clients.filter(c => normStatus(c.status) !== 'inactive');
  const inactiveClients = clients.filter(c => normStatus(c.status) === 'inactive');

  // לקוחות שמאחרים בתשלום: לקוחות פעילים עם יתרה שלא שולמה
  const clientsWithUnpaid = activeClients.filter(c => {
    const cp    = projects.filter(p => p.client_id === c.id);
    const total = cp.reduce((s, p) => s + (p.total_amount || 0), 0);
    const paid  = cp.reduce((s, p) => s + projectPaid(p), 0);
    return total > 0 && paid < total;
  }).length;

  const filteredClients = (() => {
    if (filterStatus === 'inactive') return inactiveClients;
    const base = activeClients;
    if (filterStatus === 'all') return base;
    return base.filter(c => normStatus(c.status) === filterStatus);
  })();

  const filteredProjects = projects.filter(p => {
    if (filterProjStatus !== 'all' && p.status !== filterProjStatus) return false;
    if (filterClientId   !== 'all' && p.client_id !== filterClientId)  return false;
    return true;
  });

  // ── Priority group helpers ────────────────────────────────
  // Auto-assign a project to a group based on its deadline (used when no manual group is saved)
  function getAutoGroup(project) {
    if (!project.deadline) return 'later';
    const diffDays = (new Date(project.deadline) - new Date()) / 86400000;
    if (diffDays <= 14) return 'now';   // overdue or within 2 weeks
    if (diffDays <= 42) return 'soon';  // within 6 weeks
    return 'later';
  }

  function sortByDeadline(list) {
    return [...list].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
  }

  function getGroupProjects(groupKey) {
    const allAssigned = new Set([
      ...(projGroups.now   || []),
      ...(projGroups.soon  || []),
      ...(projGroups.later || []),
    ]);
    // Manually placed projects for this group (in saved order)
    const assigned = (projGroups[groupKey] || [])
      .map(id => filteredProjects.find(p => p.id === id))
      .filter(Boolean);
    // Unassigned projects that auto-belong to this group (sorted by deadline)
    const autoHere = sortByDeadline(
      filteredProjects.filter(p => !allAssigned.has(p.id) && getAutoGroup(p) === groupKey)
    );
    return [...assigned, ...autoHere];
  }

  // ── Priority group drag handlers ──────────────────────────
  function handleDragStart(id, group) {
    setDraggingId(id);
    setDraggingGroup(group);
  }
  function handleDragEnd() {
    setDraggingId(null);
    setDraggingGroup(null);
    setDragOverId(null);
    setDragOverGroup(null);
  }
  function handleDragOverItem(e, id, group) {
    e.preventDefault();
    setDragOverId(id);
    setDragOverGroup(group);
  }
  function handleDragOverGroup(e, group) {
    e.preventDefault();
    setDragOverId(null);
    setDragOverGroup(group);
  }
  function commitDrop(targetId, targetGroup) {
    if (!draggingId) return;
    const allAssigned = new Set([
      ...(projGroups.now   || []),
      ...(projGroups.soon  || []),
      ...(projGroups.later || []),
    ]);
    // Build full effective ordered id lists (includes auto-assigned unassigned projects)
    const eff = {
      now:   (projGroups.now   || []).filter(id => filteredProjects.some(p => p.id === id)),
      soon:  (projGroups.soon  || []).filter(id => filteredProjects.some(p => p.id === id)),
      later: (projGroups.later || []).filter(id => filteredProjects.some(p => p.id === id)),
    };
    // Append unassigned projects into their auto-group (sorted by deadline)
    sortByDeadline(filteredProjects.filter(p => !allAssigned.has(p.id))).forEach(p => {
      eff[getAutoGroup(p)].push(p.id);
    });
    // Remove dragging item from all groups
    Object.keys(eff).forEach(k => { eff[k] = eff[k].filter(id => id !== draggingId); });
    // Insert into target group
    if (targetId) {
      const idx = eff[targetGroup].indexOf(targetId);
      if (idx !== -1) eff[targetGroup].splice(idx, 0, draggingId);
      else            eff[targetGroup].push(draggingId);
    } else {
      eff[targetGroup].push(draggingId);
    }
    setProjGroups(eff);
    localStorage.setItem(`proj_groups_${userId}`, JSON.stringify(eff));
    setDraggingId(null);
    setDraggingGroup(null);
    setDragOverId(null);
    setDragOverGroup(null);
  }

  // ── Project form helpers ──────────────────────────────────
  const projDeal    = parseFloat(projectForm.total_amount) || 0;
  const projHasPlan = (projectForm.installment_plan || []).length > 0;
  const projPaid    = projHasPlan
    ? computePaid(projectForm.installment_plan.map(i => ({ ...i, percentage: parseFloat(i.percentage) || 0 })), projDeal)
    : parseFloat(projectForm.received_amount) || 0;

  if (loading) return (
    <div className="grid grid-cols-1 mid:grid-cols-2 wide:grid-cols-3 gap-4">
      {[1,2,3,4,5,6].map(i => <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: 'rgb(var(--bg-surface))' }} />)}
    </div>
  );

  return (
    <div className="w-full space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">לקוחות ופרויקטים</h1>
        <button
          onClick={() => tab === 'clients' ? openAdd() : tryOpenAddProject()}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 bg-accent text-accent-foreground">
          <Plus size={16} /> {tab === 'clients' ? 'הוסף לקוח' : 'הוסף פרויקט'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 w-fit"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {[
          { key: 'clients',  label: `לקוחות (${activeClients.length})` },
          { key: 'projects', label: `פרויקטים (${projects.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setNoClientWarn(false); }}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
            style={tab === t.key
              ? { background: 'rgba(255,255,255,0.1)', color: 'white' }
              : { color: 'rgba(255,255,255,0.4)' }
            }>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ CLIENTS TAB ═══════════════════════════════════════ */}
      {tab === 'clients' && (
        <>
          {clients.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'לקוחות פעילים',           value: String(activeClients.length),             icon: TrendingUp,  iconColor: '#a5b4fc' },
                { label: 'נשאר לגביה',              value: fmt(totalProjValue - totalProjReceived),  icon: AlertCircle, iconColor: totalProjValue - totalProjReceived > 0 ? '#fcd34d' : '#86efac' },
                { label: 'שווי לקוח ממוצע (LTV)',   value: avgLTV > 0 ? fmt(avgLTV) : '—',          icon: CheckCircle, iconColor: '#86efac' },
                { label: 'מאחרים בתשלום',           value: String(clientsWithUnpaid),               icon: Briefcase,   iconColor: clientsWithUnpaid > 0 ? '#fca5a5' : '#86efac' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 sm:p-5 flex items-center gap-2 sm:gap-4"
                  style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex-none h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: s.iconColor + '1a', color: s.iconColor }}>
                    <s.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-xs mb-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
                    <div className="text-base sm:text-xl lg:text-2xl font-bold text-white leading-none truncate">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Banner: must create a client before a project ── */}
          {noClientWarn && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(245,193,24,0.08)', border: '1px solid rgba(245,193,24,0.25)' }}>
              <span className="text-sm flex-1" style={{ color: 'rgba(245,193,24,0.9)' }}>
                כדי ליצור פרויקט, יש ליצור לקוח קודם — הוסף לקוח ואחר כך תוכל לפתוח פרויקט
              </span>
              <button
                onClick={() => { setNoClientWarn(false); openAdd(); }}
                className="flex-none flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition hover:opacity-90"
                style={{ background: 'rgba(245,193,24,0.18)', color: '#fcd34d', border: '1px solid rgba(245,193,24,0.35)' }}>
                <Plus size={12} /> הוסף לקוח
              </button>
              <button onClick={() => setNoClientWarn(false)}
                style={{ color: 'rgba(255,255,255,0.3)' }} className="hover:opacity-70">
                <X size={15} />
              </button>
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-center">

            {/* Inactive toggle */}
            {inactiveClients.length > 0 && (
              <button onClick={() => setFilterStatus(filterStatus === 'inactive' ? 'all' : 'inactive')}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                style={filterStatus === 'inactive'
                  ? { background: 'rgba(100,116,139,0.2)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.35)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Archive size={11} />
                לא פעילים
                <span className="rounded-full px-1.5 py-0.5 text-xs"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>{inactiveClients.length}</span>
              </button>
            )}
          </div>

          {/* ── Status legend ── */}
          {clients.length > 0 && (
            <div className="flex items-center gap-4 flex-wrap">
              {[
                { key: 'green',    label: 'בריא' },
                { key: 'orange',   label: 'דרוש תשומת לב' },
                { key: 'red',      label: 'לטפל דחוף' },
                { key: 'inactive', label: 'לא פעיל' },
              ].map(({ key: k, label }) => (
                <span key={k} className="flex items-center gap-1.5 text-xs"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <span className="h-2 w-2 rounded-full flex-none"
                    style={{ background: STATUS[k].color, boxShadow: `0 0 4px ${STATUS[k].color}88` }} />
                  {label}
                </span>
              ))}
            </div>
          )}

          {filteredClients.length === 0 ? (
            <div className="rounded-2xl p-8 sm:p-16 flex flex-col items-center text-center"
              style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Briefcase size={44} style={{ color: 'rgba(255,255,255,0.12)', marginBottom: 16 }} />
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem' }}>
                {filterStatus === 'all' ? 'טרם נוספו לקוחות' : filterStatus === 'inactive' ? 'אין לקוחות לא פעילים' : 'אין לקוחות בסטטוס זה'}
              </p>
              {filterStatus === 'all' && clients.length === 0 && (
                <button onClick={openAdd} className="mt-5 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-accent text-accent-foreground">
                  <Plus size={14} /> הוסף לקוח ראשון
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 mid:grid-cols-2 wide:grid-cols-3 gap-4 items-start">
              {filteredClients.map(client => (
                <ClientCard
                  key={client.id}
                  client={client}
                  linkedProjects={projects.filter(p => p.client_id === client.id)}
                  onEdit={openEdit}
                  onDelete={removeClient}
                  onStatusChange={quickStatusChange}
                  onViewProjects={id => { setFilterClientId(id); setTab('projects'); }}
                  onToggleProjectInstallment={toggleProjectInstallment}
                  onToggleFullPayment={toggleProjectFullPayment}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ PROJECTS TAB ══════════════════════════════════════ */}
      {tab === 'projects' && (
        <>
          {projects.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'פרויקטים',   value: String(projects.length),               icon: FolderOpen,  iconColor: '#a78bfa' },
                { label: 'שווי כולל',  value: fmt(totalProjValue),                   icon: Briefcase,   iconColor: '#67e8f9' },
                { label: 'התקבל',      value: fmt(totalProjReceived),                icon: CheckCircle, iconColor: '#86efac' },
                {
                  label: overdueCount > 0 ? 'באיחור' : 'בעבודה',
                  value: overdueCount > 0 ? String(overdueCount) : String(inProgressCount),
                  icon: AlertCircle, iconColor: overdueCount > 0 ? '#fca5a5' : '#60a5fa',
                },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 sm:p-5 flex items-center gap-2 sm:gap-4"
                  style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex-none h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: s.iconColor + '1a', color: s.iconColor }}>
                    <s.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-xs mb-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
                    <div className="text-base sm:text-xl lg:text-2xl font-bold text-white leading-none truncate">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              {[
                { key: 'all', label: 'הכל', count: projects.length },
                ...Object.entries(PROJECT_STATUS).map(([k, s]) => ({
                  key: k, label: s.label, color: s.color,
                  count: projects.filter(p => p.status === k).length,
                })),
              ].filter(f => f.key === 'all' || f.count > 0).map(f => (
                <button key={f.key} onClick={() => setFilterProjStatus(f.key)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                  style={filterProjStatus === f.key
                    ? { background: 'rgba(245,193,24,0.15)', color: '#F5C118', border: '1px solid rgba(245,193,24,0.35)' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {f.color && <span className="h-2 w-2 rounded-full flex-none" style={{ background: f.color }} />}
                  {f.label}
                  <span className="rounded-full px-1.5 py-0.5 text-xs"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>{f.count}</span>
                </button>
              ))}
              {clients.length > 0 && (
                <select value={filterClientId} onChange={e => setFilterClientId(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-xs outline-none"
                  style={{
                    background: filterClientId !== 'all' ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.05)',
                    color:      filterClientId !== 'all' ? '#c4b5fd'               : 'rgba(255,255,255,0.45)',
                    border:     filterClientId !== 'all' ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  <option value="all">כל הלקוחות</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            {/* Drag hint */}
            <div className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <GripVertical size={11} />
              <span className="hidden sm:inline">גרור בין קבוצות לשינוי עדיפות</span>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl p-8 sm:p-16 flex flex-col items-center text-center"
              style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
              <FolderOpen size={44} style={{ color: 'rgba(255,255,255,0.12)', marginBottom: 16 }} />
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem' }}>אין פרויקטים להצגה</p>
              <button onClick={() => tryOpenAddProject()} className="mt-5 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-accent text-accent-foreground">
                <Plus size={14} /> הוסף פרויקט ראשון
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {PRIORITY_GROUPS.map(group => {
                const groupProjects = getGroupProjects(group.key);
                const isGroupOver   = dragOverGroup === group.key && !dragOverId;

                return (
                  <div key={group.key}>
                    {/* Group header — doubles as drop zone */}
                    <div
                      onDragOver={e => handleDragOverGroup(e, group.key)}
                      onDrop={e => { e.preventDefault(); commitDrop(null, group.key); }}
                      className="flex items-center gap-2 mb-2 px-1 py-1.5 rounded-lg transition-colors"
                      style={isGroupOver ? { background: `${group.color}12` } : {}}>
                      <span className="h-2.5 w-2.5 rounded-full flex-none"
                        style={{ background: group.color, boxShadow: `0 0 6px ${group.color}88` }} />
                      <span className="text-sm font-bold" style={{ color: group.color }}>{group.label}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{group.desc}</span>
                      <span className="text-xs font-semibold rounded-full px-2 py-0.5 ml-auto"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.38)' }}>
                        {groupProjects.length}
                      </span>
                    </div>

                    {/* Cards list */}
                    {groupProjects.length === 0 ? (
                      <div
                        onDragOver={e => handleDragOverGroup(e, group.key)}
                        onDrop={e => { e.preventDefault(); commitDrop(null, group.key); }}
                        className="rounded-xl border-2 border-dashed py-6 text-center text-xs transition-all"
                        style={{
                          borderColor: isGroupOver ? group.color        : 'rgba(255,255,255,0.07)',
                          color:       isGroupOver ? group.color        : 'rgba(255,255,255,0.2)',
                          background:  isGroupOver ? `${group.color}08` : 'transparent',
                        }}>
                        {isGroupOver ? '↓ שחרר כאן' : 'גרור פרויקט לכאן'}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {groupProjects.map(project => {
                          const isOver = dragOverId === project.id && draggingId !== project.id;
                          return (
                            <div
                              key={project.id}
                              draggable
                              onDragStart={e => { e.stopPropagation(); handleDragStart(project.id, group.key); }}
                              onDragOver={e => handleDragOverItem(e, project.id, group.key)}
                              onDrop={e => { e.preventDefault(); commitDrop(project.id, group.key); }}
                              onDragEnd={handleDragEnd}
                              style={{
                                opacity:      draggingId === project.id ? 0.3 : 1,
                                outline:      isOver ? `2px solid ${group.color}70` : '2px solid transparent',
                                outlineOffset: isOver ? '2px' : '0px',
                                borderRadius: 12,
                                transition:   'opacity 0.15s, outline 0.1s',
                                cursor:       draggingId ? 'grabbing' : 'grab',
                              }}>
                              <ProjectCard
                                project={project}
                                client={clients.find(c => c.id === project.client_id)}
                                onEdit={openEditProject}
                                onDelete={removeProject}
                                onStatusChange={quickProjStatusChange}
                                onToggleStage={toggleStage}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ CLIENT MODAL (simplified — contact info only) ═════ */}
      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'הוסף לקוח חדש' : `ערוך — ${modal.client?.name}`}
          onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="שם הלקוח *">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ישראל ישראלי" autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </Field>
              <Field label="טלפון">
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="050-0000000"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </Field>
            </div>
            <Field label="אימייל">
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com" type="email"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="מצב לקוח">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                <option value="green">🟢  בריא</option>
                <option value="orange">🟠  דרוש תשומת לב</option>
                <option value="red">🔴  לטפל דחוף</option>
              </select>
            </Field>
            <Field label="הערות">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="פרטים נוספים..." rows={2}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={inputStyle} />
            </Field>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              💡 מחיר, תשלומים ושלבים מנוהלים בכרטיסיית הפרויקט המשויך ללקוח
            </p>
            <button onClick={saveClient} disabled={!form.name.trim() || saving}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-30 bg-accent text-accent-foreground">
              {saving ? 'שומר...' : modal.mode === 'add' ? 'הוסף לקוח' : 'שמור שינויים'}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ PROJECT MODAL ═════════════════════════════════════ */}
      {projModal && (
        <Modal
          title={projModal.mode === 'add' ? 'פרויקט חדש' : `ערוך — ${projModal.project?.name}`}
          onClose={() => {
            if (projectForm.name.trim() && !window.confirm('הפרויקט לא נשמר — לצאת בלי לשמור?')) return;
            setProjModal(null);
          }}
          footer={
            <div className="space-y-2">
              <button onClick={saveProject} disabled={!projectForm.name.trim() || projSaving}
                className="w-full rounded-lg py-3 text-sm font-bold transition hover:opacity-90 disabled:opacity-30 bg-accent text-accent-foreground">
                {projSaving ? 'שומר...' : projModal.mode === 'add' ? '💾 שמור פרויקט' : '💾 שמור שינויים'}
              </button>
              <p className="text-center text-[11px]" style={{ color:'rgba(255,255,255,0.25)' }}>
                יציאה בלי שמירה תמחק את הנתונים
              </p>
            </div>
          }>
          <div className="space-y-4">

            {/* Client + Name */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="לקוח">
                <select
                  value={projectForm.client_id}
                  onChange={e => {
                    if (e.target.value === '__new__') {
                      // Save current project form, close project modal, open client modal
                      setPendingProjForm({ ...projectForm });
                      setProjModal(null);
                      setForm(EMPTY_FORM);
                      setTab('clients');
                      setModal({ mode: 'add' });
                    } else {
                      setProjectForm(f => ({ ...f, client_id: e.target.value }));
                    }
                  }}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                  <option value="">ללא לקוח</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new__">＋ לקוח חדש…</option>
                </select>
              </Field>
              <Field label="שם הפרויקט *">
                <input value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="עיצוב אתר לקוח X" autoFocus
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </Field>
            </div>

            {/* Type — multi-select */}
            <Field label="סוג פרויקט">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PROJECT_TYPES).map(([key, type]) => {
                  const selected = Array.isArray(projectForm.type) && projectForm.type.includes(key);
                  return (
                    <button key={key} type="button"
                      onClick={() => setProjectForm(f => {
                        const cur = Array.isArray(f.type) ? f.type : [];
                        return { ...f, type: cur.includes(key) ? cur.filter(t => t !== key) : [...cur, key] };
                      })}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1"
                      style={selected
                        ? { background: `${type.color}20`, color: type.color, border: `1px solid ${type.color}45` }
                        : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {selected && <Check size={10} />}
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Status */}
            <Field label="סטטוס">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PROJECT_STATUS).map(([key, st]) => (
                  <button key={key} type="button" onClick={() => setProjectForm(f => ({ ...f, status: key }))}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                    style={projectForm.status === key
                      ? { background: st.bg, color: st.color, border: `1px solid ${st.border}` }
                      : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {st.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Pricing */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="תקציב כולל (₪)">
                <input type="number" min="0" value={projectForm.total_amount}
                  onChange={e => setProjectForm(f => ({ ...f, total_amount: e.target.value }))}
                  onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                  onWheel={e => e.currentTarget.blur()} placeholder="0"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </Field>
              <Field label="שעות מוערכות">
                <input type="number" min="0" value={projectForm.estimated_hours}
                  onChange={e => setProjectForm(f => ({ ...f, estimated_hours: e.target.value }))}
                  onWheel={e => e.currentTarget.blur()} placeholder="0"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </Field>
            </div>

            {/* Installments */}
            <Field label="חלוקת תשלומים">
              <div className="rounded-xl p-3 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="min-w-[280px]">
                  <InstallmentBuilder
                    plan={projectForm.installment_plan}
                    dealAmount={projectForm.total_amount}
                    onChange={plan => setProjectForm(f => ({ ...f, installment_plan: plan }))} />
                </div>
              </div>
            </Field>

            {!projHasPlan && (
              <Field label="התקבל עד כה (₪)">
                <input type="number" min="0" value={projectForm.received_amount}
                  onChange={e => setProjectForm(f => ({ ...f, received_amount: e.target.value }))}
                  onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                  onWheel={e => e.currentTarget.blur()} placeholder="0"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </Field>
            )}

            {projDeal > 0 && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>שולם <span className="font-bold" style={{ color: '#86efac' }}>{fmt(projPaid)}</span></span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>נשאר <span className="font-bold" style={{ color: projDeal - projPaid > 0 ? '#fcd34d' : '#86efac' }}>{fmt(projDeal - projPaid)}</span></span>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="תאריך התחלה">
                <input type="date" value={projectForm.start_date}
                  onChange={e => setProjectForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </Field>
              <Field label="דדליין">
                <input type="date" value={projectForm.deadline}
                  onChange={e => setProjectForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </Field>
            </div>

            {/* Workflow Templates */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                <LayoutTemplate size={13} style={{ color: '#f5c518' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f5c518', textTransform: 'uppercase', letterSpacing: '0.07em' }}>תבניות תהליך עבודה</span>
              </div>
              <WfPanel
                userId={userId}
                onApplyTemplate={steps => setProjectForm(f => ({
                  ...f,
                  stages: steps.map((label, i) => ({ id: Date.now() + i, label, done: false })),
                }))}
              />

              {/* Show applied stages with progress */}
              {(projectForm.stages || []).length > 0 && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                      שלבי הפרויקט · {(projectForm.stages || []).filter(s=>s.done).length}/{(projectForm.stages || []).length}
                    </span>
                    <button onClick={() => setProjectForm(f => ({ ...f, stages: [] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
                      נקה
                    </button>
                  </div>
                  {(projectForm.stages || []).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 mb-1.5">
                      <button
                        onClick={() => setProjectForm(f => ({
                          ...f,
                          stages: f.stages.map((st, j) => j === i ? { ...st, done: !st.done } : st),
                        }))}
                        style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                          border: `1.5px solid ${s.done ? '#4fc38a' : 'rgba(255,255,255,0.2)'}`,
                          background: s.done ? '#4fc38a' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        {s.done && <Check size={10} color="#fff" strokeWidth={3} />}
                      </button>
                      <span style={{ fontSize: 13, color: s.done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)', textDecoration: s.done ? 'line-through' : 'none' }}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <Field label="הערות">
              <textarea value={projectForm.notes} onChange={e => setProjectForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="פרטים נוספים..." rows={2}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={inputStyle} />
            </Field>

          </div>
        </Modal>
      )}

    </div>
  );
}
