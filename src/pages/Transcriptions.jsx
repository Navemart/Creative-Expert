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
    complete:   { label: 'הושלם',   bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  color: '#86efac' },
    error:      { label: 'שגיאה',   bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  color: '#fca5a5' },
    processing: { label: 'מעבד…',   bg: 'rgba(245,193,24,0.12)', border: 'rgba(245,193,24,0.35)', color: '#fcd34d' },
  }[status] ?? { label: status, bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)' };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {status === 'complete' && <Check size={9} strokeWidth={3} />}
      {cfg.label}
    </span>
  );
}

// ── Transcript cell — preview + copy only ────────────────────
function TranscriptCell({ text, status }) {
  const [copied, setCopied] = useState(false);
  const PREVIEW = 140;

  if (!text || status !== 'complete') {
    return <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;
  }

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-1.5 max-w-md">
      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)' }}>
        {text.slice(0, PREVIEW)}{text.length > PREVIEW ? '…' : ''}
      </p>
      <button onClick={copy}
        className="flex items-center gap-1 text-[11px] transition hover:opacity-70"
        style={{ color: copied ? '#86efac' : 'rgba(255,255,255,0.32)' }}>
        {copied
          ? <><Check size={11} /> הועתק</>
          : <><Copy size={11} /> העתק הכל</>}
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
    note: 'מבוסס Whisper AI (~₪0.02 לריל) · חשבונות פומביים בלבד · 10-30 שניות',
  },
  youtube: {
    label: 'YouTube',
    Icon: Youtube,
    color: '#ef4444',
    placeholder: 'https://www.youtube.com/watch?v=...  או  https://youtu.be/...',
    note: 'חינמי · מבוסס כתוביות · תוצאה תוך שניות',
  },
};

// ── Platform icon helper ──────────────────────────────────────
function PlatformIcon({ platform, size = 14 }) {
  const cfg = PLATFORMS[platform];
  if (!cfg) return null;
  return <cfg.Icon size={size} style={{ color: cfg.color }} />;
}

// ── Analysis modal ────────────────────────────────────────────
const SECTION_ICONS = ['📋', '🎯', '💡'];

