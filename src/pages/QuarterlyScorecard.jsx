import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { createClient } from '@supabase/supabase-js';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Plus, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// ── Constants ─────────────────────────────────────────────────
const EFFORT_METRICS = [
  { key: 'effort_short',     note_key: 'effort_short_note',     label: 'תוכן קצר',                color: '#6366f1' },
  { key: 'effort_relations', note_key: 'effort_relations_note', label: 'שיחות ומערכות יחסים',    color: '#22c55e' },
  { key: 'effort_proposals', note_key: 'effort_proposals_note', label: 'הצעות',                   color: '#f59e0b' },
];

const LEVEL_OPTIONS = [
  { amount: 5000,  label: '₪5K',  color: '#ef4444' },
  { amount: 10000, label: '₪10K', color: '#f97316' },
  { amount: 15000, label: '₪15K', color: '#eab308' },
  { amount: 20000, label: '₪20K', color: '#22c55e' },
  { amount: 30000, label: '₪30K', color: '#a855f7' },
];

const STEPS = ['רבעון', 'נצחונות', 'כסף', 'מאמץ', 'כיף', 'סקירה'];
const STEP_COLORS = ['rgba(255,255,255,0.6)', '#eab308', '#22c55e', '#3b82f6', '#f97316', '#a855f7'];

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

// ── Helpers ───────────────────────────────────────────────────
function prevQuarter() {
  const now = new Date();
  let q = Math.ceil((now.getMonth() + 1) / 3) - 1;
  let y = now.getFullYear();
  if (q === 0) { q = 4; y -= 1; }
  return `${y}-Q${q}`;
}

function quarterLabel(q) {
  if (!q) return '';
  const [year, quarter] = q.split('-');
  return `${year} · ${quarter}`;
}

function nextQuarterMonths(q) {
  // returns the 3 month names of the quarter AFTER q
  const [year, qStr] = q.split('-');
  const qNum = Number(qStr.replace('Q', ''));
  const nextQ = qNum === 4 ? 1 : qNum + 1;
  const startMonth = (nextQ - 1) * 3; // 0-indexed
  return [HE_MONTHS[startMonth], HE_MONTHS[startMonth + 1], HE_MONTHS[startMonth + 2]];
}

function buildQuarterOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 1; i <= 20; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    if (d.getFullYear() < 2025 || (d.getFullYear() === 2025 && q < 1)) break;
    const label = `${d.getFullYear()}-Q${q}`;
    if (!opts.includes(label)) opts.push(label);
    if (label === '2025-Q1') break;
  }
  return [...new Set(opts)];
}

const QUARTER_OPTIONS = buildQuarterOptions();

// ── Empty form state ──────────────────────────────────────────
const emptyForm = () => ({
  quarter:              prevQuarter(),
  fun_freedom:          '',
  impact_win_1:         '',
  impact_win_2:         '',
  impact_win_3:         '',
  vision_next:          '',
  highest_cash_month:   '',
  goal_cash_month:      '',
  current_level:        null,
  clients_to_sign:      '',
  reward:               '',
  effort_short:         5,
  effort_short_note:    '',
  effort_relations:     5,
  effort_relations_note:'',
  effort_proposals:     5,
  effort_proposals_note:'',
  fun_month_1:          '',
  fun_month_2:          '',
  fun_month_3:          '',
});

