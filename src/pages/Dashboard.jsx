import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useIsAdmin } from '../hooks/useIsAdmin.js';
import confettiLib from 'canvas-confetti';
import { Plus, Trophy, Calendar, Edit2, X, TrendingUp, Users, Image, Banknote, Settings2, FolderPlus, ExternalLink, Zap, ListChecks, ChevronLeft, Video, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ── Rank / segment config ─────────────────────────────────────
const SEGMENTS = [
  { label: 'TRAINEE',        min: 0,     max: 5000,  color: '#ef4444' },
  { label: 'CREW',           min: 5000,  max: 10000, color: '#f97316' },
  { label: 'SECOND OFFICER', min: 10000, max: 15000, color: '#eab308' },
  { label: 'CO-PILOT',       min: 15000, max: 20000, color: '#22c55e' },
  { label: 'CAPTAIN',        min: 20000, max: 30000, color: '#06b6d4' },
  { label: 'EXPERT',         min: 30000, max: 35000, color: '#a855f7' },
];
const MAX_BAR = 35000;

function getRank(amount) {
  return [...SEGMENTS].reverse().find(s => amount >= s.min) || SEGMENTS[0];
}

// מחזיר טקסט כהה או בהיר לפי בהירות הרקע
function contrastText(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminance > 0.55 ? '#13152A' : '#ffffff';
}

function getSegmentFill(segment, current) {
  if (current <= segment.min) return 0;
  if (current >= segment.max) return 100;
  return ((current - segment.min) / (segment.max - segment.min)) * 100;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

// ── Modal wrapper ─────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────
const BAR_GRADIENT = 'linear-gradient(to left, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #a855f7)';

function ProgressBar({ current, best, rankAmount, monthsCount, sectionLabel, currentLabel = 'אחרון', bestLabel = 'שיא' }) {
  const currentPct = 100 - Math.min((current    / MAX_BAR) * 100, 100);
  const bestPct    = 100 - Math.min((best        / MAX_BAR) * 100, 100);
  const rank       = getRank(rankAmount ?? current);   // דרגה = ממוצע 2 חודשים
  const currentRankDisplay = getRank(current);         // לצבע הסמן הנוכחי
  const bestRank   = getRank(best);

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {sectionLabel ?? <span className="text-sm font-semibold text-white/70">ההתקדמות שלך</span>}
          {monthsCount >= 2 && (
            <div className="text-[10px] text-white/30 mt-0.5">
              דרגה לפי ממוצע 2 חודשים אחרונים · ₪{Math.round(rankAmount).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 flex-none">
          <span
            className="rounded-md px-3 py-1 text-xs whitespace-nowrap"
            style={{ border: `1.5px solid ${rank.color}`, color: rank.color, fontWeight: 700 }}
          >
            {rank.label} · {rank.min === 0 ? '₪0' : `₪${rank.min / 1000}K`}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            הדרגה הנוכחית שלך
          </span>
        </div>
      </div>

      {/* Pin labels */}
      <div className="relative h-12 mb-1">
        {current > 0 && (
          <div
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-xs font-bold text-white leading-none">₪{(current / 1000).toFixed(1)}K</span>
            <span className="text-[10px] text-white/45 leading-none mt-0.5">{currentLabel}</span>
            <div className="mt-1 h-3 w-px bg-white/50" />
          </div>
        )}
        {best > 0 && best !== current && (
          <div
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${bestPct}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-xs font-bold leading-none" style={{ color: '#F5C118' }}>
              ₪{(best / 1000).toFixed(1)}K
            </span>
            <span className="text-[10px] leading-none mt-0.5" style={{ color: '#F5C118', opacity: 0.7 }}>{bestLabel}</span>
            <div className="mt-1 h-3 w-px" style={{ background: '#F5C118', opacity: 0.7 }} />
          </div>
        )}
      </div>

      {/* Bar + dots */}
      <div className="relative">
        {/* Gradient bar */}
        <div
          className="h-5 w-full rounded-full"
          style={{ background: BAR_GRADIENT }}
        />

        {/* Best dot — מאחורה */}
        {best > 0 && best !== current && (
          <div
            className="absolute top-1/2 h-5 w-5 rounded-full border-2 shadow-lg"
            style={{
              left: `${bestPct}%`,
              transform: 'translate(-50%, -50%)',
              background: '#F5C118',
              borderColor: '#F5C118',
              zIndex: 1,
            }}
          />
        )}

        {/* Now dot — מעל */}
        {current > 0 && (
          <div
            className="absolute top-1/2 h-6 w-6 rounded-full border-2 border-white shadow-lg"
            style={{
              left: `${currentPct}%`,
              transform: 'translate(-50%, -50%)',
              background: currentRankDisplay.color,
              zIndex: 2,
            }}
          />
        )}
      </div>

      {/* Bottom labels */}
      <div className="mt-2 flex justify-between text-[10px] text-white/30">
        {SEGMENTS.map(s => (
          <span key={s.label}>{s.min === 0 ? '₪0' : `₪${s.min / 1000}K`}</span>
        ))}
        <span>₪35K+</span>
      </div>
    </div>
  );
}

// ── Input helper ──────────────────────────────────────────────
function Input({ placeholder, value, onChange, type = 'text', min }) {
  const isNum = type === 'number';
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      // No negatives: min attr + block "-" and "e" keys + prevent scroll from changing value
      min={isNum ? (min ?? '0') : undefined}
      onKeyDown={isNum ? e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); } : undefined}
      onWheel={isNum ? e => e.currentTarget.blur() : undefined}
      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
      style={{
        background: 'rgb(var(--bg-elevated))',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'white',
      }}
    />
  );
}

// ── Monthly form components ────────────────────────────────

// ── Monthly form components ────────────────────────────────

const minput = {
  width: '100%', background: 'rgb(var(--bg-elevated))',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  padding: '9px 12px', fontSize: 14, color: 'rgba(255,255,255,0.9)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

function MSection({ icon, label, color = '#F5C118', children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 20px 16px', marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function MGrid({ cols = 2, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, alignItems: 'end' }}>
      {children}
    </div>
  );
}

function MField({ label, hint, required, children, full }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1 / -1' : undefined }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
        {label}{required && <span style={{ color: '#f87171', marginRight: 3 }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: -2 }}>{hint}</p>}
      {children}
    </div>
  );
}

function MInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={minput} onWheel={type === 'number' ? e => e.currentTarget.blur() : undefined} />
  );
}

// inject slider CSS once
if (typeof document !== 'undefined' && !document.getElementById('mslider-style')) {
  const s = document.createElement('style');
  s.id = 'mslider-style';
  s.textContent = `
    .mslider { -webkit-appearance:none; appearance:none; width:100%; height:6px;
      border-radius:99px; outline:none; cursor:pointer; }
    .mslider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none;
      width:22px; height:22px; border-radius:50%; background:#F5C118;
      border:3px solid #fff; box-shadow:0 0 14px rgba(245,193,24,0.65),0 2px 6px rgba(0,0,0,0.4);
      cursor:pointer; transition:transform 0.1s; }
    .mslider::-webkit-slider-thumb:hover { transform:scale(1.15); }
    .mslider::-moz-range-thumb { width:22px; height:22px; border-radius:50%;
      background:#F5C118; border:3px solid #fff; box-shadow:0 0 14px rgba(245,193,24,0.65);
      cursor:pointer; }
  `;
  document.head.appendChild(s);
}

function MSlider({ value, onChange, min = 1, max = 10 }) {
  const v = Number(value) || 0;
  // RTL: right=1(low), left=10(high). pct=0 at right, pct=100 at left.
  const pct = v > 0 ? ((v - min) / (max - min)) * 100 : 0;
  const trackRef = useRef(null);

  // Color: t=0 (right/low/1)=red → t=1 (left/high/10)=green
  function posColor(t) {
    const r = Math.round(239 - 205 * t);
    const g = Math.round(68  + 129 * t);
    const b = Math.round(0   + 94  * t);
    return `rgb(${r},${g},${b})`;
  }
  const currentColor = v > 0 ? posColor((v - min) / (max - min)) : 'rgba(255,255,255,0.2)';

  // RTL position calculation: right=low, left=high
  function calcValue(clientX) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return v;
    // Distance from RIGHT (where min=1 is)
    const fromRight = rect.right - clientX;
    const ratio = Math.max(0, Math.min(1, fromRight / rect.width));
    return Math.round(ratio * (max - min) + min);
  }

  function handleInteract(clientX) {
    onChange(String(calcValue(clientX)));
  }

  function onMouseDown(e) {
    e.preventDefault();
    handleInteract(e.clientX);
    const move = (ev) => handleInteract(ev.clientX);
    const up   = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function onTouchStart(e) {
    handleInteract(e.touches[0].clientX);
    const move = (ev) => handleInteract(ev.touches[0].clientX);
    const end  = () => { window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); };
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
  }

  return (
    <div>
      {/* Value */}
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'center', gap:4, marginBottom:14 }}>
        <span style={{ fontSize:40, fontWeight:900, lineHeight:1, color: currentColor,
          textShadow: v > 0 ? `0 0 24px ${currentColor}88` : 'none', transition:'color 0.2s, text-shadow 0.2s' }}>
          {v > 0 ? v : '—'}
        </span>
        <span style={{ fontSize:13, color:'rgba(255,255,255,0.2)' }}>/{max}</span>
      </div>

      {/* Track */}
      <div ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{ position:'relative', height:10, borderRadius:99, cursor:'pointer', margin:'0 6px', userSelect:'none' }}>

        {/* Gray base */}
        <div style={{ position:'absolute', inset:0, borderRadius:99, background:'rgba(255,255,255,0.08)' }} />

        {/* Dim full gradient backdrop */}
        <div style={{ position:'absolute', inset:0, borderRadius:99, opacity:0.18,
          background:'linear-gradient(to left, #ef4444, #eab308 50%, #22c55e)' }} />

        {/* Fill: grows from RIGHT (red/1) toward LEFT (green/10) */}
        {v > 0 && (
          <div style={{ position:'absolute', inset:0, borderRadius:99,
            background:'linear-gradient(to left, #ef4444, #eab308 50%, #22c55e)',
            clipPath:`inset(0 0 0 ${100 - pct}%)`,   /* clip from LEFT, reveal from RIGHT */
            transition:'clip-path 0.15s ease',
            boxShadow:`0 0 12px ${currentColor}77`,
          }} />
        )}

        {/* Thumb: right=0% when v=min, moves left as v increases */}
        <div style={{
          position:'absolute', top:'50%',
          right:`calc(${pct}% - 10px)`,
          transform:'translateY(-50%)',
          width:20, height:20, borderRadius:'50%',
          background: v > 0 ? currentColor : 'rgba(255,255,255,0.2)',
          border:'2.5px solid rgba(255,255,255,0.9)',
          boxShadow: v > 0 ? `0 0 0 4px ${currentColor}33, 0 3px 10px rgba(0,0,0,0.4)` : 'none',
          transition:'right 0.15s ease, background 0.2s',
          pointerEvents:'none', zIndex:2,
        }} />
      </div>

      {/* Labels: 1 on right, 10 on left */}
      <div style={{ display:'flex', justifyContent:'space-between', direction:'rtl', marginTop:10, padding:'0 6px' }}>
        {Array.from({length: max-min+1}, (_,i) => i+min).map(n => {
          const col = posColor((n-min)/(max-min));
          return (
            <span key={n} onClick={() => onChange(String(n))}
              style={{ fontSize:11, cursor:'pointer', userSelect:'none', transition:'all 0.1s',
                color: v===n ? col : n<=(v||0) ? `${col}55` : 'rgba(255,255,255,0.18)',
                fontWeight: v===n ? 900 : 400,
                transform: v===n ? 'scale(1.25)' : 'scale(1)', display:'inline-block',
              }}>{n}</span>
          );
        })}
      </div>
    </div>
  );
}

