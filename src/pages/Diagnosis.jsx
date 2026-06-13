import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { Target, AlertCircle, CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';

// ── Questions ─────────────────────────────────────────────────
const OFFER_QUESTIONS = [
  'יש לי חבילה/שירות אחד ברור שאני מציע (לא "כל עבודה לפי מה שהלקוח רוצה")',
  'ב-3 הפרויקטים האחרונים שלי, הלקוח שילם את המחיר שביקשתי בלי משא ומתן',
  'אני יכול להגיד למישהו במשפט אחד מה אני עושה ולמי, והוא מבין מה הוא יקבל',
  'יש לי לפחות 2-3 עבודות/תוצאות שאני יכול להציג כהוכחה שזה עובד',
  'התמחור שלי לא משתנה דרמטית מלקוח ללקוח (אין "מחיר לפי הרגשה")',
];

const LEADS_QUESTIONS = [
  'יש לי לפחות מקור אחד (לא המלצות בלבד) שמייצר פניות חדשות באופן קבוע',
  'בחודש רגיל, יש לי לפחות 2-3 פניות מתאימות, בלי שאני "רודף" אחריהן',
  'אני יודע מאיפה הלקוח האחרון שלי הגיע - ויש לי תהליך לחזור על זה',
  'אם היום אין לי פרויקטים, אני לא בפאניקה - כי אני יודע שפניות יגיעו',
  'יש לי רשימה/קהל (אינסטגרם, מייל, וואטסאפ) שאני יכול לפנות אליו כשצריך',
];

const DELIVERY_QUESTION =
  'יש לי תהליך מסירה שעובד גם בלי שאני מעורב ב-100% בכל שלב (תבניות, צ׳קליסטים, פרילנסר תומך, אוטומציה)';

// ── Status definitions ───────────────────────────────────────
const STATUS_ORDER = ['building', 'loaded', 'spinning', 'compounding'];

const STATUS_META = {
  building: {
    emoji: '🔴🔴',
    title: 'בונה (Building)',
    subtitle: 'אין עדיין הצעה שמוכרת | אין עדיין זרימת לידים',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    feels: [
      'כל פרויקט נראה קצת אחרת - תמחור, תהליך, תוצרים',
      'לפעמים יש עבודה, לפעמים שקט מוחלט ומפחיד',
      'אתה אומר "כן" לכל מה שמגיע, כי אתה לא בטוח שיבוא עוד',
    ],
    mistake: 'לנסות לעבוד על שיווק/לידים לפני שיש הצעה ברורה. זה כמו לפרסם חנות שעדיין לא ברור מה היא מוכרת.',
    focus: [
      'הגדר חבילה/תהליך אחד - מה אתה עושה, לכמה זמן, באיזה מחיר (לדוגמה: "חבילת מיתוג מלא - 3 שבועות - 8,000 ש״ח")',
      'מכור אותה (אפילו ללקוח אחד) במחיר מלא - בלי "זה תלוי"',
      'תעד את התהליך והתוצאה - צלם מסך, אסוף משוב, הפוך את זה לקייסטאדי',
    ],
    question: 'מכרתי את אותה חבילה פעמיים, באותו מחיר בערך, בלי לבנות אותה מאפס בכל פעם?',
  },
  loaded: {
    emoji: '🟢🔴',
    title: 'טעון (Loaded)',
    subtitle: 'יש הצעה שעובדת | אין עדיין זרימת לידים',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    feels: [
      'כשמישהו מגיע, אתה יודע מה להציע ואיך לתמחר - וזה עובד',
      'אבל הפניות מגיעות ב"גלים" - חודש מלא, חודש ריק',
      'אתה תלוי בהמלצות, בקבוצות פייסבוק, ב"מי שיגיע יגיע"',
    ],
    mistake: 'לשנות את ההצעה כל הזמן "כדי שיהיו יותר לידים", במקום לעבוד על ערוץ הפצה.',
    focus: [
      'בחר ערוץ אחד (לא 5) - אינסטגרם, לינקדאין, או רשת קשרים יזומה',
      'הגדר פעולה שבועית קבועה בערוץ הזה (לדוגמה: 3 פוסטים + 5 פניות יזומות בשבוע)',
      'עקוב 4 שבועות - כמה פניות זה מייצר?',
    ],
    question: 'יש לי מקור אחד שאני יכול להגיד עליו "זה מביא לי X פניות בחודש"?',
  },
  spinning: {
    emoji: '🟢🟢',
    title: 'מסתובב (Spinning)',
    subtitle: 'הצעה שעובדת + זרימת לידים',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    feels: [
      'פניות מגיעות, אתה סוגר אותן, יש הכנסה יציבה',
      'אבל אתה התחנה היחידה - כל פרויקט עובר רק דרכך',
      'אין לך זמן לעבוד על העסק, רק בתוך העסק - וההכנסה תלויה בשעות שלך',
    ],
    mistake: 'לקחת עוד לקוחות כדי "להרוויח יותר" - וזה רק מגדיל את העומס, לא את הרווח לשעה.',
    focus: [
      'מפה את כל שלבי הפרויקט שלך - איפה אתה מבזבז הכי הרבה זמן על דברים שלא חייבים להיות אתה?',
      'בחר שלב אחד להעביר/לתבנת (תבניות, צ׳קליסטים, פרילנסר תומך, אוטומציה)',
      'הגדר "תקרת לקוחות" - כמה פרויקטים פעילים בו-זמנית זה הגבול שלך',
    ],
    question: 'יש שלב אחד בתהליך שעכשיו קורה בלעדיי (או בלי שאני מעורב ב-100%)?',
  },
  compounding: {
    emoji: '🟢🟢🟢',
    title: 'מצטבר (Compounding)',
    subtitle: 'הצעה + לידים + מנוף משתלם',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    feels: [
      'ההצעה עובדת, הלידים זורמים, ויש לך מנגנון שמחזיר לך זמן',
      'לקוח חדש לא "עולה" לך בעוד לילות ללא שינה',
      'אתה יכול לבחור לקוחות, לא רק לקבל את מי שמגיע',
    ],
    mistake: 'להרגיש "סיימתי" - אבל גם בשלב הזה יש עבודה: תמחור, בחירת לקוחות וחופש אמיתי.',
    focus: [
      'תמחור פרימיום - האם המחיר שלך משקף את התוצאה שאתה נותן, או עדיין את הזמן שלך?',
      'בחירת לקוחות - האם אתה עובד עם הלקוחות שאתה רוצה, או עם מי שמגיע?',
      'חופש - האם החופש שהשגת מתורגם לחיים שאתה רוצה (זמן, יצירתיות, בריאות)?',
    ],
    question: 'אם הייתי לוקח שבוע חופש לגמרי, העסק היה ממשיך לתפקד?',
  },
};

function scoreLabel(score) {
  return score >= 3 ? 'גבוה' : 'נמוך';
}

function computeStatus(offerScore, leadsScore, delivery) {
  if (offerScore < 3) return 'building';
  if (leadsScore < 3) return 'loaded';
  if (!delivery) return 'spinning';
  return 'compounding';
}

// ── Checkbox row ──────────────────────────────────────────────
function CheckRow({ checked, onToggle, children }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-right transition hover:bg-white/[0.04]"
      style={{ border: '1px solid rgba(255,255,255,0.07)', background: checked ? 'rgba(34,197,94,0.06)' : 'transparent' }}
    >
      <div
        className="mt-0.5 h-5 w-5 flex-none rounded-md border-2 flex items-center justify-center transition"
        style={{ borderColor: checked ? '#22c55e' : 'rgba(255,255,255,0.2)', background: checked ? '#22c55e' : 'transparent' }}
      >
        {checked && <CheckCircle2 size={13} color="#fff" />}
      </div>
      <span className="text-sm leading-snug" style={{ color: checked ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)' }}>
        {children}
      </span>
    </button>
  );
}

// ── Mini flywheel strip (mirrors roadmap-style status pills) ───
function FlywheelStrip({ activeStatus }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {STATUS_ORDER.map(key => {
        const meta = STATUS_META[key];
        const active = key === activeStatus;
        return (
          <div
            key={key}
            className="rounded-xl px-3 py-2.5 transition"
            style={{
              background: active ? meta.bg : 'rgb(var(--bg-elevated))',
              border: `1px solid ${active ? meta.color + '66' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            <div className="text-xs font-bold" style={{ color: active ? meta.color : 'rgba(255,255,255,0.4)' }}>
              {meta.emoji} {meta.title.split(' ')[0]}
            </div>
            {active && (
              <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                אתה כאן
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function Diagnosis() {
  const { user } = useUser();
  const userId = user?.id;

  const [offerChecks, setOfferChecks] = useState(Array(5).fill(false));
  const [leadsChecks, setLeadsChecks] = useState(Array(5).fill(false));
  const [delivery, setDelivery] = useState(false);

  const [focusText, setFocusText] = useState('');
  const [metricText, setMetricText] = useState('');
  const [recheckDate, setRecheckDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => { if (userId) fetchExisting(); else setLoading(false); }, [userId]);

  async function fetchExisting() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('diagnosis_results')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        setOfferChecks(data.offer_checks || Array(5).fill(false));
        setLeadsChecks(data.leads_checks || Array(5).fill(false));
        setDelivery(!!data.delivery_check);
        setFocusText(data.focus_text || '');
        setMetricText(data.metric_text || '');
        setRecheckDate(data.recheck_date || '');
        setSavedAt(data.updated_at || null);
      }
    } catch (err) {
      console.error('Diagnosis load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const offerScore = offerChecks.filter(Boolean).length;
  const leadsScore = leadsChecks.filter(Boolean).length;
  const status = computeStatus(offerScore, leadsScore, delivery);
  const meta = STATUS_META[status];

  function toggleOffer(i) {
    setOfferChecks(prev => prev.map((v, idx) => idx === i ? !v : v));
  }
  function toggleLeads(i) {
    setLeadsChecks(prev => prev.map((v, idx) => idx === i ? !v : v));
  }

  async function saveResults() {
    if (!userId) return;
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        offer_checks: offerChecks,
        leads_checks: leadsChecks,
        delivery_check: delivery,
        offer_score: offerScore,
        leads_score: leadsScore,
        status,
        focus_text: focusText,
        metric_text: metricText,
        recheck_date: recheckDate || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('diagnosis_results').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      setSavedAt(payload.updated_at);
    } catch (err) {
      console.error('Diagnosis save error:', err);
    } finally {
      setSaving(false);
    }
  }

  function resetAll() {
    setOfferChecks(Array(5).fill(false));
    setLeadsChecks(Array(5).fill(false));
    setDelivery(false);
    setFocusText('');
    setMetricText('');
    setRecheckDate('');
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

  return (
    <div className="w-full space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white">אבחון: באיזה שלב נמצא העסק שלך?</h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            לפני שעובדים על משהו - חשוב לדעת על מה לעבוד. ענה בכנות, וקבל את הצעד הפרקטי הבא שלך.
          </p>
        </div>
        <button
          onClick={resetAll}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-white/10 flex-none"
          style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}
        >
          <RotateCcw size={13} /> איפוס
        </button>
      </div>

      {/* Why it matters */}
      <div
        className="rounded-2xl px-5 py-5 sm:px-8 sm:py-6"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-start gap-3">
          <Target size={20} className="flex-none mt-0.5" style={{ color: '#F5C118' }} />
          <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <p className="mb-2">
              הרבה מעצבים, ממתגים ובוני אתרים מנסים לפתור את הבעיה הלא נכונה: רצים אחרי עוד לידים כשהבעיה האמיתית היא
              שאין להם זמן לעוד פרויקטים, או עובדים על "מיתוג אישי" כשהבעיה האמיתית היא שאין להם הצעה שמוכרת במחיר מלא.
            </p>
            <p>
              האבחון מבוסס על 2 צירים: <b style={{ color: 'rgba(255,255,255,0.9)' }}>Offer Traction</b> - יש לך הצעה
              שמוכרת שוב ושוב במחיר מלא? ו-<b style={{ color: 'rgba(255,255,255,0.9)' }}>Leads Traction</b> - יש לך
              מקור פניות שעובד בעקביות?
            </p>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Offer Traction */}
        <div className="rounded-2xl p-5" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">חלק א׳ - Offer Traction</h2>
            <span className="text-sm font-bold tabular-nums px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', color: offerScore >= 3 ? '#86efac' : '#fca5a5' }}>
              {offerScore} / 5
            </span>
          </div>
          <div className="space-y-2">
            {OFFER_QUESTIONS.map((q, i) => (
              <CheckRow key={i} checked={offerChecks[i]} onToggle={() => toggleOffer(i)}>{q}</CheckRow>
            ))}
          </div>
          <div className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            0-2 = אין עדיין Offer Traction · 3-5 = יש Offer Traction
          </div>
        </div>

        {/* Leads Traction */}
        <div className="rounded-2xl p-5" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">חלק ב׳ - Leads Traction</h2>
            <span className="text-sm font-bold tabular-nums px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', color: leadsScore >= 3 ? '#86efac' : '#fca5a5' }}>
              {leadsScore} / 5
            </span>
          </div>
          <div className="space-y-2">
            {LEADS_QUESTIONS.map((q, i) => (
              <CheckRow key={i} checked={leadsChecks[i]} onToggle={() => toggleLeads(i)}>{q}</CheckRow>
            ))}
          </div>
          <div className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            0-2 = אין עדיין Leads Traction · 3-5 = יש Leads Traction
          </div>
        </div>
      </div>

      {/* Delivery question - only relevant once both are high */}
      {offerScore >= 3 && leadsScore >= 3 && (
        <div className="rounded-2xl p-5" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-base font-bold text-white mb-3">שאלת בונוס - תהליך מסירה</h2>
          <CheckRow checked={delivery} onToggle={() => setDelivery(d => !d)}>{DELIVERY_QUESTION}</CheckRow>
        </div>
      )}

      {/* Result */}
      <div
        className="rounded-2xl p-5 sm:p-6"
        style={{ background: 'rgb(var(--bg-surface))', border: `1px solid ${meta.color}55` }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          הסטטוס שלך
        </div>

        <FlywheelStrip activeStatus={status} />

        <div className="mt-5 rounded-xl p-4" style={{ background: meta.bg }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{meta.emoji}</span>
            <h3 className="text-lg font-bold" style={{ color: meta.color }}>{meta.title}</h3>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{meta.subtitle}</p>
          <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Offer Traction: {scoreLabel(offerScore)} ({offerScore}/5) · Leads Traction: {scoreLabel(leadsScore)} ({leadsScore}/5)
          </p>
        </div>

        {/* How it feels */}
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-white mb-2">איך זה מרגיש</h4>
          <ul className="space-y-1.5">
            {meta.feels.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full" style={{ background: meta.color }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Common mistake */}
        <div className="mt-4 rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <AlertCircle size={18} className="flex-none mt-0.5" style={{ color: '#fbbf24' }} />
          <div>
            <h4 className="text-sm font-semibold mb-1" style={{ color: '#fbbf24' }}>הטעות הנפוצה בשלב הזה</h4>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{meta.mistake}</p>
          </div>
        </div>

        {/* Focus for the month */}
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-white mb-2">המוקד שלך לחודש הקרוב</h4>
          <ol className="space-y-2">
            {meta.focus.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span className="flex-none flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold"
                  style={{ background: meta.bg, color: meta.color }}>
                  {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{f}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* End of month question */}
        <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', borderRight: `3px solid ${meta.color}` }}>
          <h4 className="text-sm font-semibold mb-1" style={{ color: meta.color }}>שאלה לסיום החודש</h4>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{meta.question}</p>
        </div>
      </div>

      {/* Action plan */}
      <div className="rounded-2xl p-5 sm:p-6 space-y-4" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ArrowRight size={16} style={{ color: '#F5C118' }} />
          הצעד הבא שלך
        </h2>

        <div className="space-y-1">
          <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>הדבר האחד שאני מתמקד בו החודש</label>
          <textarea
            value={focusText}
            onChange={e => setFocusText(e.target.value)}
            placeholder="לדוגמה: לבנות חבילת מיתוג אחת ברורה ולמכור אותה במחיר מלא"
            rows={2}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontFamily: 'inherit', resize: 'none' }}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>איך אדע שהתקדמתי (מדד אחד, מספרי)</label>
            <input
              value={metricText}
              onChange={e => setMetricText(e.target.value)}
              placeholder="לדוגמה: סגרתי לקוח אחד באותו מחיר פעמיים"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>תאריך לבדיקה מחדש</label>
            <input
              type="date"
              value={recheckDate}
              onChange={e => setRecheckDate(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveResults}
            disabled={saving}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40 bg-accent text-accent-foreground"
          >
            {saving ? 'שומר...' : 'שמור אבחון'}
          </button>
          {savedAt && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              נשמר לאחרונה: {new Date(savedAt).toLocaleDateString('he-IL')}
            </span>
          )}
        </div>
      </div>

      {/* Reminder */}
      <div className="rounded-2xl px-5 py-4" style={{ background: 'rgba(245,193,24,0.06)', border: '1px solid rgba(245,193,24,0.2)' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
          <b style={{ color: '#F5C118' }}>תזכורת:</b> אל תנסה לעבוד על כל הארבעה בבת אחת. התקדמות אחת אומרת שלב אחד
          בכל פעם. המטרה היא לזהות את צוואר הבקבוק האמיתי שלך עכשיו - ולעבוד רק עליו.
        </p>
      </div>
    </div>
  );
}