// ── Progress bar ──────────────────────────────────────────────
function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {STEPS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        const color   = STEP_COLORS[i];
        return (
          <div key={label} className="flex flex-col items-center" style={{ flex: 1 }}>
            <div className="w-full h-1 rounded-full mb-1.5" style={{
              background: done || active ? color : 'rgba(255,255,255,0.1)',
              opacity: done ? 0.7 : 1,
            }} />
            <span className="text-[11px]" style={{
              color: active ? color : done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
              fontWeight: active ? 700 : 400,
            }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Step nav footer ───────────────────────────────────────────
function StepNav({ step, total, onBack, onNext, nextLabel, nextColor = '#F5C118', disabled = false }) {
  return (
    <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-base font-medium transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        <ChevronRight size={16} /> חזרה
      </button>
      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>שלב {step} מתוך {total}</span>
      <button
        onClick={onNext}
        disabled={disabled}
        className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-base font-bold transition-colors"
        style={{ background: nextColor, color: '#13152A', opacity: disabled ? 0.4 : 1 }}
      >
        {nextLabel} <ChevronLeft size={15} />
      </button>
    </div>
  );
}

// ── Effort number buttons ─────────────────────────────────────
function NumberPad({ value, onChange, color }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: 11 }, (_, i) => {
        const filled = i <= value;
        return (
          <button
            key={i}
            onClick={() => onChange(i)}
            className="h-8 w-8 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: filled ? color : 'rgba(255,255,255,0.07)',
              color: filled ? '#13152A' : 'rgba(255,255,255,0.35)',
              border: filled ? 'none' : '1px solid rgba(255,255,255,0.1)',
              opacity: filled ? (i === value ? 1 : 0.55) : 1,
            }}
          >
            {i}
          </button>
        );
      })}
    </div>
  );
}