// Keep old Section/Field/RatingRow for non-monthly usage
function Section({ label, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <span className="text-[11px] font-semibold tracking-widest text-white/35 uppercase">{label}</span>
        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-white/85">
        {label}{required && <span className="text-red-400 mr-1">*</span>}
      </label>
      {hint && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{hint}</p>}
      {children}
    </div>
  );
}

function RatingRow({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <button key={n} type="button" onClick={() => onChange(String(n))}
          className="h-8 w-8 rounded-md text-sm font-semibold transition"
          style={{
            background: String(value) === String(n) ? '#F5C118' : 'rgb(var(--bg-elevated))',
            color:      String(value) === String(n) ? '#13152A'  : 'rgba(255,255,255,0.5)',
            border:     '1px solid rgba(255,255,255,0.1)',
          }}>
          {n}
        </button>
      ))}
    </div>
  );
}

function SubmitBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-90 bg-accent text-accent-foreground"
    >
      {children}
    </button>
  );
}

// ── Form field config (admin editable) ───────────────────────
const FORM_FIELDS_DEFAULT = [
  // business
  { section:'business', key:'total_new_deals',     label:'עסקאות חדשות שנסגרו (₪)', enabled:true,  required:true  },
  { section:'business', key:'retainers',            label:'ריטיינרים ותשלומים קבועים (₪)', enabled:true, required:false },
  { section:'business', key:'total_income',         label:'הכנסה כוללת (₪)',          enabled:true,  required:true  },
  { section:'business', key:'software_expenses',    label:'הוצאות תוכנות (₪)',        enabled:true,  required:true  },
  { section:'business', key:'variable_expenses',    label:'הוצאות משתנות (₪)',        enabled:true,  required:true  },
  { section:'business', key:'paid_ads',             label:'ממומן (₪)',                enabled:true,  required:true  },
  // sales
  { section:'sales', key:'sales_calls_set',         label:'שיחות שנקבעו',            enabled:true,  required:true  },
  { section:'sales', key:'sales_calls_showed',      label:'הגיעו לשיחה',             enabled:true,  required:true  },
  { section:'sales', key:'closings_count',          label:'נסגרו',                    enabled:true,  required:false },
  { section:'sales', key:'leads',                   label:'לידים שהגיעו',            enabled:true,  required:true  },
  { section:'sales', key:'proposals',               label:'הצעות שהצעתי',            enabled:true,  required:true  },
  { section:'sales', key:'active_clients',          label:'לקוחות פעילים',           enabled:true,  required:true  },
  { section:'sales', key:'price_quotes_sent',       label:'הצעות מחיר נשלחו',        enabled:true,  required:false },
  { section:'sales', key:'price_quotes_approved',   label:'הצעות מחיר אושרו',        enabled:true,  required:false },
  { section:'sales', key:'strategy_calls',          label:'שיחות אסטרטגיה',          enabled:true,  required:false },
  // content
  { section:'content', key:'followers',             label:'עוקבים',                  enabled:true,  required:true  },
  { section:'content', key:'reach',                 label:'Reach',                    enabled:true,  required:true  },
  { section:'content', key:'posts_count',           label:'פוסטים',                  enabled:true,  required:true  },
  // focus
  { section:'focus', key:'biggest_win',             label:'הנצחון הגדול ביותר עם לקוח', enabled:true, required:true },
  { section:'focus', key:'main_project',            label:'הפוקוס המרכזי החודש',     enabled:true,  required:true  },
  { section:'focus', key:'systems_needed',          label:'מה אתם צריכים החודש?',    enabled:false, required:false },
  { section:'focus', key:'nps',                     label:'כמה תמליץ על התוכנית? (1-10)', enabled:true, required:true },
  { section:'focus', key:'program_feedback',        label:'המלצות לשיפור התוכנית',   enabled:false, required:false },
];

const FORM_CONFIG_KEY = 'form_fields_config';

function loadFormConfig() {
  try { return JSON.parse(localStorage.getItem(FORM_CONFIG_KEY)) || FORM_FIELDS_DEFAULT; }
  catch { return FORM_FIELDS_DEFAULT; }
}
function saveFormConfig(cfg) {
  localStorage.setItem(FORM_CONFIG_KEY, JSON.stringify(cfg));
}

