import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { AlertCircle, X } from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

// ── Questions ─────────────────────────────────────────────────
const OFFER_QUESTIONS = [
  'יש לי הצעה אחת מוגדרת (לא "כל עבודה לפי מה שהלקוח רוצה") שאני מציע ב-₪3,000+',
  'בפרויקטים האחרונים שלי, הלקוחות שילמו את המחיר שביקשתי בלי משא ומתן ממשי',
  'אני יכול להסביר במשפט אחד מה אני עושה ולמי — והצד השני מבין מה הוא יקבל',
  'יש לי לפחות 2–3 עבודות גמורות שאני יכול להציג כהוכחה שהתהליך עובד',
  'התמחור שלי יציב — הוא לא משתנה דרמטית מלקוח ללקוח לפי הרגשה',
];

const LEADS_QUESTIONS = [
  'יש לי לפחות מקור אחד (לא המלצות בלבד) שמייצר פניות חדשות באופן קבוע',
  'בחודש רגיל יש לי לפחות 2–3 פניות מתאימות, בלי שאני "רודף" אחריהן',
  'אני יודע בדיוק מאיפה הגיע הלקוח האחרון שלי — ויש לי תהליך לחזור על זה',
  'אם היום אין לי פרויקטים פעילים, אני לא בפאניקה — כי אני יודע שפניות יגיעו',
  'יש לי קהל (אינסטגרם, מייל, קבוצה) שאני יכול לפנות אליו כשצריך',
];

const LEVERAGE_QUESTIONS = [
  'חלק מהעבודה שלי לא עובר ישירות דרכי — יש תבניות, תהליכים, או אנשים שעוזרים',
  'אם אני לוקח שבוע חופש, ההכנסה לא נעצרת לחלוטין',
  'אני עובד על העסק (אסטרטגיה, מיתוג אישי, מוצרים) ולא רק בתוך העסק',
];

// ── Status order + colors (structural, not editable) ───────────
const STATUS_ORDER = ['building', 'loaded', 'spinning', 'compounding'];

const COLOR_HEX = {
  red:   '#ef4444',
  amber: '#f59e0b',
  green: '#22c55e',
  blue:  '#3b82f6',
};

