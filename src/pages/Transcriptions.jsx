import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useDialog } from '../components/Dialog.jsx';
import {
  Youtube, Link2, Copy, Check,
  Loader2, Trash2, ExternalLink, Play, FileText, Instagram,
  Sparkles, X, ChevronRight,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    complete:   { label: 'הושלם',  bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  color: '#86efac' },
    error:      { label: 'שגיאה',  bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  color: '#fca5a5' },
    processing: { label: 'מעבד…',  bg: 'rgba(245,193,24,0.12)', border: 'rgba(245,193,24,0.3)', color: '#fcd34d' },
    pending:    { label: 'ממתין…', bg: 'rgba(245,193,24,0.08)', border: 'rgba(245,193,24,0.25)', color: '#fcd34d' },
  }[status] ?? { label: status, bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full whitespace-nowrap font-semibold"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: '11px',
        padding: '4px 10px',
        lineHeight: 1.4,
      }}
    >
      {status === 'complete' && <Check size={11} strokeWidth={3} />}
      {cfg.label}
    </span>
  );
}

// ── Transcript cell ───────────────────────────────────────────
function TranscriptCell({ text, status }) {
  const [copied, setCopied] = useState(false);

  if (!text || status !== 'complete') {
    return <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>—</span>;
  }

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-start gap-2">
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.55,
          color: 'rgba(255,255,255,0.65)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1,
        }}
      >
        {text}
      </p>
      <button
        onClick={copy}
        className="flex-none flex items-center justify-center rounded transition hover:bg-white/10"
        style={{
          color: copied ? '#86efac' : 'rgba(255,255,255,0.28)',
          padding: '4px',
          marginTop: 1,
        }}
        title="העתק הכל"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

// ── Platform config ───────────────────────────────────────────
const PLATFORMS = {
  instagram: {
    label: 'Instagram',
    Icon: Instagram,
    color: '#e1306c',
    placeholder: 'https://www.instagram.com/reel/...',
    note: 'מבוסס Whisper AI · חשבונות פומביים בלבד · 10–30 שניות',
  },
  youtube: {
    label: 'YouTube',
    Icon: Youtube,
    color: '#ef4444',
    placeholder: 'https://www.youtube.com/watch?v=...  או  https://youtu.be/...',
    note: 'חינמי · מבוסס כתוביות · תוצאה תוך שניות',
  },
};

function PlatformIcon({ platform, size = 15 }) {
  const cfg = PLATFORMS[platform];
  if (!cfg) return null;
  return <cfg.Icon size={size} style={{ color: cfg.color }} />;
}

// ── Analysis modal ────────────────────────────────────────────
const SECTION_ICONS = ['📋', '🎯', '💡'];

