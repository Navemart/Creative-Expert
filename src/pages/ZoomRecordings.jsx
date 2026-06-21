import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  ExternalLink, ChevronDown, ChevronUp,
  Video, Loader2, Pencil, Check, X, BookOpen, Trash2, Sparkles, Plus, Link, Star,
} from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

// ── Hebrew helpers ────────────────────────────────────────────
const MONTH_HE = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];
const DAY_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  });
}

function fmtEndTime(dateStr, durationMin) {
  return new Date(new Date(dateStr).getTime() + durationMin * 60_000)
    .toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
}

function fmtDayNum(dateStr) {
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', timeZone: 'Asia/Jerusalem' });
}

function fmtFullDate(dateStr) {
  const d = new Date(dateStr);
  const day   = d.toLocaleDateString('he-IL', { day: 'numeric',   timeZone: 'Asia/Jerusalem' });
  const month = d.toLocaleDateString('he-IL', { month: 'long',    timeZone: 'Asia/Jerusalem' });
  const year  = d.toLocaleDateString('he-IL', { year:  'numeric', timeZone: 'Asia/Jerusalem' });
  return `${DAY_HE[d.getDay()]} ${day} ${month} ${year}`;
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
  'מעבדת יכולות': {
    color:       '#34d399',
    badgeBg:     'rgba(52,211,153,0.1)',
    badgeBorder: 'rgba(52,211,153,0.22)',
    rowBorder:   '#34d399',
  },
  'פגישה שבועית': {
    color:       '#F5C118',
    badgeBg:     'rgba(245,193,24,0.12)',
    badgeBorder: 'rgba(245,193,24,0.2)',
    rowBorder:   '#F5C118',
  },
};
function getTypeStyle(badge) {
  return TYPE_STYLES[badge] || {
    color:       '#a78bfa',
    badgeBg:     'rgba(167,139,250,0.1)',
    badgeBorder: 'rgba(167,139,250,0.2)',
    rowBorder:   '#a78bfa',
  };
}

function cleanTopic(topic) {
  return (topic || '').replace(/creative expert\s*[-–]\s*/i, '').trim() || topic;
}

