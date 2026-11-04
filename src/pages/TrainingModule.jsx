import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { ChevronRight, Play, FileText, CheckCircle2, Loader } from 'lucide-react';

export default function TrainingModule() {
  const { moduleKey } = useParams();
  const navigate      = useNavigate();
  const { user }      = useUser();
  const [module,  setModule]  = useState(null);
  const [lessons, setLessons] = useState([]);
  const [done,    setDone]    = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: mod }, { data: less }] = await Promise.all([
        supabase.from('training_modules').select('*').eq('key', moduleKey).single(),
        supabase.from('training_lessons').select('*').eq('module_key', moduleKey).order('sort_order'),
      ]);
      setModule(mod);
      const list = less || [];
      setLessons(list);

      if (user?.id && list.length) {
        const { data: comps } = await supabase
          .from('lesson_completions').select('lesson_id')
          .eq('user_id', user.id).in('lesson_id', list.map(l => l.id));
        setDone(new Set((comps || []).map(c => c.lesson_id)));
      }
      setLoading(false);
    }
    load();
  }, [moduleKey, user?.id]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
    </div>
  );

  if (!module) return (
    <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.4)' }}>מודול לא נמצא</div>
  );

  const pct = lessons.length > 0 ? Math.round((done.size / lessons.length) * 100) : 0;

  return (
    <div className="w-full" dir="rtl">

      {/* Breadcrumb */}
      <button onClick={() => navigate('/content-library')}
        className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'rgba(255,255,255,0.35)' }}>
        <ChevronRight size={15} className="rotate-180" />
        ספריית תכנים
      </button>

      {/* Module header */}
      <div className="flex items-end justify-between gap-6 mb-2">
        <h1 className="text-3xl font-bold text-white leading-tight">{module.title}</h1>
        <span className="text-sm flex-none pb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {done.size}/{lessons.length} שיעורים הושלמו
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden mb-8" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'rgb(var(--accent))' }} />
      </div>

      {/* Lesson rows — grouped by section */}
      <div>
        {groupBySections(lessons).map(({ section, items, startIndex }) => (
          <div key={section || '__none__'}>
            {section && (
              <div className="pt-6 pb-2 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}>
                  {section}
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              </div>
            )}
            {items.map((lesson, j) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={startIndex + j}
                moduleKey={moduleKey}
                completed={done.has(lesson.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function groupBySections(lessons) {
  const groups = [];
  let current = null;
  let startIndex = 0;
  let globalIdx = 0;

  for (const lesson of lessons) {
    const sec = lesson.section_title || null;
    if (!current || current.section !== sec) {
      current = { section: sec, items: [], startIndex: globalIdx };
      groups.push(current);
      startIndex = globalIdx;
    }
    current.items.push(lesson);
    globalIdx++;
  }
  return groups;
}

function LessonRow({ lesson, index, moduleKey, completed }) {
  const navigate = useNavigate();
  const hasVideo = !!lesson.loom_url;
  const hasText  = !!lesson.content_md;
  const duration = lesson.duration_text || null;

  return (
    <button
      onClick={() => navigate(`/training/${moduleKey}/${lesson.id}`)}
      className="w-full flex items-center gap-4 py-4 text-right group transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Check icon */}
      <div className="flex-none w-5 flex items-center justify-center">
        {completed
          ? <CheckCircle2 size={18} style={{ color: 'rgb(var(--accent))' }} />
          : <div className="w-4 h-4 rounded-full border" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        }
      </div>

      {/* Number */}
      <span className="flex-none text-sm font-mono w-5 text-center"
        style={{ color: 'rgba(255,255,255,0.2)' }}>
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Title */}
      <span className="flex-1 text-sm font-medium leading-snug group-hover:opacity-70 transition-opacity"
        style={{ color: completed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.88)', textDecoration: completed ? 'line-through' : 'none' }}>
        {lesson.title}
      </span>

      {/* Content type badges */}
      <div className="flex items-center gap-2 flex-none">
        {hasVideo && (
          <span className="flex items-center gap-1 text-xs rounded-md px-2 py-0.5"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
            <Play size={10} /> וידאו
          </span>
        )}
        {hasText && (
          <span className="flex items-center gap-1 text-xs rounded-md px-2 py-0.5"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
            <FileText size={10} /> טקסט
          </span>
        )}
        {!hasVideo && !hasText && (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>בהכנה</span>
        )}
      </div>

      {/* Duration */}
      <span className="flex-none text-xs w-10 text-left"
        style={{ color: 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>
        {duration || '—'}
      </span>
    </button>
  );
}
