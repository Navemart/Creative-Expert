import { useEffect, useState, useMemo, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, LayoutGrid, List, ChevronUp, ChevronDown, X, Eye, Share2, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const SEGMENTS = [
  { label: 'TRAINEE',        color: '#ef4444' },
  { label: 'CREW',           color: '#f97316' },
  { label: 'SECOND OFFICER', color: '#eab308' },
  { label: 'CO-PILOT',       color: '#22c55e' },
  { label: 'CAPTAIN',        color: '#06b6d4' },
  { label: 'EXPERT',         color: '#a855f7' },
];

const HEALTH = {
  green:  { label: 'סבבה',       color: '#4fc38a' },
  yellow: { label: 'צריך יחס',   color: '#F5C118' },
  red:    { label: 'עזרה צמודה', color: '#ff5a72' },
};

function getRankColor(label) {
  return SEGMENTS.find(s => s.label === label)?.color || '#6b7280';
}

function fmtK(n) {
  if (!n) return null;
  const v = Number(n); if (isNaN(v) || v === 0) return null;
  if (v >= 1000) return `₪${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return '₪' + Math.round(v).toLocaleString('he-IL');
}

function fmtFull(n) {
  if (n == null) return null;
  const v = Number(n); if (isNaN(v)) return null;
  if (v >= 1000) return `₪${Math.round(v / 1000)}K`;
  return '₪' + Math.round(v).toLocaleString('he-IL');
}

function fmtDate(d) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtMonth(d) {
  if (!d) return '—';
  try {
    const s = /^\d{4}-\d{2}$/.test(String(d)) ? d + '-01' : d;
    return new Date(s).toLocaleString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch { return String(d); }
}

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

// ── Photo with fallback ────────────────────────────────────────
function Photo({ name, src, style = {} }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || '?')[0].toUpperCase();

  if (src && !failed) {
    return (
      <img src={src} alt={name} onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', ...style }} />
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', fontSize: 36, fontWeight: 900, color: 'rgba(255,255,255,0.2)', ...style }}>
      {initial}
    </div>
  );
}

// ── FILTER TABS (member_status) ────────────────────────────────
const FILTER_TABS = [
  { k: 'all',       l: 'הכל' },
  { k: 'active',    l: 'פעיל' },
  { k: 'graduated', l: 'בוגר' },
  { k: 'churned',   l: 'עזב' },
  { k: 'ghosted',   l: 'נעלם' },
  { k: 'removed',   l: 'הוצאתי' },
];

const STATUS_META = {
  active:    { label: 'פעיל',    color: '#4fc38a' },
  graduated: { label: 'בוגר',    color: '#06b6d4' },
  churned:   { label: 'עזב',     color: '#F5C118' },
  ghosted:   { label: 'נעלם',    color: '#f97316' },
  removed:   { label: 'הוצאתי',  color: '#ef4444' },
};

// ── SORT OPTIONS ───────────────────────────────────────────────
const SORT_OPTIONS = [
  { k: 'name',    l: 'שם' },
  { k: 'income',  l: 'הכנסה' },
  { k: 'joined',  l: 'תאריך הצטרפות' },
  { k: 'rank',    l: 'דרגה' },
];

// ── MEMBER CARD (grid) ─────────────────────────────────────────
function MemberCard({ student, photoSrc, onClick }) {
  const { name, effective_rank, member_status, latest_income } = student;

  const sm = STATUS_META[member_status] || STATUS_META.active;
  const rankColor = getRankColor(effective_rank);
  const income = fmtK(latest_income);

  return (
    <button onClick={onClick} style={{
      background: 'rgb(var(--bg-surface))',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      overflow: 'hidden',
      cursor: 'pointer',
      textAlign: 'right',
      width: '100%',
      padding: 0,
      transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
      display: 'flex',
      flexDirection: 'column',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Photo */}
      <div style={{ width: '100%', aspectRatio: '1', position: 'relative', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
        <Photo name={name} src={photoSrc} />
        {member_status && member_status !== 'active' && (
          <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.7)', color: sm.color, padding: '2px 7px', borderRadius: 6, backdropFilter: 'blur(4px)', border: `1px solid ${sm.color}40` }}>{sm.label}</div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 13px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Row 1: status dot (right) + rank (left) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: sm.color }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.color, flexShrink: 0 }} />
            {sm.label}
          </span>
          {effective_rank && (
            <span style={{ fontSize: 10, fontWeight: 700, color: rankColor, padding: '1px 6px', borderRadius: 5, background: rankColor + '18', border: `1px solid ${rankColor}35` }}>
              {effective_rank}
            </span>
          )}
        </div>
        {/* Row 2: name */}
        <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.3 }}>{name}</p>
        {/* Row 3: income */}
        <p style={{ fontSize: 12, fontWeight: 600, color: income ? '#F5C118' : 'rgba(255,255,255,0.2)', margin: 0 }}>
          {income ? `${income}/חו׳` : 'אין דיווח'}
        </p>
      </div>
    </button>
  );
}

// ── MEMBER ROW (list) ──────────────────────────────────────────
function MemberRow({ student, photoSrc, onClick }) {
  const { name, effective_rank, member_status, latest_income, enrolled_at, total_paid } = student;
  const sm = STATUS_META[member_status] || STATUS_META.active;
  const rankColor = getRankColor(effective_rank);
  const income = fmtK(latest_income);

  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
      background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12,
      cursor: 'pointer', textAlign: 'right', transition: 'background 0.12s, border-color 0.12s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgb(var(--bg-surface))'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      {/* Mini photo */}
      <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)' }}>
        <Photo name={name} src={photoSrc} />
      </div>

      {/* Name + joined */}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: 'white', margin: 0 }}>{name}</p>
        {enrolled_at && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>הצטרף {fmtDate(enrolled_at)}</p>}
      </div>

      {/* Status + rank badges */}
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: sm.color + '18', color: sm.color, border: `1px solid ${sm.color}40`, flexShrink: 0 }}>{sm.label}</span>
      {effective_rank && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: rankColor + '18', color: rankColor, border: `1px solid ${rankColor}40`, flexShrink: 0 }}>{effective_rank}</span>}

      {/* Income */}
      <span style={{ fontSize: 14, fontWeight: 800, color: income ? '#F5C118' : 'rgba(255,255,255,0.2)', flexShrink: 0, minWidth: 80, textAlign: 'left' }}>
        {income ? `${income}/חו׳` : '—'}
      </span>

      {total_paid && <span style={{ fontSize: 12, fontWeight: 700, color: '#4fc38a', flexShrink: 0 }}>₪{Number(total_paid).toLocaleString('he-IL')}</span>}
    </button>
  );
}

// ── STUDENT DETAIL MODAL ───────────────────────────────────────
function StudentModal({ student, photoSrc, onClose }) {
  const sorted = [...(student.monthly || [])].sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [student.id]);

  const cur  = sorted[idx] || null;
  const prev = sorted[idx + 1] || null;
  const curIncome  = cur ? num(cur.total_income || cur.amount) : 0;
  const prevIncome = prev ? num(prev.total_income || prev.amount) : null;
  const curExp     = cur ? num(cur.software_expenses) + num(cur.variable_expenses) + num(cur.paid_ads) : 0;
  const curNet     = curIncome - curExp;
  const rankColor  = getRankColor(cur?.current_rank);
  const h = student.health_status ? HEALTH[student.health_status] : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}
      onClick={onClose}>
      <div dir="rtl" style={{ background: 'rgb(var(--bg-surface))', borderRadius: 20, width: '100%', maxWidth: 840, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 100px rgba(0,0,0,0.8)', marginBottom: 40 }}
        onClick={e => e.stopPropagation()}>

        {/* Header with photo */}
        <div style={{ position: 'relative', height: 200, borderRadius: '20px 20px 0 0', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
          <Photo name={student.name} src={photoSrc} style={{ objectPosition: 'center 20%' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }} />

          <div style={{ position: 'absolute', bottom: 0, right: 0, left: 0, padding: '0 20px 16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <p style={{ fontWeight: 900, fontSize: 20, color: 'white', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{student.name}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {student.effective_rank && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: getRankColor(student.effective_rank) + '30', color: 'white', border: `1px solid ${getRankColor(student.effective_rank)}60`, backdropFilter: 'blur(4px)' }}>{student.effective_rank}</span>}
                {h && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: h.color + '30', color: 'white', border: `1px solid ${h.color}60`, backdropFilter: 'blur(4px)' }}>{h.label}</span>}
                {student.enrolled_at && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', padding: '3px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>הצטרף {fmtDate(student.enrolled_at)}</span>}
                {student.total_paid && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(79,195,138,0.2)', color: '#4fc38a', border: '1px solid rgba(79,195,138,0.4)', backdropFilter: 'blur(4px)' }}>שילם ₪{Number(student.total_paid).toLocaleString('he-IL')}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 20px 28px' }}>
          {sorted.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0', fontSize: 14 }}>אין דיווחים חודשיים עדיין</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Month tabs */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {sorted.map((m, i) => (
                  <button key={m.id || m.month} onClick={() => setIdx(i)}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                      background: i === idx ? 'rgba(245,193,24,0.15)' : 'rgba(255,255,255,0.05)', color: i === idx ? '#F5C118' : 'rgba(255,255,255,0.4)' }}>
                    {fmtMonth(m.month)}
                  </button>
                ))}
              </div>

              {cur && (
                <>
                  {/* Hero row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    <div style={{ borderRadius: 14, padding: '16px 18px', background: 'rgba(245,193,24,0.08)', border: '1px solid rgba(245,193,24,0.25)' }}>
                      <p style={{ fontSize: 11, color: 'rgba(245,193,24,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>הכנסה חודשית</p>
                      <p style={{ fontSize: 28, fontWeight: 900, color: '#F5C118', lineHeight: 1, margin: 0 }}>{fmtFull(curIncome) || '₪0'}</p>
                      {prevIncome != null && prevIncome > 0 && (
                        <p style={{ fontSize: 11, margin: '6px 0 0', color: curIncome >= prevIncome ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                          {curIncome >= prevIncome ? '↑' : '↓'} {Math.abs(Math.round((curIncome - prevIncome) / prevIncome * 100))}%
                        </p>
                      )}
                    </div>
                    <div style={{ borderRadius: 14, padding: '16px 18px', background: curNet >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${curNet >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>רווח נטו</p>
                      <p style={{ fontSize: 24, fontWeight: 900, color: curNet >= 0 ? '#16a34a' : '#dc2626', lineHeight: 1, margin: 0 }}>{fmtFull(curNet) || '₪0'}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '6px 0 0' }}>הוצאות: {fmtFull(curExp) || '₪0'}</p>
                    </div>
                    <div style={{ borderRadius: 14, padding: '16px 18px', background: rankColor + '10', border: `1px solid ${rankColor}30` }}>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>דרגה</p>
                      <p style={{ fontSize: 18, fontWeight: 900, color: rankColor, lineHeight: 1, margin: 0 }}>{cur.current_rank || '—'}</p>
                    </div>
                  </div>

                  {/* Sales */}
                  <div style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', margin: '0 0 12px' }}>🤝 מכירות</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                      {[['לידים', cur.leads], ['שיחות נקבעו', cur.sales_calls_set], ['הגיעו', cur.sales_calls_showed], ['נסגרו', cur.closings_count]].map(([l, v]) => (
                        <div key={l}>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>{l}</p>
                          <p style={{ fontSize: 22, fontWeight: 900, color: '#a78bfa', margin: 0 }}>{v ?? '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', margin: '0 0 12px' }}>🎬 תוכן</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                      {[['עוקבים', cur.followers != null ? Number(cur.followers).toLocaleString('he-IL') : null], ['פוסטים', cur.posts_count], ['ממומן', cur.paid_ads != null ? fmtFull(cur.paid_ads) : null]].map(([l, v]) => (
                        <div key={l}>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>{l}</p>
                          <p style={{ fontSize: 18, fontWeight: 900, color: '#fb923c', margin: 0 }}>{v ?? '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reflection */}
                  {(cur.biggest_win || cur.focus_next_month || cur.program_feedback) && (
                    <div style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#f472b6', margin: 0 }}>🔮 רפלקשן</p>
                        {cur.nps != null && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: num(cur.nps) <= 8 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)', color: num(cur.nps) <= 8 ? '#f87171' : '#4ade80' }}>NPS {cur.nps}</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                        {[['🏆 נצחון גדול', cur.biggest_win], ['🎯 פוקוס הבא', cur.focus_next_month], ['💬 פידבק', cur.program_feedback]].filter(([,v]) => v).map(([l, v]) => (
                          <div key={l} style={{ borderRadius: 8, padding: '10px 12px', background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '0 0 4px' }}>{l}</p>
                            <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, margin: 0 }}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SORT DROPDOWN ──────────────────────────────────────────────
function SortDropdown({ sortKey, sortDir, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = SORT_OPTIONS.find(o => o.k === sortKey);

  useEffect(() => {
    if (!open) return;
    const fn = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {sortDir === 1 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {cur?.l || 'מיון'}
        {sortDir === 1 ? <ChevronUp size={12} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, minWidth: 150, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 100, overflow: 'hidden' }}>
          {SORT_OPTIONS.map(o => (
            <button key={o.k} onClick={() => { onChange(o.k, o.k === sortKey ? -sortDir : -1); setOpen(false); }}
              style={{ width: '100%', textAlign: 'right', padding: '9px 14px', fontSize: 13, color: o.k === sortKey ? 'white' : 'rgba(255,255,255,0.6)', fontWeight: o.k === sortKey ? 700 : 500, background: o.k === sortKey ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{o.k === sortKey ? (sortDir === 1 ? '↑' : '↓') : ''}</span>
              {o.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────
export default function AdminMembersGrid() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [students,      setStudents]      = useState([]);
  const [roadmap,       setRoadmap]       = useState(null);
  const [slackPhotos,   setSlackPhotos]   = useState({});
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [filter,        setFilter]        = useState('all');
  const [viewMode,      setViewMode]      = useState('grid');
  const [sortKey,       setSortKey]       = useState('income');
  const [sortDir,       setSortDir]       = useState(-1);
  const [refreshing,    setRefreshing]    = useState(false);
  const [unposted,      setUnposted]      = useState({ wins: 0, deals: 0 });

  if (user && user.id !== ADMIN_ID) {
    return <div style={{ display: 'flex', height: 240, alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>אין גישה</div>;
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [studentsRes, photosRes] = await Promise.all([
        fetch('/api/admin/students', { headers: { 'x-admin-id': ADMIN_ID || '' } }),
        fetch('/api/slack/member-photos'),
      ]);
      if (studentsRes.ok) {
        const { students: s, roadmap: r } = await studentsRes.json();
        setStudents(s || []);
        setRoadmap(r || null);
      }
      if (photosRes.ok) {
        setSlackPhotos(await photosRes.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    const since = new Date(Date.now() - 72 * 3600000).toISOString();
    Promise.all([
      supabase.from('sunday_wins').select('id', { count: 'exact', head: true }).is('slack_posted_at', null).gte('created_at', since),
      supabase.from('deals').select('id', { count: 'exact', head: true }).is('slack_posted_at', null).gte('created_at', since),
    ]).then(([wRes, dRes]) => setUnposted({ wins: wRes.count || 0, deals: dRes.count || 0 }));
  }, [location.key]);

  // Best photo: Slack first (by email), fallback to Clerk image_url
  function getPhoto(student) {
    const slackUrl = student.email ? slackPhotos[student.email.toLowerCase()] : null;
    return slackUrl || student.image_url || null;
  }

  function countFor(k) {
    if (k === 'all') return students.length;
    return students.filter(s => (s.member_status || 'active') === k).length;
  }

  const filtered = useMemo(() => {
    let list = students.filter(s => {
      if (filter === 'all') return true;
      return (s.member_status || 'active') === filter;
    });
    if (search) list = list.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()));
    list = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === 'name')   { av = a.name || ''; bv = b.name || ''; return av.localeCompare(bv, 'he') * sortDir; }
      if (sortKey === 'income') { av = num(a.latest_income); bv = num(b.latest_income); }
      if (sortKey === 'joined') { av = a.enrolled_at || ''; bv = b.enrolled_at || ''; return av.localeCompare(bv) * sortDir; }
      if (sortKey === 'rank')   { av = SEGMENTS.findIndex(s => s.label === a.effective_rank); bv = SEGMENTS.findIndex(s => s.label === b.effective_rank); }
      return (av - bv) * sortDir;
    });
    return list;
  }, [students, filter, search, sortKey, sortDir]);

  const bgPage = 'transparent';
  const borderClr = 'rgba(255,255,255,0.1)';

  return (
    <div dir="rtl" style={{  padding: '28px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── KPI tiles ───────────────────────────────────── */}
        {students.length > 0 && (() => {
          const allDealsEver = students.flatMap(s => s.deals || []);
          const totalRevenue = allDealsEver.reduce((s, d) => s + num(d.total_amount), 0);
          const studentsWithPaid = students.filter(s => num(s.total_paid) > 0);
          const avgLTV       = studentsWithPaid.length ? Math.round(studentsWithPaid.reduce((s, st) => s + num(st.total_paid), 0) / studentsWithPaid.length) : null;
          const perStudent   = students.map(s => ({ name: s.name, total: (s.deals||[]).reduce((a,d) => a + num(d.total_amount), 0) }));
          const topStudent   = perStudent.length ? perStudent.sort((a,b) => b.total - a.total)[0] : null;

          // Best month: group all deals by YYYY-MM, find month with highest total
          const byMonth = {};
          allDealsEver.forEach(d => {
            if (!d.created_at) return;
            const m = d.created_at.slice(0, 7);
            byMonth[m] = (byMonth[m] || 0) + num(d.total_amount);
          });
          const bestMonthKey = Object.keys(byMonth).sort((a, b) => byMonth[b] - byMonth[a])[0] || null;
          const bestMonthTotal = bestMonthKey ? byMonth[bestMonthKey] : 0;
          const bestMonthLabel = bestMonthKey
            ? new Date(bestMonthKey + '-01').toLocaleString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
            : null;

          const KPIS = [
            { label: 'סה״כ עסקאות — כל הזמנים', value: totalRevenue > 0 ? `₪${totalRevenue.toLocaleString('he-IL')}` : '—', color: '#F5C118', sub: `${allDealsEver.length} עסקאות` },
            { label: 'ממוצע LTV',                 value: avgLTV ? `₪${avgLTV.toLocaleString('he-IL')}` : '—',               color: '#4fc38a', sub: 'שווי לקוח ממוצע' },
            { label: 'חודש שיא עסקאות',            value: bestMonthTotal > 0 ? `₪${bestMonthTotal.toLocaleString('he-IL')}` : '—', color: '#a78bfa', sub: bestMonthLabel || '' },
            { label: 'הכי רווחי',                  value: topStudent?.total > 0 ? `₪${topStudent.total.toLocaleString('he-IL')}` : '—', color: '#38bdf8', sub: topStudent?.name || '' },
          ];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {KPIS.map(({ label, value, color, sub }) => (
                <div key={label} style={{ borderRadius: 14, padding: '16px 18px', background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.28)', margin: '0 0 8px' }}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
                  {sub && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: '6px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Slack unposted alert ────────────────────────── */}
        {(unposted.wins > 0 || unposted.deals > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, marginBottom: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <span style={{ color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>
              ⚠️ לא פורסם לסלאק:
              {unposted.wins > 0 && ` ${unposted.wins} נצחונות`}
              {unposted.wins > 0 && unposted.deals > 0 && ' ·'}
              {unposted.deals > 0 && ` ${unposted.deals} עסקאות`}
              {' — '}הCron יפרסם ב-09:00, או פרסם ידנית מפאנל הניהול הישן.
            </span>
          </div>
        )}

        {/* ── ROW 1: Filter tabs + count ──────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(f => {
            const isActive = filter === f.k;
            const count    = countFor(f.k);
            const dotColor = STATUS_META[f.k]?.color || null;
            return (
              <button key={f.k} onClick={() => setFilter(f.k)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  border: `1px solid ${isActive ? '#F5C118' : borderClr}`,
                  background: isActive ? '#F5C118' : 'rgba(255,255,255,0.05)',
                  color: isActive ? '#111827' : 'rgba(255,255,255,0.5)' }}>
                {dotColor && <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#111827' : dotColor, flexShrink: 0 }} />}
                {f.l}
                <span style={{ fontSize: 10, opacity: 0.65 }}>({count})</span>
              </button>
            );
          })}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginRight: 6, fontWeight: 500 }}>
            {filtered.length} מוצגים
          </span>
        </div>

        {/* ── ROW 2: Search + view + sort | right buttons ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgb(var(--bg-surface))', border: `1px solid ${borderClr}`, borderRadius: 8, padding: '7px 12px', minWidth: 220, flex: '0 0 auto' }}>
            <Search size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש תלמידים..."
              style={{ background: 'none', border: 'none', outline: 'none', color: 'white', fontSize: 13, width: '100%' }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex' }}><X size={13} /></button>}
          </div>

          {/* Grid / List toggle */}
          <div style={{ display: 'flex', background: 'rgb(var(--bg-surface))', border: `1px solid ${borderClr}`, borderRadius: 8, overflow: 'hidden' }}>
            {[{ v: 'grid', Icon: LayoutGrid }, { v: 'list', Icon: List }].map(({ v, Icon }) => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ padding: '7px 11px', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: viewMode === v ? 'rgba(255,255,255,0.12)' : 'transparent', color: viewMode === v ? 'white' : 'rgba(255,255,255,0.35)', transition: 'all 0.12s' }}>
                <Icon size={15} />
              </button>
            ))}
          </div>

          {/* Sort */}
          <SortDropdown sortKey={sortKey} sortDir={sortDir} onChange={(k, d) => { setSortKey(k); setSortDir(d); }} />

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Refresh */}
          <button onClick={() => { setRefreshing(true); fetchAll().then(() => setRefreshing(false)); }} disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgb(var(--bg-surface))', border: `1px solid ${borderClr}`, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none', color: 'rgba(255,255,255,0.3)' }} />
            רענן
          </button>

          {/* Member Intel */}
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, background: 'rgb(var(--bg-surface))', border: `1px solid ${borderClr}`, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
            <Eye size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            סיכום תלמיד
          </button>

          {/* Manage (yellow) */}
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, background: '#F5C118', border: 'none', cursor: 'pointer', fontSize: 13, color: 'white', fontWeight: 700 }}>
            <Share2 size={14} />
            ניהול תלמידים
          </button>
        </div>

        {/* ── GRID / LIST ─────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{ borderRadius: 12, background: 'rgb(var(--bg-surface))', border: `1px solid ${borderClr}`, overflow: 'hidden' }}>
                <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.05}s` }} />
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 4, width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            {search ? `לא נמצאו תלמידים עם "${search}"` : 'אין תלמידים'}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {filtered.map(s => (
              <MemberCard key={s.id} student={s} photoSrc={getPhoto(s)} onClick={() => navigate(`/admin/members/${s.id}`, { state: { student: s, roadmap, slackPhotos } })} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(s => (
              <MemberRow key={s.id} student={s} photoSrc={getPhoto(s)} onClick={() => navigate(`/admin/members/${s.id}`, { state: { student: s, roadmap, slackPhotos } })} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
        @keyframes spin  { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
