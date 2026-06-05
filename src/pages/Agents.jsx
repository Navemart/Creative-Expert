import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { useIsAdmin } from '../hooks/useIsAdmin.js';
import {
  Search, ExternalLink, ChevronDown, ChevronUp,
  Plus, Edit2, Trash2, X, Settings2, Pencil, Check,
} from 'lucide-react';

// ─── ברירות מחדל — מוזרעות אוטומטית אם הטבלה ריקה ─────────────────────────
const DEFAULT_TOOLS = [
  { name: 'מאבחן התוכן',    tm: false, description: 'היועץ האישי שלך לאבחון פיסת התוכן שכתבת — נותן פידבק, ציון ושיפור מיידי.', url: '', category: 'content',     category_label: 'תוכן ומיתוג',      sort_order: 1 },
  { name: 'חוק ממגנט',      tm: false, description: 'יוצר הוקים מגנטיים שמושכים את הקהל הנכון ועוצרים אנשים באמצע הסקרול.',       url: '', category: 'content',     category_label: 'תוכן ומיתוג',      sort_order: 2 },
  { name: 'מחולל ההוקים',   tm: false, description: 'לוקח את הרעיונות שלך ומתאים להם הוקים עם דרמה עולמית שעוצרים אנשים באמצע.',   url: '', category: 'content',     category_label: 'תוכן ומיתוג',      sort_order: 3 },
  { name: 'מכרה היהלומים',  tm: true,  description: 'עוזר לך לחפור בזיכרון האישי ולמצוא את הרגעים והסיפורים שהופכים לתוכן חזק.',  url: '', category: 'content',     category_label: 'תוכן ומיתוג',      sort_order: 4 },
  { name: 'קייסטאדי',       tm: true,  description: 'בונה תסריט מדויק לקייסטאדי שיגרום ללקוחות לראות בך שותף אסטרטגי.',           url: '', category: 'sales',       category_label: 'מכירות ומסרים',    sort_order: 1 },
  { name: 'מחולל ההצעות',   tm: true,  description: 'יוצר הצעות מחיר מקצועיות ומותאמות אישית שסוגרות עסקאות.',                    url: '', category: 'sales',       category_label: 'מכירות ומסרים',    sort_order: 2 },
  { name: 'מגנת השיחות',    tm: true,  description: 'מדריך אותך לנהל שיחות מכירה בדיוק ובאמינות שגורמת ללקוחות לסגור.',           url: '', category: 'sales',       category_label: 'מכירות ומסרים',    sort_order: 3 },
  { name: 'המיצוב המושלם',  tm: true,  description: 'עוזר לך להבין מה אתה עושה ומה הייחודיות שלך — במשפטים פשוטים שתוכל להשתמש.', url: '', category: 'positioning', category_label: 'מיצוב ואסטרטגיה', sort_order: 1 },
];

const CATEGORY_ORDER = ['content', 'sales', 'positioning'];

