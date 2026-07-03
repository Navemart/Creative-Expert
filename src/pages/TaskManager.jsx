import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { useDialog } from '../components/Dialog.jsx';

// ── Constants ────────────────────────────────────────────────
const PRIORITIES = {
  urgent_important: { label: 'דחוף + חשוב',     color: '#ef4444', emoji: '🔴', short: 'I'  },
  important:        { label: 'חשוב, לא דחוף',   color: '#F5C118', emoji: '🟡', short: 'II' },
  urgent:           { label: 'דחוף, לא חשוב',   color: '#3b82f6', emoji: '🔵', short: 'III'},
  low:              { label: 'לא דחוף ולא חשוב',color: 'rgba(255,255,255,0.35)', emoji: '⚪', short: 'IV'},
  routine:          { label: 'שגרה יומית',       color: '#34d399', emoji: '🔁', short: 'שגרה'},
};
const PRIORITY_ORDER = ['urgent_important', 'important', 'urgent', 'routine', 'low'];
const CATEGORIES     = ['עסק', 'שיווק', 'לקוחות'];
const POMODORO_MODES = [
  { id: '25-5',  focus: 25, brk: 5,  label: '25/5'  },
  { id: '30-5',  focus: 30, brk: 5,  label: '30/5'  },
  { id: '50-10', focus: 50, brk: 10, label: '50/10' },
];
const START_HOUR = 5;
const END_HOUR   = 23;
const SLOT_H     = 54;
const HOURS      = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const EMPTY_MODAL = { title: '', category: 'עסק', priority: 'important', estimated_minutes: 30, due_date: '', notes: '' };

