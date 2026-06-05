import { useState, useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const PERCENTS = ['עלות', 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200];

const C = {
  accent:  '#f5c518',
  green:   '#4fc38a',
  purple:  '#b06aff',
  red:     '#ff5a72',
  muted:   'rgba(255,255,255,0.45)',
  surface: 'rgb(var(--bg-surface))',
  elevated:'rgb(var(--bg-elevated))',
  border:  'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.16)',
};

const STAR_COLORS = {
  red:    { background: 'rgba(255,90,114,0.12)', borderColor: 'rgba(255,90,114,0.5)', color: '#ff5a72' },
  yellow: { background: 'rgba(245,197,24,0.12)', borderColor: 'rgba(245,197,24,0.5)', color: '#f5c518' },
  green:  { background: 'rgba(79,195,138,0.12)', borderColor: 'rgba(79,195,138,0.5)', color: '#4fc38a' },
};

const Q_COLOR = {
  1:      v => v <= 3 ? 'red' : v <= 7 ? 'yellow' : 'green',
  2:      v => v <= 3 ? 'red' : v <= 7 ? 'yellow' : 'green',
  demand: v => v <= 3 ? 'red' : v <= 7 ? 'yellow' : 'green',
  busy:   v => v <= 3 ? 'green' : v <= 7 ? 'yellow' : 'red',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => ++_uid;

function fmt(n)      { return '₪' + Math.round(n).toLocaleString('he-IL'); }
function fmtShort(n) { return n >= 1000 ? '₪' + (n / 1000).toFixed(1) + 'K' : '₪' + Math.round(n); }
function n(v)        { return parseFloat(v) || 0; }

function defaultWorkRows() {
  return [
    { id: uid(), name: 'העבודה שלי',   rate: '', hours: '', fixed: true,  tip: 'myWork' },
    { id: uid(), name: 'מנהל פרויקט', rate: '', hours: '', fixed: true,  tip: 'pm' },
    { id: uid(), name: '',              rate: '', hours: '', fixed: false, tip: null },
  ];
}
function defaultExpRows() {
  return [
    { id: uid(), name: '', amount: '' },
    { id: uid(), name: '', amount: '' },
    { id: uid(), name: '', amount: '' },
  ];
}
function defaultFeRows() {
  return [
    { id: uid(), name: 'מיסים',           amount: '' },
    { id: uid(), name: 'Adobe / Figma',    amount: '' },
    { id: uid(), name: 'מחשב / ציוד',     amount: '' },
    { id: uid(), name: 'משרד / שכירות',   amount: '' },
    { id: uid(), name: 'הוצאה נוספת',     amount: '' },
  ];
}

// ─── Recommendation engine ────────────────────────────────────────────────────
function computeRec({ qVals, clientType, budgetMode, quotedRangeMode, budgetAmount, rangeMin, rangeMax, buffer }) {
  const { 1: q1, 2: q2, demand: qDemand, busy: qBusy } = qVals;
  const hasAny = q1||q2||qDemand||qBusy||budgetMode||clientType;
  if (!hasAny) return null;

  const allAnswered = q1>0 && q2>0 && qDemand>0 && qBusy>0 && budgetMode && quotedRangeMode && clientType;
  if (!allAnswered) return { incomplete: true };

  const bAmt   = n(budgetAmount);
  const rMin   = n(rangeMin);
  const rMax   = n(rangeMax);
  const hasBudget      = budgetMode === 'yes' && bAmt > 0;
  const hasQuotedRange = quotedRangeMode === 'yes' && (rMin>0||rMax>0);

  let reasons=[], low, mid, high;

  if (hasQuotedRange && buffer>0) {
    const eff = rMax>0 ? (rMin+rMax)/2 : rMin;
    mid = Math.max(Math.min(Math.round(((eff/buffer)-1)*100), 100), 20);
    low  = Math.max(20,  Math.round((mid-8)/10)*10);
    high = Math.min(100, Math.round((mid+8)/10)*10);
    const rs = rMax>0 ? `₪${Math.round(rMin).toLocaleString()}–₪${Math.round(rMax).toLocaleString()}` : `₪${Math.round(rMin).toLocaleString()}`;
    reasons.push(`אמרת ללקוח טווח של ${rs} — ההמלצה נשארת קרוב לטווח הזה.`);
  } else if (hasBudget && buffer>0) {
    const ip = Math.round(((bAmt/buffer)-1)*100);
    if (ip >= 15) {
      mid  = Math.max(Math.min(ip,100),20);
      low  = Math.max(20,  Math.round((mid-10)/10)*10);
      high = Math.min(100, Math.round((mid+10)/10)*10);
      reasons.push(`הלקוח ציין תקציב של ₪${Math.round(bAmt).toLocaleString()} — זה מרווח של כ-${mid}%. ההמלצה מתחשבת בזה.`);
    } else {
      reasons.push(`⚠️ תקציב הלקוח (₪${Math.round(bAmt).toLocaleString()}) נמוך מדי יחסית לעלות — ההמלצה מתעלמת ממנו.`);
    }
  }

  if (!mid) {
    const tempBase = { referral_good:70, inbound:55, referral_weak:35, new:30 };
    mid = tempBase[clientType]||40;
    const ds = qDemand+qBusy;
    if      (ds>=17){ mid+=30; reasons.push('אתה גם מאוד עמוס וגם מאוד מבוקש — פרמיה משמעותית מוצדקת.'); }
    else if (ds>=13){ mid+=18; reasons.push('הביקוש לעבודה שלך גבוה ולוח הזמנים עמוס — כוח תמחור מעל הממוצע.'); }
    else if (ds>=9) { mid+=6; }
    else if (ds<=5&&ds>0){ mid-=12; reasons.push('ביקוש ועומס נמוכים — כדאי להיות תחרותי יותר.'); }

    if      (q1>=9){ mid-=18; reasons.push('אתה נואש לסגור — זה מוריד כוח מיקוח.'); }
    else if (q1>=7){ mid-=10; reasons.push('אתה רוצה מאוד את הפרויקט — שמור על מחיר הוגן.'); }
    else if (q1<=2&&q1>0){ mid+=20; reasons.push('אתה לא זקוק לפרויקט — תמחר גבוה.'); }
    else if (q1<=4&&q1>0){ mid+=10; }

    if      (q2>=9){ mid-=12; reasons.push('הפרויקט חשוב מאוד לפורטפוליו — הנחה קטנה מוצדקת.'); }
    else if (q2>=7){ mid-=6;  reasons.push('הפרויקט יחזק את תיק העבודות — גמישות קטנה.'); }

    if      (clientType==='referral_good') reasons.push('לקוח רותח 🔥 — תמחר בביטחון מלא.');
    else if (clientType==='inbound')       reasons.push('לקוח חם ☀️ — הגיע מוכן ובחר אותך.');
    else if (clientType==='referral_weak') reasons.push('לקוח פושר 🌤 — היה נחוש בגבולות שלך.');
    else if (clientType==='new')           reasons.push('לקוח קר 🧊 — כדאי להיות קצת יותר גמיש.');

    if (clientType==='referral_good'&&qDemand>=7&&q1<=4){ mid+=10; reasons.push('קומבינציה מנצחת — פרמיום מוצדק לחלוטין.'); }

    mid = Math.max(20, Math.min(mid, 100));

    const isDesperate = q1>=9&&q2>=8&&(qDemand+qBusy)<=4&&clientType!=='referral_good';
    if (isDesperate && mid<=22) {
      return { recPct:'עלות', low:0, high:0, reason:'אין ביקוש, הפרויקט חיוני לפורטפוליו ואתה נואש. מחיר עלות בלבד.', rangeLabel:'מקרה חריג' };
    }
    low  = Math.max(20,  Math.round((mid-10)/10)*10);
    high = Math.min(100, Math.round((mid+10)/10)*10);
  }

  const snapped = PERCENTS.filter(p=>p!=='עלות').reduce((a,b)=>Math.abs(b-mid)<Math.abs(a-mid)?b:a);
  return {
    recPct: snapped, low, high,
    reason: reasons.length ? reasons.join(' ') : `טווח מומלץ ${low}%–${high}%, נקודת אמצע ${snapped}%.`,
    rangeLabel: `טווח מומלץ: ${low}% – ${high}%`,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TipBox({ type }) {
  const [show, setShow] = useState(false);
  const tips = {
    myWork: {
      title: '💡 איך לתמחר את השעה שלך?',
      body: 'מעצב מתחיל: סביב ₪150 לשעה\nמעצב מתקדם: ₪250–₪350 לשעה\n\nשאל: אם הייתי מעביר לאחד ברמה שלי — כמה הוא גובה לשעה?',
    },
    pm: {
      title: '📋 כמה שעות ניהול לחשב?',
      body: 'פרויקט רגיל = 2–4 שעות ניהול.\nפרויקט מורכב = 6–10 שעות.\nמנהל פרויקט בדרך כלל גובה יותר מהמעצב המבצע.',
    },
    expenses: {
      title: '💸 למה חשוב לחשב הוצאות?',
      body: 'חלק מיסים חודשיים בימי עבודה × ימי פרויקט.\nחלק Adobe/Figma/ציוד בפרויקטים שאתה עושה בחודש.\nהכלל: הלקוח משלם על הכל — לא רק על הידיים שלך.',
    },
  };
  const t = tips[type];
  if (!t) return null;
  return (
    <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
      <button
        type="button"
        onMouseEnter={()=>setShow(true)}
        onMouseLeave={()=>setShow(false)}
        style={{ width:18, height:18, borderRadius:'50%', background:C.accent, color:'#000', fontSize:10, fontWeight:700, border:'none', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginRight:6, lineHeight:1 }}
      >?</button>
      {show && (
        <div style={{ position:'absolute', right:0, top:26, width:280, background:C.surface, border:`1px solid rgba(245,197,24,0.3)`, borderRadius:12, padding:'14px 16px', zIndex:100, boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:8 }}>{t.title}</div>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.7, whiteSpace:'pre-line' }}>{t.body}</div>
        </div>
      )}
    </div>
  );
}

const blockMinus = e => { if (e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault(); };
const noScroll   = e => e.currentTarget.blur();
const posNum = (val, setter) => { const n = parseFloat(val); setter(isNaN(n) ? '' : Math.max(0, n).toString()); };

function NumberInput({ value, onChange, placeholder='0', width=70 }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:3, background:C.elevated, border:`1px solid ${C.border2}`, borderRadius:8, padding:'5px 8px' }}>
      <span style={{ fontSize:13, color:C.accent, fontWeight:700, flexShrink:0 }}>₪</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(String(Math.max(0, parseFloat(e.target.value) || 0) || ''))}
        onKeyDown={blockMinus}
        onWheel={noScroll}
        placeholder={placeholder}
        style={{ width, background:'transparent', border:'none', fontSize:15, color:'rgba(255,255,255,0.92)', textAlign:'center', outline:'none' }}
      />
    </div>
  );
}