const CATEGORY_OPTIONS = [
  { value: 'content',     label: 'תוכן ומיתוג' },
  { value: 'sales',       label: 'מכירות ומסרים' },
  { value: 'positioning', label: 'מיצוב ואסטרטגיה' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  surface:  'rgb(var(--bg-surface))',
  elevated: 'rgb(var(--bg-elevated))',
  border:   '1px solid rgba(255,255,255,0.08)',
  border2:  '1px solid rgba(255,255,255,0.15)',
  muted:    'rgba(255,255,255,0.35)',
};

// ─── Tool Modal ───────────────────────────────────────────────────────────────
const EMPTY_FORM = { name: '', tm: false, description: '', url: '', category: 'content' };

function ToolModal({ initial, onSave, onClose }) {
  const [form, setForm]   = useState(initial ? {
    id:          initial.id,
    name:        initial.name        ?? '',
    tm:          initial.tm          ?? false,
    description: initial.description ?? '',
    url:         initial.url         ?? '',
    category:    initial.category    ?? 'content',
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const inputCls   = 'w-full rounded-xl px-3 py-2.5 text-sm outline-none text-white';
  const inputStyle = { background: S.elevated, border: S.border2 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: S.surface, border: S.border }}>

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{initial ? 'עריכת כלי' : 'כלי חדש'}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10" style={{ color: S.muted }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-white/45">שם הכלי <span className="text-red-400">*</span></label>
            <input className={inputCls} style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="לדוגמה: מחולל ההוקים" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/45">תיאור קצר</label>
            <textarea className={inputCls + ' resize-none'} style={inputStyle} rows={3}
              value={form.description} onChange={e => set('description', e.target.value)} placeholder="במה הכלי עוזר?" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/45">קישור GPT (URL)</label>
            <input className={inputCls} style={inputStyle} value={form.url}
              onChange={e => set('url', e.target.value)} placeholder="https://chatgpt.com/g/..." dir="ltr" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/45">קטגוריה</label>
            <select className={inputCls} style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={form.tm} onChange={e => set('tm', e.target.checked)}
              className="h-4 w-4 rounded accent-yellow-400" />
            <span className="text-sm text-white/60">הצג סימן ™ ליד השם</span>
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
            style={{ background: S.elevated, color: S.muted, border: S.border2 }}>
            ביטול
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 transition bg-accent">
            {saving ? 'שומר...' : initial ? 'שמור שינויים' : 'הוסף כלי'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GPT Card ─────────────────────────────────────────────────────────────────
function GPTCard({ tool, editMode, onEdit, onDelete }) {
  const hasUrl = !!tool.url;
  return (
    <div className="flex flex-col rounded-2xl p-5 relative group"
      style={{ background: S.surface, border: S.border }}>

      {editMode && (
        <div className="absolute top-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition z-10">
          <button onClick={() => onEdit(tool)}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
            <Edit2 size={12} />
          </button>
          <button onClick={() => onDelete(tool)}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition hover:bg-red-500/30"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="flex-none h-8 w-8 rounded-lg flex items-center justify-center text-base"
          style={{ background: 'rgba(245,193,24,0.12)' }}>⚙️</div>
        <h3 className="text-sm font-semibold text-white leading-snug mt-0.5">
          {tool.name}
          {tool.tm && <sup className="ml-0.5 text-[9px] text-white/35 font-normal">TM</sup>}
        </h3>
      </div>

      <p className="text-xs leading-relaxed flex-1 mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {tool.description || <span className="italic opacity-50">אין תיאור</span>}
      </p>

      <a
        href={hasUrl ? tool.url : undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={!hasUrl ? e => e.preventDefault() : undefined}
        className={`flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-bold transition ${hasUrl ? 'bg-accent' : ''}`}
        style={!hasUrl ? { background: 'rgba(245,193,24,0.15)', color: 'rgba(245,193,24,0.4)', cursor: 'default' } : {}}>
        {hasUrl ? 'פתח GPT' : 'בקרוב'}
        {hasUrl && <ExternalLink size={13} />}
      </a>
    </div>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────
function CategorySection({ label, categoryKey, tools, query, editMode, onEdit, onDelete, onRenameCategory }) {
  const [open,         setOpen]         = useState(true);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft,   setLabelDraft]   = useState(label);

  // Sync draft if label changes externally
  useEffect(() => { setLabelDraft(label); }, [label]);

  function saveLabel() {
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== label) onRenameCategory(categoryKey, trimmed);
    setEditingLabel(false);
  }

  const filtered = useMemo(() => {
    if (!query) return tools;
    const q = query.toLowerCase();
    return tools.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }, [tools, query]);

  if (!filtered.length) return null;

  return (
    <section className="group/cat">
      <div className="flex items-center gap-2 mb-4">
        {/* Category label — editable in edit mode */}
        {editMode && editingLabel ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={e => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') { setLabelDraft(label); setEditingLabel(false); } }}
              className="text-[11px] font-semibold tracking-widest uppercase bg-transparent outline-none rounded px-1.5 py-0.5"
              style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.25)', minWidth: 120 }}
            />
            <button
              onMouseDown={e => { e.preventDefault(); saveLabel(); }}
              className="h-5 w-5 rounded flex items-center justify-center transition hover:bg-green-500/20"
              style={{ color: '#86efac' }}>
              <Check size={11} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            {editMode && (
              <button
                onClick={() => { setLabelDraft(label); setEditingLabel(true); }}
                className="opacity-0 group-hover/cat:opacity-100 transition rounded p-0.5 hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                title="שנה שם קטגוריה">
                <Pencil size={10} />
              </button>
            )}
          </div>
        )}
        <button type="button" onClick={() => setOpen(v => !v)} className="flex items-center gap-2 flex-1">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          {open
            ? <ChevronUp size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
            : <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />}
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(tool => (
            <GPTCard key={tool.id} tool={tool} editMode={editMode} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Agents() {
  const isAdmin    = useIsAdmin();

  const [tools,     setTools]     = useState([]);
  const [query,     setQuery]     = useState('');
  const [editMode,  setEditMode]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // null | { mode:'add'|'edit', tool?:{} }
  const [delTarget, setDelTarget] = useState(null);

  // ── Load ──
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('gpt_tools').select('*').order('sort_order');
      if (error) { setLoading(false); return; }

      if (data?.length) {
        // טבלה מלאה — Supabase סמכותי
        setTools(data);
      } else {
        // טבלה ריקה — הזרע ברירות מחדל אוטומטית (פעם ראשונה)
        const { data: seeded } = await supabase
          .from('gpt_tools').insert(DEFAULT_TOOLS).select();
        setTools(seeded || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  // ── Group by category ──
  const grouped = useMemo(() => {
    const map = {};
    tools.forEach(t => {
      // Use stored category_label from DB first, fall back to static options
      const label = t.category_label
        || CATEGORY_OPTIONS.find(c => c.value === t.category)?.label
        || t.category;
      if (!map[t.category]) map[t.category] = { label, tools: [] };
      else map[t.category].label = label; // keep latest label
      map[t.category].tools.push(t);
    });
    return [
      ...CATEGORY_ORDER.filter(k => map[k]).map(k => ({ id: k, ...map[k] })),
      ...Object.keys(map).filter(k => !CATEGORY_ORDER.includes(k)).map(k => ({ id: k, ...map[k] })),
    ];
  }, [tools]);

  // ── Save (add or edit) ──
  async function handleSave(form) {
    const catLabel = CATEGORY_OPTIONS.find(c => c.value === form.category)?.label ?? form.category;
    const payload  = {
      name:           form.name.trim(),
      tm:             form.tm,
      description:    form.description,
      url:            form.url,
      category:       form.category,
      category_label: catLabel,
    };

    if (form.id) {
      // ── עדכון ──
      setTools(prev => prev.map(t => t.id === form.id ? { ...t, ...payload } : t));
      const { error } = await supabase.from('gpt_tools').update(payload).eq('id', form.id);
      if (error) console.error('[update]', error.message);
    } else {
      // ── הוספה ──
      const { data, error } = await supabase
        .from('gpt_tools')
        .insert({ ...payload, sort_order: tools.filter(t => t.category === form.category).length })
        .select().single();
      if (error) console.error('[insert]', error.message);
      else if (data) setTools(prev => [...prev, data]);
    }
    setModal(null);
  }

  // ── Rename category ──
  async function handleRenameCategory(categoryKey, newLabel) {
    setTools(prev => prev.map(t =>
      t.category === categoryKey ? { ...t, category_label: newLabel } : t
    ));
    const { error } = await supabase
      .from('gpt_tools')
      .update({ category_label: newLabel })
      .eq('category', categoryKey);
    if (error) console.error('[rename category]', error.message);
  }

  // ── Delete ──
  async function handleDelete(tool) {
    setTools(prev => prev.filter(t => t.id !== tool.id));
    setDelTarget(null);
    const { error } = await supabase.from('gpt_tools').delete().eq('id', tool.id);
    if (error) console.error('[delete]', error.message);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-8">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white">AI ScaleKit</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {loading ? 'טוען...' : `${tools.length} כלים · לחץ על ״פתח GPT״ כדי להשתמש`}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {editMode && (
              <button
                onClick={() => setModal({ mode: 'add' })}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition bg-accent">
                <Plus size={15} /> כלי חדש
              </button>
            )}
            <button
              onClick={() => setEditMode(v => !v)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition"
              style={{
                background: editMode ? 'rgba(255,255,255,0.12)' : S.surface,
                color:      editMode ? 'white' : 'rgba(255,255,255,0.5)',
                border:     S.border,
              }}>
              <Settings2 size={15} />
              {editMode ? 'סיום עריכה' : 'עריכה'}
            </button>
          </div>
        )}
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
          style={{ background: 'rgba(245,193,24,0.1)', border: '1px solid rgba(245,193,24,0.2)', color: 'rgba(245,193,24,0.85)' }}>
          <Settings2 size={14} />
          מצב עריכה פעיל — העבר עכבר על כרטיס כדי לערוך או למחוק
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: S.surface, border: S.border }}>
        <Search size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
        <input
          type="text" placeholder="חפש GPT..."
          value={query} onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
      </div>

      {/* Categories */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="rounded-2xl p-5 animate-pulse"
              style={{ background: S.surface, border: S.border, height: 160 }} />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(cat => (
            <CategorySection key={cat.id} label={cat.label} categoryKey={cat.id} tools={cat.tools}
              query={query} editMode={editMode}
              onEdit={tool => setModal({ mode: 'edit', tool })}
              onDelete={setDelTarget}
              onRenameCategory={handleRenameCategory} />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <ToolModal
          initial={modal.mode === 'edit' ? modal.tool : null}
          onSave={handleSave}
          onClose={() => setModal(null)} />
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5"
            style={{ background: S.surface, border: S.border }}>
            <h3 className="text-base font-semibold text-white">מחיקת כלי</h3>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              בטוח שרוצה למחוק את <strong className="text-white">{delTarget.name}</strong>?<br />
              לא ניתן לשחזר.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                style={{ background: S.elevated, color: S.muted, border: S.border2 }}>
                ביטול
              </button>
              <button onClick={() => handleDelete(delTarget)}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold transition hover:opacity-90"
                style={{ background: '#ef4444', color: 'white' }}>
                מחק
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
