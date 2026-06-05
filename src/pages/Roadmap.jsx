import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { useIsAdmin } from '../hooks/useIsAdmin.js';
import { useDialog } from '../components/Dialog.jsx';
import {
  ChevronDown, ChevronRight, Plus, Trash2, Edit2,
  Check, X, ExternalLink, Settings2, Map as MapIcon,
} from 'lucide-react';

// ── Category colors ───────────────────────────────────────────
const CATEGORY_COLORS = {
  'Onboarding':   { bg: 'rgba(59,130,246,0.18)',  color: '#93c5fd' },
  'החזון':        { bg: 'rgba(168,85,247,0.18)',  color: '#d8b4fe' },
  'המודל':        { bg: 'rgba(6,182,212,0.18)',   color: '#67e8f9' },
  'לספק':         { bg: 'rgba(34,197,94,0.18)',   color: '#86efac' },
  '10K ספרינט':   { bg: 'rgba(245,158,11,0.18)',  color: '#fcd34d' },
  'לבלוט':        { bg: 'rgba(236,72,153,0.18)',  color: '#f9a8d4' },
  'להוביל':       { bg: 'rgba(99,102,241,0.18)',  color: '#a5b4fc' },
  'לשלוט':        { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5' },
  'AI & Systems': { bg: 'rgba(20,184,166,0.18)',  color: '#5eead4' },
};
function categoryStyle(label) {
  return CATEGORY_COLORS[label] || { bg: 'rgba(245,193,24,0.15)', color: '#F5C118' };
}

// ── Inline text editor ────────────────────────────────────────
function InlineEdit({ value, onSave, className, style, as: Tag = 'span', active }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const inputRef              = useRef(null);

  function start() {
    if (!active) return;
    setDraft(value);
    setEditing(true);
  }

  function save() {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== value) onSave(t);
  }

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter')  save();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={className}
        style={{
          ...style,
          background: 'transparent',
          outline: '1px solid rgba(245,193,24,0.6)',
          borderRadius: 4,
          padding: '1px 6px',
          minWidth: 120,
          border: 'none',
        }}
      />
    );
  }

  return (
    <Tag
      className={className}
      style={{
        ...style,
        ...(active ? { cursor: 'text', borderBottom: '1px dashed rgba(245,193,24,0.35)', paddingBottom: 1 } : {}),
      }}
      onDoubleClick={start}
      title={active ? 'לחץ פעמיים לעריכה' : undefined}
    >
      {value}
    </Tag>
  );
}

