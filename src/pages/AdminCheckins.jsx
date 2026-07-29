import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Check, RefreshCw, GripVertical } from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const COLUMNS = [
  { key: 'overdue',  label: 'איחור',   dot: '#ef4444', desc: 'עבר מועד הצ׳קאין' },
  { key: 'upcoming', label: 'בקרוב',   dot: '#f59e0b', desc: 'מועד הצ׳קאין מתקרב' },
  { key: 'done',     label: 'בוצע',    dot: '#22c55e', desc: 'צ׳קאין ב-7 הימים האחרונים' },
];

function fmtDays(n) {
  if (n === null) return 'מעולם לא';
  if (n === 0) return 'היום';
  if (n === 1) return 'אתמול';
  return `לפני ${n} ימים`;
}

function Photo({ name, src }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed)
    return <img src={src} alt={name} onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.08)', borderRadius: '50%', fontWeight: 900, fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function StudentCard({ student, onCheckin, checking, onDragStart }) {
  const col = COLUMNS.find(c => c.key === student.column);
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, student.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, cursor: 'grab', userSelect: 'none',
        transition: 'border-color 0.12s, background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      <GripVertical size={13} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

      <div style={{ width: 34, height: 34, flexShrink: 0 }}>
        <Photo name={student.name} src={student.image_url} />
      </div>

      <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.name}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
          {student.column === 'overdue' && student.days_since !== null
            ? `${fmtDays(student.days_since)}`
            : student.last_checkin
              ? fmtDays(student.days_since)
              : 'אין צ׳קאין'}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>כל {student.cadence}י׳</span>
        <button
          onClick={() => onCheckin(student.id)}
          disabled={checking === student.id}
          title="סמן צ׳קאין"
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: checking === student.id ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.12)',
            color: '#22c55e', transition: 'background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = checking === student.id ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.12)'; }}
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}

export default function AdminCheckins() {
  const { user } = useUser();
  const [students, setStudents]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [checking, setChecking]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dragOver, setDragOver]   = useState(null);
  const dragId = useRef(null);

  if (user && user.id !== ADMIN_ID) {
    return <div style={{ display: 'flex', height: 240, alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>אין גישה</div>;
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/checkins', { headers: { 'x-admin-id': ADMIN_ID || '' } });
      if (res.ok) {
        const { students: s } = await res.json();
        setStudents(s || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleCheckin(userId) {
    setChecking(userId);
    try {
      const res = await fetch('/api/admin/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        setStudents(prev => prev.map(s =>
          s.id === userId
            ? { ...s, column: 'done', last_checkin: new Date().toISOString(), days_since: 0 }
            : s
        ));
      }
    } finally {
      setChecking(null);
    }
  }

  function handleDragStart(e, id) {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, colKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(colKey);
  }

  function handleDrop(e, colKey) {
    e.preventDefault();
    setDragOver(null);
    const id = dragId.current;
    if (!id) return;
    if (colKey === 'done') {
      handleCheckin(id);
    } else {
      setStudents(prev => prev.map(s => s.id === id ? { ...s, column: colKey } : s));
    }
  }

  const counts = Object.fromEntries(COLUMNS.map(c => [c.key, students.filter(s => s.column === c.key).length]));
  const border = '1px solid rgba(255,255,255,0.08)';

  return (
    <div dir="rtl" style={{ padding: '28px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0 }}>צ׳קאינס</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>מעקב אחר פנייה לתלמידים פעילים</p>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchAll().then(() => setRefreshing(false)); }}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgb(var(--bg-surface))', border, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none', color: 'rgba(255,255,255,0.3)' }} />
            רענן
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>טוען...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
            {COLUMNS.map(col => {
              const colStudents = students.filter(s => s.column === col.key);
              const isOver = dragOver === col.key;
              return (
                <div
                  key={col.key}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, col.key)}
                  style={{
                    borderRadius: 14, border: isOver ? `1px solid ${col.dot}55` : border,
                    background: isOver ? col.dot + '08' : 'rgb(var(--bg-surface))',
                    transition: 'border-color 0.15s, background 0.15s',
                    minHeight: 200,
                  }}
                >
                  {/* Column header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: border }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>{col.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.dot, background: col.dot + '18', border: `1px solid ${col.dot}30`, padding: '2px 8px', borderRadius: 20 }}>
                      {counts[col.key]}
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '0', padding: '6px 16px 10px', borderBottom: colStudents.length ? border : 'none' }}>{col.desc}</p>

                  {/* Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: colStudents.length ? 10 : 0 }}>
                    {colStudents.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 12, padding: '32px 0' }}>אין תלמידים</p>
                    ) : (
                      colStudents.map(s => (
                        <StudentCard
                          key={s.id}
                          student={s}
                          onCheckin={handleCheckin}
                          checking={checking}
                          onDragStart={handleDragStart}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