// ── Default editable content (admin can override via Supabase) ──
const DEFAULT_CONTENT = {
  pageTitle: 'אבחון עסקי',
  pageSubtitle: 'לפני שעובדים על משהו - חשוב לדעת על מה לעבוד. הנה ארבעת השלבים, ואיפה אתה נמצא בהם.',
  ctaLabel: 'לאבחן את העסק שלי',
  ctaLabelAgain: 'לאבחן מחדש את העסק שלי',
  emptyTitle: 'עדיין לא ביצעת אבחון',
  emptyPrompt: 'לחץ על הכפתור כדי לגלות באיזה שלב אתה נמצא ומה הצעד הבא שלך.',
  reminderTitle: 'תזכורת:',
  reminderText: 'אל תנסה לעבוד על כל ארבעת השלבים בבת אחת. התקדמות אמיתית אומרת שלב אחד בכל פעם. המטרה היא לזהות את צוואר הבקבוק האמיתי שלך עכשיו - ולעבוד רק עליו.',
  stages: {
    building: {
      dots: '🔴🔴',
      title: 'בונה',
      color: 'red',
      subtitle: 'אין עדיין הצעה שמוכרת ואין עדיין זרימת פניות',
      requirements: [
        { label: 'הצעה שמוכרת', ok: false },
        { label: 'זרימת פניות', ok: false },
      ],
      tags: ['הצעה אחת', 'מכירה ראשונה', 'תיעוד'],
      feels: [
        'כל פרויקט נראה קצת אחרת - תמחור, תהליך, תוצרים',
        'לפעמים יש עבודה, לפעמים שקט מוחלט ומפחיד',
        'אתה אומר "כן" לכל מה שמגיע, כי אתה לא בטוח שיבוא עוד',
      ],
      mistake: 'לנסות לעבוד על שיווק או פניות לפני שיש הצעה ברורה. זה כמו לפרסם חנות שעדיין לא ברור מה היא מוכרת.',
      focus: [
        'הגדר חבילה/תהליך אחד - מה אתה עושה, לכמה זמן, באיזה מחיר (לדוגמה: "חבילת מיתוג מלא - 3 שבועות - 8,000 ש״ח")',
        'מכור אותה (אפילו ללקוח אחד) במחיר מלא - בלי "זה תלוי"',
        'תעד את התהליך והתוצאה - צלם מסך, אסוף משוב, הפוך את זה לקייסטאדי',
      ],
      question: 'מכרתי את אותה חבילה פעמיים, באותו מחיר בערך, בלי לבנות אותה מאפס בכל פעם?',
    },
    loaded: {
      dots: '🟢🔴',
      title: 'טעון',
      color: 'amber',
      subtitle: 'יש הצעה שעובדת אבל אין עדיין זרימת פניות',
      requirements: [
        { label: 'הצעה שמוכרת', ok: true },
        { label: 'זרימת פניות', ok: false },
      ],
      tags: ['ערוץ אחד', 'פעולה שבועית', 'מעקב'],
      feels: [
        'כשמישהו מגיע, אתה יודע מה להציע ואיך לתמחר - וזה עובד',
        'אבל הפניות מגיעות בגלים - חודש מלא, חודש ריק',
        'אתה תלוי בהמלצות, בקבוצות פייסבוק, ב"מי שיגיע יגיע"',
      ],
      mistake: 'לשנות את ההצעה כל הזמן "כדי שיהיו יותר פניות", במקום לעבוד על ערוץ הפצה.',
      focus: [
        'בחר ערוץ אחד (לא חמישה) - אינסטגרם, לינקדאין, או רשת קשרים יזומה',
        'הגדר פעולה שבועית קבועה בערוץ הזה (לדוגמה: 3 פוסטים + 5 פניות יזומות בשבוע)',
        'עקוב ארבעה שבועות - כמה פניות זה מייצר?',
      ],
      question: 'יש לי מקור אחד שאני יכול להגיד עליו "זה מביא לי כמות פניות קבועה בחודש"?',
    },
    spinning: {
      dots: '🟢🟢',
      title: 'מסתובב',
      color: 'green',
      subtitle: 'הצעה שעובדת וגם זרימת פניות',
      requirements: [
        { label: 'הצעה שמוכרת', ok: true },
        { label: 'זרימת פניות', ok: true },
      ],
      tags: ['מיפוי תהליך', 'תבנות עבודה', 'תקרת לקוחות'],
      feels: [
        'פניות מגיעות, אתה סוגר אותן, יש הכנסה יציבה',
        'אבל אתה התחנה היחידה - כל פרויקט עובר רק דרכך',
        'אין לך זמן לעבוד על העסק, רק בתוך העסק - וההכנסה תלויה בשעות שלך',
      ],
      mistake: 'לקחת עוד לקוחות כדי "להרוויח יותר" - וזה רק מגדיל את העומס, לא את הרווח לשעה.',
      focus: [
        'מפה את כל שלבי הפרויקט שלך - איפה אתה מבזבז הכי הרבה זמן על דברים שלא חייבים להיות אתה?',
        'בחר שלב אחד להעביר או לתבנת (תבניות, צ׳קליסטים, איש צוות, אוטומציה)',
        'הגדר "תקרת לקוחות" - כמה פרויקטים פעילים בו-זמנית זה הגבול שלך',
      ],
      question: 'יש שלב אחד בתהליך שעכשיו קורה בלעדיי, או בלי שאני מעורב באופן מלא?',
    },
    compounding: {
      dots: '🟢🟢🟢',
      title: 'מצטבר',
      color: 'blue',
      subtitle: 'הצעה, פניות, וגם מנוף שמשתלם',
      requirements: [
        { label: 'הצעה שמוכרת', ok: true },
        { label: 'זרימת פניות', ok: true },
        { label: 'מנוף', ok: true },
      ],
      tags: ['תמחור פרימיום', 'בחירת לקוחות', 'חופש'],
      feels: [
        'ההצעה עובדת, הפניות זורמות, ויש לך מנגנון שמחזיר לך זמן',
        'לקוח חדש לא "עולה" לך בעוד לילות ללא שינה',
        'אתה יכול לבחור לקוחות, לא רק לקבל את מי שמגיע',
      ],
      mistake: 'להרגיש "סיימתי" - אבל גם בשלב הזה יש עבודה: תמחור, בחירת לקוחות, וחופש אמיתי.',
      focus: [
        'תמחור פרימיום - האם המחיר שלך משקף את התוצאה שאתה נותן, או עדיין את הזמן שלך?',
        'בחירת לקוחות - האם אתה עובד עם הלקוחות שאתה רוצה, או עם מי שמגיע?',
        'חופש - האם החופש שהשגת מתורגם לחיים שאתה רוצה (זמן, יצירתיות, בריאות)?',
      ],
      question: 'אם הייתי לוקח שבוע חופש לגמרי, העסק היה ממשיך לתפקד?',
    },
  },
};

