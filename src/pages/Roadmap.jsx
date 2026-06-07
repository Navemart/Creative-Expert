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
  const [expandedWeeks,   setExpandedWeeks]   = useState(new Set());
  const [editMode,        setEditMode]        = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [dragging,        setDragging]        = useState(null); // { type:'week'|'task', id, phaseId, weekId? }
  const [dragOverId,      setDragOverId]      = useState(null);

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
      // auto-expand all weeks by default
      setExpandedWeeks(new Set((wData || []).map(w => w.id)));
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // auto-expand all weeks of this phase when opening
        const phase = phases.find(p => p.id === id);
        if (phase) {
          setExpandedWeeks(wPrev => {
            const wNext = new Set(wPrev);
            phase.weeks.forEach(w => wNext.add(w.id));
            return wNext;
          });
        }
      }
      return next;
    });
  }

  // ── Drag & Drop (admin edit mode only) ───────────────────────
  function dndStart(e, item) {
    e.stopPropagation();
    setDragging(item);
    e.dataTransfer.effectAllowed = 'move';
  }
  function dndOver(e, id) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }
  function dndEnd() { setDragging(null); setDragOverId(null); }

  async function dropWeekOnPhase(e, targetPhaseId) {
    e.preventDefault(); e.stopPropagation();
    if (!dragging || dragging.type !== 'week') return dndEnd();
    const { id: weekId, phaseId: srcPhaseId } = dragging;
    if (srcPhaseId === targetPhaseId) return dndEnd();
    const srcPhase  = phases.find(p => p.id === srcPhaseId);
    const week      = srcPhase?.weeks.find(w => w.id === weekId);
    if (!week) return dndEnd();
    const tgtWeekCount = phases.find(p => p.id === targetPhaseId)?.weeks.length || 0;
    setPhases(prev => prev.map(p => {
      if (p.id === srcPhaseId)  return { ...p, weeks: p.weeks.filter(w => w.id !== weekId) };
      if (p.id === targetPhaseId) return { ...p, weeks: [...p.weeks, week] };
      return p;
    }));
    await supabase.from('roadmap_weeks').update({ phase_id: targetPhaseId, sort_order: tgtWeekCount }).eq('id', weekId);
    dndEnd();
  }

  async function dropWeekOnWeek(e, targetWeekId, targetPhaseId) {
    e.preventDefault(); e.stopPropagation();
    if (!dragging || dragging.type !== 'week' || dragging.id === targetWeekId) return dndEnd();
    const { id: weekId, phaseId: srcPhaseId } = dragging;
    const srcPhase = phases.find(p => p.id === srcPhaseId);
    const week     = srcPhase?.weeks.find(w => w.id === weekId);
    if (!week) return dndEnd();
    setPhases(prev => {
      let ps = prev.map(p => p.id === srcPhaseId ? { ...p, weeks: p.weeks.filter(w => w.id !== weekId) } : p);
      return ps.map(p => {
        if (p.id !== targetPhaseId) return p;
        const idx = p.weeks.findIndex(w => w.id === targetWeekId);
        const nw  = [...p.weeks]; nw.splice(idx, 0, week);
        return { ...p, weeks: nw };
      });
    });
    const tgtPhase = phases.find(p => p.id === targetPhaseId);
    const tgtIdx   = tgtPhase?.weeks.findIndex(w => w.id === targetWeekId) ?? 0;
    await supabase.from('roadmap_weeks').update({ phase_id: targetPhaseId, sort_order: tgtIdx }).eq('id', weekId);
    dndEnd();
  }

  async function dropTaskOnWeek(e, targetWeekId) {
    e.preventDefault(); e.stopPropagation();
    if (!dragging || dragging.type !== 'task') return dndEnd();
    const { id: taskId, weekId: srcWeekId } = dragging;
    if (srcWeekId === targetWeekId) return dndEnd();
    const allWeeks  = phases.flatMap(p => p.weeks);
    const srcWeek   = allWeeks.find(w => w.id === srcWeekId);
    const task      = srcWeek?.tasks.find(t => t.id === taskId);
    if (!task) return dndEnd();
    const newOrder = allWeeks.find(w => w.id === targetWeekId)?.tasks.length || 0;
    setPhases(prev => prev.map(p => ({
      ...p, weeks: p.weeks.map(w => {
        if (w.id === srcWeekId)    return { ...w, tasks: w.tasks.filter(t => t.id !== taskId) };
        if (w.id === targetWeekId) return { ...w, tasks: [...w.tasks, task] };
        return w;
      }),
    })));
    await supabase.from('roadmap_tasks').update({ week_id: targetWeekId, sort_order: newOrder }).eq('id', taskId);
    dndEnd();
  }

  async function dropTaskOnTask(e, targetTaskId, targetWeekId) {
    e.preventDefault(); e.stopPropagation();
    if (!dragging || dragging.type !== 'task' || dragging.id === targetTaskId) return dndEnd();
    const { id: taskId, weekId: srcWeekId } = dragging;
    const allWeeks = phases.flatMap(p => p.weeks);
    const srcWeek  = allWeeks.find(w => w.id === srcWeekId);
    const task     = srcWeek?.tasks.find(t => t.id === taskId);
    if (!task) return dndEnd();
    setPhases(prev => {
      let ps = prev.map(p => ({ ...p, weeks: p.weeks.map(w =>
        w.id === srcWeekId ? { ...w, tasks: w.tasks.filter(t => t.id !== taskId) } : w
      )}));
      return ps.map(p => ({ ...p, weeks: p.weeks.map(w => {
        if (w.id !== targetWeekId) return w;
        const idx = w.tasks.findIndex(t => t.id === targetTaskId);
        const nt  = [...w.tasks]; nt.splice(idx, 0, task);
        return { ...w, tasks: nt };
      })}));
    });
    const tgtWeek = phases.flatMap(p => p.weeks).find(w => w.id === targetWeekId);
    const tgtIdx  = tgtWeek?.tasks.findIndex(t => t.id === targetTaskId) ?? 0;
    await supabase.from('roadmap_tasks').update({ week_id: targetWeekId, sort_order: tgtIdx }).eq('id', taskId);
    dndEnd();
  }

  function toggleWeek(id) {
    setExpandedWeeks(prev => {
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
    if (error) { console.error('updatePhaseTitle error:', error); return; }
    setPhases(prev => prev.map(p => p.id === id ? { ...p, title } : p));
  }

  async function updatePhaseMonth(id, raw) {
    const month_number = parseInt(raw) || 1;
    setPhases(prev => prev.map(p => p.id === id ? { ...p, month_number } : p));
    await supabase.from('roadmap_phases').update({ month_number }).eq('id', id);
  }

  async function updateWeekTitle(id, title) {
    setPhases(prev => prev.map(p => ({
      ...p, weeks: p.weeks.map(w => w.id === id ? { ...w, title } : w),
    })));
    await supabase.from('roadmap_weeks').update({ title }).eq('id', id);
  }

  async function updateWeekNumber(id, raw) {
    const week_number = parseInt(raw) || 1;
    setPhases(prev => prev.map(p => ({
      ...p, weeks: p.weeks.map(w => w.id === id ? { ...w, week_number } : w),
    })));
    await supabase.from('roadmap_weeks').update({ week_number }).eq('id', id);
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
          const circleR        = 17;
          const circumference  = 2 * Math.PI * circleR;

          return (
            <div
              key={phase.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgb(var(--bg-surface))',
                border: `1px solid ${dragOverId === `phase-${phase.id}` && dragging?.type === 'week' ? 'rgba(245,193,24,0.5)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'border-color 0.15s',
              }}
              onDragOver={editMode ? e => dndOver(e, `phase-${phase.id}`) : undefined}
              onDragLeave={editMode ? () => setDragOverId(null) : undefined}
              onDrop={editMode ? e => dropWeekOnPhase(e, phase.id) : undefined}
            >
              {/* Phase header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition select-none"
                onClick={() => togglePhase(phase.id)}
              >
                {/* Month badge — compact horizontal, number editable in edit mode */}
                <div className="flex-none flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', minWidth: 72 }}
                  onClick={e => editMode && e.stopPropagation()}>
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>חודש</span>
                  <InlineEdit
                    value={String(phase.month_number)}
                    onSave={v => updatePhaseMonth(phase.id, v)}
                    active={editMode}
                    className="text-base font-bold"
                    style={{ color: 'white', lineHeight: 1 }}
                  />
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0" onClick={e => editMode && e.stopPropagation()}>
                  <InlineEdit
                    value={phase.title}
                    onSave={t => updatePhaseTitle(phase.id, t)}
                    active={editMode}
                    className="text-sm font-bold"
                    style={{ color: 'rgba(255,255,255,0.92)' }}
                  />
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {phaseCompleted} מתוך {phaseTotal} משימות · {phasePct}%
                  </div>
                </div>

                {/* Circular progress + controls */}
                <div className="flex items-center gap-2 flex-none">
                  <svg width="44" height="44">
                    <circle cx="22" cy="22" r={circleR} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                    <circle
                      cx="22" cy="22" r={circleR} fill="none"
                      stroke={phasePct === 100 ? '#22c55e' : '#F5C118'}
                      strokeWidth="3"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - phasePct / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 22 22)"
                      style={{ transition: 'stroke-dashoffset 0.5s' }}
                    />
                    <text x="22" y="26" textAnchor="middle" fontSize="10"
                      fill={phasePct === 100 ? '#22c55e' : '#F5C118'} fontWeight="bold">
                      {phasePct}%
                    </text>
                  </svg>

                  {editMode && (
                    <button
                      onClick={e => { e.stopPropagation(); deletePhase(phase.id); }}
                      className="rounded-md p-1 transition hover:bg-red-500/20"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  <ChevronDown size={16} className="transition-transform duration-200"
                    style={{ color: 'rgba(255,255,255,0.35)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </div>
              </div>

              {/* Phase content */}
              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {phase.weeks.map(week => {
                    const weekDone  = week.tasks.filter(t => completions.has(t.id)).length;
                    const weekTotal = week.tasks.length;
                    const weekPct   = weekTotal > 0 ? Math.round(weekDone / weekTotal * 100) : 0;
                    const isWeekOpen = expandedWeeks.has(week.id);
                    const nextTaskId = week.tasks.find(t => !completions.has(t.id))?.id;

                    return (
                    <div key={week.id}
                      draggable={editMode}
                      onDragStart={editMode ? e => dndStart(e, { type: 'week', id: week.id, phaseId: phase.id }) : undefined}
                      onDragEnd={editMode ? dndEnd : undefined}
                      onDragOver={editMode ? e => dndOver(e, `week-${week.id}`) : undefined}
                      onDragLeave={editMode ? () => setDragOverId(null) : undefined}
                      onDrop={editMode ? e => dropWeekOnWeek(e, week.id, phase.id) : undefined}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        opacity: dragging?.type === 'week' && dragging?.id === week.id ? 0.4 : 1,
                        outline: dragOverId === `week-${week.id}` && dragging?.type === 'week' && dragging?.id !== week.id
                          ? '2px solid rgba(245,193,24,0.5)' : 'none',
                        transition: 'opacity 0.15s',
                      }}>

                      {/* Week header — clickable */}
                      <div
                        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-white/[0.03] transition select-none"
                        style={{ background: 'rgba(255,255,255,0.025)' }}
                        onClick={() => !editMode && toggleWeek(week.id)}
                        onDrop={editMode ? e => dropTaskOnWeek(e, week.id) : undefined}
                        onDragOver={editMode && dragging?.type === 'task' ? e => dndOver(e, `weekhdr-${week.id}`) : undefined}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {editMode && (
                            <GripVertical size={13} className="flex-none cursor-grab"
                              style={{ color: 'rgba(255,255,255,0.2)' }} />
                          )}
                          {!editMode && (
                            <ChevronDown size={13} className="flex-none transition-transform duration-200"
                              style={{ color: 'rgba(255,255,255,0.3)', transform: isWeekOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                          )}
                          <div className="flex items-center gap-1 flex-none" onClick={e => editMode && e.stopPropagation()}>
                            <span className="text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: 'rgba(255,255,255,0.25)' }}>שבוע</span>
                            <InlineEdit
                              value={String(week.week_number)}
                              onSave={v => updateWeekNumber(week.id, v)}
                              active={editMode}
                              className="text-[10px] font-bold"
                              style={{ color: 'rgba(255,255,255,0.5)' }}
                            />
                          </div>
                          <div onClick={e => editMode && e.stopPropagation()}>
                            <InlineEdit
                              value={week.title}
                              onSave={t => updateWeekTitle(week.id, t)}
                              active={editMode}
                              className="text-xs font-semibold"
                              style={{ color: 'rgba(255,255,255,0.75)' }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-none">
                          {/* Progress pill */}
                          <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md"
                            style={{
                              background: weekPct === 100 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                              color: weekPct === 100 ? '#86efac' : 'rgba(255,255,255,0.3)',
                            }}>
                            {weekDone}/{weekTotal}
                          </span>
                          {editMode && (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); setTaskModal({ mode: 'add', weekId: week.id }); setTaskForm({ title: '', level_label: '', category_label: '', link: '' }); }}
                                className="rounded-md p-1 hover:bg-white/10 transition"
                                style={{ color: 'rgba(255,255,255,0.4)' }} title="הוסף משימה">
                                <Plus size={13} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); deleteWeek(phase.id, week.id); }}
                                className="rounded-md p-1 hover:bg-red-500/20 transition"
                                style={{ color: 'rgba(255,255,255,0.3)' }} title="מחק שבוע">
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Week progress bar */}
                      {weekTotal > 0 && (
                        <div className="h-[2px]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full transition-all duration-500"
                            style={{ width: `${weekPct}%`, background: weekPct === 100 ? '#22c55e' : '#F5C118' }} />
                        </div>
                      )}

                      {/* Tasks — shown only when week is expanded */}
                      {isWeekOpen && week.tasks.map(task => {
                        const done   = completions.has(task.id);
                        const isNext = task.id === nextTaskId;
                        const isDraggingThis = dragging?.type === 'task' && dragging?.id === task.id;
                        const isDropTarget   = dragOverId === `task-${task.id}` && dragging?.type === 'task' && !isDraggingThis;
                        return (
                          <div
                            key={task.id}
                            draggable={editMode}
                            onDragStart={editMode ? e => { e.stopPropagation(); dndStart(e, { type: 'task', id: task.id, weekId: week.id, phaseId: phase.id }); } : undefined}
                            onDragEnd={editMode ? dndEnd : undefined}
                            onDragOver={editMode ? e => dndOver(e, `task-${task.id}`) : undefined}
                            onDragLeave={editMode ? () => setDragOverId(null) : undefined}
                            onDrop={editMode ? e => dropTaskOnTask(e, task.id, week.id) : undefined}
                            className="flex items-center px-4 py-2 hover:bg-white/[0.03] transition group"
                            style={{
                              borderTop: isDropTarget ? '2px solid rgba(245,193,24,0.5)' : '1px solid rgba(255,255,255,0.04)',
                              background: isNext ? 'rgba(245,193,24,0.03)' : 'transparent',
                              opacity: isDraggingThis ? 0.35 : 1,
                              gap: 0,
                              cursor: editMode ? 'grab' : 'default',
                            }}
                          >
                            {/* Grip handle — only in edit mode */}
                            {editMode && (
                              <div style={{ width: 18, flexShrink: 0 }}>
                                <GripVertical size={12} style={{ color: 'rgba(255,255,255,0.18)' }} />
                              </div>
                            )}
                            {/* Checkbox */}
                            <div style={{ width: 30, flexShrink: 0 }}>
                              <button
                                onClick={() => toggleCompletion(task.id)}
                                className="h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center transition"
                                style={{
                                  borderColor: done ? '#22c55e' : isNext ? 'rgba(245,193,24,0.5)' : 'rgba(255,255,255,0.18)',
                                  background:  done ? '#22c55e' : 'transparent',
                                }}
                              >
                                {done && <Check size={9} strokeWidth={3} color="#fff" />}
                              </button>
                            </div>

                            {/* Title */}
                            <span
                              className="flex-1 text-xs"
                              style={{
                                color:          done ? 'rgba(255,255,255,0.22)' : isNext ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.78)',
                                textDecoration: done ? 'line-through' : 'none',
                                fontWeight:     isNext && !done ? 600 : done ? 400 : 400,
                                paddingLeft: 6,
                                paddingRight: 6,
                              }}
                            >
                              {task.title}
                            </span>

                            {/* Level — hidden on mobile */}
                            <div className="hidden sm:block" style={{ width: 96, flexShrink: 0 }}>
                              {task.level_label && (
                                <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.38)' }}>
                                  {task.level_label}
                                </span>
                              )}
                            </div>

                            {/* Category — hidden on mobile */}
                            <div className="hidden sm:block" style={{ width: 120, flexShrink: 0 }}>
                              {task.category_label && (
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold"
                                  style={{ background: categoryStyle(task.category_label).bg, color: categoryStyle(task.category_label).color }}>
                                  {task.category_label}
                                </span>
                              )}
                            </div>

                            {/* Link + actions */}
                            <div className="flex items-center gap-1 flex-none" style={{ width: 56, justifyContent: 'flex-end' }}>
                              {task.link && (
                                <a href={task.link} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="hover:text-white/60 transition rounded-md p-0.5"
                                  style={{ color: 'rgba(255,255,255,0.22)' }} title="פתח קישור">
                                  <ExternalLink size={12} />
                                </a>
                              )}
                              {editMode && (
                                <>
                                  <button
                                    onClick={() => { setTaskModal({ mode: 'edit', weekId: week.id, task }); setTaskForm({ title: task.title, level_label: task.level_label || '', category_label: task.category_label || '', link: task.link || '' }); }}
                                    className="opacity-0 group-hover:opacity-100 rounded-md p-0.5 hover:bg-white/10 transition"
                                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => deleteTask(week.id, task.id)}
                                    className="opacity-0 group-hover:opacity-100 rounded-md p-0.5 hover:bg-red-500/20 transition"
                                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Empty week */}
                      {isWeekOpen && week.tasks.length === 0 && (
                        <div className="px-4 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          {editMode ? 'אין משימות — לחץ + להוסיף' : 'אין משימות בשבוע זה'}
                        </div>
                      )}
                    </div>
                    );
                  })}

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