function groupByMonth(meetings) {
  const groups = {};
  meetings.forEach(m => {
    const d   = new Date(m.start_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = {};
    const day = fmtDayNum(m.start_time);
    if (!groups[key][day]) groups[key][day] = [];
    groups[key][day].push(m);
  });
  return groups;
}

// ── Single recording row ───────────────────────────────────────
function RecordingRow({ meeting, metaData = {}, onMetaUpdate, onDelete, isAdmin, isStarred, onToggleStar }) {
  const [editing,   setEditing]   = useState(null); // null | 'title' | 'new-link'
  const [inputVal,  setInputVal]  = useState('');
  const [linkName,  setLinkName]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen,    setAiOpen]    = useState(false);
  const [aiTried,   setAiTried]   = useState(false);

  // Attachments: backward compatible with old playbook_url
  const attachments = metaData.attachments ?? (
    metaData.playbook_url ? [{ name: 'פלייבוק', url: metaData.playbook_url }] : []
  );

  async function saveAttachments(updated) {
    setSaving(true);
    try {
      const r = await fetch('/api/zoom/meta', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': import.meta.env.VITE_ADMIN_USER_ID || '' },
        body:    JSON.stringify({ uuid: meeting.uuid, attachments: updated, playbook_url: null }),
      });
      const d = await r.json();
      if (d.ok) onMetaUpdate(meeting.uuid, { attachments: updated, playbook_url: null });
    } finally { setSaving(false); }
  }

  function addLink() {
    const url = inputVal.trim();
    const name = linkName.trim() || 'קישור';
    if (!url) return;
    const updated = [...attachments, { name, url }];
    saveAttachments(updated);
    setEditing(null); setInputVal(''); setLinkName('');
  }

  function removeLink(idx) {
    saveAttachments(attachments.filter((_, i) => i !== idx));
  }

  async function fetchAiSummary() {
    setAiLoading(true);
    setAiTried(true);
    try {
      const r = await fetch('/api/zoom/ai-summary', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uuid: meeting.uuid, start_time: meeting.start_time, topic: meeting.topic }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      if (d.summary) { setAiSummary(d.summary); setAiOpen(true); }
    } catch (e) {
      console.error('AI summary error:', e.message);
    } finally {
      setAiLoading(false);
    }
  }

  const badge        = getBadge(meeting.topic);
  const ts           = getTypeStyle(badge);
  const displayTitle = metaData.custom_title || cleanTopic(meeting.topic);
  const playbookUrl  = metaData.playbook_url  || null;

  const mp4File  = meeting.recording_files?.find(f => f.file_type === 'MP4' && f.play_url);
  const watchUrl = mp4File?.play_url || meeting.share_url;

  const start    = fmtTime(meeting.start_time);
  const end      = fmtEndTime(meeting.start_time, meeting.duration || 0);
  const fullDate = fmtFullDate(meeting.start_time);

  function startEdit(field) {
    setInputVal(
      field === 'title'
        ? (metaData.custom_title || cleanTopic(meeting.topic))
        : (metaData.playbook_url || '')
    );
    setEditing(field);
  }

  async function save(field) {
    setSaving(true);
    const updates =
      field === 'title'
        ? { custom_title: inputVal.trim() || null }
        : { playbook_url: inputVal.trim() || null };
    try {
      const r = await fetch('/api/zoom/meta', {
        method:  'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id':   import.meta.env.VITE_ADMIN_USER_ID || '',
        },
        body:    JSON.stringify({ uuid: meeting.uuid, ...updates }),
      });
      const d = await r.json();
      if (d.ok) onMetaUpdate(meeting.uuid, updates);
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  function cancel() { setEditing(null); }

  function onKey(e, field) {
    if (e.key === 'Enter')  save(field);
    if (e.key === 'Escape') cancel();
  }

  return (
    <div className="relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', borderRight: `3px solid ${ts.rowBorder}` }}>
    <div className="flex items-center gap-3 py-4 pr-3">
      {/* Right: badge + title + date */}
      <div className="flex-1 min-w-0">
        <div className="mb-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: ts.badgeBg, color: ts.color, border: `1px solid ${ts.badgeBorder}` }}
          >
            {badge}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full flex-none" style={{ background: ts.color }} />

          {editing === 'title' ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input autoFocus value={inputVal} onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => onKey(e, 'title')}
                className="flex-1 min-w-0 rounded-md px-2 py-0.5 text-sm font-semibold text-white"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(245,193,24,0.4)', outline: 'none' }}
                dir="rtl" />
              <button onClick={() => save('title')} disabled={saving} className="hover:opacity-80 transition-opacity">
                <Check size={14} style={{ color: '#F5C118' }} />
              </button>
              <button onClick={cancel} className="hover:opacity-80 transition-opacity">
                <X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-white leading-snug truncate">{displayTitle}</span>
              {isAdmin && (
                <button onClick={() => startEdit('title')}
                  className="flex-none opacity-25 hover:opacity-60 transition-opacity"
                  title="ערוך שם" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-xs mt-0.5 pr-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {fullDate} · {start} - {end}
        </p>

        {/* Action buttons — below title */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap pr-4">

        {/* Recording button */}
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition hover:opacity-85"
          style={{ background: '#F5C118', color: '#13152A', WebkitTextFillColor: '#13152A' }}
        >
          הקלטה
          <ExternalLink size={12} color="#13152A" />
        </a>

        {/* Attachments — multiple links */}
        {attachments.map((att, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <a
              href={att.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition hover:opacity-85"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}
            >
              <Link size={11} />
              {att.name}
            </a>
            {isAdmin && (
              <button onClick={() => removeLink(idx)}
                className="p-1 opacity-25 hover:opacity-60 transition-opacity rounded"
                style={{ color: '#fca5a5' }}>
                <X size={11} />
              </button>
            )}
          </div>
        ))}

        {/* Add link — admin only */}
        {isAdmin && editing === 'new-link' ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <input autoFocus value={linkName} onChange={e => setLinkName(e.target.value)}
              placeholder="שם (פלייבוק, מצגת...)"
              className="rounded-md px-2 py-1 text-xs text-white"
              style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', outline:'none', width:130 }}
              dir="rtl" />
            <input value={inputVal} onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') addLink(); if (e.key==='Escape') { setEditing(null); setInputVal(''); setLinkName(''); } }}
              placeholder="https://..."
              className="rounded-md px-2 py-1 text-xs text-white"
              style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', outline:'none', width:200 }}
              dir="ltr" />
            <button onClick={addLink} disabled={saving} className="hover:opacity-80 transition-opacity">
              <Check size={14} style={{ color: '#F5C118' }} />
            </button>
            <button onClick={() => { setEditing(null); setInputVal(''); setLinkName(''); }} className="hover:opacity-80 transition-opacity">
              <X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            </button>
          </div>
        ) : isAdmin ? (
          <button
            onClick={() => setEditing('new-link')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
            style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Plus size={11} />
            הוסף קישור
          </button>
        ) : null}

        {/* Notion summary — shown only when a Notion page exists for this recording */}
        {meeting.has_notion_summary && (
          aiSummary ? (
            <button
              onClick={() => setAiOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
              style={{
                color:      aiOpen ? '#fde68a' : 'rgba(255,255,255,0.45)',
                border:     `1px solid ${aiOpen ? 'rgba(253,230,138,0.25)' : 'rgba(255,255,255,0.1)'}`,
                background: aiOpen ? 'rgba(253,230,138,0.06)' : 'transparent',
              }}
            >
              <Sparkles size={11} />
              {aiOpen ? 'הסתר סיכום' : 'סיכום'}
            </button>
          ) : (
            <button
              onClick={fetchAiSummary}
              disabled={aiLoading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-40"
              style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {aiLoading ? 'טוען...' : 'סיכום'}
            </button>
          )
        )}

        </div>
      </div>

      {/* Corner: star + trash */}
      <div className="absolute top-2 left-2 flex flex-row gap-1">
        <button
          onClick={() => onToggleStar(meeting.uuid)}
          className="rounded-md p-1.5 transition hover:opacity-80"
          title={isStarred ? 'הסר מהשמורות' : 'שמור הקלטה'}
          style={{
            background: isStarred ? 'rgba(245,193,24,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isStarred ? 'rgba(245,193,24,0.4)' : 'rgba(245,193,24,0.25)'}`,
          }}
        >
          <Star size={16} fill={isStarred ? '#F5C118' : 'none'}
            style={{ color: '#F5C118', filter: isStarred ? 'drop-shadow(0 0 4px rgba(245,193,24,0.5))' : 'none' }} />
        </button>
        {isAdmin && (
          <button
            onClick={() => onDelete(meeting.uuid)}
            className="rounded-md p-1.5 transition hover:opacity-80"
            title="הסתר הקלטה"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(252,165,165,0.2)' }}
          >
            <Trash2 size={16} style={{ color: 'rgba(252,165,165,0.5)' }} />
          </button>
        )}
      </div>
    </div>

    {/* AI Companion summary panel */}
    {aiOpen && aiSummary && (
      <div
        className="mx-4 mt-1 mb-2 rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap"
        style={{
          background: 'rgba(253,230,138,0.04)',
          border:     '1px solid rgba(253,230,138,0.12)',
          color:      'rgba(255,255,255,0.75)',
        }}
        dir="rtl"
      >
        {aiSummary}
      </div>
    )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function ZoomRecordings() {
  const { user }    = useUser();
  const isAdmin     = user?.id === ADMIN_ID;

  const [meetings,  setMeetings]  = useState([]);
  const [meta,      setMeta]      = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [activeTab, setActiveTab] = useState('all');
  const [starred,   setStarred]   = useState(() => {
    try {
      const key = user?.id ? `starred_recordings_${user.id}` : null;
      if (!key) return new Set();
      return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch(e) { return new Set(); }
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/zoom/recordings').then(r => r.json()),
      fetch('/api/zoom/meta').then(r => r.json()).catch(() => ({})),
    ])
      .then(([recordings, metaData]) => {
        if (recordings.error) throw new Error(recordings.error);
        setMeetings(recordings.meetings || []);
        setMeta(metaData || {});
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleMetaUpdate(uuid, updates) {
    setMeta(prev => ({
      ...prev,
      [uuid]: { ...(prev[uuid] || {}), ...updates },
    }));
  }

  async function handleDelete(uuid) {
    if (!window.confirm('להסתיר את ההקלטה הזו מהרשימה?')) return;
    try {
      const r = await fetch(`/api/zoom/recordings/${uuid}`, {
        method: 'DELETE',
        headers: { 'x-admin-id': import.meta.env.VITE_ADMIN_USER_ID || '' },
      });
      const d = await r.json();
      if (d.ok) setMeetings(prev => prev.filter(m => m.uuid !== uuid));
    } catch (e) {
      console.error('Delete error:', e);
    }
  }

  function toggleMonth(key) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }));
  }

  function toggleStar(uuid) {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid); else next.add(uuid);
      try {
        const key = user?.id ? `starred_recordings_${user.id}` : null;
        if (key) localStorage.setItem(key, JSON.stringify([...next]));
      } catch(e) {}
      return next;
    });
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 size={26} className="animate-spin" style={{ color: 'rgba(255,255,255,0.18)' }} />
    </div>
  );

  // ── Error ────────────────────────────────────────────────────
  if (error) return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-white">הקלטות</h1>
      <div className="rounded-2xl p-6"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>שגיאה בטעינת הקלטות</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(252,165,165,0.6)' }}>{error}</p>
        <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          וודא שהוספת את פרטי ה-Zoom בקובץ ה-.env:
          ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
        </p>
      </div>
    </div>
  );

  const visibleMeetings = activeTab === 'starred'
    ? meetings.filter(m => starred.has(m.uuid))
    : meetings;

  const grouped   = groupByMonth(visibleMeetings);
  const monthKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // ── Main render ──────────────────────────────────────────────
  return (
    <div className="w-full space-y-2" dir="rtl">

      {/* Page title */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">הקלטות</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {meetings.length} הקלטות · Creative Expert
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {[
          { k: 'all',     l: 'כל ההקלטות' },
          { k: 'starred', l: `שמורות${starred.size > 0 ? ` (${starred.size})` : ''}`, icon: true },
        ].map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)}
            className="pb-3 px-4 text-sm font-semibold transition-all relative flex items-center gap-1.5"
            style={{ color: activeTab === t.k ? 'white' : 'rgba(255,255,255,0.35)' }}>
            {t.icon && <Star size={12} fill={activeTab === t.k ? '#F5C118' : 'none'} style={{ color: activeTab === t.k ? '#F5C118' : 'rgba(255,255,255,0.35)' }} />}
            {t.l}
            {activeTab === t.k && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#F5C118' }} />
            )}
          </button>
        ))}
      </div>

      {/* Empty state for starred tab */}
      {monthKeys.length === 0 && activeTab === 'starred' && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Star size={36} style={{ color: 'rgba(255,255,255,0.1)' }} />
          <p className="text-sm font-semibold text-white">אין הקלטות שמורות</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>לחץ על הכוכב ליד הקלטה כדי לשמור אותה כאן</p>
        </div>
      )}

      {/* Month groups */}
      {monthKeys.map(monthKey => {
        const [year, month] = monthKey.split('-').map(Number);
        const monthLabel    = `${MONTH_HE[month - 1]} ${year}`;
        const isCollapsed   = collapsed[monthKey];
        const dayMap        = grouped[monthKey];
        const days          = Object.keys(dayMap).sort((a, b) => Number(b) - Number(a));

        return (
          <div key={monthKey}>
            {/* Month header */}
            <button
              onClick={() => toggleMonth(monthKey)}
              className="w-full flex items-center gap-2 py-3 text-right transition hover:opacity-80"
            >
              {isCollapsed
                ? <ChevronDown size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
                : <ChevronUp   size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
              }
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {monthLabel}
              </span>
            </button>

            {!isCollapsed && (
              <div
                className="rounded-2xl overflow-hidden mb-4"
                style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {days.map((day, dayIdx) => {
                  const dayMeetings = dayMap[day];
                  return (
                    <div
                      key={day}
                      className="flex gap-0"
                      style={{ borderTop: dayIdx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                    >
                      {/* Large day number */}
                      <div
                        className="flex-none flex items-center pl-6 pr-3"
                        style={{ width: 96 }}
                      >
                        <span
                          className="text-5xl font-bold leading-none select-none"
                          style={{ color: 'rgba(255,255,255,0.15)' }}
                        >
                          {day}
                        </span>
                      </div>

                      {/* Recordings */}
                      <div
                        className="flex-1 min-w-0 pl-4"
                        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        {dayMeetings.map(m => (
                          <RecordingRow
                            key={m.uuid}
                            meeting={m}
                            metaData={meta[m.uuid] || {}}
                            onMetaUpdate={handleMetaUpdate}
                            onDelete={handleDelete}
                            isAdmin={isAdmin}
                            isStarred={starred.has(m.uuid)}
                            onToggleStar={toggleStar}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