function AnalysisModal({ row, onClose }) {
  const sections = [];
  if (row.analysis) {
    const parts = row.analysis.split(/\n(?=## )/);
    for (const part of parts) {
      const lines = part.trim().split('\n');
      const title = lines[0].replace(/^##\s*/, '').trim();
      const body  = lines.slice(1).join('\n').trim();
      sections.push({ title, body });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: '#fcd34d' }} />
            <span className="text-sm font-bold text-white">ניתוח תוכן</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={row.source_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs transition hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              <ExternalLink size={11} /> מקור
            </a>
            <button onClick={onClose}
              className="rounded-md p-1 transition hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.45)' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {sections.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>אין ניתוח זמין</p>
          )}
          {sections.map((sec, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm leading-none">{SECTION_ICONS[i] ?? '▸'}</span>
                <h3 className="text-sm font-bold text-white">{sec.title}</h3>
              </div>
              <div className="space-y-1.5 pr-5">
                {sec.body.split('\n').map((line, j) => {
                  const isBullet = /^-\s/.test(line.trim());
                  const text = isBullet ? line.replace(/^-\s*/, '') : line;
                  if (!text.trim()) return null;
                  return isBullet ? (
                    <div key={j} className="flex items-start gap-2">
                      <ChevronRight size={10} className="flex-none mt-0.5" style={{ color: '#fcd34d' }} />
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{text}</p>
                    </div>
                  ) : (
                    <p key={j} className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{text}</p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>מופעל על ידי GPT-4o mini</span>
          <button onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold transition hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Transcriptions() {
  const { user } = useUser();
  const userId   = user?.id;
  const dialog   = useDialog();

  const [platform,      setPlatform]      = useState('youtube');
  const [url,           setUrl]           = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [rows,          setRows]          = useState([]);
  const [histLoading,   setHistLoading]   = useState(true);
  const [formError,     setFormError]     = useState('');
  const [analyzingIds,  setAnalyzingIds]  = useState(new Set());
  const [analysisModal, setAnalysisModal] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setHistLoading(true);
    fetch(`/api/transcriptions?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(({ data }) => setRows(data ?? []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [userId]);

  async function submit(e) {
    e.preventDefault();
    if (!url.trim() || submitting) return;
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/transcriptions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim(), userId }),
      });
      const { data, error } = await res.json();
      if (data) { setRows(prev => [data, ...prev]); setUrl(''); }
      if (error) setFormError(error);
    } catch {
      setFormError('שגיאה בחיבור לשרת');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRow(id) {
    if (!await dialog.confirm('התמלול ימחק לצמיתות.', { title: 'מחיקת תמלול', confirmText: 'מחיקה' })) return;
    setRows(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/transcriptions/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  async function analyze(row) {
    if (row.analysis) { setAnalysisModal(row); return; }
    setAnalyzingIds(prev => new Set(prev).add(row.id));
    try {
      const res = await fetch(`/api/transcriptions/${row.id}/analyze`, { method: 'POST' });
      const { analysis, error } = await res.json();
      if (error) { await dialog.alert(error); return; }
      const updated = { ...row, analysis };
      setRows(prev => prev.map(r => r.id === row.id ? updated : r));
      setAnalysisModal(updated);
    } catch {
      await dialog.alert('שגיאה בניתוח — נסה שוב');
    } finally {
      setAnalyzingIds(prev => { const s = new Set(prev); s.delete(row.id); return s; });
    }
  }

  return (
    <div className="w-full">

      {/* ── Page header ───────────────────────────────────────── */}
      <div style={{ paddingBottom: 18, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>תמלול</h1>
      </div>

      {/* ── New transcription card ────────────────────────────── */}
      <div
        style={{
          background: 'rgb(var(--bg-surface))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        {/* Row 1 — Card title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <FileText size={16} style={{ color: '#fcd34d', flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>תמלול חדש</span>
        </div>

        <form onSubmit={submit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Row 2 — Platform */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>פלטפורמה</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(PLATFORMS).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setPlatform(key); setUrl(''); setFormError(''); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      height: 36,
                      padding: '0 16px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: platform === key ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: platform === key
                        ? `1px solid ${cfg.color}60`
                        : '1px solid rgba(255,255,255,0.14)',
                      color: platform === key ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.58)',
                    }}
                  >
                    <cfg.Icon
                      size={15}
                      style={{ color: platform === key ? cfg.color : 'rgba(255,255,255,0.35)' }}
                    />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 3 — URL input */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                קישור לסרטון
              </label>
              <div style={{ position: 'relative' }}>
                <Link2
                  size={14}
                  style={{
                    pointerEvents: 'none',
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255,255,255,0.28)',
                  }}
                />
                <input
                  type="url"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setFormError(''); }}
                  placeholder={PLATFORMS[platform].placeholder}
                  style={{
                    width: '100%',
                    height: 42,
                    paddingRight: 36,
                    paddingLeft: 14,
                    borderRadius: 8,
                    fontSize: 13,
                    background: 'rgb(var(--bg-elevated))',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  disabled={submitting}
                  onFocus={e => { e.target.style.borderColor = 'rgba(var(--accent), 0.6)'; }}
                  onBlur={e =>  { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>
              <p style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
                {PLATFORMS[platform].note}
              </p>
            </div>

            {/* Error */}
            {formError && (
              <div
                style={{
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 13,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.22)',
                  color: '#fca5a5',
                }}
              >
                {formError}
              </div>
            )}

            {/* Row 4 — Submit */}
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="submit"
                disabled={!url.trim() || submitting}
                className="bg-accent text-accent-foreground"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  height: 40,
                  padding: '0 20px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                  opacity: (!url.trim() || submitting) ? 0.45 : 1,
                  border: 'none',
                }}
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" />
                      {platform === 'instagram' ? 'מוריד ומתמלל…' : 'מתמלל…'}
                    </>
                  : <><Play size={14} /> התחל תמלול</>}
              </button>
            </div>

          </div>
        </form>
      </div>

      {/* ── Section header ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>התמלולים שלך</span>
        {rows.length > 0 && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            {rows.length} תמלולים
          </span>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div
        style={{
          background: 'rgb(var(--bg-surface))',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {histLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.18)' }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '52px 0' }}>
            <Youtube size={34} style={{ color: 'rgba(255,255,255,0.07)' }} />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.26)' }}>
              טרם בוצעו תמלולים — הדבק קישור ולחץ ״התחל תמלול״
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '40%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    { key: 'platform', label: 'פלטפורמה' },
                    { key: 'date',     label: 'תאריך'     },
                    { key: 'link',     label: 'קישור'     },
                    { key: 'status',   label: 'סטטוס'     },
                    { key: 'text',     label: 'תמלול'     },
                    { key: 'analyze',  label: 'ניתוח'     },
                    { key: 'del',      label: ''          },
                  ].map(h => (
                    <th
                      key={h.key}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >

                    {/* Platform */}
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <PlatformIcon platform={row.platform} size={15} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
                          {PLATFORMS[row.platform]?.label ?? row.platform}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
                        {fmtDate(row.created_at)}
                      </span>
                    </td>

                    {/* URL */}
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                      <a
                        href={row.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#fcd34d',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                          opacity: 1,
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = 0.7; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = 1; }}
                      >
                        <ExternalLink size={13} />
                        צפה
                      </a>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Transcript */}
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                      <TranscriptCell text={row.transcript} status={row.status} />
                    </td>

                    {/* Analyze */}
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                      {row.status === 'complete' ? (
                        <button
                          onClick={() => analyze(row)}
                          disabled={analyzingIds.has(row.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            height: 32,
                            padding: '0 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'opacity 0.15s',
                            opacity: analyzingIds.has(row.id) ? 0.45 : 1,
                            background: row.analysis ? 'rgba(245,193,24,0.12)' : 'rgba(255,255,255,0.05)',
                            border: row.analysis ? '1px solid rgba(245,193,24,0.3)' : '1px solid rgba(255,255,255,0.1)',
                            color: row.analysis ? '#fcd34d' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {analyzingIds.has(row.id)
                            ? <><Loader2 size={12} className="animate-spin" /> מנתח…</>
                            : row.analysis
                              ? <><Sparkles size={13} /> הצג ניתוח</>
                              : <><Sparkles size={13} /> נתח</>}
                        </button>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Delete */}
                    <td style={{ padding: '9px 14px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <button
                        onClick={() => deleteRow(row.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 30,
                          height: 30,
                          borderRadius: 6,
                          cursor: 'pointer',
                          border: 'none',
                          background: 'transparent',
                          color: 'rgba(255,255,255,0.22)',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                          e.currentTarget.style.color = '#fca5a5';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'rgba(255,255,255,0.22)';
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Analysis modal ────────────────────────────────────── */}
      {analysisModal && (
        <AnalysisModal row={analysisModal} onClose={() => setAnalysisModal(null)} />
      )}
    </div>
  );
}
