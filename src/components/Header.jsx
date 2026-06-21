import { useState, useEffect, useRef } from 'react';
import { Menu, PanelLeftClose, Bell, AlertCircle, Clock, X, Wrench, User, ExternalLink, ChevronLeft, Plus, Trash2, Pencil, ToggleLeft, ToggleRight, Flame } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useUser, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { usePaymentAlerts } from '../hooks/usePaymentAlerts.js';
import { useNpsAlerts }     from '../hooks/useNpsAlerts.js';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

function fmtAmt(n)  { return n ? '₪' + Number(n).toLocaleString('he-IL') : ''; }
function fmtDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }); }

// ── Alert row ──────────────────────────────────────────────────
function AlertRow({ item, type, onDismiss }) {
  const isOverdue = type === 'overdue';
  const color = isOverdue ? '#ef4444' : '#f97316';
  const daysLabel = isOverdue
    ? `${Math.abs(item.diff)} י׳ באיחור`
    : item.diff === 0 ? 'היום!' : `${item.diff} ימים`;
  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="h-2 w-2 rounded-full flex-none" style={{ background: color, boxShadow: isOverdue ? `0 0 6px ${color}55` : 'none' }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{item.clientName}</div>
        <div className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {item.label}{item.amount ? ` · ${fmtAmt(item.amount)}` : ''}{' · '}{fmtDate(item.due)}
        </div>
      </div>
      <div className="text-[11px] font-bold flex-none" style={{ color, minWidth: 52 }}>{daysLabel}</div>
      <button onClick={e => { e.stopPropagation(); onDismiss(item); }}
        className="flex-none rounded-full p-1 transition-all"
        style={{ color: 'rgba(255,255,255,0.2)' }}
        onMouseEnter={e => { e.currentTarget.style.color='rgba(255,255,255,0.7)'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.2)'; e.currentTarget.style.background='transparent'; }}>
        <X size={13} />
      </button>
    </div>
  );
}

// ── NPS alert row ──────────────────────────────────────────────
function NpsAlertRow({ item, onDismiss }) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="h-2 w-2 rounded-full flex-none" style={{ background: '#ef4444', boxShadow: '0 0 6px #ef444455' }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{item.name}</div>
        <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>NPS {item.nps}/10 · {item.month}</div>
      </div>
      <span className="text-[11px] font-bold flex-none rounded-md px-2 py-0.5"
        style={{ background: 'rgba(239,68,68,0.18)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}>
        ⚠️ {item.nps}
      </span>
      <button onClick={e => { e.stopPropagation(); onDismiss(item.id); }}
        className="flex-none rounded-full p-1 transition-all"
        style={{ color: 'rgba(255,255,255,0.2)' }}
        onMouseEnter={e => { e.currentTarget.style.color='rgba(255,255,255,0.7)'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.2)'; e.currentTarget.style.background='transparent'; }}>
        <X size={13} />
      </button>
    </div>
  );
}

// ── Notification panel ─────────────────────────────────────────
function NotificationPanel({ upcoming, overdue, onDismiss, npsAlerts, dismissNps }) {
  const payTotal = upcoming.length + overdue.length;
  const total    = payTotal + npsAlerts.length;
  return (
    <div className="absolute right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl"
      style={{ width: 340, maxWidth: 'calc(100vw - 1rem)', background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.65)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-sm font-bold text-white">התראות</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{total === 0 ? 'הכל תקין ✓' : `${total} התראות`}</span>
      </div>
      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <span style={{ fontSize: 28 }}>🎉</span>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.32)' }}>אין התראות פתוחות</span>
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {/* NPS נמוך */}
          {npsAlerts.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444' }}>
                <AlertCircle size={11} /> NPS נמוך — {npsAlerts.length}
              </div>
              {npsAlerts.map(item => <NpsAlertRow key={item.id} item={item} onDismiss={dismissNps} />)}
            </>
          )}
          {/* תשלומים באיחור */}
          {overdue.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444' }}>
                <AlertCircle size={11} /> תשלומים באיחור — {overdue.length}
              </div>
              {overdue.map((item, i) => <AlertRow key={i} item={item} type="overdue" onDismiss={onDismiss} />)}
            </>
          )}
          {/* קרוב לפירעון */}
          {upcoming.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(249,115,22,0.07)', color: '#f97316' }}>
                <Clock size={11} /> קרוב לפירעון — {upcoming.length}
              </div>
              {upcoming.map((item, i) => <AlertRow key={i} item={item} type="upcoming" onDismiss={onDismiss} />)}
            </>
          )}
        </div>
      )}
      {total > 0 && (
        <div className="px-4 py-2.5 text-center text-[10px]"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' }}>
          ✕ לחיצה על X מסמנת כטופל
        </div>
      )}
    </div>
  );
}

