import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { RefreshCw, Filter, X } from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const PAGE_LABELS = {
  '/':                         'דשבורד',
  '/analytics':                'נתונים עסקיים',
  '/pipeline':                 'לידים ומכירות',
  '/clients':                  'לקוחות ופרויקטים',
  '/content':                  'תוכן',
  '/recordings':               'פגישות',
  '/roadmap':                  'מפת דרכים',
  '/agents':                   'AI ScaleKit',
  '/calculator':               'מחשבון תמחור',
  '/transcriptions':           'תמלול',
  '/tasks':                    'מארגן משימות',
  '/self-audit/quarterly':     'אבחון רבעוני',
  '/self-audit/expertise-engine': 'מנוע מומחיות',
  '/members':                  'חברים',
  '/settings':                 'הגדרות',
};

const EVENT_LABELS = {
  page_view:             'צפייה בעמוד',
  deal_submitted:        'עסקה חדשה',
  monthly_submitted:     'נתונים חודשיים',
  win_submitted:         'ניצחונות שבועיים',
  lead_added:            'ליד חדש',
  task_created:          'משימה נוצרה',
  task_completed:        'משימה הושלמה',
  recording_viewed:      'צפייה בהקלטה',
  summary_opened:        'פתיחת סיכום',
};

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function badge(event) {
  const colors = {
    page_view:         { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
    deal_submitted:    { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
    monthly_submitted: { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
    win_submitted:     { bg: 'rgba(245,193,24,0.15)',  color: '#F5C118' },
    lead_added:        { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    task_created:      { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
    task_completed:    { bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
    recording_viewed:  { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
    summary_opened:    { bg: 'rgba(236,72,153,0.15)', color: '#f472b6' },
  };
  const c = colors[event] || { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' };
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 6, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {EVENT_LABELS[event] || event}
    </span>
  );
}

export default function AdminEvents() {
  const { user } = useUser();
  const isAdmin = user?.id === ADMIN_ID;

  const [events, setEvents]     = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState({ user: '', event: '', page: '', from: '', to: '' });
  const [hideAdmin, setHideAdmin] = useState(true);
  const [tab, setTab]           = useState('table'); // 'table' | 'stats'

  const headers = { 'x-admin-id': user?.id || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.user)  params.set('user',  filters.user);
    if (filters.event) params.set('event', filters.event);
    if (filters.page)  params.set('page',  filters.page);
    if (filters.from)  params.set('from',  filters.from);
    if (filters.to)    params.set('to',    filters.to);
    params.set('limit', '300');

    const [evRes, stRes] = await Promise.all([
      fetch(`/api/events?${params}`, { headers }),
      fetch('/api/events/stats', { headers }),
    ]);
    const evData  = await evRes.json();
    const stData  = await stRes.json();
    setEvents(evData.events || []);
    setStats(stData);
    setLoading(false);
  }, [filters, user?.id]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  async function toggleIgnore(id, current) {
    await fetch(`/api/events/${id}/ignore`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignore_on: !current }),
    });
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ignore_on: !current } : e));
  }

  if (!isAdmin) return <div style={{ color: 'rgba(255,255,255,0.4)', padding: 40, textAlign: 'center' }}>גישה מוגבלת</div>;

  const visibleEvents = hideAdmin ? events.filter(ev => ev.clerk_user_id !== ADMIN_ID) : events;

  const cell = { padding: '10px 12px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle', whiteSpace: 'nowrap' };
  const th   = { ...cell, color: 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgb(var(--bg-elevated))' };

  return (
    <div dir="rtl" style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>אירועי משתמשים</h1>
          {stats && (
            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {stats.uniqueUsers} משתמשים פעילים · {visibleEvents.length} אירועים מוצגים
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {['table', 'stats'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: tab === t ? 'rgba(245,193,24,0.15)' : 'transparent', color: tab === t ? '#F5C118' : 'rgba(255,255,255,0.5)' }}>
              {t === 'table' ? 'טבלה' : 'סטטיסטיקות'}
            </button>
          ))}
            <button onClick={() => setHideAdmin(v => !v)}
            style={{ padding: '6px 14px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: hideAdmin ? 'rgba(239,68,68,0.12)' : 'transparent', color: hideAdmin ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
            {hideAdmin ? 'מסתיר אדמין' : 'הצג אדמין'}
          </button>
          <button onClick={load} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: 'user',  placeholder: 'User ID', width: 220 },
          { key: 'event', placeholder: 'סוג אירוע', width: 160 },
          { key: 'page',  placeholder: 'עמוד (/path)', width: 160 },
          { key: 'from',  placeholder: 'מתאריך', type: 'date', width: 150 },
          { key: 'to',    placeholder: 'עד תאריך', type: 'date', width: 150 },
        ].map(({ key, placeholder, type = 'text', width }) => (
          <input key={key} type={type} placeholder={placeholder} value={filters[key]}
            onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
            style={{ width, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgb(var(--bg-surface))', color: 'white', fontSize: '0.75rem', outline: 'none' }}
          />
        ))}
        <button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, background: '#F5C118', color: '#13152A', fontWeight: 700, fontSize: '0.75rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} /> סנן
        </button>
        <button onClick={() => { setFilters({ user: '', event: '', page: '', from: '', to: '' }); }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <X size={12} /> נקה
        </button>
      </div>

      {tab === 'table' && (
        <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ID', 'משתמש', 'ignore_on', 'אירוע', 'עמוד', 'metadata', 'session', 'תאריך', ''].map(h => (
                    <th key={h} style={{ ...th, textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ ...cell, textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>טוען...</td></tr>
                ) : events.length === 0 ? (
                  <tr><td colSpan={9} style={{ ...cell, textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>אין אירועים</td></tr>
                ) : visibleEvents.map(ev => (
                  <tr key={ev.id} style={{ background: ev.ignore_on ? 'rgba(255,255,255,0.02)' : 'transparent', opacity: ev.ignore_on ? 0.4 : 1 }}>
                    <td style={cell}><span style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{ev.id}</span></td>
                    <td style={{ ...cell, maxWidth: 200 }}>
                      {ev.user_info ? (
                        <div className="flex items-center gap-2">
                          {ev.user_info.photo
                            ? <img src={ev.user_info.photo} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(245,193,24,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: '#F5C118', flexShrink: 0 }}>
                                {(ev.user_info.name || '?')[0].toUpperCase()}
                              </div>
                          }
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2 }}>{ev.user_info.name}</div>
                            <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.35)' }}>{ev.user_info.email}</div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.625rem', color: 'rgba(255,255,255,0.3)' }} title={ev.clerk_user_id}>
                          {ev.clerk_user_id ? ev.clerk_user_id.slice(0, 14) + '…' : '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      <span style={{ color: ev.ignore_on ? '#f87171' : 'rgba(255,255,255,0.25)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {String(ev.ignore_on ?? false).toUpperCase()}
                      </span>
                    </td>
                    <td style={cell}>{badge(ev.event)}</td>
                    <td style={{ ...cell, maxWidth: 180 }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }} title={ev.page}>
                        {PAGE_LABELS[ev.page] || ev.page || '—'}
                      </span>
                    </td>
                    <td style={{ ...cell, maxWidth: 220 }}>
                      {ev.metadata ? (
                        <span style={{ fontSize: '0.625rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }} title={JSON.stringify(ev.metadata)}>
                          {JSON.stringify(ev.metadata).slice(0, 50)}{JSON.stringify(ev.metadata).length > 50 ? '…' : ''}
                        </span>
                      ) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>NULL</span>}
                    </td>
                    <td style={cell}>
                      <span style={{ fontSize: '0.625rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }} title={ev.session_id}>
                        {ev.session_id ? ev.session_id.slice(0, 10) + '…' : '—'}
                      </span>
                    </td>
                    <td style={cell}>{fmt(ev.created_at)}</td>
                    <td style={cell}>
                      <button onClick={() => toggleIgnore(ev.id, ev.ignore_on)}
                        style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
                        {ev.ignore_on ? 'הפעל' : 'התעלם'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* By event */}
          <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>לפי סוג אירוע</h3>
            </div>
            <div style={{ padding: '8px 0' }}>
              {stats.byEvent.map(([ev, count]) => (
                <div key={ev} className="flex items-center justify-between" style={{ padding: '8px 16px' }}>
                  <div className="flex items-center gap-2">
                    {badge(ev)}
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By page */}
          <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>עמודים פופולריים</h3>
            </div>
            <div style={{ padding: '8px 0' }}>
              {stats.byPage.slice(0, 12).map(([pg, count]) => {
                const max = stats.byPage[0]?.[1] || 1;
                return (
                  <div key={pg} style={{ padding: '6px 16px' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{PAGE_LABELS[pg] || pg}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>{count}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: '#F5C118', width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily views */}
          {stats.daily.length > 0 && (
            <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', gridColumn: '1 / -1' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>צפיות יומיות — 30 ימים אחרונים</h3>
              </div>
              <div style={{ padding: 16, display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
                {(() => {
                  const max = Math.max(...stats.daily.map(([, c]) => c), 1);
                  return stats.daily.map(([day, count]) => (
                    <div key={day} title={`${day}: ${count}`} style={{ flex: 1, background: '#F5C118', borderRadius: '2px 2px 0 0', opacity: 0.7, height: `${(count / max) * 100}%`, minHeight: 2 }} />
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
