import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useDialog } from '../components/Dialog.jsx';
import { Plus, Trash2, Star, ExternalLink, ChevronUp, ChevronDown, X, SlidersHorizontal, UserPlus } from 'lucide-react';
import confetti from 'canvas-confetti';

// ── Options ───────────────────────────────────────────────────
const SOURCE_OPTIONS = [
  { value: 'פניה מהתוכן',      color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)'   },
  { value: 'פניה ישירה',        color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)',  border: 'rgba(45,212,191,0.3)'  },
  { value: 'פניה מהסטורי',      color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.3)'  },
  { value: 'פרטים באתר',        color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.3)'  },
  { value: 'ביריד / אירוע',     color: '#c084fc', bg: 'rgba(192,132,252,0.15)', border: 'rgba(192,132,252,0.3)' },
  { value: 'פניה מהמייל',       color: '#facc15', bg: 'rgba(250,204,21,0.15)',  border: 'rgba(250,204,21,0.3)'  },
  { value: 'פניה מהמלצה',       color: '#f472b6', bg: 'rgba(244,114,182,0.15)', border: 'rgba(244,114,182,0.3)' },
  { value: 'פניה יוצאת',        color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' },
  { value: 'פניה יוצאת - מייל', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' },
];

const CALL_STATUS_OPTIONS = [
  { value: 'פולואפ',     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)'  },
  { value: 'נסגר',       color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)'   },
  { value: 'לא נסגר',    color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.3)'  },
  { value: 'אין התאמה',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' },
  { value: 'לא הגיע',    color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)'   },
];

const EMPTY_LEAD = {
  name: '', contact_date: null, instagram_link: '',
  lead_source: '', rating: 0, business_type: '', notes: '',
  matching_booked: false, matching_attended: false,
  sales_booked: false, sales_scheduled: false,
  call_status: '', call_date: null, followup_date: null,
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ── Cell components ───────────────────────────────────────────

function TextCell({ value, onSave, placeholder = '', multiline = false, defaultEditing = false }) {
  const [editing, setEditing] = useState(defaultEditing);
  const [val, setVal] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setVal(value || ''); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  function finish() {
    setEditing(false);
    if (val.trim() !== (value || '').trim()) onSave(val.trim());
  }

  const sharedProps = {
    ref, value: val,
    onChange: e => setVal(e.target.value),
    onBlur: finish,
    onKeyDown: e => {
      if (!multiline && (e.key === 'Enter')) finish();
      if (e.key === 'Escape') { setVal(value || ''); setEditing(false); }
    },
    className: 'w-full bg-transparent outline-none text-sm text-white leading-snug',
    style: { fontFamily: 'inherit', resize: 'none' },
  };

  if (editing) {
    return multiline
      ? <textarea {...sharedProps} rows={2} />
      : <input {...sharedProps} />;
  }

  return (
    <div onClick={() => setEditing(true)}
      className="cursor-text min-h-[20px] text-sm leading-snug"
      style={{
        color: val ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)',
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
      }}>
      {val || placeholder}
    </div>
  );
}

function LinkCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setVal(value || ''); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  function finish() {
    setEditing(false);
    if (val.trim() !== (value || '').trim()) onSave(val.trim());
  }

  if (editing) {
    return (
      <input ref={ref} value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={finish}
        onKeyDown={e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') { setVal(value || ''); setEditing(false); } }}
        placeholder="https://instagram.com/..."
        className="w-full bg-transparent outline-none text-sm"
        style={{ color: '#60a5fa', fontFamily: 'inherit' }} />
    );
  }

  if (value) {
    return (
      <div className="flex items-center gap-1 group/link" style={{ minWidth: 0 }}>
        <a href={value.startsWith('http') ? value : `https://instagram.com/${value.replace('@','')}`}
          target="_blank" rel="noopener noreferrer"
          className="text-sm truncate hover:underline flex-1"
          style={{ color: '#60a5fa', minWidth: 0 }}>
          {value.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')}
        </a>
        <ExternalLink size={10} className="flex-none opacity-50 group-hover/link:opacity-100 transition"
          style={{ color: '#60a5fa' }} />
        <button onClick={() => setEditing(true)}
          className="flex-none opacity-0 group-hover/link:opacity-60 transition text-xs mr-1"
          style={{ color: 'rgba(255,255,255,0.4)' }}>✎</button>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="cursor-text text-sm"
      style={{ color: 'rgba(255,255,255,0.2)' }}>+ לינק</div>
  );
}

function DateCell({ value, onSave, highlight = false }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.showPicker?.();
    }
  }, [editing]);

  return editing ? (
    <input ref={ref} type="date" defaultValue={value || ''}
      className="bg-transparent outline-none text-sm text-white w-[110px]"
      onChange={e => { onSave(e.target.value || null); setEditing(false); }}
      onBlur={() => setEditing(false)} />
  ) : (
    <div onClick={() => setEditing(true)}
      className="cursor-pointer text-sm whitespace-nowrap inline-flex items-center gap-1"
      style={highlight && !value ? {
        color: '#f59e0b',
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.35)',
        borderRadius: 6,
        padding: '2px 6px',
        animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
      } : { color: value ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)' }}>
      {highlight && !value ? <>⚠ קבע תאריך</> : value ? fmtDate(value) : '+ תאריך'}
    </div>
  );
}

function SelectCell({ value, options, onSave, placeholder = '— בחר —' }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, right: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const opt = options.find(o => o.value === value);

  function handleOpen() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const itemCount   = options.length + (value ? 1 : 0); // + "נקה בחירה" row
      const estHeight   = itemCount * 32 + 8; // ~32px per row + padding
      const spaceBelow  = window.innerHeight - r.bottom;
      const openUpward  = spaceBelow < estHeight + 12;
      setPos({
        top:   openUpward ? r.top - estHeight - 4 : r.bottom + 4,
        right: window.innerWidth - r.right,
      });
    }
    setOpen(o => !o);
  }

  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (
        dropRef.current    && !dropRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <>
      <div ref={triggerRef} onClick={handleOpen}
        className="cursor-pointer text-sm rounded-md px-2 py-0.5 inline-flex items-center whitespace-nowrap select-none"
        style={opt
          ? { color: opt.color, background: opt.bg, border: `1px solid ${opt.border}` }
          : { color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {value || placeholder}
      </div>
      {open && (
        <div ref={dropRef}
          style={{
            position: 'fixed', top: pos.top, right: pos.right,
            zIndex: 9999, minWidth: 170,
            background: 'rgb(var(--bg-elevated))',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.7)',
            borderRadius: 12, overflow: 'hidden', padding: '4px 0',
          }}>
          {value && (
            <button onClick={() => { onSave(''); setOpen(false); }}
              className="w-full text-right flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/5 transition"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span className="h-2 w-2 rounded-full flex-none" style={{ background: 'rgba(255,255,255,0.2)' }} />
              נקה בחירה
            </button>
          )}
          {options.map(o => (
            <button key={o.value} onClick={() => { onSave(o.value); setOpen(false); }}
              className="w-full text-right flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/5 transition"
              style={{ color: 'rgba(255,255,255,0.85)' }}>
              <span className="h-2 w-2 rounded-full flex-none" style={{ background: o.color }} />
              {o.value}
              {value === o.value && <span className="mr-auto" style={{ color: o.color }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function CheckCell({ value, onToggle, disabled = false }) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      title={disabled ? 'יש לסמן תחילה הזמנה לשיחת התאמה או שיחת מכירה' : undefined}
      className="h-[18px] w-[18px] rounded border-2 flex items-center justify-center transition-all mx-auto"
      style={{
        borderColor: disabled ? 'rgba(255,255,255,0.08)' : value ? '#22c55e' : 'rgba(255,255,255,0.18)',
        background:  disabled ? 'rgba(255,255,255,0.03)' : value ? '#22c55e' : 'transparent',
        cursor:      disabled ? 'not-allowed' : 'pointer',
        opacity:     disabled ? 0.3 : 1,
      }}>
      {value && !disabled && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function StarsCell({ value, onSave }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5 items-center" dir="rtl">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n}
          onClick={() => onSave(value === n ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110 focus:outline-none">
          <Star size={13}
            fill={(hover || value) >= n ? '#fbbf24' : 'none'}
            style={{ color: (hover || value) >= n ? '#fbbf24' : 'rgba(255,255,255,0.18)' }} />
        </button>
      ))}
    </div>
  );
}

// ── Column definitions ────────────────────────────────────────
const COLS = [
  { label: 'שם הליד',              w: 140 },
  { label: 'תאריך\nהתקשרות',      w: 105, sortKey: 'contact_date' },
  { label: 'אינסטגרם',             w: 100 },
  { label: 'סוג ליד',              w: 148 },
  { label: 'דירוג',                w: 108, sortKey: 'rating' },
  { label: 'תחום / סוג עסק',      w: 130 },
  { label: 'הערות על הליד',       w: 180 },
  { label: 'הזמנה\nלשיחת התאמה', w: 68, center: true },
  { label: 'הזמנה\nלשיחת מכירה', w: 68, center: true },
  { label: 'הופיע\nלשיחה',        w: 58, center: true },
  { label: 'מצב השיחה',           w: 128 },
  { label: 'תאריך\nהשיחה',        w: 105, sortKey: 'call_date' },
  { label: 'תאריך\nפולואפ',       w: 105, sortKey: 'followup_date' },
  { label: '',                     w: 36  },
];

// ── Main ──────────────────────────────────────────────────────
export default function Pipeline() {
  const { user } = useUser();
  const userId   = user?.id;
  const navigate = useNavigate();
  const dialog   = useDialog();

  const [leads,          setLeads]          = useState([]);
  const [selected,       setSelected]       = useState(new Set());
  const [newLeadId,      setNewLeadId]      = useState(null);
  const [editingLeadId,  setEditingLeadId]  = useState(null);
  const [loading,        setLoading]        = useState(true);
  const tableRef = useRef(null);
  const [dbError,        setDbError]        = useState(null);
  const [closedModal,    setClosedModal]    = useState(null); // { name, leadId }
  const [filters, setFilters] = useState({
    status:    'all',   // 'all' | call_status value
    minRating: 0,       // 0 = no filter, 1-5 = min stars
    source:    'all',   // 'all' | lead_source value
    sort:      'newest', // 'newest' | 'oldest' | 'rating_high' | 'rating_low'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend,  setShowLegend]  = useState(false);

  function setFilter(key, val) {
    setFilters(prev => ({ ...prev, [key]: val }));
  }

  function toggleSort(key) {
    setFilters(prev => {
      if (prev.sort === key + '_high' || prev.sort === key + '_asc') return { ...prev, sort: key + '_low' };
      if (prev.sort === key + '_low')  return { ...prev, sort: key + '_high' };
      if (prev.sort === 'newest')      return { ...prev, sort: 'oldest' };
      if (prev.sort === 'oldest')      return { ...prev, sort: 'newest' };
      return { ...prev, sort: key };
    });
  }

  function cycleDateSort() {
    setFilters(prev => ({
      ...prev,
      sort: prev.sort === 'newest' ? 'oldest' : 'newest',
    }));
  }

  function cycleColSort(sortKey) {
    setFilters(prev => {
      if (sortKey === 'rating') {
        if (prev.sort === 'rating_high') return { ...prev, sort: 'rating_low' };
        return { ...prev, sort: 'rating_high' };
      }
      // date columns
      if (prev.sort === sortKey + '_desc') return { ...prev, sort: sortKey + '_asc' };
      return { ...prev, sort: sortKey + '_desc' };
    });
  }

  const activeFilterCount = [
    filters.status !== 'all',
    filters.minRating > 0,
    filters.source !== 'all',
    filters.sort !== 'newest',
  ].filter(Boolean).length;

  useEffect(() => { if (userId) loadLeads(); }, [userId]);

  // Clear editing highlight when clicking outside the table
  useEffect(() => {
    function handleOutsideClick(e) {
      if (tableRef.current && !tableRef.current.contains(e.target)) {
        setEditingLeadId(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);


  // ── Follow-up notifications ───────────────────────────────────
  useEffect(() => {
    if (leads.length === 0) return;
    scheduleFollowupNotifications(leads);
  }, [leads]);

  async function scheduleFollowupNotifications(allLeads) {
    if (!('Notification' in window)) return;

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    const todayMs    = new Date(new Date().toDateString()).getTime();
    const tomorrowMs = todayMs + 86400000;

    const followups = allLeads.filter(l => l.call_status === 'פולואפ' && l.followup_date);

    followups.forEach(lead => {
      const dateMs  = new Date(lead.followup_date).getTime();
      const name    = lead.name || 'ליד';
      const storKey = `fu_notif_${lead.id}_${lead.followup_date}`;

      if (localStorage.getItem(storKey)) return; // already fired today

      let title = null;
      let body  = null;

      if (dateMs === todayMs) {
        title = '⏰ פולואפ היום!';
        body  = `זכור לעשות פולואפ עם ${name} היום`;
      } else if (dateMs === tomorrowMs) {
        title = '📅 פולואפ מחר';
        body  = `מחר יש לך פולואפ עם ${name}`;
      }

      if (title) {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          dir: 'rtl',
          lang: 'he',
          tag: storKey, // prevents duplicate toasts
        });
        localStorage.setItem(storKey, '1');

        // Also schedule a second reminder 3 hours from now if follow-up is today
        if (dateMs === todayMs) {
          setTimeout(() => {
            new Notification('🔔 תזכורת פולואפ', {
              body: `עוד מעט — פולואפ עם ${name}`,
              dir: 'rtl', lang: 'he',
            });
          }, 3 * 60 * 60 * 1000); // 3 hours
        }
      }
    });
  }

  async function loadLeads() {
    setLoading(true);
    setDbError(null);
    const { data, error } = await supabase
      .from('leads').select('*')
      
      .order('created_at', { ascending: false });
    if (error) setDbError(error.message);
    setLeads(data || []);
    setLoading(false);
  }

  async function addLead() {
    setDbError(null);
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...EMPTY_LEAD, user_id: userId })
      .select().single();
    if (error) {
      console.error('addLead error:', error);
      setDbError(error.message);
    } else if (data) {
      setLeads(prev => [data, ...prev]);
      setEditingLeadId(data.id);
      setNewLeadId(data.id);
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    }
  }

  async function updateLead(id, field, value) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

    // Auto-sort by date when a date field gets a value
    if (value) {
      if (field === 'contact_date') {
        setFilters(prev => ({ ...prev, sort: 'newest' }));
      } else if (field === 'call_date') {
        setFilters(prev => ({ ...prev, sort: 'call_date_desc' }));
      } else if (field === 'followup_date') {
        setFilters(prev => ({ ...prev, sort: 'followup_date_desc' }));
      }
    }

    await supabase.from('leads').update({ [field]: value }).eq('id', id);

    // When a lead is marked as closed → confetti + prompt to open a new client card
    if (field === 'call_status' && value === 'נסגר') {
      // Burst 1 — center explosion
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { x: 0.5, y: 0.55 },
        colors: ['#F5C118', '#22c55e', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c'],
        scalar: 1.1,
      });
      // Burst 2 — left side, slight delay
      setTimeout(() => confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#F5C118', '#22c55e', '#60a5fa'],
      }), 150);
      // Burst 3 — right side, slight delay
      setTimeout(() => confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#f472b6', '#a78bfa', '#fb923c'],
      }), 300);

      const lead = leads.find(l => l.id === id);
      setClosedModal({ name: lead?.name || '', leadId: id });
    }
  }

  async function deleteLead(id) {
    if (!await dialog.confirm('למחוק את הליד?', { title: 'מחיקת ליד', confirmText: 'מחיקה' })) return;
    setLeads(prev => prev.filter(l => l.id !== id));
    await supabase.from('leads').delete().eq('id', id);
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!await dialog.confirm(`למחוק ${selected.size} לידים? לא ניתן לבטל.`, { title: 'מחיקה מרוכזת', confirmText: 'מחק הכל' })) return;
    const ids = [...selected];
    setLeads(prev => prev.filter(l => !selected.has(l.id)));
    setSelected(new Set());
    await supabase.from('leads').delete().in('id', ids);
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(visibleIds) {
    const allSelected = visibleIds.every(id => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  const filtered = (() => {
    let arr = [...leads];
    if (filters.status !== 'all')  arr = arr.filter(l => l.call_status === filters.status);
    if (filters.minRating > 0)     arr = arr.filter(l => (l.rating || 0) >= filters.minRating);
    if (filters.source  !== 'all') arr = arr.filter(l => l.lead_source === filters.source);

    const dateVal = d => d ? new Date(d).getTime() : 0;
    switch (filters.sort) {
      case 'newest':
        arr.sort((a, b) => {
          // leads without contact_date float to the top (sorted by created_at among themselves)
          if (!a.contact_date && !b.contact_date)
            return new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime();
          if (!a.contact_date) return -1;
          if (!b.contact_date) return 1;
          return new Date(b.contact_date).getTime() - new Date(a.contact_date).getTime();
        });
        break;
      case 'oldest':
        arr.sort((a, b) => {
          // leads without contact_date sink to the bottom
          if (!a.contact_date && !b.contact_date)
            return new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime();
          if (!a.contact_date) return 1;
          if (!b.contact_date) return -1;
          return new Date(a.contact_date).getTime() - new Date(b.contact_date).getTime();
        });
        break;
      case 'rating_high':      arr.sort((a,b) => (b.rating||0) - (a.rating||0)); break;
      case 'rating_low':       arr.sort((a,b) => (a.rating||0) - (b.rating||0)); break;
      case 'call_date_desc':   arr.sort((a,b) => dateVal(b.call_date)     - dateVal(a.call_date));     break;
      case 'call_date_asc':    arr.sort((a,b) => dateVal(a.call_date)     - dateVal(b.call_date));     break;
      case 'followup_date_desc': arr.sort((a,b) => dateVal(b.followup_date) - dateVal(a.followup_date)); break;
      case 'followup_date_asc':  arr.sort((a,b) => dateVal(a.followup_date) - dateVal(b.followup_date)); break;
      default: break;
    }
    return arr;
  })();

  // Stats
  const closedCount   = leads.filter(l => l.call_status === 'נסגר').length;
  const followupCount = leads.filter(l => l.call_status === 'פולואפ').length;
  const noShowCount   = leads.filter(l => l.call_status === 'לא הגיע').length;
  const noFitCount    = leads.filter(l => l.call_status === 'אין התאמה').length;
  const total         = leads.length;

  // Close rate denominator: only leads that actually reached a sales call.
  // Booking a call isn't enough — they need to have shown up (sales_scheduled)
  // or been explicitly marked as no-show / closed / follow-up.
  // "אין התאמה" = successful filter, not a failed close — excluded.
  // Only leads who actually showed up (sales_scheduled=true) count toward close rate.
  // "לא הגיע" = no-show, excluded. "אין התאמה" = filtered out, excluded.
  const leadsWithCall  = leads.filter(l => l.sales_scheduled);
  const closePct       = leadsWithCall.length > 0 ? Math.round(closedCount / leadsWithCall.length * 100) : 0;

  // Show-up rate: showed up / any lead with any call booked (matching OR sales)
  const leadsWithSales   = leadsWithCall; // same denominator — any call booked
  const showedUpCount    = leads.filter(l => l.sales_scheduled).length;
  const showPct          = leadsWithCall.length > 0 ? Math.round(showedUpCount / leadsWithCall.length * 100) : 0;

  if (loading) return (
    <div className="space-y-2">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="h-10 rounded-lg animate-pulse"
          style={{ background: 'rgb(var(--bg-surface))' }} />
      ))}
    </div>
  );

  return (
    <div className="w-full space-y-5" dir="rtl">

      {/* ── Closed Lead Modal ── */}
      {closedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setClosedModal(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-5 text-right"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}>

            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-none"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <span className="text-xl">🎉</span>
              </div>
              <div>
                <div className="text-base font-bold text-white">עסקה נסגרה!</div>
                <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {closedModal.name || 'הליד'} הפך ללקוח
                </div>
              </div>
            </div>

            <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              האם לפתוח כרטייסת לקוח חדשה עבור{' '}
              <span className="font-semibold text-white">
                {closedModal.name || 'הליד'}
              </span>
              ?
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  navigate('/clients', { state: { openNewClient: true, prefillName: closedModal.name } });
                  setClosedModal(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition hover:opacity-90"
                style={{ background: '#22c55e', color: 'white', boxShadow: '0 4px 16px rgba(34,197,94,0.35)' }}>
                <UserPlus size={15} /> כן, פתח כרטייסת לקוח
              </button>
              <button
                onClick={() => setClosedModal(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                לא עכשיו
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">מעקב לידים</h1>
        <button onClick={addLead}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 bg-accent text-accent-foreground">
          <Plus size={15} /> ליד חדש
        </button>
      </div>

      {/* Error banner */}
      {dbError && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          <span className="text-base leading-none mt-0.5">⚠️</span>
          <div>
            <div className="font-semibold mb-0.5">שגיאת מסד נתונים</div>
            <div className="text-sm opacity-80 font-mono">{dbError}</div>
            <div className="text-sm mt-1.5 opacity-70">
              אם הטבלה לא קיימת, הרץ את ה-SQL ב-Supabase → SQL Editor
            </div>
          </div>
          <button onClick={() => setDbError(null)} className="mr-auto opacity-60 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* אחוז סגירה */}
        <div className="rounded-xl px-4 py-3 relative overflow-hidden"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            אחוז סגירה
            {leadsWithCall.length > 0 && <span className="font-normal opacity-60"> (מתוך {leadsWithCall.length} עם שיחה)</span>}
          </div>
          <div className="flex items-end gap-2">
            <span className="text-[26px] font-bold leading-none" style={{ color: '#22c55e' }}>{closePct}%</span>
            <span className="text-sm mb-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{closedCount}/{leadsWithCall.length}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full transition-all duration-700"
              style={{ width: `${closePct}%`, background: 'linear-gradient(to left, #22c55e, #16a34a)' }} />
          </div>
        </div>

        {/* אחוז הופעות */}
        <div className="rounded-xl px-4 py-3 relative overflow-hidden"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            אחוז הופעות לשיחה
            {leadsWithCall.length > 0 && <span className="font-normal opacity-60"> (מתוך {leadsWithCall.length} עם שיחה)</span>}
          </div>
          <div className="flex items-end gap-2">
            <span className="text-[26px] font-bold leading-none" style={{ color: '#60a5fa' }}>{showPct}%</span>
            <span className="text-sm mb-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{showedUpCount}/{leadsWithCall.length}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full transition-all duration-700"
              style={{ width: `${showPct}%`, background: 'linear-gradient(to left, #60a5fa, #3b82f6)' }} />
          </div>
        </div>

        {/* פולואפ */}
        <div className="rounded-xl px-4 py-3"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>🔄 פולואפ</div>
          <div className="text-[26px] font-bold leading-none" style={{ color: '#f59e0b' }}>{followupCount}</div>
        </div>

        {/* סה״כ לידים */}
        <div className="rounded-xl px-4 py-3"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>סה״כ לידים</div>
          <div className="text-[26px] font-bold leading-none" style={{ color: 'rgba(255,255,255,0.75)' }}>{total}</div>
        </div>
      </div>

      {/* Filter bar toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowFilters(p => !p)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition"
          style={{
            background: showFilters ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
            border: '1px solid ' + (showFilters ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'),
            color: showFilters ? 'white' : 'rgba(255,255,255,0.5)',
          }}>
          <SlidersHorizontal size={13} />
          סינון ומיון
          {activeFilterCount > 0 && (
            <span className="rounded-full text-xs font-bold px-1.5 py-0.5 leading-none"
              style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setShowLegend(p => !p)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition"
          style={{
            background: showLegend ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
            border: '1px solid ' + (showLegend ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'),
            color: showLegend ? '#fbbf24' : 'rgba(255,255,255,0.5)',
          }}>
          <Star size={12} fill={showLegend ? '#fbbf24' : 'none'}
            style={{ color: showLegend ? '#fbbf24' : 'rgba(255,255,255,0.4)' }} />
          מקרא דירוג כוכבים
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={() => setFilters({ status: 'all', minRating: 0, source: 'all', sort: 'newest' })}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <X size={11} /> נקה הכל
          </button>
        )}

        <span className="mr-auto text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {filtered.length === leads.length ? `${leads.length} לידים` : `${filtered.length} מתוך ${leads.length}`}
        </span>
      </div>

      {/* Rating legend panel */}
      {showLegend && (
        <div className="rounded-xl overflow-x-auto grid grid-cols-2 w-full sm:w-fit"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            {
              stars: 5, emoji: '🔥', label: 'רותח',
              color: '#ef4444', bg: 'rgba(239,68,68,0.1)',
              desc: 'התאמה + מגיב + מוכן עכשיו',
              action: 'קבע שיחה בהקדם האפשרי',
            },
            {
              stars: 4, emoji: '🥵', label: 'חם',
              color: '#f97316', bg: 'rgba(249,115,22,0.1)',
              desc: 'התאמה + מגיב + לא עכשיו',
              action: 'תייג + פולואפ חודשי + הצע תכנים',
            },
            {
              stars: 3, emoji: '🥶', label: 'קר',
              color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',
              desc: 'התאמה + לא מגיב',
              action: 'שלח תיק עבודות / VSL',
            },
            {
              stars: '1-2', emoji: '🧊', label: 'קפוא',
              color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',
              desc: 'לא בטוחים + לא מגיבים',
              action: 'דלגו, תמקדו במעלה',
            },
          ].map((row, i) => (
            <div key={row.label}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: row.bg,
                borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                borderLeft: i % 2 === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>

              {/* Stars + emoji */}
              <div className="flex items-center gap-2 flex-none w-28">
                <span className="text-base leading-none">{row.emoji}</span>
                <div className="flex gap-0.5 items-center" dir="ltr">
                  {typeof row.stars === 'number'
                    ? Array.from({ length: row.stars }).map((_, j) => (
                        <Star key={j} size={11} fill="#fbbf24" style={{ color: '#fbbf24' }} />
                      ))
                    : <>
                        <Star size={11} fill="#fbbf24" style={{ color: '#fbbf24' }} />
                        <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>-2</span>
                      </>
                  }
                </div>
                <span className="text-sm font-bold" style={{ color: row.color }}>{row.label}</span>
              </div>

              {/* Divider */}
              <div className="flex-none w-px h-6" style={{ background: 'rgba(255,255,255,0.07)' }} />

              {/* Description + action stacked */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white leading-snug">{row.desc}</div>
                <div className="text-sm mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <span style={{ color: row.color, marginLeft: 4 }}>→</span>{row.action}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl p-4 space-y-4"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Row 1: מיון + מצב שיחה */}
          <div className="flex flex-wrap gap-6">

            {/* מיון לפי תאריך */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.3)' }}>מיון לפי תאריך התקשרות</div>
              <div className="flex gap-1">
                {[
                  { v: 'newest', l: 'עדכני ראשון', icon: <ChevronDown size={11}/> },
                  { v: 'oldest', l: 'ישן ראשון',   icon: <ChevronUp size={11}/> },
                ].map(s => (
                  <button key={s.v} onClick={() => setFilter('sort', s.v)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition"
                    style={{
                      background: filters.sort === s.v ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid ' + (filters.sort === s.v ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'),
                      color: filters.sort === s.v ? 'white' : 'rgba(255,255,255,0.45)',
                    }}>
                    {s.icon}{s.l}
                  </button>
                ))}
              </div>
            </div>

            {/* מיון לפי דירוג */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.3)' }}>מיון לפי דירוג</div>
              <div className="flex gap-1">
                {[
                  { v: 'rating_high', l: 'גבוה ראשון' },
                  { v: 'rating_low',  l: 'נמוך ראשון' },
                ].map(s => (
                  <button key={s.v} onClick={() => setFilter('sort', s.v)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition"
                    style={{
                      background: filters.sort === s.v ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid ' + (filters.sort === s.v ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.07)'),
                      color: filters.sort === s.v ? '#fbbf24' : 'rgba(255,255,255,0.45)',
                    }}>
                    <Star size={11} fill={filters.sort === s.v ? '#fbbf24' : 'none'}
                      style={{ color: filters.sort === s.v ? '#fbbf24' : 'rgba(255,255,255,0.3)' }} />
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Row 2: מצב שיחה */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.3)' }}>מצב שיחה</div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { v: 'all',       l: 'הכל',          color: 'rgba(255,255,255,0.6)' },
                { v: 'נסגר',      l: '✅ נסגר',        color: '#22c55e' },
                { v: 'לא נסגר',   l: '🚷 לא נסגר',    color: '#f97316' },
                { v: 'פולואפ',    l: '🔄 פולואפ',      color: '#f59e0b' },
                { v: 'לא הגיע',   l: '❌ לא הגיע',     color: '#ef4444' },
                { v: 'אין התאמה', l: '🚫 אין התאמה',  color: '#94a3b8' },
              ].map(f => {
                const active = filters.status === f.v;
                return (
                  <button key={f.v} onClick={() => setFilter('status', f.v)}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                    style={{
                      background: active ? `${f.color}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? f.color + '55' : 'rgba(255,255,255,0.07)'}`,
                      color: active ? f.color : 'rgba(255,255,255,0.4)',
                    }}>
                    {f.l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: דירוג מינימלי */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              דירוג מינימלי {filters.minRating > 0 && <span style={{ color: '#fbbf24' }}>({filters.minRating}★ ומעלה)</span>}
            </div>
            <div className="flex gap-1 items-center">
              <button onClick={() => setFilter('minRating', 0)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                style={{
                  background: filters.minRating === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid ' + (filters.minRating === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'),
                  color: filters.minRating === 0 ? 'white' : 'rgba(255,255,255,0.4)',
                }}>הכל</button>
              <div className="flex gap-0.5 mr-1" dir="ltr">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setFilter('minRating', filters.minRating === n ? 0 : n)}
                    className="p-1 rounded transition hover:scale-110">
                    <Star size={16}
                      fill={n <= filters.minRating ? '#fbbf24' : 'none'}
                      style={{ color: n <= filters.minRating ? '#fbbf24' : 'rgba(255,255,255,0.2)' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 4: סוג פניה */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.3)' }}>סוג פניה</div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilter('source', 'all')}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                style={{
                  background: filters.source === 'all' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid ' + (filters.source === 'all' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'),
                  color: filters.source === 'all' ? 'white' : 'rgba(255,255,255,0.4)',
                }}>הכל</button>
              {SOURCE_OPTIONS.map(o => {
                const active = filters.source === o.value;
                return (
                  <button key={o.value} onClick={() => setFilter('source', active ? 'all' : o.value)}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                    style={{
                      background: active ? o.bg    : 'rgba(255,255,255,0.04)',
                      border:     `1px solid ${active ? o.border : 'rgba(255,255,255,0.07)'}`,
                      color:      active ? o.color : 'rgba(255,255,255,0.4)',
                    }}>
                    {o.value}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Table */}
      <div ref={tableRef} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgb(var(--bg-surface))' }}>
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table
            style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: `max(100%, ${36 + COLS.reduce((s, c) => s + c.w, 0)}px)` }}>

            {/* Header */}
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                {/* Select-all checkbox */}
                <th style={{ width: 36, minWidth: 36, padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                  <input type="checkbox" className="pipeline-cb"
                    checked={filtered.length > 0 && filtered.every(l => selected.has(l.id))}
                    onChange={() => toggleSelectAll(filtered.map(l => l.id))}
                    style={{ cursor:'pointer', width:15, height:15 }} />
                </th>
                {COLS.map((col, i) => {
                  const isDateCol  = col.sortKey && col.sortKey !== 'rating';
                  const isRatingCol = col.sortKey === 'rating';
                  const activeDateAsc  = filters.sort === col.sortKey + '_asc';
                  const activeDateDesc = filters.sort === col.sortKey + '_desc';
                  const activeRatingH  = filters.sort === 'rating_high';
                  const activeRatingL  = filters.sort === 'rating_low';
                  const activeDateMain = col.sortKey === 'contact_date'
                    ? (filters.sort === 'newest' || filters.sort === 'oldest')
                    : (activeDateAsc || activeDateDesc);
                  const isActive = isDateCol ? activeDateMain : (isRatingCol ? (activeRatingH || activeRatingL) : false);

                  return (
                    <th key={i}
                      onClick={col.sortKey ? () => {
                        if (isRatingCol) setFilter('sort', filters.sort === 'rating_high' ? 'rating_low' : 'rating_high');
                        else if (col.sortKey === 'contact_date') setFilter('sort', filters.sort === 'newest' ? 'oldest' : 'newest');
                        else cycleColSort(col.sortKey);
                      } : undefined}
                      style={{
                        width: col.w, minWidth: col.w,
                        padding: '10px 12px',
                        textAlign: col.center ? 'center' : 'right',
                        fontSize: 11, fontWeight: 600,
                        color: isActive ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
                        whiteSpace: 'pre-line', lineHeight: 1.3,
                        letterSpacing: '0.02em',
                        borderLeft: i < COLS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        cursor: col.sortKey ? 'pointer' : 'default',
                        userSelect: 'none',
                        transition: 'color 0.15s',
                      }}>
                      {col.sortKey ? (
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          <span style={{ opacity: isActive ? 1 : 0.3 }}>
                            {isRatingCol && (activeRatingH ? <ChevronDown size={10}/> : <ChevronUp size={10}/>)}
                            {isDateCol && col.sortKey === 'contact_date' && (filters.sort === 'oldest' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>)}
                            {isDateCol && col.sortKey !== 'contact_date' && (activeDateAsc ? <ChevronUp size={10}/> : <ChevronDown size={10}/>)}
                          </span>
                        </span>
                      ) : col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={COLS.length}
                    style={{ padding: '56px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    אין לידים — לחץ "+ ליד חדש" כדי להתחיל
                  </td>
                </tr>
              )}

              {filtered.map((lead, ri) => {
                const u = (f, v) => updateLead(lead.id, f, v);
                return (
                  <tr key={lead.id} className="group"
                    onClick={() => setEditingLeadId(lead.id)}
                    style={{ cursor: 'default',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: (selected.has(lead.id) || editingLeadId === lead.id)
                        ? 'rgba(245,193,24,0.07)'
                        : ri % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!selected.has(lead.id) && editingLeadId !== lead.id) e.currentTarget.style.background = 'rgba(255,255,255,0.035)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = (selected.has(lead.id) || editingLeadId === lead.id) ? 'rgba(245,193,24,0.07)' : ri % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'transparent'; }}>

                    {/* Checkbox */}
                    <td style={{ ...td(), textAlign:'center', width:36, minWidth:36 }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="pipeline-cb"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        style={{ cursor:'pointer', width:15, height:15 }} />
                    </td>

                    {/* שם */}
                    <td style={td()}>
                      <TextCell value={lead.name} onSave={v => u('name', v)} placeholder="שם ליד..."
                        defaultEditing={lead.id === newLeadId} />
                    </td>

                    {/* תאריך התקשרות */}
                    <td style={td()}>
                      <DateCell value={lead.contact_date} onSave={v => u('contact_date', v)} />
                    </td>

                    {/* אינסטגרם */}
                    <td style={td()}>
                      <LinkCell value={lead.instagram_link} onSave={v => u('instagram_link', v)} />
                    </td>

                    {/* סוג ליד */}
                    <td style={td()}>
                      <SelectCell value={lead.lead_source} options={SOURCE_OPTIONS}
                        onSave={v => u('lead_source', v)} placeholder="— סוג ליד —" />
                    </td>

                    {/* דירוג */}
                    <td style={td()}>
                      <StarsCell value={lead.rating || 0} onSave={v => u('rating', v)} />
                    </td>

                    {/* תחום */}
                    <td style={td()}>
                      <TextCell value={lead.business_type} onSave={v => u('business_type', v)} placeholder="תחום..." />
                    </td>

                    {/* הערות */}
                    <td style={{ ...td(), maxWidth: 180 }}>
                      <TextCell value={lead.notes} onSave={v => u('notes', v)} placeholder="הערות..." multiline />
                    </td>

                    {/* הזמנה לשיחת התאמה */}
                    <td style={tdC()}>
                      <CheckCell value={!!lead.matching_booked} onToggle={() => u('matching_booked', !lead.matching_booked)} />
                    </td>

                    {/* הזמנה לשיחת מכירה */}
                    <td style={tdC()}>
                      <CheckCell value={!!lead.sales_booked} onToggle={() => u('sales_booked', !lead.sales_booked)} />
                    </td>

                    {/* הופיע לשיחה */}
                    <td style={tdC()}>
                      <CheckCell
                        value={!!lead.sales_scheduled}
                        onToggle={() => u('sales_scheduled', !lead.sales_scheduled)}
                        disabled={!lead.matching_booked && !lead.sales_booked}
                      />
                    </td>

                    {/* מצב השיחה */}
                    <td style={td()}>
                      <SelectCell value={lead.call_status} options={CALL_STATUS_OPTIONS}
                        onSave={v => u('call_status', v)} placeholder="— מצב —" />
                    </td>

                    {/* תאריך השיחה */}
                    <td style={td()}>
                      <DateCell value={lead.call_date} onSave={v => u('call_date', v)} />
                    </td>

                    {/* תאריך פולואפ */}
                    <td style={td()}>
                      <DateCell
                        value={lead.followup_date}
                        onSave={v => u('followup_date', v)}
                        highlight={lead.call_status === 'פולואפ'}
                      />
                    </td>

                    {/* מחיקה */}
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <button onClick={() => deleteLead(lead.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-red-500/20"
                        style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <button onClick={addLead}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition hover:bg-white/[0.04]"
          style={{ color: 'rgba(255,255,255,0.28)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Plus size={13} /> הוסף ליד
        </button>
      </div>


      {/* ── Floating action bar ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-2xl"
          style={{ background:'rgba(19,21,42,0.97)', border:'1px solid rgba(245,193,24,0.3)', backdropFilter:'blur(12px)', boxShadow:'0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,193,24,0.15)' }}>
          <span className="text-sm font-semibold" style={{ color:'#F5C118' }}>
            {selected.size} נבחרו
          </span>
          <div style={{ width:1, height:18, background:'rgba(255,255,255,0.15)' }} />
          <button onClick={() => setSelected(new Set())}
            className="text-sm font-medium transition hover:opacity-80"
            style={{ color:'rgba(255,255,255,0.45)' }}>
            בטל בחירה
          </button>
          <button onClick={deleteSelected}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-90"
            style={{ background:'rgba(239,68,68,0.9)', color:'white' }}>
            <Trash2 size={14} /> מחק {selected.size}
          </button>
        </div>
      )}

    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────
function td() {
  return {
    padding: '8px 12px',
    verticalAlign: 'middle',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
    overflow: 'hidden',
  };
}
function tdC() {
  return {
    padding: '8px 6px',
    textAlign: 'center',
    verticalAlign: 'middle',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
  };
}