function Chip({ label, value, color }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:5 }}>
      <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.07em', lineHeight:1 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color, lineHeight:1 }}>{value}</div>
    </div>
  );
}

function ChipDivider() {
  return <div style={{ width:1, height:28, background:'rgba(255,255,255,0.1)', flexShrink:0 }} />;
}

function StepHeader({ number, title, subtitle, done }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, marginTop:8 }}>
      <div style={{
        width:36, height:36, borderRadius:'50%', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        background: done ? 'rgba(79,195,138,0.15)' : 'rgba(245,197,24,0.12)',
        border: `2px solid ${done ? '#4fc38a' : 'rgba(245,197,24,0.4)'}`,
        fontSize:15, fontWeight:700,
        color: done ? '#4fc38a' : '#f5c518',
        transition:'all 0.3s',
      }}>
        {done ? '✓' : number}
      </div>
      <div>
        <div style={{ fontSize:18, fontWeight:700, color:'white', lineHeight:1.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginTop:3 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PricingCalculator() {
  const [workRows,  setWorkRows]  = useState(defaultWorkRows);
  const [expRows,   setExpRows]   = useState(defaultExpRows);
  const [selectedPct, setSelectedPct] = useState(null);

  // Recommendation state
  const [qVals,          setQVals]          = useState({ 1:0, 2:0, demand:0, busy:0 });
  const [clientType,     setClientType]     = useState(null);
  const [budgetMode,     setBudgetMode]     = useState(null);
  const [quotedRangeMode,setQuotedRangeMode]= useState(null);
  const [budgetAmount,   setBudgetAmount]   = useState('');
  const [rangeMin,       setRangeMin]       = useState('');
  const [rangeMax,       setRangeMax]       = useState('');

  // Quote / History
  const [quoteName,   setQuoteName]   = useState('');
  const [currentQuoteId, setCurrentQuoteId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [quotes, setQuotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pricingQuotes')||'[]'); } catch { return []; }
  });

  // Fixed expenses modal
  const [showFeModal,    setShowFeModal]    = useState(false);
  const [feMonthlyHours, setFeMonthlyHours] = useState('160');
  const [feRows,         setFeRows]         = useState(defaultFeRows);

  // Overwrite modal
  const [showOverwrite, setShowOverwrite] = useState(false);
  const [pendingSave,   setPendingSave]   = useState(null);

  // Shake ref for save button
  const saveBtnRef = useRef();
  const historyRef = useRef();

  // ── Derived calculations ──────────────────────────────────────────────────
  const totalWork  = workRows.reduce((s,r)=>s+n(r.rate)*n(r.hours), 0);
  const totalHours = workRows.reduce((s,r)=>s+n(r.hours), 0);
  const totalExp   = expRows.reduce((s,r)=>s+n(r.amount), 0);
  const buffer     = (totalWork + totalExp) * 1.1;

  // Close history on outside click
  useEffect(() => {
    function handler(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) setShowHistory(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const finalPct    = selectedPct === 'עלות' ? 0 : (selectedPct||0);
  const finalProfit = buffer * finalPct / 100;
  const finalPrice  = buffer + finalProfit;

  const rec = useMemo(() => computeRec({ qVals, clientType, budgetMode, quotedRangeMode, budgetAmount, rangeMin, rangeMax, buffer }),
    [qVals, clientType, budgetMode, quotedRangeMode, budgetAmount, rangeMin, rangeMax, buffer]);

  // Progress: count answered items out of 6
  const progressPct = useMemo(() => {
    let done = 0;
    if (qVals[1]>0)      done++;
    if (qVals[2]>0)      done++;
    if (qVals.demand>0)  done++;
    if (qVals.busy>0)    done++;
    if (clientType)      done++;
    if (budgetMode)      done++;
    if (quotedRangeMode) done++;
    return Math.round((done/7)*100);
  }, [qVals, clientType, budgetMode, quotedRangeMode]);

  // Pill color helper
  function pillColor(pct) {
    if (!rec || rec.incomplete || rec.low==null) return null;
    if (pct === rec.recPct) return 'green';
    if (typeof pct === 'number' && pct >= rec.low && pct <= rec.high) return 'yellow';
    return 'red';
  }

  // ── Row mutations ─────────────────────────────────────────────────────────
  function updateWorkRow(id, field, val) {
    setWorkRows(rows => rows.map(r => r.id===id ? {...r,[field]:val} : r));
  }
  function updateExpRow(id, field, val) {
    setExpRows(rows => rows.map(r => r.id===id ? {...r,[field]:val} : r));
  }
  function addWorkRow() {
    setWorkRows(rows => [...rows, { id:uid(), name:'', rate:'', hours:'', fixed:false, tip:null }]);
  }
  function addExpRow() {
    setExpRows(rows => [...rows, { id:uid(), name:'', amount:'' }]);
  }

  // ── Recommendation ────────────────────────────────────────────────────────
  function setQ(q, v) {
    setQVals(prev => ({ ...prev, [q]: v }));
  }

  // ── History ───────────────────────────────────────────────────────────────
  function persistQuotes(qs) {
    setQuotes(qs);
    localStorage.setItem('pricingQuotes', JSON.stringify(qs));
  }

  function buildSnapshot() {
    return { workRows, expRows, selectedPct, qVals, clientType, budgetMode, quotedRangeMode, budgetAmount, rangeMin, rangeMax, finalPrice: selectedPct!==null ? finalPrice : null };
  }

  function doSave(name, overwrite) {
    const snap = buildSnapshot();
    if (overwrite && currentQuoteId) {
      persistQuotes(quotes.map(q => q.id===currentQuoteId ? {...q, name, date:new Date().toISOString(), data:snap, finalPrice:snap.finalPrice} : q));
    } else {
      const id = Date.now();
      setCurrentQuoteId(id);
      persistQuotes([{ id, name, date:new Date().toISOString(), data:snap, finalPrice:snap.finalPrice }, ...quotes]);
    }
    setQuoteName(name);
  }

  function saveQuote() {
    const name = quoteName.trim() || 'הצעה ללא שם';
    const existing = quotes.find(q=>q.name===name && q.id!==currentQuoteId);
    if (existing) {
      setPendingSave(name);
      setShowOverwrite(true);
    } else {
      doSave(name, true);
    }
  }

  function saveQuoteWithShake() {
    const hasData = workRows.some(r=>n(r.rate)>0||n(r.hours)>0) || expRows.some(r=>n(r.amount)>0);
    if (!hasData) {
      if (saveBtnRef.current) {
        saveBtnRef.current.classList.remove('calc-shake');
        void saveBtnRef.current.offsetWidth;
        saveBtnRef.current.classList.add('calc-shake');
        setTimeout(()=>saveBtnRef.current?.classList.remove('calc-shake'), 500);
      }
      return;
    }
    saveQuote();
  }

  function loadQuote(q) {
    const d = q.data;
    if (!d) return;
    setWorkRows(d.workRows || defaultWorkRows());
    setExpRows(d.expRows || defaultExpRows());
    setSelectedPct(d.selectedPct ?? null);
    setQVals(d.qVals || {1:0,2:0,demand:0,busy:0});
    setClientType(d.clientType||null);
    setBudgetMode(d.budgetMode||null);
    setQuotedRangeMode(d.quotedRangeMode||null);
    setBudgetAmount(d.budgetAmount||'');
    setRangeMin(d.rangeMin||'');
    setRangeMax(d.rangeMax||'');
    setQuoteName(q.name);
    setCurrentQuoteId(q.id);
    setShowHistory(false);
  }

  function deleteQuote(e, id) {
    e.stopPropagation();
    persistQuotes(quotes.filter(q=>q.id!==id));
    if (currentQuoteId===id) setCurrentQuoteId(null);
  }

  // ── Fixed expenses modal ──────────────────────────────────────────────────
  const feProjectHours = totalHours;

  function applyFixedExp() {
    const mh = n(feMonthlyHours)||160;
    if (feProjectHours<=0||mh<=0) return;
    const ratio = feProjectHours/mh;
    const toAdd = feRows.filter(r=>r.name.trim()&&n(r.amount)>0).map(r=>({
      id:uid(), name:`${r.name} (יחסי)`, amount: Math.round(n(r.amount)*ratio)
    }));
    if (toAdd.length>0) setExpRows(rows=>[...rows,...toAdd]);
    setShowFeModal(false);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function resetAll() {
    setWorkRows(defaultWorkRows());
    setExpRows(defaultExpRows());
    setSelectedPct(null);
    setQVals({1:0,2:0,demand:0,busy:0});
    setClientType(null);
    setBudgetMode(null);
    setQuotedRangeMode(null);
    setBudgetAmount('');
    setRangeMin('');
    setRangeMax('');
    setQuoteName('');
    setCurrentQuoteId(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const cardStyle = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:24 };
  const inputStyle = { background:C.elevated, border:`1px solid ${C.border2}`, borderRadius:8, padding:'7px 10px', fontSize:15, color:'rgba(255,255,255,0.92)', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' };
  const btnPrimary = { padding:'9px 20px', borderRadius:9, background:C.accent, color:'#000', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' };
  const btnGhost   = { padding:'9px 20px', borderRadius:9, background:C.elevated, color:'rgba(255,255,255,0.85)', fontSize:14, fontWeight:500, border:`1px solid ${C.border2}`, cursor:'pointer', fontFamily:'inherit' };

  // Bar position helpers for rec result
  const recBarLeft  = rec?.low  != null ? ((rec.low -20)/(200-20)*100).toFixed(1) : '0';
  const recBarWidth = (rec?.low != null && rec?.high != null) ? ((rec.high-rec.low)/(200-20)*100).toFixed(1) : '0';

  return (
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes calcShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-6px)}30%{transform:translateX(6px)}45%{transform:translateX(-4px)}60%{transform:translateX(4px)}75%{transform:translateX(-2px)}90%{transform:translateX(2px)}}
        .calc-shake{animation:calcShake 0.45s ease both;}
        input.calc-ghost-input,input.calc-ghost-input[type="text"]{background:transparent!important;border:none!important;border-bottom:1px solid transparent!important;border-radius:0!important;box-shadow:none!important;outline:none;font-family:inherit;padding:4px 2px;}
        input.calc-ghost-input:hover,input.calc-ghost-input[type="text"]:hover{border-bottom-color:rgba(255,255,255,0.2)!important;}
        input.calc-ghost-input:focus,input.calc-ghost-input[type="text"]:focus{border-bottom-color:#f5c518!important;}
        .pill-hover:hover{opacity:0.85;}
        .del-btn-r{width:26px;height:26px;border-radius:6px;border:1px solid rgba(255,77,109,0.35);background:rgba(255,77,109,0.08);color:#ff5a72;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all 0.15s;line-height:1;padding:0;font-family:inherit;}
        .del-btn-r:hover{background:rgba(255,77,109,0.2);border-color:#ff5a72;}
        .add-row-r{display:flex;align-items:center;gap:8px;margin-top:14px;padding:8px 14px;border-radius:8px;border:1px dashed rgba(245,197,24,0.5);background:transparent;color:#f5c518;font-size:14px;cursor:pointer;font-family:inherit;transition:all 0.15s;width:100%;}
        .add-row-r:hover{border-color:#f5c518;background:rgba(245,197,24,0.06);}
        .rec-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;outline:none;cursor:pointer;background:rgba(255,255,255,0.1);}
        .rec-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid rgb(var(--bg-elevated));box-shadow:0 0 0 2px currentColor;}
        .rec-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid rgb(var(--bg-elevated));}
        .pill-btn-r{flex:1;padding:10px 14px;border-radius:9px;border:1px solid rgba(255,255,255,0.16);background:rgb(var(--bg-elevated));color:rgba(255,255,255,0.5);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;text-align:center;}
        .pill-btn-r:hover{border-color:#f5c518;color:#f5c518;background:rgba(245,197,24,0.05);}
        .pill-btn-r.active{background:rgba(245,197,24,0.12);border-color:#f5c518;color:#f5c518;}
        .temp-btn-r{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.16);background:rgb(var(--bg-elevated));cursor:pointer;font-family:inherit;text-align:center;transition:all 0.15s;width:100%;}
        .temp-btn-r:hover{background:rgba(255,255,255,0.05);transform:translateY(-2px);}
        .history-item-r{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background 0.12s;}
        .history-item-r:hover{background:rgb(var(--bg-elevated));}
        .history-del-r{width:24px;height:24px;border-radius:6px;border:1px solid rgba(255,90,114,0.3);background:rgba(255,90,114,0.07);color:#ff5a72;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.12s;font-family:inherit;opacity:0;}
        .history-item-r:hover .history-del-r{opacity:1;}
        .history-del-r:hover{background:rgba(255,90,114,0.2);opacity:1!important;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
        input[type=number]{-moz-appearance:textfield;}

        /* ── Responsive layout ───────────────────────────────────────────── */
        .cr-halves{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .cr-sliders{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;}
        .cr-client{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:4px;}
        .cr-budget{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .cr-pills{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:18px;}
        .cr-banner{display:flex;align-items:center;justify-content:space-between;gap:40px;padding:32px 40px;}
        .cr-sticky{padding:18px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;}
        .cr-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .cr-chip-divider{width:1px;height:28px;background:rgba(255,255,255,0.1);flex-shrink:0;}
        @media(max-width:900px){
          .cr-halves{grid-template-columns:1fr;}
          .cr-sliders{grid-template-columns:1fr;}
          .cr-client{grid-template-columns:repeat(2,1fr);}
          .cr-budget{grid-template-columns:1fr;}
          .cr-pills{grid-template-columns:repeat(4,1fr);}
          .cr-banner{flex-direction:column;align-items:flex-start;padding:20px 24px;gap:16px;}
          .cr-sticky{padding:12px 20px;flex-wrap:wrap;gap:10px;}
          .cr-chip-divider{display:none;}
        }
        @media(max-width:600px){
          .cr-pills{grid-template-columns:repeat(3,1fr);}
          .cr-sticky{flex-direction:column;}
          .cr-price-sm{font-size:36px!important;}
          .cr-banner-price{font-size:40px!important;}
        }
        @media(max-width:400px){
          .cr-pills{grid-template-columns:repeat(2,1fr);}
        }
      `}</style>

      {/* ── Sticky price bar ─────────────────────────────────────────────────── */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        background:'rgb(var(--bg-chrome))',
        borderTop: selectedPct !== null
          ? '1px solid rgba(245,197,24,0.35)'
          : '1px solid rgba(255,255,255,0.08)',
        transform: buffer > 0 ? 'translateY(0)' : 'translateY(100%)',
        transition:'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div className="cr-sticky">

          {/* Left: stat chips */}
          <div className="cr-chips">
            <Chip label="שעות עבודה" value={`${Math.round(totalHours)} ש׳`} color="rgba(255,255,255,0.7)" />
            <div className="cr-chip-divider" />
            <Chip label="עלות ייצור" value={fmt(totalWork + totalExp)} color="rgba(255,255,255,0.55)" />
            <div className="cr-chip-divider" />
            <Chip label="+ 10% בטחון" value={fmt(buffer)} color={C.purple} />
            {selectedPct !== null && <>
              <div className="cr-chip-divider" />
              <Chip
                label={`רווח ${selectedPct === 'עלות' ? 'עלות' : selectedPct + '%'}`}
                value={fmt(finalProfit)}
                color={C.green}
              />
            </>}
          </div>

          {/* Right: final price hero */}
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            {selectedPct === null && (
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)', whiteSpace:'nowrap' }}>
                בחר אחוז רווח ←
              </div>
            )}
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'flex-end',
              borderRight: selectedPct !== null ? `3px solid ${C.accent}` : '3px solid rgba(255,255,255,0.12)',
              paddingRight:16,
              transition:'border-color 0.3s',
            }}>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:5 }}>
                מחיר סופי ללקוח
              </div>
              <div className="cr-price-sm" style={{
                fontSize:48, fontWeight:700, lineHeight:1, letterSpacing:-2,
                color: selectedPct !== null ? C.accent : 'rgba(255,255,255,0.2)',
                transition:'color 0.25s',
              }}>
                {selectedPct !== null ? fmt(finalPrice) : '—'}
              </div>
            </div>
          </div>

        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', paddingBottom:100 }}>

        {/* ── Topbar ───────────────────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
          <h1 style={{ fontSize:28, color:'white', margin:0 }}>מחשבון תמחור פרויקט</h1>

          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {/* Quote name */}
            <div style={{ display:'flex', alignItems:'center', gap:6, borderBottom:`1.5px solid ${quoteName ? C.green : C.border2}`, paddingBottom:3 }}>
              <input
                type="text"
                value={quoteName}
                onChange={e=>setQuoteName(e.target.value)}
                placeholder="שם ההצעה..."
                className="calc-ghost-input"
                style={{ fontSize:14, fontWeight:500, color:'rgba(255,255,255,0.9)', width:150 }}
              />
            </div>

            {/* History */}
            <div style={{ position:'relative' }} ref={historyRef}>
              <button type="button" onClick={()=>setShowHistory(o=>!o)}
                style={{ ...btnGhost, display:'flex', alignItems:'center', gap:8, height:36, padding:'0 16px', color: showHistory ? C.accent : undefined, borderColor: showHistory ? C.accent : undefined }}>
                🕐 היסטוריה {quotes.length>0 && <span style={{ fontSize:11, background:C.accent, color:'#000', borderRadius:10, padding:'1px 6px', fontWeight:700 }}>{quotes.length}</span>}
              </button>
              {showHistory && (
                <div style={{ position:'absolute', top:'calc(100% + 10px)', left:0, width:340, background:C.surface, border:`1px solid ${C.border2}`, borderRadius:16, padding:6, zIndex:200, boxShadow:'0 20px 48px rgba(0,0,0,0.6)' }}>
                  <div style={{ padding:'10px 14px 8px', borderBottom:`1px solid ${C.border}`, marginBottom:4 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em' }}>הצעות מחיר שמורות</div>
                  </div>
                  <div style={{ maxHeight:340, overflowY:'auto' }}>
                    {quotes.length===0 ? (
                      <div style={{ fontSize:13, color:C.muted, padding:'24px 14px', textAlign:'center', lineHeight:1.6 }}>
                        <div style={{ fontSize:28, marginBottom:8, opacity:0.5 }}>📂</div>
                        אין הצעות שמורות עדיין.
                      </div>
                    ) : quotes.map(q=>(
                      <div key={q.id} className="history-item-r" onClick={()=>loadQuote(q)}>
                        <div style={{ width:36, height:36, borderRadius:9, background:'rgba(245,197,24,0.1)', border:'1px solid rgba(245,197,24,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>📄</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.95)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{q.name}</div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{new Date(q.date).toLocaleDateString('he-IL')}</div>
                        </div>
                        {q.finalPrice!=null && <div style={{ fontSize:14, fontWeight:700, color:C.accent, flexShrink:0 }}>{fmt(q.finalPrice)}</div>}
                        <button className="history-del-r" onClick={e=>deleteQuote(e,q.id)}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button ref={saveBtnRef} type="button" onClick={saveQuoteWithShake} style={{ ...btnPrimary, height:36 }}>שמור הצעת מחיר</button>
            <button type="button" onClick={resetAll} style={{ ...btnGhost, height:36 }}>איפוס</button>
          </div>
        </div>

        {/* ── Step 1 ───────────────────────────────────────────────────────── */}
        <StepHeader
          number="1"
          title="עלות הפרויקט"
          subtitle="הוסף תפקידים, שעות והוצאות — המחשבון יחשב את עלות הבסיס"
          done={buffer > 0}
        />

        {/* ── Tables row ───────────────────────────────────────────────────── */}
        <div className="cr-halves" style={{ marginBottom:0 }}>

          {/* Work table */}
          <div style={cardStyle}>
            <div style={{ fontSize:17, fontWeight:700, color:'white', marginBottom:4 }}>עלות עבודה על הפרויקט</div>
            <div style={{ fontSize:14, color:C.muted, marginBottom:20 }}>ערוך את האנשים שיהיו מעורבים בפרויקט</div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['תפקיד','מחיר לשעה','שעות','סה"כ',''].map((h,i)=>(
                    <th key={i} style={{ fontSize:13, fontWeight:600, color:C.muted, textAlign:i===0?'right':'center', padding:'0 6px 12px', borderBottom:`1px solid ${C.border}`, textTransform:'uppercase', letterSpacing:'0.04em', width:i===4?32:undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workRows.map(row=>{
                  const subtotal = n(row.rate)*n(row.hours);
                  return (
                    <tr key={row.id} style={{ }}>
                      <td style={{ padding:'8px 0', borderBottom:`1px solid ${C.border}`, textAlign:'right' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 4px' }}>
                          {row.fixed
                            ? <span style={{ fontSize:14, color:'rgba(255,255,255,0.9)', fontWeight:500 }}>{row.name}</span>
                            : <input type="text" value={row.name} onChange={e=>updateWorkRow(row.id,'name',e.target.value)}
                                placeholder="שם תפקיד"
                                className="calc-ghost-input"
                                style={{ flex:1, padding:'4px 2px', fontSize:14, color:C.muted, minWidth:80 }} />
                          }
                          {row.tip && <TipBox type={row.tip} />}
                        </div>
                      </td>
                      <td style={{ padding:'8px 6px', borderBottom:`1px solid ${C.border}`, textAlign:'center' }}>
                        <NumberInput value={row.rate} onChange={v=>updateWorkRow(row.id,'rate',v)} />
                      </td>
                      <td style={{ padding:'8px 6px', borderBottom:`1px solid ${C.border}`, textAlign:'center' }}>
                        <input type="number" min="0" value={row.hours}
                          onChange={e=>updateWorkRow(row.id,'hours', String(Math.max(0, parseFloat(e.target.value)||0)||''))}
                          onKeyDown={blockMinus} onWheel={noScroll}
                          style={{ width:70, background:C.elevated, border:`1px solid ${C.border2}`, borderRadius:8, padding:'7px 8px', fontSize:15, color:'rgba(255,255,255,0.92)', textAlign:'center', outline:'none' }} />
                      </td>
                      <td style={{ padding:'8px 6px', borderBottom:`1px solid ${C.border}`, textAlign:'center', color:C.accent, fontWeight:700, fontSize:14 }}>
                        {fmt(subtotal)}
                      </td>
                      <td style={{ padding:'8px 6px', borderBottom:`1px solid ${C.border}`, textAlign:'center' }}>
                        {!row.fixed && (
                          <button className="del-btn-r" type="button" onClick={()=>setWorkRows(rows=>rows.filter(r=>r.id!==row.id))}>×</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding:'12px 6px', color:C.muted, fontWeight:600, fontSize:14 }}>סה"כ</td>
                  <td></td>
                  <td style={{ padding:'12px 6px', textAlign:'center', fontWeight:700, color:C.accent, borderTop:`1px solid ${C.border2}` }}>{Math.round(totalHours)}</td>
                  <td style={{ padding:'12px 6px', textAlign:'center', fontWeight:700, color:C.accent, borderTop:`1px solid ${C.border2}`, fontSize:16 }}>{fmt(totalWork)}</td>
                  <td style={{ borderTop:`1px solid ${C.border2}` }}></td>
                </tr>
              </tfoot>
            </table>
            {buffer === 0 && (
              <div style={{ marginTop:14, padding:'12px 16px', borderRadius:10, background:'rgba(245,197,24,0.05)', border:'1px dashed rgba(245,197,24,0.2)', fontSize:13, color:'rgba(255,255,255,0.35)', lineHeight:1.6 }}>
                💡 התחל עם <strong style={{ color:'rgba(245,197,24,0.7)', fontWeight:600 }}>מחיר לשעה × שעות</strong> עבור כל תפקיד — המחיר יחושב אוטומטית
              </div>
            )}
            <button type="button" className="add-row-r" onClick={addWorkRow}><span style={{fontSize:18}}>+</span> הוסף תפקיד</button>
          </div>

          {/* Expenses table */}
          <div style={cardStyle}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontSize:17, fontWeight:700, color:'white' }}>הוצאות לפרויקט</div>
                <TipBox type="expenses" />
              </div>
              <button type="button" onClick={()=>setShowFeModal(true)}
                style={{ ...btnGhost, fontSize:12, padding:'6px 14px' }}>💰 הוסף הוצאות קבועות</button>
            </div>
            <div style={{ fontSize:14, color:C.muted, marginBottom:20 }}>הוסף הוצאות ייעודיות לפרויקט והזן סכום</div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['סוג הוצאה','סכום ₪',''].map((h,i)=>(
                    <th key={i} style={{ fontSize:13, fontWeight:600, color:C.muted, textAlign:i===0?'right':'center', padding:'0 6px 12px', borderBottom:`1px solid ${C.border}`, textTransform:'uppercase', letterSpacing:'0.04em', width:i===2?32:undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expRows.map(row=>(
                  <tr key={row.id}>
                    <td style={{ padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                      <input type="text" value={row.name} onChange={e=>updateExpRow(row.id,'name',e.target.value)}
                        placeholder="סוג הוצאה"
                        className="calc-ghost-input"
                        style={{ width:'100%', padding:'4px 2px', fontSize:14, color:C.muted }} />
                    </td>
                    <td style={{ padding:'8px 6px', borderBottom:`1px solid ${C.border}`, textAlign:'center' }}>
                      <NumberInput value={row.amount} onChange={v=>updateExpRow(row.id,'amount',v)} />
                    </td>
                    <td style={{ padding:'8px 6px', borderBottom:`1px solid ${C.border}`, textAlign:'center' }}>
                      <button className="del-btn-r" type="button" onClick={()=>setExpRows(rows=>rows.filter(r=>r.id!==row.id))}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding:'12px 6px', color:C.muted, fontWeight:600, fontSize:14 }}>סה"כ הוצאות</td>
                  <td style={{ padding:'12px 6px', textAlign:'center', fontWeight:700, color:C.accent, borderTop:`1px solid ${C.border2}`, fontSize:16 }}>{fmt(totalExp)}</td>
                  <td style={{ borderTop:`1px solid ${C.border2}` }}></td>
                </tr>
              </tfoot>
            </table>
            {totalExp === 0 && (
              <div style={{ marginTop:10, fontSize:12, color:'rgba(255,90,114,0.75)' }}>
                ⚠️ חובה להוסיף לפחות הוצאה אחת
              </div>
            )}
            <button type="button" className="add-row-r" onClick={addExpRow}><span style={{fontSize:18}}>+</span> הוסף הוצאה</button>
          </div>

        </div>

        {/* ── Cost buffer box ───────────────────────────────────────────────── */}
        <div style={{ marginTop:12, marginBottom:16, background:'rgba(176,106,255,0.08)', border:'1px solid rgba(176,106,255,0.25)', borderRadius:12, padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'center', gap:16, textAlign:'center' }}>
          <div style={{ fontSize:16, color:C.purple, fontWeight:600 }}>עלות פרויקט + 10% מקום לטעויות</div>
          <div style={{ fontSize:40, fontWeight:700, color:C.purple, letterSpacing:-1 }}>{fmt(buffer)}</div>
        </div>

        {/* ── Step 2 ───────────────────────────────────────────────────────── */}
        <StepHeader
          number="2"
          title="עוזר המלצת רווח"
          subtitle="ענה על השאלות — נחשב בשבילך את אחוז הרווח האופטימלי"
          done={rec && !rec.incomplete}
        />

        {/* ── Recommendation block ──────────────────────────────────────────── */}
        <div style={{ ...cardStyle, marginBottom:16 }}>
          <div style={{ fontSize:17, fontWeight:700, color:'white', marginBottom:4 }}>🎯 עוזר המלצת רווח</div>
          <div style={{ fontSize:14, color:C.muted, marginBottom:16 }}>ענה על השאלות ונמליץ לך על אחוז רווח מתאים</div>

          {/* Progress bar */}
          <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:20, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:2, background:`linear-gradient(to left,${C.green},${C.accent})`, width:`${progressPct}%`, transition:'width 0.4s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>

          <div className="cr-sliders">

            {/* Sliders */}
            {[
              { key:1,       label:'כמה אני רוצה את הפרויקט הזה?',    minLabel:'בכלל לא רוצה', maxLabel:'מאוד רוצה' },
              { key:'demand',label:'עד כמה אני מבוקש עכשיו?',          minLabel:'בכלל לא מבוקש', maxLabel:'מבוקש מאוד' },
              { key:'busy',  label:'עד כמה אני עמוס עכשיו בעבודה?',    minLabel:'פנוי לגמרי', maxLabel:'עמוס מאוד' },
              { key:2,       label:'כמה הפרויקט יעזור לתיק העבודות?',  minLabel:'בכלל לא', maxLabel:'חשוב מאוד' },
            ].map(({key,label,minLabel,maxLabel})=>{
              const val = qVals[key] || 0;
              const colorFn = Q_COLOR[key];
              const sliderColor = val > 0 && colorFn
                ? STAR_COLORS[colorFn(val)].borderColor
                : 'rgba(255,255,255,0.25)';
              const fillPct = ((val - 1) / 9) * 100;
              return (
                <div key={key} style={{ display:'flex', flexDirection:'column', gap:12, background:C.elevated, borderRadius:10, padding:16 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.9)' }}>{label}</div>
                    <div style={{
                      minWidth:36, height:36, borderRadius:8,
                      background: val > 0 ? sliderColor.replace('0.5','0.15') : 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${val > 0 ? sliderColor : 'rgba(255,255,255,0.12)'}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:16, fontWeight:700,
                      color: val > 0 ? sliderColor : 'rgba(255,255,255,0.2)',
                      transition:'all 0.2s',
                    }}>
                      {val > 0 ? val : '—'}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1" max="10" step="1"
                    value={val || 1}
                    onChange={e => setQ(key, parseInt(e.target.value))}
                    className="rec-slider"
                    style={{
                      background: val > 0
                        ? `linear-gradient(to left, ${sliderColor} ${fillPct}%, rgba(255,255,255,0.1) ${fillPct}%)`
                        : undefined,
                      color: sliderColor,
                    }}
                  />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:-6 }}>
                    <span>1 — {minLabel}</span>
                    <span>{maxLabel} — 10</span>
                  </div>
                </div>
              );
            })}

            {/* Client temperature */}
            <div style={{ gridColumn:'1 / -1', display:'flex', flexDirection:'column', gap:10, background:C.elevated, borderRadius:10, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.9)' }}>טמפרטורת הלקוח</div>
              <div style={{ fontSize:13, color:C.muted, marginTop:-6 }}>כמה הלקוח מכיר אותך ומוכן לשלם</div>
              <div className="cr-client">
                {[
                  { type:'referral_good', icon:'🔥', label:'רותח',  desc:'לקוח חוזר או המלצה חזקה', labelColor:'#ff6b35', activeBorder:'#ff6b35', activeBg:'rgba(255,107,53,0.08)' },
                  { type:'inbound',       icon:'☀️',  label:'חם',    desc:'ראה עבודות, הגיע מוכן',   labelColor:C.accent, activeBorder:C.accent,   activeBg:'rgba(245,197,24,0.08)' },
                  { type:'referral_weak', icon:'🌤',  label:'פושר',  desc:'ממישהו שעשית בזול',        labelColor:'#8a9bbf', activeBorder:'#8a9bbf', activeBg:'rgba(138,155,191,0.08)' },
                  { type:'new',           icon:'🧊',  label:'קר',    desc:'לא מכיר אותך בכלל',        labelColor:'#5b8dee', activeBorder:'#5b8dee', activeBg:'rgba(91,141,238,0.08)' },
                ].map(t=>(
                  <button key={t.type} type="button" className="temp-btn-r"
                    style={ clientType===t.type ? { borderColor:t.activeBorder, borderWidth:2, background:t.activeBg } : {} }
                    onClick={()=>setClientType(clientType===t.type?null:t.type)}>
                    <div style={{ fontSize:26, lineHeight:1 }}>{t.icon}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:clientType===t.type?t.labelColor:'rgba(255,255,255,0.9)' }}>{t.label}</div>
                    <div style={{ fontSize:13, color:C.muted, lineHeight:1.5 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Budget + Quoted range */}
            <div className="cr-budget" style={{ gridColumn:'1 / -1', borderTop:`1px solid ${C.border}`, paddingTop:24 }}>

              {/* Budget */}
              <div style={{ background:C.elevated, border:`1px solid ${C.border2}`, borderRadius:14, padding:'18px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ width:32, height:32, borderRadius:9, background:'rgba(245,197,24,0.1)', border:'1px solid rgba(245,197,24,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>💰</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.9)' }}>הלקוח שיתף תקציב?</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>נתחשב בו אם הגיוני</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button type="button" className={`pill-btn-r ${budgetMode==='no'?'active':''}`} onClick={()=>setBudgetMode('no')}>לא</button>
                  <button type="button" className={`pill-btn-r ${budgetMode==='yes'?'active':''}`} onClick={()=>setBudgetMode('yes')}>כן</button>
                </div>
                {budgetMode==='yes' && (
                  <div style={{ marginTop:14 }}>
                    <div style={{ height:1, background:C.border, marginBottom:14 }} />
                    <div style={{ fontSize:11, color:C.muted, marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>תקציב הלקוח</div>
                    <div style={{ display:'flex', alignItems:'center', background:C.surface, border:'1px solid rgba(245,197,24,0.25)', borderRadius:10, padding:'10px 14px', gap:6 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:C.accent }}>₪</span>
                      <input type="number" min="0" value={budgetAmount} onChange={e=>setBudgetAmount(String(Math.max(0,parseFloat(e.target.value)||0)||''))} onKeyDown={blockMinus} onWheel={noScroll} placeholder="0"
                        style={{ flex:1, background:'transparent', border:'none', fontSize:18, fontWeight:700, color:C.accent, fontFamily:'inherit', outline:'none', textAlign:'right', width:'100%' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Quoted range */}
              <div style={{ background:C.elevated, border:`1px solid ${C.border2}`, borderRadius:14, padding:'18px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ width:32, height:32, borderRadius:9, background:'rgba(176,106,255,0.1)', border:'1px solid rgba(176,106,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>💬</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.9)' }}>הלקוח שמע טווח מחירים?</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>ההמלצה תישאר קרוב לטווח</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button type="button" className={`pill-btn-r ${quotedRangeMode==='no'?'active':''}`} onClick={()=>setQuotedRangeMode('no')}>לא</button>
                  <button type="button" className={`pill-btn-r ${quotedRangeMode==='yes'?'active':''}`} onClick={()=>setQuotedRangeMode('yes')}>כן</button>
                </div>
                {quotedRangeMode==='yes' && (
                  <div style={{ marginTop:14 }}>
                    <div style={{ height:1, background:C.border, marginBottom:14 }} />
                    <div style={{ fontSize:11, color:C.muted, marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>הטווח שציינת</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, display:'flex', alignItems:'center', background:C.surface, border:'1px solid rgba(176,106,255,0.25)', borderRadius:10, padding:'10px 14px', gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:C.purple }}>₪</span>
                        <input type="number" min="0" value={rangeMin} onChange={e=>setRangeMin(String(Math.max(0,parseFloat(e.target.value)||0)||''))} onKeyDown={blockMinus} onWheel={noScroll} placeholder="מינ׳"
                          style={{ flex:1, background:'transparent', border:'none', fontSize:16, fontWeight:700, color:C.purple, fontFamily:'inherit', outline:'none', textAlign:'right', width:'100%' }} />
                      </div>
                      <span style={{ color:C.muted, fontSize:12, fontWeight:500, flexShrink:0 }}>עד</span>
                      <div style={{ flex:1, display:'flex', alignItems:'center', background:C.surface, border:'1px solid rgba(176,106,255,0.25)', borderRadius:10, padding:'10px 14px', gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:C.purple }}>₪</span>
                        <input type="number" min="0" value={rangeMax} onChange={e=>setRangeMax(String(Math.max(0,parseFloat(e.target.value)||0)||''))} onKeyDown={blockMinus} onWheel={noScroll} placeholder="מקס׳"
                          style={{ flex:1, background:'transparent', border:'none', fontSize:16, fontWeight:700, color:C.purple, fontFamily:'inherit', outline:'none', textAlign:'right', width:'100%' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Rec result */}
          {rec && !rec.incomplete && (
            <div style={{ marginTop:20, borderRadius:12, padding:'18px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:20, background:'rgba(79,195,138,0.07)', border:'1px solid rgba(79,195,138,0.2)' }}>
              <div style={{ minWidth:140 }}>
                <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>אחוז רווח מומלץ</div>
                <div style={{ fontSize:32, fontWeight:700, color:C.green, letterSpacing:-1 }}>
                  {rec.recPct==='עלות' ? 'מחיר עלות' : `${rec.recPct}%`}
                </div>
                <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>{rec.rangeLabel}</div>
                {rec.recPct !== 'עלות' && (
                  <div style={{ marginTop:10, height:6, background:'rgba(255,255,255,0.07)', borderRadius:6, position:'relative' }}>
                    <div style={{ position:'absolute', height:'100%', borderRadius:6, background:C.green, transition:'all 0.4s ease', left:`${recBarLeft}%`, width:`${recBarWidth}%` }} />
                  </div>
                )}
              </div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.88)', lineHeight:1.6, maxWidth:500 }}>{rec.reason}</div>
            </div>
          )}
          {rec?.incomplete && (
            <div style={{ marginTop:20, borderRadius:12, padding:'18px 22px', background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ fontSize:26, flexShrink:0 }}>🔒</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.95)', marginBottom:4 }}>ההמלצה תופיע כשכל השאלות יענו</div>
                <div style={{ fontSize:13, color:C.muted, lineHeight:1.5 }}>ענה על כל הדירוגים, בחר סוג לקוח וציין תקציב וטווח מחיר.</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Step 3 ───────────────────────────────────────────────────────── */}
        <StepHeader
          number="3"
          title="בחר אחוז רווח"
          subtitle="לחץ על האחוז הרצוי — הירוק הוא ההמלצה שלנו"
          done={selectedPct !== null}
        />

        {/* ── Profit grid ───────────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:4 }}>
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:'white', marginBottom:4 }}>בחירת רווח</div>
              <div style={{ fontSize:14, color:C.muted }}>לחץ על אחוז הרווח הרצוי</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
              {selectedPct==='עלות' && (
                <div style={{ background:'rgba(255,90,114,0.07)', border:'1px solid rgba(255,90,114,0.3)', borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8, minWidth:320 }}>
                  <div style={{ fontSize:16, flexShrink:0 }}>⚠️</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:2 }}>אין רווח בפרויקט הזה</div>
                    <div style={{ fontSize:11, color:'rgba(255,90,114,0.8)', lineHeight:1.5 }}>כל הוצאה בלתי צפויה תגרום להפסד ישיר.</div>
                  </div>
                </div>
              )}
              {selectedPct && selectedPct!=='עלות' && !rec?.recPct && (
                <div style={{ background:'rgba(245,197,24,0.07)', border:'1px solid rgba(245,197,24,0.3)', borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8, minWidth:320 }}>
                  <div style={{ fontSize:16, flexShrink:0 }}>💡</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:2 }}>לא נלקחו בחשבון פרמטרים חשובים</div>
                    <div style={{ fontSize:11, color:'rgba(245,197,24,0.8)', lineHeight:1.5 }}>ענה על השאלות למעלה כדי לקבל המלצה אישית.</div>
                  </div>
                </div>
              )}
              {selectedPct && selectedPct!=='עלות' && rec && !rec.incomplete && typeof selectedPct==='number' && (selectedPct < rec.low || selectedPct > rec.high) && selectedPct !== rec.recPct && (
                <div style={{ background:'rgba(245,197,24,0.07)', border:'1px solid rgba(245,197,24,0.3)', borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8, minWidth:320 }}>
                  <div style={{ fontSize:16, flexShrink:0 }}>⚠️</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:2 }}>מחוץ לטווח המומלץ</div>
                    <div style={{ fontSize:11, color:'rgba(245,197,24,0.8)', lineHeight:1.5 }}>האחוז שבחרת חורג מההמלצה — שים לב.</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="cr-pills">
            {PERCENTS.map(pct=>{
              const isSelected = pct === selectedPct;
              const isSpecial  = pct === 'עלות';
              const numPcts    = PERCENTS.filter(p=>p!=='עלות');
              const maxP       = Math.max(...numPcts);
              const barW       = isSpecial ? 2 : Math.round((pct/maxP)*100);
              const color      = isSelected && !isSpecial ? pillColor(pct) : null;

              let border = C.border, bg = 'transparent', textColor = 'rgba(255,255,255,0.85)', barColor = C.muted;
              if (isSelected) {
                if (isSpecial) { border='rgba(255,90,114,0.5)'; bg='rgba(255,90,114,0.07)'; textColor=C.red; }
                else if (color==='green')  { border=C.green;  bg='rgba(79,195,138,0.1)';  textColor=C.green;  barColor=C.green; }
                else if (color==='yellow') { border=C.accent; bg='rgba(245,197,24,0.1)';  textColor=C.accent; barColor=C.accent; }
                else if (color==='red')    { border=C.red;    bg='rgba(255,90,114,0.1)';  textColor=C.red;    barColor=C.red; }
                else                       { border=C.green;  bg='rgba(79,195,138,0.1)';  textColor=C.green;  barColor=C.green; }
              }
              // Highlight rec pill (not selected)
              const isRecPill = !isSelected && rec && !rec.incomplete && pct===rec.recPct;
              if (isRecPill) { border='rgba(79,195,138,0.4)'; }

              return (
                <div key={pct} onClick={()=>setSelectedPct(pct)}
                  style={{ borderRadius:10, padding:'12px 6px 10px', textAlign:'center', border:`${isSelected?'2px':'1px'} ${isSpecial&&isSelected?'dashed':'solid'} ${border}`, cursor:'pointer', background:bg, position:'relative', overflow:'hidden', transition:'all 0.15s', userSelect:'none' }}>
                  {isSpecial ? (
                    <>
                      <div style={{ fontSize:12, fontWeight:700, color:textColor, lineHeight:1.3, position:'relative', zIndex:1 }}>פרויקט<br/>במחיר עלות</div>
                      <div style={{ marginTop:10, height:4, background:'rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4, background:isSelected?C.red:C.muted, width:'2%' }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:18, fontWeight:700, color:isSelected?textColor:undefined, position:'relative', zIndex:1 }}>{pct}%</div>
                      <div style={{ marginTop:10, height:4, background:'rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4, background:isSelected?barColor:C.muted, width:`${barW}%`, transition:'width 0.3s ease' }} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Final banner ──────────────────────────────────────────────────── */}
        <div className="cr-banner" style={{ background:'linear-gradient(to left,rgba(245,197,24,0.22) 0%,rgba(245,197,24,0.06) 100%)', border:'1px solid rgba(245,197,24,0.3)', borderRadius:14 }}>
          <div style={{ display:'flex', gap:32 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
              <div style={{ fontSize:14, color:C.muted, marginBottom:5 }}>רווח</div>
              <div style={{ fontSize:26, fontWeight:700, color:C.accent }}>
                {selectedPct!==null ? fmt(finalProfit) : '—'}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
              <div style={{ fontSize:14, color:C.muted, marginBottom:5 }}>אחוז רווח</div>
              <div style={{ fontSize:26, fontWeight:700, color:C.accent }}>
                {selectedPct!==null ? (selectedPct==='עלות' ? 'מחיר עלות' : `${selectedPct}%`) : '—'}
              </div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:16, color:C.muted, marginBottom:8 }}>מחיר סופי ללקוח</div>
            <div className="cr-banner-price" style={{ fontSize:58, fontWeight:700, color:C.accent, letterSpacing:-2, lineHeight:1 }}>
              {selectedPct!==null ? fmt(finalPrice) : '—'}
            </div>
          </div>
        </div>

      </div>

      {/* ── Fixed expenses modal ──────────────────────────────────────────────── */}
      {showFeModal && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setShowFeModal(false); }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:20, padding:28, width:'90%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <div style={{ fontSize:18, fontWeight:700, color:'white' }}>⚡ חישוב הוצאות קבועות</div>
              <button type="button" onClick={()=>setShowFeModal(false)} style={{ background:'transparent', border:'none', cursor:'pointer', color:C.muted, display:'flex', alignItems:'center' }}><X size={18}/></button>
            </div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:22, lineHeight:1.5 }}>הכנס הוצאות קבועות חודשיות — המערכת תחלק לפי שעות הפרויקט ותוסיף לרשימה.</div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>שעות עבודה</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ fontSize:12, color:C.muted, fontWeight:600 }}>שעות עבודה בחודש</div>
                  <input type="number" min="1" value={feMonthlyHours} onChange={e=>setFeMonthlyHours(String(Math.max(1,parseFloat(e.target.value)||1)))} onKeyDown={blockMinus} onWheel={noScroll} placeholder="160"
                    style={{ ...inputStyle }} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ fontSize:12, color:C.muted, fontWeight:600 }}>שעות הפרויקט</div>
                  <div style={{ background:'rgba(245,197,24,0.07)', border:'1px solid rgba(245,197,24,0.25)', borderRadius:8, padding:'8px 14px', fontSize:16, fontWeight:700, color:C.accent }}>
                    {Math.round(feProjectHours)} שעות
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>הוצאות חודשיות קבועות</div>
              {feRows.map(r=>(
                <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'center', marginBottom:10 }}>
                  <input type="text" value={r.name} onChange={e=>setFeRows(rows=>rows.map(x=>x.id===r.id?{...x,name:e.target.value}:x))}
                    placeholder="שם הוצאה" style={{ ...inputStyle, background:'rgb(var(--bg-elevated))', border:`1px solid ${C.border2}` }} />
                  <div style={{ display:'inline-flex', alignItems:'center', gap:3, background:C.elevated, border:`1px solid ${C.border2}`, borderRadius:8, padding:'5px 8px' }}>
                    <span style={{ fontSize:13, color:C.accent, fontWeight:700 }}>₪</span>
                    <input type="number" min="0" value={r.amount} onKeyDown={blockMinus} onWheel={noScroll} onChange={e=>setFeRows(rows=>rows.map(x=>x.id===r.id?{...x,amount:String(Math.max(0,parseFloat(e.target.value)||0)||'')}:x))}
                      placeholder="0" style={{ width:70, background:'transparent', border:'none', fontSize:15, color:'rgba(255,255,255,0.92)', textAlign:'center', outline:'none' }} />
                  </div>
                </div>
              ))}
              <button type="button" className="add-row-r" style={{ marginTop:8 }} onClick={()=>setFeRows(r=>[...r,{id:uid(),name:'',amount:''}])}><span style={{fontSize:18}}>+</span> הוסף שורה</button>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
              <button type="button" onClick={()=>setShowFeModal(false)} style={btnGhost}>ביטול</button>
              <button type="button" onClick={applyFixedExp} style={btnPrimary}>הוסף לרשימה ←</button>
            </div>
          </div>
        </div>
      )}


      {/* ── Overwrite modal ───────────────────────────────────────────────────── */}
      {showOverwrite && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:16, padding:28, width:'90%', maxWidth:360, textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>💾</div>
            <div style={{ fontSize:17, fontWeight:700, color:'white', marginBottom:8 }}>עדכן הצעה קיימת?</div>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.6, marginBottom:22 }}>
              ההצעה "{pendingSave}" כבר קיימת. האם לדרוס או לשמור כהצעה חדשה?
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button type="button" onClick={()=>{ doSave(pendingSave,true); setShowOverwrite(false); }} style={btnPrimary}>דרוס הצעה קיימת</button>
              <button type="button" onClick={()=>{ doSave(pendingSave+'(2)',false); setShowOverwrite(false); }} style={btnGhost}>שמור כהצעה חדשה</button>
              <button type="button" onClick={()=>setShowOverwrite(false)} style={{ ...btnGhost, color:C.muted }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
