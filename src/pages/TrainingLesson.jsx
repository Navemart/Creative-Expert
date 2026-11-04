import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIsAdmin } from '../hooks/useIsAdmin.js';
import { supabase } from '../lib/supabase.js';
import { ChevronRight, ExternalLink, Pencil, Check, X, Loader } from 'lucide-react';

export default function TrainingLesson() {
  const { moduleKey, lessonId } = useParams();
  const navigate  = useNavigate();
  const isAdmin   = useIsAdmin();
  const [lesson,  setLesson]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState({ loom_url: '', content_md: '' });
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    supabase.from('training_lessons').select('*').eq('id', lessonId).single()
      .then(({ data }) => { setLesson(data); setLoading(false); });
  }, [lessonId]);

  function startEdit() {
    setDraft({ loom_url: lesson.loom_url || '', content_md: lesson.content_md || '' });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    const { error } = await supabase.from('training_lessons')
      .update({ loom_url: draft.loom_url || null, content_md: draft.content_md || null })
      .eq('id', lessonId);
    if (!error) setLesson(prev => ({ ...prev, ...draft }));
    setSaving(false);
    setEditing(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
    </div>
  );

  if (!lesson) return (
    <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.4)' }}>שיעור לא נמצא</div>
  );

  const loomId = extractLoomId(lesson.loom_url);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <button onClick={() => navigate(`/training/${moduleKey}`)}
        className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'rgba(255,255,255,0.4)' }}>
        <ChevronRight size={15} className="rotate-180" />
        חזרה למודול
      </button>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-bold text-white leading-snug">{lesson.title}</h1>
        <div className="flex items-center gap-2 flex-none">
          {lesson.skool_url && (
            <a href={lesson.skool_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-opacity hover:opacity-70"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              <ExternalLink size={12} /> Skool
            </a>
          )}
          {isAdmin && !editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-opacity hover:opacity-70"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              <Pencil size={12} /> ערוך
            </button>
          )}
        </div>
      </div>

      {/* Edit panel (admin only) */}
      {editing && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Loom URL</label>
            <input value={draft.loom_url} onChange={e => setDraft(d => ({ ...d, loom_url: e.target.value }))}
              placeholder="https://www.loom.com/share/..."
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              dir="ltr" />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>תוכן (Markdown)</label>
            <textarea value={draft.content_md} onChange={e => setDraft(d => ({ ...d, content_md: e.target.value }))}
              rows={8} placeholder="תוכן השיעור..."
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-y"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
          </div>
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#86efac' }}>
              {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />} שמור
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              <X size={13} /> ביטול
            </button>
          </div>
        </div>
      )}

      {/* Loom embed */}
      {loomId && (
        <div className="relative rounded-2xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={`https://www.loom.com/embed/${loomId}`}
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allowFullScreen
            title={lesson.title}
          />
        </div>
      )}

      {/* Text body */}
      {lesson.content_md && (
        <div className="prose prose-invert max-w-none text-sm leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.75)' }}
          dangerouslySetInnerHTML={{ __html: simpleMarkdown(lesson.content_md) }} />
      )}

      {/* Empty state */}
      {!loomId && !lesson.content_md && !editing && (
        <div className="rounded-xl py-12 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {isAdmin ? 'לחץ על "ערוך" כדי להוסיף Loom URL או טקסט' : 'תוכן בהכנה'}
          </p>
        </div>
      )}
    </div>
  );
}

function extractLoomId(url) {
  if (!url) return null;
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]+)/i);
  return match ? match[1] : null;
}

function simpleMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-white mt-4 mb-1">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-white mt-3 mb-1">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="mr-4">$1</li>')
    .replace(/\n/g, '<br/>');
}