// ── Modal ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Roadmap ───────────────────────────────────────────────────
export default function Roadmap() {
  const { user }  = useUser();
  const userId    = user?.id;
  const isAdmin   = useIsAdmin();
  const dialog    = useDialog();

  const [phases,          setPhases]          = useState([]);
  const [completions,     setCompletions]     = useState(new Set());
  const [expanded,        setExpanded]        = useState(new Set());
  const [editMode,        setEditMode]        = useState(false);
  const [loading,         setLoading]         = useState(true);

  // Task modal
  const [taskModal, setTaskModal] = useState(null); // { mode: 'add'|'edit', weekId, task? }
  const [taskForm,  setTaskForm]  = useState({ title: '', level_label: '', category_label: '', link: '' });

  // Add phase form
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [phaseForm,    setPhaseForm]    = useState({ title: '', month_number: '' });

  // Add week form
  const [addWeekForPhase, setAddWeekForPhase] = useState(null);
  const [weekForm,        setWeekForm]        = useState({ title: '', week_number: '' });

  useEffect(() => { if (userId) fetchAll(); }, [userId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [{ data: pData }, { data: wData }, { data: tData }, { data: cData }] = await Promise.all([
        supabase.from('roadmap_phases').select('*').order('sort_order'),
        supabase.from('roadmap_weeks').select('*').order('sort_order'),
        supabase.from('roadmap_tasks').select('*').order('sort_order'),
        supabase.from('roadmap_completions').select('task_id').eq('user_id', userId),
      ]);

      const weekMap = {};
      (wData || []).forEach(w => { weekMap[w.id] = { ...w, tasks: [] }; });
      (tData || []).forEach(t => { if (weekMap[t.week_id]) weekMap[t.week_id].tasks.push(t); });

      const phaseList = (pData || []).map(p => ({
        ...p,
        weeks: (wData || [])
          .filter(w => w.phase_id === p.id)
          .map(w => weekMap[w.id])
          .filter(Boolean)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));

      setPhases(phaseList);
      setCompletions(new Set((cData || []).map(c => c.task_id)));
    } catch (err) {
      console.error('Roadmap load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Completion toggle ─────────────────────────────────────
  async function toggleCompletion(taskId) {
    const done = completions.has(taskId);
    const next = new Set(completions);
    if (done) {
      next.delete(taskId);
      await supabase.from('roadmap_completions').delete().eq('task_id', taskId).eq('user_id', userId);
    } else {
      next.add(taskId);
      await supabase.from('roadmap_completions').insert({ task_id: taskId, user_id: userId });
    }
    setCompletions(next);
  }

  function togglePhase(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Admin: phases ─────────────────────────────────────────
  async function addPhase() {
    if (!phaseForm.title.trim()) return;
    const { data, error } = await supabase.from('roadmap_phases').insert({
      title:        phaseForm.title.trim(),
      month_number: parseInt(phaseForm.month_number) || phases.length + 1,
      sort_order:   phases.length,
    }).select().single();
    if (error) {
      console.error('addPhase error:', error);
      await dialog.alert(error.message || 'שגיאה בהוספת שלב', { title: 'שגיאה בהוספת שלב' });
      return;
    }
    if (data) {
      setPhases(prev => [...prev, { ...data, weeks: [] }]);
      setExpanded(prev => new Set([...prev, data.id]));
    }
    setPhaseForm({ title: '', month_number: '' });
    setShowAddPhase(false);
  }

  async function updatePhaseTitle(id, title) {
    const { error } = await supabase.from('roadmap_phases').update({ title }).eq('id', id);
    if (error) {
      console.error('updatePhaseTitle error:', error);
      await dialog.alert(error.message || 'שגיאה בשמירת השם', { title: 'שגיאה' });
      return;
    }
    setPhases(prev => prev.map(p => p.id === id ? { ...p, title } : p));
  }

  async function deletePhase(id) {
    if (!await dialog.confirm('השלב וכל תוכנו ימחקו לצמיתות.', { title: 'מחיקת שלב', confirmText: 'מחיקה' })) return;
    setPhases(prev => prev.filter(p => p.id !== id));
    await supabase.from('roadmap_phases').delete().eq('id', id);
  }

  // ── Admin: weeks ──────────────────────────────────────────
  async function addWeek(phaseId) {
    if (!weekForm.title.trim()) return;
    const phase = phases.find(p => p.id === phaseId);
    const { data } = await supabase.from('roadmap_weeks').insert({
      phase_id:    phaseId,
      week_number: parseInt(weekForm.week_number) || (phase?.weeks.length || 0) + 1,
      title:       weekForm.title.trim(),
      sort_order:  phase?.weeks.length || 0,
    }).select().single();
    if (data) {
      setPhases(prev => prev.map(p =>
        p.id === phaseId ? { ...p, weeks: [...p.weeks, { ...data, tasks: [] }] } : p
      ));
    }
    setWeekForm({ title: '', week_number: '' });
    setAddWeekForPhase(null);
  }

  async function updateWeekTitle(id, title) {
    setPhases(prev => prev.map(p => ({
      ...p,
      weeks: p.weeks.map(w => w.id === id ? { ...w, title } : w),
    })));
    await supabase.from('roadmap_weeks').update({ title }).eq('id', id);
  }

  async function deleteWeek(phaseId, weekId) {
    if (!await dialog.confirm('השבוע ימחק לצמיתות.', { title: 'מחיקת שבוע', confirmText: 'מחיקה' })) return;
    setPhases(prev => prev.map(p =>
      p.id === phaseId ? { ...p, weeks: p.weeks.filter(w => w.id !== weekId) } : p
    ));
    await supabase.from('roadmap_weeks').delete().eq('id', weekId);
  }

  // ── Admin: tasks ──────────────────────────────────────────
  async function saveTask() {
    if (!taskForm.title.trim() || !taskModal) return;

    if (taskModal.mode === 'add') {
      const week = phases.flatMap(p => p.weeks).find(w => w.id === taskModal.weekId);
      const { data } = await supabase.from('roadmap_tasks').insert({
        week_id:        taskModal.weekId,
        title:          taskForm.title.trim(),
        level_label:    taskForm.level_label,
        category_label: taskForm.category_label,
        link:           taskForm.link,
        sort_order:     week?.tasks.length || 0,
      }).select().single();
      if (data) {
        setPhases(prev => prev.map(p => ({
          ...p,
          weeks: p.weeks.map(w =>
            w.id === taskModal.weekId ? { ...w, tasks: [...w.tasks, data] } : w
          ),
        })));
      }
    } else {
      const taskId = taskModal.task.id;
      const update = {
        title:          taskForm.title.trim(),
        level_label:    taskForm.level_label,
        category_label: taskForm.category_label,
        link:           taskForm.link,
      };
      await supabase.from('roadmap_tasks').update(update).eq('id', taskId);
      setPhases(prev => prev.map(p => ({
        ...p,
        weeks: p.weeks.map(w => ({
          ...w,
          tasks: w.tasks.map(t => t.id === taskId ? { ...t, ...update } : t),
        })),
      })));
    }

    setTaskModal(null);
    setTaskForm({ title: '', level_label: '', category_label: '', link: '' });
  }

  async function deleteTask(weekId, taskId) {
    setPhases(prev => prev.map(p => ({
      ...p,
      weeks: p.weeks.map(w =>
        w.id === weekId ? { ...w, tasks: w.tasks.filter(t => t.id !== taskId) } : w
      ),
    })));
    await supabase.from('roadmap_tasks').delete().eq('id', taskId);
  }

  // ── Derived stats ─────────────────────────────────────────
  const allTasks       = phases.flatMap(p => p.weeks.flatMap(w => w.tasks));
  const totalTasks     = allTasks.length;
  const completedCount = allTasks.filter(t => completions.has(t.id)).length;
  const progressPct    = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const currentMilestone = allTasks.find(t => !completions.has(t.id));
  const milestonePhase   = currentMilestone
    ? phases.find(p => p.weeks.some(w => w.tasks.some(t => t.id === currentMilestone.id)))
    : null;

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgb(var(--bg-surface))' }} />
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="w-full space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-4xl font-bold text-white">מפת דרכים</h1>
        {isAdmin && (
          <button
            onClick={() => setEditMode(m => !m)}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-white/10"
            style={editMode
              ? { borderColor: 'rgba(245,193,24,0.6)', color: '#F5C118' }
              : { borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }
            }
          >
            <Settings2 size={15} />
            {editMode ? 'סיום עריכה' : 'עריכה'}
          </button>
        )}
      </div>

      {/* Overall progress */}
      {totalTasks > 0 && (
        <div
          className="rounded-2xl px-5 py-5 sm:px-8 sm:py-6"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

            {/* Left: numbers */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                התקדמות כוללת
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-6xl font-bold text-white">{completedCount}</span>
                <span className="text-2xl" style={{ color: 'rgba(255,255,255,0.25)' }}>/ {totalTasks}</span>
                <span className="text-base mr-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{progressPct}% הושלם</span>
              </div>
              <div className="mt-4 h-1.5 w-full max-w-xs rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: '#F5C118' }}
                />
              </div>
            </div>

            {/* Right: current milestone */}
            {currentMilestone && (
              <div className="sm:max-w-xs w-full">
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  אבן דרך נוכחית
                </div>
                <div
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="h-2 w-2 rounded-full flex-none" style={{ background: '#F5C118' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{currentMilestone.title}</p>
                    {milestonePhase && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        חודש {milestonePhase.month_number} · {milestonePhase.title}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Empty state */}
      {phases.length === 0 && !editMode && (
        <div
          className="rounded-2xl p-10 sm:p-16 flex flex-col items-center justify-center text-center"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <MapIcon size={44} style={{ color: 'rgba(255,255,255,0.12)', marginBottom: 16 }} />
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem' }}>מפת הדרכים טרם הוגדרה</p>
          {isAdmin && (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', marginTop: 6 }}>
              לחץ על "עריכה" כדי להתחיל לבנות
            </p>
          )}
        </div>
      )}

      {/* Phases */}
      <div className="space-y-4">
        {phases.map(phase => {
          const phaseTasks     = phase.weeks.flatMap(w => w.tasks);
          const phaseCompleted = phaseTasks.filter(t => completions.has(t.id)).length;
          const phaseTotal     = phaseTasks.length;
          const phasePct       = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
          const isOpen         = expanded.has(phase.id);
          const circleR        = 22;
          const circumference  = 2 * Math.PI * circleR;

          return (
            <div
              key={phase.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* Phase header */}
              <div
                className="flex items-center gap-5 px-6 py-5 cursor-pointer hover:bg-white/5 transition select-none"
                onClick={() => togglePhase(phase.id)}
              >
                {/* Month badge */}
                <div
                  className="flex-none flex flex-col items-center justify-center rounded-xl"
                  style={{ minWidth: 64, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>חודש</div>
                  <div className="text-3xl font-bold text-white leading-none mt-0.5">
                    {String(phase.month_number).padStart(2, '0')}
                  </div>
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0 py-1" onClick={e => editMode && e.stopPropagation()}>
                  <InlineEdit
                    value={phase.title}
                    onSave={t => updatePhaseTitle(phase.id, t)}
                    active={editMode}
                    className="text-xl"
                    style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700 }}
                  />
                  <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {phaseCompleted} מתוך {phaseTotal} משימות · {phasePct}%
                  </div>
                </div>

                {/* Circular progress + controls */}
                <div className="flex items-center gap-3 flex-none">
                  <svg width="56" height="56">
                    <circle cx="28" cy="28" r={circleR} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
                    <circle
                      cx="28" cy="28" r={circleR} fill="none"
                      stroke={phasePct === 100 ? '#22c55e' : '#F5C118'}
                      strokeWidth="3.5"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - phasePct / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 28 28)"
                      style={{ transition: 'stroke-dashoffset 0.5s' }}
                    />
                    <text x="28" y="33" textAnchor="middle" fontSize="11"
                      fill={phasePct === 100 ? '#22c55e' : '#F5C118'} fontWeight="bold">
                      {phasePct}%
                    </text>
                  </svg>

                  {editMode && (
                    <button
                      onClick={e => { e.stopPropagation(); deletePhase(phase.id); }}
                      className="rounded-md p-1.5 transition hover:bg-red-500/20"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  {isOpen
                    ? <ChevronDown size={22} style={{ color: 'rgba(255,255,255,0.35)' }} />
                    : <ChevronRight size={22} style={{ color: 'rgba(255,255,255,0.35)' }} />
                  }
                </div>
              </div>

              {/* Phase content */}
              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {phase.weeks.map(week => (
                    <div key={week.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

                      {/* Week header */}
                      <div
                        className="flex items-center justify-between px-6 py-3"
                        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)', minWidth: 56 }}>
                            שבוע {week.week_number}
                          </span>
                          <InlineEdit
                            value={week.title}
                            onSave={t => updateWeekTitle(week.id, t)}
                            active={editMode}
                            className="text-sm"
                            style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            {week.tasks.filter(t => completions.has(t.id)).length}/{week.tasks.length}
                          </span>
                          {editMode && (
                            <>
                              <button
                                onClick={() => {
                                  setTaskModal({ mode: 'add', weekId: week.id });
                                  setTaskForm({ title: '', level_label: '', category_label: '', link: '' });
                                }}
                                className="rounded-md p-1 hover:bg-white/10 transition"
                                style={{ color: 'rgba(255,255,255,0.4)' }}
                                title="הוסף משימה"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                onClick={() => deleteWeek(phase.id, week.id)}
                                className="rounded-md p-1 hover:bg-red-500/20 transition"
                                style={{ color: 'rgba(255,255,255,0.3)' }}
                                title="מחק שבוע"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tasks */}
                      {week.tasks.map(task => {
                        const done = completions.has(task.id);
                        return (
                          <div
                            key={task.id}
                            className="flex items-center px-6 py-3.5 hover:bg-white/5 transition group"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.04)', gap: 0 }}
                          >
                            {/* Checkbox */}
                            <div style={{ width: 36, flexShrink: 0 }}>
                              <button
                                onClick={() => toggleCompletion(task.id)}
                                className="h-5 w-5 rounded-full border-2 flex items-center justify-center transition"
                                style={{
                                  borderColor: done ? '#22c55e' : 'rgba(255,255,255,0.2)',
                                  background:  done ? '#22c55e' : 'transparent',
                                }}
                              >
                                {done && <Check size={11} strokeWidth={3} color="#fff" />}
                              </button>
                            </div>

                            {/* Title — flex-1 */}
                            <span
                              className="flex-1 text-sm"
                              style={{
                                color:          done ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.88)',
                                textDecoration: done ? 'line-through' : 'none',
                                fontWeight:     done ? 400 : 500,
                                paddingLeft: 8,
                                paddingRight: 8,
                              }}
                            >
                              {task.title}
                            </span>

                            {/* Level — hidden on mobile */}
                            <div className="hidden sm:block" style={{ width: 110, flexShrink: 0 }}>
                              {task.level_label ? (
                                <span
                                  className="text-xs px-2.5 py-1 rounded-md font-medium"
                                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}
                                >
                                  {task.level_label}
                                </span>
                              ) : null}
                            </div>

                            {/* Category — hidden on mobile */}
                            <div className="hidden sm:block" style={{ width: 140, flexShrink: 0 }}>
                              {task.category_label ? (
                                <span
                                  className="text-xs px-2.5 py-1 rounded-md font-semibold"
                                  style={{ background: categoryStyle(task.category_label).bg, color: categoryStyle(task.category_label).color }}
                                >
                                  {task.category_label}
                                </span>
                              ) : null}
                            </div>

                            {/* Link + actions — עמודה קבועה */}
                            <div className="flex items-center gap-1" style={{ width: 64, flexShrink: 0, justifyContent: 'flex-end' }}>
                              {task.link && (
                                <a
                                  href={task.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="hover:text-white/60 transition rounded-md p-1"
                                  style={{ color: 'rgba(255,255,255,0.25)' }}
                                  title="פתח קישור"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              {editMode && (
                                <>
                                  <button
                                    onClick={() => {
                                      setTaskModal({ mode: 'edit', weekId: week.id, task });
                                      setTaskForm({
                                        title:          task.title,
                                        level_label:    task.level_label    || '',
                                        category_label: task.category_label || '',
                                        link:           task.link           || '',
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 rounded-md p-1 hover:bg-white/10 transition"
                                    style={{ color: 'rgba(255,255,255,0.4)' }}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => deleteTask(week.id, task.id)}
                                    className="opacity-0 group-hover:opacity-100 rounded-md p-1 hover:bg-red-500/20 transition"
                                    style={{ color: 'rgba(255,255,255,0.3)' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Empty week */}
                      {week.tasks.length === 0 && (
                        <div className="px-5 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          {editMode ? 'אין משימות — לחץ + להוסיף' : 'אין משימות בשבוע זה'}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add week row */}
                  {editMode && (
                    <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {addWeekForPhase === phase.id ? (
                        <div className="flex gap-2">
                          <input
                            placeholder="שבוע #"
                            value={weekForm.week_number}
                            onChange={e => setWeekForm(f => ({ ...f, week_number: e.target.value }))}
                            className="w-20 rounded-lg px-3 py-1.5 text-sm outline-none"
                            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                          />
                          <input
                            placeholder="שם השבוע"
                            value={weekForm.title}
                            onChange={e => setWeekForm(f => ({ ...f, title: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') addWeek(phase.id); if (e.key === 'Escape') setAddWeekForPhase(null); }}
                            className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                            autoFocus
                          />
                          <button onClick={() => addWeek(phase.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-accent text-accent-foreground">הוסף</button>
                          <button onClick={() => setAddWeekForPhase(null)} className="rounded-lg px-3 py-1.5 text-xs hover:text-white/70" style={{ color: 'rgba(255,255,255,0.4)' }}>ביטול</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddWeekForPhase(phase.id); setWeekForm({ title: '', week_number: '' }); }}
                          className="flex items-center gap-1.5 text-xs hover:text-white/60 transition"
                          style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                          <Plus size={13} /> הוסף שבוע
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add phase */}
        {editMode && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgb(var(--bg-surface))', border: '1px dashed rgba(255,255,255,0.1)' }}
          >
            {showAddPhase ? (
              <div className="flex gap-2">
                <input
                  placeholder="חודש #"
                  value={phaseForm.month_number}
                  onChange={e => setPhaseForm(f => ({ ...f, month_number: e.target.value }))}
                  className="w-20 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                />
                <input
                  placeholder="שם השלב"
                  value={phaseForm.title}
                  onChange={e => setPhaseForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addPhase(); if (e.key === 'Escape') setShowAddPhase(false); }}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  autoFocus
                />
                <button onClick={addPhase} className="rounded-lg px-4 py-2 text-sm font-semibold bg-accent text-accent-foreground">הוסף שלב</button>
                <button onClick={() => setShowAddPhase(false)} className="rounded-lg px-3 py-2 text-sm hover:text-white/70" style={{ color: 'rgba(255,255,255,0.4)' }}>ביטול</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddPhase(true)}
                className="w-full flex items-center justify-center gap-2 text-sm py-1 hover:text-white/60 transition"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                <Plus size={15} /> הוסף שלב חדש
              </button>
            )}
          </div>
        )}
      </div>

      {/* Task modal */}
      {taskModal && (
        <Modal
          title={taskModal.mode === 'add' ? 'הוסף משימה' : 'ערוך משימה'}
          onClose={() => setTaskModal(null)}
        >
          <div className="space-y-4">

            {/* שם משימה */}
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>שם המשימה *</label>
              <input
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="תיאור המשימה..."
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>

            {/* רמה */}
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>רמה</label>
              <select
                value={taskForm.level_label}
                onChange={e => setTaskForm(f => ({ ...f, level_label: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              >
                <option value="">ללא רמה</option>
                {[0,1,2,3,4,5,6,7].map(n => (
                  <option key={n} value={`Level ${n}`}>Level {n}</option>
                ))}
              </select>
            </div>

            {/* קטגוריה */}
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>קטגוריה</label>
              <select
                value={taskForm.category_label}
                onChange={e => setTaskForm(f => ({ ...f, category_label: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              >
                <option value="">ללא קטגוריה</option>
                {['Onboarding','החזון','המודל','לספק','10K ספרינט','לבלוט','להוביל','לשלוט','AI & Systems'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* קישור */}
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>קישור</label>
              <input
                value={taskForm.link}
                onChange={e => setTaskForm(f => ({ ...f, link: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                onKeyDown={e => { if (e.key === 'Enter') saveTask(); }}
              />
            </div>

            <button
              onClick={saveTask}
              disabled={!taskForm.title.trim()}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-30 bg-accent text-accent-foreground"
            >
              {taskModal.mode === 'add' ? 'הוסף משימה' : 'שמור שינויים'}
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
