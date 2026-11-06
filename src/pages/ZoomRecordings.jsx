import { useState, useEffect, useRef } from 'react';
import { useTrackPage } from '../hooks/useTrack.js';
import { useUser } from '@clerk/clerk-react';
import {
  ExternalLink, Loader2, Pencil, Check, X, Trash2, Sparkles,
  Plus, Link, Star, Search, ChevronDown, MoreVertical,
} from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

// ── Categories ─────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'standout',  label: 'לבלוט'      },
  { id: 'lead',      label: 'להוביל'     },
  { id: 'master',    label: 'לשלוט'      },
  { id: 'deliver',   label: 'לספק'       },
  { id: 'general',   label: 'כללי'       },
  { id: 'ai_systems',label: 'AI+Systems' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

// ── Hebrew helpers ─────────────────────────────────────────────
const MONTH_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
}
function fmtEndTime(d, min) {
  return new Date(new Date(d).getTime() + min * 60000).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
}
function fmtDayNum(d) {
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', timeZone: 'Asia/Jerusalem' });
}
function fmtMonthYear(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_HE[m-1]} ${y}`;
}
function fmtFullDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' });
}
function cleanTopic(t) {
  return (t || '').replace(/creative expert\s*[-–]\s*/i, '').trim() || t;
}

function getBadge(topic) {
  const t = (topic || '').toLowerCase();
  if (t.includes('מעבדת'))  return 'מעבדת יכולות';
  if (t.includes('שבועי'))  return 'פגישה שבועית';
  if (t.includes('masterclass') || t.includes('מאסטר')) return 'Masterclass';
  if (t.includes('check in') || t.includes("צ'ק אין")) return 'Check-in';
  return 'פגישה';
}
const TYPE_STYLES = {
  'מעבדת יכולות': { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.2)' },
  'פגישה שבועית': { color: '#F5C118', bg: 'rgba(245,193,24,0.12)',  border: 'rgba(245,193,24,0.2)'  },
};
function getTypeStyle(badge) {
  return TYPE_STYLES[badge] || { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' };
}

function groupByMonth(meetings) {
  const groups = {};
  meetings.forEach(m => {
    const d = new Date(m.start_time);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return groups;
}

// ── Category colors ────────────────────────────────────────────
const CAT_COLORS = {
  deliver:   { color: '#F5C118', bg: 'rgba(245,193,24,0.12)',   border: 'rgba(245,193,24,0.25)'   }, // צהוב
  standout:  { color: '#34d399', bg: 'rgba(52,211,153,0.12)',   border: 'rgba(52,211,153,0.25)'   }, // ירוק
  lead:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   border: 'rgba(96,165,250,0.25)'   }, // כחול
  master:    { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.25)'  }, // סגול
  ai_systems:{ color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',   border: 'rgba(148,163,184,0.2)'   }, // אפור
  general:   { color: 'rgba(255,255,255,0.75)', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.14)' }, // לבן
};
function getCatColor(id) { return CAT_COLORS[id] || CAT_COLORS.general; }

// ── Category badge — inline edit for admin ─────────────────────
function CategoryBadge({ uuid, category, isAdmin, onMetaUpdate }) {
  const [open, setBadgeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  const catLabel = CAT_MAP[category] || 'כללי';
  const cs = getCatColor(category);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setBadgeOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function handleSelect(cat) {
    setBadgeOpen(false);
    if (cat === category) return;
    const prev = category;
    onMetaUpdate(uuid, { category: cat });
    setSaving(true);
    try {
      const r = await fetch('/api/zoom/meta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ uuid, category: cat }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error('save failed');
    } catch {
      onMetaUpdate(uuid, { category: prev });
    } finally { setSaving(false); }
  }

  const sharedStyle = {
    fontSize: 11, fontWeight: 600,
    height: 19, lineHeight: '19px',
    paddingLeft: 7, paddingRight: 7,
    borderRadius: 4,
    background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`,
    letterSpacing: '0.02em',
  };

  if (!isAdmin) {
    return (
      <span className="inline-block select-none" style={sharedStyle}>{catLabel}</span>
    );
  }

  return (
    <div className="relative inline-block" ref={ref}>
      {/* padding enlarges click target without affecting badge visuals */}
      <button
        onClick={() => setBadgeOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', display: 'inline-flex', alignItems: 'center' }}
      >
        <span style={{
          ...sharedStyle, display: 'inline-flex', alignItems: 'center', gap: 3,
          border: `1px solid ${open ? cs.color : cs.border}`,
          transition: 'border-color 0.15s',
        }}>
          {saving ? <Loader2 size={9} className="animate-spin" /> : catLabel}
          <ChevronDown size={9} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', opacity: 0.5 }} />
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-30"
          style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', minWidth: 130, right: 0 }}>
          {CATEGORIES.map(c => {
            const cc = getCatColor(c.id);
            return (
              <button key={c.id} onClick={() => handleSelect(c.id)}
                className="w-full text-right px-3 py-1.5 transition hover:opacity-80 flex items-center gap-2"
                style={{
                  fontSize: 12, fontWeight: c.id === category ? 600 : 400,
                  color: c.id === category ? cc.color : 'rgba(255,255,255,0.65)',
                  background: c.id === category ? cc.bg : 'transparent',
                }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cc.color, flexShrink: 0 }} />
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Admin context menu ─────────────────────────────────────────
function AdminMenu({ uuid, topic, metaData, onMetaUpdate, onDelete, onEditTitle, onAddLink }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-md transition hover:opacity-70"
        style={{
          color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)',
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <MoreVertical size={14} />}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 rounded-xl overflow-visible z-30 shadow-2xl"
          style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', minWidth: 160 }}>
          <button onClick={() => { setOpen(false); onEditTitle(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-right hover:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <Pencil size={12} /> ערוך כותרת
          </button>
          <button onClick={() => { onAddLink(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-right hover:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <Plus size={12} /> הוסף קישור
          </button>
          <button onClick={() => { setOpen(false); onDelete(uuid); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-right hover:opacity-70 transition-opacity"
            style={{ color: 'rgba(252,165,165,0.7)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Trash2 size={12} /> הסתר הקלטה
          </button>
        </div>
      )}
    </div>
  );
}

// ── Single recording row (Scale20-style) ──────────────────────
function RecordingRow({ meeting, metaData = {}, onMetaUpdate, onDelete, isAdmin, isStarred, onToggleStar, starLoading }) {
  const [editing,   setEditing]   = useState(null);
  const [inputVal,  setInputVal]  = useState('');
  const [linkName,  setLinkName]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen,    setAiOpen]    = useState(false);

  const attachments  = metaData.attachments ?? (metaData.playbook_url ? [{ name: 'פלייבוק', url: metaData.playbook_url }] : []);
  const category     = metaData.category || 'general';
  const displayTitle = metaData.custom_title || cleanTopic(meeting.topic);
  const mp4File      = meeting.recording_files?.find(f => f.file_type === 'MP4' && f.play_url);
  const watchUrl     = mp4File?.play_url || meeting.share_url;
  const start        = fmtTime(meeting.start_time);
  const end          = fmtEndTime(meeting.start_time, meeting.duration || 0);
  const dateStr      = fmtFullDate(meeting.start_time);
  const dayNum       = fmtDayNum(meeting.start_time);

  async function saveAttachments(updated) {
    setSaving(true);
    try {
      const r = await fetch('/api/zoom/meta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ uuid: meeting.uuid, attachments: updated, playbook_url: null }),
      });
      const d = await r.json();
      if (d.ok) onMetaUpdate(meeting.uuid, { attachments: updated, playbook_url: null });
    } finally { setSaving(false); }
  }

  function addLink() {
    const url = inputVal.trim(), name = linkName.trim() || 'קישור';
    if (!url) return;
    saveAttachments([...attachments, { name, url }]);
    setEditing(null); setInputVal(''); setLinkName('');
  }

  async function fetchAiSummary() {
    setAiLoading(true);
    try {
      const r = await fetch('/api/zoom/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: meeting.uuid, start_time: meeting.start_time, topic: meeting.topic }),
      });
      const d = await r.json();
      if (d.summary) { setAiSummary(d.summary); setAiOpen(true); }
    } catch (e) { console.error('AI summary error:', e.message); }
    finally { setAiLoading(false); }
  }

  async function saveTitle() {
    setSaving(true);
    try {
      const r = await fetch('/api/zoom/meta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': ADMIN_ID || '' },
        body: JSON.stringify({ uuid: meeting.uuid, custom_title: inputVal.trim() || null }),
      });
      const d = await r.json();
      if (d.ok) onMetaUpdate(meeting.uuid, { custom_title: inputVal.trim() || null });
    } finally { setSaving(false); setEditing(null); }
  }

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex py-5 pr-1" style={{ gap: 0 }}>

        {/* Day number column — 48px, centered */}
        <div className="flex-none flex items-start justify-center pt-0.5" style={{ width: 48, minWidth: 48 }}>
          <span className="select-none" style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: 'rgba(255,255,255,0.85)' }}>
            {dayNum}
          </span>
        </div>

        {/* Content block — gap 20px from day column */}
        <div className="flex-1 min-w-0" style={{ paddingRight: 20 }}>

          {/* Category badge (inline edit for admin) */}
          <div className="mb-2">
            <CategoryBadge
              uuid={meeting.uuid}
              category={category}
              isAdmin={isAdmin}
              onMetaUpdate={onMetaUpdate}
            />
          </div>

          {/* Title */}
          {editing === 'title' ? (
            <div className="flex items-center gap-1.5 mb-1">
              <input autoFocus value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') saveTitle(); if (e.key==='Escape') setEditing(null); }}
                className="flex-1 min-w-0 rounded-md px-2 py-1 font-semibold text-white"
                style={{ fontSize: 17, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(245,193,24,0.4)', outline: 'none' }}
                dir="rtl" />
              <button onClick={saveTitle} disabled={saving}><Check size={14} style={{ color: '#F5C118' }} /></button>
              <button onClick={() => setEditing(null)}><X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
            </div>
          ) : (
            <p className="font-semibold text-white mb-1" style={{ fontSize: 17, lineHeight: 1.47 }}>{displayTitle}</p>
          )}

          {/* Date + time */}
          <p className="mb-3" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {dateStr} · {start} - {end}
          </p>

          {/* Links + actions row */}
          <div className="flex items-center flex-wrap" style={{ gap: 8 }}>

            {/* Watch button */}
            {watchUrl && (
              <a href={watchUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 transition hover:opacity-85"
                style={{ background: '#F5C118', color: '#13152A', fontSize: 13, fontWeight: 600, height: 32 }}>
                הקלטה <ExternalLink size={11} color="#13152A" />
              </a>
            )}

            {/* Attachments */}
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <a href={att.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 transition hover:opacity-85"
                  style={{ background: 'rgba(139,92,246,0.14)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.22)', fontSize: 13, fontWeight: 600, height: 32 }}>
                  <Link size={11} /> {att.name}
                </a>
                {isAdmin && (
                  <button onClick={() => saveAttachments(attachments.filter((_,i) => i!==idx))}
                    className="opacity-25 hover:opacity-60 transition-opacity">
                    <X size={11} style={{ color: '#fca5a5' }} />
                  </button>
                )}
              </div>
            ))}

            {/* Add link form */}
            {editing === 'new-link' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <input autoFocus value={linkName} onChange={e => setLinkName(e.target.value)}
                  placeholder="שם" dir="rtl"
                  className="rounded-md px-2 py-1 text-xs text-white"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', outline: 'none', width: 90 }} />
                <input value={inputVal} onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter') addLink(); if (e.key==='Escape') { setEditing(null); setInputVal(''); setLinkName(''); } }}
                  placeholder="https://..." dir="ltr"
                  className="rounded-md px-2 py-1 text-xs text-white"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', outline: 'none', width: 160 }} />
                <button onClick={addLink} disabled={saving}><Check size={13} style={{ color: '#F5C118' }} /></button>
                <button onClick={() => { setEditing(null); setInputVal(''); setLinkName(''); }}>
                  <X size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
              </div>
            )}

            {/* Notion summary */}
            {meeting.has_notion_summary && (
              <button
                onClick={aiSummary ? () => setAiOpen(o => !o) : fetchAiSummary}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 transition hover:opacity-80 disabled:opacity-40"
                style={{
                  height: 32, fontSize: 13,
                  color: aiOpen ? '#fde68a' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${aiOpen ? 'rgba(253,230,138,0.2)' : 'rgba(255,255,255,0.1)'}`,
                  background: aiOpen ? 'rgba(253,230,138,0.05)' : 'transparent',
                }}>
                {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {aiLoading ? 'טוען...' : aiOpen ? 'הסתר סיכום' : 'סיכום'}
              </button>
            )}

            {/* Star */}
            <button
              onClick={() => onToggleStar(meeting.uuid)}
              disabled={starLoading}
              title={isStarred ? 'הסר מהשמורות' : 'שמור'}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, transition: 'all 0.15s',
                background: isStarred ? 'rgba(245,193,24,0.1)' : 'transparent',
                border: `1px solid ${isStarred ? 'rgba(245,193,24,0.35)' : 'rgba(255,255,255,0.1)'}`,
                opacity: starLoading ? 0.4 : 1,
              }}>
              <Star size={13} fill={isStarred ? '#F5C118' : 'none'}
                style={{ color: '#F5C118', filter: isStarred ? 'drop-shadow(0 0 3px rgba(245,193,24,0.4))' : 'none' }} />
            </button>

            {/* Admin context menu */}
            {isAdmin && (
              <AdminMenu
                uuid={meeting.uuid}
                topic={meeting.topic}
                metaData={metaData}
                onMetaUpdate={onMetaUpdate}
                onDelete={onDelete}
                onEditTitle={() => { setInputVal(displayTitle); setEditing('title'); }}
                onAddLink={() => setEditing('new-link')}
              />
            )}
          </div>
        </div>
      </div>

      {/* AI summary panel */}
      {aiOpen && aiSummary && (
        <div className="pb-4" style={{ paddingRight: 68, paddingLeft: 8 }}>
          <div className="rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap"
            style={{ background: 'rgba(253,230,138,0.04)', border: '1px solid rgba(253,230,138,0.1)', color: 'rgba(255,255,255,0.7)' }}
            dir="rtl">
            {aiSummary}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function ZoomRecordings() {
  useTrackPage('פגישות');
  const { user }   = useUser();
  const isAdmin    = user?.id === ADMIN_ID;

  const [meetings,    setMeetings]    = useState([]);
  const [meta,        setMeta]        = useState({});
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activeTab,   setActiveTab]   = useState('recordings');
  const [upcoming,    setUpcoming]    = useState(null);
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState('all');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [sortOrder,   setSortOrder]   = useState('desc'); // 'desc' | 'asc'
  const [starred,     setStarred]     = useState(new Set());
  const [starLoading, setStarLoading] = useState(new Set());

  // Toolbar dropdown states
  const [catDropOpen,  setCatDropOpen]  = useState(false);
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const catDropRef  = useRef(null);
  const sortDropRef = useRef(null);

  useEffect(() => {
    function close(e) {
      if (catDropRef.current  && !catDropRef.current.contains(e.target))  setCatDropOpen(false);
      if (sortDropRef.current && !sortDropRef.current.contains(e.target)) setSortDropOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Load data
  useEffect(() => {
    setLoading(true);
    const favHeaders = user?.id ? { 'x-user-id': user.id } : {};
    Promise.all([
      fetch('/api/zoom/recordings').then(r => r.json()),
      fetch('/api/zoom/meta').then(r => r.json()).catch(() => ({})),
      fetch('/api/zoom/upcoming').then(r => r.json()).catch(() => []),
      user?.id
        ? fetch('/api/zoom/favorites', { headers: favHeaders }).then(r => r.json()).catch(() => ({ favorites: [] }))
        : Promise.resolve({ favorites: [] }),
    ])
      .then(([recordings, metaData, upcomingData, favData]) => {
        if (recordings.error) throw new Error(recordings.error);
        setMeetings(recordings.meetings || []);
        setMeta(metaData || {});
        setUpcoming(upcomingData?.meetings || (Array.isArray(upcomingData) ? upcomingData : []));
        const serverFavs = favData?.favorites || [];
        const localKey   = user?.id ? `starred_recordings_${user.id}` : null;
        let localFavs    = [];
        try { localFavs = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch {}
        setStarred(new Set([...serverFavs, ...localFavs]));
        if (user?.id && localFavs.length > 0) {
          Promise.all(localFavs.map(uuid =>
            fetch('/api/zoom/favorites', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
              body: JSON.stringify({ uuid }),
            }).catch(() => {})
          )).then(() => { try { localStorage.removeItem(localKey); } catch {} });
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  function handleMetaUpdate(uuid, updates) {
    setMeta(prev => ({ ...prev, [uuid]: { ...(prev[uuid] || {}), ...updates } }));
  }

  async function handleDelete(uuid) {
    if (!window.confirm('להסתיר את ההקלטה הזו מהרשימה?')) return;
    try {
      const r = await fetch(`/api/zoom/recordings/${uuid}`, {
        method: 'DELETE', headers: { 'x-admin-id': ADMIN_ID || '' },
      });
      const d = await r.json();
      if (d.ok) setMeetings(prev => prev.filter(m => m.uuid !== uuid));
    } catch (e) { console.error('Delete error:', e); }
  }

  async function toggleStar(uuid) {
    if (!user?.id) return;
    const isStarred = starred.has(uuid);
    setStarred(prev => { const n = new Set(prev); if (isStarred) n.delete(uuid); else n.add(uuid); return n; });
    setStarLoading(prev => new Set([...prev, uuid]));
    try {
      if (isStarred) {
        const r = await fetch(`/api/zoom/favorites/${encodeURIComponent(uuid)}`, {
          method: 'DELETE', headers: { 'x-user-id': user.id },
        });
        if (!r.ok) throw new Error();
      } else {
        const r = await fetch('/api/zoom/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
          body: JSON.stringify({ uuid }),
        });
        if (!r.ok) throw new Error();
      }
    } catch {
      setStarred(prev => { const n = new Set(prev); if (isStarred) n.add(uuid); else n.delete(uuid); return n; });
    } finally {
      setStarLoading(prev => { const n = new Set(prev); n.delete(uuid); return n; });
    }
  }

  // ── Filter + sort logic ───────────────────────────────────────
  const visibleMeetings = (() => {
    let list = activeTab === 'starred' ? meetings.filter(m => starred.has(m.uuid)) : meetings;
    if (onlyStarred) list = list.filter(m => starred.has(m.uuid));
    if (catFilter !== 'all') list = list.filter(m => (meta[m.uuid]?.category || 'general') === catFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m => (meta[m.uuid]?.custom_title || m.topic || '').toLowerCase().includes(q));
    }
    if (sortOrder === 'asc') list = [...list].reverse();
    return list;
  })();

  const filteredUpcoming = (() => {
    if (!upcoming) return null;
    if (!search.trim()) return upcoming;
    const q = search.trim().toLowerCase();
    return upcoming.filter(m => (m.topic || '').toLowerCase().includes(q));
  })();

  const grouped   = groupByMonth(visibleMeetings);
  const monthKeys = Object.keys(grouped).sort((a, b) => sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b));
  const hasFilters = search.trim() || catFilter !== 'all' || onlyStarred;

  function clearFilters() { setSearch(''); setCatFilter('all'); setOnlyStarred(false); }

  // ── Shared toolbar styles ──────────────────────────────────────
  const toolbarBtn = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    height: 42, paddingLeft: 14, paddingRight: 14,
    borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
    background: active ? 'rgba(245,193,24,0.1)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${active ? 'rgba(245,193,24,0.3)' : 'rgba(255,255,255,0.09)'}`,
    color: active ? '#F5C118' : 'rgba(255,255,255,0.6)',
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 size={26} className="animate-spin" style={{ color: 'rgba(255,255,255,0.18)' }} />
    </div>
  );

  if (error) return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-bold text-white">הקלטות ופגישות</h1>
      <div className="rounded-2xl p-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>שגיאה בטעינת הקלטות</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(252,165,165,0.6)' }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="w-full" dir="rtl" style={{ paddingTop: 28 }}>

      {/* ── Title ── */}
      <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ marginBottom: 24 }}>הקלטות ופגישות</h1>

      {/* ── Tabs ── */}
      <div className="flex gap-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
        {[
          { k: 'recordings', l: 'הקלטות',       count: meetings.length },
          { k: 'upcoming',   l: 'פגישות קרובות', count: upcoming?.length ?? null },
          { k: 'starred',    l: 'שמורות',        count: starred.size || null, icon: true },
        ].map(t => {
          const active = activeTab === t.k;
          return (
            <button key={t.k} onClick={() => setActiveTab(t.k)}
              className="pb-3 px-3 sm:px-4 text-sm font-semibold transition relative flex items-center gap-1.5 flex-none whitespace-nowrap"
              style={{ color: active ? 'white' : 'rgba(255,255,255,0.38)' }}>
              {t.icon && <Star size={12} fill={active ? '#F5C118' : 'none'} style={{ color: active ? '#F5C118' : 'rgba(255,255,255,0.35)' }} />}
              {t.l}
              {t.count !== null && t.count > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none"
                  style={{ background: active ? '#F5C118' : 'rgba(255,255,255,0.1)', color: active ? '#13152A' : 'rgba(255,255,255,0.5)' }}>
                  {t.count}
                </span>
              )}
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#F5C118' }} />}
            </button>
          );
        })}
      </div>

      {/* ── Upcoming tab ── */}
      {activeTab === 'upcoming' && (
        <div>
          {!filteredUpcoming && <p className="text-xs text-center py-10" style={{ color: 'rgba(255,255,255,0.2)' }}>טוען...</p>}
          {filteredUpcoming?.length === 0 && <p className="text-xs text-center py-10" style={{ color: 'rgba(255,255,255,0.2)' }}>אין פגישות קרובות</p>}
          {filteredUpcoming && (() => {
            const byMonth = {};
            filteredUpcoming.forEach(m => {
              const d = new Date(m.start_time);
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
              if (!byMonth[key]) byMonth[key] = [];
              byMonth[key].push(m);
            });
            return Object.keys(byMonth).sort().map(mk => {
              const items = byMonth[mk];
              return (
                <div key={mk} style={{ marginBottom: 32 }}>
                  <div className="flex items-center justify-between pb-2 mb-1"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {fmtMonthYear(mk)}
                    </span>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{items.length} פגישות</span>
                  </div>
                  {items.map(m => {
                    const ts2 = getTypeStyle(getBadge(m.topic || ''));
                    const s   = m.start_time ? new Date(m.start_time) : null;
                    const timeStr = s ? s.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jerusalem' }) : '';
                    const endTime = s && m.duration ? new Date(s.getTime()+m.duration*60000).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jerusalem'}) : '';
                    return (
                      <div key={m.id} className="flex" style={{ gap: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, paddingBottom: 20 }}>
                        <div className="flex-none flex items-start justify-center pt-0.5" style={{ width: 48 }}>
                          <span className="select-none" style={{ fontSize: 42, fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>
                            {s?.getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0" style={{ paddingRight: 20 }}>
                          <div style={{ marginBottom: 8 }}>
                            <span className="inline-block rounded select-none"
                              style={{ background: ts2.bg, color: ts2.color, border: `1px solid ${ts2.border}`, fontSize: 11, fontWeight: 600, height: 19, lineHeight: '19px', paddingLeft: 7, paddingRight: 7, borderRadius: 4, letterSpacing: '0.02em' }}>
                              {getBadge(m.topic || '')}
                            </span>
                          </div>
                          <p className="font-semibold text-white mb-1" style={{ fontSize: 17, lineHeight: 1.47 }}>{cleanTopic(m.topic || '')}</p>
                          {timeStr && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
                            {timeStr}{endTime ? ` - ${endTime}` : ''}{m.duration ? ` · ${m.duration} דק׳` : ''}
                          </p>}
                          {m.join_url && (
                            <a href={m.join_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 transition hover:opacity-85"
                              style={{ background: '#F5C118', color: '#13152A', fontSize: 13, fontWeight: 600, height: 32 }}>
                              הצטרף <ExternalLink size={11} color="#13152A" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* ── Recordings + Starred tabs ── */}
      {(activeTab === 'recordings' || activeTab === 'starred') && (
        <>
          {/* ── Toolbar ── */}
          <div style={{ marginBottom: 24 }}>
            {/* Row 1: all controls */}
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}>

              {/* Search — 360px fixed */}
              <div className="relative flex-none" style={{ width: 360, maxWidth: '100%' }}>
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(255,255,255,0.28)', pointerEvents: 'none' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="חיפוש הקלטות..."
                  dir="rtl"
                  style={{
                    width: '100%', height: 42, borderRadius: 10,
                    paddingRight: 36, paddingLeft: search ? 32 : 14,
                    fontSize: 13, outline: 'none',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-35 hover:opacity-60">
                    <X size={13} style={{ color: 'white' }} />
                  </button>
                )}
              </div>

              {/* Category dropdown — always visible */}
              <div className="relative flex-none" ref={catDropRef}>
                <button
                  onClick={() => { setCatDropOpen(o => !o); setSortDropOpen(false); }}
                  style={{ ...toolbarBtn(catFilter !== 'all'), minWidth: 150 }}
                >
                  <span>{catFilter !== 'all' ? CAT_MAP[catFilter] : 'כל הקטגוריות'}</span>
                  <ChevronDown size={12} style={{ transform: catDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
                {catDropOpen && (
                  <div className="absolute top-full mt-1.5 rounded-xl overflow-hidden shadow-2xl z-20"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', minWidth: 160, right: 0 }}>
                    {[{ id: 'all', label: 'כל הקטגוריות' }, ...CATEGORIES].map(c => (
                      <button key={c.id} onClick={() => { setCatFilter(c.id); setCatDropOpen(false); }}
                        className="w-full text-right px-3 py-2 text-xs transition hover:opacity-80"
                        style={{
                          color: catFilter === c.id ? '#F5C118' : 'rgba(255,255,255,0.65)',
                          background: catFilter === c.id ? 'rgba(245,193,24,0.07)' : 'transparent',
                          fontWeight: catFilter === c.id ? 600 : 400,
                        }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Starred toggle */}
              <button
                onClick={() => setOnlyStarred(o => !o)}
                style={toolbarBtn(onlyStarred)}
              >
                <Star size={13} fill={onlyStarred ? '#F5C118' : 'none'} style={{ color: onlyStarred ? '#F5C118' : 'rgba(255,255,255,0.5)' }} />
                מועדפים
              </button>

              {/* Sort dropdown */}
              <div className="relative flex-none" ref={sortDropRef}>
                <button
                  onClick={() => { setSortDropOpen(o => !o); setCatDropOpen(false); }}
                  style={{ ...toolbarBtn(false), minWidth: 140 }}
                >
                  <span>{sortOrder === 'desc' ? 'מהחדש לישן' : 'מהישן לחדש'}</span>
                  <ChevronDown size={12} style={{ transform: sortDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
                {sortDropOpen && (
                  <div className="absolute top-full mt-1.5 rounded-xl overflow-hidden shadow-2xl z-20"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', minWidth: 150, right: 0 }}>
                    {[{ v: 'desc', l: 'מהחדש לישן' }, { v: 'asc', l: 'מהישן לחדש' }].map(opt => (
                      <button key={opt.v} onClick={() => { setSortOrder(opt.v); setSortDropOpen(false); }}
                        className="w-full text-right px-3 py-2 text-xs transition hover:opacity-80"
                        style={{
                          color: sortOrder === opt.v ? '#F5C118' : 'rgba(255,255,255,0.65)',
                          background: sortOrder === opt.v ? 'rgba(245,193,24,0.07)' : 'transparent',
                          fontWeight: sortOrder === opt.v ? 600 : 400,
                        }}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Result count + clear */}
              {hasFilters && (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {visibleMeetings.length} הקלטות
                  </span>
                  <button onClick={clearFilters}
                    className="text-xs hover:opacity-80 transition"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                    נקה ×
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Empty states */}
          {monthKeys.length === 0 && activeTab === 'starred' && !hasFilters && (
            <div className="py-16 flex flex-col items-center gap-3">
              <Star size={32} style={{ color: 'rgba(255,255,255,0.08)' }} />
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>אין הקלטות שמורות</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>לחץ על הכוכב ליד הקלטה כדי לשמור אותה</p>
            </div>
          )}

          {monthKeys.length === 0 && hasFilters && (
            <div className="py-16 flex flex-col items-center gap-3">
              <Search size={30} style={{ color: 'rgba(255,255,255,0.08)' }} />
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>לא נמצאו הקלטות</p>
              <button onClick={clearFilters} className="text-xs hover:opacity-80 transition" style={{ color: '#F5C118' }}>
                נקה סינונים
              </button>
            </div>
          )}

          {/* Month groups */}
          {monthKeys.map(monthKey => {
            const rows = grouped[monthKey];
            return (
              <div key={monthKey} style={{ marginBottom: 32 }}>
                {/* Month header */}
                <div className="flex items-center justify-between pb-2 mb-1"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {fmtMonthYear(monthKey)}
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                    {rows.length} הקלטות
                  </span>
                </div>

                {/* Recordings */}
                {rows.map(m => (
                  <RecordingRow
                    key={m.uuid}
                    meeting={m}
                    metaData={meta[m.uuid] || {}}
                    onMetaUpdate={handleMetaUpdate}
                    onDelete={handleDelete}
                    isAdmin={isAdmin}
                    isStarred={starred.has(m.uuid)}
                    onToggleStar={toggleStar}
                    starLoading={starLoading.has(m.uuid)}
                  />
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
