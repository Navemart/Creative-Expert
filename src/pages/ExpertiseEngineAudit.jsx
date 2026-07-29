/**
 * אבחון מנוע המומחיות
 *
 * Supabase tables required:
 *
 * CREATE TABLE expertise_engine_config (
 *   item_id      TEXT PRIMARY KEY,
 *   label        TEXT NOT NULL DEFAULT 'דוגמה',
 *   link         TEXT NOT NULL DEFAULT '',
 *   question_text TEXT NOT NULL DEFAULT '',
 *   updated_at   TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE expertise_audit_submissions (
 *   id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id      TEXT NOT NULL,
 *   income_tier  TEXT NOT NULL,
 *   ratings      JSONB NOT NULL,
 *   submitted_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */

import { Zap, ChevronDown, ChevronUp, ArrowRight, X, ExternalLink, Pencil, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

/* ── Grid structure ──────────────────────────────────────────────── */
const PILLAR_DEFS = [
  { id: 'A', label: 'לבלוט',  top: ['S1','S2','S3'], bottom: ['S4','S5','S6'] },
  { id: 'B', label: 'להוביל', top: ['L1','L2','L3'], bottom: ['L4','L5','L6'] },
  { id: 'C', label: 'לשלוט',  top: ['C1','C2','C3'], bottom: ['C4','C5','C6'] },
  { id: 'D', label: 'לספק',   top: ['D1','D2','D3'], bottom: ['D4','D5','D6'] },
];

/* ── Item metadata (immutable) ───────────────────────────────────── */
const ITEM_META = {
  S1:{ pillarLabel:'לבלוט',  tier:'top'    }, S2:{ pillarLabel:'לבלוט',  tier:'top'    }, S3:{ pillarLabel:'לבלוט',  tier:'top'    },
  S4:{ pillarLabel:'לבלוט',  tier:'bottom' }, S5:{ pillarLabel:'לבלוט',  tier:'bottom' }, S6:{ pillarLabel:'לבלוט',  tier:'bottom' },
  L1:{ pillarLabel:'להוביל', tier:'top'    }, L2:{ pillarLabel:'להוביל', tier:'top'    }, L3:{ pillarLabel:'להוביל', tier:'top'    },
  L4:{ pillarLabel:'להוביל', tier:'bottom' }, L5:{ pillarLabel:'להוביל', tier:'bottom' }, L6:{ pillarLabel:'להוביל', tier:'bottom' },
  C1:{ pillarLabel:'לשלוט',  tier:'top'    }, C2:{ pillarLabel:'לשלוט',  tier:'top'    }, C3:{ pillarLabel:'לשלוט',  tier:'top'    },
  C4:{ pillarLabel:'לשלוט',  tier:'bottom' }, C5:{ pillarLabel:'לשלוט',  tier:'bottom' }, C6:{ pillarLabel:'לשלוט',  tier:'bottom' },
  D1:{ pillarLabel:'לספק',   tier:'top'    }, D2:{ pillarLabel:'לספק',   tier:'top'    }, D3:{ pillarLabel:'לספק',   tier:'top'    },
  D4:{ pillarLabel:'לספק',   tier:'bottom' }, D5:{ pillarLabel:'לספק',   tier:'bottom' }, D6:{ pillarLabel:'לספק',   tier:'bottom' },
};

/* ── Default content (used until admin edits in Supabase) ────────── */
const CONFIG_DEFAULTS = {
  S1:{ label:'דוגמה', link:'', question:'אני מפרסם תוכן לפחות 3 פעמים בשבוע' },
  S2:{ label:'דוגמה', link:'', question:'אני יודע מה לפרסם בכל שבוע כדי למשוך לקוחות' },
  S3:{ label:'דוגמה', link:'', question:'אני יכול להתחיל 3-5 שיחות ביום עם לידים פוטנציאליים בלי ממון' },
  S4:{ label:'דוגמה', link:'', question:'יש לי תוכן שמוביל לידים לנכס המרה (סרטון / דף נחיתה)' },
  S5:{ label:'דוגמה', link:'', question:'יש לי מגנט לידים שמייצר קהל מוסמך באופן עקבי' },
  S6:{ label:'דוגמה', link:'', question:'אני מריץ תעבורה ממומנת שמגדילה חשיפה בצורה רווחית' },
  L1:{ label:'דוגמה', link:'', question:'יש לי שיטה לנהל שיחות מהודעה ראשונה עד סגירה' },
  L2:{ label:'דוגמה', link:'', question:'אני עולה לשיחות רק עם מועמדים מתאימים ואיכותיים' },
  L3:{ label:'דוגמה', link:'', question:'יש לי דרך לעקוב אחרי הלידים וההתקדמות שלהם' },
  L4:{ label:'דוגמה', link:'', question:'אני מוביל לפחות פעם בשבוע אנשים לקייסטאדי / תוכן ארוך' },
  L5:{ label:'דוגמה', link:'', question:'יש לי נכס המרה (סרטון / לנדינג) שמסביר את ההצעה ומביא שיחות' },
  L6:{ label:'דוגמה', link:'', question:'יש לי מוצר אבחון / כניסה שמסנן לקוחות לפני שיחה גדולה' },
  C1:{ label:'דוגמה', link:'', question:'אני בטוח שיש לי לפחות 20% רווח מכל פרויקט' },
  C2:{ label:'דוגמה', link:'', question:'יש לי תהליכים ברורים שנותנים בהירות ובטחון ללקוחות' },
  C3:{ label:'דוגמה', link:'', question:'הלקוחות יודעים את הגבולות שלי ומכבדים אותם' },
  C4:{ label:'דוגמה', link:'', question:'אני מרוויח לפחות 40% רווח ויכול לגדול בלי לשחוק' },
  C5:{ label:'דוגמה', link:'', question:'יש לי מחיר שמשקף את הרמה שלי ואני לא מתנצל עליו' },
  C6:{ label:'דוגמה', link:'', question:'אני יכול להאציל חלקים בפרויקט ועדיין לשמור על רווחיות' },
  D1:{ label:'דוגמה', link:'', question:'יש לי הצעה אחת מרכזית שאני מוכר ב-3,000₪ לפחות' },
  D2:{ label:'דוגמה', link:'', question:'יש לי לפחות 3 קייסטאדיז שמראים את השינוי שאני עושה' },
  D3:{ label:'דוגמה', link:'', question:'אני מקבל המלצה מכל לקוח בסיום פרויקט' },
  D4:{ label:'דוגמה', link:'', question:'יש לי לפחות 3 קייסטאדיז מצולמים שמראים שינוי ברור' },
  D5:{ label:'דוגמה', link:'', question:'לקוחות ממליצים עליי לאחרים באופן שוטף ואקטיבי' },
  D6:{ label:'דוגמה', link:'', question:'יש לי מסלול ברור: ממוצר כניסה → תוכנית מלאה → חידוש / הפניה' },
};

const BELOW_IDS = ['S1','S2','S3','L1','L2','L3','C1','C2','C3','D1','D2','D3'];
const ABOVE_IDS = ['S4','S5','S6','L4','L5','L6','C4','C5','C6','D4','D5','D6'];

/* ── Colour tokens ───────────────────────────────────────────────── */
const RED_CARD  = 'rgba(239,68,68,0.10)';
const RED_ID    = 'rgba(239,68,68,0.22)';
const RED_TXT   = 'rgba(252,165,165,0.95)';
const RED_LBL   = 'rgba(252,165,165,0.6)';
const BLUE_CARD = 'rgba(59,130,246,0.10)';
const BLUE_ID   = 'rgba(59,130,246,0.22)';
const BLUE_TXT  = 'rgba(147,197,253,0.95)';
const BLUE_LBL  = 'rgba(147,197,253,0.6)';

const STATUS = {
  red:   { bg:'rgba(239,68,68,0.18)',  border:'#ef4444', label:'אדום',  dot:'#ef4444' },
  amber: { bg:'rgba(245,158,11,0.18)', border:'#f59e0b', label:'כתום',  dot:'#f59e0b' },
  green: { bg:'rgba(34,197,94,0.18)',  border:'#22c55e', label:'ירוק',  dot:'#22c55e' },
};

/* ── Item card ───────────────────────────────────────────────────── */
function ItemCard({ itemId, tier, rating, label, link, editMode, onEditClick }) {
  const [hovered, setHovered] = useState(false);
  const isTop   = tier === 'top';
  const cardBg  = isTop ? RED_CARD  : BLUE_CARD;
  const idBg    = isTop ? RED_ID    : BLUE_ID;
  const idTxt   = isTop ? RED_TXT   : BLUE_TXT;
  const s       = rating ? STATUS[rating] : null;

  function handleClick() {
    if (editMode) { onEditClick(itemId); return; }
    if (link) window.open(link, '_blank', 'noopener');
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      style={{
        display:'flex', direction:'rtl', borderRadius:'10px', overflow:'hidden',
        height:'76px',
        background: hovered
          ? (isTop ? 'rgba(239,68,68,0.16)' : 'rgba(59,130,246,0.16)')
          : cardBg,
        cursor: editMode ? 'text' : (link ? 'pointer' : 'default'),
        transition:'background 0.15s', position:'relative',
      }}
    >
      {s && <div style={{ width:'4px', minWidth:'4px', background:s.border, flexShrink:0 }} />}

      <div style={{
        width:'52px', minWidth:'52px', background:idBg,
        borderLeft:`1px solid ${isTop ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'12px', fontWeight:800, color:idTxt, letterSpacing:'0.03em', fontFamily:'monospace',
      }}>
        {itemId}
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', padding:'0 14px' }}>
        <span style={{ fontSize:'13px', fontWeight:500, color:'rgba(255,255,255,0.82)', lineHeight:1.3 }}>
          {label}
        </span>
      </div>

      {hovered && (
        <div style={{
          position:'absolute', top:'50%', left:'10px', transform:'translateY(-50%)',
          color: isTop ? 'rgba(252,165,165,0.55)' : 'rgba(147,197,253,0.55)',
        }}>
          {editMode ? <Pencil size={13} /> : <ExternalLink size={13} />}
        </div>
      )}
    </div>
  );
}

/* ── Admin edit modal (per item) ─────────────────────────────────── */
function EditItemModal({ itemId, current, onSave, onClose }) {
  const [label,    setLabel]    = useState(current.label);
  const [link,     setLink]     = useState(current.link);
  const [question, setQuestion] = useState(current.question);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('expertise_engine_config')
        .upsert({
          item_id: itemId,
          label,
          link,
          question_text: question,
          updated_at: new Date().toISOString(),
        });
      if (err) throw err;
      onSave(itemId, { label, link, question });
      onClose();
    } catch (e) {
      setError('שגיאת שמירה — בדוק שהטבלה קיימת ב-Supabase');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)',
    borderRadius:'8px', padding:'10px 12px', color:'rgba(255,255,255,0.9)', fontSize:'14px',
    outline:'none', direction:'rtl',
  };
  const labelStyle = { display:'block', fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,0.45)', marginBottom:'6px' };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div dir="rtl" className="w-full max-w-lg rounded-2xl p-6" style={{ background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold">עריכת כרטיסייה — <span className="font-mono">{itemId}</span></h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color:'rgba(255,255,255,0.5)' }}><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label style={labelStyle}>שם הכרטיסייה</label>
            <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} placeholder="שם השיטה / הכלי" />
          </div>
          <div>
            <label style={labelStyle}>קישור (לאן הכרטיסייה מוליכה)</label>
            <input value={link} onChange={e => setLink(e.target.value)} style={{ ...inputStyle, direction:'ltr' }} placeholder="https://..." />
          </div>
          <div>
            <label style={labelStyle}>שאלת האבחון</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize:'vertical', lineHeight:1.5 }}
              placeholder="האם אני..."
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm" style={{ color:'#f87171' }}>{error}</p>}

        <div className="flex items-center justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/10" style={{ color:'rgba(255,255,255,0.5)' }}>ביטול</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold"
            style={{ background:'rgb(var(--accent))', color:'rgb(var(--accent-foreground))', opacity: saving ? 0.6 : 1 }}
          >
            <Save size={14} />
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Tier selection modal ─────────────────────────────────────────── */
function TierModal({ onSelect, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div dir="rtl" className="w-full max-w-lg rounded-2xl p-8" style={{ background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold">בחר את ההכנסה החודשית שלך</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color:'rgba(255,255,255,0.5)' }}><X size={20} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { tier:'below', title:'מתחת ל-10,000 ₪', sub:'עסק ברמת הכנסה נמוכה מ-10K בחודש', note:'מודולים 1-3 בכל קטגוריה', borderColor:'rgba(239,68,68,0.4)', hoverBg:'rgba(239,68,68,0.08)' },
            { tier:'above', title:'מעל ל-10,000 ₪',  sub:'עסק ברמת הכנסה גבוהה מ-10K בחודש', note:'מודולים 4-6 בכל קטגוריה', borderColor:'rgba(59,130,246,0.4)',  hoverBg:'rgba(59,130,246,0.08)'  },
          ].map(({ tier, title, sub, note, borderColor, hoverBg }) => (
            <button
              key={tier}
              onClick={() => onSelect(tier)}
              className="rounded-xl p-6 text-right transition-all"
              style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${borderColor}` }}
              onMouseEnter={e => e.currentTarget.style.background = hoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            >
              <div className="text-xl font-bold mb-2" style={{ color:'rgba(255,255,255,0.95)' }}>{title}</div>
              <div className="text-sm mb-3" style={{ color:'rgba(255,255,255,0.5)' }}>{sub}</div>
              <div className="text-xs font-semibold" style={{ color:'rgba(255,255,255,0.3)' }}>{note}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Scoring modal ────────────────────────────────────────────────── */
function ScoringModal({ tier, config, ratings, onRate, onBack, onClose, onSubmit }) {
  const ids       = tier === 'below' ? BELOW_IDS : ABOVE_IDS;
  const pillars   = ['לבלוט','להוביל','לשלוט','לספק'];
  const scored    = ids.filter(id => ratings[id]).length;
  const allScored = scored === ids.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}
    >
      <div
        dir="rtl"
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{ background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.1)', maxHeight:'90vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 flex-none" style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 flex-none" style={{ color:'rgba(255,255,255,0.5)' }}><ArrowRight size={18} /></button>
          <h2 className="flex-1 text-lg font-bold text-right">דרג את המנוע שלך</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-none" style={{ color:'rgba(255,255,255,0.5)' }}><X size={18} /></button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {pillars.map((pillarLabel, pi) => {
            const items = ids.filter(id => ITEM_META[id].pillarLabel === pillarLabel);
            if (!items.length) return null;
            return (
              <div key={pillarLabel} className={pi > 0 ? 'mt-7' : ''}>
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'rgba(255,255,255,0.38)' }}>
                  {pillarLabel}
                </p>
                <div className="space-y-3">
                  {items.map(id => {
                    const r = ratings[id];
                    const q = config[id]?.question || CONFIG_DEFAULTS[id].question;
                    return (
                      <div
                        key={id}
                        className="rounded-xl px-4 pt-4 pb-3"
                        style={{
                          background:'rgba(255,255,255,0.05)',
                          border:`1px solid ${r ? STATUS[r].border + '55' : 'rgba(255,255,255,0.09)'}`,
                        }}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <span
                            className="flex-none text-xs font-bold px-2 py-1 rounded-md mt-0.5"
                            style={{
                              fontFamily:'monospace',
                              background: r ? `${STATUS[r].border}2a` : 'rgba(255,255,255,0.09)',
                              color: r ? STATUS[r].dot : 'rgba(255,255,255,0.5)',
                              minWidth:'2rem', textAlign:'center',
                            }}
                          >
                            {id}
                          </span>
                          <span className="text-sm leading-relaxed flex-1" style={{ color:'rgba(255,255,255,0.88)' }}>
                            {q}
                          </span>
                        </div>
                        <div className="flex gap-2 justify-start">
                          {['red','amber','green'].map(key => {
                            const s   = STATUS[key];
                            const sel = r === key;
                            return (
                              <button
                                key={key}
                                onClick={() => onRate(id, sel ? null : key)}
                                className="rounded-lg text-sm font-semibold transition-all"
                                style={{
                                  padding:'5px 18px',
                                  background: sel ? `${s.border}2e` : 'transparent',
                                  border:`1px solid ${sel ? s.border : 'rgba(255,255,255,0.18)'}`,
                                  color: sel ? s.dot : 'rgba(255,255,255,0.45)',
                                }}
                              >
                                {s.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 flex-none" style={{ borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-sm" style={{ color:'rgba(255,255,255,0.38)' }}>
            {scored} מתוך {ids.length} דורגו
          </span>
          <button
            onClick={onSubmit}
            disabled={!allScored}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: allScored ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.08)',
              color: allScored ? 'rgb(var(--accent-foreground))' : 'rgba(255,255,255,0.25)',
              cursor: allScored ? 'pointer' : 'not-allowed',
            }}
          >
            סקירה
            <ArrowRight size={15} style={{ transform:'scaleX(-1)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function ExpertiseEngineAudit() {
  const { user } = useUser();
  const isAdmin  = user?.id === ADMIN_ID;

  const [config,       setConfig]       = useState(CONFIG_DEFAULTS);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [editMode,     setEditMode]     = useState(false);
  const [editItemId,   setEditItemId]   = useState(null);

  const [historyOpen,  setHistoryOpen]  = useState(true);
  const [modal,        setModal]        = useState(null); // null | 'tier' | 'scoring'
  const [selectedTier, setSelectedTier] = useState(null);
  const [ratings,      setRatings]      = useState({});
  const [savedAudit,   setSavedAudit]   = useState(null);
  const [saving,       setSaving]       = useState(false);

  /* Load config + last audit from Supabase */
  useEffect(() => {
    async function load() {
      try {
        // Config
        const { data: cfgRows } = await supabase.from('expertise_engine_config').select('*');
        if (cfgRows?.length) {
          const merged = { ...CONFIG_DEFAULTS };
          cfgRows.forEach(row => {
            merged[row.item_id] = {
              label:    row.label        || CONFIG_DEFAULTS[row.item_id]?.label    || 'דוגמה',
              link:     row.link         || '',
              question: row.question_text || CONFIG_DEFAULTS[row.item_id]?.question || '',
            };
          });
          setConfig(merged);
        }
        // Last submission for this user
        if (user?.id) {
          const { data: submissions } = await supabase
            .from('expertise_audit_submissions')
            .select('*')
            .eq('user_id', user.id)
            .order('submitted_at', { ascending: false })
            .limit(1);
          if (submissions?.[0]) {
            setSavedAudit({
              tier:    submissions[0].income_tier,
              ratings: submissions[0].ratings,
              date:    submissions[0].submitted_at,
            });
          }
        }
      } catch {
        // Supabase not configured yet — fall back to defaults silently
      } finally {
        setConfigLoaded(true);
      }
    }
    load();
  }, [user?.id]);

  function openAudit()  { setModal('tier'); }
  function closeModal() { setModal(null); }

  function handleTierSelect(tier) {
    setSelectedTier(tier);
    setRatings({});
    setModal('scoring');
  }

  function handleRate(id, value) {
    setRatings(r => ({ ...r, [id]: value }));
  }

  async function handleSubmit() {
    const date  = new Date().toISOString();
    const audit = { tier: selectedTier, ratings: { ...ratings }, date };
    setSaving(true);
    try {
      await supabase.from('expertise_audit_submissions').insert({
        user_id:     user?.id || 'unknown',
        income_tier: selectedTier,
        ratings:     { ...ratings },
        submitted_at: date,
      });
    } catch {
      // Save failed silently — still update local state
    } finally {
      setSaving(false);
    }
    setSavedAudit(audit);
    setModal(null);
  }

  function handleConfigSave(itemId, updated) {
    setConfig(prev => ({ ...prev, [itemId]: updated }));
  }

  const counts = savedAudit
    ? Object.values(savedAudit.ratings).reduce(
        (acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; },
        { red:0, amber:0, green:0 }
      )
    : null;

  const getRating = id => savedAudit?.ratings[id] ?? null;

  return (
    <div dir="rtl" className="min-h-screen p-6 md:p-8" style={{ color:'rgba(255,255,255,0.9)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">אבחון מנוע המומחיות</h1>
          <p className="text-sm" style={{ color:'rgba(255,255,255,0.4)' }}>בחן את ביצועי כל רכיב במנוע שלך</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setEditMode(m => !m)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: editMode ? 'rgba(245,193,24,0.15)' : 'rgba(255,255,255,0.07)',
                color:      editMode ? '#F5C118'                : 'rgba(255,255,255,0.5)',
                border:     editMode ? '1px solid rgba(245,193,24,0.4)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Pencil size={14} />
              {editMode ? 'יציאה מעריכה' : 'עריכת תוכן'}
            </button>
          )}
          <button
            onClick={openAudit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background:'rgb(var(--accent))', color:'rgb(var(--accent-foreground))' }}
          >
            <Zap size={15} />
            בצע אבחון מנוע
          </button>
        </div>
      </div>

      {editMode && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
          style={{ background:'rgba(245,193,24,0.08)', border:'1px solid rgba(245,193,24,0.2)', color:'rgba(245,193,24,0.8)' }}>
          <Pencil size={14} />
          מצב עריכה פעיל — לחץ על כרטיסייה כדי לערוך את השם, הקישור והשאלה שלה
        </div>
      )}

      {/* Grid area */}
      <div style={{ display:'flex', gap:'10px', alignItems:'stretch' }}>

        {/* Side labels */}
        <div style={{ display:'flex', flexDirection:'column', width:'28px', flexShrink:0, paddingTop:'44px' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', fontSize:'14px', fontWeight:800, letterSpacing:'0.06em', color:RED_LBL, whiteSpace:'nowrap' }}>
              מתחת 10K
            </span>
          </div>
          <div style={{ height:'16px' }} />
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', fontSize:'14px', fontWeight:800, letterSpacing:'0.06em', color:BLUE_LBL, whiteSpace:'nowrap' }}>
              מעל 10K
            </span>
          </div>
        </div>

        {/* Main grid */}
        <div style={{ flex:1 }}>
          {/* Column headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px', marginBottom:'8px' }}>
            {PILLAR_DEFS.map(p => (
              <div key={p.id} style={{ textAlign:'center', fontSize:'13px', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(255,255,255,0.55)', padding:'8px 0' }}>
                {p.label}
              </div>
            ))}
          </div>

          {/* Top rows (red) */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px' }}>
            {[0,1,2].map(rowIdx =>
              PILLAR_DEFS.map(p => {
                const id = p.top[rowIdx];
                return (
                  <ItemCard
                    key={id}
                    itemId={id}
                    tier="top"
                    rating={getRating(id)}
                    label={config[id]?.label || 'דוגמה'}
                    link={config[id]?.link}
                    editMode={editMode}
                    onEditClick={setEditItemId}
                  />
                );
              })
            )}
          </div>

          <div style={{ height:'16px' }} />

          {/* Bottom rows (blue) */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px' }}>
            {[0,1,2].map(rowIdx =>
              PILLAR_DEFS.map(p => {
                const id = p.bottom[rowIdx];
                return (
                  <ItemCard
                    key={id}
                    itemId={id}
                    tier="bottom"
                    rating={getRating(id)}
                    label={config[id]?.label || 'דוגמה'}
                    link={config[id]?.link}
                    editMode={editMode}
                    onEditClick={setEditItemId}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div
        className="flex items-center justify-between flex-wrap gap-4 mt-6 px-5 py-4 rounded-xl"
        style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-5">
          {[{key:'red',color:'#ef4444',label:'אדום'},{key:'amber',color:'#f59e0b',label:'כתום'},{key:'green',color:'#22c55e',label:'ירוק'}].map(({ key, color, label }) => (
            <span key={key} className="flex items-center gap-2 text-sm font-semibold" style={{ color:'rgba(255,255,255,0.5)' }}>
              <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:color, opacity: counts ? 0.85 : 0.3 }} />
              {counts ? counts[key] ?? 0 : 0} {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.25)' }}>
            {savedAudit ? `אבחון אחרון: ${new Date(savedAudit.date).toLocaleDateString('he-IL')}` : 'טרם בוצע אבחון'}
          </span>
          <button
            onClick={openAudit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background:'rgb(var(--accent))', color:'rgb(var(--accent-foreground))' }}
          >
            <Zap size={13} />
            אבחון חדש
          </button>
        </div>
      </div>

      {/* History */}
      <div className="mt-6">
        <button
          className="flex items-center gap-2 text-sm font-semibold mb-3"
          style={{ color:'rgba(255,255,255,0.5)' }}
          onClick={() => setHistoryOpen(o => !o)}
        >
          {historyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          היסטוריית אבחונים ({savedAudit ? 1 : 0})
        </button>
        {historyOpen && (
          savedAudit ? (
            <div className="rounded-xl px-5 py-4" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-semibold mb-1">
                    {new Date(savedAudit.date).toLocaleDateString('he-IL', { day:'numeric', month:'long', year:'numeric' })}
                    <span className="mr-2 text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'rgba(245,193,24,0.15)', color:'#F5C118' }}>נוכחי</span>
                  </div>
                  <div className="text-xs" style={{ color:'rgba(255,255,255,0.35)' }}>
                    {savedAudit.tier === 'below' ? 'מתחת ל-10K' : 'מעל ל-10K'}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-semibold">
                  {[['red','#ef4444'],['amber','#f59e0b'],['green','#22c55e']].map(([k,c]) => (
                    <span key={k} className="flex items-center gap-1.5">
                      <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }} />
                      <span style={{ color:'rgba(255,255,255,0.6)' }}>{counts?.[k] ?? 0}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl py-8 text-center text-sm" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.25)' }}>
              טרם בוצע אבחון — לחץ ״בצע אבחון מנוע״ כדי להתחיל
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {modal === 'tier' && <TierModal onSelect={handleTierSelect} onClose={closeModal} />}
      {modal === 'scoring' && selectedTier && (
        <ScoringModal
          tier={selectedTier}
          config={config}
          ratings={ratings}
          onRate={handleRate}
          onBack={() => setModal('tier')}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
      {editItemId && (
        <EditItemModal
          itemId={editItemId}
          current={config[editItemId] || CONFIG_DEFAULTS[editItemId]}
          onSave={handleConfigSave}
          onClose={() => setEditItemId(null)}
        />
      )}
    </div>
  );
}