function AnalysisModal({ row, onClose }) {
  // Parse "## Title\ncontent\n\n## Title…" into sections
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} style={{ color: '#fcd34d' }} />
            <span className="text-sm font-bold text-white">ניתוח תוכן</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={row.source_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] transition hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              <ExternalLink size={11} /> מקור
            </a>
            <button onClick={onClose}
              className="rounded-md p-1 transition hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.45)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {sections.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>
              אין ניתוח זמין
            </p>
          )}
          {sections.map((sec, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base leading-none">{SECTION_ICONS[i] ?? '▸'}</span>
                <h3 className="text-sm font-bold text-white">{sec.title}</h3>
              </div>
              <div className="space-y-1.5 pr-6">
                {sec.body.split('\n').map((line, j) => {
                  const isBullet = /^-\s/.test(line.trim());
                  const text = isBullet ? line.replace(/^-\s*/, '') : line;
                  if (!text.trim()) return null;
                  return isBullet ? (
                    <div key={j} className="flex items-start gap-2">
                      <ChevronRight size={11} className="flex-none mt-0.5" style={{ color: '#fcd34d' }} />
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{text}</p>
                    </div>
                  ) : (
                    <p key={j} className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{text}</p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            מופעל על ידי GPT-4o mini
          </span>
          <button onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition hover:opacity-80"
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
  const [analysisModal, setAnalysisModal] = useState(null); // row object

  // ── Load history ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    setHistLoading(true);
    fetch(`/api/transcriptions?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(({ data }) => setRows(data ?? []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [userId]);

  // ── Submit ────────────────────────────────────────────────
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

      if (data) {
        setRows(prev => [data, ...prev]);
        setUrl('');
      }
      if (error) setFormError(error);
    } catch {
      setFormError('שגיאה בחיבור לשרת — האם `npm run dev` פועל?');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────
  async function deleteRow(id) {
    if (!await dialog.confirm('התמלול ימחק לצמיתות.', { title: 'מחיקת תמלול', confirmText: 'מחיקה' })) return;
    setRows(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/transcriptions/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  // ── Analyze ───────────────────────────────────────────────
  async function analyze(row) {
    // Already cached locally — just show modal
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
    <div className="w-full space-y-6">

      {/* ── Page header ── */}
      <h1 className="text-2xl sm:text-4xl font-bold text-white">תמלול</h1>

      {/* ── New transcription card ── */}
      <div className="rounded-2xl p-6"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>

        <div className="flex items-center gap-2 mb-5">
          <FileText size={15} style={{ color: '#fcd34d' }} />
          <h2 className="text-sm font-bold text-white">תמלול חדש</h2>
        </div>

        <form onSubmit={submit} className="space-y-4">

          {/* Platform selector */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.42)' }}>פלטפורמה</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PLATFORMS).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setPlatform(key); setUrl(''); setFormError(''); }}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm transition-all"
                  style={{
                    background: platform === key ? 'rgba(255,255,255,0.07)' : 'rgb(var(--bg-elevated))',
                    border: platform === key
                      ? `1px solid ${cfg.color}55`
                      : '1px solid rgba(255,255,255,0.08)',
                    color: platform === key ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  <cfg.Icon size={16} style={{ color: platform === key ? cfg.color : 'rgba(255,255,255,0.3)' }} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL input */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.42)' }}>
              קישור לסרטון
            </label>
            <div className="relative">
              <Link2 size={14}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(255,255,255,0.28)' }} />
              <input
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setFormError(''); }}
                placeholder={PLATFORMS[platform].placeholder}
                className="w-full rounded-xl py-3 pr-11 pl-4 text-sm outline-none"
                style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Error */}
          {formError && (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
              {formError}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={!url.trim() || submitting}
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40 bg-accent text-accent-foreground">
            {submitting
              ? <><Loader2 size={15} className="animate-spin" />
                  {platform === 'instagram' ? 'מוריד ומתמלל — עד 30 שניות…' : 'מתמלל…'}
                </>
              : <><Play size={15} /> התחל תמלול</>}
          </button>
        </form>
      </div>

      {/* ── History ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>

        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-bold text-white">התמלולים שלך</h2>
          {rows.length > 0 && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {rows.length} תמלולים
            </span>
          )}
        </div>

        {histLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.18)' }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Youtube size={40} style={{ color: 'rgba(255,255,255,0.08)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.26)' }}>
              טרם בוצעו תמלולים. הדבק קישור ולחץ "התחל תמלול"
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['פלטפורמה', 'תאריך', 'קישור', 'סטטוס', 'תמלול', 'ניתוח', ''].map(h => (
                    <th key={h}
                      className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                      style={{ color: 'rgba(255,255,255,0.22)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}
                    className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

                    {/* Platform */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={row.platform} />
                        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
                          {PLATFORMS[row.platform]?.label ?? row.platform}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        {fmtDate(row.created_at)}
                      </span>
                    </td>

                    {/* URL */}
                    <td className="px-5 py-4">
                      <a href={row.source_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium transition hover:opacity-70 whitespace-nowrap"
                        style={{ color: '#fcd34d' }}>
                        <ExternalLink size={11} />
                        צפה
                      </a>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Transcript */}
                    <td className="px-5 py-4">
                      <TranscriptCell text={row.transcript} status={row.status} />
                    </td>

                    {/* Analyze */}
                    <td className="px-5 py-4">
                      {row.status === 'complete' ? (
                        <button
                          onClick={() => analyze(row)}
                          disabled={analyzingIds.has(row.id)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-40 whitespace-nowrap"
                          style={{
                            background: row.analysis ? 'rgba(245,193,24,0.15)' : 'rgba(255,255,255,0.07)',
                            border: row.analysis ? '1px solid rgba(245,193,24,0.35)' : '1px solid rgba(255,255,255,0.1)',
                            color: row.analysis ? '#fcd34d' : 'rgba(255,255,255,0.55)',
                          }}
                        >
                          {analyzingIds.has(row.id)
                            ? <><Loader2 size={11} className="animate-spin" /> מנתח…</>
                            : row.analysis
                              ? <><Sparkles size={11} /> הצג ניתוח</>
                              : <><Sparkles size={11} /> נתח</>}
                        </button>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.12)' }}>—</span>
                      )}
                    </td>

                    {/* Delete */}
                    <td className="px-5 py-4">
                      <button onClick={() => deleteRow(row.id)}
                        className="rounded-md p-1.5 transition hover:bg-red-500/20"
                        style={{ color: 'rgba(255,255,255,0.22)' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Analysis modal ── */}
      {analysisModal && (
        <AnalysisModal row={analysisModal} onClose={() => setAnalysisModal(null)} />
      )}
    </div>
  );
}
