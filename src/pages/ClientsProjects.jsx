import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { useDialog } from '../components/Dialog.jsx';
import { Plus, X, ChevronDown, ChevronUp, Edit2, Trash2, Users, Briefcase, LayoutTemplate, ChevronRight } from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────────

const SOURCES = {
  referral_good: { label: 'המלצה חזקה', icon: '🔥', color: '#ff6b35' },
  inbound:       { label: 'לקוח חם',    icon: '☀️',  color: '#f5c518' },
  referral_weak: { label: 'המלצה חלשה', icon: '🌤',  color: '#8a9bbf' },
  new:           { label: 'לקוח קר',   icon: '🧊',  color: '#5b8dee' },
};

const STATUSES = {
  lead:      { label: 'ליד',        color: '#8a9bbf' },
  proposal:  { label: 'הצעת מחיר', color: '#f5c518' },
  active:    { label: 'בעבודה',     color: '#4fc38a' },
  completed: { label: 'הושלם',      color: '#06b6d4' },
  paused:    { label: 'מושהה',      color: '#ff5a72' },
};

const C = {
  accent:  '#f5c518',
  green:   '#4fc38a',
  red:     '#ff5a72',
  surface: 'rgb(var(--bg-surface))',
  elevated:'rgb(var(--bg-elevated))',
  border:  'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.16)',
  muted:   'rgba(255,255,255,0.45)',
};