// ── Tools config (localStorage) ───────────────────────────────
const TOOLS_DEFAULT = [
  { id:1, label:'מחשבון תמחור', icon:'🧮', href:'/pricing-calculator', internal:true,  enabled:true },
  { id:2, label:'ספריית תכנים', icon:'📚', href:'/content-library',    internal:true,  enabled:true },
  { id:3, label:'AI ScaleKit',  icon:'🤖', href:'/ai-scalekit',        internal:true,  enabled:true },
  { id:4, label:'תמלול ריילס', icon:'🎙️', href:'/transcriptions',     internal:true,  enabled:true },
];
const TOOLS_KEY = 'header_tools_config';
function loadTools() {
  try { return JSON.parse(localStorage.getItem(TOOLS_KEY)) || TOOLS_DEFAULT; }
  catch { return TOOLS_DEFAULT; }
}
function saveTools(t) { localStorage.setItem(TOOLS_KEY, JSON.stringify(t)); }

// ── Daily Standard ─────────────────────────────────────────────
const DAILY_ITEMS = [
  { id: 'steps',   emoji: '🧠', label: '10,000 צעדים' },
  { id: 'reading', emoji: '📚', label: '10 עמודים בספר' },
  { id: 'soul',    emoji: '🧘', label: '20 דק׳ לנפש' },
  { id: 'goals',   emoji: '🎯', label: 'מטרות — 3 פעמים' },
  { id: 'content', emoji: '📲', label: '100 דק׳ תוכן' },
  { id: 'outreach',emoji: '🤝', label: '30 דק׳ פניות יזומות' },
];

function todayKey() { return 'daily_' + new Date().toISOString().slice(0, 10); }

