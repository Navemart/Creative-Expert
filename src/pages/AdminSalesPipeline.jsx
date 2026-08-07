import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Search, Plus, X, Star, ExternalLink, LayoutGrid, List, DollarSign, Users, Trophy, TrendingUp, Calendar, Trash2, Instagram } from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const STAGES = [
  { key: 'new_lead',    label: 'ליד חדש',       color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  { key: 'responded',   label: 'הגיב',           color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  { key: 'qualified',   label: 'מתאים',          color: '#06b6d4', bg: 'rgba(6,182,212,0.15)'  },
  { key: 'offer_made',  label: 'הצעה נשלחה',    color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  { key: 'won',         label: 'נסגר',           color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
  { key: 'lost',        label: 'לא נסגר',        color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
  { key: 'unqualified', label: 'לא מתאים',       color: '#6b7280', bg: 'rgba(107,114,128,0.15)'},
];

const NICHES = ['ללא','בונה אתרים','מעצב גרפי','ממתג','אנימטור','מעצב UI/UX','מאייר','צלם','מעצב תוכן','מעצב אריזות','מעצב פנים','מעצב תכשיטים'];
const SOURCES = ['none','manychat','manual'];

function stageMeta(key) { return STAGES.find(s => s.key === key) || STAGES[0]; }

function StagePill({ stage }) {
  const s = stageMeta(stage);
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function SourceBadge({ source }) {
  if (!source || source === 'none') return null;
  const isMany = source === 'manychat';
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: isMany ? 'rgba(59,130,246,0.18)' : 'rgba(107,114,128,0.18)',
      color: isMany ? '#60a5fa' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {isMany ? 'ManyChat' : 'ידני'}
    </span>
  );
}

function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={13}
          fill={(hover || value) >= i ? '#F5C118' : 'none'}
          stroke={(hover || value) >= i ? '#F5C118' : 'rgba(255,255,255,0.2)'}
          style={{ cursor: onChange ? 'pointer' : 'default' }}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(value === i ? 0 : i)}
        />
      ))}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'היום';
  if (d === 1) return 'אתמול';
  if (d < 7) return `לפני ${d} ימים`;
  if (d < 30) return `לפני ${Math.floor(d/7)} שבועות`;
  return `לפני ${Math.floor(d/30)} חודשים`;
}

function fmtNum(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1000) return (n/1000).toFixed(1).replace(/\.0$/,'') + 'K';
  return String(n);
}

function fmtILS(n) {
  if (!n) return '₪0';
  return '₪' + Number(n).toLocaleString('he-IL');
}

