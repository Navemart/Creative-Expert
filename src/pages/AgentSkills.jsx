import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Download, ExternalLink, Star, Trash2,
  Edit2, X, Check, ChevronDown, BookOpen, Tag,
} from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

// ─── Tag pill ─────────────────────────────────────────────────────────────────
function TagPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
      style={{
        background: active ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.08)',
        color: active ? 'rgb(var(--accent-foreground))' : 'rgba(255,255,255,0.7)',
        border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {label}
    </button>
  );
}

// ─── Featured card ────────────────────────────────────────────────────────────
function FeaturedCard({ skill, isAdmin, onEdit, onDelete, onDownload, onPreview }) {
  if (!skill) return null;
  return (
    <div
      className="rounded-2xl p-6 mb-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(245,193,24,0.12) 0%, rgb(var(--bg-surface)) 60%)',
        border: '1px solid rgba(245,193,24,0.25)',
      }}
    >
      {/* label */}
      <div className="flex items-center gap-1.5 mb-3">
        <Star size={12} fill="rgb(var(--accent))" color="rgb(var(--accent))" />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgb(var(--accent))' }}>
          סקיל השבוע
        </span>
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black mb-1" style={{ color: 'white' }}>{skill.title}</h2>
          <p className="text-sm mb-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', maxWidth: '55ch' }}>
            {skill.description}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {/* author */}
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
                style={{ background: 'rgba(245,193,24,0.2)', color: 'rgb(var(--accent))' }}
              >
                {skill.author?.[0] || 'N'}
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{skill.author}</span>
            </div>

            {/* downloads */}
            <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <Download size={12} />
              <span className="text-xs">{skill.download_count || 0} הורדות</span>
            </div>

            {/* tags */}
            {skill.tags?.slice(0, 3).map(t => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md text-[11px]"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(skill)}
                className="p-2 rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(skill)}
                className="p-2 rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {skill.file_url && (
            <a
              href={skill.file_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => onDownload(skill.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <Download size={14} /> הורדה
            </a>
          )}
          <button
            onClick={() => onPreview(skill)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold btn-yellow"
            style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}
          >
            <ExternalLink size={14} /> פתח
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skill card ───────────────────────────────────────────────────────────────
function SkillCard({ skill, isAdmin, onEdit, onDelete, onDownload, onClick }) {
  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-5 flex flex-col gap-3 cursor-pointer transition-all hover:translate-y-[-2px]"
      style={{
        background: 'rgb(var(--bg-surface))',
        border: '1px solid rgba(255,255,255,0.08)',
        opacity: skill.published ? 1 : 0.5,
      }}
    >
      <div className="flex-1">
        <h3 className="font-semibold text-sm mb-1.5 leading-snug" style={{ color: 'white' }}>
          {skill.title}
        </h3>
        <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {skill.description}
        </p>
      </div>

      {/* tags */}
      {skill.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skill.tags.slice(0, 3).map(t => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-md text-[10px]"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* footer */}
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-none"
            style={{ background: 'rgba(245,193,24,0.15)', color: 'rgb(var(--accent))' }}
          >
            {skill.author?.[0] || 'N'}
          </div>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{skill.author}</span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={e => { e.stopPropagation(); onEdit(skill); }}
                className="p-1 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(skill); }}
                className="p-1 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
          <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <Download size={11} />
            <span className="text-[11px]">{skill.download_count || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skill preview modal ──────────────────────────────────────────────────────
function SkillPreviewModal({ skill, isAdmin, onClose, onEdit, onDelete, onDownload }) {
  if (!skill) return null;

  function handleDownloadClick() {
    onDownload(skill.id);
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{
          background: 'rgb(var(--bg-surface))',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-black leading-tight mb-2" style={{ color: 'white' }}>
              {skill.title}
            </h2>
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
                  style={{ background: 'rgba(245,193,24,0.2)', color: 'rgb(var(--accent))' }}
                >
                  {skill.author?.[0] || 'N'}
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{skill.author}</span>
              </div>
              {skill.created_at && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {new Date(skill.created_at).toLocaleDateString('he-IL')}
                </span>
              )}
              <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <Download size={12} />
                <span className="text-xs">{skill.download_count || 0} הורדות</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 transition-colors flex-none"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tags */}
        {skill.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-6 pb-4">
            {skill.tags.map(t => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 px-6 pb-4">
          {skill.file_url && (
            <a
              href={skill.file_url}
              target="_blank"
              rel="noreferrer"
              onClick={handleDownloadClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold btn-yellow"
              style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}
            >
              <Download size={14} /> הורד קובץ
            </a>
          )}
          {isAdmin && (
            <>
              <button
                onClick={() => { onClose(); onEdit(skill); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Edit2 size={13} /> עריכה
              </button>
              <button
                onClick={() => { onClose(); onDelete(skill); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,100,100,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Trash2 size={13} /> מחיקה
              </button>
            </>
          )}
        </div>

        {/* Description */}
        {skill.description && (
          <div
            className="flex-1 overflow-y-auto px-6 pb-6 min-h-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {skill.description}
            </p>
            {skill.full_content && (
              <pre className="mt-4 text-xs leading-relaxed whitespace-pre-wrap font-sans" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {skill.full_content}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Skill form dialog ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', description: '', full_content: '', author: 'Nave Martziano',
  tags: '', file_url: '', featured: false, published: true,
};

function SkillDialog({ skill, onClose, onSave }) {
  const [form, setForm] = useState(
    skill
      ? { ...skill, tags: (skill.tags || []).join(', ') }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(skill?.file_url ? skill.file_url.split('/').pop() : '');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      // store filename as placeholder URL — real upload would need storage
      set('file_url', file.name);
    }
  }

  async function submit() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      const url = skill ? `/api/skills/${skill.id}` : '/api/skills';
      const method = skill ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saved = await res.json();
      onSave(saved, !skill);
      onClose();
    } finally { setSaving(false); }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'white',
    outline: 'none',
    borderRadius: '0.625rem',
    padding: '0.6rem 0.875rem',
    fontSize: '0.875rem',
    width: '100%',
  };

  const labelStyle = {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '0.375rem',
    display: 'block',
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center pt-16 pb-6 px-6"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', maxHeight: 'calc(100vh - 88px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="font-black text-base" style={{ color: 'white' }}>
            {skill ? 'עריכת סקיל' : 'פרסום סקיל'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          {/* Upload zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => document.getElementById('skill-file-input').click()}
            className="rounded-xl flex flex-col items-center justify-center gap-2 py-7 cursor-pointer transition-all"
            style={{
              border: `1.5px dashed ${dragOver ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.15)'}`,
              background: dragOver ? 'rgba(245,193,24,0.06)' : 'rgba(255,255,255,0.03)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Download size={17} style={{ color: 'rgba(255,255,255,0.5)', transform: 'rotate(180deg)' }} />
            </div>
            {fileName
              ? <span className="text-sm font-medium" style={{ color: 'white' }}>{fileName}</span>
              : <>
                  <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>לחץ לבחירת קובץ .md או .zip</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>גודל מקסימלי 5MB</span>
                </>
            }
            <input id="skill-file-input" type="file" accept=".md,.zip" className="hidden" onChange={handleFileDrop} />
          </div>

          {/* Or URL */}
          <div className="flex flex-col gap-1">
            <label style={labelStyle}>או קישור לקובץ</label>
            <input
              value={form.file_url}
              onChange={e => { set('file_url', e.target.value); setFileName(''); }}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label style={labelStyle}>שם הסקיל <span style={{ color: 'rgba(255,255,255,0.25)' }}>(אופציונלי — ברירת מחדל מה-frontmatter)</span></label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="לדוג׳: Content Creator Pro" style={inputStyle} />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label style={labelStyle}>תיאור <span style={{ color: 'rgba(255,255,255,0.25)' }}>(אופציונלי)</span></label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="מה הסקיל הזה עושה?"
              rows={3}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1">
            <label style={labelStyle}>תגיות <span style={{ color: 'rgba(255,255,255,0.25)' }}>(מופרדות בפסיק, עד 12)</span></label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="sales, strategy, audit" style={inputStyle} />
          </div>

          {/* Toggles */}
          <div className="flex gap-5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.featured} onChange={e => set('featured', e.target.checked)} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>סקיל השבוע</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.published} onChange={e => set('published', e.target.checked)} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>פרסם מיד</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl transition-colors"
            style={{ color: 'rgba(255,255,255,0.55)', background: 'transparent' }}
          >
            ביטול
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.title.trim()}
            className="px-5 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-40 btn-yellow"
            style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}
          >
            <Check size={13} /> {saving ? 'שומר...' : 'פרסם סקיל'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgentSkills() {
  const { user } = useUser();
  const navigate = useNavigate();
  const isAdmin = user?.id === ADMIN_ID;

  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('הכל');
  const [sort, setSort] = useState('newest');
  const [dialog, setDialog] = useState(null); // null | 'add' | skill-object
  const [preview, setPreview] = useState(null); // null | skill-object
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    const url = isAdmin ? '/api/skills/all' : '/api/skills';
    fetch(url)
      .then(r => r.json())
      .then(d => { setSkills(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isAdmin]);

  // collect all unique tags
  const allTags = useMemo(() => {
    const tags = new Set();
    skills.forEach(s => s.tags?.forEach(t => tags.add(t)));
    return ['הכל', ...Array.from(tags)];
  }, [skills]);

  // filter + sort
  const filtered = useMemo(() => {
    let list = skills;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
      );
    }
    if (activeTag !== 'הכל') {
      list = list.filter(s => s.tags?.includes(activeTag));
    }
    if (sort === 'popular') {
      list = [...list].sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    }
    return list;
  }, [skills, search, activeTag, sort]);

  const featured = filtered.find(s => s.featured);
  const grid = filtered.filter(s => !s.featured);

  async function handleDelete(skill) {
    if (!confirm(`למחוק את "${skill.title}"?`)) return;
    await fetch(`/api/skills/${skill.id}`, { method: 'DELETE' });
    setSkills(prev => prev.filter(s => s.id !== skill.id));
  }

  async function handleDownload(id) {
    await fetch(`/api/skills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ download_count: (skills.find(s => s.id === id)?.download_count || 0) + 1 }),
    });
    setSkills(prev => prev.map(s => s.id === id ? { ...s, download_count: (s.download_count || 0) + 1 } : s));
  }

  function handleSaved(saved, isNew) {
    setSkills(prev => {
      // if featured, unfeature others
      let list = saved.featured ? prev.map(s => ({ ...s, featured: s.id === saved.id ? true : false })) : [...prev];
      if (isNew) return [saved, ...list.filter(s => s.id !== saved.id)];
      return list.map(s => s.id === saved.id ? saved : s);
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black" style={{ color: 'white' }}>סקילים</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {filtered.length} סקילים
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setDialog('add')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl btn-yellow"
            style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}
          >
            <Plus size={15} /> + הוספת סקיל
          </button>
        )}
      </div>

      {/* Search + Sort */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" style={{ color: 'rgba(255,255,255,0.4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש סקילים..."
            className="w-full rounded-xl pr-9 pl-4 py-2.5 text-sm"
            style={{
              background: 'rgb(var(--bg-surface))',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              outline: 'none',
            }}
          />
        </div>
        <div className="relative flex-shrink-0">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="h-full rounded-xl px-4 pl-8 py-2.5 text-sm appearance-none"
            style={{
              background: 'rgb(var(--bg-surface))',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.75)',
              outline: 'none',
            }}
          >
            <option value="newest">חדש ביותר</option>
            <option value="popular">הכי מורד</option>
          </select>
          <ChevronDown size={13} className="absolute top-1/2 -translate-y-1/2 left-3 pointer-events-none" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {allTags.map(tag => (
          <TagPill
            key={tag}
            label={tag}
            active={activeTag === tag}
            onClick={() => setActiveTag(tag)}
          />
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.4)' }}>
          טוען סקילים...
        </div>
      )}

      {/* Featured */}
      {!loading && featured && (
        <FeaturedCard
          skill={featured}
          isAdmin={isAdmin}
          onEdit={s => setDialog(s)}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onPreview={s => setPreview(s)}
        />
      )}

      {/* Grid */}
      {!loading && grid.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grid.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isAdmin={isAdmin}
              onEdit={s => setDialog(s)}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onClick={() => setPreview(skill)}
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <BookOpen size={36} style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>לא נמצאו סקילים</p>
          {isAdmin && (
            <button
              onClick={() => setDialog('add')}
              className="px-4 py-2 text-sm font-semibold rounded-xl mt-1 btn-yellow"
              style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}
            >
              <Plus size={14} className="inline ml-1" /> הוסף סקיל ראשון
            </button>
          )}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <SkillPreviewModal
          skill={preview}
          isAdmin={isAdmin}
          onClose={() => setPreview(null)}
          onEdit={s => { setPreview(null); setDialog(s); }}
          onDelete={s => { setPreview(null); handleDelete(s); }}
          onDownload={handleDownload}
        />
      )}

      {/* Edit/Add dialog */}
      {dialog && (
        <SkillDialog
          skill={dialog === 'add' ? null : dialog}
          onClose={() => setDialog(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}