// Admin form editor modal
function FormConfigEditor({ onClose }) {
  const [fields, setFields] = useState(loadFormConfig);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');

  const sections = { business:'💰 ביצועים עסקיים', sales:'🤝 שיחות ומכירות', content:'📱 תוכן וקהילה', focus:'🔮 פוקוס ופידבק' };

  function toggle(key) {
    setFields(f => f.map(field => field.key === key ? { ...field, enabled: !field.enabled } : field));
  }
  function startEdit(key, label) { setEditingKey(key); setDraft(label); }
  function saveEdit(key) {
    setFields(f => f.map(field => field.key === key ? { ...field, label: draft.trim() || field.label } : field));
    setEditingKey(null);
  }
  function save() { saveFormConfig(fields); onClose(); }
  function reset() { setFields(FORM_FIELDS_DEFAULT); }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20 }}>
        {/* Header */}
        <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <h2 style={{ fontSize:16, fontWeight:700, color:'white', margin:0 }}>⚙️ עריכת שדות הטופס</h2>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>הפעל/כבה שדות, ערוך טקסטים — נשמר לכל התלמידים</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', display:'flex' }}><X size={18} /></button>
        </div>

        {/* Fields list */}
        <div style={{ overflowY:'auto', padding:'12px 16px', flex:1 }}>
          {Object.entries(sections).map(([sec, secLabel]) => {
            const secFields = fields.filter(f => f.section === sec);
            return (
              <div key={sec} style={{ marginBottom:16 }}>
                <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, paddingRight:4 }}>{secLabel}</p>
                {secFields.map(field => (
                  <div key={field.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, marginBottom:4,
                    background: field.enabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
                    border:`1px solid ${field.enabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                    opacity: field.enabled ? 1 : 0.5,
                  }}>
                    {/* Toggle */}
                    <button type="button" onClick={() => toggle(field.key)} style={{ background:'none', border:'none', cursor:'pointer', color: field.enabled ? '#F5C118' : 'rgba(255,255,255,0.25)', display:'flex', flexShrink:0, padding:0 }}>
                      {field.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                    {/* Label */}
                    <div style={{ flex:1, minWidth:0 }}>
                      {editingKey === field.key ? (
                        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                          onKeyDown={e => { if(e.key==='Enter') saveEdit(field.key); if(e.key==='Escape') setEditingKey(null); }}
                          onBlur={() => saveEdit(field.key)}
                          style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(245,193,24,0.4)', borderRadius:6, padding:'3px 8px', fontSize:13, color:'white', outline:'none', fontFamily:'inherit' }} />
                      ) : (
                        <span style={{ fontSize:13, color: field.enabled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)', cursor:'text' }}
                          onClick={() => startEdit(field.key, field.label)}>
                          {field.label}
                        </span>
                      )}
                    </div>
                    {/* Edit icon */}
                    <button type="button" onClick={() => startEdit(field.key, field.label)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.2)', display:'flex', flexShrink:0, padding:2 }}>
                      <Edit2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:10, flexShrink:0 }}>
          <button onClick={reset} style={{ padding:'9px 16px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
            איפוס לברירת מחדל
          </button>
          <button onClick={save} style={{ flex:1, padding:'9px 16px', borderRadius:8, background:'#F5C118', border:'none', color:'#13152A', fontWeight:800, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
            שמור שינויים ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────
const CONFETTI_COLORS = ['#F5C118','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#a855f7','#ec4899'];

function Confetti({ active, onDone }) {
  const [pieces] = useState(() =>
    Array.from({ length: 70 }, (_, i) => ({
      id:       i,
      left:     Math.random() * 100,
      delay:    Math.random() * 2.2,
      duration: 2.2 + Math.random() * 2,
      color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size:     6 + (i % 6) * 1.5,
      isCircle: i % 3 !== 0,
    }))
  );

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => onDone?.(), 5000);
    return () => clearTimeout(t);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 200 }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-30px) rotate(0deg)   scaleX(1);  opacity: 1; }
          50%  { transform: translateY(50vh)  rotate(360deg) scaleX(-1); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg) scaleX(1);  opacity: 0; }
        }
      `}</style>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position:     'absolute',
            left:         `${p.left}%`,
            top:          0,
            width:        p.size,
            height:       p.size,
            background:   p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            animation:    `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ── Rank-up banner ────────────────────────────────────────────
function RankUpBanner({ rank, onClose }) {
  if (!rank) return null;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 201, background: 'rgba(0,0,0,0.65)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl"
        style={{ background: 'rgb(var(--bg-surface))', border: `2px solid ${rank.color}` }}
      >
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-1">מזל טוב!</h2>
        <p className="text-white/50 text-sm mb-5">עלית דרגה!</p>
        <div
          className="inline-block rounded-xl px-5 py-2.5 text-lg font-bold mb-7"
          style={{ background: rank.color + '22', color: rank.color, border: `1.5px solid ${rank.color}` }}
        >
          {rank.label}
          <span className="block text-xs font-normal mt-0.5 opacity-70">
            ₪{rank.min === 0 ? '0' : `${rank.min / 1000}K`}+
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-80"
          style={{ background: rank.color, color: '#13152A' }}
        >
          יאללה קדימה! 🚀
        </button>
      </div>
    </div>
  );
}

// ── Default labels ────────────────────────────────────────────
const DEFAULT_LABELS = {
  stat_new_deals:     'לקוחות חדשים החודש',
  stat_active:        'לקוחות פעילים',
  stat_posts:         'פוסטים החודש',
  stat_total_deals:   'סה״כ עסקאות החודש',
  section_progress:   'ההתקדמות שלך',
  section_streak:     'ניצחונות ראשון · רצף',
  section_focus:      'הפוקוס שלי לחודש',
};

// ── EditableText ──────────────────────────────────────────────
function EditableText({ labelKey, labels, onSave, editMode, className, style, as: Tag = 'span' }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const inputRef              = useRef(null);
  const value                 = labels[labelKey] ?? DEFAULT_LABELS[labelKey] ?? labelKey;

  function startEdit() {
    if (!editMode) return;
    setDraft(value);
    setEditing(true);
  }

  function save() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(labelKey, trimmed);
  }

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter')  save();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={className}
        style={{
          ...style,
          background: 'transparent',
          border: 'none',
          outline: '1px solid rgba(245,193,24,0.6)',
          borderRadius: 4,
          padding: '1px 6px',
          minWidth: 80,
          width: Math.max(value.length * 12, 80) + 'px',
        }}
      />
    );
  }

  return (
    <Tag
      className={className}
      style={{
        ...style,
        ...(editMode ? {
          cursor: 'text',
          borderBottom: '1px dashed rgba(245,193,24,0.4)',
          paddingBottom: 1,
        } : {}),
      }}
      onDoubleClick={startEdit}
      title={editMode ? 'לחץ פעמיים לעריכה' : undefined}
    >
      {value}
    </Tag>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useUser();
  const userId    = user?.id;
  const firstName = user?.firstName || 'there';
  const isAdmin   = useIsAdmin();

  const [labelEditMode, setLabelEditMode] = useState(false);
  const [labels,        setLabels]        = useState(DEFAULT_LABELS);

  const [modal, setModal]               = useState(null);
  const [winStep, setWinStep]           = useState(1);
  const [showFormEditor,  setShowFormEditor]  = useState(false);
  const [formConfig,      setFormConfig]      = useState(loadFormConfig);
  // Helper: get field config by key
  const fc = key => formConfig.find(f => f.key === key) ?? { enabled: true, label: key, required: false };
  const [monthlyData, setMonthlyData]   = useState([]);
  const [wins, setWins]                 = useState([]);
  const [deals, setDeals]               = useState([]);
  const [chartRange, setChartRange]     = useState('6M');
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [editSelectedId,    setEditSelectedId]    = useState('');

  const [confetti,         setConfetti]         = useState(false);
  const [rankUpRank,       setRankUpRank]       = useState(null); // null | SEGMENTS item
  const [dealProjectModal, setDealProjectModal] = useState(null); // { totalAmount, receivedAmount }
  const [nextTask,         setNextTask]         = useState(undefined); // undefined=loading, null=none, obj=task
  const [upcomingMeetings, setUpcomingMeetings] = useState(null);     // null=loading, []=none

  const navigate = useNavigate();

  const [dealForm,    setDealForm]    = useState({ total_amount: '', received_amount: '', next_rank: '' });
  const [winForm,     setWinForm]     = useState({ win_1: '', win_2: '', win_3: '', focus_next_week: '', blocker: '' });
  const [monthlyForm, setMonthlyForm] = useState({
    report_month: '', total_new_deals: '', retainers: '', total_income: '',
    software_expenses: '', variable_expenses: '', paid_ads: '',
    current_rank: '', achieved_next_rank: '', business_confidence: '',
    sales_calls_set: '', sales_calls_showed: '', closings_count: '', strategy_calls: '',
    leads: '', proposals: '', price_quotes_sent: '', price_quotes_approved: '', active_clients: '',
    followers: '', reach: '', posts_count: '', content_confidence: '',
    biggest_win: '', main_project: '', systems_needed: '',
    nps: '', program_feedback: '',
  });

  // Load dashboard labels
  useEffect(() => {
    async function loadLabels() {
      const { data } = await supabase.from('dashboard_labels').select('id, value');
      if (data?.length) {
        const merged = { ...DEFAULT_LABELS };
        data.forEach(row => { merged[row.id] = row.value; });
        setLabels(merged);
      }
    }
    loadLabels();
  }, []);

  // Load upcoming Zoom meetings (independent of user data)
  useEffect(() => {
    fetch('/api/zoom/upcoming')
      .then(r => r.ok ? r.json() : { meetings: [] })
      .then(({ meetings }) => setUpcomingMeetings(meetings || []))
      .catch(() => setUpcomingMeetings([]));
  }, []);

  async function saveLabel(key, value) {
    setLabels(prev => ({ ...prev, [key]: value }));
    await supabase.from('dashboard_labels').upsert({ id: key, value, updated_at: new Date().toISOString() });
  }

  useEffect(() => {
    if (!userId) return;
    // שמור פרופיל תלמיד (לשימוש בעמוד הניהול)
    supabase.from('student_profiles').upsert({
      user_id:    userId,
      first_name: user?.firstName || '',
      last_name:  user?.lastName  || '',
      email:      user?.primaryEmailAddress?.emailAddress || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    fetchAll();
  }, [userId]);

  async function fetchAll() {
    const [
      { data: md },
      { data: wd },
      { data: dd },
      { data: pData },
      { data: wkData },
      { data: tData },
      { data: cData },
    ] = await Promise.all([
      supabase.from('monthly_submissions').select('*').eq('user_id', userId).order('month'),
      supabase.from('sunday_wins').select('*').eq('user_id', userId).order('week_date', { ascending: false }),
      supabase.from('deals').select('total_amount, received_amount, created_at').eq('user_id', userId),
      supabase.from('roadmap_phases').select('id, title, sort_order').order('sort_order'),
      supabase.from('roadmap_weeks').select('id, phase_id, title, sort_order').order('sort_order'),
      supabase.from('roadmap_tasks').select('id, week_id, title, link, sort_order').order('sort_order'),
      supabase.from('roadmap_completions').select('task_id').eq('user_id', userId),
    ]);
    setMonthlyData(md || []);
    setWins(wd || []);
    setDeals(dd || []);

    // Compute next uncompleted roadmap task (phase → week → task order)
    const completedIds = new Set((cData || []).map(c => c.task_id));
    const phases = (pData  || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const weeks  = (wkData || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const tasks  = (tData  || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    let found = null;
    outer: for (const phase of phases) {
      const phaseWeeks = weeks.filter(w => w.phase_id === phase.id);
      for (const week of phaseWeeks) {
        const weekTasks = tasks.filter(t => t.week_id === week.id);
        for (const task of weekTasks) {
          if (!completedIds.has(task.id)) {
            found = { ...task, weekTitle: week.title, phaseTitle: phase.title };
            break outer;
          }
        }
      }
    }
    setNextTask(found);
  }

  // Derived
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-06" — used only for deal filtering

  // Sort all submissions once
  const sortedMonthly = [...monthlyData].sort((a, b) => new Date(a.month) - new Date(b.month));

  // ── Always show the LAST REPORTED month, not the current calendar month ──
  const currentSubmission = sortedMonthly.length > 0 ? sortedMonthly[sortedMonthly.length - 1] : null;

  // First submission = student has never submitted before AND is not editing
  const isFirstSubmission = monthlyData.length === 0 && !editingSubmission;
  // Prefer total_income (the explicit field); fall back to amount; fall back to 0
  const currentAmount = currentSubmission != null
    ? (currentSubmission.total_income ?? currentSubmission.amount ?? 0)
    : 0;
  const bestAmount = Math.max(0, ...monthlyData.map(m => m.total_income ?? m.amount ?? 0));
  // ── Streak calculations ──────────────────────────────────────────────────
  const { currentStreak, longestStreak, weeklyHistory } = useMemo(() => {
    const NUM_WEEKS = 16;
    const empty = { currentStreak: 0, longestStreak: 0, weeklyHistory: Array(NUM_WEEKS).fill(false) };
    if (!wins.length) return empty;

    const sorted = [...wins]
      .filter(w => w.week_date)
      .sort((a, b) => new Date(a.week_date) - new Date(b.week_date));
    if (!sorted.length) return empty;

    // Longest streak ever
    let longest = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i].week_date) - new Date(sorted[i - 1].week_date)) / 86400000;
      if (diff <= 9) { run++; if (run > longest) longest = run; }
      else run = 1;
    }

    // Current streak (active only if last win ≤ 10 days ago)
    const daysSinceLast = (Date.now() - new Date(sorted[sorted.length - 1].week_date)) / 86400000;
    let current = 0;
    if (daysSinceLast <= 10) {
      current = 1;
      for (let i = sorted.length - 2; i >= 0; i--) {
        const diff = (new Date(sorted[i + 1].week_date) - new Date(sorted[i].week_date)) / 86400000;
        if (diff <= 9) current++;
        else break;
      }
    }

    // Weekly history grid — last NUM_WEEKS weeks
    const today = new Date();
    const history = Array.from({ length: NUM_WEEKS }, (_, i) => {
      const wEnd = new Date(today);
      wEnd.setDate(today.getDate() - i * 7);
      const wStart = new Date(wEnd);
      wStart.setDate(wEnd.getDate() - 7);
      return wins.some(w => {
        if (!w.week_date) return false;
        const d = new Date(w.week_date);
        return d > wStart && d <= wEnd;
      });
    }).reverse();

    return { currentStreak: current, longestStreak: Math.max(longest, current), weeklyHistory: history };
  }, [wins]);

  // חישוב דרגה לפי ממוצע 2 חודשים אחרונים ברצף
  const last2 = sortedMonthly.slice(-2);
  const getAmt = m => m.total_income ?? m.amount ?? 0;
  const rankAmount = last2.length >= 2
    ? (getAmt(last2[0]) + getAmt(last2[1])) / 2
    : getAmt(last2[0] ?? {});

  const rangeMonths = { '3M': 3, '6M': 6, '1Y': 12 };

  const allChartData = [...monthlyData]
    .sort((a, b) => new Date(a.month) - new Date(b.month))
    .map(m => {
      const d = new Date(m.month);
      return {
        month:   isNaN(d) ? m.month?.slice(0, 7) : d.toLocaleString('he-IL', { month: 'short', year: '2-digit' }),
        revenue: m.total_income ?? m.amount ?? 0,
      };
    });

  // RTL: newest month on the left → reverse so recharts index-0 = newest (leftmost)
  const chartData = allChartData.slice(-rangeMonths[chartRange]).reverse();

  // ── Stat cards ───────────────────────────────────────────────
  const activeClients     = currentSubmission?.active_clients ?? null;
  const postsCount        = currentSubmission?.posts_count    ?? null;
  const newDealsThisMonth = deals.filter(d => d.created_at?.slice(0, 7) === currentMonth).length;
  const totalNewDeals     = currentSubmission?.total_new_deals ?? null;
  const proposalsCount    = currentSubmission?.proposals       ?? null;

  // ── תמיד מציג את החודש האחרון שדווח עליו ──
  const latestMonthLabel = currentSubmission
    ? new Date(currentSubmission.month).toLocaleString('he-IL', { month: 'long', year: 'numeric' })
    : new Date().toLocaleString('he-IL', { month: 'long', year: 'numeric' });
  const latestAmount = currentAmount;

  // השוואה: ההגשה שלפני האחרונה
  const prevSubmission = sortedMonthly.length >= 2 ? sortedMonthly[sortedMonthly.length - 2] : null;
  const prevAmount     = prevSubmission != null
    ? (prevSubmission.total_income ?? prevSubmission.amount ?? 0)
    : 0;
  const prevMonthLabel = prevSubmission
    ? new Date(prevSubmission.month).toLocaleString('he-IL', { month: 'long' })
    : null;

  // ── לגרף ProgressBar: תוויות חודש ──
  const currentMonthShort = currentSubmission
    ? new Date(currentSubmission.month).toLocaleString('he-IL', { month: 'short' })
    : null;
  const bestSubmission = bestAmount > 0
    ? sortedMonthly.find(m => (m.total_income ?? m.amount ?? 0) === bestAmount)
    : null;
  const bestMonthShort = bestSubmission && bestSubmission !== currentSubmission
    ? new Date(bestSubmission.month).toLocaleString('he-IL', { month: 'short' })
    : 'שיא';

  // ── Next Action derived values ───────────────────────────────
  const todayDate    = new Date();
  const todayStr     = todayDate.toISOString().slice(0, 10); // "2026-06-01"
  // Sunday reminder: only if today is Sunday AND no win submitted today yet
  const isSunday     = todayDate.getDay() === 0 &&
    !wins.some(w => w.week_date === todayStr);
  // Month-start reminder: only if days 1-7 AND no submission for the PREVIOUS month yet
  // (at the start of June we remind to report May, not June)
  const prevMonth    = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1)
    .toISOString().slice(0, 7); // e.g. "2026-05"
  const isMonthStart = todayDate.getDate() <= 7 &&
    !monthlyData.some(m => m.month?.slice(0, 7) === prevMonth);
  // Max 2 items — time-sensitive reminders take priority over roadmap task
  const reminderCount   = (isSunday ? 1 : 0) + (isMonthStart ? 1 : 0);
  const showRoadmapTask = nextTask != null && reminderCount < 2;

  // Submit handlers
  async function submitDeal() {
    if (!dealForm.total_amount) return;

    const date = new Date().toISOString().slice(0, 10);

    await supabase.from('deals').insert({
      user_id:          userId,
      amount:           parseFloat(dealForm.total_amount),
      total_amount:     parseFloat(dealForm.total_amount),
      received_amount:  parseFloat(dealForm.received_amount) || 0,
      next_rank:        dealForm.next_rank,
    });

    // שלח לסלאק
    try {
      await fetch('/api/slack/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:             user?.firstName || 'תלמיד',
          total_amount:     dealForm.total_amount,
          received_amount:  dealForm.received_amount,
          next_rank:        dealForm.next_rank,
          date,
        }),
      });
    } catch (e) {
      console.error('Slack deal error:', e);
    }

    const submittedAmount    = dealForm.total_amount;
    const submittedReceived  = dealForm.received_amount;
    setDealForm({ total_amount: '', received_amount: '', next_rank: '' });
    setModal(null);
    fetchAll();

    // 🎉 קונפטי
    confettiLib({ particleCount: 120, spread: 70, origin: { x: 0.5, y: 0.55 }, colors: ['#F5C118', '#22c55e', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c'], scalar: 1.1 });
    setTimeout(() => confettiLib({ particleCount: 60, angle: 60,  spread: 55, origin: { x: 0, y: 0.6 }, colors: ['#F5C118', '#22c55e', '#60a5fa'] }), 150);
    setTimeout(() => confettiLib({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: ['#f472b6', '#a78bfa', '#fb923c'] }), 300);

    // פופאפ פתיחת פרויקט
    setTimeout(() => setDealProjectModal({ totalAmount: submittedAmount, receivedAmount: submittedReceived }), 600);
  }

  async function submitWin() {
    if (!winForm.win_1.trim()) return;

    const date = new Date().toISOString().slice(0, 10);

    // שמור ב-Supabase
    await supabase.from('sunday_wins').insert({
      user_id:         userId,
      wins:            winForm.win_1,
      win_1:           winForm.win_1,
      win_2:           winForm.win_2,
      win_3:           winForm.win_3,
      focus_next_week: winForm.focus_next_week,
      blocker:         winForm.blocker,
      week_date:       date,
    });

    // שלח לסלאק
    try {
      await fetch('/api/slack/wins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            user?.firstName || 'תלמיד',
          win_1:           winForm.win_1,
          win_2:           winForm.win_2,
          win_3:           winForm.win_3,
          focus_next_week: winForm.focus_next_week,
          blocker:         winForm.blocker,
          date,
        }),
      });
    } catch (e) {
      console.error('Slack error:', e);
    }

    setWinForm({ win_1: '', win_2: '', win_3: '', focus_next_week: '', blocker: '' });
    setModal(null);
    fetchAll();
  }

  function openEditMonth(submission) {
    setEditingSubmission(submission);
    const s = submission;
    setMonthlyForm({
      report_month:         (s.month || s.report_month)?.slice(0, 7) || '',
      total_new_deals:      s.total_new_deals?.toString()      || '',
      retainers:            s.retainers?.toString()            || '',
      total_income:         (s.total_income ?? s.amount)?.toString() || '',
      software_expenses:    s.software_expenses?.toString()    || '',
      variable_expenses:    s.variable_expenses?.toString()    || '',
      paid_ads:             s.paid_ads?.toString()             || '',
      current_rank:         s.current_rank                     || '',
      achieved_next_rank:   s.achieved_next_rank               || '',
      business_confidence:  s.business_confidence?.toString()  || '',
      sales_calls_set:      s.sales_calls_set?.toString()      || '',
      sales_calls_showed:   s.sales_calls_showed?.toString()   || '',
      closings_count:       s.closings_count?.toString()       || '',
      strategy_calls:       s.strategy_calls?.toString()       || '',
      leads:                s.leads?.toString()                || '',
      proposals:            s.proposals?.toString()            || '',
      price_quotes_sent:     s.price_quotes_sent?.toString()     || '',
      price_quotes_approved: s.price_quotes_approved?.toString() || '',
      active_clients:       s.active_clients?.toString()       || '',
      followers:            s.followers?.toString()            || '',
      reach:                s.reach?.toString()                || '',
      posts_count:          s.posts_count?.toString()          || '',
      content_confidence:   s.content_confidence?.toString()   || '',
      biggest_win:          s.biggest_win                      || '',
      main_project:         s.main_project                     || '',
      systems_needed:       s.systems_needed                   || '',
      nps:                  s.nps?.toString()                  || '',
      program_feedback:     s.program_feedback                 || '',
    });
    setModal('monthly');
  }

  async function submitMonthly() {
    if (!monthlyForm.report_month) return;
    const n = v => v ? parseFloat(v) : null;
    const i = v => v ? parseInt(v) : null;
    // type="month" נותן "2026-04" — Supabase צריך תאריך מלא
    const fullDate = monthlyForm.report_month + '-01';

    // ── Rank auto-calculation ─────────────────────────────────
    let finalRank          = monthlyForm.current_rank || null;
    let pendingUpgradeData = null; // filled when rank upgrade needs admin approval

    if (!editingSubmission && !isFirstSubmission) {
      const sorted = [...monthlyData].sort((a, b) => new Date(a.month) - new Date(b.month));

      // Current rank = taken from the most recent stored submission
      const latestSub        = sorted[sorted.length - 1];
      const currentRankLabel = latestSub.current_rank || SEGMENTS[0].label;
      const currentRankObj   = SEGMENTS.find(s => s.label === currentRankLabel) || SEGMENTS[0];

      // "Real" submissions = everything AFTER the first (manual) submission.
      // The first submission is just a starting-point selection — its income
      // does NOT participate in the 2-month average.
      const realSubmissions = sorted.slice(1);

      if (realSubmissions.length === 0) {
        // This is the 2nd submission overall (1st real data month).
        // Need TWO consecutive real months before we can upgrade → keep rank.
        finalRank = currentRankLabel;
      } else {
        // 3rd+ submission: avg of last real month income + new income
        const lastReal       = realSubmissions[realSubmissions.length - 1];
        const lastRealIncome = lastReal.total_income ?? lastReal.amount ?? 0;
        const newIncome      = parseFloat(monthlyForm.total_income) || 0;
        const avg            = (lastRealIncome + newIncome) / 2;

        const newRankObj = getRank(avg);
        if (newRankObj.min > currentRankObj.min) {
          // Rank upgrade! Apply immediately + queue for admin Slack approval
          finalRank = newRankObj.label;
          pendingUpgradeData = {
            user_id:        userId,
            first_name:     user?.firstName || '',
            current_rank:   currentRankLabel,
            proposed_rank:  newRankObj.label,
            month_1:        lastReal.month,
            month_1_income: lastRealIncome,
            month_2:        fullDate,
            month_2_income: newIncome,
            avg_income:     avg,
          };
        } else {
          // Never downgrade — keep current rank
          finalRank = currentRankLabel;
        }
      }
    }
    // ─────────────────────────────────────────────────────────

    const payload = {
      user_id:              userId,
      month:                fullDate,
      report_month:         fullDate,
      amount:               n(monthlyForm.total_income) ?? n(monthlyForm.total_new_deals),
      total_new_deals:      n(monthlyForm.total_new_deals),
      retainers:            n(monthlyForm.retainers),
      total_income:         n(monthlyForm.total_income),
      software_expenses:    n(monthlyForm.software_expenses),
      variable_expenses:    n(monthlyForm.variable_expenses),
      paid_ads:             n(monthlyForm.paid_ads),
      current_rank:         finalRank,
      // achieved_next_rank only for first submission or editing; auto-cleared after
      achieved_next_rank:   (isFirstSubmission || editingSubmission)
                              ? (monthlyForm.achieved_next_rank || null)
                              : null,
      business_confidence:  i(monthlyForm.business_confidence),
      sales_calls_set:      i(monthlyForm.sales_calls_set),
      sales_calls_showed:   i(monthlyForm.sales_calls_showed),
      closings_count:       i(monthlyForm.closings_count),
      strategy_calls:       i(monthlyForm.strategy_calls),
      leads:                i(monthlyForm.leads),
      proposals:            i(monthlyForm.proposals),
      price_quotes_sent:     i(monthlyForm.price_quotes_sent),
      price_quotes_approved: i(monthlyForm.price_quotes_approved),
      active_clients:       i(monthlyForm.active_clients),
      followers:            i(monthlyForm.followers),
      reach:                i(monthlyForm.reach),
      posts_count:          i(monthlyForm.posts_count),
      content_confidence:   i(monthlyForm.content_confidence),
      biggest_win:          monthlyForm.biggest_win || null,
      main_project:         monthlyForm.main_project || null,
      systems_needed:       monthlyForm.systems_needed || null,
      nps:                  i(monthlyForm.nps),
      program_feedback:     monthlyForm.program_feedback || null,
    };

    if (editingSubmission) {
      // Editing existing record (opened via "עריכת נתונים")
      await supabase.from('monthly_submissions').update(payload).eq('id', editingSubmission.id);
      setEditingSubmission(null);
    } else {
      // New submission (opened via "נתונים חודשיים") — always insert
      await supabase.from('monthly_submissions').insert(payload);
    }

    // Save pending request for admin to see (Slack sent only when admin approves)
    if (pendingUpgradeData) {
      await supabase.from('rank_upgrade_requests').insert(pendingUpgradeData);
    }

    setMonthlyForm({
      report_month: '', total_new_deals: '', retainers: '', total_income: '',
      software_expenses: '', variable_expenses: '', paid_ads: '',
      current_rank: '', achieved_next_rank: '', business_confidence: '',
      sales_calls_set: '', sales_calls_showed: '', closings_count: '', strategy_calls: '',
      leads: '', proposals: '', price_quotes_sent: '', price_quotes_approved: '', active_clients: '',
      followers: '', reach: '', posts_count: '', content_confidence: '',
      biggest_win: '', main_project: '', systems_needed: '',
      nps: '', program_feedback: '',
    });
    setModal(null);

    // Show confetti immediately when rank upgraded (no admin approval needed)
    if (pendingUpgradeData) {
      const rankObj = SEGMENTS.find(s => s.label === pendingUpgradeData.proposed_rank);
      if (rankObj) {
        setRankUpRank(rankObj);
        setConfetti(true);
      }
    }

    fetchAll();
  }

  const btnClass = "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 transition";
  const btnStyle = { borderColor: 'rgba(255,255,255,0.15)' };

  return (
    <div className="w-full space-y-6">

      {/* ── Greeting + action buttons ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white">{getGreeting()}, {firstName}.</h1>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button onClick={() => { setWinStep(1); setModal('win'); }} className={btnClass} style={btnStyle}><Trophy size={15} /> נצחונות שבועיים</button>
          <button
            onClick={() => {
              // Always open a fresh form — editing existing data is via "עריכת נתונים"
              setMonthlyForm({
                report_month: currentMonth,
                total_new_deals: '', retainers: '', total_income: '',
                software_expenses: '', variable_expenses: '', paid_ads: '',
                current_rank: '', achieved_next_rank: '', business_confidence: '',
                sales_calls_set: '', sales_calls_showed: '', closings_count: '', strategy_calls: '',
                leads: '', proposals: '', price_quotes_sent: '', price_quotes_approved: '', active_clients: '',
                followers: '', reach: '', posts_count: '', content_confidence: '',
                biggest_win: '', main_project: '', systems_needed: '',
                nps: '', program_feedback: '',
              });
              setEditingSubmission(null);
              setModal('monthly');
            }}
            className={btnClass} style={btnStyle}
          >
            <Calendar size={15} /> נתונים חודשיים
          </button>
          <button onClick={() => setModal('deal')}    className={btnClass} style={btnStyle}><Plus     size={15} /> עסקה חדשה</button>
          <button onClick={() => setModal('edit')} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 transition"><Edit2 size={15} /> עריכת נתונים</button>
          {isAdmin && (
            <button
              onClick={() => setLabelEditMode(m => !m)}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-white/10"
              style={labelEditMode
                ? { borderColor: 'rgba(245,193,24,0.6)', color: '#F5C118' }
                : btnStyle
              }
            >
              <Settings2 size={15} />
              {labelEditMode ? 'סיום עריכה' : 'עריכה'}
            </button>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <ProgressBar
        current={currentAmount}
        best={bestAmount}
        rankAmount={rankAmount}
        monthsCount={last2.length}
        currentLabel={
          currentMonthShort
            ? (bestAmount > 0 && bestAmount === currentAmount
                ? `${currentMonthShort} · שיא 🏆`
                : currentMonthShort)
            : 'אחרון'
        }
        bestLabel={bestMonthShort}
        sectionLabel={
          <EditableText
            labelKey="section_progress"
            labels={labels}
            onSave={saveLabel}
            editMode={labelEditMode}
            className="text-sm"
            style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}
          />
        }
      />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            icon:     <Banknote size={18} />,
            labelKey: 'stat_total_deals',
            label:    'סך עסקאות חדשות',
            value:    totalNewDeals !== null ? '₪' + totalNewDeals.toLocaleString('he-IL') : '—',
            suffix:   '',
            color:    '#F5C118',
          },
          {
            icon:     <Users size={18} />,
            labelKey: 'stat_new_clients',
            label:    'לקוחות חדשים',
            value:    newDealsThisMonth > 0 ? newDealsThisMonth : (activeClients !== null ? activeClients : '—'),
            suffix:   'לקוחות',
            color:    '#4fc38a',
          },
          {
            icon:     <Plus size={18} />,
            labelKey: 'stat_proposals',
            label:    'הצעות שהצעתי',
            value:    proposalsCount !== null ? proposalsCount : '—',
            suffix:   proposalsCount !== null ? 'הצעות' : '',
            color:    '#06b6d4',
          },
          {
            icon:     <Image size={18} />,
            labelKey: 'stat_posts',
            label:    'פוסטים שפרסמתי',
            value:    postsCount !== null ? postsCount : '—',
            suffix:   postsCount !== null ? 'פוסטים' : '',
            color:    '#a855f7',
          },
        ].map(({ icon, labelKey, label, value, suffix, color }) => (
          <div
            key={labelKey}
            className="rounded-2xl p-3 sm:p-5 flex items-center gap-2 sm:gap-4"
            style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="flex-none h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: color + '1a', color }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs mb-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {label}
              </div>
              <div dir="ltr" className="text-base sm:text-xl lg:text-2xl font-bold text-white leading-none truncate text-right">{value}</div>
              {suffix && <div className="text-[10px] sm:text-[11px] text-white/30 mt-0.5">{suffix}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 gap-6 wide:grid-cols-2">

        {/* Left column — streak + next-action + focus */}
        <div className="flex flex-col gap-6 order-last wide:order-first">

          {/* Streak + Next Action row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Next Action block */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  הצעד הבא
                </span>
                <span className="text-sm font-semibold text-white">היום</span>
              </div>

              {/* Action items */}
              <div className="flex flex-col gap-2">

                {/* Sunday reminder */}
                {isSunday && (
                  <div
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="flex-none h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    >
                      <Trophy size={16} style={{ color: 'rgba(255,255,255,0.65)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">שלח נצחונות שבועיים</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>שתף את הנצחונות שלך מהשבוע</p>
                    </div>
                    <button
                      onClick={() => { setWinStep(1); setModal('win'); }}
                      className="flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                      style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
                    >
                      שלח
                    </button>
                  </div>
                )}

                {/* Month-start reminder */}
                {isMonthStart && (
                  <div
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="flex-none h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    >
                      <Calendar size={16} style={{ color: 'rgba(255,255,255,0.65)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">מלא נתונים חודשיים</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>סיכום חודשי לחודש הנוכחי</p>
                    </div>
                    <button
                      onClick={() => setModal('monthly')}
                      className="flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                      style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
                    >
                      שלח
                    </button>
                  </div>
                )}

                {/* Next roadmap task — shown only if fewer than 2 reminders */}
                {showRoadmapTask && (
                  <div
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="flex-none h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    >
                      <ListChecks size={16} style={{ color: 'rgba(255,255,255,0.65)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight line-clamp-1">{nextTask.title}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        {nextTask.phaseTitle}{nextTask.weekTitle ? ` · ${nextTask.weekTitle}` : ''}
                      </p>
                    </div>
                    {nextTask.link ? (
                      <a
                        href={nextTask.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-none flex items-center gap-0.5 text-xs font-semibold transition hover:text-white"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                      >
                        פתח <ChevronLeft size={13} />
                      </a>
                    ) : (
                      <button
                        onClick={() => navigate('/roadmap')}
                        className="flex-none flex items-center gap-0.5 text-xs font-semibold transition hover:text-white"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                      >
                        פתח <ChevronLeft size={13} />
                      </button>
                    )}
                  </div>
                )}

                {/* All done */}
                {nextTask === null && !isSunday && !isMonthStart && (
                  <div className="flex items-center justify-center py-3">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>כל המשימות הושלמו 🎉</p>
                  </div>
                )}

                {/* Loading */}
                {nextTask === undefined && !isSunday && !isMonthStart && (
                  <div className="flex items-center justify-center py-3">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>טוען...</p>
                  </div>
                )}

              </div>
            </div>

            {/* Sunday Wins streak */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <EditableText
                  labelKey="section_streak"
                  labels={labels}
                  onSave={saveLabel}
                  editMode={labelEditMode}
                  className="text-xs uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}
                />
                <Trophy size={15} className="text-white/25" />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-white">{currentStreak}</span>
                <span className="text-xs text-white/40">
                  שבועות · הארוך ביותר {longestStreak}
                </span>
              </div>

              {/* Segmented bar — dir ltr כדי שהישן משמאל, החדש מימין */}
              <div dir="ltr" style={{ display: 'flex', gap: 4 }}>
                {weeklyHistory.map((hasWin, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1, height: 8, borderRadius: 99,
                      background: hasWin ? '#F5C118' : 'rgba(255,255,255,0.08)',
                      transition: 'background 0.25s',
                    }}
                  />
                ))}
              </div>
            </div>

          </div>{/* end streak + next-action row */}

          {/* Monthly focus + Upcoming meetings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Monthly focus */}
          <div
            className="rounded-2xl p-6 flex flex-col"
            style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <EditableText
                labelKey="section_focus"
                labels={labels}
                onSave={saveLabel}
                editMode={labelEditMode}
                className="text-xs uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}
              />
              <span className="text-xs text-white/25">
                {latestMonthLabel}
              </span>
            </div>

            {currentSubmission?.main_project ? (
              <div className="flex-1 flex flex-col justify-between">
                <div
                  className="flex items-start gap-3 rounded-xl p-4"
                  style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="flex-none mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(245,193,24,0.15)', color: '#F5C118' }}
                  >
                    <TrendingUp size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug">
                      {currentSubmission.main_project}
                    </p>
                    {currentSubmission.systems_needed && (
                      <p className="mt-1.5 text-xs text-white/35 leading-relaxed line-clamp-2">
                        {currentSubmission.systems_needed}
                      </p>
                    )}
                  </div>
                </div>

                {currentSubmission.biggest_win && (
                  <div className="mt-3 flex items-start gap-2">
                    <Trophy size={13} className="flex-none mt-0.5 text-white/20" />
                    <p className="text-xs text-white/35 leading-relaxed line-clamp-2">
                      {currentSubmission.biggest_win}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-white/20 text-center">
                  מלא את הסיכום החודשי<br />כדי לראות את הפוקוס שלך כאן
                </p>
              </div>
            )}
          </div>

          {/* Upcoming meetings this week */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                הפגישות הבאות
              </span>
              <Video size={15} className="text-white/25" />
            </div>

            {/* Meeting list */}
            <div className="flex flex-col gap-2 flex-1">
              {upcomingMeetings === null && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>טוען...</p>
                </div>
              )}

              {upcomingMeetings?.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    אין פגישות קרובות
                  </p>
                </div>
              )}

              {upcomingMeetings?.map(m => {
                const isLab    = m.topic?.includes('מעבדת');
                const dotColor = isLab ? '#67e8f9' : '#F5C118';

                let dateLine = '';
                let timeLine = '';
                if (m.start_time) {
                  const start = new Date(m.start_time);
                  dateLine = start.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem' });
                  timeLine = start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
                    + (m.duration ? ` · ${m.duration} דק׳` : '');
                } else {
                  timeLine = m.duration ? `${m.duration} דק׳` : '';
                }

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl p-3"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex-none h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Video size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ background: dotColor }} />
                        <p className="text-sm font-semibold text-white leading-tight line-clamp-1">{m.topic}</p>
                      </div>
                      {dateLine && (
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', paddingRight: '14px' }}>
                          {dateLine}
                        </p>
                      )}
                      {timeLine && (
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.28)', paddingRight: '14px' }}>
                          {timeLine}
                        </p>
                      )}
                    </div>
                    {m.join_url && (
                      <a
                        href={m.join_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        הצטרף
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          </div>{/* end monthly focus + meetings grid */}

        </div>

        {/* Revenue chart */}
        <div
          className="rounded-2xl p-6 order-first wide:order-last"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/40">
                הכנסה · {latestMonthLabel}
              </div>
              <div className="mt-1 flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl sm:text-4xl font-bold text-white">
                  ₪{latestAmount.toLocaleString()}
                </span>
                {prevMonthLabel && (
                  <span className="text-xs text-white/35">
                    לעומת {prevMonthLabel} · ₪{prevAmount.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* טווח זמן — סדר הפוך במערך כי RTL, כדי שיוצג: 3M | 6M | שנה */}
            <div className="flex gap-1 rounded-lg p-1 flex-none" style={{ background: 'rgb(var(--bg-elevated))' }}>
              {[
                { key: '3M', label: '3M' },
                { key: '6M', label: '6M' },
                { key: '1Y', label: 'שנה' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChartRange(key)}
                  className="rounded-md px-3 py-1 text-xs font-semibold transition"
                  style={{
                    background: chartRange === key ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color:      chartRange === key ? 'white' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            /* dir=ltr: keeps recharts SVG rendering correct; data is already reversed for RTL */
            <div dir="ltr">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#F5C118" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#F5C118" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v === 0 ? '₪0' : `₪${v / 1000}K`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgb(19,21,40)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    color: 'white',
                    fontSize: 13,
                  }}
                  formatter={v => [`₪${v.toLocaleString()}`, 'הכנסה']}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#F5C118"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#F5C118', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center text-sm text-white/25">
              הגש את הסיכום החודשי הראשון שלך כדי לראות את הגרף 📈
            </div>
          )}
        </div>
      </div>

      {/* ── Deal → Open Project popup ── */}
      {dealProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setDealProjectModal(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-5 text-right"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-none"
                style={{ background: 'rgba(245,193,24,0.15)', border: '1px solid rgba(245,193,24,0.3)' }}>
                <span className="text-xl">🎉</span>
              </div>
              <div>
                <div className="text-base font-bold text-white">עסקה חדשה נסגרה!</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  ₪{Number(dealProjectModal.totalAmount).toLocaleString('he-IL')}
                </div>
              </div>
            </div>

            <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              רוצה לפתוח כרטיסיית פרויקט חדשה עם סכום העסקה?
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  navigate('/clients', { state: {
                    openNewProject: true,
                    prefillTotalAmount: dealProjectModal.totalAmount,
                    prefillReceivedAmount: dealProjectModal.receivedAmount,
                  }});
                  setDealProjectModal(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition hover:opacity-90"
                style={{ background: '#F5C118', color: '#13152a', boxShadow: '0 4px 16px rgba(245,193,24,0.35)' }}>
                <FolderPlus size={15} /> כן, פתח פרויקט
              </button>
              <button
                onClick={() => setDealProjectModal(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                לא עכשיו
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}

      {modal === 'deal' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)' }}>

            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-white">נצחון עסקה חדשה 🛡️</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                  {new Date().toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
              <button onClick={() => setModal(null)} className="rounded-md p-1 hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Sub-header */}
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                ברכות על סגירת עסקה חדשה! הכניסו את הפרטים ושתפו את הנצחון עם הקבוצה.
              </p>
            </div>

            {/* Body — two columns */}
            <div className="flex gap-0" style={{ minHeight: 320 }}>

              {/* Left — context */}
              <div className="flex-none w-48 p-5 space-y-4" style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> עסקה חדשה
                </span>
                <div>
                  <p className="text-sm font-bold text-white mb-1">🛡️ הנצחון</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    תרשמו את ערך העסקה ומה גביתם בפועל, ואז קבעו את יעד הדרגה הבאה שלכם.
                  </p>
                </div>
              </div>

              {/* Right — form */}
              <div className="flex-1 p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    סה״כ שווי העסקה <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="px-3 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.35)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>₪</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={dealForm.total_amount}
                      onChange={e => setDealForm(f => ({ ...f, total_amount: e.target.value }))}
                      className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-white placeholder:text-white/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    כסף שנכנס בפועל <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="px-3 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.35)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>₪</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={dealForm.received_amount}
                      onChange={e => setDealForm(f => ({ ...f, received_amount: e.target.value }))}
                      className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-white placeholder:text-white/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    מה הדרגה הבאה שאתה מכוון אליה?
                  </label>
                  <select
                    value={dealForm.next_rank}
                    onChange={e => setDealForm(f => ({ ...f, next_rank: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: dealForm.next_rank ? 'white' : 'rgba(255,255,255,0.25)' }}
                  >
                    <option value="">בחר דרגה...</option>
                    {SEGMENTS.map(s => (
                      <option key={s.label} value={s.label}>{s.label} — ₪{s.min === 0 ? '0' : `${s.min/1000}K`}+</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>הערות</label>
                  <textarea
                    placeholder="פרטים נוספים על העסקה הזו..."
                    rows={3}
                    value={dealForm.notes || ''}
                    onChange={e => setDealForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setModal(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                ביטול
              </button>
              <button
                onClick={submitDeal}
                disabled={!dealForm.total_amount}
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
                style={{ background: '#22c55e', color: '#fff' }}
              >
                שלח עסקה ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'win' && (() => {
        const accentGold = '#F5C118';
        const stepBg = 'rgb(var(--bg-surface))';
        const fieldBg = 'rgb(var(--bg-elevated))';
        const fieldBorder = '1px solid rgba(255,255,255,0.1)';
        const dateStr = new Date().toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
            <div className="w-full max-w-2xl rounded-2xl overflow-hidden" style={{ background: stepBg, border: '1px solid rgba(255,255,255,0.1)' }}>

              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-white">נצחונות שבועיים</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                    {dateStr}
                  </span>
                </div>
                <button onClick={() => { setModal(null); setWinStep(1); }} className="rounded-md p-1 hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Sub-header */}
              <div className="px-5 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  שתפו את 3 הנצחונות הכי גדולים מהשבוע שעבר, ואת עדיפות השבוע הקרוב.
                </p>
              </div>

              {/* Step tabs */}
              <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {[{ n: 1, label: 'נצחונות' }, { n: 2, label: 'השבוע הקרוב' }].map(({ n, label }) => (
                  <button
                    key={n}
                    onClick={() => setWinStep(n)}
                    className="flex-1 py-2.5 text-sm font-medium transition"
                    style={{
                      color: winStep === n ? accentGold : 'rgba(255,255,255,0.35)',
                      borderBottom: winStep === n ? `2px solid ${accentGold}` : '2px solid transparent',
                      background: 'transparent',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Progress bar */}
              <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full transition-all duration-300" style={{ width: winStep === 1 ? '50%' : '100%', background: accentGold }} />
              </div>

              {/* Body */}
              <div className="flex" style={{ minHeight: 320 }}>
                {/* Left — context */}
                <div className="flex-none w-48 p-5 space-y-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}>
                  <p className="text-xs font-bold tabular-nums" style={{ color: accentGold }}>
                    {String(winStep).padStart(2,'0')} / 02
                  </p>
                  {winStep === 1 ? (
                    <>
                      <p className="text-sm font-bold text-white">🏆 3 הנצחונות</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        תרשמו את הנצחונות מהשבוע שעבר — קטנים כגדולים, הכל מצטבר.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-white">🎯 השבוע הקרוב</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        קבעו את המוקד וספרו לנו מה מעכב אתכם כדי שנוכל לעזור.
                      </p>
                    </>
                  )}
                </div>

                {/* Right — form fields */}
                <div className="flex-1 p-5 space-y-4">
                  {winStep === 1 ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>הנצחון הגדול ביותר</label>
                        <input
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-white placeholder:text-white/20"
                          style={{ background: fieldBg, border: winForm.win_1 ? `1px solid ${accentGold}66` : fieldBorder }}
                          placeholder="הנצחון הכי גדול שלך..."
                          value={winForm.win_1}
                          onChange={e => setWinForm(f => ({ ...f, win_1: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>הנצחון השני</label>
                        <input
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-white placeholder:text-white/20"
                          style={{ background: fieldBg, border: fieldBorder }}
                          placeholder="עוד משהו טוב שקרה..."
                          value={winForm.win_2}
                          onChange={e => setWinForm(f => ({ ...f, win_2: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>הנצחון השלישי</label>
                        <input
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-white placeholder:text-white/20"
                          style={{ background: fieldBg, border: fieldBorder }}
                          placeholder="ועוד אחד..."
                          value={winForm.win_3}
                          onChange={e => setWinForm(f => ({ ...f, win_3: e.target.value }))}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>״הדבר האחד״ שתתמקד בו</label>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>המוקד הכי חשוב לשבוע הקרוב.</p>
                        <input
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none text-white placeholder:text-white/20"
                          style={{ background: fieldBg, border: winForm.focus_next_week ? `1px solid ${accentGold}66` : fieldBorder }}
                          placeholder="הדבר האחד שהכי חשוב..."
                          value={winForm.focus_next_week}
                          onChange={e => setWinForm(f => ({ ...f, focus_next_week: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>המעצור הכי גדול שלך</label>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>מה מרגיש כמו חסם? מה אנחנו יכולים לעזור לך לפתור?</p>
                        <textarea
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none text-white placeholder:text-white/20"
                          style={{ background: fieldBg, border: fieldBorder }}
                          placeholder="איפה אתה צריך תמיכה?"
                          rows={4}
                          value={winForm.blocker}
                          onChange={e => setWinForm(f => ({ ...f, blocker: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => winStep === 1 ? (setModal(null), setWinStep(1)) : setWinStep(1)}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  ← {winStep === 1 ? 'ביטול' : 'חזרה'}
                </button>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>שלב {winStep} מתוך 2</span>
                {winStep === 1 ? (
                  <button
                    onClick={() => setWinStep(2)}
                    disabled={!winForm.win_1.trim()}
                    className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: accentGold, color: '#13152A' }}
                  >
                    הבא: השבוע הקרוב →
                  </button>
                ) : (
                  <button
                    onClick={() => { submitWin(); setWinStep(1); }}
                    disabled={!winForm.focus_next_week.trim()}
                    className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: accentGold, color: '#13152A' }}
                  >
                    שלח נצחונות ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showFormEditor && (
        <FormConfigEditor onClose={() => { setShowFormEditor(false); setFormConfig(loadFormConfig()); }} />
      )}

      {modal === 'monthly' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
         <div className="w-full rounded-2xl" style={{ maxWidth: 780, background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>
                {editingSubmission ? 'עריכת נתונים חודשיים ✏️' : 'דיווח חודשי 📊'}
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {editingSubmission
                  ? `עורך: ${new Date(editingSubmission.month).toLocaleString('he-IL', { month: 'long', year: 'numeric' })}`
                  : 'מלאו את הנתונים החשובים שלכם'}
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {isAdmin && (
                <button onClick={() => setShowFormEditor(true)}
                  title="ערוך שדות הטופס (אדמין)"
                  style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, cursor:'pointer', color:'rgba(255,255,255,0.6)', padding:'5px 10px', display:'flex', alignItems:'center', gap:5, fontSize:12, fontFamily:'inherit' }}>
                  <Settings2 size={13} /> ערוך שדות
                </button>
              )}
              <button onClick={() => { setModal(null); setEditingSubmission(null); }}
                style={{ background:'transparent', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)', padding:4, display:'flex' }}>
                <X size={20} />
              </button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Section 1: ביצועים עסקיים ── */}
            <MSection icon="💰" label="ביצועים עסקיים">
              <MField label="החודש המדווח" required>
                <input type="month" value={monthlyForm.report_month}
                  onChange={e => setMonthlyForm(f => ({ ...f, report_month: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              </MField>
              <MGrid cols={2}>
                <MField label="עסקאות חדשות שנסגרו (₪)" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.total_new_deals} onChange={e => setMonthlyForm(f => ({ ...f, total_new_deals: e.target.value }))} />
                </MField>
                <MField label="ריטיינרים ותשלומים קבועים (₪)">
                  <MInput placeholder="0" type="number" value={monthlyForm.retainers} onChange={e => setMonthlyForm(f => ({ ...f, retainers: e.target.value }))} />
                </MField>
              </MGrid>
              <MField label="הכנסה כוללת (₪)" required>
                <MInput placeholder="כמה כסף נכנס לבנק החודש?" type="number" value={monthlyForm.total_income} onChange={e => setMonthlyForm(f => ({ ...f, total_income: e.target.value }))} />
              </MField>
              <MGrid cols={3}>
                <MField label="הוצאות תוכנות (₪)" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.software_expenses} onChange={e => setMonthlyForm(f => ({ ...f, software_expenses: e.target.value }))} />
                </MField>
                <MField label="הוצאות משתנות (₪)" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.variable_expenses} onChange={e => setMonthlyForm(f => ({ ...f, variable_expenses: e.target.value }))} />
                </MField>
                <MField label="ממומן (₪)" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.paid_ads} onChange={e => setMonthlyForm(f => ({ ...f, paid_ads: e.target.value }))} />
                </MField>
              </MGrid>
              {/* ── Rank field: conditional by submission type ── */}
              {isFirstSubmission ? (
                <>
                  <MField label="דרגה נוכחית בתוכנית" required>
                    <select value={monthlyForm.current_rank} onChange={e => setMonthlyForm(f => ({ ...f, current_rank: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                      style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                      <option value="">באיזה דרגה אתם נמצאים כרגע?</option>
                      {SEGMENTS.map(s => <option key={s.label} value={s.label}>{s.label} — ₪{s.min === 0 ? '0' : `${s.min/1000}K`}+</option>)}
                    </select>
                  </MField>
                  <MField label="זכיתם כבר בדרגה הבאה? אם כן, באיזו?" required>
                    <MInput placeholder="שם הדרגה שהגעתם אליה (או לא)" value={monthlyForm.achieved_next_rank} onChange={e => setMonthlyForm(f => ({ ...f, achieved_next_rank: e.target.value }))} />
                  </MField>
                </>
              ) : editingSubmission ? (
                <MField label="דרגה נוכחית בתוכנית">
                  <div
                    className="rounded-lg px-3 py-2.5 text-sm"
                    style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                  >
                    {editingSubmission.current_rank || '—'}
                  </div>
                </MField>
              ) : (
                /* 2nd+ submission — auto-rank info box */
                (() => {
                  const sorted  = [...monthlyData].sort((a, b) => new Date(a.month) - new Date(b.month));
                  const lastSub = sorted[sorted.length - 1];
                  const label   = lastSub?.current_rank;
                  const seg     = SEGMENTS.find(s => s.label === label);
                  return (
                    <div
                      className="rounded-xl p-4 flex items-center gap-3"
                      style={{ background: 'rgba(245,193,24,0.07)', border: '1px solid rgba(245,193,24,0.2)' }}
                    >
                      <span className="text-2xl">🏅</span>
                      <div>
                        <p className="text-sm font-semibold text-white/85">הדרגה תחושב אוטומטית</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {seg
                            ? `דרגה נוכחית: ${label} · ₪${seg.min === 0 ? '0' : `${seg.min / 1000}K`}+`
                            : 'מחושב לפי ממוצע 2 החודשים האחרונים'}
                        </p>
                      </div>
                    </div>
                  );
                })()
              )}
              {/* Slider for business confidence */}
              <MField label="ביטחון בביצועים בעסק" required>
                <MSlider value={monthlyForm.business_confidence} onChange={v => setMonthlyForm(f => ({ ...f, business_confidence: v }))} />
              </MField>
            </MSection>

            {/* ── Section 2: שיחות + לקוחות ── */}
            <MSection icon="🤝" label="שיחות ומכירות">
              <MGrid cols={3}>
                <MField label="שיחות שנקבעו" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.sales_calls_set} onChange={e => setMonthlyForm(f => ({ ...f, sales_calls_set: e.target.value }))} />
                </MField>
                <MField label="הגיעו לשיחה" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.sales_calls_showed} onChange={e => setMonthlyForm(f => ({ ...f, sales_calls_showed: e.target.value }))} />
                </MField>
                <MField label="נסגרו" hint="גם עם לקוחות קיימים">
                  <MInput placeholder="0" type="number" value={monthlyForm.closings_count || ''} onChange={e => setMonthlyForm(f => ({ ...f, closings_count: e.target.value }))} />
                </MField>
              </MGrid>
              <MGrid cols={3}>
                <MField label="לידים שהגיעו" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.leads} onChange={e => setMonthlyForm(f => ({ ...f, leads: e.target.value }))} />
                </MField>
                <MField label="הצעות שהצעתי" hint="סטורי, פוסט, הודעה וכד׳" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.proposals} onChange={e => setMonthlyForm(f => ({ ...f, proposals: e.target.value }))} />
                </MField>
                <MField label="לקוחות פעילים" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.active_clients} onChange={e => setMonthlyForm(f => ({ ...f, active_clients: e.target.value }))} />
                </MField>
              </MGrid>
              <MGrid cols={3}>
                <MField label="הצעות מחיר נשלחו">
                  <MInput placeholder="0" type="number" value={monthlyForm.price_quotes_sent || ''} onChange={e => setMonthlyForm(f => ({ ...f, price_quotes_sent: e.target.value }))} />
                </MField>
                <MField label="הצעות מחיר אושרו">
                  <MInput placeholder="0" type="number" value={monthlyForm.price_quotes_approved || ''} onChange={e => setMonthlyForm(f => ({ ...f, price_quotes_approved: e.target.value }))} />
                </MField>
                <MField label="שיחות אסטרטגיה">
                  <MInput placeholder="0" type="number" value={monthlyForm.strategy_calls} onChange={e => setMonthlyForm(f => ({ ...f, strategy_calls: e.target.value }))} />
                </MField>
              </MGrid>
            </MSection>

            {/* ── Section 3: תוכן ── */}
            <MSection icon="📱" label="תוכן וקהילה">
              <MGrid cols={3}>
                <MField label="עוקבים" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.followers} onChange={e => setMonthlyForm(f => ({ ...f, followers: e.target.value }))} />
                </MField>
                <MField label="Reach" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.reach} onChange={e => setMonthlyForm(f => ({ ...f, reach: e.target.value }))} />
                </MField>
                <MField label="פוסטים" required>
                  <MInput placeholder="0" type="number" value={monthlyForm.posts_count} onChange={e => setMonthlyForm(f => ({ ...f, posts_count: e.target.value }))} />
                </MField>
              </MGrid>
              <MField label="ביטחון בתוכן" required>
                <MSlider value={monthlyForm.content_confidence} onChange={v => setMonthlyForm(f => ({ ...f, content_confidence: v }))} />
              </MField>
            </MSection>

            {/* ── Section 4: פוקוס + פידבק ── */}
            <MSection icon="🔮" label="פוקוס ופידבק">
              <MField label="הנצחון הגדול ביותר עם לקוח החודש" required>
                <textarea rows={2} placeholder="שתפו אותנו..." value={monthlyForm.biggest_win}
                  onChange={e => setMonthlyForm(f => ({ ...f, biggest_win: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm resize-none outline-none"
                  style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              </MField>
              <MGrid cols={2}>
                <MField label="הפוקוס המרכזי החודש" required>
                  <MInput placeholder="דבר אחד. ממוקד." value={monthlyForm.main_project} onChange={e => setMonthlyForm(f => ({ ...f, main_project: e.target.value }))} />
                </MField>
                <MField label="מה אתם צריכים החודש?">
                  <MInput placeholder="כלי, הכוונה..." value={monthlyForm.systems_needed} onChange={e => setMonthlyForm(f => ({ ...f, systems_needed: e.target.value }))} />
                </MField>
              </MGrid>
              <MField label="כמה תמליץ על התוכנית לחבר? (1-10)" required>
                <MSlider value={monthlyForm.nps} onChange={v => setMonthlyForm(f => ({ ...f, nps: v }))} />
              </MField>
              <MField label="המלצות לשיפור התוכנית">
                <textarea rows={2} placeholder="מה יעזור לך לרוץ מהר יותר?" value={monthlyForm.program_feedback}
                  onChange={e => setMonthlyForm(f => ({ ...f, program_feedback: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm resize-none outline-none"
                  style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              </MField>
            </MSection>

            <button onClick={submitMonthly}
              style={{ width: '100%', padding: '13px 0', borderRadius: 10, background: '#F5C118', color: '#13152A', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
              שלח נתונים חודשיים 🚀
            </button>
          </div>
         </div>
        </div>
      )}

      {modal === 'edit' && (
        <Modal title="" onClose={() => { setModal(null); setEditSelectedId(''); }}>
          <h2 className="text-lg font-bold text-white mb-1">עריכת הגשות</h2>
          <p className="text-sm text-white/45 mb-5">בחר חודש לעריכת הנתונים שלך.</p>

          {monthlyData.length === 0 ? (
            <p className="text-sm text-white/35">אין הגשות עדיין.</p>
          ) : (
            <>
              <select
                value={editSelectedId}
                onChange={e => setEditSelectedId(e.target.value)}
                className="w-full rounded-lg px-3 py-3 text-sm outline-none mb-5"
                style={{
                  background: 'rgb(var(--bg-elevated))',
                  border: editSelectedId ? '1px solid #F5C118' : '1px solid rgba(255,255,255,0.15)',
                  color: 'white',
                }}
              >
                <option value="" disabled>בחר חודש...</option>
                {[...monthlyData]
                  .sort((a, b) => new Date(b.month) - new Date(a.month))
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {new Date(m.month).toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
              </select>

              <div className="flex gap-3">
                <button
                  onClick={() => { setModal(null); setEditSelectedId(''); }}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-80"
                  style={{ background: 'rgb(var(--bg-elevated))', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  ביטול
                </button>
                <button
                  disabled={!editSelectedId}
                  onClick={() => {
                    const m = monthlyData.find(m => m.id === editSelectedId);
                    if (m) { openEditMonth(m); setEditSelectedId(''); }
                  }}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-30"
                  style={{ background: '#F5C118', color: '#13152A' }}
                >
                  עריכה
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Confetti + Rank-up celebration ── */}
      <Confetti active={confetti} onDone={() => setConfetti(false)} />
      <RankUpBanner rank={rankUpRank} onClose={() => setRankUpRank(null)} />

    </div>
  );
}
