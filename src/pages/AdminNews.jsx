import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Plus, Trash2, Pin, PinOff, Eye, EyeOff, Edit2, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const EMOJI_OPTIONS = ['📢', '🚀', '🎉', '⚡', '🔥', '💡', '📅', '🏆', '✨', '🛠️', '🎓', '💬'];

function NewsCard({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: item.title, body: item.body || '', emoji: item.emoji || '📢' });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/news/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const updated = await res.json();
      onUpdate(updated);
      setEditing(false);
    } finally { setSaving(false); }
  }

  async function toggle(field) {
    const res = await fetch(`/api/news/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !item[field] }),
    });
    const updated = await res.json();
    onUpdate(updated);
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: 'rgb(var(--bg-surface))',
        border: item.pinned ? '1px solid rgba(245,193,24,0.3)' : '1px solid rgba(255,255,255,0.08)',
        opacity: item.published ? 1 : 0.5,
      }}
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          {/* emoji picker */}
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map(e => (
              <button
                key={e}
                onClick={() => setForm(f => ({ ...f, emoji: e }))}
                className="text-xl rounded-lg p-1.5"
                style={{ background: form.emoji === e ? 'rgba(245,193,24,0.2)' : 'rgba(255,255,255,0.06)', border: form.emoji === e ? '1px solid #F5C118' : '1px solid transparent' }}
              >{e}</button>
            ))}
          </div>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="כותרת *"
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
          />
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="תוכן (אופציונלי)"
            rows={3}
            className="w-full rounded-xl px-4 py-2.5 text-sm resize-none"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', outline: 'none' }}
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.title.trim()} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40">
              <Check size={14} /> שמור
            </button>
            <button onClick={() => { setEditing(false); setForm({ title: item.title, body: item.body || '', emoji: item.emoji || '📢' }); }} className="px-4 py-2 text-sm rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-none h-10 w-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>{item.emoji || '📢'}</div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 15, fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{item.title}</p>
            {item.body && <p style={{ fontSize: 13, marginTop: 4, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{item.body}</p>}
            <p style={{ fontSize: 11, marginTop: 6, color: 'rgba(255,255,255,0.2)' }}>
              {new Date(item.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => toggle('pinned')} title={item.pinned ? 'הסר פין' : 'הצמד'} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-80" style={{ background: item.pinned ? 'rgba(245,193,24,0.15)' : 'rgba(255,255,255,0.06)', color: item.pinned ? '#F5C118' : 'rgba(255,255,255,0.5)' }}>
            {item.pinned ? <Pin size={12} /> : <PinOff size={12} />} {item.pinned ? 'מוצמד' : 'הצמד'}
          </button>
          <button onClick={() => toggle('published')} title={item.published ? 'הסתר' : 'פרסם'} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            {item.published ? <Eye size={12} /> : <EyeOff size={12} />} {item.published ? 'פורסם' : 'מוסתר'}
          </button>
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <Edit2 size={12} /> ערוך
          </button>
          <button onClick={() => onDelete(item.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 mr-auto" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
            <Trash2 size={12} /> מחק
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminNews() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', body: '', emoji: '📢' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && user?.id !== ADMIN_ID) navigate('/', { replace: true });
  }, [isLoaded, user]);

  useEffect(() => {
    fetch('/api/news/all')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setItems(d); })
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    if (!newForm.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      const item = await res.json();
      setItems(prev => [item, ...prev]);
      setNewForm({ title: '', body: '', emoji: '📢' });
      setCreating(false);
    } finally { setSaving(false); }
  }

  function handleUpdate(updated) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  async function handleDelete(id) {
    if (!confirm('למחוק את הפריט?')) return;
    await fetch(`/api/news/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* כותרת */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 'var(--t-h1)', fontWeight: 900, color: 'white' }}>חדשות ועדכונים</h1>
          <p style={{ fontSize: 'var(--t-body)', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            פריטים מוצמדים מוצגים ראשונים · מוסתרים לא מופיעים לתלמידים
          </p>
        </div>
        <button
          onClick={() => setCreating(c => !c)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          {creating ? <X size={15} /> : <Plus size={15} />}
          {creating ? 'ביטול' : 'פריט חדש'}
        </button>
      </div>

      {/* טופס יצירה */}
      {creating && (
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(245,193,24,0.2)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#F5C118', letterSpacing: '0.05em' }}>פריט חדש</p>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setNewForm(f => ({ ...f, emoji: e }))} className="text-xl rounded-lg p-1.5"
                style={{ background: newForm.emoji === e ? 'rgba(245,193,24,0.2)' : 'rgba(255,255,255,0.06)', border: newForm.emoji === e ? '1px solid #F5C118' : '1px solid transparent' }}>
                {e}
              </button>
            ))}
          </div>
          <input
            value={newForm.title}
            onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
            placeholder="כותרת *"
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
          />
          <textarea
            value={newForm.body}
            onChange={e => setNewForm(f => ({ ...f, body: e.target.value }))}
            placeholder="פירוט (אופציונלי)"
            rows={3}
            className="w-full rounded-xl px-4 py-2.5 text-sm resize-none"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', outline: 'none' }}
          />
          <button
            onClick={create}
            disabled={saving || !newForm.title.trim()}
            className="btn-primary px-5 py-2.5 text-sm self-start flex items-center gap-2 disabled:opacity-40"
          >
            {saving ? 'שומר...' : <><Plus size={14} /> פרסם</>}
          </button>
        </div>
      )}

      {/* רשימה */}
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>טוען...</div>
      ) : items.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>אין פריטים עדיין</div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(item => (
            <NewsCard key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
