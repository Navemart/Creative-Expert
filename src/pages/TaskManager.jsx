import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { useDialog } from '../components/Dialog.jsx';

const PRIORITIES = {
  urgent_important: { label: 'דחוף + חשוב',      color: '#ef4444', emoji: '🔴' },
  important:        { label: 'חשוב, לא דחוף',     color: '#F5C118', emoji: '🟡' },
  urgent:           { label: 'דחוף, לא חשוב',     color: '#3b82f6', emoji: '🔵' },
  low:              { label: 'לא דחוף ולא חשוב',  color: 'rgba(255,255,255,0.4)', emoji: '⚪' },
};

const CATEGORIES = ['עסק', 'שיווק', 'לקוחות'];
const EMPTY_MODAL    = { title:'', category:'עסק', priority:'important', estimated_minutes:30, due_date:'', notes:'' };
const START_HOUR     = 5;
const END_HOUR       = 23;
const SLOT_HEIGHT    = 48; // px per 30-min slot

function generateSlots() {
  const s = [];
  for (let h = START_HOUR; h < END_HOUR; h++)
    for (const m of [0, 30])
      s.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  return s;
}
const TIME_SLOTS = generateSlots();

function slotIndex(slot) {
  const [h, m] = slot.split(':').map(Number);
  return (h - START_HOUR) * 2 + (m === 30 ? 1 : 0);
}

