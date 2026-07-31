import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Check, RefreshCw, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';

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

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Photo({ name, src }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed)
    return <img src={src} alt={name} onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.08)', borderRadius: '50%', fontWeight: 900, fontSize: '1rem', color: 'rgba(255,255,255,0.3)' }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: 'white',
  outline: 'none', resize: 'vertical', fontFamily: 'inherit',
};

function ExpandedCard({ student, onCheckin, checking, onClose, onSaved }) {
  const [history, setHistory]       = useState(null);
  const [loadingH, setLoadingH]     = useState(true);
  const [focus, setFocus]           = useState('');
  const [bottleneck, setBottleneck] = useState('');
  const [notes, setNotes]           = useState('');
  const [date, setDate]             = useState(todayISO());
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    fetch(`/api/admin/checkins/${student.id}/history`, { headers: { 'x-admin-id': ADMIN_ID || '' } })
      .then(r => r.json())
      .then(d => { setHistory(d.history || []); setLoadingH(false); })
      .catch(() => { setHistory([]); setLoadingH(false); });
  }, [student.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ user_id: student.id, focus, bottleneck, notes, checked_date: date }),
      });
      if (res.ok) {
        onSaved(student.id, date);
        setHistory(prev => [{ checked_at: new Date().toISOString(), checked_date: date, focus, bottleneck, notes }, ...(prev || [])]);
        setFocus(''); setBottleneck(''); setNotes(''); setDate(todayISO());
      }
    } finally {
      setSaving(false);
    }
  }

  const cadence = student.checkin_cadence_days || 14;
  const cycleLabel = cadence === 7 ? 'שבועי' : cadence === 14 ? '2 שבועות' : `${cadence} ימים`;

  return (
    <div style={{
      background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Top summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }} onClick={onClose}>
        <GripVertical size={13} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
        <div style={{ width: 34, height: 34, flexShrink: 0 }}>
          <Photo name={student.name} src={student.image_url} />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'white', margin: 0 }}>{student.name}</p>
          <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
            {student.last_checkin ? fmtDays(student.days_since) : 'אין צ׳קאין'}
          </p>
        </div>
        <ChevronUp size={15} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
      </div>

      {/* Details */}
      <div style={{ padding: '14px 14px 0' }}>
        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'צ׳קאין אחרון', value: fmtDate(student.last_checkin) },
            { label: 'לפני', value: student.days_since !== null ? `${student.days_since} ימים` : '—' },
            { label: 'מחזור', value: cycleLabel },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', textAlign: 'right' }}>
              <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.35)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <p style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', textAlign: 'right' }}>תאריך צ׳קאין</p>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10, cursor: 'pointer' }} />

        <p style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px', textAlign: 'right' }}>פוקוס</p>
        <textarea rows={2} placeholder="על מה הם עובדים?" value={focus} onChange={e => setFocus(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }} />

        <p style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px', textAlign: 'right' }}>חסמים</p>
        <textarea rows={2} placeholder="במה הם תקועים?" value={bottleneck} onChange={e => setBottleneck(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }} />

        <p style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px', textAlign: 'right' }}>הערות</p>
        <textarea rows={2} placeholder="כל מה שחשוב לציין..." value={notes} onChange={e => setNotes(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }} />

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer',
            background: saving ? 'rgba(245,193,24,0.3)' : 'rgba(245,193,24,0.85)', color: '#000', fontWeight: 700, fontSize: '0.8125rem',
            transition: 'background 0.12s', marginBottom: 14,
          }}
        >
          {saving ? 'שומר...' : '✓ שמור צ׳קאין'}
        </button>

        {/* History */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginBottom: 14 }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', textAlign: 'right' }}>היסטוריה</p>
          {loadingH ? (
            <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '12px 0' }}>טוען...</p>
          ) : !history || history.length === 0 ? (
            <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '12px 0' }}>אין היסטוריה</p>
          ) : (
            history.map((h, i) => (
              <div key={i} style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: 10, marginBottom: 10 }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(245,193,24,0.8)', margin: '0 0 4px', textAlign: 'right' }}>
                  {fmtDate(h.checked_date || h.checked_at)}
                </p>
                {h.focus     && <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)', margin: '2px 0', textAlign: 'right' }}><span style={{ color: 'rgba(255,255,255,0.25)' }}>פוקוס: </span>{h.focus}</p>}
                {h.bottleneck && <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)', margin: '2px 0', textAlign: 'right' }}><span style={{ color: 'rgba(255,255,255,0.25)' }}>חסמים: </span>{h.bottleneck}</p>}
                {h.notes     && <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)', margin: '2px 0', textAlign: 'right' }}><span style={{ color: 'rgba(255,255,255,0.25)' }}>הערות: </span>{h.notes}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StudentCard({ student, onCheckin, checking, onDragStart, expanded, onToggle, onSaved }) {
  if (expanded) {
    return (
      <ExpandedCard
        student={student}
        onCheckin={onCheckin}
        checking={checking}
        onClose={onToggle}
        onSaved={onSaved}
      />
    );
  }

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

      <div style={{ flex: 1, minWidth: 0, textAlign: 'right', cursor: 'pointer' }} onClick={onToggle}>
        <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.name}</p>
        <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
          {student.last_checkin ? fmtDays(student.days_since) : 'אין צ׳קאין'}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.25)' }}>#{student.checkin_count || 0}</span>
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
        <button
          onClick={onToggle}
          title="פתח פרטים"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: 'rgba(255,255,255,0.35)', padding: 2, transition: 'color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <ChevronDown size={15} />
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
  const [expandedId, setExpandedId] = useState(null);
  const dragId = useRef(null);

  const isUnauthorized = user && user.id !== ADMIN_ID;

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
            ? { ...s, column: 'done', last_checkin: new Date().toISOString(), days_since: 0, checkin_count: (s.checkin_count || 0) + 1 }
            : s
        ));
      }
    } finally {
      setChecking(null);
    }
  }

  function handleSaved(userId, checkedDate) {
    setStudents(prev => prev.map(s =>
      s.id === userId
        ? { ...s, column: 'done', last_checkin: new Date().toISOString(), days_since: 0, checkin_count: (s.checkin_count || 0) + 1 }
        : s
    ));
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

  if (isUnauthorized) {
    return <div style={{ display: 'flex', height: 240, alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>אין גישה</div>;
  }

  const counts = Object.fromEntries(COLUMNS.map(c => [c.key, students.filter(s => s.column === c.key).length]));
  const border = '1px solid rgba(255,255,255,0.08)';

  return (
    <div dir="rtl" style={{ padding: '28px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', margin: 0 }}>צ׳קאינס</h1>
            <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>מעקב אחר פנייה לתלמידים פעילים</p>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchAll().then(() => setRefreshing(false)); }}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgb(var(--bg-surface))', border, cursor: 'pointer', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none', color: 'rgba(255,255,255,0.3)' }} />
            רענן
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)', fontSize: '0.8125rem' }}>טוען...</div>
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
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>{col.label}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: col.dot, background: col.dot + '18', border: `1px solid ${col.dot}30`, padding: '2px 8px', borderRadius: 20 }}>
                      {counts[col.key]}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.25)', margin: '0', padding: '6px 16px 10px', borderBottom: colStudents.length ? border : 'none' }}>{col.desc}</p>

                  {/* Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: colStudents.length ? 10 : 0 }}>
                    {colStudents.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', padding: '32px 0' }}>אין תלמידים</p>
                    ) : (
                      colStudents.map(s => (
                        <StudentCard
                          key={s.id}
                          student={s}
                          onCheckin={handleCheckin}
                          checking={checking}
                          onDragStart={handleDragStart}
                          expanded={expandedId === s.id}
                          onToggle={() => setExpandedId(prev => prev === s.id ? null : s.id)}
                          onSaved={handleSaved}
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
