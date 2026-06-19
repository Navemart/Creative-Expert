import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

/* ─── Mouse Glow ────────────────────────────────── */
function MouseGlow() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const cur = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => { mouse.current = { x: e.clientX, y: e.clientY }; });

    const draw = () => {
      cur.current.x += (mouse.current.x - cur.current.x) * 0.06;
      cur.current.y += (mouse.current.y - cur.current.y) * 0.06;
      const { x, y } = cur.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const g1 = ctx.createRadialGradient(x, y, 0, x, y, 520);
      g1.addColorStop(0, 'rgba(249,194,0,0.07)');
      g1.addColorStop(0.4, 'rgba(249,194,0,0.03)');
      g1.addColorStop(1, 'rgba(249,194,0,0)');
      ctx.fillStyle = g1; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, 120);
      g2.addColorStop(0, 'rgba(249,194,0,0.05)');
      g2.addColorStop(1, 'rgba(249,194,0,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, canvas.width, canvas.height);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(rafRef.current); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

/* ─── Counter ───────────────────────────────────── */
function Counter({ target, prefix = '', decimal = false }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const dur = 2000;
    const start = performance.now();
    const step = now => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(ease * target);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target]);

  return <span ref={ref}>{prefix}{decimal ? val.toFixed(1) : Math.round(val)}</span>;
}