// ── Helpers ───────────────────────────────────────────────────
function toDateStr(d)  { return d.toISOString().split('T')[0]; }
function fmtHebDate(d) { return d.toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' }); }
function fmtMin(m)     { return m >= 60 ? `${Math.floor(m/60)}ש'${m%60>0?` ${m%60}ד'`:''}` : `${m} דק'`; }
function fmtSecs(s) {
  return s >= 3600
    ? `${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
    : `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function playBeep(freq = 700, dur = 0.6) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
  } catch {}
}

// ── Styles ────────────────────────────────────────────────────
const S = {
  label:  { display:'block', fontSize: 11, color:'rgba(255,255,255,0.4)', marginBottom:5, fontWeight:700, textTransform:'uppercase', letterSpacing:1 },
  input:  { width:'100%', background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'8px 12px', color:'inherit', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:14, fontFamily:'inherit' },
  navBtn: { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, width:28, height:28, cursor:'pointer', color:'inherit', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0 },
  chip:   (active, color) => ({ padding:'3px 10px', borderRadius:20, border:`1px solid ${color ? color+'50' : 'rgba(255,255,255,0.15)'}`, background: active ? (color ? color+'20' : 'rgba(255,255,255,0.12)') : 'transparent', color: active && color ? color : active ? 'white' : 'rgba(255,255,255,0.45)', cursor:'pointer', fontSize:12, fontWeight: active ? 700 : 400 }),
};

// ══════════════════════════════════════════════════════════════
export default function TaskManager() {
  const { user }    = useUser();
  const userId      = user?.id;
  const { confirm } = useDialog();

  // Core state
  const [tasks,   setTasks]   = useState([]);
  const [selDate, setSelDate] = useState(new Date());
  const [now,     setNow]     = useState(Date.now());

  // Right sidebar UI
  const [bankTab,       setBankTab]       = useState('bank');   // 'bank' | 'done'
  const [catFilter,     setCatFilter]     = useState('all');
  const [routineSidebarOpen, setRoutineSidebarOpen] = useState(false);
  const [brainOpen,     setBrainOpen]     = useState(false);

  // Modal
  const [showModal,   setShowModal]   = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [modalData,   setModalData]   = useState(EMPTY_MODAL);
  const [preSlot,     setPreSlot]     = useState(null);

  // Drag
  const [dragOverSlot,     setDragOverSlot]     = useState(null);
  const [dragOverPriority, setDragOverPriority] = useState(null);
  const [isDragging,       setIsDragging]       = useState(false);
  const dragTaskId      = useRef(null);
  const dragRoutineTask = useRef(null);

  // Quick-add inline
  const [quickAdd, setQuickAdd] = useState(null);

  // Top Priorities (localStorage per date)
  const [topPriorities, setTopPriorities] = useState([null, null, null]);
  const [brainDump,     setBrainDump]     = useState('');

  // Routine
  const [routineTasks,       setRoutineTasks]       = useState([]);
  const [routineCompletions, setRoutineCompletions] = useState(new Set());
  const [routineEditMode,    setRoutineEditMode]    = useState(false);
  const [routineNewTitle,    setRoutineNewTitle]    = useState('');
  const [routineAdding,      setRoutineAdding]      = useState(false);
  const [pendingRoutineDrop, setPendingRoutineDrop] = useState(null);
  const [routineDropMins,    setRoutineDropMins]    = useState(30);

  // Pomodoro
  const [pomMode,   setPomMode]   = useState(null);
  const [pomPhase,  setPomPhase]  = useState('focus');
  const [pomStart,  setPomStart]  = useState(null);
  const [pomPaused, setPomPaused] = useState(false);
  const [pomAlert,  setPomAlert]  = useState(null);
  const pomSavedSecs = useRef(0);

  const calRef = useRef(null);

  const todayStr = toDateStr(new Date());
  const selStr   = toDateStr(selDate);

  // ── Tick ──────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Pomodoro phase check ───────────────────────────────────
  useEffect(() => {
    if (!pomMode || !pomStart || pomPaused) return;
    const mode = POMODORO_MODES.find(m => m.id === pomMode);
    if (!mode) return;
    const elapsed = (now - pomStart) / 60000;
    const limit   = pomPhase === 'focus' ? mode.focus : mode.brk;
    if (elapsed < limit) return;
    if (pomPhase === 'focus') {
      playBeep(700, 0.8); setTimeout(() => playBeep(900, 0.5), 500);
      setPomAlert({ msg:`🍅 ${mode.focus} דק' הסתיימו! הפסקה של ${mode.brk} דק'`, type:'break' });
      setPomPhase('break');
    } else {
      playBeep(500, 0.5); setTimeout(() => playBeep(700, 0.8), 400);
      setPomAlert({ msg:'💪 ההפסקה הסתיימה! חזרה לעבודה', type:'focus' });
      setPomPhase('focus');
    }
    setPomStart(Date.now());
  }, [now]);

  // ── Scroll to current time ─────────────────────────────────
  useEffect(() => {
    if (!calRef.current) return;
    const d   = new Date();
    const idx = (d.getHours() - START_HOUR) * 2 + (d.getMinutes() >= 30 ? 1 : 0);
    calRef.current.scrollTop = Math.max(0, (idx - 2) * SLOT_H);
  }, [selDate]);

  // ── Load per-date data from localStorage ──────────────────
  useEffect(() => {
    const pd = localStorage.getItem(`topPri_${selStr}`);
    setTopPriorities(pd ? JSON.parse(pd) : [null, null, null]);
    setBrainDump(localStorage.getItem(`brain_${selStr}`) || '');
  }, [selStr]);

  // ── DB loads ──────────────────────────────────────────────
  useEffect(() => { if (userId) { loadTasks(); loadRoutine(); } }, [userId]);

  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) { setTasks(data); runDailyReset(data); }
  }

  async function loadRoutine() {
    const today = todayStr;
    const [{ data: rt }, { data: rc }] = await Promise.all([
      supabase.from('routine_tasks').select('*').eq('user_id', userId).order('sort_order'),
      supabase.from('routine_completions').select('task_id').eq('user_id', userId).eq('completed_date', today),
    ]);
    setRoutineTasks(rt || []);
    setRoutineCompletions(new Set((rc || []).map(c => c.task_id)));
  }

  async function runDailyReset(data) {
    const stale = data.filter(t => t.status === 'scheduled' && t.scheduled_date && t.scheduled_date < todayStr);
    if (!stale.length) return;
    await Promise.all(stale.map(t =>
      supabase.from('tasks').update({ status:'returned', returned_from:t.scheduled_date, scheduled_date:null, scheduled_slot:null }).eq('id', t.id)
    ));
    const ids = stale.map(t => t.id);
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status:'returned', returned_from:t.scheduled_date, scheduled_date:null, scheduled_slot:null } : t));
  }

  // ── Timer helpers ─────────────────────────────────────────
  function liveElapsed(task) {
    const saved = task.actual_minutes || 0;
    if (!task.timer_started_at) return saved;
    return saved + Math.floor((now - new Date(task.timer_started_at).getTime()) / 1000);
  }

  async function startTimer(task) {
    const running = tasks.find(t => t.id !== task.id && t.timer_started_at);
    if (running) await pauseTimer(running);
    const up = { timer_started_at: new Date().toISOString() };
    await supabase.from('tasks').update(up).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...up } : t));
    if (pomMode) {
      if (pomPaused) { setPomStart(Date.now() - pomSavedSecs.current * 1000); setPomPaused(false); }
      else if (!pomStart) { setPomPhase('focus'); setPomStart(Date.now()); pomSavedSecs.current = 0; setPomAlert(null); }
    }
  }

  async function pauseTimer(task) {
    const elapsed = liveElapsed(task);
    const up = { timer_started_at: null, actual_minutes: Math.floor(elapsed) };
    await supabase.from('tasks').update(up).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...up } : t));
    if (pomMode && pomStart && !pomPaused) { pomSavedSecs.current = Math.floor((Date.now() - pomStart) / 1000); setPomPaused(true); }
  }

  async function resetTimer(task) {
    const ok = await confirm('האם לאפס את הטיימר?', { title:'איפוס טיימר', confirmText:'אפס' });
    if (!ok) return;
    const up = { timer_started_at: null, actual_minutes: 0 };
    await supabase.from('tasks').update(up).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...up } : t));
  }

  async function addTime(task, mins) {
    const newEst = (task.estimated_minutes || 0) + mins;
    await supabase.from('tasks').update({ estimated_minutes: newEst }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, estimated_minutes: newEst } : t));
  }

  // ── Task CRUD ─────────────────────────────────────────────
  async function markDone(task) {
    const elapsed = liveElapsed(task);
    const up = { status:'done', completed_at: new Date().toISOString(), timer_started_at: null, actual_minutes: Math.floor(elapsed) };
    await supabase.from('tasks').update(up).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...up } : t));
    if (task.priority === 'routine') {
      const m = routineTasks.find(rt => rt.title === task.title);
      if (m && !routineCompletions.has(m.id)) await toggleRoutine(m.id);
    }
  }

  async function undoDone(task) {
    const up = { status:'scheduled', completed_at: null };
    await supabase.from('tasks').update(up).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...up } : t));
  }

  async function restoreTask(id) {
    const up = { status:'bank', completed_at:null, scheduled_date:null, scheduled_slot:null };
    await supabase.from('tasks').update(up).eq('id', id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...up } : t));
    setBankTab('bank');
  }

  async function deleteTask(id) {
    const ok = await confirm('למחוק את המשימה?', { title:'מחיקה', confirmText:'מחק', danger:true });
    if (!ok) return;
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function openCreate(slot = null) {
    setEditingTask(null);
    setPreSlot(slot);
    setModalData({ ...EMPTY_MODAL });
    setShowModal(true);
  }
  function openEdit(task) {
    setEditingTask(task);
    setPreSlot(null);
    setModalData({ title:task.title, category:task.category, priority:task.priority, estimated_minutes:task.estimated_minutes||30, due_date:task.due_date||'', notes:task.notes||'' });
    setShowModal(true);
  }

  async function saveModal() {
    if (!modalData.title.trim()) return;
    if (editingTask) {
      const up = { title:modalData.title.trim(), category:modalData.category, priority:modalData.priority, estimated_minutes:modalData.estimated_minutes||null, due_date:modalData.due_date||null, notes:modalData.notes||null };
      await supabase.from('tasks').update(up).eq('id', editingTask.id);
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...up } : t));
    } else {
      const payload = {
        user_id: userId, title: modalData.title.trim(), category: modalData.category,
        priority: modalData.priority, estimated_minutes: modalData.estimated_minutes||null,
        due_date: modalData.due_date||null, notes: modalData.notes||null,
        status: preSlot ? 'scheduled' : 'bank',
        scheduled_date: preSlot ? selStr : null,
        scheduled_slot: preSlot || null,
        actual_minutes: 0, created_at: new Date().toISOString(),
      };
      const { data } = await supabase.from('tasks').insert(payload).select().single();
      if (data) setTasks(prev => [data, ...prev]);
    }
    setShowModal(false); setEditingTask(null); setPreSlot(null); setModalData(EMPTY_MODAL);
  }

  // ── Quick-add inline ──────────────────────────────────────
  async function submitQuickAdd() {
    if (!quickAdd?.text?.trim()) { setQuickAdd(null); return; }
    const payload = {
      user_id: userId, title: quickAdd.text.trim(), category: 'עסק',
      priority: quickAdd.priority || 'important', status: 'scheduled',
      scheduled_date: selStr, scheduled_slot: quickAdd.slot,
      estimated_minutes: 30, actual_minutes: 0, created_at: new Date().toISOString(),
    };
    const { data } = await supabase.from('tasks').insert(payload).select().single();
    if (data) setTasks(prev => [data, ...prev]);
    setQuickAdd(null);
  }

  // ── Drag & drop ───────────────────────────────────────────
  function onDragStart(taskId) { dragTaskId.current = taskId; setIsDragging(true); }
  function onDragEnd()         { setIsDragging(false); dragTaskId.current = null; setDragOverSlot(null); setDragOverPriority(null); }

  async function dropOnSlot(slot) {
    setDragOverSlot(null); setIsDragging(false);
    if (dragRoutineTask.current) {
      const rt = dragRoutineTask.current;
      dragRoutineTask.current = null;
      setRoutineDropMins(30); setPendingRoutineDrop({ task: rt, slot });
      return;
    }
    const taskId = dragTaskId.current;
    if (!taskId) return;
    dragTaskId.current = null;
    const up = { scheduled_date: selStr, scheduled_slot: slot, status: 'scheduled' };
    await supabase.from('tasks').update(up).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...up } : t));
  }

  async function dropOnBank() {
    const taskId = dragTaskId.current;
    if (!taskId) return;
    dragTaskId.current = null; setIsDragging(false);
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'bank') return;
    const up = { status:'bank', scheduled_date:null, scheduled_slot:null };
    await supabase.from('tasks').update(up).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...up } : t));
  }

  // ── Top Priorities ────────────────────────────────────────
  function dropOnPriority(i) {
    const taskId = dragTaskId.current;
    if (!taskId) return;
    const next = [...topPriorities];
    const existing = next.indexOf(taskId);
    if (existing >= 0) next[existing] = null;
    next[i] = taskId;
    setTopPriorities(next);
    localStorage.setItem(`topPri_${selStr}`, JSON.stringify(next));
    setDragOverPriority(null);
  }
  function removeFromPriority(i) {
    const next = [...topPriorities];
    next[i] = null;
    setTopPriorities(next);
    localStorage.setItem(`topPri_${selStr}`, JSON.stringify(next));
  }
  function saveBrain(val) {
    setBrainDump(val);
    localStorage.setItem(`brain_${selStr}`, val);
  }

  // ── Routine ───────────────────────────────────────────────
  async function toggleRoutine(taskId) {
    const today = todayStr;
    if (routineCompletions.has(taskId)) {
      await supabase.from('routine_completions').delete().eq('task_id', taskId).eq('completed_date', today).eq('user_id', userId);
      setRoutineCompletions(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    } else {
      await supabase.from('routine_completions').insert({ user_id: userId, task_id: taskId, completed_date: today });
      setRoutineCompletions(prev => new Set([...prev, taskId]));
    }
  }
  async function addRoutineTask() {
    if (!routineNewTitle.trim()) return;
    const { data } = await supabase.from('routine_tasks').insert({ user_id: userId, title: routineNewTitle.trim(), sort_order: routineTasks.length }).select().single();
    if (data) setRoutineTasks(prev => [...prev, data]);
    setRoutineNewTitle(''); setRoutineAdding(false);
  }
  async function deleteRoutineTask(id) {
    const ok = await confirm('למחוק משימה קבועה?', { title:'מחיקה', confirmText:'מחק', danger:true });
    if (!ok) return;
    await supabase.from('routine_tasks').delete().eq('id', id);
    setRoutineTasks(prev => prev.filter(t => t.id !== id));
  }

  // ── Computed ──────────────────────────────────────────────
  const bankTasks     = tasks.filter(t => (t.status==='bank'||t.status==='returned') && t.scheduled_date !== selStr)
                             .filter(t => catFilter==='all' || t.category===catFilter);
  const doneBankTasks = tasks.filter(t => t.status==='done');
  const calTasks      = tasks.filter(t => t.scheduled_date===selStr && (t.status==='scheduled'||t.status==='done'));
  const doneToday     = calTasks.filter(t => t.status==='done');
  const totalPlanned  = calTasks.reduce((s,t) => s + (t.estimated_minutes||0), 0);
  const totalActualM  = Math.round(calTasks.reduce((s,t) => s + liveElapsed(t), 0) / 60);

  const routineDone    = routineCompletions.size;
  const routineTotal   = routineTasks.length;
  const routineAllDone = routineTotal > 0 && routineDone === routineTotal;

  const groupedBank = PRIORITY_ORDER.reduce((acc, p) => {
    const items = bankTasks.filter(t => t.priority === p);
    if (items.length) acc.push({ priority: p, items });
    return acc;
  }, []);

  // Pomodoro computed
  const pomCurrent     = pomMode ? POMODORO_MODES.find(m => m.id === pomMode) : null;
  const pomElapsedSecs = pomPaused ? pomSavedSecs.current : (pomStart ? Math.floor((now - pomStart) / 1000) : 0);
  const pomTotalSecs   = pomCurrent ? (pomPhase === 'focus' ? pomCurrent.focus : pomCurrent.brk) * 60 : 0;
  const pomRemaining   = Math.max(0, pomTotalSecs - pomElapsedSecs);
  const pomPct         = pomTotalSecs > 0 ? Math.min(100, pomElapsedSecs / pomTotalSecs * 100) : 0;
  const fmtPom         = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const nowD    = new Date(now);
  const isToday = selStr === todayStr;

  // AI tip
  const overPct = totalPlanned > 0 && totalActualM > totalPlanned
    ? Math.round((totalActualM - totalPlanned) / totalPlanned * 100) : 0;
  const aiTip = overPct > 15
    ? `המלצות לשיפור: אתה חורג ב-${overPct}% מהתכנון, תוסיף זמן חיץ בין משימות`
    : routineAllDone && doneToday.length > 0
      ? `🎯 כל משימות היום הושלמו — כוח!`
      : null;

  function prevDay() { setSelDate(d => { const n=new Date(d); n.setDate(n.getDate()-1); return n; }); }
  function nextDay() { setSelDate(d => { const n=new Date(d); n.setDate(n.getDate()+1); return n; }); }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{ display:'flex', height:'100%', minHeight:0, overflow:'hidden', background:'rgb(var(--bg-base,13,15,26))' }}>

      {/* ══ MAIN AREA: time grid (order:1 = visual left in RTL) ══ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, minHeight:0, order:1 }}>

        {/* ── Header: date nav + pomodoro ─── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0, flexWrap:'wrap' }}>

          {/* Date navigation */}
          <button onClick={prevDay} style={S.navBtn}>›</button>
          <div style={{ fontWeight:700, fontSize:14, flex:1, textAlign:'center', minWidth:160 }}>
            {fmtHebDate(selDate)}
            {selStr !== todayStr && (
              <button onClick={() => setSelDate(new Date())} style={{ background:'none', border:'none', color:'rgba(245,193,24,0.7)', cursor:'pointer', fontSize:11, padding:'0 8px', marginRight:4 }}>← היום</button>
            )}
          </div>
          <button onClick={nextDay} style={{ ...S.navBtn, transform:'scaleX(-1)' }}>›</button>

          {/* Pomodoro — compact when inactive, active display when running */}
          <div style={{ display:'flex', alignItems:'center', gap:6, borderRight:'1px solid rgba(255,255,255,0.08)', paddingRight:12 }}>
            {pomMode && pomStart ? (
              /* Active pomodoro mini display */
              <div style={{ display:'flex', alignItems:'center', gap:8, background: pomPhase==='focus' ? 'rgba(251,146,60,0.1)' : 'rgba(74,222,128,0.08)', borderRadius:10, padding:'5px 10px', border:`1px solid ${pomPhase==='focus' ? 'rgba(251,146,60,0.3)' : 'rgba(74,222,128,0.25)'}` }}>
                <span style={{ fontSize:11, color: pomPhase==='focus' ? '#fb923c' : '#4ade80', fontWeight:700 }}>{pomPhase==='focus' ? '🍅' : '☕'}</span>
                <span style={{ fontSize:18, fontVariantNumeric:'tabular-nums', fontWeight:900, color: pomPhase==='focus' ? '#fb923c' : '#4ade80' }}>{fmtPom(pomRemaining)}</span>
                <div style={{ width:48, height:4, borderRadius:99, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pomPct}%`, background: pomPhase==='focus' ? '#fb923c' : '#4ade80', borderRadius:99 }} />
                </div>
                <button onClick={() => { setPomStart(null); setPomPaused(false); setPomAlert(null); pomSavedSecs.current = 0; }}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', fontSize:13, padding:0, lineHeight:1 }}>✕</button>
              </div>
            ) : (
              /* Inactive — mode chips + start */
              <>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>🍅</span>
                {POMODORO_MODES.map(m => (
                  <button key={m.id} onClick={() => { setPomMode(m.id); setPomStart(null); setPomPhase('focus'); setPomAlert(null); }}
                    style={S.chip(pomMode===m.id, '#fb923c')}>{m.label}</button>
                ))}
                {pomMode && (
                  <button onClick={() => { setPomPhase('focus'); setPomStart(Date.now()); setPomPaused(false); pomSavedSecs.current = 0; setPomAlert(null); }}
                    style={{ background:'rgba(251,146,60,0.18)', border:'1px solid rgba(251,146,60,0.4)', borderRadius:8, padding:'3px 10px', cursor:'pointer', color:'#fb923c', fontSize:12, fontWeight:700 }}>▶</button>
                )}
                {pomMode && (
                  <button onClick={() => { setPomMode(null); setPomStart(null); setPomAlert(null); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.25)', fontSize:13, padding:0 }}>✕</button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pomodoro alert banner */}
        {pomAlert && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 16px', flexShrink:0, background: pomAlert.type==='break' ? 'rgba(251,146,60,0.1)' : 'rgba(74,222,128,0.08)', borderBottom:`1px solid ${pomAlert.type==='break' ? 'rgba(251,146,60,0.3)' : 'rgba(74,222,128,0.2)'}` }}>
            <span style={{ fontSize:13, color: pomAlert.type==='break' ? '#fb923c' : '#4ade80', fontWeight:600 }}>{pomAlert.msg}</span>
            <button onClick={() => setPomAlert(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:16, padding:'0 4px' }}>×</button>
          </div>
        )}

        {/* ── Time Box Table ─── */}
        <div ref={calRef} style={{ flex:1, overflowY:'auto', minHeight:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:44 }} />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr style={{ position:'sticky', top:0, zIndex:3, background:'rgb(var(--bg-surface))' }}>
                <th style={{ padding:'7px 0', borderBottom:'2px solid rgba(255,255,255,0.1)', fontSize:11, color:'rgba(255,255,255,0.2)', fontWeight:600 }}></th>
                <th style={{ padding:'7px 0', borderBottom:'2px solid rgba(255,255,255,0.1)', borderLeft:'1px solid rgba(255,255,255,0.07)', fontSize:13, color:'rgba(255,255,255,0.5)', fontWeight:700, letterSpacing:2, textAlign:'center' }}>00</th>
                <th style={{ padding:'7px 0', borderBottom:'2px solid rgba(255,255,255,0.1)', borderLeft:'1px solid rgba(255,255,255,0.05)', fontSize:13, color:'rgba(255,255,255,0.3)', fontWeight:600, letterSpacing:2, textAlign:'center' }}>30</th>
              </tr>
            </thead>
            <tbody>
              {HOURS.map(h => {
                const isCurH = isToday && nowD.getHours() === h;
                return (
                  <tr key={h} style={{ background: isCurH ? 'rgba(245,193,24,0.015)' : 'transparent' }}>
                    <td style={{ verticalAlign:'middle', textAlign:'center', userSelect:'none', borderBottom:'1px solid rgba(255,255,255,0.04)', padding:'0 4px' }}>
                      <span style={{ fontSize:12, fontWeight:700, color: isCurH ? '#F5C118' : h%2===0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)' }}>{h}</span>
                    </td>

                    {[0, 30].map(min => {
                      const slot      = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
                      const slotTasks = calTasks.filter(t => t.scheduled_slot === slot);
                      const isOver    = dragOverSlot === slot;
                      const isQA      = quickAdd?.slot === slot;
                      const isNowSlot = isToday && nowD.getHours()===h && (min===0 ? nowD.getMinutes()<30 : nowD.getMinutes()>=30);
                      const nowPct    = isNowSlot ? ((min===0 ? nowD.getMinutes() : nowD.getMinutes()-30) / 30 * 100) : 0;

                      return (
                        <td key={min}
                          onDragOver={e => { e.preventDefault(); setDragOverSlot(slot); }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={() => dropOnSlot(slot)}
                          style={{
                            borderLeft: min===0 ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.04)',
                            borderBottom:'1px solid rgba(255,255,255,0.04)',
                            background: isOver ? 'rgba(245,193,24,0.07)' : 'transparent',
                            verticalAlign:'top', padding:'3px 4px',
                            minHeight: SLOT_H, position:'relative',
                            transition:'background 0.1s',
                          }}>

                          {/* Current time red line */}
                          {isNowSlot && (
                            <div style={{ position:'absolute', top:`${nowPct}%`, left:0, right:0, height:2, background:'rgba(239,68,68,0.7)', zIndex:2, pointerEvents:'none' }}>
                              <div style={{ position:'absolute', right:-3, top:-3, width:7, height:7, borderRadius:'50%', background:'#ef4444' }} />
                            </div>
                          )}

                          {slotTasks.map(task => (
                            <SlotCard key={task.id} task={task}
                              elapsed={liveElapsed(task)}
                              isDragging={isDragging} dragTaskIdRef={dragTaskId}
                              onDragStart={() => onDragStart(task.id)}
                              onDragEnd={onDragEnd}
                              onDone={() => task.status==='done' ? undoDone(task) : markDone(task)}
                              onTimer={() => task.timer_started_at ? pauseTimer(task) : startTimer(task)}
                              onReset={() => resetTimer(task)}
                              onAddTime={() => addTime(task, 15)}
                              onEdit={() => openEdit(task)}
                              onRemove={async () => {
                                if (task.priority === 'routine') {
                                  await supabase.from('tasks').delete().eq('id', task.id);
                                  setTasks(prev => prev.filter(t => t.id !== task.id));
                                } else {
                                  const up = { status:'bank', scheduled_date:null, scheduled_slot:null };
                                  await supabase.from('tasks').update(up).eq('id', task.id);
                                  setTasks(prev => prev.map(t => t.id===task.id ? {...t,...up} : t));
                                }
                              }}
                            />
                          ))}

                          {isQA && (
                            <div style={{ padding:'3px 2px' }}>
                              <input autoFocus
                                value={quickAdd.text}
                                onChange={e => setQuickAdd(q => ({...q, text: e.target.value}))}
                                onKeyDown={e => { if (e.key==='Enter') submitQuickAdd(); if (e.key==='Escape') setQuickAdd(null); }}
                                onBlur={() => { setTimeout(() => setQuickAdd(null), 150); }}
                                placeholder="שם משימה… Enter לשמור"
                                style={{ width:'100%', background:'rgba(245,193,24,0.1)', border:'1px solid rgba(245,193,24,0.4)', borderRadius:6, padding:'6px 8px', color:'white', fontSize:12, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}
                              />
                              <div style={{ display:'flex', gap:3, marginTop:3 }}>
                                {Object.entries(PRIORITIES).slice(0,4).map(([k,v]) => (
                                  <button key={k} onMouseDown={e => { e.preventDefault(); setQuickAdd(q => ({...q, priority:k})); }}
                                    style={{ padding:'1px 6px', borderRadius:4, border:`1px solid ${quickAdd.priority===k ? v.color+'80' : 'rgba(255,255,255,0.1)'}`, background: quickAdd.priority===k ? `${v.color}20` : 'transparent', color: quickAdd.priority===k ? v.color : 'rgba(255,255,255,0.3)', cursor:'pointer', fontSize: 11 }}>
                                    {v.emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {slotTasks.length===0 && !isQA && !isOver && (
                            <SlotEmptyCell onClick={() => setQuickAdd({ slot, text:'', priority:'important' })} height={SLOT_H} />
                          )}

                          {isOver && slotTasks.length===0 && !isQA && (
                            <div style={{ minHeight:SLOT_H-8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'rgba(245,193,24,0.6)' }}>{slot} ←</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Bottom stats bar ─── */}
        <div style={{ padding:'8px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', flexShrink:0, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>
            <b style={{ color:'rgba(255,255,255,0.75)' }}>{calTasks.length}</b> משימות
            {' · '}
            <b style={{ color:'#4ade80' }}>{doneToday.length}</b> בוצעו
            {totalActualM > 0 && <> · שהושקעו בפועל: <b style={{ color:'rgba(255,255,255,0.75)', fontVariantNumeric:'tabular-nums' }}>{fmtSecs(calTasks.reduce((s,t)=>s+liveElapsed(t),0))}</b></>}
            {totalPlanned > 0 && <> · תוכנן: <b style={{ color:'rgba(255,255,255,0.6)' }}>{fmtMin(totalPlanned)}</b></>}
            {routineAllDone && <> · <span style={{ color:'#4ade80' }}>🎯 שגרה הושלמה</span></>}
          </span>
          {aiTip && (
            <span style={{ fontSize:11, color:'rgba(245,193,24,0.7)', marginRight:'auto' }}>{aiTip}</span>
          )}
        </div>
      </div>

      {/* ══ RIGHT SIDEBAR (order:0 = visual right in RTL) ════════ */}
      <div style={{ width:320, flexShrink:0, display:'flex', flexDirection:'column', borderLeft:'1px solid rgba(255,255,255,0.07)', overflow:'hidden', order:0 }}>

        {/* ── Top 3 priorities ─── */}
        <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.7)' }}>טופ 3 הכי חשובות</span>
            <span style={{ fontSize: 11, color:'rgba(255,255,255,0.25)' }}>גרור מהרשימה</span>
          </div>
          {[0,1,2].map(i => {
            const taskId = topPriorities[i];
            const task   = taskId ? tasks.find(t => t.id === taskId) : null;
            const p      = task ? PRIORITIES[task.priority] : null;
            const isOver = dragOverPriority === i;
            const el     = task ? liveElapsed(task) : 0;
            const estS   = (task?.estimated_minutes || 0) * 60;
            const pct    = estS > 0 ? Math.min(el / estS * 100, 100) : 0;
            const over   = estS > 0 && el > estS;
            const active = !!task?.timer_started_at;
            const bar    = over ? '#ef4444' : active ? '#4ade80' : p?.color;
            const done   = task?.status === 'done';

            return (
              <div key={i}
                onDragOver={e => { e.preventDefault(); setDragOverPriority(i); }}
                onDragLeave={() => setDragOverPriority(null)}
                onDrop={() => dropOnPriority(i)}
                style={{
                  borderRadius:9, marginBottom:7, overflow:'hidden',
                  border:`1px solid ${isOver ? 'rgba(245,193,24,0.5)' : task ? p.color+'35' : 'rgba(255,255,255,0.08)'}`,
                  background: isOver ? 'rgba(245,193,24,0.06)' : task ? `${p.color}08` : 'rgba(255,255,255,0.02)',
                  transition:'all 0.15s',
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px' }}>
                  <span style={{ fontSize:13, fontWeight:900, color: task ? p.color : 'rgba(255,255,255,0.12)', minWidth:16, textAlign:'center', flexShrink:0 }}>{i+1}</span>
                  {task ? (
                    <>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', color: done ? 'rgba(255,255,255,0.35)' : 'white', textDecoration: done ? 'line-through' : 'none' }}>{task.title}</div>
                        {estS > 0 && (
                          <div style={{ fontSize:11, color: over ? '#ef4444' : 'rgba(255,255,255,0.35)', fontVariantNumeric:'tabular-nums', marginTop:1 }}>
                            {fmtSecs(el)} / {fmtMin(task.estimated_minutes)}
                          </div>
                        )}
                      </div>
                      {!done && (
                        <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                          {el > 0 && (
                            <button onClick={() => resetTimer(task)} style={{ width:20, height:20, borderRadius:4, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                              <span style={{ width:6, height:6, background:'rgba(255,255,255,0.5)', borderRadius:1, display:'block' }} />
                            </button>
                          )}
                          <button onClick={() => active ? pauseTimer(task) : startTimer(task)}
                            style={{ width:20, height:20, borderRadius:4, border:`1px solid ${active ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                            <span style={{ fontSize:7 }}>{active ? '⏸' : '▶'}</span>
                          </button>
                          <button onClick={() => markDone(task)}
                            style={{ width:20, height:20, borderRadius:4, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                            <span style={{ fontSize: 11 }}>✓</span>
                          </button>
                        </div>
                      )}
                      <button onClick={() => removeFromPriority(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.2)', fontSize:14, padding:0, lineHeight:1, flexShrink:0 }}>×</button>
                    </>
                  ) : (
                    <span style={{ flex:1, fontSize:11, color:'rgba(255,255,255,0.18)', fontStyle:'italic' }}>
                      {isOver ? 'שחרר כאן...' : 'גרור לכאן'}
                    </span>
                  )}
                </div>
                {task && estS > 0 && (
                  <div style={{ height:2, background:'rgba(255,255,255,0.05)' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background: bar, transition:'width 1s linear', boxShadow: active ? `0 0 5px ${bar}88` : 'none' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Collapsible routine ─── */}
        <div style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <button onClick={() => setRoutineSidebarOpen(v => !v)}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'none', border:'none', color:'inherit', cursor:'pointer', textAlign:'right' }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>{routineSidebarOpen ? '▼' : '▶'}</span>
            <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.65)' }}>משימות קבועות</span>
            {routineTotal > 0 && (
              <span style={{ marginRight:'auto', fontSize:11, color: routineAllDone ? '#4ade80' : 'rgba(255,255,255,0.35)', fontWeight:700 }}>
                {routineDone}/{routineTotal} {routineAllDone ? '✅' : ''}
              </span>
            )}
          </button>

          {routineSidebarOpen && (
            <div style={{ padding:'0 14px 12px' }}>
              {/* Progress bar */}
              {routineTotal > 0 && (
                <div style={{ height:3, borderRadius:99, background:'rgba(255,255,255,0.08)', overflow:'hidden', marginBottom:10 }}>
                  <div style={{ height:'100%', width:`${routineTotal>0?routineDone/routineTotal*100:0}%`, background:'#4ade80', borderRadius:99, transition:'width 0.4s' }} />
                </div>
              )}
              {routineTasks.map(task => {
                const checked = routineCompletions.has(task.id);
                return (
                  <div key={task.id} draggable
                    onDragStart={() => { dragRoutineTask.current = task; setIsDragging(true); }}
                    onDragEnd={() => { dragRoutineTask.current = null; setIsDragging(false); }}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:8, marginBottom:4, background: checked ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)', border:`1px solid ${checked ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.06)'}`, cursor:'grab', transition:'all 0.15s' }}>
                    <button onClick={() => toggleRoutine(task.id)}
                      style={{ flexShrink:0, width:18, height:18, borderRadius:'50%', border:`2px solid ${checked ? '#4ade80' : 'rgba(255,255,255,0.2)'}`, background: checked ? '#4ade80' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                      {checked && <span style={{ fontSize: 11, color:'#13152A', fontWeight:900 }}>✓</span>}
                    </button>
                    <span style={{ flex:1, fontSize:12, color: checked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)', textDecoration: checked ? 'line-through' : 'none', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{task.title}</span>
                    <button onClick={() => { setRoutineDropMins(30); setPendingRoutineDrop({ task, slot: null }); }}
                      style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize: 11, padding:'1px 6px', flexShrink:0 }}>+לוח</button>
                    {routineEditMode && <button onClick={() => deleteRoutineTask(task.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(252,165,165,0.45)', fontSize:12, padding:0 }}>✕</button>}
                  </div>
                );
              })}
              {routineAdding ? (
                <div style={{ display:'flex', gap:5, marginTop:6 }}>
                  <input autoFocus value={routineNewTitle}
                    onChange={e => setRoutineNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') addRoutineTask(); if (e.key==='Escape') { setRoutineAdding(false); setRoutineNewTitle(''); } }}
                    placeholder="שם משימה קבועה..."
                    style={{ flex:1, background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.15)', borderRadius:7, padding:'5px 9px', color:'inherit', fontSize:12, outline:'none', fontFamily:'inherit' }} />
                  <button onClick={addRoutineTask} style={{ background:'#F5C118', border:'none', borderRadius:7, padding:'5px 9px', fontWeight:700, cursor:'pointer', fontSize:11 }}>שמור</button>
                  <button onClick={() => { setRoutineAdding(false); setRoutineNewTitle(''); }} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'5px 8px', color:'inherit', cursor:'pointer', fontSize:11 }}>ביטול</button>
                </div>
              ) : (
                <div style={{ display:'flex', gap:5, marginTop:6 }}>
                  <button onClick={() => setRoutineAdding(true)} style={{ flex:1, padding:'6px', borderRadius:7, border:'1px dashed rgba(255,255,255,0.12)', background:'none', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:11 }}>＋ הוסף</button>
                  <button onClick={() => setRoutineEditMode(m => !m)} style={{ background: routineEditMode ? 'rgba(245,193,24,0.12)' : 'rgba(255,255,255,0.05)', border:`1px solid ${routineEditMode ? 'rgba(245,193,24,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius:7, padding:'6px 9px', color: routineEditMode ? '#F5C118' : 'rgba(255,255,255,0.45)', cursor:'pointer', fontSize:11, fontWeight: routineEditMode ? 700 : 400 }}>ערוך</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Task bank — takes remaining height ─── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}
          onDragOver={bankTab==='bank' ? e => e.preventDefault() : undefined}
          onDrop={bankTab==='bank' ? dropOnBank : undefined}>

          {/* Bank header: tabs + new button */}
          <div style={{ padding:'10px 14px 6px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
              {[['bank','משימות'],['done','בוצעו']].map(([k,l]) => (
                <button key={k} onClick={() => setBankTab(k)} style={{ padding:'4px 10px', borderRadius:6, border:'none', background: bankTab===k ? 'rgba(255,255,255,0.12)' : 'transparent', color: bankTab===k ? 'white' : 'rgba(255,255,255,0.4)', fontWeight: bankTab===k ? 700 : 400, fontSize:12, cursor:'pointer', borderBottom: bankTab===k ? '2px solid #F5C118' : '2px solid transparent' }}>{l}</button>
              ))}
              {bankTab==='bank' && (
                <button onClick={() => openCreate()} style={{ marginRight:'auto', background:'#F5C118', border:'none', borderRadius:6, padding:'4px 10px', fontWeight:700, cursor:'pointer', fontSize:11, color:'#13152A' }}>+ חדש</button>
              )}
            </div>

            {/* Category filter */}
            {bankTab==='bank' && (
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {['all',...CATEGORIES].map(c => (
                  <button key={c} onClick={() => setCatFilter(c)} style={S.chip(catFilter===c, null)}>{c==='all' ? 'הכל' : c}</button>
                ))}
              </div>
            )}
          </div>

          {/* Task list scrollable */}
          <div style={{ flex:1, overflowY:'auto', padding:'0 14px 10px' }}>
            {bankTab==='bank' && <>
              {bankTasks.length===0 && <EmptyState text="כל המשימות מתוזמנות 🎉" />}
              {groupedBank.map(({ priority, items }) => (
                <div key={priority}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, margin:'8px 0 4px' }}>
                    <div style={{ flex:1, height:1, background:`${PRIORITIES[priority].color}20` }} />
                    <span style={{ fontSize: 11, color: PRIORITIES[priority].color, fontWeight:700, whiteSpace:'nowrap' }}>{PRIORITIES[priority].emoji} {PRIORITIES[priority].label}</span>
                    <div style={{ flex:1, height:1, background:`${PRIORITIES[priority].color}20` }} />
                  </div>
                  {items.map(task => (
                    <BankCard key={task.id} task={task}
                      onDragStart={() => onDragStart(task.id)}
                      onDragEnd={onDragEnd}
                      onEdit={() => openEdit(task)}
                      onDelete={() => deleteTask(task.id)} />
                  ))}
                </div>
              ))}
            </>}

            {bankTab==='done' && <>
              {doneBankTasks.length===0 && <EmptyState text="עדיין לא הושלמו משימות" />}
              {doneBankTasks.map(task => (
                <DoneCard key={task.id} task={task} onRestore={() => restoreTask(task.id)} onDelete={() => deleteTask(task.id)} />
              ))}
            </>}
          </div>
        </div>

        {/* ── Brain dump — collapsible at bottom ─── */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <button onClick={() => setBrainOpen(v => !v)}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'none', border:'none', color:'inherit', cursor:'pointer', textAlign:'right' }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>{brainOpen ? '▼' : '▶'}</span>
            <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.55)' }}>🧠 Brain Dump</span>
            {brainDump.trim() && <span style={{ marginRight:'auto', fontSize: 11, color:'rgba(255,255,255,0.25)' }}>{brainDump.trim().split(/\s+/).filter(Boolean).length} מילים</span>}
          </button>
          {brainOpen && (
            <div style={{ padding:'0 14px 12px' }}>
              <textarea
                value={brainDump}
                onChange={e => saveBrain(e.target.value)}
                placeholder="מחשבות, רעיונות, דאגות..."
                style={{
                  width:'100%', height:120, background:'rgba(255,255,255,0.02)',
                  border:'1px solid rgba(255,255,255,0.08)', borderRadius:8,
                  padding:'10px', color:'inherit', fontSize:12, outline:'none',
                  resize:'none', fontFamily:'inherit', lineHeight:1.7,
                  boxSizing:'border-box',
                  backgroundImage:'repeating-linear-gradient(transparent, transparent 26px, rgba(255,255,255,0.04) 26px, rgba(255,255,255,0.04) 27px)',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Routine drop modal ─────────────────────────────── */}
      {pendingRoutineDrop && (
        <Modal onClose={() => setPendingRoutineDrop(null)}>
          <p style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>🔁 {pendingRoutineDrop.task.title}</p>
          {!pendingRoutineDrop.slot ? (
            <>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>בחר שעה:</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:14, maxHeight:150, overflowY:'auto' }}>
                {HOURS.flatMap(h => ['00','30'].map(m => `${String(h).padStart(2,'0')}:${m}`)).map(s => (
                  <button key={s} onClick={() => setPendingRoutineDrop(p => ({...p, slot: s}))}
                    style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11 }}>{s}</button>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize:12, color:'#34d399', marginBottom:12 }}>⏰ {pendingRoutineDrop.slot} · <button onClick={() => setPendingRoutineDrop(p=>({...p,slot:null}))} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:11}}>שנה</button></p>
          )}
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:6 }}>כמה דקות?</p>
          <div style={{ display:'flex', gap:5, marginBottom:18, flexWrap:'wrap' }}>
            {[15,25,30,45,60].map(m => (
              <button key={m} onClick={() => setRoutineDropMins(m)}
                style={{ padding:'5px 9px', borderRadius:8, border:`1px solid ${routineDropMins===m ? '#34d399' : 'rgba(255,255,255,0.12)'}`, background: routineDropMins===m ? 'rgba(52,211,153,0.15)' : 'transparent', color: routineDropMins===m ? '#34d399' : 'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:12, fontWeight: routineDropMins===m ? 700 : 400 }}>{m}′</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button disabled={!pendingRoutineDrop.slot} onClick={async () => {
              const { task, slot } = pendingRoutineDrop;
              if (!slot) return;
              const payload = { user_id: userId, title: task.title, category: 'עסק', priority: 'routine', status: 'scheduled', scheduled_date: selStr, scheduled_slot: slot, estimated_minutes: routineDropMins || null, actual_minutes: 0, created_at: new Date().toISOString() };
              const { data } = await supabase.from('tasks').insert(payload).select().single();
              if (data) setTasks(prev => [data, ...prev]);
              setPendingRoutineDrop(null);
            }} style={{ flex:1, background:'#F5C118', border:'none', borderRadius:8, padding:'9px', fontWeight:700, cursor:'pointer', fontSize:13, opacity: pendingRoutineDrop.slot ? 1 : 0.4 }}>הוסף ללוח</button>
            <button onClick={() => setPendingRoutineDrop(null)} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'9px 14px', color:'inherit', cursor:'pointer', fontSize:13 }}>ביטול</button>
          </div>
        </Modal>
      )}

      {/* ── Task Modal ─────────────────────────────────────── */}
      {showModal && (
        <TaskModal
          data={modalData} isEdit={!!editingTask} preSlot={preSlot}
          onChange={setModalData} onSave={saveModal}
          onClose={() => { setShowModal(false); setEditingTask(null); setPreSlot(null); setModalData(EMPTY_MODAL); }}
        />
      )}
    </div>
  );
}

// ── Empty time cell with hover hint ─────────────────────────
function SlotEmptyCell({ onClick, height }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ minHeight: height - 8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'text', borderRadius:6, transition:'background 0.1s', background: hov ? 'rgba(255,255,255,0.025)' : 'transparent' }}>
      {hov && <span style={{ fontSize:16, color:'rgba(255,255,255,0.12)', userSelect:'none' }}>＋</span>}
    </div>
  );
}

// ── Task card inside time slot ───────────────────────────────
function SlotCard({ task, elapsed, isDragging, dragTaskIdRef, onDragStart, onDragEnd, onDone, onTimer, onReset, onAddTime, onEdit, onRemove }) {
  const p      = PRIORITIES[task.priority];
  const isDone = task.status === 'done';
  const active = !!task.timer_started_at;
  const estS   = (task.estimated_minutes || 0) * 60;
  const pct    = estS > 0 ? Math.min(elapsed / estS * 100, 100) : 0;
  const over   = estS > 0 && elapsed > estS;
  const near   = !over && estS > 0 && elapsed >= estS * 0.8;
  const bar    = over ? '#ef4444' : near ? '#f59e0b' : active ? '#4ade80' : p.color;

  return (
    <div
      draggable={!isDone}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        borderRadius:8, marginBottom:4, overflow:'hidden',
        border:`1px solid ${over ? 'rgba(239,68,68,0.4)' : isDone ? 'rgba(255,255,255,0.06)' : p.color+'30'}`,
        borderRight:`3px solid ${over ? '#ef4444' : p.color}`,
        background: isDone ? 'rgba(255,255,255,0.02)' : over ? 'rgba(239,68,68,0.06)' : `${p.color}0d`,
        opacity: isDone ? 0.6 : 1,
        cursor: isDone ? 'default' : 'grab',
        pointerEvents: isDragging && dragTaskIdRef?.current !== task.id ? 'none' : 'auto',
        transition:'border-color 0.2s',
      }}>
      <div style={{ padding:'5px 7px 4px', display:'flex', flexDirection:'column', gap:3 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <button onClick={e => { e.stopPropagation(); onDone(); }}
            style={{ flexShrink:0, width:14, height:14, borderRadius:'50%', border:`1.5px solid ${isDone ? '#4ade80' : 'rgba(255,255,255,0.3)'}`, background: isDone ? '#4ade80' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
            {isDone && <span style={{ fontSize:8, color:'#13152A', fontWeight:900 }}>✓</span>}
          </button>
          <span style={{ flex:1, fontSize:12, fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'rgba(255,255,255,0.35)' : 'white' }}>
            {task.title}
          </span>
          <div style={{ display:'flex', gap:2, flexShrink:0 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.2)', fontSize:11, padding:'0 2px', lineHeight:1 }}>✏️</button>
            <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.2)', fontSize:11, padding:'0 2px', lineHeight:1 }}>✕</button>
          </div>
        </div>

        {!isDone && (
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:11, fontVariantNumeric:'tabular-nums', fontWeight:700, color: over ? '#ef4444' : elapsed > 0 ? bar : 'rgba(255,255,255,0.2)', minWidth:38 }}>
              {fmtSecs(elapsed)}
            </span>
            <span style={{ fontSize: 11, color:'rgba(255,255,255,0.25)' }}>
              {task.estimated_minutes ? `/${fmtMin(task.estimated_minutes)}` : ''}
            </span>
            {over && (
              <button onClick={e => { e.stopPropagation(); onAddTime(); }} style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:4, padding:'1px 4px', cursor:'pointer', color:'#fca5a5', fontSize: 11, fontWeight:600 }}>+15ד'</button>
            )}
            <div style={{ marginRight:'auto', display:'flex', gap:2 }}>
              {elapsed > 0 && (
                <button onClick={e => { e.stopPropagation(); onReset(); }}
                  style={{ width:18, height:18, borderRadius:4, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                  <span style={{ width:6, height:6, background:'rgba(255,255,255,0.5)', borderRadius:1, display:'block' }} />
                </button>
              )}
              <button onClick={e => { e.stopPropagation(); onTimer(); }}
                style={{ width:18, height:18, borderRadius:4, border:`1px solid ${active ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                <span style={{ fontSize:7 }}>{active ? '⏸' : '▶'}</span>
              </button>
            </div>
          </div>
        )}

        {!isDone && estS > 0 && (
          <div style={{ height:2, borderRadius:99, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background: bar, borderRadius:99, transition:'width 1s linear', boxShadow: active ? `0 0 5px ${bar}88` : 'none' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bank task card ────────────────────────────────────────────
function BankCard({ task, onDragStart, onDragEnd, onEdit, onDelete }) {
  const p = PRIORITIES[task.priority];
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      style={{ background:'rgb(var(--bg-elevated))', borderRadius:8, padding:'7px 9px', marginBottom:5, border:'1px solid rgba(255,255,255,0.06)', borderRight:`3px solid ${p.color}`, cursor:'grab', display:'flex', alignItems:'center', gap:6 }}>
      {task.status === 'returned' && <span style={{ fontSize: 11, background:'rgba(249,115,22,0.2)', color:'#f97316', borderRadius:3, padding:'1px 4px', flexShrink:0 }}>↩</span>}
      <span style={{ flex:1, fontSize:13, fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{task.title}</span>
      <div style={{ display:'flex', gap:3, flexShrink:0, alignItems:'center' }}>
        {task.estimated_minutes && <span style={{ fontSize: 11, color:'rgba(255,255,255,0.3)' }}>{fmtMin(task.estimated_minutes)}</span>}
        {task.due_date && <span style={{ fontSize: 11, color: task.due_date < toDateStr(new Date()) ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>{task.due_date.slice(5)}</span>}
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', fontSize:11, padding:'0 2px' }}>✏️</button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(252,165,165,0.4)', fontSize:11, padding:'0 2px' }}>🗑</button>
      </div>
    </div>
  );
}

function DoneCard({ task, onRestore, onDelete }) {
  const p = PRIORITIES[task.priority];
  return (
    <div style={{ background:'rgb(var(--bg-elevated))', borderRadius:8, padding:'7px 9px', marginBottom:5, border:'1px solid rgba(255,255,255,0.04)', borderRight:`3px solid ${p.color}`, opacity:0.6, display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:12 }}>✅</span>
      <span style={{ flex:1, fontSize:13, textDecoration:'line-through', color:'rgba(255,255,255,0.4)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{task.title}</span>
      <button onClick={onRestore} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'2px 7px', cursor:'pointer', color:'inherit', fontSize: 11, flexShrink:0 }}>↩</button>
      <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(252,165,165,0.4)', fontSize:11, padding:'0 2px', flexShrink:0 }}>🗑</button>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', marginTop:24, fontSize:13, padding:'0 8px' }}>{text}</div>;
}

function Modal({ onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div dir="rtl" style={{ background:'rgb(var(--bg-surface))', borderRadius:16, padding:24, width:340, border:'1px solid rgba(255,255,255,0.1)', maxHeight:'80vh', overflowY:'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ── Task creation/edit modal ─────────────────────────────────
function TaskModal({ data, isEdit, preSlot, onChange, onSave, onClose }) {
  const [timeUnit, setTimeUnit] = useState('minutes');
  const [timeVal,  setTimeVal]  = useState(data.estimated_minutes || 30);

  function set(k, v) { onChange(prev => ({ ...prev, [k]: v })); }
  function handleTime(v) {
    setTimeVal(v);
    set('estimated_minutes', timeUnit === 'hours' ? Math.round(v * 60) : Math.round(v) || null);
  }
  function handleUnit(u) {
    setTimeUnit(u);
    set('estimated_minutes', u === 'hours' ? Math.round(timeVal * 60) : Math.round(timeVal) || null);
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
        <span style={{ fontWeight:700, fontSize:16 }}>{isEdit ? 'עריכת משימה' : preSlot ? `משימה ב-${preSlot}` : 'משימה חדשה'}</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:18, padding:0 }}>×</button>
      </div>

      <label style={S.label}>כותרת</label>
      <input autoFocus value={data.title} onChange={e => set('title', e.target.value)} onKeyDown={e => e.key==='Enter' && onSave()} placeholder="שם המשימה..." style={{ ...S.input, width:'100%' }} />

      <label style={S.label}>קטגוריה</label>
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {CATEGORIES.map(c => <button key={c} onClick={() => set('category', c)} style={S.chip(data.category===c, null)}>{c}</button>)}
      </div>

      <label style={S.label}>עדיפות (Eisenhower)</label>
      <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
        {Object.entries(PRIORITIES).map(([k, v]) => (
          <button key={k} onClick={() => set('priority', k)}
            style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${data.priority===k ? v.color+'60' : 'rgba(255,255,255,0.1)'}`, background: data.priority===k ? `${v.color}18` : 'rgba(255,255,255,0.02)', color: data.priority===k ? v.color : 'rgba(255,255,255,0.65)', cursor:'pointer', fontSize:12, fontWeight: data.priority===k ? 700 : 400, textAlign:'right', display:'flex', alignItems:'center', gap:8, borderRight:`3px solid ${data.priority===k ? v.color : 'rgba(255,255,255,0.1)'}`, transition:'all 0.15s' }}>
            <span>{v.emoji}</span><span style={{ flex:1 }}>{v.label}</span>{data.priority===k && <span style={{ fontSize: 11, opacity:0.7 }}>{v.short}</span>}
          </button>
        ))}
      </div>

      <label style={S.label}>זמן משוער</label>
      <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
        <input type="number" min="0.5" step={timeUnit==='hours' ? 0.5 : 5} value={timeVal}
          onChange={e => handleTime(Number(e.target.value))}
          style={{ width:80, background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'7px 10px', color:'inherit', fontSize:13, outline:'none', textAlign:'center' }} />
        <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid rgba(255,255,255,0.12)' }}>
          {[['minutes','דקות'],['hours','שעות']].map(([u,l]) => (
            <button key={u} onClick={() => handleUnit(u)} style={{ padding:'7px 12px', border:'none', cursor:'pointer', fontSize:12, fontWeight: timeUnit===u ? 700 : 400, background: timeUnit===u ? 'rgba(255,255,255,0.12)' : 'transparent', color:'inherit' }}>{l}</button>
          ))}
        </div>
      </div>

      <label style={S.label}>תאריך יעד</label>
      <input type="date" value={data.due_date} onChange={e => set('due_date', e.target.value)} style={{ ...S.input, width:'100%' }} />

      <div style={{ display:'flex', gap:8, marginTop:6 }}>
        <button onClick={onSave} style={{ flex:1, background:'#F5C118', border:'none', borderRadius:8, padding:'9px', fontWeight:700, cursor:'pointer', fontSize:14 }}>{isEdit ? 'עדכן' : 'שמור'}</button>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'9px 14px', color:'inherit', cursor:'pointer', fontSize:13 }}>ביטול</button>
      </div>
    </Modal>
  );
}