function loadDaily() {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function loadStreak() {
  try { return JSON.parse(localStorage.getItem('daily_streak') || '{"count":0,"last":""}'); }
  catch { return { count: 0, last: '' }; }
}

const LEVELS = [
  { v: 0, label: '',        dot: 'rgba(255,255,255,0.12)' },
  { v: 1, label: 'קצת',    dot: '#f97316' },
  { v: 2, label: 'הרבה',   dot: '#F5C118' },
  { v: 3, label: 'מושלם',  dot: '#4ade80' },
];

function DailyPanel({ onClose }) {
  const [scores, setScores] = useState(loadDaily);
  const [streak, setStreak] = useState(loadStreak);

  function cycle(id) {
    setScores(prev => {
      const next = { ...prev, [id]: ((prev[id] || 0) + 1) % 4 };
      localStorage.setItem(todayKey(), JSON.stringify(next));
      const allDone = DAILY_ITEMS.every(i => (next[i.id] || 0) > 0);
      const today = new Date().toISOString().slice(0, 10);
      if (allDone && streak.last !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const newStreak = { count: streak.last === yesterday ? streak.count + 1 : 1, last: today };
        setStreak(newStreak);
        localStorage.setItem('daily_streak', JSON.stringify(newStreak));
      }
      return next;
    });
  }

  const totalScore  = DAILY_ITEMS.reduce((s, i) => s + (scores[i.id] || 0), 0);
  const maxScore    = DAILY_ITEMS.length * 3;
  const pct         = Math.round((totalScore / maxScore) * 100);
  const allDone     = DAILY_ITEMS.every(i => (scores[i.id] || 0) > 0);
  const allPerfect  = DAILY_ITEMS.every(i => scores[i.id] === 3);
  const barColor    = pct >= 100 ? '#4ade80' : pct >= 60 ? '#F5C118' : '#f97316';

  return (
    <div className="absolute left-0 top-full mt-2 z-50 rounded-2xl overflow-hidden" dir="rtl"
      style={{ width: 270, background: 'rgb(var(--bg-elevated))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.65)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>סטנדרט יומי</p>
          {streak.count > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: '#F5C118' }}>
              <Flame size={11} /> {streak.count}
            </span>
          )}
        </div>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: pct === 0 ? 'rgba(255,255,255,0.2)' : barColor }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: barColor }} />
      </div>

      {/* Items */}
      <div className="py-1.5">
        {DAILY_ITEMS.map(item => {
          const v     = scores[item.id] || 0;
          const level = LEVELS[v];
          return (
            <button key={item.id} onClick={() => cycle(item.id)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-right transition hover:bg-white/[0.04]">
              {/* Dot */}
              <div className="flex-none h-2.5 w-2.5 rounded-full transition-all" style={{ background: level.dot, boxShadow: v === 3 ? '0 0 6px #4ade8088' : 'none' }} />
              {/* Label */}
              <span className="flex-1 text-sm" style={{ color: v > 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)' }}>
                {item.emoji} {item.label}
              </span>
              {/* Level badge */}
              {v > 0 && (
                <span className="text-[10px] font-semibold rounded-md px-1.5 py-0.5 flex-none" style={{ background: level.dot + '22', color: level.dot }}>
                  {level.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      {allDone && (
        <div className="px-4 py-2.5 text-center text-xs font-semibold" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: allPerfect ? '#4ade80' : '#F5C118' }}>
          {allPerfect ? '🔥 יום מושלם!' : '✅ סיימת את הסטנדרט היומי'}
        </div>
      )}
    </div>
  );
}

function ToolsPanel({ onClose, isAdmin }) {
  const [tools,      setTools]      = useState(loadTools);
  const [editingId,  setEditingId]  = useState(null);
  const [editMode,   setEditMode]   = useState(false);
  const [draft,      setDraft]      = useState({});
  const [addingNew,  setAddingNew]  = useState(false);
  const [newItem,    setNewItem]    = useState({ label:'', icon:'🔗', href:'', internal:false });

  function persist(updated) { setTools(updated); saveTools(updated); }
  function toggle(id)       { persist(tools.map(t => t.id===id ? {...t, enabled:!t.enabled} : t)); }
  function remove(id)       { persist(tools.filter(t => t.id!==id)); }
  function startEdit(t)     { setEditingId(t.id); setDraft({label:t.label,icon:t.icon,href:t.href}); }
  function saveEdit(id)     { persist(tools.map(t => t.id===id ? {...t,...draft} : t)); setEditingId(null); }
  function addTool()        {
    if (!newItem.label.trim() || !newItem.href.trim()) return;
    persist([...tools, { ...newItem, id: Date.now(), enabled: true }]);
    setNewItem({ label:'', icon:'🔗', href:'', internal:false }); setAddingNew(false);
  }

  const visible = editMode ? tools : tools.filter(t => t.enabled);
  const inp = { background:'rgba(255,255,255,0.08)', border:'1px solid rgba(245,193,24,0.4)', borderRadius:6, padding:'3px 8px', fontSize:12, color:'white', outline:'none', fontFamily:'inherit', width:'100%' };

  return (
    <div className="absolute left-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
      style={{ width: 280, background:'rgb(var(--bg-elevated))', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 20px 60px rgba(0,0,0,0.65)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.35)' }}>כלי עבודה</p>
        {isAdmin && (
          <button onClick={() => setEditMode(e => !e)}
            className="flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-0.5 transition hover:bg-white/10"
            style={{ color: editMode ? '#F5C118' : 'rgba(255,255,255,0.4)', border:`1px solid ${editMode?'rgba(245,193,24,0.3)':'rgba(255,255,255,0.1)'}` }}>
            <Pencil size={10} /> {editMode ? 'סיום' : 'ערוך'}
          </button>
        )}
      </div>

      {/* Tools list */}
      <div className="py-1">
        {visible.map(t => (
          <div key={t.id} className="flex items-center gap-2 px-3 py-2 group hover:bg-white/04 transition-colors">
            {editMode && (
              <button onClick={() => toggle(t.id)} style={{ color: t.enabled?'#F5C118':'rgba(255,255,255,0.25)', flexShrink:0, background:'none', border:'none', cursor:'pointer', display:'flex', padding:0 }}>
                {t.enabled ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
              </button>
            )}

            {editingId === t.id ? (
              <div className="flex-1 space-y-1.5 py-0.5">
                <div className="flex gap-1.5">
                  <input value={draft.icon} onChange={e=>setDraft(d=>({...d,icon:e.target.value}))} style={{...inp,width:36}} />
                  <input value={draft.label} onChange={e=>setDraft(d=>({...d,label:e.target.value}))} placeholder="שם" style={inp} />
                </div>
                <input value={draft.href} onChange={e=>setDraft(d=>({...d,href:e.target.value}))} placeholder="קישור או /נתיב" style={inp} dir="ltr" />
                <div className="flex gap-1.5 justify-end">
                  <button onClick={()=>setEditingId(null)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:11}}>ביטול</button>
                  <button onClick={()=>saveEdit(t.id)} style={{background:'#F5C118',border:'none',borderRadius:5,cursor:'pointer',color:'#13152A',fontSize:11,fontWeight:700,padding:'2px 10px'}}>שמור</button>
                </div>
              </div>
            ) : (
              <>
                {t.internal ? (
                  <NavLink to={t.href} onClick={onClose}
                    className="flex items-center gap-2.5 flex-1 text-sm"
                    style={{ color: t.enabled?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.3)', textDecoration:'none' }}>
                    <span style={{fontSize:15}}>{t.icon}</span>
                    <span>{t.label}</span>
                    {!editMode && <ChevronLeft size={12} className="mr-auto opacity-25"/>}
                  </NavLink>
                ) : (
                  <a href={t.href} target="_blank" rel="noopener noreferrer" onClick={onClose}
                    className="flex items-center gap-2.5 flex-1 text-sm"
                    style={{ color: t.enabled?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.3)', textDecoration:'none' }}>
                    <span style={{fontSize:15}}>{t.icon}</span>
                    <span>{t.label}</span>
                    {!editMode && <ExternalLink size={11} className="mr-auto opacity-25"/>}
                  </a>
                )}

                {editMode && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={()=>startEdit(t)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',display:'flex',padding:2}} title="ערוך">
                      <Pencil size={11}/>
                    </button>
                    <button onClick={()=>remove(t.id)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(252,165,165,0.5)',display:'flex',padding:2}} title="מחק">
                      <Trash2 size={11}/>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {/* Add new — admin edit mode */}
        {editMode && isAdmin && (
          addingNew ? (
            <div className="px-3 py-2 space-y-1.5" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex gap-1.5">
                <input value={newItem.icon} onChange={e=>setNewItem(n=>({...n,icon:e.target.value}))} style={{...inp,width:36}} />
                <input value={newItem.label} onChange={e=>setNewItem(n=>({...n,label:e.target.value}))} placeholder="שם הכלי" style={inp} />
              </div>
              <input value={newItem.href} onChange={e=>setNewItem(n=>({...n,href:e.target.value}))} placeholder="https://... או /נתיב" style={inp} dir="ltr" />
              <div className="flex gap-1.5 justify-end">
                <button onClick={()=>setAddingNew(false)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:11}}>ביטול</button>
                <button onClick={addTool} style={{background:'#F5C118',border:'none',borderRadius:5,cursor:'pointer',color:'#13152A',fontSize:11,fontWeight:700,padding:'2px 10px'}}>הוסף</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setAddingNew(true)}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-xs transition hover:bg-white/05"
              style={{ color:'rgba(255,255,255,0.35)', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <Plus size={13}/> הוסף כלי
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Profile icon ───────────────────────────────────────────────
function ProfileAvatar() {
  return (
    <NavLink to="/settings"
      className="rounded-md p-2 hover:bg-white/10 transition-colors"
      style={({ isActive }) => ({ color: isActive ? '#F5C118' : 'rgba(255,255,255,0.75)' })}
      title="פרופיל">
      <User size={18} />
    </NavLink>
  );
}

// ── Header ─────────────────────────────────────────────────────
export default function Header({ onToggleCollapse, onOpenMobile }) {
  const { user } = useUser();
  const isAdmin = user?.id === ADMIN_ID;
  const [bellOpen,  setBellOpen]  = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const bellRef  = useRef(null);
  const toolsRef = useRef(null);
  const dailyRef = useRef(null);

  const { upcoming, overdue, total: payTotal, dismiss, reload } = usePaymentAlerts();
  const { npsAlerts, dismissNps, npsTotal } = useNpsAlerts();
  const total      = payTotal + npsTotal;
  const hasOverdue = overdue.length > 0 || npsTotal > 0;
  const badgeColor = hasOverdue ? '#ef4444' : '#f97316';

  useEffect(() => { if (bellOpen) reload(); }, [bellOpen]);

  useEffect(() => {
    function handle(e) {
      if (bellRef.current  && !bellRef.current.contains(e.target))  setBellOpen(false);
      if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false);
      if (dailyRef.current && !dailyRef.current.contains(e.target)) setDailyOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 flex-none items-center gap-3 px-4 sm:px-6"
      style={{ background: 'rgb(var(--bg-chrome))', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>

      {/* Mobile hamburger */}
      <button type="button" onClick={onOpenMobile}
        className="rounded-md p-2 md:hidden hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.75)' }}>
        <Menu size={20} />
      </button>

      {/* Desktop: collapse sidebar */}
      <button type="button" onClick={onToggleCollapse}
        className="hidden rounded-md p-2 md:inline-flex hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.75)' }}>
        <PanelLeftClose size={20} />
      </button>

      {/* ── Bell — ליד כפתורי הניווט ── */}
      <div ref={bellRef} className="relative">
        <button type="button" onClick={() => setBellOpen(o => !o)}
          className="relative rounded-md p-2 hover:bg-white/10 transition-colors"
          style={{ color: total > 0 ? badgeColor : 'rgba(255,255,255,0.75)' }}>
          <Bell size={18} className={total > 0 ? 'bell-ring' : ''} />
          {total > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none${hasOverdue ? ' badge-pulse' : ''}`}
              style={{ background: badgeColor, color: 'white' }}>
              {total}
            </span>
          )}
        </button>
        {bellOpen && <NotificationPanel upcoming={upcoming} overdue={overdue} onDismiss={dismiss} npsAlerts={npsAlerts} dismissNps={dismissNps} />}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="flex items-center gap-2">

        {/* ── Daily Standard (flame) ── */}
        <div ref={dailyRef} className="relative">
          <button type="button" onClick={() => { setDailyOpen(o => !o); setToolsOpen(false); }}
            className="rounded-md p-2 hover:bg-white/10 transition-colors"
            style={{ color: dailyOpen ? '#F5C118' : 'rgba(255,255,255,0.75)' }}
            title="סטנדרט יומי">
            <Flame size={18} />
          </button>
          {dailyOpen && <DailyPanel onClose={() => setDailyOpen(false)} />}
        </div>

        {/* ── Tools (wrench) ── */}
        <div ref={toolsRef} className="relative">
          <button type="button" onClick={() => { setToolsOpen(o => !o); setDailyOpen(false); }}
            className="rounded-md p-2 hover:bg-white/10 transition-colors"
            style={{ color: toolsOpen ? '#F5C118' : 'rgba(255,255,255,0.75)' }}
            title="כלי עבודה">
            <Wrench size={18} />
          </button>
          {toolsOpen && <ToolsPanel onClose={() => setToolsOpen(false)} isAdmin={isAdmin} />}
        </div>

        {/* ── Profile avatar → Settings ── */}
        <SignedIn>
          <ProfileAvatar user={user} />
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>

      </div>
    </header>
  );
}