/* ─── Reveal ────────────────────────────────────── */
function SR({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

/* ─── Data ──────────────────────────────────────── */
const TICKER_ITEMS = [
  { av: 'ע', name: 'עמיתאי', msg: 'מ-₪6K ל-₪22K — תוך 3 חודשים 🚀' },
  { av: 'מ', name: 'מעיין', msg: 'שיא חודשי ₪42K 💰' },
  { av: 'ת', name: 'תאיר', msg: 'סגרה פרויקט ₪15K — ראשון בקריירה ✅' },
  { av: 'ע', name: 'ענבר', msg: 'הכפילה מחיר — לא איבדה לקוח 🎯' },
  { av: 'נ', name: 'נועם', msg: '3 פניות אורגניות השבוע בלי לרדוף ⚡' },
  { av: 'ל', name: 'לירון', msg: 'עזבה עבודה שכירה אחרי חודשיים 🔥' },
];

const SLACK_MSGS = [
  { av: 'ע', name: 'עמיתאי', time: 'היום 09:14', text: 'סגרתי פרויקט ₪12,000 🔥 הפעם הראשונה שאני לא מוריד מחיר!!!', reacts: ['🔥 14', '💪 9', '🎉 7'] },
  { av: 'מ', name: 'מעיין', time: 'היום 11:32', text: 'שיא חודשי ₪42K — עדיין לא מאמינה לעצמי 😮', reacts: ['🚀 18', '✅ 11'] },
  { av: 'ת', name: 'תאיר', time: 'אתמול 20:45', text: 'חודש ראשון בתוכנית — ₪15,000 הכנסה. לא מאמינה שזה אני כותבת 🙏', reacts: ['💰 24', '🔥 19'] },
  { av: 'ע', name: 'ענבר', time: 'אתמול 14:10', text: '₪32K שיא! הגשתי התפטרות 😂 יש לי לקוחות בתור!', reacts: ['🎉 33', '✈️ 15'] },
];

const ALUMNI = [
  { av: 'ע', name: 'עמיתאי', tag: '₪22K/חודש 🚀' },
  { av: 'מ', name: 'מעיין', tag: '₪42K שיא 💰' },
  { av: 'ת', name: 'תאיר', tag: '₪15K לפרויקט ✅' },
  { av: 'ע', name: 'ענבר', tag: '₪32K שיא 🎉' },
  { av: 'נ', name: 'נועם', tag: '3 פניות/שבוע ⚡' },
  { av: 'ל', name: 'לירון', tag: 'עזבה שכירה 🔥' },
  { av: 'ד', name: 'דנה', tag: '₪28K בחודש 💎' },
  { av: 'י', name: 'יאיר', tag: 'הכפיל מחיר 🎯' },
];

const CASES = [
  { av: 'ע', name: 'עמיתאי', role: 'מעצב פרילנסר', before: '₪6K/חודש', after: '₪22K/חודש' },
  { av: 'מ', name: 'מעיין', role: 'מעצבת עצמאית', before: '₪4K/חודש', after: '₪42K שיא' },
  { av: 'ת', name: 'תאיר', role: 'מעצבת פרילנסרית', before: '₪2K/חודש', after: '₪15K לפרויקט' },
  { av: 'ע', name: 'ענבר', role: 'מעצבת עצמאית', before: 'מחירים נמוכים', after: '₪32K שיא' },
];

const TESTIMONIALS = [
  { av: 'ע', name: 'עמיתאי', role: 'מעצב, תל אביב', stars: 5, text: '"לפני התוכנית לקחתי כל פרויקט שהגיע. אחרי שלושה חודשים הכפלתי את המחיר שלי — ומחציתי את מספר הלקוחות. הכנסה גבוהה יותר, שעות פחות."' },
  { av: 'מ', name: 'מעיין', role: 'מעצבת, ירושלים', stars: 5, text: '"לא האמנתי שאפשר לייצר לידים בלי לרדוף אחרי אנשים. היום פניות מגיעות אליי מהאינסטגרם כל שבוע — ולקוחות יותר טובים."' },
  { av: 'ע', name: 'ענבר', role: 'מעצבת, חיפה', stars: 5, text: '"המערכת שנייב נתן לי שינתה את הדרך שאני מתנהלת. עכשיו יש לי ודאות חודשית — ₪10K מינימום — שלא הייתה לי אף פעם."' },
];

const FAQS = [
  { q: 'למי מיועדת התוכנית?', a: 'למעצבים עצמאיים מנוסים שמרוויחים ₪5K–₪15K בחודש ורוצים להגיע ל-₪20K–₪30K+ בלי להוסיף שעות עבודה.' },
  { q: 'איך אני מציב את עצמי כמומחה?', a: 'עוצרים למכור עיצוב ומתחילים למכור תוצאות עסקיות. בתוכנית נבנה יחד את ה-positioning, ה-offer, ותהליך המכירה שלך.' },
  { q: 'איך אני סוגר פרויקטים של ₪10K+ בלי להרגיש "מוכרן"?', a: 'לומדים לאבחן בעיות, לשאול שאלות טובות יותר, ולהוביל תהליך — לא לשלוח הצעת מחיר ולחכות.' },
  { q: 'כמה זמן לוקח לראות תוצאות?', a: 'רוב המעצבים רואים שינוי בסוג הלקוחות ובמחירים שהם סוגרים כבר בחודשיים–שלושה הראשונים.' },
  { q: 'מה אם אני כבר עייף מ"קורסים" שלא עובדים?', a: 'זה לא קורס — זה תהליך עבודה משותף. אנחנו בונים יחד את המערכת שלך, לא רק מסבירים מה לעשות.' },
  { q: 'כמה מקומות פנויים?', a: 'המחזור הנוכחי מוגבל ל-8 מקומות בלבד כדי לשמור על רמת הליווי. ברגע שהמקומות מתמלאים — הרשימה נסגרת.' },
];

/* ─── CSS ───────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
  @font-face {
    font-family: 'RagSans';
    src: url('/RagSans-Black.otf') format('opentype');
    font-weight: 900;
    font-style: normal;
  }
  .lp-root { font-family: 'Heebo', sans-serif; background: #080A12; color: #fff; direction: rtl; overflow-x: hidden; }
  .lp-root * { box-sizing: border-box; }

  /* ACCENT */
  .accent { color: #F9C200; }

  /* LABEL */
  .lp-label {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: #F9C200; margin-bottom: 24px;
  }
  .lp-label::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%; background: #F9C200;
    animation: blink 2s infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

  /* TYPOGRAPHY */
  .lp-h1 { font-size: clamp(3rem,6vw,5.5rem); font-weight: 900; line-height: 1.05; letter-spacing: -.02em; margin-bottom: 24px; }
  .lp-h2 { font-size: clamp(2.4rem,5vw,4rem); font-weight: 900; line-height: 1.1; letter-spacing: -.02em; margin-bottom: 20px; }
  .lp-body { font-size: 1.05rem; color: rgba(255,255,255,.5); line-height: 1.75; max-width: 560px; }

  /* CONTAINER */
  .lp-container { position: relative; z-index: 1; max-width: 1080px; margin: 0 auto; padding: 0 32px; }
  .lp-section { padding: 120px 0; position: relative; z-index: 1; }
  .lp-glow-line { height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(249,194,0,.3) 50%, transparent 100%); position: relative; z-index: 1; }

  /* BUTTONS */
  .lp-btn-primary {
    display: inline-flex; align-items: center; gap: 10px;
    background: #F9C200; color: #080A12;
    font-family: 'Heebo', sans-serif; font-weight: 800; font-size: 1rem;
    padding: 16px 36px; border-radius: 50px; border: none; cursor: pointer;
    text-decoration: none; transition: all .2s; position: relative; overflow: hidden;
  }
  .lp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(249,194,0,.4); }
  .lp-btn-secondary {
    display: inline-flex; align-items: center; gap: 10px;
    background: rgba(255,255,255,.05); color: #fff;
    font-family: 'Heebo', sans-serif; font-weight: 700; font-size: 1rem;
    padding: 16px 36px; border-radius: 50px; border: 1px solid rgba(255,255,255,.15);
    cursor: pointer; text-decoration: none; transition: all .2s;
  }
  .lp-btn-secondary:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.3); transform: translateY(-2px); }

  /* NAV */
  .lp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    padding: 0 32px; height: 64px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(8,10,18,.7); backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,.07);
    transition: background .3s;
  }
  .lp-nav.scrolled { background: rgba(8,10,18,.95); }
  .lp-nav-logo { font-size: 1.1rem; font-weight: 900; color: #F9C200; text-decoration: none; display: flex; align-items: center; gap: 6px; }
  .lp-nav-links { display: flex; list-style: none; gap: 32px; position: absolute; left: 50%; transform: translateX(-50%); }
  .lp-nav-links a { font-size: .88rem; font-weight: 500; color: rgba(255,255,255,.5); transition: color .2s; text-decoration: none; position: relative; }
  .lp-nav-links a::after { content: ''; position: absolute; bottom: -4px; left: 0; right: 0; height: 2px; background: #F9C200; transform: scaleX(0); transition: transform .2s; border-radius: 2px; }
  .lp-nav-links a:hover { color: #fff; }
  .lp-nav-links a:hover::after { transform: scaleX(1); }
  .lp-nav-cta { background: #fff; color: #080A12; font-family: 'Heebo',sans-serif; font-weight: 800; font-size: .85rem; padding: 8px 22px; border-radius: 50px; border: none; cursor: pointer; transition: all .2s; text-decoration: none; }
  .lp-nav-cta:hover { background: #F9C200; transform: translateY(-1px); }
  @media(max-width:768px){ .lp-nav-links{display:none} }

  /* HERO */
  .lp-hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 110px 40px 80px; position: relative; overflow: hidden; }
  .lp-hero-spots { display: inline-flex; align-items: center; gap: 8px; background: rgba(249,194,0,.08); border: 1px solid rgba(249,194,0,.2); border-radius: 50px; padding: 8px 20px; font-size: .85rem; font-weight: 600; color: #F9C200; margin-bottom: 28px; }
  .lp-hero-spots .dot { width: 7px; height: 7px; border-radius: 50%; background: #F9C200; animation: blink 1.5s infinite; }
  .lp-hero-h1 { font-family: 'Heebo', sans-serif; font-size: clamp(2.8rem,5vw,5rem); font-weight: 900; line-height: 1.08; letter-spacing: -.025em; margin-bottom: 22px; max-width: 860px; }
  .lp-hero-sub { font-size: 1.1rem; color: rgba(255,255,255,.5); line-height: 1.75; max-width: 520px; margin: 0 auto 36px; }
  .lp-hero-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-bottom: 56px; }
  .lp-video-wrap { width: 100%; max-width: 860px; margin: 0 auto; display: block; }
  .lp-video { width: 100%; border-radius: 18px; overflow: hidden; border: 1px solid rgba(249,194,0,.2); box-shadow: 0 40px 120px rgba(0,0,0,.8), 0 0 0 1px rgba(249,194,0,.05); cursor: pointer; display: block; }
  .lp-video-thumb { position: relative; width: 100%; height: 0; padding-bottom: 56.25%; background: linear-gradient(135deg,#0F1220 0%,#141828 100%); overflow: hidden; }
  .lp-video-thumb::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 60% at 50% 50%, rgba(249,194,0,.08) 0%, transparent 70%); z-index: 0; }
  .lp-video-thumb-inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; z-index: 1; }
  .lp-play-ring { width: 80px; height: 80px; border-radius: 50%; background: #F9C200; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 18px rgba(249,194,0,.12); transition: transform .25s, box-shadow .25s; }
  .lp-video:hover .lp-play-ring { transform: scale(1.1); box-shadow: 0 0 0 28px rgba(249,194,0,.08); }
  .lp-video-label { font-size: .9rem; color: rgba(255,255,255,.3); }

  /* TICKER */
  .lp-ticker-wrap { overflow: hidden; border-top: 1px solid rgba(255,255,255,.07); border-bottom: 1px solid rgba(255,255,255,.07); background: #0F1220; padding: 16px 0; position: relative; z-index: 1; }
  .lp-ticker-track { display: flex; width: max-content; animation: marquee 32s linear infinite; }
  .lp-ticker-track:hover { animation-play-state: paused; }
  @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  .lp-ticker-item { display: inline-flex; align-items: center; gap: 10px; padding: 0 48px; font-size: .85rem; color: rgba(255,255,255,.5); white-space: nowrap; border-left: 1px solid rgba(255,255,255,.07); }
  .lp-ticker-av { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid #F9C200; background: #141828; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 800; color: #F9C200; flex-shrink: 0; }
  .lp-ticker-item strong { color: #fff; }

  /* STATS */
  .lp-stats-big { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 20px; padding: 60px; position: relative; overflow: hidden; }
  .lp-stats-big::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 80% at 40% 50%, rgba(249,194,0,.04) 0%, transparent 65%); pointer-events: none; }
  .lp-stats-big-num { font-size: clamp(5rem,10vw,9rem); font-weight: 900; line-height: 1; letter-spacing: -.04em; margin-bottom: 8px; }
  .lp-stats-big-label { font-size: .75rem; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.5); margin-bottom: 20px; }
  .lp-stats-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-top: 16px; }
  .lp-stat-mini { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 32px 28px; transition: border-color .25s; }
  .lp-stat-mini:hover { border-color: rgba(249,194,0,.25); }
  .lp-stat-mini .val { font-size: 2.6rem; font-weight: 900; color: #F9C200; line-height: 1; margin-bottom: 8px; }
  .lp-stat-mini .lbl { font-size: .8rem; color: rgba(255,255,255,.5); }
  @media(max-width:640px){ .lp-stats-row{grid-template-columns:1fr} }

  /* PROBLEMS GRID */
  .lp-problems-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap: 2px; background: rgba(255,255,255,.07); border-radius: 20px; overflow: hidden; margin-top: 64px; }
  .lp-problem-card { background: #0F1220; padding: 44px 36px; transition: background .25s; position: relative; overflow: hidden; }
  .lp-problem-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg,transparent,#F9C200,transparent); transform: scaleX(0); transition: transform .4s; }
  .lp-problem-card:hover { background: #141828; }
  .lp-problem-card:hover::after { transform: scaleX(1); }
  .lp-problem-num { font-size: 5rem; font-weight: 900; color: rgba(249,194,0,.08); line-height: 1; margin-bottom: 20px; letter-spacing: -.04em; }
  .lp-problem-card h3 { font-size: 1.15rem; font-weight: 800; margin-bottom: 12px; }
  .lp-problem-card p { font-size: .9rem; color: rgba(255,255,255,.5); line-height: 1.75; }

  /* FLYWHEEL */
  .lp-fw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: rgba(255,255,255,.07); border-radius: 20px; overflow: hidden; margin-top: 64px; }
  .lp-fw-card { background: #0F1220; padding: 44px 36px; position: relative; overflow: hidden; transition: background .25s; }
  .lp-fw-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 80% at 0% 0%, rgba(249,194,0,.04), transparent 60%); opacity: 0; transition: opacity .3s; }
  .lp-fw-card:hover { background: #141828; }
  .lp-fw-card:hover::before { opacity: 1; }
  .lp-fw-step { font-size: .68rem; letter-spacing: .14em; text-transform: uppercase; color: #F9C200; font-weight: 700; margin-bottom: 14px; }
  .lp-fw-card h3 { font-size: 1.3rem; font-weight: 800; margin-bottom: 12px; }
  .lp-fw-card p { font-size: .9rem; color: rgba(255,255,255,.5); line-height: 1.75; }
  .lp-fw-icon { font-size: 2rem; margin-bottom: 16px; }
  @media(max-width:580px){ .lp-fw-grid{grid-template-columns:1fr} }

  /* PHASES */
  .lp-phases { margin-top: 64px; display: flex; flex-direction: column; gap: 16px; }
  .lp-phase { display: grid; grid-template-columns: 56px 1fr; align-items: stretch; }
  .lp-phase-line { display: flex; flex-direction: column; align-items: center; padding-top: 6px; }
  .lp-phase-dot { width: 44px; height: 44px; border-radius: 50%; background: #F9C200; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: .95rem; color: #080A12; flex-shrink: 0; box-shadow: 0 0 0 8px rgba(249,194,0,.1); z-index: 1; }
  .lp-phase-connector { flex: 1; width: 2px; background: linear-gradient(to bottom, #F9C200, transparent); margin: 10px auto 0; opacity: .3; }
  .lp-phase-body { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 28px 32px; margin-right: 16px; transition: border-color .25s, background .25s; }
  .lp-phase-body:hover { border-color: rgba(249,194,0,.25); background: #141828; }
  .lp-phase-tag { font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; color: #F9C200; font-weight: 700; margin-bottom: 8px; }
  .lp-phase-body h3 { font-size: 1.15rem; font-weight: 800; margin-bottom: 10px; }
  .lp-phase-body p { font-size: .88rem; color: rgba(255,255,255,.5); line-height: 1.75; margin-bottom: 16px; }
  .lp-pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .lp-pill { font-size: .75rem; font-weight: 700; background: rgba(249,194,0,.08); color: #F9C200; border: 1px solid rgba(249,194,0,.2); padding: 4px 14px; border-radius: 50px; }

  /* ABOUT */
  .lp-about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
  .lp-about-img { border-radius: 20px; overflow: hidden; border: 1px solid rgba(249,194,0,.25); aspect-ratio: 4/5; background: #0F1220; display: flex; align-items: center; justify-content: center; }
  .lp-about-img-ph { color: rgba(255,255,255,.2); font-size: .9rem; text-align: center; padding: 20px; }
  .lp-about-text p { font-size: .97rem; color: rgba(255,255,255,.5); line-height: 1.8; margin-bottom: 14px; }
  .lp-cred-boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 32px; }
  .lp-cred-box { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 20px 24px; transition: border-color .2s; }
  .lp-cred-box:hover { border-color: rgba(249,194,0,.25); }
  .lp-cred-box-num { font-size: 1.8rem; font-weight: 900; color: #F9C200; line-height: 1; margin-bottom: 4px; }
  .lp-cred-box-lbl { font-size: .78rem; color: rgba(255,255,255,.4); line-height: 1.4; }
  @media(max-width:768px){ .lp-about-grid{grid-template-columns:1fr;gap:40px} }
  @media(max-width:480px){ .lp-cred-boxes{grid-template-columns:1fr 1fr} }

  /* INCLUDED */
  .lp-inc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: rgba(255,255,255,.07); border-radius: 20px; overflow: hidden; margin-top: 64px; }
  .lp-inc-item { background: #0F1220; padding: 28px 32px; display: flex; gap: 16px; align-items: flex-start; transition: background .2s; }
  .lp-inc-item:hover { background: #141828; }
  .lp-inc-check { width: 22px; height: 22px; border-radius: 50%; background: #F9C200; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; font-size: .7rem; font-weight: 900; color: #080A12; }
  .lp-inc-item strong { display: block; font-size: .92rem; font-weight: 800; margin-bottom: 5px; }
  .lp-inc-item span { font-size: .82rem; color: rgba(255,255,255,.5); line-height: 1.6; }
  @media(max-width:580px){ .lp-inc-grid{grid-template-columns:1fr} }

  /* SLACK */
  .lp-slack { max-width: 660px; margin: 64px auto 0; background: #0D0F1C; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,.6); }
  .lp-slack-bar { background: #0A0C16; border-bottom: 1px solid rgba(255,255,255,.07); padding: 12px 20px; display: flex; align-items: center; gap: 10px; }
  .lp-slack-dot { width: 11px; height: 11px; border-radius: 50%; }
  .lp-slack-ch { margin-right: auto; font-size: .78rem; font-weight: 600; color: rgba(255,255,255,.25); font-family: monospace; }
  .lp-slack-msgs { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .lp-slack-msg { display: flex; gap: 12px; }
  .lp-slack-av { width: 36px; height: 36px; border-radius: 8px; background: #141828; border: 1.5px solid #F9C200; display: flex; align-items: center; justify-content: center; font-size: .78rem; font-weight: 800; color: #F9C200; flex-shrink: 0; }
  .lp-slack-name { font-size: .78rem; font-weight: 700; color: #F9C200; }
  .lp-slack-time { font-size: .68rem; color: rgba(255,255,255,.25); margin-right: 6px; }
  .lp-slack-text { font-size: .84rem; color: rgba(255,255,255,.75); line-height: 1.55; margin-top: 2px; }
  .lp-slack-reacts { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  .lp-react-pill { font-size: .72rem; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07); border-radius: 6px; padding: 2px 8px; color: rgba(255,255,255,.5); }

  /* ALUMNI CAROUSEL */
  .lp-alumni-wrap { overflow: hidden; padding: 48px 0; position: relative; z-index: 1; }
  .lp-alumni-track { display: flex; gap: 16px; width: max-content; animation: marquee 40s linear infinite; }
  .lp-alumni-track:hover { animation-play-state: paused; }
  .lp-alumni-card { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 20px 24px; display: flex; align-items: center; gap: 14px; white-space: nowrap; min-width: 240px; transition: border-color .25s; }
  .lp-alumni-card:hover { border-color: rgba(249,194,0,.25); }
  .lp-alumni-av { width: 46px; height: 46px; border-radius: 50%; border: 2px solid #F9C200; background: #141828; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1rem; color: #F9C200; flex-shrink: 0; }
  .lp-alumni-name { font-weight: 800; font-size: .9rem; margin-bottom: 3px; }
  .lp-alumni-tag { font-size: .78rem; color: #F9C200; font-weight: 700; }

  /* CASES */
  .lp-cases-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 16px; margin-top: 64px; }
  .lp-case-card { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; overflow: hidden; transition: border-color .25s, transform .25s; cursor: pointer; }
  .lp-case-card:hover { border-color: rgba(249,194,0,.25); transform: translateY(-4px); }
  .lp-case-thumb { aspect-ratio: 16/9; background: linear-gradient(135deg,#0F1220,#141828); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .lp-case-thumb::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 60% at 50% 50%, rgba(249,194,0,.06), transparent); }
  .lp-case-av { width: 52px; height: 52px; border-radius: 50%; border: 2px solid #F9C200; background: #141828; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; color: #F9C200; position: relative; }
  .lp-case-info { padding: 20px 22px; }
  .lp-case-name { font-weight: 800; font-size: .92rem; margin-bottom: 4px; }
  .lp-case-role { font-size: .78rem; color: rgba(255,255,255,.35); margin-bottom: 12px; }
  .lp-case-arrow { color: rgba(255,255,255,.3); margin: 0 6px; }
  .lp-case-after { color: #F9C200; font-weight: 900; font-size: 1.1rem; }
  .lp-case-before { color: rgba(255,255,255,.35); text-decoration: line-through; font-size: .85rem; }

  /* TESTIMONIALS */
  .lp-testi-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(280px,1fr)); gap: 16px; margin-top: 64px; }
  .lp-testi-card { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; padding: 32px; transition: border-color .25s, transform .25s; }
  .lp-testi-card:hover { border-color: rgba(249,194,0,.25); transform: translateY(-3px); }
  .lp-testi-stars { color: #F9C200; letter-spacing: 2px; font-size: .95rem; margin-bottom: 14px; }
  .lp-testi-card p { font-size: .92rem; color: rgba(255,255,255,.72); line-height: 1.75; margin-bottom: 22px; }
  .lp-testi-author { display: flex; align-items: center; gap: 12px; }
  .lp-testi-av { width: 42px; height: 42px; border-radius: 50%; border: 2px solid #F9C200; background: #141828; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: .88rem; color: #F9C200; flex-shrink: 0; }
  .lp-testi-name { font-weight: 800; font-size: .88rem; }
  .lp-testi-role { font-size: .78rem; color: rgba(255,255,255,.25); }

  /* FAQ */
  .lp-faq-wrap { max-width: 720px; margin: 64px auto 0; display: flex; flex-direction: column; gap: 8px; }
  .lp-faq-item { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 14px; overflow: hidden; transition: border-color .2s; }
  .lp-faq-item.open { border-color: rgba(249,194,0,.3); }
  .lp-faq-btn { width: 100%; background: none; border: none; color: #fff; font-family: 'Heebo',sans-serif; font-size: .97rem; font-weight: 700; text-align: right; padding: 22px 24px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .lp-faq-icon { width: 24px; height: 24px; border-radius: 50%; background: rgba(249,194,0,.15); border: 1px solid rgba(249,194,0,.25); display: flex; align-items: center; justify-content: center; color: #F9C200; font-size: 1.1rem; flex-shrink: 0; transition: transform .3s, background .2s; line-height: 1; }
  .lp-faq-item.open .lp-faq-icon { transform: rotate(45deg); background: #F9C200; color: #080A12; }
  .lp-faq-ans { font-size: .9rem; color: rgba(255,255,255,.5); line-height: 1.8; padding: 0 24px; }

  /* PRICING */
  .lp-pricing-card { max-width: 540px; margin: 64px auto 0; background: #0F1220; border: 1px solid #F9C200; border-radius: 24px; padding: 56px 48px; text-align: center; box-shadow: 0 0 80px rgba(249,194,0,.08); position: relative; overflow: hidden; }
  .lp-pricing-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(249,194,0,.05), transparent 60%); pointer-events: none; }
  .lp-pricing-plan { font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: #F9C200; font-weight: 700; margin-bottom: 20px; }
  .lp-pricing-price { font-size: 4rem; font-weight: 900; line-height: 1; margin-bottom: 8px; letter-spacing: -.03em; }
  .lp-pricing-note { font-size: .85rem; color: rgba(255,255,255,.25); margin-bottom: 36px; }
  .lp-pricing-divider { height: 1px; background: rgba(255,255,255,.07); margin: 32px 0; }
  .lp-pricing-features { text-align: right; display: flex; flex-direction: column; gap: 13px; margin-bottom: 40px; }
  .lp-pf { display: flex; align-items: center; gap: 10px; font-size: .92rem; }
  .lp-pf::before { content: '✓'; color: #F9C200; font-weight: 900; flex-shrink: 0; }

  /* GUARANTEE */
  .lp-guarantee { max-width: 720px; margin: 0 auto; background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 24px; padding: 52px 48px; text-align: center; position: relative; overflow: hidden; }
  .lp-guarantee::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(249,194,0,.04), transparent 65%); pointer-events: none; }
  .lp-guarantee-icon { font-size: 3rem; margin-bottom: 20px; }
  .lp-guarantee h3 { font-size: 1.5rem; font-weight: 900; margin-bottom: 16px; }
  .lp-guarantee p { font-size: .95rem; color: rgba(255,255,255,.5); line-height: 1.8; max-width: 520px; margin: 0 auto; }

  /* FINAL CTA */
  .lp-final { padding: 140px 0; text-align: center; position: relative; z-index: 1; overflow: hidden; }
  .lp-final::before { content: ''; position: absolute; bottom: -100px; left: 50%; transform: translateX(-50%); width: 600px; height: 400px; background: radial-gradient(ellipse, rgba(249,194,0,.07) 0%, transparent 70%); pointer-events: none; }
  .lp-final-spots { display: inline-flex; align-items: center; gap: 8px; background: rgba(249,194,0,.08); border: 1px solid rgba(249,194,0,.2); border-radius: 50px; padding: 8px 20px; font-size: .8rem; font-weight: 600; color: #F9C200; margin-bottom: 28px; }
  .lp-final-spots .dot { width: 7px; height: 7px; border-radius: 50%; background: #F9C200; animation: blink 1.5s infinite; }
  .lp-checklist { max-width: 480px; margin: 40px auto 0; display: flex; flex-direction: column; gap: 12px; text-align: right; }
  .lp-checklist-item { display: flex; align-items: flex-start; gap: 12px; font-size: .92rem; color: rgba(255,255,255,.7); }
  .lp-checklist-item::before { content: '✓'; color: #F9C200; font-weight: 900; flex-shrink: 0; margin-top: 2px; }
  .lp-apply-steps { display: flex; justify-content: center; gap: 32px; margin-top: 48px; flex-wrap: wrap; }
  .lp-apply-step { text-align: center; }
  .lp-apply-step-num { width: 36px; height: 36px; border-radius: 50%; background: #F9C200; color: #080A12; font-weight: 900; font-size: .9rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
  .lp-apply-step-text { font-size: .82rem; color: rgba(255,255,255,.4); max-width: 140px; }

  /* FOOTER */
  .lp-footer { position: relative; z-index: 1; border-top: 1px solid rgba(255,255,255,.07); padding: 48px 0; text-align: center; background: #0F1220; }
  .lp-footer-logo { font-size: 1.1rem; font-weight: 900; color: #F9C200; margin-bottom: 16px; display: block; }
  .lp-footer p { font-size: .82rem; color: rgba(255,255,255,.25); }
  .lp-footer-links { display: flex; justify-content: center; gap: 24px; margin-top: 14px; }
  .lp-footer-links a { font-size: .8rem; color: rgba(255,255,255,.2); transition: color .2s; text-decoration: none; }
  .lp-footer-links a:hover { color: rgba(255,255,255,.5); }

  /* IDEAL CLIENT */
  .lp-fit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 48px; }
  .lp-fit-card { background: #0F1220; border: 1px solid rgba(255,255,255,.07); border-radius: 18px; padding: 36px; }
  .lp-fit-card.yes { border-color: rgba(34,197,94,.15); }
  .lp-fit-card.no { border-color: rgba(239,68,68,.1); }
  .lp-fit-title { font-weight: 800; font-size: 1rem; margin-bottom: 20px; }
  .lp-fit-title.yes { color: #4ade80; }
  .lp-fit-title.no { color: #f87171; }
  .lp-fit-list { display: flex; flex-direction: column; gap: 12px; }
  .lp-fit-item { display: flex; gap: 10px; font-size: .88rem; color: rgba(255,255,255,.65); align-items: flex-start; }
  .lp-fit-check.yes { color: #4ade80; flex-shrink: 0; }
  .lp-fit-check.no { color: #f87171; flex-shrink: 0; }
  @media(max-width:580px){ .lp-fit-grid{grid-template-columns:1fr} }
`;

/* ─── Components ────────────────────────────────── */
function SlackFeed() {
  const [visible, setVisible] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    SLACK_MSGS.forEach((_, i) => {
      setTimeout(() => setVisible(v => Math.max(v, i + 1)), i * 450);
    });
  }, [inView]);

  return (
    <div ref={ref} className="lp-slack">
      <div className="lp-slack-bar">
        <div className="lp-slack-dot" style={{ background: '#FF5F57' }} />
        <div className="lp-slack-dot" style={{ background: '#FEBC2E' }} />
        <div className="lp-slack-dot" style={{ background: '#28C840' }} />
        <span className="lp-slack-ch"># ניצחונות 🏆</span>
      </div>
      <div className="lp-slack-msgs">
        {SLACK_MSGS.map((m, i) => (
          <motion.div key={i} className="lp-slack-msg"
            initial={{ opacity: 0, y: 10 }}
            animate={visible > i ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}>
            <div className="lp-slack-av">{m.av}</div>
            <div>
              <div><span className="lp-slack-name">{m.name}</span><span className="lp-slack-time">{m.time}</span></div>
              <div className="lp-slack-text">{m.text}</div>
              <div className="lp-slack-reacts">{m.reacts.map(r => <span key={r} className="lp-react-pill">{r}</span>)}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <div className="lp-faq-wrap">
      {FAQS.map((f, i) => (
        <div key={i} className={`lp-faq-item${open === i ? ' open' : ''}`}>
          <button className="lp-faq-btn" onClick={() => setOpen(open === i ? null : i)}>
            <span>{f.q}</span>
            <span className="lp-faq-icon">{open === i ? '×' : '+'}</span>
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
                <p className="lp-faq-ans" style={{ paddingBottom: 22 }}>{f.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="lp-root">
      <style>{CSS}</style>
      <MouseGlow />

      {/* NAV */}
      <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <a href="#" className="lp-nav-logo">Creative Expert™</a>
        <ul className="lp-nav-links">
          <li><a href="#flywheel">השיטה</a></li>
          <li><a href="#phases">שלבים</a></li>
          <li><a href="#testimonials">עדויות</a></li>
          <li><a href="#about">אודות</a></li>
        </ul>
        <a href="#pricing" className="lp-nav-cta">הגשת מועמדות</a>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <SR>
          <div className="lp-hero-spots"><span className="dot" />3 מקומות פנויים החודש</div>
        </SR>
        <SR delay={0.1}>
          <h1 className="lp-hero-h1">
            <span style={{ display: 'block' }}>בנה עסק עיצוב</span>
            <span style={{ display: 'block' }} className="accent">שמרוויח ₪20K–₪30K+ בחודש</span>
            <span style={{ display: 'block' }}>בלי להסתמך על המלצות.</span>
          </h1>
        </SR>
        <SR delay={0.2}>
          <p className="lp-hero-sub">
            בלי להתחרות על מחיר. בלי לעבוד סביב השעון.<br />
            השיטה שהופכת מעצבים מנוסים לבעלי עסק אמיתיים.
          </p>
        </SR>
        <SR delay={0.3}>
          <div className="lp-hero-btns">
            <a href="#pricing" className="lp-btn-primary">הגש מועמדות ←</a>
            <a href="#flywheel" className="lp-btn-secondary">ראה איך זה עובד</a>
          </div>
        </SR>
        <motion.div className="lp-video-wrap" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4, ease: [0.16,1,0.3,1] }}>
          <div className="lp-video">
            <div className="lp-video-thumb">
              <div className="lp-video-thumb-inner">
                <div className="lp-play-ring">
                  <svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#080A12" /></svg>
                </div>
                <div className="lp-video-label">לחץ לצפייה בסרטון ההסבר</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="lp-glow-line" />

      {/* TICKER */}
      <div className="lp-ticker-wrap">
        <div className="lp-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i} className="lp-ticker-item">
              <span className="lp-ticker-av">{t.av}</span>
              <strong>{t.name}</strong>&nbsp;— {t.msg}
            </span>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section className="lp-section" style={{ borderBottom: '1px solid rgba(255,255,255,.07)', paddingTop: 96, paddingBottom: 96 }}>
        <div className="lp-container">
          <SR><div className="lp-label">המספרים</div>
            <h2 className="lp-h2">בוגרים אמיתיים. תוצאות אמיתיות.<br /><span className="accent">קבלות.</span></h2>
            <p className="lp-body">כל בוגר פעיל מדווח מספרים. אלה הנתונים הגולמיים — כפי שהם.</p>
          </SR>
          <SR delay={0.1}>
            <div className="lp-stats-big" style={{ marginTop: 48 }}>
              <div className="lp-stats-big-label">תשואה ממוצעת על השקעה</div>
              <div className="lp-stats-big-num"><Counter target={33.8} decimal /><span className="accent">x</span></div>
              <p style={{ fontSize: '.9rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.7, maxWidth: 480, marginBottom: 32 }}>
                כל ₪1 שהשקעת בתוכנית החזיר ₪33.8 בעסק חדש. סה"כ הכנסות כלל הבוגרים — מדווח על ידם.
              </p>
            </div>
          </SR>
          <SR delay={0.2}>
            <div className="lp-stats-row">
              <div className="lp-stat-mini"><div className="val"><Counter target={200} />+</div><div className="lbl">בוגרים בסה"כ</div></div>
              <div className="lp-stat-mini"><div className="val"><Counter target={94} />%</div><div className="lbl">שביעות רצון</div></div>
              <div className="lp-stat-mini"><div className="val">₪<Counter target={15} />K+</div><div className="lbl">הכנסה ממוצעת</div></div>
            </div>
          </SR>
        </div>
      </section>

      <div className="lp-glow-line" />

      {/* PROBLEMS */}
      <section className="lp-section">
        <div className="lp-container">
          <SR><div className="lp-label">הבעיה</div>
            <h2 className="lp-h2">למה רוב המעצבים<br /><span className="accent">תקועים באותו מקום?</span></h2>
            <p className="lp-body">לא חסר לך כישרון. חסר לך מערכת.</p>
          </SR>
          <div className="lp-problems-grid">
            {[
              { n: '01', t: 'AI גונב את הביצוע', p: 'לוגואים, אתרים, קונספטים — AI מייצר בדקות. מי שמוכר עיצוע יתחרה עם כלים חינמיים.' },
              { n: '02', t: 'מורידים מחיר כדי לנצח', p: 'מתחרים על מחיר במקום על ערך. הלקוחות לא מבינים למה לשלם יותר כשכולם נראים אותו דבר.' },
              { n: '03', t: 'חכים להמלצה הבאה', p: 'חודש טוב, חודש גרוע. אין מנוע לידים שעובד גם כשאתה לא עובד.' },
            ].map((c, i) => (
              <SR key={c.n} delay={i * 0.1}>
                <div className="lp-problem-card">
                  <div className="lp-problem-num">{c.n}</div>
                  <h3>{c.t}</h3>
                  <p>{c.p}</p>
                </div>
              </SR>
            ))}
          </div>
        </div>
      </section>

      {/* FLYWHEEL */}
      <section className="lp-section" id="flywheel">
        <div className="lp-container">
          <SR><div className="lp-label">השיטה</div>
            <h2 className="lp-h2">ה<span className="accent">Boutique Studio of One™</span><br />Flywheel</h2>
            <p className="lp-body">ארבעה מנועים מחוברים. תוצאה אחת: עסק שגדל בלי שאתה תקוע בתוכו.</p>
          </SR>
          <div className="lp-fw-grid">
            {[
              { icon: '🎯', step: 'שלב 01', t: 'Attract Attention', p: 'מערכת שמושכת את האנשים הנכונים — בלי להסתמך על המלצות ומזל. תוכן שממצב אותך כמומחה.' },
              { icon: '🤝', step: 'שלב 02', t: 'Lead With Confidence', p: 'לאבחן בעיות, לשאול שאלות טובות יותר, ולהוביל תהליך מכירה — לא לשלוח הצעת מחיר ולחכות.' },
              { icon: '🔧', step: 'שלב 03', t: 'Run Profitable Projects', p: 'מערכות שמאפשרות לך לשלוט בתהליך ולהגן על הרווחיות — בלי revisions אינסופיות.' },
              { icon: '💎', step: 'שלב 04', t: 'Offer & Positioning', p: 'הצעה שלקוחות רוצים — כזו שמציבה אותך סביב תוצאות ולא deliverables.' },
            ].map((c, i) => (
              <SR key={c.t} delay={i * 0.1}>
                <div className="lp-fw-card">
                  <div className="lp-fw-icon">{c.icon}</div>
                  <div className="lp-fw-step">{c.step}</div>
                  <h3>{c.t}</h3>
                  <p>{c.p}</p>
                </div>
              </SR>
            ))}
          </div>
        </div>
      </section>

      <div className="lp-glow-line" />

      {/* PHASES */}
      <section className="lp-section" id="phases">
        <div className="lp-container">
          <SR><div className="lp-label">שלבי התוכנית</div>
            <h2 className="lp-h2">מה קורה בכל<br /><span className="accent">שלב בתוכנית?</span></h2>
            <p className="lp-body">תהליך מובנה ומוכח — ממקום שבו אתה היום ועד למקום שאתה רוצה להיות.</p>
          </SR>
          <div className="lp-phases">
            {[
              { n: 1, tag: 'שבועות 1–2', t: 'Ignite — הצתה', p: 'מניחים את הבסיס: מגדירים מיצוב, בונים הצעת ערך ברורה, ומכינים את כל הכלים שצריך.', pills: ['מיצוב', 'הצעת ערך', 'פרופיל מקצועי'] },
              { n: 2, tag: 'חודשים 2–4', t: 'Stabilise — יציבות', p: 'יוצרים זרם לידים קבוע, מייצרים תוכן שמוכר, ומתחילים לבנות מוניטין שמביא לקוחות.', pills: ['תוכן', 'צינור לידים', 'מכירות'] },
              { n: 3, tag: 'חודשים 4–6', t: 'Scale — צמיחה', p: 'מגדילים הכנסות, מעלים מחירים, ובונים מערכת שעובדת גם כשאתה לא.', pills: ['אוטומציה', 'הגדלת מחיר', 'מינוף'] },
            ].map((ph, i) => (
              <SR key={ph.n} delay={i * 0.1}>
                <div className="lp-phase">
                  <div className="lp-phase-line">
                    <div className="lp-phase-dot">{ph.n}</div>
                    {i < 2 && <div className="lp-phase-connector" />}
                  </div>
                  <div className="lp-phase-body">
                    <div className="lp-phase-tag">{ph.tag}</div>
                    <h3>{ph.t}</h3>
                    <p>{ph.p}</p>
                    <div className="lp-pills">{ph.pills.map(p => <span key={p} className="lp-pill">{p}</span>)}</div>
                  </div>
                </div>
              </SR>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="lp-section" id="about">
        <div className="lp-container">
          <div className="lp-about-grid">
            <div className="lp-about-text">
              <SR><div className="lp-label">מי אני</div>
                <h2 className="lp-h2">נייב מרציאנו —<br /><span className="accent">המוח מאחורי<br />Creative Expert™</span></h2>
              </SR>
              <SR delay={0.1}>
                <p>התחלתי כמעצב פרילנסר בלי שום מושג איך לנהל עסק — רק כישרון וחלום. עבדתי עם לקוחות קטנים ששלטו בתהליך, שלטו בזמן שלי, וגרמו לי למצוקה. לקחתי כל פרויקט שהגיע כי לא ידעתי מאיפה יגיע הבא.</p>
                <p>הבנתי שהמעצבים שמרוויחים הכי הרבה לא היו בהכרח הכי טובים בעיצוב — הם היו הכי טובים בפתרון בעיות. עצרתי לנסות להיות הכל לכולם, התמקדתי בברנדינג ואסטרטגיה, ולמדתי שיווק, מכירות, ועסקים.</p>
                <p>היום אני מרוויח ₪300K–₪350K+ בשנה, עובד עם לקוחות שאני נהנה לעזור להם, ומנהל עסק שנותן לי חופש במקום לקחת אותו.</p>
              </SR>
              <SR delay={0.2}>
                <div className="lp-cred-boxes">
                  <div className="lp-cred-box"><div className="lp-cred-box-num">10+</div><div className="lp-cred-box-lbl">שנות ניסיון בעיצוב ועסקים</div></div>
                  <div className="lp-cred-box"><div className="lp-cred-box-num">200+</div><div className="lp-cred-box-lbl">מעצבים שעברו דרכי</div></div>
                  <div className="lp-cred-box"><div className="lp-cred-box-num">₪350K+</div><div className="lp-cred-box-lbl">הכנסה שנתית בעסק שלי</div></div>
                  <div className="lp-cred-box"><div className="lp-cred-box-num">94%</div><div className="lp-cred-box-lbl">שביעות רצון בוגרים</div></div>
                </div>
              </SR>
            </div>
            <SR delay={0.1}>
              <div className="lp-about-img">
                <div className="lp-about-img-ph">📸 הוסף תמונה שלך כאן<br /><br /><code style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.2)' }}>&lt;img src="/profile.jpg"/&gt;</code></div>
              </div>
            </SR>
          </div>
        </div>
      </section>

      <div className="lp-glow-line" />

      {/* INCLUDED */}
      <section className="lp-section">
        <div className="lp-container">
          <SR><div className="lp-label">מה כלול</div>
            <h2 className="lp-h2">הכל מה שאתה צריך<br /><span className="accent">בתוך תוכנית אחת.</span></h2>
          </SR>
          <div className="lp-inc-grid">
            {[
              { t: 'ליווי אישי 1:1', d: 'שיחת ביצועים אישית כל חודש — ממוקדת, מעשית, תוצאות.' },
              { t: 'קהילה סגורה', d: 'גישה לקבוצה עם כל הבוגרים — שיתוף, תמיכה ואנרגיה.' },
              { t: 'קריאות קבוצתיות חיות', d: '8–9 קריאות בחודש על נושאים מתקדמים.' },
              { t: 'תבניות ומסמכים', d: 'הצעות מחיר, חוזים, תסריטי מכירה — הכל מוכן לשימוש מיידי.' },
              { t: 'כלי AI מותאמים', d: 'סוכני AI שחוסכים שעות עבודה בכל שבוע.' },
              { t: 'מאמן AI 24/7', d: 'גישה מיידית לשאלות בין הקריאות — ללא המתנה.' },
            ].map((item, i) => (
              <SR key={item.t} delay={(i % 2) * 0.1}>
                <div className="lp-inc-item">
                  <div className="lp-inc-check">✓</div>
                  <div><strong>{item.t}</strong><span>{item.d}</span></div>
                </div>
              </SR>
            ))}
          </div>
        </div>
      </section>

      {/* SLACK WINS */}
      <section className="lp-section">
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <SR><div className="lp-label" style={{ justifyContent: 'center' }}>ניצחונות בקהילה</div>
            <h2 className="lp-h2">מה קורה<br /><span className="accent">בפנים כל יום?</span></h2>
          </SR>
          <SR delay={0.1}><SlackFeed /></SR>
        </div>
      </section>

      <div className="lp-glow-line" />

      {/* IS THIS FOR YOU */}
      <section className="lp-section">
        <div className="lp-container">
          <SR style={{ textAlign: 'center' }}>
            <div className="lp-label" style={{ justifyContent: 'center' }}>זה בשבילך?</div>
            <h2 className="lp-h2">מי <span className="accent">כן</span> מתאים — ומי לא.</h2>
          </SR>
          <SR delay={0.1}>
            <div className="lp-fit-grid">
              <div className="lp-fit-card yes">
                <div className="lp-fit-title yes">✓ מתאים אם...</div>
                <div className="lp-fit-list">
                  {['מעצב/ת מנוסה שמרוויח/ה ₪5K–₪15K בחודש', 'רוצה לגבות מחירי פרמיה בלי להצטדק', 'מוכן/ה לבנות מערכת — לא רק לקבל טיפים', 'רוצה חופש, יציבות ושליטה על העסק', 'גמר/ה עם תירוצים'].map(f => (
                    <div key={f} className="lp-fit-item"><span className="lp-fit-check yes">✓</span>{f}</div>
                  ))}
                </div>
              </div>
              <div className="lp-fit-card no">
                <div className="lp-fit-title no">✗ לא מתאים אם...</div>
                <div className="lp-fit-list">
                  {['מתחיל/ת ללא ניסיון בעיצוב', 'מחפש/ת קיצורי דרך ופתרונות מהירים', 'לא מוכן/ה להשקיע זמן ומאמץ', 'כבר מרוויח/ה מעל ₪50K בחודש'].map(f => (
                    <div key={f} className="lp-fit-item"><span className="lp-fit-check no">✗</span>{f}</div>
                  ))}
                </div>
              </div>
            </div>
          </SR>
        </div>
      </section>

      {/* CASE STUDIES */}
      <section className="lp-section">
        <div className="lp-container">
          <SR><div className="lp-label">סיפורי הצלחה</div>
            <h2 className="lp-h2">תוצאות <span className="accent">אמיתיות</span><br />מבוגרים אמיתיים.</h2>
            <p className="lp-body">אף אחד מהם לא הפך למעצב טוב יותר. הם הפכו לבעל עסק טוב יותר.</p>
          </SR>
          <div className="lp-cases-grid">
            {CASES.map((c, i) => (
              <SR key={c.name + i} delay={(i % 3) * 0.1}>
                <div className="lp-case-card">
                  <div className="lp-case-thumb">
                    <div className="lp-case-av">{c.av}</div>
                  </div>
                  <div className="lp-case-info">
                    <div className="lp-case-name">{c.name}</div>
                    <div className="lp-case-role">{c.role}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="lp-case-before">{c.before}</span>
                      <span className="lp-case-arrow">→</span>
                      <span className="lp-case-after">{c.after}</span>
                    </div>
                  </div>
                </div>
              </SR>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="lp-section" id="testimonials">
        <div className="lp-container">
          <SR><div className="lp-label">עדויות</div>
            <h2 className="lp-h2">מה אומרים<br /><span className="accent">בוגרי התוכנית.</span></h2>
          </SR>
          <div className="lp-testi-grid">
            {TESTIMONIALS.map((t, i) => (
              <SR key={t.name} delay={i * 0.1}>
                <div className="lp-testi-card">
                  <div className="lp-testi-stars">{'★'.repeat(t.stars)}</div>
                  <p>{t.text}</p>
                  <div className="lp-testi-author">
                    <div className="lp-testi-av">{t.av}</div>
                    <div><div className="lp-testi-name">{t.name}</div><div className="lp-testi-role">{t.role}</div></div>
                  </div>
                </div>
              </SR>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section">
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <SR><div className="lp-label" style={{ justifyContent: 'center' }}>שאלות נפוצות</div>
            <h2 className="lp-h2">יש לך שאלה?<br /><span className="accent">כנראה יש לנו תשובה.</span></h2>
          </SR>
          <SR delay={0.1}><FAQ /></SR>
        </div>
      </section>

      <div className="lp-glow-line" />

      {/* GUARANTEE */}
      <section className="lp-section">
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <SR><div className="lp-label" style={{ justifyContent: 'center' }}>הערבות שלנו</div>
            <h2 className="lp-h2">אם לא תעשה את העבודה,<br /><span className="accent">לא תקבל את התוצאה.</span></h2>
          </SR>
          <SR delay={0.1}>
            <div className="lp-guarantee">
              <div className="lp-guarantee-icon">🤝</div>
              <h3>ערבות ביצועים — לא ביטוח עצלות</h3>
              <p>
                אנחנו לא מבטיחים תוצאות לאנשים שלא עושים את העבודה — כי זה לא הוגן ולא אמיתי.
                מה שאנחנו <em>כן</em> מבטיחים: אם תעשה את מה שנבנה יחד, תעקוב אחרי התהליך,
                ותישאר מחויב — נהיה שם איתך כל הדרך עד שתגיע ליעד.
                אם לא ראית תוצאה אחרי 90 יום של עבודה מלאה, נמשיך ללא עלות נוספת.
              </p>
            </div>
          </SR>
        </div>
      </section>

      <div className="lp-glow-line" />

      {/* PRICING */}
      <section className="lp-section" id="pricing">
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <SR><div className="lp-label" style={{ justifyContent: 'center' }}>ההשקעה</div>
            <h2 className="lp-h2">מוכן להמריא?<br /><span className="accent">זה מה שזה עולה.</span></h2>
          </SR>
          <SR delay={0.1}>
            <div className="lp-pricing-card">
              <div className="lp-pricing-plan">Boutique Studio of One™ — Pilot Edition</div>
              <div className="lp-pricing-price">₪X,XXX</div>
              <div className="lp-pricing-note">✏️ תשלום חד-פעמי / חודשי</div>
              <div className="lp-pricing-divider" />
              <div className="lp-pricing-features">
                {['ליווי אישי 1:1 חודשי', 'קהילה סגורה', 'קריאות קבוצתיות חיות', 'תבניות ומסמכים מוכנים', 'כלי AI מותאמים', 'מאמן AI 24/7'].map(f => (
                  <div key={f} className="lp-pf">{f}</div>
                ))}
              </div>
              <a href="#" className="lp-btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 50, fontSize: '1.05rem', padding: '18px' }}>
                אני רוצה להצטרף ←
              </a>
            </div>
          </SR>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-final">
        <div className="lp-container">
          <SR><div className="lp-final-spots"><span className="dot" />נותרו 3 מקומות בלבד</div>
            <h2 className="lp-h2">הגיע הזמן להמר<br />על <span className="accent">עצמך.</span></h2>
          </SR>
          <SR delay={0.1}>
            <p className="lp-body" style={{ margin: '0 auto 32px' }}>מתאים אם אתה עונה על כל אלה:</p>
            <div className="lp-checklist">
              {[
                'מעצב/ת עצמאי/ת עם ניסיון ולקוחות קיימים',
                'מרוויח/ה ₪5K–₪15K בחודש ורוצה להגיע ל-₪20K–₪30K+',
                'יש לך קיבולת ללקוחות חדשים',
                'מוכן/ה לעבוד 5–8 שעות בשבוע על הבניית העסק',
                'מחפש/ת ליווי אמיתי — לא עוד קורס מוקלט',
              ].map(item => <div key={item} className="lp-checklist-item">{item}</div>)}
            </div>
          </SR>
          <SR delay={0.2} style={{ marginTop: 48 }}>
            <a href="#pricing" className="lp-btn-primary" style={{ fontSize: '1.1rem', padding: '20px 52px' }}>הגש מועמדות עכשיו ←</a>
            <div className="lp-apply-steps">
              <div className="lp-apply-step">
                <div className="lp-apply-step-num">1</div>
                <div className="lp-apply-step-text">לחץ על הכפתור ומלא פרטים קצרים</div>
              </div>
              <div className="lp-apply-step">
                <div className="lp-apply-step-num">2</div>
                <div className="lp-apply-step-text">שלח הודעה בInsta — "מוכן"</div>
              </div>
              <div className="lp-apply-step">
                <div className="lp-apply-step-num">3</div>
                <div className="lp-apply-step-text">נקבע שיחת היכרות — זה הכל</div>
              </div>
            </div>
          </SR>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-container">
          <span className="lp-footer-logo">Creative Expert™</span>
          <p>© 2025 Creative Expert 3.0™ — כל הזכויות שמורות</p>
          <div className="lp-footer-links">
            <a href="#">פרטיות</a>
            <a href="#">תנאי שימוש</a>
            <a href="#">צור קשר</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
