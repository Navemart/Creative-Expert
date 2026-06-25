import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';

const PRIORITIES = {
  urgent_important: { label: 'דחוף + חשוב', color: '#ef4444', emoji: '🔴' },
  important: { label: 'חשוב, לא דחוף', color: '#F5C118', emoji: '🟡' },
  urgent: { label: 'דחוף, לא חשוב', color: '#3b82f6', emoji: '🔵' },
  low: { label: 'לא דחוף ולא חשוב', color: 'rgba(255,255,255,0.4)', emoji: '⚪' },
};

const CATEGORIES = ['עסק', 'שיווק', 'לקוחות'];
const MINUTE_PRESETS = [25, 30, 45, 60, 90, 120];

function generateSlots() {
  const slots = [];
  for (let h = 7; h < 22; h++) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

const TIME_SLOTS = generateSlots();

function toDateString(d) {
  return d.toISOString().split('T')[0];
}

function formatHebrewDate(d) {
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  color: 'rgba(255,255,255,0.5)',
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle = {
  width: '100%',
  background: 'rgb(var(--bg-elevated))',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 12px',
  color: 'inherit',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  marginBottom: 16,
  fontFamily: 'inherit',
};

function toggleBtnStyle(active) {
  return {
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
}

const navBtnStyle = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: 'pointer',
  color: 'inherit',
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

export default function TaskManager() {
  const { user } = useUser();
  const userId = user?.id;

  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({
    title: '',
    category: 'עסק',
    priority: 'important',
    estimated_minutes: 30,
    due_date: '',
    notes: '',
  });
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const dragTaskId = useRef(null);

  const todayStr = toDateString(new Date());
  const selectedStr = toDateString(selectedDate);

  useEffect(() => {
    if (!userId) return;
    loadTasks();
  }, [userId]);

  async function loadTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) {
      setTasks(data);
      runDailyReset(data);
    }
  }

  async function runDailyReset(data) {
    const stale = data.filter(
      t => t.status === 'scheduled' && t.scheduled_date && t.scheduled_date < todayStr
    );
    if (!stale.length) return;
    const ids = stale.map(t => t.id);
    await Promise.all(
      stale.map(t =>
        supabase.from('tasks').update({
          status: 'returned',
          returned_from: t.scheduled_date,
          scheduled_date: null,
          scheduled_slot: null,
        }).eq('id', t.id)
      )
    );
    setTasks(prev =>
      prev.map(t =>
        ids.includes(t.id)
          ? { ...t, status: 'returned', returned_from: t.scheduled_date, scheduled_date: null, scheduled_slot: null }
          : t
      )
    );
  }

  useEffect(() => {
    if (activeTimer) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeTimer]);

  function startTimer(taskId) {
    if (activeTimer === taskId) {
      setActiveTimer(null);
    } else {
      setActiveTimer(taskId);
      setElapsed(0);
    }
  }

  async function markDone(task) {
    const actual = Math.round(elapsed / 60);
    clearInterval(timerRef.current);
    setActiveTimer(null);
    setElapsed(0);
    const updates = {
      status: 'done',
      actual_minutes: (task.actual_minutes || 0) + actual,
      completed_at: new Date().toISOString(),
    };
    await supabase.from('tasks').update(updates).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
  }

  async function createTask() {
    if (!modalData.title.trim()) return;
    const payload = {
      user_id: userId,
      title: modalData.title.trim(),
      category: modalData.category,
      priority: modalData.priority,
      estimated_minutes: modalData.estimated_minutes || null,
      due_date: modalData.due_date || null,
      notes: modalData.notes || null,
      status: 'bank',
      actual_minutes: 0,
      created_at: new Date().toISOString(),
    };
    const { data } = await supabase.from('tasks').insert(payload).select().single();
    if (data) setTasks(prev => [data, ...prev]);
    setShowModal(false);
    setModalData({ title: '', category: 'עסק', priority: 'important', estimated_minutes: 30, due_date: '', notes: '' });
  }

  function onDragStart(taskId) {
    dragTaskId.current = taskId;
  }

  async function dropOnSlot(slot) {
    const taskId = dragTaskId.current;
    if (!taskId) return;
    dragTaskId.current = null;
    const updates = {
      scheduled_date: selectedStr,
      scheduled_slot: slot,
      status: 'scheduled',
    };
    await supabase.from('tasks').update(updates).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  }

  async function dropOnBank() {
    const taskId = dragTaskId.current;
    if (!taskId) return;
    dragTaskId.current = null;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'bank') return;
    const updates = { status: 'bank', scheduled_date: null, scheduled_slot: null };
    await supabase.from('tasks').update(updates).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  }

  const bankTasks = tasks
    .filter(t =>
      (t.status === 'bank' || t.status === 'returned') &&
      (t.scheduled_date === null || t.scheduled_date !== selectedStr)
    )
    .filter(t => categoryFilter === 'all' || t.category === categoryFilter)
    .filter(t => priorityFilter === 'all' || t.priority === priorityFilter);

  const calendarTasks = tasks.filter(t =>
    t.scheduled_date === selectedStr && (t.status === 'scheduled' || t.status === 'done')
  );

  const doneTasks = calendarTasks.filter(t => t.status === 'done');
  const totalActual = doneTasks.reduce((s, t) => s + (t.actual_minutes || 0), 0);
  const totalPlanned = calendarTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);

  function prevDay() {
    setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  }
  function nextDay() {
    setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
  }

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, padding: 16 }}>

        <div
          style={{
            width: '40%',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgb(var(--bg-surface))',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
          onDragOver={e => e.preventDefault()}
          onDrop={dropOnBank}
        >
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>בנק משימות</span>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  background: '#F5C118',
                  color: '#000',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                + משימה חדשה
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {['all', ...CATEGORIES].map(c => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: categoryFilter === c ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: categoryFilter === c ? 600 : 400,
                  }}
                >
                  {c === 'all' ? 'הכל' : c}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {['all', ...Object.keys(PRIORITIES)].map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: priorityFilter === p ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: priorityFilter === p ? 600 : 400,
                  }}
                >
                  {p === 'all' ? 'כל העדיפויות' : PRIORITIES[p].emoji}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {bankTasks.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginTop: 40, fontSize: 14 }}>
                אין משימות בבנק
              </div>
            )}
            {bankTasks.map(task => (
              <TaskCard key={task.id} task={task} onDragStart={() => onDragStart(task.id)} />
            ))}
          </div>
        </div>

        <div
          style={{
            width: '60%',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgb(var(--bg-surface))',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={prevDay} style={navBtnStyle}>›</button>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{formatHebrewDate(selectedDate)}</span>
                <button onClick={nextDay} style={{ ...navBtnStyle, transform: 'scaleX(-1)' }}>›</button>
              </div>
              {selectedStr !== todayStr && (
                <button
                  onClick={() => setSelectedDate(new Date())}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  היום
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {TIME_SLOTS.map(slot => {
              const slotTasks = calendarTasks.filter(t => t.scheduled_slot === slot);
              return (
                <div
                  key={slot}
                  style={{ display: 'flex', gap: 8, minHeight: 44, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => dropOnSlot(slot)}
                >
                  <div style={{
                    width: 42,
                    flexShrink: 0,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                    paddingTop: 6,
                    textAlign: 'left',
                  }}>
                    {slot}
                  </div>
                  <div style={{ flex: 1, padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {slotTasks.map(task => (
                      <CalendarTask
                        key={task.id}
                        task={task}
                        activeTimer={activeTimer}
                        elapsed={elapsed}
                        onDragStart={() => onDragStart(task.id)}
                        onTimer={() => startTimer(task.id)}
                        onDone={() => markDone(task)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: 20,
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
          }}>
            <span>✅ {doneTasks.length} משימות הושלמו</span>
            <span>⏱ {totalActual} דק' בוצעו בפועל</span>
            <span>🎯 {totalPlanned} דק' מתוכנן</span>
          </div>
        </div>
      </div>

      {showModal && (
        <CreateModal
          data={modalData}
          onChange={setModalData}
          onSave={createTask}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onDragStart }) {
  const p = PRIORITIES[task.priority];
  const isReturned = task.status === 'returned';
  const isPastDue = task.due_date && task.due_date < toDateString(new Date());

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: 'rgb(var(--bg-elevated))',
        borderRadius: 12,
        padding: '10px 12px',
        marginBottom: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRight: isReturned ? '3px solid #f97316' : `3px solid ${p.color}`,
        cursor: 'grab',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{p.emoji}</span>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{task.title}</span>
        {isReturned && (
          <span style={{
            fontSize: 10,
            background: 'rgba(249,115,22,0.2)',
            color: '#f97316',
            borderRadius: 4,
            padding: '2px 6px',
            whiteSpace: 'nowrap',
          }}>↩ לא הושלם</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 4,
          padding: '2px 6px',
        }}>{task.category}</span>
        {task.due_date && (
          <span style={{ fontSize: 11, color: isPastDue ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
            {task.due_date}
          </span>
        )}
        {task.estimated_minutes && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {task.estimated_minutes} דק'
          </span>
        )}
      </div>
    </div>
  );
}

function CalendarTask({ task, activeTimer, elapsed, onDragStart, onTimer, onDone }) {
  const p = PRIORITIES[task.priority];
  const isDone = task.status === 'done';
  const isActive = activeTimer === task.id;
  const overTime = isActive && task.estimated_minutes && elapsed > task.estimated_minutes * 60;

  return (
    <div
      draggable={!isDone}
      onDragStart={onDragStart}
      style={{
        background: 'rgb(var(--bg-elevated))',
        borderRadius: 8,
        padding: '6px 10px',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRight: `3px solid ${p.color}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: isDone ? 0.5 : 1,
        cursor: isDone ? 'default' : 'grab',
      }}
    >
      <span style={{
        flex: 1,
        fontSize: 13,
        fontWeight: 500,
        textDecoration: isDone ? 'line-through' : 'none',
        color: isDone ? 'rgba(255,255,255,0.5)' : 'inherit',
      }}>
        {task.title}
        {task.estimated_minutes && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginRight: 6 }}>
            {task.estimated_minutes} דק'
          </span>
        )}
      </span>

      {isActive && (
        <span style={{
          fontSize: 12,
          color: overTime ? '#ef4444' : '#4ade80',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 44,
          textAlign: 'center',
        }}>
          {formatElapsed(elapsed)}
        </span>
      )}

      {!isDone && (
        <button
          onClick={onTimer}
          style={{
            background: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 6,
            padding: '3px 8px',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: 13,
          }}
        >
          {isActive ? '⏸' : '▶'}
        </button>
      )}

      {!isDone && (
        <button
          onClick={onDone}
          style={{
            background: 'rgba(74,222,128,0.15)',
            border: 'none',
            borderRadius: 6,
            padding: '3px 8px',
            cursor: 'pointer',
            color: '#4ade80',
            fontSize: 13,
          }}
        >
          ✓
        </button>
      )}
    </div>
  );
}

function CreateModal({ data, onChange, onSave, onClose }) {
  function set(key, val) {
    onChange(prev => ({ ...prev, [key]: val }));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div dir="rtl" style={{
        background: 'rgb(var(--bg-surface))',
        borderRadius: 16,
        padding: 24,
        width: 480,
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>משימה חדשה</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <label style={labelStyle}>כותרת</label>
        <input
          autoFocus
          value={data.title}
          onChange={e => set('title', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSave()}
          placeholder="שם המשימה..."
          style={inputStyle}
        />

        <label style={labelStyle}>קטגוריה</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => set('category', c)} style={toggleBtnStyle(data.category === c)}>
              {c}
            </button>
          ))}
        </div>

        <label style={labelStyle}>עדיפות</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {Object.entries(PRIORITIES).map(([k, v]) => (
            <button
              key={k}
              onClick={() => set('priority', k)}
              style={{
                ...toggleBtnStyle(data.priority === k),
                borderRight: `3px solid ${v.color}`,
                textAlign: 'right',
                justifyContent: 'flex-start',
              }}
            >
              {v.emoji} {v.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>זמן משוער</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          {MINUTE_PRESETS.map(m => (
            <button key={m} onClick={() => set('estimated_minutes', m)} style={toggleBtnStyle(data.estimated_minutes === m)}>
              {m} דק'
            </button>
          ))}
          <input
            type="number"
            value={data.estimated_minutes}
            onChange={e => set('estimated_minutes', Number(e.target.value))}
            style={{ ...inputStyle, width: 80, marginBottom: 0 }}
            placeholder="דק'"
          />
        </div>

        <label style={labelStyle}>תאריך יעד</label>
        <input
          type="date"
          value={data.due_date}
          onChange={e => set('due_date', e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>הערות</label>
        <textarea
          value={data.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="הערות נוספות..."
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start', marginTop: 4 }}>
          <button
            onClick={onSave}
            style={{
              background: '#F5C118',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '8px 24px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            שמור
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              padding: '8px 16px',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