function fmt(n)     { return '₪' + Math.round(n || 0).toLocaleString('he-IL'); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: C.elevated, border: `1px solid ${C.border2}`,
  borderRadius: 8, padding: '9px 12px',
  fontSize: 14, color: 'rgba(255,255,255,0.92)',
  outline: 'none', fontFamily: 'inherit',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 20px', borderRadius: 9, background: C.accent,
  color: '#000', fontSize: 14, fontWeight: 700, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 20px', borderRadius: 9, background: C.elevated,
  color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500,
  border: `1px solid ${C.border2}`, cursor: 'pointer', fontFamily: 'inherit',
};

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || 'white', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: `${color}18`, border: `1px solid ${color}55`, color,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function Field({ label, children, half }) {
  return (
    <div style={{ marginBottom: 14, gridColumn: half ? undefined : undefined }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {children}
    </div>
  );
}

function Modal({ title, onClose, onSave, saveLabel = 'שמור', children }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        {children}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnGhost}>ביטול</button>
          <button onClick={onSave} style={btnPrimary}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ProjectMiniRow({ project, onEdit, onDelete }) {
  const st = STATUSES[project.status] || STATUSES.lead;
  const outstanding = Math.max(0, (project.total_amount || 0) - (project.received_amount || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: C.elevated, marginBottom: 6 }}>
      <Badge label={st.label} color={st.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</div>
        {project.deadline && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>דדליין: {fmtDate(project.deadline)}</div>}
      </div>
      <div style={{ flexShrink: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{fmt(project.total_amount)}</div>
        {outstanding > 0 && <div style={{ fontSize: 11, color: C.red, marginTop: 1 }}>חוב: {fmt(outstanding)}</div>}
      </div>
      <button onClick={() => onEdit(project)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex' }}><Edit2 size={13} /></button>
      <button onClick={() => onDelete(project.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.red, padding: 4, display: 'flex' }}><Trash2 size={13} /></button>
    </div>
  );
}

function ClientRow({ client, projects, onEditClient, onDeleteClient, onAddProject, onEditProject, onDeleteProject }) {
  const [open, setOpen] = useState(false);
  const src = SOURCES[client.source] || SOURCES.new;
  const clientProjects = projects.filter(p => p.client_id === client.id);
  const totalValue    = clientProjects.reduce((s, p) => s + (p.total_amount || 0), 0);
  const outstanding   = clientProjects.reduce((s, p) => s + Math.max(0, (p.total_amount || 0) - (p.received_amount || 0)), 0);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'right' }}
      >
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(245,193,24,0.12)', border: '1.5px solid rgba(245,193,24,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
          {client.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{client.name}</span>
            <span>{src.icon}</span>
            <Badge label={src.label} color={src.color} />
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            {[client.email, client.phone].filter(Boolean).join(' · ') || 'אין פרטי קשר'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{clientProjects.length}</div>
            <div style={{ fontSize: 10, color: C.muted }}>פרויקטים</div>
          </div>
          {totalValue > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{fmt(totalValue)}</div>
              <div style={{ fontSize: 10, color: C.muted }}>סה"כ ערך</div>
            </div>
          )}
          {outstanding > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>{fmt(outstanding)}</div>
              <div style={{ fontSize: 10, color: C.muted }}>חוב פתוח</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onEditClient(client)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 6, display: 'flex' }}><Edit2 size={14} /></button>
          <button onClick={() => onDeleteClient(client.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.red, padding: 6, display: 'flex' }}><Trash2 size={14} /></button>
        </div>
        {open ? <ChevronUp size={15} style={{ color: C.muted, flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: C.muted, flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ padding: '0 20px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ paddingTop: 14 }}>
            {clientProjects.length === 0
              ? <div style={{ fontSize: 13, color: C.muted, paddingBottom: 10 }}>אין פרויקטים ללקוח זה עדיין</div>
              : clientProjects.map(p => (
                  <ProjectMiniRow key={p.id} project={p} onEdit={onEditProject} onDelete={onDeleteProject} />
                ))
            }
            <button
              onClick={() => onAddProject(client.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'transparent', border: '1px dashed rgba(245,193,24,0.4)', borderRadius: 8, padding: '8px 14px', color: C.accent, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Plus size={14} /> הוסף פרויקט ללקוח זה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRow({ project, clientName, onEdit, onDelete }) {
  const st = STATUSES[project.status] || STATUSES.lead;
  const outstanding = Math.max(0, (project.total_amount || 0) - (project.received_amount || 0));
  const pct = project.total_amount > 0 ? Math.round(((project.received_amount || 0) / project.total_amount) * 100) : 0;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
      <Badge label={st.label} color={st.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{project.name}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          {clientName || 'ללא לקוח'}{project.deadline ? ` · דדליין: ${fmtDate(project.deadline)}` : ''}
        </div>
        {project.total_amount > 0 && (
          <div style={{ marginTop: 6, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden', maxWidth: 200 }}>
            <div style={{ height: '100%', borderRadius: 99, background: pct >= 100 ? C.green : C.accent, width: `${Math.min(pct, 100)}%`, transition: 'width 0.3s' }} />
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>{fmt(project.total_amount)}</div>
        {outstanding > 0
          ? <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>חוב: {fmt(outstanding)}</div>
          : project.total_amount > 0 && <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>שולם במלואו ✓</div>
        }
      </div>
      <button onClick={() => onEdit(project)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 6, display: 'flex' }}><Edit2 size={14} /></button>
      <button onClick={() => onDelete(project.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.red, padding: 6, display: 'flex' }}><Trash2 size={14} /></button>
    </div>
  );
}

// ─── Workflow Templates (localStorage per user) ─────────────────────────────────

const MAX_TEMPLATES = 3;

function loadWfTemplates(userId) {
  try { return JSON.parse(localStorage.getItem(`wf_${userId}`) || '[]'); }
  catch { return []; }
}
function saveWfTemplates(userId, tpls) {
  localStorage.setItem(`wf_${userId}`, JSON.stringify(tpls));
}

// Editor modal — create or edit a single template
function WfTemplateEditor({ template, onSave, onClose }) {
  const [name,  setName]  = useState(template?.name  || '');
  const [steps, setSteps] = useState(template?.steps || '');

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>
            {template ? 'עריכת תבנית' : 'תבנית חדשה'}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>שם התבנית</div>
          <input
            style={inputStyle} value={name}
            onChange={e => setName(e.target.value)}
            placeholder='למשל: "מיתוג בסיסי" או "בניית אתר"'
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            שלבי התהליך <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(שורה לכל שלב)</span>
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 160, resize: 'vertical', lineHeight: 1.7 }}
            value={steps}
            onChange={e => setSteps(e.target.value)}
            placeholder={"דיסקברי ובריף\nמחקר מתחרים\nקונספט מיתוגי\nעיצוב לוגו\nמדריך מותג\nמשלוח קבצים"}
            dir="rtl"
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>ביטול</button>
          <button
            onClick={() => { if (name.trim() && steps.trim()) onSave({ name: name.trim(), steps: steps.trim() }); }}
            style={{ ...btnPrimary, opacity: name.trim() && steps.trim() ? 1 : 0.4 }}
          >
            שמור תבנית
          </button>
        </div>
      </div>
    </div>
  );
}

// Panel shown inside project modal
function WfPanel({ userId }) {
  const [templates,   setTemplates]   = useState(() => loadWfTemplates(userId));
  const [openId,      setOpenId]      = useState(null);   // expanded template
  const [editorTpl,   setEditorTpl]   = useState(null);   // null = closed, {} = new, {…} = editing
  const [editingIdx,  setEditingIdx]  = useState(null);

  function handleSave({ name, steps }) {
    let updated;
    if (editingIdx !== null) {
      updated = templates.map((t, i) => i === editingIdx ? { ...t, name, steps } : t);
    } else {
      updated = [...templates, { id: Date.now(), name, steps }];
    }
    saveWfTemplates(userId, updated);
    setTemplates(updated);
    setEditorTpl(null);
    setEditingIdx(null);
  }

  function handleDelete(idx) {
    const updated = templates.filter((_, i) => i !== idx);
    saveWfTemplates(userId, updated);
    setTemplates(updated);
    if (openId === templates[idx]?.id) setOpenId(null);
  }

  const canAdd = templates.length < MAX_TEMPLATES;

  return (
    <div style={{ marginTop: 6 }}>
      {/* Template buttons */}
      {templates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {templates.map((tpl, idx) => {
            const isOpen = openId === tpl.id;
            const stepLines = tpl.steps.split('\n').filter(Boolean);
            return (
              <div key={tpl.id} style={{ background: C.elevated, border: `1px solid ${isOpen ? C.border2 : C.border}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : tpl.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit' }}
                  >
                    <ChevronRight size={13} style={{ color: C.muted, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{tpl.name}</span>
                    <span style={{ fontSize: 11, color: C.muted, marginRight: 2 }}>{stepLines.length} שלבים</span>
                  </button>
                  <button onClick={() => { setEditorTpl(tpl); setEditingIdx(idx); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex' }}>
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => handleDelete(idx)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.red, padding: 4, display: 'flex', opacity: 0.6 }}>
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Expanded steps */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px 12px' }}>
                    {stepLines.map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid rgba(245,193,24,0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.accent, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add template button */}
      {canAdd && (
        <button
          onClick={() => { setEditorTpl({}); setEditingIdx(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed rgba(245,193,24,0.35)', borderRadius: 8, padding: '8px 14px', color: C.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Plus size={13} />
          {templates.length === 0 ? 'הוסף תבנית לתהליך עבודה' : `הוסף תבנית נוספת (${templates.length}/${MAX_TEMPLATES})`}
        </button>
      )}
      {!canAdd && (
        <div style={{ fontSize: 11, color: C.muted }}>הגעת למקסימום 3 תבניות — מחק אחת כדי להוסיף חדשה.</div>
      )}

      {/* Editor modal */}
      {editorTpl !== null && (
        <WfTemplateEditor
          template={editingIdx !== null ? templates[editingIdx] : null}
          onSave={handleSave}
          onClose={() => { setEditorTpl(null); setEditingIdx(null); }}
        />
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

const emptyClient  = { name: '', email: '', phone: '', source: 'new', notes: '' };
const emptyProject = { client_id: '', name: '', status: 'lead', total_amount: '', received_amount: '', estimated_hours: '', start_date: '', deadline: '', notes: '' };

export default function ClientsProjects() {
  const { user } = useUser();
  const dialog   = useDialog();
  const [clients,  setClients]  = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab, setTab] = useState('clients');

  const [clientModal,      setClientModal]      = useState(false);
  const [projectModal,     setProjectModal]     = useState(false);
  const [clientForm,       setClientForm]       = useState(emptyClient);
  const [projectForm,      setProjectForm]      = useState(emptyProject);
  const [editingClientId,  setEditingClientId]  = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [saving,           setSaving]           = useState(false);

  useEffect(() => { if (user) fetchAll(); }, [user]);

  async function fetchAll() {
    setLoading(true);
    const uid = user.id;
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('clients').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('projects').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);
    setClients(c || []);
    setProjects(p || []);
    setLoading(false);
  }

  const metrics = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'active');
    const outstanding    = projects.filter(p => p.status !== 'completed')
      .reduce((s, p) => s + Math.max(0, (p.total_amount || 0) - (p.received_amount || 0)), 0);
    const activeValue    = activeProjects.reduce((s, p) => s + (p.total_amount || 0), 0);
    return { activeCount: activeProjects.length, outstanding, activeValue };
  }, [projects]);

  // ── Client CRUD ─────────────────────────────────────────────────────────────
  function openAddClient() { setClientForm(emptyClient); setEditingClientId(null); setClientModal(true); }
  function openEditClient(c) {
    setClientForm({ name: c.name || '', email: c.email || '', phone: c.phone || '', source: c.source || 'new', notes: c.notes || '' });
    setEditingClientId(c.id);
    setClientModal(true);
  }
  async function saveClient() {
    if (!clientForm.name.trim()) return;
    setSaving(true);
    if (editingClientId) {
      await supabase.from('clients').update(clientForm).eq('id', editingClientId);
    } else {
      await supabase.from('clients').insert({ ...clientForm, user_id: user.id });
    }
    await fetchAll(); setClientModal(false); setSaving(false);
  }
  async function deleteClient(id) {
    if (!await dialog.confirm('הלקוח ימחק לצמיתות.', { title: 'מחיקת לקוח', confirmText: 'מחיקה' })) return;
    await supabase.from('clients').delete().eq('id', id);
    await fetchAll();
  }

  // ── Project CRUD ─────────────────────────────────────────────────────────────
  function openAddProject(clientId = '') { setProjectForm({ ...emptyProject, client_id: clientId }); setEditingProjectId(null); setProjectModal(true); }
  function openEditProject(p) {
    setProjectForm({
      client_id:       p.client_id || '',
      name:            p.name || '',
      status:          p.status || 'lead',
      total_amount:    p.total_amount ?? '',
      received_amount: p.received_amount ?? '',
      estimated_hours: p.estimated_hours ?? '',
      start_date:      p.start_date || '',
      deadline:        p.deadline || '',
      notes:           p.notes || '',
    });
    setEditingProjectId(p.id);
    setProjectModal(true);
  }
  async function saveProject() {
    if (!projectForm.name.trim()) return;
    setSaving(true);
    const data = {
      ...projectForm,
      client_id:       projectForm.client_id || null,
      total_amount:    parseFloat(projectForm.total_amount)    || 0,
      received_amount: parseFloat(projectForm.received_amount) || 0,
      estimated_hours: parseFloat(projectForm.estimated_hours) || null,
      start_date:      projectForm.start_date || null,
      deadline:        projectForm.deadline || null,
    };
    if (editingProjectId) {
      await supabase.from('projects').update(data).eq('id', editingProjectId);
    } else {
      await supabase.from('projects').insert({ ...data, user_id: user.id });
    }
    await fetchAll(); setProjectModal(false); setSaving(false);
  }
  async function deleteProject(id) {
    if (!await dialog.confirm('הפרויקט ימחק לצמיתות.', { title: 'מחיקת פרויקט', confirmText: 'מחיקה' })) return;
    await supabase.from('projects').delete().eq('id', id);
    await fetchAll();
  }

  const clientName = id => clients.find(c => c.id === id)?.name || '';

  if (loading) return <div style={{ padding: 40, color: C.muted, fontSize: 14 }}>טוען...</div>;

  return (
    <div className="w-full space-y-6">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, color: 'white', margin: 0 }}>לקוחות ופרויקטים</h1>
          <p style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
            {clients.length} לקוחות · {projects.length} פרויקטים
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => openAddProject()} style={btnGhost}><Plus size={15} /> פרויקט חדש</button>
          <button onClick={openAddClient} style={btnPrimary}><Plus size={15} /> לקוח חדש</button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard label="לקוחות"            value={clients.length}       color="#a855f7" />
        <StatCard label="פרויקטים פעילים"   value={metrics.activeCount}  color={C.green} />
        <StatCard label="חוב פתוח"          value={fmt(metrics.outstanding)} color={C.red}    sub="מכלל הפרויקטים" />
        <StatCard label="שווי פרויקטים פעילים" value={fmt(metrics.activeValue)} color={C.accent} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: C.elevated, borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'clients',  label: 'לקוחות',    icon: <Users    size={14} /> },
          { key: 'projects', label: 'פרויקטים',  icon: <Briefcase size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            background: tab === t.key ? C.accent : 'transparent',
            color:      tab === t.key ? '#000'   : C.muted,
            transition: 'all 0.15s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Clients tab ──────────────────────────────────────────────────────── */}
      {tab === 'clients' && (
        <div>
          {clients.length === 0
            ? <div style={{ borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)', padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: 14 }}>
                אין לקוחות עדיין — לחץ על "לקוח חדש" כדי להתחיל 👆
              </div>
            : clients.map(c => (
                <ClientRow
                  key={c.id} client={c} projects={projects}
                  onEditClient={openEditClient}   onDeleteClient={deleteClient}
                  onAddProject={openAddProject}   onEditProject={openEditProject}
                  onDeleteProject={deleteProject}
                />
              ))
          }
        </div>
      )}

      {/* ── Projects tab ─────────────────────────────────────────────────────── */}
      {tab === 'projects' && (
        <div>
          {projects.length === 0
            ? <div style={{ borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)', padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: 14 }}>
                אין פרויקטים עדיין — לחץ על "פרויקט חדש" כדי להתחיל 👆
              </div>
            : Object.entries(STATUSES).map(([key, st]) => {
                const group = projects.filter(p => p.status === key);
                if (!group.length) return null;
                return (
                  <div key={key} style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: st.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{st.label}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>({group.length})</span>
                    </div>
                    {group.map(p => (
                      <ProjectRow key={p.id} project={p} clientName={clientName(p.client_id)} onEdit={openEditProject} onDelete={deleteProject} />
                    ))}
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ── Client modal ─────────────────────────────────────────────────────── */}
      {clientModal && (
        <Modal title={editingClientId ? 'עריכת לקוח' : 'לקוח חדש'} onClose={() => setClientModal(false)} onSave={saveClient} saveLabel={saving ? 'שומר...' : 'שמור'}>
          <Field label="שם לקוח *">
            <input style={inputStyle} value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} placeholder="שם הלקוח" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="אימייל">
              <input style={inputStyle} type="email" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </Field>
            <Field label="טלפון">
              <input style={inputStyle} value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="050-0000000" />
            </Field>
          </div>
          <Field label="מקור הלקוח">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(SOURCES).map(([key, src]) => (
                <button key={key} onClick={() => setClientForm(f => ({ ...f, source: key }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${clientForm.source === key ? src.color : C.border2}`, background: clientForm.source === key ? `${src.color}15` : C.elevated, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 18 }}>{src.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: clientForm.source === key ? src.color : C.muted }}>{src.label}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="הערות">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} placeholder="הערות נוספות..." />
          </Field>
        </Modal>
      )}

      {/* ── Project modal ─────────────────────────────────────────────────────── */}
      {projectModal && (
        <Modal title={editingProjectId ? 'עריכת פרויקט' : 'פרויקט חדש'} onClose={() => setProjectModal(false)} onSave={saveProject} saveLabel={saving ? 'שומר...' : 'שמור'}>
          <Field label="שם פרויקט *">
            <input style={inputStyle} value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} placeholder="שם הפרויקט" />
          </Field>
          <Field label="לקוח">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={projectForm.client_id} onChange={e => setProjectForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">ללא לקוח</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="סטטוס">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(STATUSES).map(([key, st]) => (
                <button key={key} onClick={() => setProjectForm(f => ({ ...f, status: key }))}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${projectForm.status === key ? st.color : C.border2}`, background: projectForm.status === key ? `${st.color}18` : C.elevated, color: projectForm.status === key ? st.color : C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.15s' }}>
                  {st.label}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="ערך הפרויקט ₪">
              <input style={inputStyle} type="number" min="0" value={projectForm.total_amount} onChange={e => setProjectForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="0" />
            </Field>
            <Field label="התקבל ₪">
              <input style={inputStyle} type="number" min="0" value={projectForm.received_amount} onChange={e => setProjectForm(f => ({ ...f, received_amount: e.target.value }))} placeholder="0" />
            </Field>
            <Field label="שעות משוערות">
              <input style={inputStyle} type="number" min="0" value={projectForm.estimated_hours} onChange={e => setProjectForm(f => ({ ...f, estimated_hours: e.target.value }))} placeholder="0" />
            </Field>
            <Field label="דדליין">
              <input style={inputStyle} type="date" value={projectForm.deadline} onChange={e => setProjectForm(f => ({ ...f, deadline: e.target.value }))} />
            </Field>
          </div>
          <Field label="הערות">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={projectForm.notes} onChange={e => setProjectForm(f => ({ ...f, notes: e.target.value }))} placeholder="תיאור הפרויקט, הערות..." />
          </Field>

          {/* ── Workflow Templates ───────────────────────────────── */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <LayoutTemplate size={14} style={{ color: C.accent }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>תבניות תהליך עבודה</span>
            </div>
            <WfPanel userId={user.id} />
          </div>
        </Modal>
      )}
    </div>
  );
}
