import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { AlertCircle, CheckCircle2, X, ChevronDown } from 'lucide-react';

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
  'יש לי תהליך מסירה שעובד גם בלי שאני מעורב באופן מלא בכל שלב (תבניות, צ׳קליסטים, איש צוות, אוטומציה)';

// ── Status definitions ───────────────────────────────────────
const STATUS_ORDER = ['building', 'loaded', 'spinning', 'compounding'];

const STATUS_META = {
  building: {
    dots: '🔴🔴',
    title: 'בונה',
    subtitle: 'אין עדיין הצעה שמוכרת ואין עדיין זרימת פניות',
    color: 'red',
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
    subtitle: 'יש הצעה שעובדת אבל אין עדיין זרימת פניות',
    color: 'amber',
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
    subtitle: 'הצעה שעובדת וגם זרימת פניות',
    color: 'green',
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
    subtitle: 'הצעה, פניות, וגם מנוף שמשתלם',
    color: 'blue',
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
};

const COLOR_HEX = {
  red:   '#ef4444',
  amber: '#f59e0b',
  green: '#22c55e',
  blue:  '#3b82f6',
};

// Short focus tags shown as chips on each stage card
const FOCUS_TAGS = {
  building:    ['הצעה אחת', 'מכירה ראשונה', 'תיעוד'],
  loaded:      ['ערוץ אחד', 'פעולה שבועית', 'מעקב'],
  spinning:    ['מיפוי תהליך', 'תבנות עבודה', 'תקרת לקוחות'],
  compounding: ['תמחור פרימיום', 'בחירת לקוחות', 'חופש'],
};

function computeStatus(offerScore, leadsScore, delivery) {
  if (offerScore < 3) return 'building';
  if (leadsScore < 3) return 'loaded';
  if (!delivery) return 'spinning';
  return 'compounding';
}

// ── Checkbox row (used inside the diagnosis modal) ─────────────
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

// ── Stage card (top row of 4) ───────────────────────────────────
function StageCard({ statusKey, isCurrent, isDone, offerOk, leadsOk, hasResult }) {
  const meta = STATUS_META[statusKey];
  const hex = COLOR_HEX[meta.color];

  return (
    <div
      className="rounded-xl px-3.5 py-3.5 relative transition"
      style={{
        background: isCurrent ? `${hex}1a` : 'rgb(var(--bg-elevated))',
        border: `1px solid ${isCurrent ? hex : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isCurrent ? `0 0 0 1px ${hex}33` : 'none',
        opacity: hasResult && !isCurrent ? 0.55 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold" style={{ color: isCurrent ? hex : 'rgba(255,255,255,0.75)' }}>
          {meta.title}
        </span>
        {hasResult && (
          <span className="h-2.5 w-2.5 rounded-full flex-none" style={{
            border: `2px solid ${hex}`,
            background: isCurrent ? hex : 'transparent',
          }} />
        )}
      </div>

      {hasResult && (
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: offerOk ? '#22c55e' : '#ef4444' }} />
            הצעה
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: leadsOk ? '#22c55e' : '#ef4444' }} />
            פניות
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {FOCUS_TAGS[statusKey].map(tag => (
          <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
            style={{
              background: isCurrent ? `${hex}25` : 'rgba(255,255,255,0.05)',
              color: isCurrent ? hex : 'rgba(255,255,255,0.4)',
            }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Stage detail block (expand/collapse) ────────────────────────
function StageDetail({ statusKey, isCurrent, open, onToggle }) {
  const meta = STATUS_META[statusKey];
  const hex = COLOR_HEX[meta.color];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgb(var(--bg-surface))', border: `1px solid ${isCurrent ? hex + '55' : 'rgba(255,255,255,0.08)'}` }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 text-right hover:bg-white/[0.03] transition"
      >
        <div className="flex items-center gap-2.5">
          <span>{meta.dots}</span>
          <span className="text-sm font-bold" style={{ color: isCurrent ? hex : 'rgba(255,255,255,0.85)' }}>{meta.title}</span>
          <span className="text-xs hidden sm:inline" style={{ color: 'rgba(255,255,255,0.35)' }}>{meta.subtitle}</span>
          {isCurrent && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${hex}25`, color: hex }}>
              השלב שלך
            </span>
          )}
        </div>
        <ChevronDown size={16} className="transition-transform duration-200 flex-none"
          style={{ color: 'rgba(255,255,255,0.35)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
          <div>
            <h4 className="text-sm font-semibold text-white mb-2">איך זה מרגיש</h4>
            <ul className="space-y-1.5">
              {meta.feels.map((f, i) => (
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
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{meta.mistake}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-2">המוקד בשלב הזה</h4>
            <ol className="space-y-2">
              {meta.focus.map((f, i) => (
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
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{meta.question}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Diagnosis modal (questionnaire) ─────────────────────────────
function DiagnosisModal({ initial, onClose, onSave, saving }) {
  const [offerChecks, setOfferChecks] = useState(initial.offerChecks);
  const [leadsChecks, setLeadsChecks] = useState(initial.leadsChecks);
  const [delivery, setDelivery] = useState(initial.delivery);

  const offerScore = offerChecks.filter(Boolean).length;
  const leadsScore = leadsChecks.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl p-5 sm:p-6"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.1)' }}>

        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">אבחון העסק שלך</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white">חלק א׳ - יש לי הצעה שמוכרת?</h4>
              <span className="text-sm font-bold tabular-nums px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', color: offerScore >= 3 ? '#86efac' : '#fca5a5' }}>
                {offerScore} / 5
              </span>
            </div>
            <div className="space-y-2">
              {OFFER_QUESTIONS.map((q, i) => (
                <CheckRow key={i} checked={offerChecks[i]} onToggle={() => setOfferChecks(prev => prev.map((v, idx) => idx === i ? !v : v))}>{q}</CheckRow>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white">חלק ב׳ - יש לי זרימת פניות?</h4>
              <span className="text-sm font-bold tabular-nums px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', color: leadsScore >= 3 ? '#86efac' : '#fca5a5' }}>
                {leadsScore} / 5
              </span>
            </div>
            <div className="space-y-2">
              {LEADS_QUESTIONS.map((q, i) => (
                <CheckRow key={i} checked={leadsChecks[i]} onToggle={() => setLeadsChecks(prev => prev.map((v, idx) => idx === i ? !v : v))}>{q}</CheckRow>
              ))}
            </div>
          </div>

          {offerScore >= 3 && leadsScore >= 3 && (
            <div>
              <h4 className="text-sm font-bold text-white mb-3">שאלת בונוס - תהליך מסירה</h4>
              <CheckRow checked={delivery} onToggle={() => setDelivery(d => !d)}>{DELIVERY_QUESTION}</CheckRow>
            </div>
          )}

          <button
            onClick={() => onSave({ offerChecks, leadsChecks, delivery })}
            disabled={saving}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40 bg-accent text-accent-foreground"
          >
            {saving ? 'שומר...' : 'שמור ועדכן את הרמה שלי'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function Diagnosis() {
  const { user } = useUser();
  const userId = user?.id;

  const [hasResult, setHasResult]   = useState(false);
  const [offerChecks, setOfferChecks] = useState(Array(5).fill(false));
  const [leadsChecks, setLeadsChecks] = useState(Array(5).fill(false));
  const [delivery, setDelivery]       = useState(false);
  const [updatedAt, setUpdatedAt]     = useState(null);

  const [openStages, setOpenStages] = useState(new Set());
  const [showModal, setShowModal]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

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
        setUpdatedAt(data.updated_at || null);
        setHasResult(true);
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

  function toggleStage(key) {
    setOpenStages(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function saveResults({ offerChecks: oc, leadsChecks: lc, delivery: dl }) {
    if (!userId) return;
    setSaving(true);
    try {
      const newStatus = computeStatus(oc.filter(Boolean).length, lc.filter(Boolean).length, dl);
      const payload = {
        user_id: userId,
        offer_checks: oc,
        leads_checks: lc,
        delivery_check: dl,
        offer_score: oc.filter(Boolean).length,
        leads_score: lc.filter(Boolean).length,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('diagnosis_results').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      setOfferChecks(oc);
      setLeadsChecks(lc);
      setDelivery(dl);
      setUpdatedAt(payload.updated_at);
      setHasResult(true);
      setOpenStages(new Set([newStatus]));
      setShowModal(false);
    } catch (err) {
      console.error('Diagnosis save error:', err);
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

  const currentMeta = STATUS_META[status];
  const currentHex  = COLOR_HEX[currentMeta.color];
  const currentIdx  = STATUS_ORDER.indexOf(status);

  return (
    <div className="w-full space-y-6">

      {/* Header + prominent diagnosis button */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white">אבחון עסקי</h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            לפני שעובדים על משהו - חשוב לדעת על מה לעבוד. הנה ארבעת השלבים, ואיפה אתה נמצא בהם.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex-none rounded-xl px-6 py-3 text-sm font-bold transition hover:opacity-90 bg-accent text-accent-foreground"
        >
          {hasResult ? 'לאבחן מחדש את העסק שלי' : 'לאבחן את העסק שלי'}
        </button>
      </div>

      {/* Progress header */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
          סטטוס המסע העסקי
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {hasResult ? `הרמה שלך: ${currentMeta.title}` : 'עדיין לא ביצעת אבחון'}
          </h2>
          {hasResult && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${currentHex}25`, color: currentHex }}>
              {currentMeta.dots} · שלב {currentIdx + 1} מתוך 4
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {hasResult
            ? <>{currentMeta.subtitle}. ההתמקדות שלך עכשיו: {currentMeta.focus[0]}</>
            : 'לחץ על "לאבחן את העסק שלי" כדי לגלות באיזה שלב אתה נמצא ומה הצעד הבא שלך.'}
        </p>
        {hasResult && (
          <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            ציון הצעה: {offerScore}/5 · ציון פניות: {leadsScore}/5
            {updatedAt && <> · עודכן: {new Date(updatedAt).toLocaleDateString('he-IL')}</>}
          </p>
        )}
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_ORDER.map((key, i) => (
          <StageCard
            key={key}
            statusKey={key}
            isCurrent={hasResult && key === status}
            isDone={hasResult && i < currentIdx}
            hasResult={hasResult}
            offerOk={offerScore >= 3}
            leadsOk={leadsScore >= 3}
          />
        ))}
      </div>

      {/* Stage details */}
      <div className="space-y-3">
        {STATUS_ORDER.map(key => (
          <StageDetail
            key={key}
            statusKey={key}
            isCurrent={hasResult && key === status}
            open={openStages.has(key)}
            onToggle={() => toggleStage(key)}
          />
        ))}
      </div>

      {/* Reminder */}
      <div className="rounded-2xl px-5 py-4" style={{ background: 'rgba(245,193,24,0.06)', border: '1px solid rgba(245,193,24,0.2)' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
          <b style={{ color: '#F5C118' }}>תזכורת:</b> אל תנסה לעבוד על כל ארבעת השלבים בבת אחת. התקדמות אחת אומרת שלב
          אחד בכל פעם. המטרה היא לזהות את צוואר הבקבוק האמיתי שלך עכשיו - ולעבוד רק עליו.
        </p>
      </div>

      {showModal && (
        <DiagnosisModal
          initial={{ offerChecks, leadsChecks, delivery }}
          onClose={() => setShowModal(false)}
          onSave={saveResults}
          saving={saving}
        />
      )}
    </div>
  );
}