// ── מודל פרטי ליד ──────────────────────────────────────────────
function LeadModal({ lead, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...lead });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  const inp = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '8px 12px', color: 'white', outline: 'none',
    fontSize: '0.875rem', width: '100%', fontFamily: 'inherit',
  };
  const sel = { ...inp, cursor: 'pointer' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="relative rounded-2xl overflow-hidden" dir="rtl" style={{ width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>

        {/* כותרת */}
        <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            {lead.profile_image_url
              ? <img src={lead.profile_image_url} alt="" className="rounded-full" style={{ width: 48, height: 48, objectFit: 'cover', flexShrink: 0 }} />
              : <div className="rounded-full flex items-center justify-center text-lg font-bold" style={{ width: 48, height: 48, background: 'rgba(245,193,24,0.15)', color: '#F5C118', flexShrink: 0 }}>{(lead.name||'?')[0].toUpperCase()}</div>
            }
            <div>
              <p className="font-bold text-white text-base">{lead.name}</p>
              {lead.instagram_handle && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>@{lead.instagram_handle.replace('@','')}</p>}
              {lead.instagram_handle && (
                <a href={`https://instagram.com/${lead.instagram_handle.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs mt-0.5 hover:opacity-80" style={{ color: '#F5C118' }}>
                  <Instagram size={10} /> פתח באינסטגרם
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>עוקבים</p>
              <p className="font-bold text-white text-sm">{fmtNum(lead.followers_count)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>פוסטים</p>
              <p className="font-bold text-white text-sm">{lead.posts_count || '—'}</p>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10 transition" style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ביוגרפיה */}
        {lead.bio && (
          <div className="px-5 pt-4">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>ביוגרפיה</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{lead.bio}</p>
          </div>
        )}

        {/* טופס */}
        <div className="p-5 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>שם</p>
            <input style={inp} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="שם מלא" />
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>אינסטגרם</p>
            <input style={{ ...inp, direction: 'ltr' }} value={form.instagram_handle || ''} onChange={e => set('instagram_handle', e.target.value)} placeholder="@handle" />
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>שלב</p>
            <select style={sel} value={form.stage} onChange={e => set('stage', e.target.value)}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>תחום</p>
            <select style={sel} value={form.niche || 'ללא'} onChange={e => set('niche', e.target.value)}>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>שווי עסקה (₪)</p>
            <input style={{ ...inp, direction: 'ltr' }} type="number" value={form.deal_value || ''} onChange={e => set('deal_value', Number(e.target.value))} placeholder="0" />
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>מקור</p>
            <select style={sel} value={form.source || 'none'} onChange={e => set('source', e.target.value)}>
              {SOURCES.map(s => <option key={s} value={s}>{s === 'none' ? 'ללא' : s === 'manychat' ? 'ManyChat' : 'ידני'}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <p className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>דירוג</p>
            <Stars value={form.rating || 0} onChange={v => set('rating', v)} />
          </div>
          <div className="col-span-2">
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>הערות</p>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 80 }} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="הערות על הליד..." />
          </div>
        </div>

        {/* כפתורי פעולה */}
        <div className="flex items-center justify-between px-5 pb-5 gap-3">
          <button onClick={() => { if (confirm('למחוק את הליד?')) { onDelete(lead.id); onClose(); } }}
            className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition"
            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Trash2 size={13} /> מחק ליד
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer' }}>
              ביטול
            </button>
            <button onClick={save} disabled={saving} className="rounded-xl px-5 py-2 text-sm font-bold transition hover:opacity-90 bg-accent text-accent-foreground" style={{ border: 'none', cursor: 'pointer' }}>
              {saving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── מודל הוספת ליד ─────────────────────────────────────────────
const EMPTY = { name: '', instagram_handle: '', profile_image_url: '', followers_count: '', posts_count: '', bio: '', stage: 'new_lead', niche: 'ללא', deal_value: '', source: 'none', rating: 0, notes: '' };

function AddLeadModal({ onClose, onAdd }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', color: 'white', outline: 'none', fontSize: '0.875rem', width: '100%', fontFamily: 'inherit' };
  const sel = { ...inp, cursor: 'pointer' };

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onAdd(form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-2xl overflow-hidden" dir="rtl" style={{ width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="font-bold text-white text-base">הוספת ליד</p>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10 transition" style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>שם <span style={{ color: '#ef4444' }}>*</span></p>
            <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="שם מלא" />
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>אינסטגרם</p>
            <input style={{ ...inp, direction: 'ltr' }} value={form.instagram_handle} onChange={e => set('instagram_handle', e.target.value)} placeholder="@handle" />
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>שלב</p>
            <select style={sel} value={form.stage} onChange={e => set('stage', e.target.value)}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>תחום</p>
            <select style={sel} value={form.niche} onChange={e => set('niche', e.target.value)}>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>שווי עסקה (₪)</p>
            <input style={{ ...inp, direction: 'ltr' }} type="number" value={form.deal_value} onChange={e => set('deal_value', e.target.value)} placeholder="0" />
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>מקור</p>
            <select style={sel} value={form.source} onChange={e => set('source', e.target.value)}>
              {SOURCES.map(s => <option key={s} value={s}>{s === 'none' ? 'ללא' : s === 'manychat' ? 'ManyChat' : 'ידני'}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <p className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>דירוג</p>
            <Stars value={form.rating} onChange={v => set('rating', v)} />
          </div>
          <div className="col-span-2">
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>הערות</p>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 70 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="הערות ראשוניות..." />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer' }}>ביטול</button>
          <button onClick={submit} disabled={saving || !form.name.trim()} className="rounded-xl py-2.5 text-sm font-bold bg-accent text-accent-foreground transition hover:opacity-90 disabled:opacity-40" style={{ border: 'none', cursor: 'pointer', flex: 2 }}>
            {saving ? 'מוסיף...' : '+ הוסף ליד'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── כרטיס קנבן ────────────────────────────────────────────────
function KanbanCard({ lead, onClick, onDragStart }) {
  return (
    <div draggable
      onDragStart={e => onDragStart(e, lead)}
      onClick={() => onClick(lead)}
      className="rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.01] select-none"
      style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
      <div className="flex items-center gap-2 mb-2">
        {lead.profile_image_url
          ? <img src={lead.profile_image_url} alt="" className="rounded-full flex-none" style={{ width: 32, height: 32, objectFit: 'cover' }} />
          : <div className="rounded-full flex-none flex items-center justify-center text-sm font-bold" style={{ width: 32, height: 32, background: 'rgba(245,193,24,0.12)', color: '#F5C118' }}>{(lead.name||'?')[0].toUpperCase()}</div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{lead.name}</p>
          {lead.instagram_handle && <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>@{lead.instagram_handle.replace('@','')}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{fmtNum(lead.followers_count)} עוקבים</span>
        {lead.deal_value > 0 && <span className="text-xs font-bold" style={{ color: '#F5C118' }}>{fmtILS(lead.deal_value)}</span>}
      </div>
      <div className="flex items-center justify-between">
        <Stars value={lead.rating || 0} />
        <SourceBadge source={lead.source} />
      </div>
      {lead.created_at && <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.22)' }}>{timeAgo(lead.created_at)}</p>}
    </div>
  );
}

// ── עמודת קנבן ────────────────────────────────────────────────
function KanbanColumn({ stage, leads, onClick, onDragStart, onDrop }) {
  const [over, setOver] = useState(false);
  const totalVal = leads.reduce((s, l) => s + (Number(l.deal_value) || 0), 0);

  return (
    <div className="flex flex-col rounded-2xl" style={{ flex: 1, minWidth: 160 }}>
      <div className="flex items-center justify-between px-3 py-2.5 rounded-t-2xl mb-2"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{stage.label}</span>
          <span className="rounded-full px-1.5 py-0.5 text-[11px] font-bold" style={{ background: stage.bg, color: stage.color }}>{leads.length}</span>
        </div>
        {totalVal > 0 && <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>{fmtILS(totalVal)}</span>}
      </div>
      <div className="flex flex-col gap-2 flex-1 rounded-b-2xl p-2 min-h-[120px] transition-colors"
        style={{ background: over ? 'rgba(255,255,255,0.04)' : 'transparent', border: `1px dashed ${over ? stage.color : 'rgba(255,255,255,0.06)'}`, borderTop: 'none' }}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { setOver(false); onDrop(e, stage.key); }}>
        {leads.map(lead => (
          <KanbanCard key={lead.id} lead={lead} onClick={onClick} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

// ── הקומפוננטה הראשית ──────────────────────────────────────────
export default function AdminSalesPipeline() {
  const { user } = useUser();
  const isAdmin = user?.id === ADMIN_ID;

  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [view, setView]         = useState('kanban');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const dragging = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/pipeline');
    if (res.ok) setLeads(await res.json());
    setLoading(false);
  }

  async function addLead(form) {
    const res = await fetch('/api/pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { const d = await res.json(); setLeads(prev => [...prev, d]); }
  }

  async function saveLead(form) {
    const res = await fetch(`/api/pipeline/${form.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { const d = await res.json(); setLeads(prev => prev.map(l => l.id === d.id ? d : l)); setSelected(d); }
  }

  async function deleteLead(id) {
    await fetch(`/api/pipeline/${id}`, { method: 'DELETE' });
    setLeads(prev => prev.filter(l => l.id !== id));
  }

  async function moveStage(leadId, newStage) {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stage === newStage) return;
    const updated = { ...lead, stage: newStage };
    setLeads(prev => prev.map(l => l.id === leadId ? updated : l));
    await fetch(`/api/pipeline/${leadId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
  }

  function onDragStart(e, lead) { dragging.current = lead; e.dataTransfer.effectAllowed = 'move'; }
  function onDrop(e, stageKey) { e.preventDefault(); if (dragging.current) { moveStage(dragging.current.id, stageKey); dragging.current = null; } }

  const q = search.toLowerCase();
  const filtered = leads.filter(l =>
    !q || l.name?.toLowerCase().includes(q) || l.instagram_handle?.toLowerCase().includes(q) || l.bio?.toLowerCase().includes(q)
  );

  const now = new Date();
  const activeLeads  = leads.filter(l => l.stage !== 'lost' && l.stage !== 'unqualified');
  const wonLeads     = leads.filter(l => l.stage === 'won');
  const wonThisMonth = wonLeads.filter(l => { const d = new Date(l.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const pipelineVal  = activeLeads.reduce((s, l) => s + (Number(l.deal_value) || 0), 0);
  const wonVal       = wonLeads.reduce((s, l) => s + (Number(l.deal_value) || 0), 0);

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-full">
      <p style={{ color: 'rgba(255,255,255,0.3)' }}>גישה מוגבלת</p>
    </div>
  );

  const MONTH_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

  return (
    <div className="w-full flex flex-col gap-5 pb-8">

      {/* כותרת */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">צינור מכירות</h1>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold bg-accent text-accent-foreground hover:opacity-90 transition">
          <Plus size={15} /> הוסף ליד
        </button>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: <DollarSign size={14} />, label: 'שווי הצינור',                                value: fmtILS(pipelineVal), color: '#F5C118' },
          { icon: <Trophy size={14} />,     label: 'דילים שנסגרו',                               value: wonLeads.length,     color: '#34d399' },
          { icon: <Calendar size={14} />,   label: `דילים שנסגרו ב${MONTH_HE[now.getMonth()]}`, value: wonThisMonth.length, color: '#a78bfa' },
          { icon: <TrendingUp size={14} />, label: 'סה"כ הכנסה שנסגרה',                         value: fmtILS(wonVal),       color: '#34d399' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-1.5 mb-2" style={{ color }}>
              {icon}
              <span className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* חיפוש + טוגל תצוגה */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute" style={{ right: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לידים..."
            className="w-full rounded-xl py-2.5 text-sm outline-none text-right"
            style={{ paddingRight: 36, paddingLeft: 14, background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />
        </div>
        <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['kanban', <LayoutGrid size={15} />], ['list', <List size={15} />]].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)}
              className="rounded-lg p-2 transition"
              style={{ background: view === v ? 'rgba(255,255,255,0.12)' : 'transparent', color: view === v ? 'white' : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer' }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-center text-sm py-10" style={{ color: 'rgba(255,255,255,0.3)' }}>טוען...</p>}

      {/* ── תצוגת קנבן ── */}
      {!loading && view === 'kanban' && (
        <div className="flex gap-3 w-full">
          {STAGES.map(stage => (
            <KanbanColumn key={stage.key} stage={stage}
              leads={filtered.filter(l => l.stage === stage.key)}
              onClick={setSelected}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}

      {/* ── תצוגת רשימה ── */}
      {!loading && view === 'list' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="grid text-[11px] font-bold tracking-widest px-4 py-3" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto', color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span>פרופיל</span><span>עוקבים</span><span>שלב</span><span>תחום</span><span>דירוג</span><span>מקור</span><span>נוסף</span>
          </div>
          {filtered.length === 0 && <p className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>לא נמצאו לידים</p>}
          {filtered.map(lead => (
            <div key={lead.id} onClick={() => setSelected(lead)}
              className="grid items-center px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5">
                {lead.profile_image_url
                  ? <img src={lead.profile_image_url} alt="" className="rounded-full flex-none" style={{ width: 30, height: 30, objectFit: 'cover' }} />
                  : <div className="rounded-full flex-none flex items-center justify-center text-xs font-bold" style={{ width: 30, height: 30, background: 'rgba(245,193,24,0.12)', color: '#F5C118' }}>{(lead.name||'?')[0].toUpperCase()}</div>
                }
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{lead.name}</p>
                  {lead.instagram_handle && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>@{lead.instagram_handle.replace('@','')}</p>}
                </div>
              </div>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{fmtNum(lead.followers_count)}</span>
              <StagePill stage={lead.stage} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{lead.niche || '—'}</span>
              <Stars value={lead.rating || 0} />
              <SourceBadge source={lead.source} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{timeAgo(lead.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <LeadModal lead={selected} onClose={() => setSelected(null)} onSave={saveLead} onDelete={deleteLead} />
      )}
      {showAdd && (
        <AddLeadModal onClose={() => setShowAdd(false)} onAdd={addLead} />
      )}
    </div>
  );
}