// ── Wizard modal ──────────────────────────────────────────────
function WizardModal({ onClose, onSaved, userId, existingQuarters = [] }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const months = nextQuarterMonths(form.quarter);

  async function submit() {
    setSaving(true);
    setErr(null);
    const payload = {
      user_id:               userId,
      quarter:               form.quarter,
      fun_freedom:           form.fun_freedom,
      impact_win_1:          form.impact_win_1,
      impact_win_2:          form.impact_win_2,
      impact_win_3:          form.impact_win_3,
      vision_next:           form.vision_next,
      highest_cash_month:    form.highest_cash_month ? Number(form.highest_cash_month) : null,
      goal_cash_month:       form.goal_cash_month    ? Number(form.goal_cash_month)    : null,
      current_level:         form.current_level,
      clients_to_sign:       form.clients_to_sign    ? Number(form.clients_to_sign)    : null,
      reward:                form.reward,
      effort_short:          form.effort_short,
      effort_short_note:     form.effort_short_note,
      effort_relations:      form.effort_relations,
      effort_relations_note: form.effort_relations_note,
      effort_proposals:      form.effort_proposals,
      effort_proposals_note: form.effort_proposals_note,
      fun_month_1:           form.fun_month_1,
      fun_month_2:           form.fun_month_2,
      fun_month_3:           form.fun_month_3,
    };
    const { error } = await supabase
      .from('quarterly_scorecards')
      .upsert(payload, { onConflict: 'user_id,quarter' });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
    onClose();
  }

  const levelOption = LEVEL_OPTIONS.find(l => l.amount === form.current_level);

  // ── Step renders ────────────────────────────────────────────
  const steps = [

    // 0 — Quarter
    <div key="quarter">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: STEP_COLORS[0] }}>01 / 06</p>
        <h2 className="text-2xl font-bold text-white">איזה רבעון?</h2>
        <p className="text-base mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>בחר את הרבעון שעליו אתה מדווח.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {QUARTER_OPTIONS.map(q => {
          const isSelected = form.quarter === q;
          const isPrev     = q === prevQuarter();
          return (
            <button
              key={q}
              onClick={() => set('quarter', q)}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-right transition-all relative"
              style={{
                background: isSelected ? 'rgba(245,193,24,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isSelected ? '#F5C118' : 'rgba(255,255,255,0.1)'}`,
                color: isSelected ? '#F5C118' : 'rgba(255,255,255,0.7)',
              }}
            >
              {quarterLabel(q)}
              {isPrev && (
                <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F5C118', color: '#13152A' }}>
                  אחרון
                </span>
              )}
            </button>
          );
        })}
      </div>
      <StepNav step={1} total={6} onBack={onClose} onNext={() => setStep(1)} nextLabel="הבא — נצחונות" nextColor="#eab308" />
    </div>,

    // 1 — Wins
    <div key="wins">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: STEP_COLORS[1] }}>02 / 06</p>
        <h2 className="text-2xl font-bold text-white">נצחונות</h2>
        <p className="text-base mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>לך חיובי קודם — תסתכל אחורה לפני שמסתכלים קדימה.</p>
      </div>
      <div className="space-y-5">
        <div>
          <label className="block text-base font-semibold mb-2 text-white">כיף + חופש</label>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>אילו זכרות מגניבות יצרת בשלושת החודשים האחרונים?</p>
          <textarea rows={3} value={form.fun_freedom} onChange={e => set('fun_freedom', e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base resize-none" placeholder="שתף..." />
        </div>
        <div>
          <label className="block text-base font-semibold mb-2 text-white">ההשפעה שלך</label>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>שלושת הנצחונות הגדולים ביותר שלך ושל העסק.</p>
          {['impact_win_1','impact_win_2','impact_win_3'].map((k, i) => (
            <input key={k} type="text" value={form[k]} onChange={e => set(k, e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-base mb-2"
              placeholder={`נצחון ${i + 1}...`} />
          ))}
        </div>
        <div>
          <label className="block text-base font-semibold mb-2 text-white">החזון שלך</label>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>מה אתה מתרגש לקראתו בשלושת החודשים הבאים?</p>
          <textarea rows={3} value={form.vision_next} onChange={e => set('vision_next', e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base resize-none" placeholder="החזון שלי..." />
        </div>
      </div>
      <StepNav step={2} total={6} onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="הבא — כסף" nextColor="#22c55e" />
    </div>,

    // 2 — Money
    <div key="money">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: STEP_COLORS[2] }}>03 / 06</p>
        <h2 className="text-2xl font-bold text-white">כסף</h2>
        <p className="text-base mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>איפה אתה בדרך, ומהו הציון הבא?</p>
      </div>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>החודש הגבוה ביותר ברבעון האחרון</label>
            <div className="flex items-center gap-1 rounded-xl px-3 py-2.5" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>₪</span>
              <input type="number" value={form.highest_cash_month} onChange={e => set('highest_cash_month', e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none" placeholder="10000" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>יעד חודש כסף לרבעון הזה</label>
            <div className="flex items-center gap-1 rounded-xl px-3 py-2.5" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>₪</span>
              <input type="number" value={form.goal_cash_month} onChange={e => set('goal_cash_month', e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none" placeholder="20000" />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>איזו דרגה יש לך כרגע?</label>
          <div className="flex gap-2 flex-wrap">
            {LEVEL_OPTIONS.map(l => (
              <button
                key={l.amount}
                onClick={() => set('current_level', l.amount)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: form.current_level === l.amount ? l.color + '30' : 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${form.current_level === l.amount ? l.color : 'rgba(255,255,255,0.12)'}`,
                  color: form.current_level === l.amount ? l.color : 'rgba(255,255,255,0.65)',
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>לקוחות חדשים לסגירה</label>
            <input type="number" value={form.clients_to_sign} onChange={e => set('clients_to_sign', e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' }}
              placeholder="6" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>פרס כשמגיעים ליעד</label>
            <input type="text" value={form.reward} onChange={e => set('reward', e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' }}
              placeholder="חופשה, מתנה..." />
          </div>
        </div>
      </div>
      <StepNav step={3} total={6} onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="הבא — מאמץ" nextColor="#3b82f6" />
    </div>,

    // 3 — Effort
    <div key="effort">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: STEP_COLORS[3] }}>04 / 06</p>
        <h2 className="text-2xl font-bold text-white">מאמץ</h2>
        <p className="text-base mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>כמה קשה אתה משחק את המשחק עכשיו?</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>1 = מפיל את הכדור · 10 = לא יכול להתאמץ יותר</p>
      </div>
      <div className="space-y-5">
        {EFFORT_METRICS.map(m => (
          <div key={m.key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{m.label}</span>
              <span className="text-sm font-bold" style={{ color: m.color }}>{form[m.key]}/10</span>
            </div>
            <NumberPad value={form[m.key]} onChange={v => set(m.key, v)} color={m.color} />
            {form[m.key] < 8 && (
              <textarea
                rows={2}
                value={form[m.note_key]}
                onChange={e => set(m.note_key, e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="מה מונע ממך להיות לפחות 8?"
              />
            )}
          </div>
        ))}
      </div>
      <StepNav step={4} total={6} onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="הבא — כיף" nextColor="#f97316" />
    </div>,

    // 4 — Fun
    <div key="fun">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: STEP_COLORS[4] }}>05 / 06</p>
        <h2 className="text-2xl font-bold text-white">כיף</h2>
        <p className="text-base mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>אילו פעילויות כיפיות או דברים מהנים יש לך ביומן לרבעון הבא?</p>
      </div>
      <div className="space-y-3">
        {['fun_month_1','fun_month_2','fun_month_3'].map((k, i) => (
          <div key={k} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-bold text-white mb-2">{months[i]}</p>
            <input
              type="text"
              value={form[k]}
              onChange={e => set(k, e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              placeholder="+ הוסף פעילות..."
            />
          </div>
        ))}
      </div>
      <StepNav step={5} total={6} onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="הבא — סקירה" nextColor="#a855f7" />
    </div>,

    // 5 — Review
    <div key="review">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: STEP_COLORS[5] }}>06 / 06</p>
        <h2 className="text-2xl font-bold text-white">סקירה</h2>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>בדוק הכל — ברגע שנשלח זה נעול.</p>
      </div>
      <div className="space-y-4 text-sm overflow-y-auto" style={{ maxHeight: '50vh' }}>
        {/* Quarter */}
        <ReviewRow label="רבעון" value={quarterLabel(form.quarter)} />

        {/* Wins */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#eab308' }}>נצחונות</p>
          {form.fun_freedom && <ReviewRow label="כיף + חופש" value={form.fun_freedom} />}
          {[form.impact_win_1, form.impact_win_2, form.impact_win_3].filter(Boolean).map((w, i) => (
            <ReviewRow key={i} label={`נצחון ${i + 1}`} value={w} />
          ))}
          {form.vision_next && <ReviewRow label="חזון לרבעון הבא" value={form.vision_next} />}
        </div>

        {/* Money */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#22c55e' }}>כסף</p>
          {form.highest_cash_month && <ReviewRow label="חודש גבוה ברבעון שעבר" value={`₪${Number(form.highest_cash_month).toLocaleString()}`} />}
          {form.goal_cash_month    && <ReviewRow label="יעד חודש כסף"          value={`₪${Number(form.goal_cash_month).toLocaleString()}`} />}
          {form.current_level      && <ReviewRow label="דרגה נוכחית"           value={LEVEL_OPTIONS.find(l => l.amount === form.current_level)?.label} color={LEVEL_OPTIONS.find(l => l.amount === form.current_level)?.color} />}
          {form.clients_to_sign    && <ReviewRow label="לקוחות לסגירה"         value={form.clients_to_sign} />}
          {form.reward             && <ReviewRow label="פרס"                   value={form.reward} />}
        </div>

        {/* Effort */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#3b82f6' }}>מאמץ</p>
          {EFFORT_METRICS.map(m => (
            <ReviewRow key={m.key} label={m.label} value={`${form[m.key]}/10`} color={m.color} />
          ))}
        </div>

        {/* Fun */}
        {(form.fun_month_1 || form.fun_month_2 || form.fun_month_3) && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#f97316' }}>כיף</p>
            {[['fun_month_1', months[0]], ['fun_month_2', months[1]], ['fun_month_3', months[2]]].map(([k, mo]) =>
              form[k] ? <ReviewRow key={k} label={mo} value={form[k]} /> : null
            )}
          </div>
        )}
      </div>

      {err && <p className="text-sm mt-3" style={{ color: '#ef4444' }}>{err}</p>}

      <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => setStep(4)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <ChevronRight size={15} /> חזרה
        </button>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>שלב 6 מתוך 6</span>
        <button
          onClick={submit}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold"
          style={{ background: '#a855f7', color: 'white', opacity: saving ? 0.5 : 1 }}
        >
          <Check size={15} />
          {saving ? 'שומר...' : `שלח ${quarterLabel(form.quarter)}`}
        </button>
      </div>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-2xl my-8 rounded-2xl p-8" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)' }} dir="rtl">
        {/* Modal header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">
            כרטיסיית אבחון רבעוני
            <span className="mr-2 text-base font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>· {quarterLabel(form.quarter)}</span>
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.45)' }}><X size={20} /></button>
        </div>
        <StepBar current={step} />
        {steps[step]}
      </div>
    </div>
  );
}

// ── Review row helper ─────────────────────────────────────────
function ReviewRow({ label, value, color }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="flex-none w-36 text-right" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      <span className="flex-1" style={{ color: color || 'rgba(255,255,255,0.85)' }}>{value}</span>
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-sm space-y-1.5" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', direction: 'rtl' }}>
      <p className="font-bold text-white mb-2">{quarterLabel(label)}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-none" style={{ background: p.color }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{p.name}:</span>
          <span className="font-semibold text-white">{p.value}/10</span>
        </div>
      ))}
    </div>
  );
}

// ── Submission detail modal ───────────────────────────────────
function SubmissionDetail({ record, onClose }) {
  const r   = record;
  const lvl = LEVEL_OPTIONS.find(l => l.amount === r.current_level);
  const months = nextQuarterMonths(r.quarter);

  const Row = ({ label, value, color }) => value ? (
    <div className="flex gap-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="w-44 flex-none text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span className="flex-1 text-sm leading-relaxed" style={{ color: color || 'rgba(255,255,255,0.85)' }}>{value}</span>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-2xl my-8 rounded-2xl overflow-hidden" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)' }} dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-base font-bold text-white">כרטיסיית {quarterLabel(r.quarter)}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {new Date(r.created_at).toLocaleDateString('he-IL')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.45)' }}><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-1">
          {/* Wins */}
          {(r.fun_freedom || r.impact_win_1 || r.vision_next) && (
            <div className="mb-2">
              <p className="text-xs font-bold uppercase tracking-widest py-2 mb-1" style={{ color: '#eab308' }}>נצחונות</p>
              <Row label="כיף + חופש"          value={r.fun_freedom} />
              <Row label="נצחון 1"              value={r.impact_win_1} />
              <Row label="נצחון 2"              value={r.impact_win_2} />
              <Row label="נצחון 3"              value={r.impact_win_3} />
              <Row label="חזון לרבעון הבא"     value={r.vision_next} />
            </div>
          )}

          {/* Money */}
          {(r.highest_cash_month || r.goal_cash_month || r.current_level) && (
            <div className="mb-2">
              <p className="text-xs font-bold uppercase tracking-widest py-2 mb-1" style={{ color: '#22c55e' }}>כסף</p>
              <Row label="חודש גבוה ברבעון שעבר" value={r.highest_cash_month ? `₪${Number(r.highest_cash_month).toLocaleString()}` : null} />
              <Row label="יעד חודש כסף"           value={r.goal_cash_month    ? `₪${Number(r.goal_cash_month).toLocaleString()}`    : null} />
              <Row label="דרגה נוכחית"            value={lvl?.label} color={lvl?.color} />
              <Row label="לקוחות לסגירה"          value={r.clients_to_sign} />
              <Row label="פרס"                    value={r.reward} />
            </div>
          )}

          {/* Effort */}
          <div className="mb-2">
            <p className="text-xs font-bold uppercase tracking-widest py-2 mb-1" style={{ color: '#3b82f6' }}>מאמץ</p>
            {EFFORT_METRICS.map(m => (
              <div key={m.key}>
                <Row label={m.label} value={`${r[m.key]}/10`} color={m.color} />
                {r[m.note_key] && <Row label="" value={r[m.note_key]} />}
              </div>
            ))}
          </div>

          {/* Fun */}
          {(r.fun_month_1 || r.fun_month_2 || r.fun_month_3) && (
            <div className="mb-2">
              <p className="text-xs font-bold uppercase tracking-widest py-2 mb-1" style={{ color: '#f97316' }}>כיף</p>
              <Row label={months[0]} value={r.fun_month_1} />
              <Row label={months[1]} value={r.fun_month_2} />
              <Row label={months[2]} value={r.fun_month_3} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function QuarterlyScorecard() {
  const { user } = useUser();
  const userId   = user?.id;

  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [detailRec,  setDetailRec]  = useState(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('quarterly_scorecards')
      .select('*')
      .eq('user_id', userId)
      .order('quarter', { ascending: true });
    setRecords(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]);

  const existingQuarters = records.map(r => r.quarter);

  const chartData = records.map(r => ({
    quarter:              r.quarter,
    'תוכן קצר':          r.effort_short,
    'שיחות ומערכות יחסים': r.effort_relations,
    'הצעות':             r.effort_proposals,
  }));

  const isEmpty = !loading && records.length === 0;

  return (
    <div className="p-8 space-y-8" dir="rtl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">כרטיסיית אבחון רבעוני</h1>
          <p className="text-base mt-2" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 480 }}>
            האבחון העסקי הרבעוני שלך — נצחונות, כסף, מאמץ וכיף. עקוב אחרי ההתקדמות שלך רבעון אחר רבעון ופתח אבחונים קודמים לסקירה.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold flex-none btn-yellow"
          style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}
        >
          <Plus size={16} /> + אבחון חדש
        </button>
      </div>

      {/* Chart */}
      <div className="rounded-2xl p-6 space-y-5" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <h2 className="text-lg font-bold text-white">מאמץ לאורך זמן</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>ציון עצמי 0–10 כל רבעון.</p>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>עדיין לא ביצעת אבחון רבעוני.</p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold btn-yellow"
              style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}
            >
              <Plus size={15} /> התחל את האבחון הראשון שלך
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="quarter" tickFormatter={quarterLabel} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis domain={[0, 10]} ticks={[0, 3, 6, 10]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 20, direction: 'rtl', fontSize: 13 }} formatter={v => <span style={{ color: 'rgba(255,255,255,0.6)' }}>{v}</span>} />
              {EFFORT_METRICS.map(m => (
                <Line key={m.key} type="monotone" dataKey={m.label} stroke={m.color} strokeWidth={2.5} dot={{ r: 6, fill: m.color, strokeWidth: 0 }} activeDot={{ r: 8 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Past submissions */}
      {records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...records].reverse().map(r => {
            const lvl = LEVEL_OPTIONS.find(l => l.amount === r.current_level);
            return (
              <div
                key={r.id}
                onClick={() => setDetailRec(r)}
                className="rounded-2xl p-5 cursor-pointer transition-all flex flex-col gap-3"
                style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgb(var(--bg-elevated))'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgb(var(--bg-surface))';  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                {/* Quarter label */}
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: lvl?.color || '#a855f7' }} />
                  <span className="text-sm font-bold text-white">{quarterLabel(r.quarter)}</span>
                </div>

                {/* Data rows */}
                <div className="space-y-1.5 flex-1">
                  {r.goal_cash_month && (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>יעד חודש כסף</span>
                      <span className="text-sm font-semibold text-white">₪{Number(r.goal_cash_month).toLocaleString()}</span>
                    </div>
                  )}
                  {r.clients_to_sign && (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>לקוחות לסגירה</span>
                      <span className="text-sm font-semibold text-white">{r.clients_to_sign}</span>
                    </div>
                  )}
                  {lvl && (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>דרגה נוכחית</span>
                      <span className="text-sm font-semibold" style={{ color: lvl.color }}>{lvl.label}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>מאמץ — קצר / שיחות / הצעות</span>
                    <span className="text-sm font-semibold text-white">{r.effort_short} / {r.effort_relations} / {r.effort_proposals}</span>
                  </div>
                </div>

                {/* Footer link */}
                <div className="text-xs font-medium pt-1" style={{ color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  פתח הגשה ←
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailRec && <SubmissionDetail record={detailRec} onClose={() => setDetailRec(null)} />}

      {showModal && (
        <WizardModal
          userId={userId}
          existingQuarters={existingQuarters}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