function toDateString(d) { return d.toISOString().split('T')[0]; }
function formatHebrewDate(d) {
  return d.toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' });
}
function formatElapsed(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function fmtMin(m) { return m >= 60 ? `${Math.floor(m/60)}ש'${m%60>0?' '+m%60+' דק\'':''}` : `${m} דק'`; }

const labelStyle = { display:'block', fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:6, fontWeight:500 };
const inputStyle = {
  width:'100%', background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:8, padding:'8px 12px', color:'inherit', fontSize:14, outline:'none',
  boxSizing:'border-box', marginBottom:16, fontFamily:'inherit',
};
const navBtnStyle = {
  background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:6, width:28, height:28, cursor:'pointer', color:'inherit',
  fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', padding:0,
};
function toggleBtnStyle(active, color) {
  return {
    padding:'6px 14px', borderRadius:8, border:`1px solid ${color ? color+'55' : 'rgba(255,255,255,0.15)'}`,
    background: active ? (color ? color+'22' : 'rgba(255,255,255,0.15)') : 'transparent',
    color: active && color ? color : 'inherit',
    cursor:'pointer', fontSize:13, fontWeight: active ? 600 : 400,
    display:'flex', alignItems:'center', gap:6,
  };
}

export default function TaskManager() {
  const { user }    = useUser();
  const userId      = user?.id;
  const { confirm } = useDialog();

  const [tasks,          setTasks]          = useState([]);
  const [selectedDate,   setSelectedDate]   = useState(new Date());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [bankTab,        setBankTab]        = useState('bank');
  const [showModal,      setShowModal]      = useState(false);
  const [editingTask,    setEditingTask]     = useState(null);
  const [modalData,      setModalData]      = useState(EMPTY_MODAL);
  const [activeTimer,  setActiveTimer]  = useState(null);
  const [tick,         setTick]         = useState(0);      // triggers re-render every second
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const savedSecs  = useRef({});   // { [taskId]: accumulated seconds } — never stale
  const timerStart = useRef(null); // Date.now() when current run started
  const timerRef   = useRef(null);
  const dragTaskId = useRef(null);

  // Compute live elapsed for any task (works for active, paused, or not-started)
  function getElapsed(taskId) {
    const base = savedSecs.current[taskId] || 0;
    if (activeTimer === taskId && timerStart.current) {
      return base + Math.floor((Date.now() - timerStart.current) / 1000);
    }
    return base;
  }

  const todayStr    = toDateString(new Date());
  const selectedStr = toDateString(selectedDate);

  useEffect(() => { if (userId) loadTasks(); }, [userId]);

  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending:false });
    if (data) {
      setTasks(data);
      runDailyReset(data);
      // Seed savedSecs from DB so paused timers restore correctly
      data.forEach(t => {
        if (t.actual_minutes > 0 && t.status !== 'done') {
          savedSecs.current[t.id] = t.actual_minutes * 60;
        }
      });
      setTick(t => t + 1); // trigger display refresh
    }
  }

  async function runDailyReset(data) {
    const stale = data.filter(t => t.status==='scheduled' && t.scheduled_date && t.scheduled_date < todayStr);
    if (!stale.length) return;
    await Promise.all(stale.map(t =>
      supabase.from('tasks').update({ status:'returned', returned_from:t.scheduled_date, scheduled_date:null, scheduled_slot:null }).eq('id', t.id)
    ));
    const ids = stale.map(t => t.id);
    setTasks(prev => prev.map(t => ids.includes(t.id)
      ? { ...t, status:'returned', returned_from:t.scheduled_date, scheduled_date:null, scheduled_slot:null }
      : t));
  }

  // Timer — tick every second for re-render only
  useEffect(() => {
    if (activeTimer) {
      timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeTimer]);

  async function toggleTimer(taskId) {
    if (activeTimer === taskId) {
      // PAUSE: snapshot elapsed into savedSecs, clear timerStart
      const elapsed = getElapsed(taskId);
      savedSecs.current[taskId] = elapsed;
      timerStart.current = null;
      setActiveTimer(null);
      const mins = Math.round(elapsed / 60);
      if (mins > 0) {
        await supabase.from('tasks').update({ actual_minutes: mins }).eq('id', taskId);
        setTasks(prev => prev.map(t => t.id===taskId ? { ...t, actual_minutes: mins } : t));
      }
    } else {
      // PLAY/RESUME: start clock (savedSecs already has accumulated time)
      timerStart.current = Date.now();
      setActiveTimer(taskId);
    }
  }

  async function resetTimer(taskId) {
    const ok = await confirm('האם לאפס את הטיימר?', { title:'איפוס טיימר', confirmText:'אפס', danger:false });
    if (ok) {
      if (activeTimer === taskId) { timerStart.current = null; setActiveTimer(null); }
      savedSecs.current[taskId] = 0;
      setTick(t => t + 1);
      await supabase.from('tasks').update({ actual_minutes: 0 }).eq('id', taskId);
      setTasks(prev => prev.map(t => t.id===taskId ? { ...t, actual_minutes: 0 } : t));
    }
  }

  async function markDone(task) {
    const elapsed = getElapsed(task.id);
    const mins    = Math.round(elapsed / 60);
    if (activeTimer === task.id) { timerStart.current = null; setActiveTimer(null); }
    delete savedSecs.current[task.id];
    const updates = { status:'done', actual_minutes: mins, completed_at: new Date().toISOString() };
    await supabase.from('tasks').update(updates).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id===task.id ? {...t,...updates} : t));
  }

  async function undoDone(task) {
    const updates = { status:'scheduled', completed_at:null };
    await supabase.from('tasks').update(updates).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id===task.id ? {...t,...updates} : t));
    if (task.actual_minutes > 0) {
      savedSecs.current[task.id] = task.actual_minutes * 60;
      setTick(t => t + 1);
    }
  }

  async function restoreTask(taskId) {
    const updates = { status:'bank', completed_at:null, scheduled_date:null, scheduled_slot:null };
    await supabase.from('tasks').update(updates).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id===taskId ? {...t,...updates} : t));
    setBankTab('bank');
  }

  async function deleteTask(taskId) {
    const ok = await confirm('האם למחוק את המשימה?', { title:'מחיקת משימה', confirmText:'מחק', danger:true });
    if (!ok) return;
    await supabase.from('tasks').delete().eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }

  function openCreate() { setEditingTask(null); setModalData(EMPTY_MODAL); setShowModal(true); }
  function openEdit(task) {
    setEditingTask(task);
    setModalData({ title:task.title, category:task.category, priority:task.priority, estimated_minutes:task.estimated_minutes||30, due_date:task.due_date||'', notes:task.notes||'' });
    setShowModal(true);
  }

  async function saveModal() {
    if (!modalData.title.trim()) return;
    if (editingTask) {
      const updates = { title:modalData.title.trim(), category:modalData.category, priority:modalData.priority, estimated_minutes:modalData.estimated_minutes||null, due_date:modalData.due_date||null, notes:modalData.notes||null };
      const { error } = await supabase.from('tasks').update(updates).eq('id', editingTask.id);
      if (error) { alert('שגיאה: '+error.message); return; }
      setTasks(prev => prev.map(t => t.id===editingTask.id ? {...t,...updates} : t));
    } else {
      const payload = { user_id:userId, title:modalData.title.trim(), category:modalData.category, priority:modalData.priority, estimated_minutes:modalData.estimated_minutes||null, due_date:modalData.due_date||null, notes:modalData.notes||null, status:'bank', actual_minutes:0, created_at:new Date().toISOString() };
      const { data, error } = await supabase.from('tasks').insert(payload).select().single();
      if (error) { alert('שגיאה: '+error.message); return; }
      if (data) setTasks(prev => [data, ...prev]);
    }
    setShowModal(false); setEditingTask(null); setModalData(EMPTY_MODAL);
  }

  function onDragStart(taskId) { dragTaskId.current = taskId; setIsDragging(true); }
  function onDragEnd() { setIsDragging(false); dragTaskId.current = null; setDragOverSlot(null); }

  async function dropOnSlot(slot) {
    const taskId = dragTaskId.current;
    if (!taskId) return;
    dragTaskId.current = null; setIsDragging(false); setDragOverSlot(null);
    const updates = { scheduled_date:selectedStr, scheduled_slot:slot, status:'scheduled' };
    await supabase.from('tasks').update(updates).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id===taskId ? {...t,...updates} : t));
  }

  async function dropOnBank() {
    const taskId = dragTaskId.current;
    if (!taskId) return;
    dragTaskId.current = null; setIsDragging(false);
    const task = tasks.find(t => t.id===taskId);
    if (!task || task.status==='bank') return;
    const updates = { status:'bank', scheduled_date:null, scheduled_slot:null };
    await supabase.from('tasks').update(updates).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id===taskId ? {...t,...updates} : t));
  }

  const bankTasks = tasks
    .filter(t => (t.status==='bank'||t.status==='returned') && (t.scheduled_date===null||t.scheduled_date!==selectedStr))
    .filter(t => categoryFilter==='all' || t.category===categoryFilter)
    .filter(t => priorityFilter==='all' || t.priority===priorityFilter);

  const doneBankTasks  = tasks.filter(t => t.status==='done');
  const calendarTasks  = tasks.filter(t => t.scheduled_date===selectedStr && (t.status==='scheduled'||t.status==='done'));
  const doneToday      = calendarTasks.filter(t => t.status==='done');
  const totalActual    = calendarTasks.reduce((s,t) => {
    const elapsed = getElapsed(t.id);
    return s + (elapsed > 0 ? Math.round(elapsed / 60) : (t.actual_minutes || 0));
  }, 0);
  const totalPlanned   = calendarTasks.reduce((s,t) => s+(t.estimated_minutes||0), 0);
  const showDragHint   = bankTasks.length > 0 && calendarTasks.length === 0 && selectedStr === todayStr;
  const totalSlots     = (END_HOUR - START_HOUR) * 2;
  const calendarHeight = totalSlots * SLOT_HEIGHT;

  function prevDay() { setSelectedDate(d => { const n=new Date(d); n.setDate(n.getDate()-1); return n; }); }
  function nextDay() { setSelectedDate(d => { const n=new Date(d); n.setDate(n.getDate()+1); return n; }); }

  return (
    <div dir="rtl" style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      <div style={{ display:'flex', gap:16, flex:1, minHeight:0, padding:16 }}>

        {/* ── Bank panel ── */}
        <div style={{ width:'38%', display:'flex', flexDirection:'column', background:'rgb(var(--bg-surface))', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden' }}
          onDragOver={e => e.preventDefault()} onDrop={dropOnBank}>

          <div style={{ padding:'16px 16px 0' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ display:'flex', gap:2 }}>
                {[['bank','בנק משימות'],['done','הושלמו']].map(([k,l]) => (
                  <button key={k} onClick={() => setBankTab(k)} style={{
                    padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                    background: bankTab===k ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: bankTab===k ? 'white' : 'rgba(255,255,255,0.45)',
                    fontWeight: bankTab===k ? 700 : 400, fontSize:14,
                  }}>{l}</button>
                ))}
              </div>
              {bankTab==='bank' && (
                <button onClick={openCreate} className="btn-yellow" style={{ background:'#F5C118', border:'none', borderRadius:8, padding:'6px 14px', fontWeight:600, cursor:'pointer', fontSize:13 }}>+ משימה חדשה</button>
              )}
            </div>

            {bankTab==='bank' && <>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {['all',...CATEGORIES].map(c => (
                  <button key={c} onClick={() => setCategoryFilter(c)} style={{ padding:'4px 10px', borderRadius:20, border:'1px solid rgba(255,255,255,0.15)', background: categoryFilter===c ? 'rgba(255,255,255,0.15)' : 'transparent', color:'inherit', cursor:'pointer', fontSize:12, fontWeight: categoryFilter===c ? 600 : 400 }}>
                    {c==='all' ? 'הכל' : c}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {['all',...Object.keys(PRIORITIES)].map(p => (
                  <button key={p} onClick={() => setPriorityFilter(p)} style={{ padding:'4px 10px', borderRadius:20, border:'1px solid rgba(255,255,255,0.15)', background: priorityFilter===p ? 'rgba(255,255,255,0.15)' : 'transparent', color:'inherit', cursor:'pointer', fontSize:12, fontWeight: priorityFilter===p ? 600 : 400 }}>
                    {p==='all' ? 'כל העדיפויות' : PRIORITIES[p].emoji}
                  </button>
                ))}
              </div>
            </>}
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px' }}>
            {bankTab==='bank' && <>
              {bankTasks.length===0 && <div style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', marginTop:40, fontSize:14 }}>אין משימות בבנק</div>}
              {bankTasks.map(task => (
                <TaskCard key={task.id} task={task}
                  onDragStart={() => onDragStart(task.id)}
                  onDragEnd={onDragEnd}
                  onEdit={() => openEdit(task)}
                  onDelete={() => deleteTask(task.id)} />
              ))}
            </>}
            {bankTab==='done' && <>
              {doneBankTasks.length===0 && <div style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', marginTop:40, fontSize:14 }}>אין משימות שהושלמו</div>}
              {doneBankTasks.map(task => (
                <DoneCard key={task.id} task={task} onRestore={() => restoreTask(task.id)} onDelete={() => deleteTask(task.id)} />
              ))}
            </>}
          </div>
        </div>

        {/* ── Calendar panel ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'rgb(var(--bg-surface))', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden' }}>
          <div style={{ padding:'16px 16px 8px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={prevDay} style={navBtnStyle}>›</button>
                <span style={{ fontWeight:700, fontSize:15 }}>{formatHebrewDate(selectedDate)}</span>
                <button onClick={nextDay} style={{ ...navBtnStyle, transform:'scaleX(-1)' }}>›</button>
              </div>
              {selectedStr!==todayStr && (
                <button onClick={() => setSelectedDate(new Date())} style={{ padding:'4px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', color:'inherit', cursor:'pointer', fontSize:12 }}>היום</button>
              )}
            </div>
            {showDragHint && (
              <div style={{ background:'rgba(245,193,24,0.08)', border:'1px solid rgba(245,193,24,0.25)', borderRadius:10, padding:'8px 12px', marginTop:10, fontSize:13, color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', gap:8 }}>
                <span>💡</span><span>גרור משימות מהבנק ישירות לשעה הרצויה ביומן</span>
              </div>
            )}
          </div>

          {/* Calendar grid */}
          <div style={{ flex:1, overflowY:'auto', position:'relative' }}>
            <div style={{ position:'relative', height: calendarHeight }}>

              {/* Time grid rows (drop zones) */}
              {TIME_SLOTS.map((slot, idx) => (
                <div key={slot}
                  style={{
                    position:'absolute', top: idx * SLOT_HEIGHT, left:0, right:0, height: SLOT_HEIGHT,
                    display:'flex', borderBottom:'1px solid rgba(255,255,255,0.05)',
                    background: dragOverSlot===slot ? 'rgba(245,193,24,0.07)' : 'transparent',
                    transition:'background 0.1s',
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOverSlot(slot); }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={() => dropOnSlot(slot)}
                >
                  <div style={{ width:44, flexShrink:0, fontSize:11, color: slot.endsWith(':00') ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)', paddingTop:4, paddingRight:8, textAlign:'right', userSelect:'none' }}>
                    {slot.endsWith(':00') ? String(parseInt(slot)) : ''}
                  </div>
                  {dragOverSlot===slot && (
                    <div style={{ flex:1, display:'flex', alignItems:'center', fontSize:11, color:'rgba(245,193,24,0.6)', paddingRight:8 }}>
                      שחרר כאן ← {slot}
                    </div>
                  )}
                </div>
              ))}

              {/* Task overlays — absolutely positioned */}
              {calendarTasks.map(task => {
                if (!task.scheduled_slot) return null;
                const idx      = slotIndex(task.scheduled_slot);
                const mins     = task.estimated_minutes || 30;
                const heightPx = Math.max(SLOT_HEIGHT - 4, Math.round((mins / 30) * SLOT_HEIGHT) - 4);
                const top      = idx * SLOT_HEIGHT + 2;
                const p        = PRIORITIES[task.priority];
                const isDone   = task.status === 'done';
                const elapsed  = getElapsed(task.id);
                const isActive = activeTimer === task.id;
                const isPaused = elapsed > 0 && !isActive;
                const overTime = elapsed > 0 && task.estimated_minutes && elapsed > task.estimated_minutes * 60;
                const actual   = task.actual_minutes || 0;

                // ── Checkbox
                const checkbox = (
                  <button onClick={e => { e.stopPropagation(); isDone ? undoDone(task) : markDone(task); }}
                    style={{
                      flexShrink:0, width:18, height:18, borderRadius:'50%', border:`1.5px solid ${isDone ? '#4ade80' : 'rgba(255,255,255,0.35)'}`,
                      background: isDone ? '#4ade80' : 'transparent', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', padding:0,
                    }}>
                    {isDone && <span style={{ fontSize:10, color:'#13152A', fontWeight:900, lineHeight:1 }}>✓</span>}
                  </button>
                );

                // ── Timer side (far left in RTL)
                const timerSide = (
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                    {isDone ? (
                      // Done: show actual / estimated
                      <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>
                        {actual > 0 ? fmtMin(actual) : '—'} / {fmtMin(mins)}
                      </span>
                    ) : <>
                      {/* Elapsed display — always visible when there's time */}
                      {elapsed > 0 && (
                        <span style={{ fontSize:13, fontVariantNumeric:'tabular-nums', fontWeight:700, minWidth:44,
                          color: isActive ? (overTime ? '#ef4444' : '#4ade80') : 'rgba(255,255,255,0.5)' }}>
                          {formatElapsed(elapsed)}{isActive && overTime ? ' ⚠' : ''}
                        </span>
                      )}
                      {/* Reset — only when there's elapsed */}
                      {elapsed > 0 && (
                        <button onClick={e => { e.stopPropagation(); resetTimer(task.id); }}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(252,165,165,0.5)', fontSize:13, padding:'1px 4px' }}>↺</button>
                      )}
                      {/* Play/Pause */}
                      <button onClick={e => { e.stopPropagation(); toggleTimer(task.id); }}
                        style={{ background: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.12)', border:`1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius:6, padding:'3px 10px', cursor:'pointer', color:'inherit', fontSize:13 }}>
                        {isActive ? '⏸' : '▶'}
                      </button>
                    </>}
                  </div>
                );

                return (
                  <div
                    key={task.id}
                    draggable={!isDone}
                    onDragStart={() => onDragStart(task.id)}
                    onDragEnd={onDragEnd}
                    style={{
                      position:'absolute', top, left:8, right:52, height:heightPx,
                      background: isDone ? 'rgba(255,255,255,0.03)' : `${p.color}12`,
                      border: `1px solid ${isDone ? 'rgba(255,255,255,0.07)' : p.color+'40'}`,
                      borderRight: `3px solid ${p.color}`,
                      borderRadius:8, padding:'6px 8px 6px 8px', boxSizing:'border-box',
                      display:'flex', alignItems:'flex-start', gap:8,
                      opacity: isDone ? 0.6 : 1,
                      cursor: isDone ? 'default' : 'grab',
                      overflow:'hidden', zIndex:1,
                      pointerEvents: isDragging && dragTaskId.current !== task.id ? 'none' : 'auto',
                    }}
                  >
                    {checkbox}
                    <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
                      <span style={{ fontSize:13, fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'rgba(255,255,255,0.4)' : 'white' }}>
                        {task.title}
                      </span>
                      <span style={{ fontSize:13, fontWeight:600, color: isDone ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)', whiteSpace:'nowrap', flexShrink:0 }}>
                        {fmtMin(mins)}
                      </span>
                    </div>
                    {timerSide}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', gap:20, fontSize:13, color:'rgba(255,255,255,0.6)', flexShrink:0 }}>
            <span>✅ {doneToday.length} הושלמו</span>
            <span>⏱ {fmtMin(totalActual)} בפועל</span>
            <span>🎯 {fmtMin(totalPlanned)} מתוכנן</span>
          </div>
        </div>
      </div>

      {showModal && (
        <TaskModal data={modalData} isEdit={!!editingTask} onChange={setModalData}
          onSave={saveModal}
          onClose={() => { setShowModal(false); setEditingTask(null); setModalData(EMPTY_MODAL); }} />
      )}
    </div>
  );
}

function TaskCard({ task, onDragStart, onDragEnd, onEdit, onDelete }) {
  const p          = PRIORITIES[task.priority];
  const isReturned = task.status === 'returned';
  const isPastDue  = task.due_date && task.due_date < toDateString(new Date());

  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} style={{
      background:'rgb(var(--bg-elevated))', borderRadius:12, padding:'10px 12px', marginBottom:8,
      border:'1px solid rgba(255,255,255,0.08)', borderRight: isReturned ? '3px solid #f97316' : `3px solid ${p.color}`,
      cursor:'grab',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
        <span style={{ fontSize:14 }}>{p.emoji}</span>
        <span style={{ fontWeight:600, fontSize:14, flex:1 }}>{task.title}</span>
        {isReturned && <span style={{ fontSize:10, background:'rgba(249,115,22,0.2)', color:'#f97316', borderRadius:4, padding:'2px 6px', whiteSpace:'nowrap' }}>↩ לא הושלם</span>}
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:13, padding:'2px 4px' }}>✏️</button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(252,165,165,0.6)', fontSize:13, padding:'2px 4px' }}>🗑</button>
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:11, background:'rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 6px' }}>{task.category}</span>
        {task.due_date && <span style={{ fontSize:11, color: isPastDue ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>{task.due_date}</span>}
        {task.estimated_minutes && <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{fmtMin(task.estimated_minutes)}</span>}
      </div>
    </div>
  );
}

function DoneCard({ task, onRestore, onDelete }) {
  const p      = PRIORITIES[task.priority];
  const actual = task.actual_minutes || 0;
  return (
    <div style={{ background:'rgb(var(--bg-elevated))', borderRadius:12, padding:'10px 12px', marginBottom:8, border:'1px solid rgba(255,255,255,0.06)', borderRight:`3px solid ${p.color}`, opacity:0.7 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:14 }}>✅</span>
        <span style={{ fontWeight:500, fontSize:14, flex:1, textDecoration:'line-through', color:'rgba(255,255,255,0.5)' }}>{task.title}</span>
        <button onClick={onRestore} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'inherit', fontSize:11 }}>↩ החזר</button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(252,165,165,0.6)', fontSize:13, padding:'2px 4px' }}>🗑</button>
      </div>
      {actual > 0 && <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:4, paddingRight:22 }}>⏱ {fmtMin(actual)} בפועל</div>}
    </div>
  );
}

function TaskModal({ data, isEdit, onChange, onSave, onClose }) {
  const [timeUnit, setTimeUnit] = useState('minutes');
  const [timeValue, setTimeValue] = useState(data.estimated_minutes || 30);

  function set(key, val) { onChange(prev => ({ ...prev, [key]:val })); }

  function handleTimeChange(val) {
    setTimeValue(val);
    const mins = timeUnit === 'hours' ? Math.round(val * 60) : Math.round(val);
    set('estimated_minutes', mins || null);
  }

  function handleUnitSwitch(unit) {
    setTimeUnit(unit);
    const mins = unit === 'hours' ? Math.round(timeValue * 60) : Math.round(timeValue);
    set('estimated_minutes', mins || null);
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div dir="rtl" style={{ background:'rgb(var(--bg-surface))', borderRadius:16, padding:24, width:480, maxHeight:'90vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>{isEdit ? 'עריכת משימה' : 'משימה חדשה'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:18 }}>×</button>
        </div>

        <label style={labelStyle}>כותרת</label>
        <input autoFocus value={data.title} onChange={e => set('title', e.target.value)} onKeyDown={e => e.key==='Enter' && onSave()} placeholder="שם המשימה..." style={inputStyle} />

        <label style={labelStyle}>קטגוריה</label>
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {CATEGORIES.map(c => <button key={c} onClick={() => set('category', c)} style={toggleBtnStyle(data.category===c)}>{c}</button>)}
        </div>

        <label style={labelStyle}>עדיפות</label>
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
          {Object.entries(PRIORITIES).map(([k, v]) => (
            <button key={k} onClick={() => set('priority', k)} style={{ ...toggleBtnStyle(data.priority===k, v.color), borderRight:`3px solid ${v.color}`, textAlign:'right', justifyContent:'flex-start' }}>
              {v.emoji} {v.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>כמה זמן תוקצב למשימה?</label>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <input type="number" min="0.5" step={timeUnit==='hours' ? 0.5 : 5} value={timeValue}
            onChange={e => handleTimeChange(Number(e.target.value))}
            style={{ ...inputStyle, width:90, marginBottom:0 }}
            placeholder={timeUnit==='hours' ? '1.5' : '30'} />
          <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid rgba(255,255,255,0.15)', flexShrink:0 }}>
            {[['minutes','דקות'],['hours','שעות']].map(([u,l]) => (
              <button key={u} onClick={() => handleUnitSwitch(u)} style={{
                padding:'7px 14px', border:'none', cursor:'pointer', fontSize:13, fontWeight: timeUnit===u ? 700 : 400,
                background: timeUnit===u ? 'rgba(255,255,255,0.15)' : 'transparent', color:'inherit',
              }}>{l}</button>
            ))}
          </div>
        </div>

        <label style={labelStyle}>תאריך יעד</label>
        <input type="date" value={data.due_date} onChange={e => set('due_date', e.target.value)} style={inputStyle} />


        <div style={{ display:'flex', gap:8, justifyContent:'flex-start', marginTop:4 }}>
          <button onClick={onSave} className="btn-yellow" style={{ background:'#F5C118', border:'none', borderRadius:8, padding:'8px 24px', fontWeight:700, cursor:'pointer' }}>
            {isEdit ? 'עדכן' : 'שמור'}
          </button>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'8px 16px', color:'inherit', cursor:'pointer' }}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