function computeStatus(offerScore, leadsScore, leverageScore) {
  if (offerScore < 3) return 'building';
  if (leadsScore < 3) return 'loaded';
  if (leverageScore < 2) return 'spinning';
  return 'compounding';
}

// ── Answer row — 3-button selector ────────────────────────────
function AnswerRow({ question, value, onChange }) {
  const opts = [
    { v: 1,   label: 'כן' },
    { v: 0.5, label: 'לפעמים' },
    { v: 0,   label: 'לא' },
  ];
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>{question}</p>
      <div className="flex gap-2">
        {opts.map(opt => {
          const active = value === opt.v;
          const color = opt.v === 1 ? '#22c55e' : opt.v === 0.5 ? '#f59e0b' : '#ef4444';
          return (
            <button key={opt.v} onClick={() => onChange(opt.v)}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition"
              style={{
                background: active ? color + '22' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
                color: active ? color : 'rgba(255,255,255,0.5)',
              }}>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Stage card (top row of 4) ───────────────────────────────────
function StageCard({ stage, isCurrent, isSelected, hasResult, onClick }) {
  const hex = COLOR_HEX[stage.color];

  return (
    <button
      onClick={onClick}
      className="rounded-xl px-3.5 py-3.5 relative transition text-right w-full"
      style={{
        background: isCurrent ? `${hex}14` : 'rgb(var(--bg-elevated))',
        border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? hex : (isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.07)')}`,
        boxShadow: isCurrent ? `0 0 0 1px ${hex}33` : 'none',
        opacity: hasResult && !isCurrent ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold" style={{ color: isCurrent ? hex : 'rgba(255,255,255,0.75)' }}>
          {stage.title}
        </span>
        {isCurrent && hasResult && (
          <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: hex }} />
        )}
      </div>

      <div className="space-y-1.5 mb-3">
        {stage.requirements.map(r => (
          <div key={r.label} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ background: r.ok ? '#22c55e' : '#ef4444' }} />
            {r.label}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: isCurrent ? hex : 'rgba(255,255,255,0.3)' }}>
        ההתמקדות
      </div>
      <div className="flex flex-wrap gap-1">
        {stage.tags.map(tag => (
          <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
            style={{
              background: isCurrent ? `${hex}25` : 'rgba(255,255,255,0.05)',
              color: isCurrent ? hex : 'rgba(255,255,255,0.4)',
            }}>
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

// ── Circular progress ring ──────────────────────────────────────
function ProgressRing({ value, total, color }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-none -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
      />
      <text x={size / 2} y={size / 2} dy="0.32em" textAnchor="middle" fill={color} fontSize="14" fontWeight="700"
        transform={`rotate(90 ${size / 2} ${size / 2})`}>
        {value}/{total}
      </text>
    </svg>
  );
}

// ── Stage detail block (always-open panel for the selected stage) ──
function StageDetail({ stage, isCurrent }) {
  const hex = COLOR_HEX[stage.color];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgb(var(--bg-surface))', border: `1px solid ${isCurrent ? hex + '55' : 'rgba(255,255,255,0.08)'}` }}>
      <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span>{stage.dots}</span>
        <span className="text-sm font-bold" style={{ color: isCurrent ? hex : 'rgba(255,255,255,0.85)' }}>{stage.title}</span>
        <span className="text-xs hidden sm:inline" style={{ color: 'rgba(255,255,255,0.35)' }}>{stage.subtitle}</span>
        {isCurrent && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${hex}25`, color: hex }}>
            השלב שלך
          </span>
        )}
      </div>

      <div className="px-4 sm:px-5 py-5 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">איך זה מרגיש</h4>
          <ul className="space-y-1.5">
            {stage.feels.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full" style={{ background: hex }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <AlertCircle size={18} className="flex-none mt-0.5" style={{ color: '#fbbf24' }} />
          <div>
            <h4 className="text-sm font-semibold mb-1" style={{ color: '#fbbf24' }}>הטעות הנפוצה בשלב הזה</h4>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{stage.mistake}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white mb-2">המוקד בשלב הזה</h4>
          <ol className="space-y-2">
            {stage.focus.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span className="flex-none flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold"
                  style={{ background: `${hex}25`, color: hex }}>
                  {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{f}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', borderRight: `3px solid ${hex}` }}>
          <h4 className="text-sm font-semibold mb-1" style={{ color: hex }}>שאלה לסיום החודש</h4>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{stage.question}</p>
        </div>
      </div>
    </div>
  );
}

// ── Diagnosis modal — multi-step flow ────────────────────────────
function DiagnosisModal({ initial, onClose, onSave, saving }) {
  const [step, setStep] = useState('intro');
  const [offerScores,    setOfferScores]    = useState(() => initial.offerChecks.map(v => typeof v === 'number' ? v : (v ? 1 : 0)));
  const [leadsScores,    setLeadsScores]    = useState(() => initial.leadsChecks.map(v => typeof v === 'number' ? v : (v ? 1 : 0)));
  const [leverageScores, setLeverageScores] = useState(() => (initial.leverageChecks || [0,0,0]).map(v => typeof v === 'number' ? v : (v ? 1 : 0)));
  const [error, setError] = useState('');

  const offerScore    = offerScores.reduce((s, v) => s + (v ?? 0), 0);
  const leadsScore    = leadsScores.reduce((s, v) => s + (v ?? 0), 0);
  const leverageScore = leverageScores.reduce((s, v) => s + (v ?? 0), 0);
  const showLeverage  = offerScore >= 3 && leadsScore >= 3;

  async function handleSave() {
    setError('');
    const err = await onSave({ offerChecks: offerScores, leadsChecks: leadsScores, leverageChecks: leverageScores });
    if (err) setError('שגיאה בשמירה: ' + err);
  }

  function nextStep() {
    if (step === 'offer') { setStep('leads'); return; }
    if (step === 'leads') { showLeverage ? setStep('leverage') : handleSave(); return; }
    if (step === 'leverage') { handleSave(); return; }
  }

  const stepTitles = { intro: 'אבחון עסקי', offer: 'חלק א׳ — יש לך הצעה שעובדת?', leads: 'חלק ב׳ — יש לך זרימת פניות?', leverage: 'חלק ג׳ — יש לך מינוף?' };
  const stepProgress = { intro: 0, offer: 1, leads: 2, leverage: 3 };
  const totalSteps = showLeverage ? 3 : 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-sm font-bold text-white">{stepTitles[step]}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Progress bar (shown for non-intro steps) */}
        {step !== 'intro' && (
          <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full transition-all" style={{ width: `${(stepProgress[step] / totalSteps) * 100}%`, background: '#F5C118' }} />
          </div>
        )}

        <div className="p-5 space-y-4">

          {/* Intro step */}
          {step === 'intro' && (
            <>
              <p className="text-2xl font-bold text-white leading-snug">לפני שאתה עובד על משהו — תדע על מה לעבוד</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                רוב המעצבים עובדים על הבעיה הלא נכונה. רצים אחרי לידים כשהבעיה האמיתית היא שאין להם הצעה שמוכרת — או להיפך.
                <br /><br />
                האבחון הזה לוקח 3 דקות. בסוף תדע בדיוק איפה אתה עומד ומה הדבר האחד שכדאי לך לעשות עכשיו.
              </p>
              <button onClick={() => setStep('offer')}
                className="btn-yellow w-full rounded-xl py-3 text-sm font-bold transition hover:opacity-90"
                style={{ background: '#F5C118' }}>
                בוא נתחיל
              </button>
            </>
          )}

          {/* Offer step */}
          {step === 'offer' && (
            <>
              <p className="text-xs leading-relaxed px-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                הצעה שעובדת = הצעה מבוססת תוצאה שאתה יכול למכור שוב ושוב, במחיר מלא, בלי לבנות אותה מחדש לכל לקוח.
              </p>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>5 שאלות</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: offerScore >= 3 ? '#22c55e' : '#f59e0b' }}>{offerScore} / 5</span>
              </div>
              {OFFER_QUESTIONS.map((q, i) => (
                <AnswerRow key={i} question={q} value={offerScores[i]}
                  onChange={v => setOfferScores(prev => prev.map((x, idx) => idx === i ? v : x))} />
              ))}
              <button onClick={nextStep}
                className="w-full rounded-xl py-3 text-sm font-bold transition hover:opacity-90 bg-accent text-accent-foreground">
                המשך לחלק ב׳
              </button>
            </>
          )}

          {/* Leads step */}
          {step === 'leads' && (
            <>
              <p className="text-xs leading-relaxed px-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                זרימת פניות = מקור אחד לפחות שמייצר פניות באופן עקבי — לא תלוי במזל, לא תלוי בהמלצה שתגיע.
              </p>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>5 שאלות</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: leadsScore >= 3 ? '#22c55e' : '#f59e0b' }}>{leadsScore} / 5</span>
              </div>
              {LEADS_QUESTIONS.map((q, i) => (
                <AnswerRow key={i} question={q} value={leadsScores[i]}
                  onChange={v => setLeadsScores(prev => prev.map((x, idx) => idx === i ? v : x))} />
              ))}
              {error && <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>}
              <button onClick={nextStep} disabled={saving}
                className="w-full rounded-xl py-3 text-sm font-bold transition hover:opacity-90 bg-accent text-accent-foreground disabled:opacity-40">
                {saving ? 'שומר...' : showLeverage ? 'המשך לחלק ג׳' : 'סיים אבחון'}
              </button>
            </>
          )}

          {/* Leverage step */}
          {step === 'leverage' && (
            <>
              <p className="text-xs leading-relaxed px-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                הכל עובד — עכשיו השאלה היא האם העסק תלוי רק בשעות שלך.
              </p>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>3 שאלות</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: leverageScore >= 2 ? '#22c55e' : '#f59e0b' }}>{leverageScore} / 3</span>
              </div>
              {LEVERAGE_QUESTIONS.map((q, i) => (
                <AnswerRow key={i} question={q} value={leverageScores[i]}
                  onChange={v => setLeverageScores(prev => prev.map((x, idx) => idx === i ? v : x))} />
              ))}
              {error && <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>}
              <button onClick={handleSave} disabled={saving}
                className="w-full rounded-xl py-3 text-sm font-bold transition hover:opacity-90 bg-accent text-accent-foreground disabled:opacity-40">
                {saving ? 'שומר...' : 'סיים אבחון'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Admin content editor modal (raw JSON) ───────────────────────
function ContentEditorModal({ content, onClose, onSave, saving }) {
  const [text, setText] = useState(JSON.stringify(content, null, 2));
  const [error, setError] = useState('');

  async function handleSave() {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError('שגיאה בפורמט: ' + e.message);
      return;
    }
    setError('');
    const err = await onSave(parsed);
    if (err) setError('שגיאה בשמירה: ' + err);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl p-5 sm:p-6"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)' }}>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">ערוך את כל התכנים של העמוד (אדמין)</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X size={18} />
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
          כאן אפשר לשנות את כל הטקסטים, הכפתורים והתגיות של העמוד. אל תמחק או תשנה שמות שדות (המפתחות באנגלית) - שנה רק את הטקסט שבתוך הגרשיים.
        </p>

        {error && (
          <p className="text-xs mb-2" style={{ color: '#fca5a5' }}>{error}</p>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          dir="ltr"
          className="flex-1 w-full rounded-xl p-3 text-xs font-mono"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', minHeight: '50vh' }}
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 w-full rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40 bg-accent text-accent-foreground"
        >
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function Diagnosis() {
  const { user } = useUser();
  const userId = user?.id;
  const isAdmin = userId === ADMIN_ID;

  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [hasResult, setHasResult]   = useState(false);
  const [offerChecks, setOfferChecks] = useState(Array(5).fill(0));
  const [leadsChecks, setLeadsChecks] = useState(Array(5).fill(0));
  const [delivery, setDelivery]       = useState(false);
  const [updatedAt, setUpdatedAt]     = useState(null);

  const [selectedStage, setSelectedStage] = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [savingContent, setSavingContent] = useState(false);

  useEffect(() => { if (userId) fetchExisting(); else setLoading(false); }, [userId]);
  useEffect(() => { fetchContent(); }, []);

  async function fetchContent() {
    try {
      const { data, error } = await supabase
        .from('diagnosis_content')
        .select('data')
        .eq('id', 'default')
        .maybeSingle();
      if (!error && data?.data) {
        setContent({ ...DEFAULT_CONTENT, ...data.data, stages: { ...DEFAULT_CONTENT.stages, ...(data.data.stages || {}) } });
      }
    } catch (err) {
      console.error('Diagnosis content load error:', err);
    }
  }

  async function saveContent(newContent) {
    setSavingContent(true);
    try {
      const { error } = await supabase
        .from('diagnosis_content')
        .upsert({ id: 'default', data: newContent, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
      setContent(newContent);
      setShowEditor(false);
      return null;
    } catch (err) {
      console.error('Diagnosis content save error:', err);
      return err.message || String(err);
    } finally {
      setSavingContent(false);
    }
  }

  async function fetchExisting() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('diagnosis_results')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        setOfferChecks(data.offer_checks || Array(5).fill(0));
        setLeadsChecks(data.leads_checks || Array(5).fill(0));
        setDelivery(!!data.delivery_check);
        setUpdatedAt(data.updated_at || null);
        setHasResult(true);
      }
    } catch (err) {
      console.error('Diagnosis load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const offerScore = offerChecks.reduce((s, v) => s + (v ?? 0), 0);
  const leadsScore = leadsChecks.reduce((s, v) => s + (v ?? 0), 0);
  const status = computeStatus(offerScore, leadsScore, delivery ? 2 : 0);

  async function saveResults({ offerChecks: oc, leadsChecks: lc, leverageChecks: lv }) {
    if (!userId) return 'משתמש לא מחובר';
    setSaving(true);
    try {
      const offerScore    = oc.reduce((s, v) => s + (v ?? 0), 0);
      const leadsScore    = lc.reduce((s, v) => s + (v ?? 0), 0);
      const leverageScore = (lv || []).reduce((s, v) => s + (v ?? 0), 0);
      const newStatus = computeStatus(offerScore, leadsScore, leverageScore);
      const payload = {
        user_id: userId,
        offer_checks: oc,
        leads_checks: lc,
        delivery_check: leverageScore >= 2,  // keep backward compat column
        offer_score: offerScore,
        leads_score: leadsScore,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('diagnosis_results').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      setOfferChecks(oc);
      setLeadsChecks(lc);
      setDelivery(leverageScore >= 2);
      setUpdatedAt(payload.updated_at);
      setHasResult(true);
      setSelectedStage(newStatus);
      setShowModal(false);
      return null;
    } catch (err) {
      console.error('Diagnosis save error:', err);
      return err.message || String(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgb(var(--bg-surface))' }} />
        ))}
      </div>
    );
  }

  const currentStage = content.stages[status];
  const currentHex   = COLOR_HEX[currentStage.color];
  const currentIdx   = STATUS_ORDER.indexOf(status);
  const activeStageKey = selectedStage || (hasResult ? status : 'building');
  const activeStage = content.stages[activeStageKey];

  return (
    <div className="w-full space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white">{content.pageTitle}</h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {content.pageSubtitle}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowEditor(true)}
            className="flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
          >
            ערוך תכנים (אדמין)
          </button>
        )}
      </div>

      {/* Progress header */}
      <div className="rounded-2xl px-5 py-5 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'rgb(var(--bg-elevated))', border: `1px solid ${hasResult ? currentHex + '33' : 'rgba(255,255,255,0.07)'}` }}>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            התקדמות עסקית
          </div>

          {hasResult ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-white">הרמה שלך: {currentStage.title}</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${currentHex}25`, color: currentHex }}>
                  {currentStage.dots} · שלב {currentIdx + 1} מתוך 4
                </span>
              </div>
              <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {currentStage.subtitle}. ההתמקדות שלך עכשיו: {currentStage.focus[0]}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                ציון הצעה: {offerScore}/5 · ציון פניות: {leadsScore}/5
                {updatedAt && <> · עודכן: {new Date(updatedAt).toLocaleDateString('he-IL')}</>}
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 rounded-xl px-5 py-2 text-sm font-bold transition hover:opacity-90 bg-accent text-accent-foreground"
              >
                {content.ctaLabelAgain}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{content.emptyTitle}</h2>
              <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {content.emptyPrompt}
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 rounded-xl px-6 py-3 text-sm font-bold transition hover:opacity-90 bg-accent text-accent-foreground"
              >
                {content.ctaLabel}
              </button>
            </>
          )}
        </div>
        {hasResult && <ProgressRing value={currentIdx + 1} total={4} color={currentHex} />}
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_ORDER.map((key) => (
          <StageCard
            key={key}
            stage={content.stages[key]}
            isCurrent={hasResult && key === status}
            isSelected={key === activeStageKey}
            hasResult={hasResult}
            onClick={() => setSelectedStage(key)}
          />
        ))}
      </div>

      {/* Selected stage detail */}
      <StageDetail
        stage={activeStage}
        isCurrent={hasResult && activeStageKey === status}
      />

      {/* Reminder */}
      <div className="rounded-2xl px-5 py-4" style={{ background: 'rgba(245,193,24,0.06)', border: '1px solid rgba(245,193,24,0.2)' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
          <b style={{ color: '#F5C118' }}>{content.reminderTitle}</b> {content.reminderText}
        </p>
      </div>

      {showModal && (
        <DiagnosisModal
          initial={{ offerChecks, leadsChecks, leverageChecks: Array(3).fill(0) }}
          onClose={() => setShowModal(false)}
          onSave={saveResults}
          saving={saving}
        />
      )}

      {showEditor && (
        <ContentEditorModal
          content={content}
          onClose={() => setShowEditor(false)}
          onSave={saveContent}
          saving={savingContent}
        />
      )}
    </div>
  );
}
