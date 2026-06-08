import { useState, useRef, useEffect, useCallback } from 'react';
import { useIsAdmin } from '../hooks/useIsAdmin.js';
import { supabase } from '../lib/supabase.js';
import { ExternalLink, Camera, X, Move, Pencil, Check, Link, Loader } from 'lucide-react';

// ── Compress image file → JPEG Blob ───────────────────────────
function compressImageToBlob(file, maxWidth = 1400, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio  = Math.min(maxWidth / img.width, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// ── Level definitions ─────────────────────────────────────────
const LEVELS = [
  {
    key: 'level-0', badge: '0', name: 'ברוכים הבאים', dot: '⚪',
    description: 'היכרות עם התוכנית',
    bg: '#a8b4c0', groundGrass: '#4a8a2a', groundDirt: '#7a5020', type: 'game',
    scene: [
      { e: '✈️', top: '22%', right: '50%', size: 52, flip: true },
      { e: '☁️', top: '8%',  left: '4%',   size: 28, opacity: 0.85 },
      { e: '☁️', top: '5%',  left: '28%',  size: 22, opacity: 0.65 },
      { e: '🟫', top: '35%', right: '20%', size: 30 },
      { e: '❓', top: '35%', right: '32%', size: 30 },
    ], url: '#',
  },
  {
    key: 'level-1', badge: '1', name: 'החזון', dot: '🔴',
    description: 'עיצוב העתיד שלכם',
    bg: '#c44040', groundGrass: '#3a7a28', groundDirt: '#6a4018', type: 'game',
    scene: [
      { e: '✈️', top: '20%', left: '30%',  size: 56, flip: true },
      { e: '❓', top: '32%', right: '16%', size: 30 },
      { e: '🟫', top: '32%', right: '28%', size: 30 },
      { e: '❓', top: '22%', right: '12%', size: 26 },
    ], url: '#',
  },
  {
    key: 'level-2', badge: '2', name: 'המודל', dot: '🟠',
    description: 'היכרות עם המודל בתוכנית',
    bg: '#c87c40', groundGrass: '#4a7a28', groundDirt: '#7a5820', type: 'game',
    scene: [
      { e: '✈️', top: '28%', left: '28%',  size: 54, flip: true },
      { e: '☁️', top: '6%',  left: '22%',  size: 26, opacity: 0.9 },
      { e: '☁️', top: '4%',  right: '10%', size: 30, opacity: 0.85 },
      { e: '❓', top: '48%', right: '28%', size: 28 },
      { e: '❓', top: '48%', right: '16%', size: 28 },
      { e: '🟫', top: '65%', right: '10%', size: 30 },
    ], url: '#',
  },
  {
    key: 'level-3', badge: '3', name: 'לספק', dot: '🟡',
    description: 'ליצור תוצאות שהופכות להוכחות',
    bg: '#d4a020', groundGrass: '#3a7a28', groundDirt: '#6a4818', type: 'game',
    scene: [
      { e: '✈️', top: '18%', left: '8%',   size: 52, flip: true },
      { e: '☁️', top: '4%',  left: '30%',  size: 30, opacity: 0.9 },
      { e: '☁️', top: '8%',  right: '8%',  size: 26, opacity: 0.85 },
      { e: '❓', top: '38%', right: '22%', size: 26 },
      { e: '🟫', top: '38%', right: '10%', size: 26 },
      { e: '⭐', top: '52%', right: '18%', size: 28 },
      { e: '🍄', top: '56%', left: '32%',  size: 24 },
    ], url: '#',
  },
  {
    key: 'sprint', badge: null, name: 'ספרינט 10K', dot: '💰',
    description: 'הפורמולה לכסף בחשבון',
    bg: '#d8dce0', type: 'character', character: '💰', charSize: 80, url: '#',
  },
  {
    key: 'level-4', badge: '4', name: 'לבלוט', dot: '🟢',
    description: 'למשוך תשומת לב ולהשיג פניות קבועות',
    bg: '#5c9e28', groundGrass: '#4a8820', groundDirt: '#6a4818', type: 'game',
    scene: [
      { e: '✈️', top: '14%', right: '28%', size: 54, flip: false },
      { e: '☁️', top: '5%',  left: '6%',   size: 28, opacity: 0.9 },
      { e: '☁️', top: '22%', left: '34%',  size: 24, opacity: 0.85 },
      { e: '☁️', top: '6%',  right: '4%',  size: 24, opacity: 0.7 },
      { e: '🍄', top: '52%', left: '36%',  size: 26 },
      { e: '❓', top: '56%', left: '20%',  size: 26 },
      { e: '❓', top: '56%', left: '34%',  size: 26 },
    ], url: '#',
  },
  {
    key: 'level-5', badge: '5', name: 'להוביל', dot: '🔵',
    description: 'לבנות סמכות ומנהיגות בתחום',
    bg: '#4a8fd4', groundGrass: '#3a7a28', groundDirt: '#6a4018', type: 'game',
    scene: [
      { e: '✈️', top: '20%', left: '12%',  size: 56, flip: true },
      { e: '☁️', top: '5%',  left: '5%',   size: 26, opacity: 0.9 },
      { e: '☁️', top: '8%',  left: '35%',  size: 30, opacity: 0.85 },
      { e: '☁️', top: '4%',  right: '6%',  size: 22, opacity: 0.75 },
      { e: '🍄', top: '46%', right: '16%', size: 28 },
      { e: '❓', top: '54%', right: '30%', size: 26 },
      { e: '🟫', top: '54%', right: '16%', size: 26 },
    ], url: '#',
  },
  {
    key: 'level-6', badge: '6', name: 'לשלוט', dot: '🟣',
    description: 'לשלוט בשוק ולהפוך לאוטוריטה',
    bg: '#8848b8', groundGrass: '#3a7a28', groundDirt: '#6a4018', type: 'game',
    scene: [
      { e: '✈️', top: '42%', left: '8%',   size: 52, flip: true },
      { e: '❓', top: '18%', left: '28%',  size: 26 },
      { e: '🟫', top: '18%', left: '40%',  size: 26 },
      { e: '❓', top: '32%', left: '32%',  size: 28 },
      { e: '❓', top: '32%', left: '44%',  size: 28 },
      { e: '🏗️', top: '14%', right: '6%',  size: 52 },
    ], url: '#',
  },
  {
    key: 'level-7', badge: '7', name: 'AI & Systems', dot: '🤖',
    description: 'אוטומציה ומערכות לצמיחה',
    bg: '#d8dce0', type: 'character', character: '🤖', charSize: 76, url: '#',
  },
];

// ── Ground strip ──────────────────────────────────────────────
function GroundStrip({ grass, dirt }) {
  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: 28 }}>
      <div className="flex" style={{ height: 10, background: grass, borderTop: '2px solid rgba(0,0,0,0.15)' }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{ flex: 1, borderRight: '1px solid rgba(0,0,0,0.08)' }} />
        ))}
      </div>
      <div className="flex" style={{ height: 18, background: dirt, borderTop: '2px solid rgba(0,0,0,0.2)' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ flex: 1, borderRight: '2px solid rgba(0,0,0,0.12)', borderBottom: '1px solid rgba(0,0,0,0.08)' }} />
        ))}
      </div>
    </div>
  );
}

// ── LevelCard ─────────────────────────────────────────────────
function LevelCard({ level, isAdmin, data, onSaveText, onUploadImage, onRemoveImage, onSaveImagePos }) {
  const fileRef    = useRef(null);
  const imgAreaRef = useRef(null);
  const dragRef    = useRef(null);

  // Image position — local for smooth drag, synced from server
  const [imgPos,   setImgPos]   = useState({ x: Number(data?.image_pos_x ?? 50), y: Number(data?.image_pos_y ?? 50) });
  const posRef = useRef(imgPos);
  useEffect(() => {
    if (data?.image_pos_x != null) {
      const p = { x: Number(data.image_pos_x), y: Number(data.image_pos_y) };
      setImgPos(p); posRef.current = p;
    }
  }, [data?.image_pos_x, data?.image_pos_y]);
  useEffect(() => { posRef.current = imgPos; }, [imgPos]);

  const [repoMode,  setRepoMode]  = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);

  // Edit mode
  const [editMode,  setEditMode]  = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftUrl,  setDraftUrl]  = useState('');

  // Derived display values
  const displayName = data?.name        || level.name;
  const displayDesc = data?.description || level.description;
  const displayUrl  = data?.url         || (level.url !== '#' ? level.url : '');
  const customImg   = data?.image_url   || null;

  function startEdit(e) {
    e.preventDefault(); e.stopPropagation();
    setDraftName(displayName);
    setDraftDesc(displayDesc);
    setDraftUrl(displayUrl);
    setEditMode(true);
  }

  async function saveEdit(e) {
    e.stopPropagation();
    await onSaveText(level.key, {
      name:        draftName.trim() || level.name,
      description: draftDesc.trim() || level.description,
      url:         draftUrl.trim(),
    });
    setEditMode(false);
  }

  // ── Image drag/reposition ──────────────────────────────────
  const onMouseDown = useCallback(e => {
    if (!repoMode) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX: posRef.current.x, posY: posRef.current.y };
  }, [repoMode]);

  const onMouseMove = useCallback(e => {
    if (!dragging || !dragRef.current || !imgAreaRef.current) return;
    const rect = imgAreaRef.current.getBoundingClientRect();
    const dx = -(e.clientX - dragRef.current.startX) / rect.width  * 100;
    const dy = -(e.clientY - dragRef.current.startY) / rect.height * 100;
    setImgPos({
      x: Math.min(100, Math.max(0, dragRef.current.posX + dx)),
      y: Math.min(100, Math.max(0, dragRef.current.posY + dy)),
    });
  }, [dragging]);

  const onMouseUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    onSaveImagePos(level.key, { x: posRef.current.x, y: posRef.current.y });
  }, [dragging, level.key, onSaveImagePos]);

  useEffect(() => {
    if (!repoMode) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [repoMode, onMouseMove, onMouseUp]);

  // ── File upload ────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUploadImage(level.key, file);
    setUploading(false);
    e.target.value = '';
  }

  async function removeImage(e) {
    e.preventDefault(); e.stopPropagation();
    setRepoMode(false);
    await onRemoveImage(level.key);
  }

  return (
    <div className="group relative rounded-2xl overflow-hidden flex flex-col"
      style={{ width: '100%', height: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* ── Illustration area ── */}
      <div ref={imgAreaRef} className="relative overflow-hidden"
        style={{ height: 265, background: level.bg, cursor: repoMode ? (dragging ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={onMouseDown}>

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <Loader size={28} className="animate-spin" style={{ color: 'white' }} />
          </div>
        )}

        {customImg ? (
          <img src={customImg} alt={level.name}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `${imgPos.x}% ${imgPos.y}%`, userSelect: 'none', pointerEvents: 'none' }}
            draggable={false} />
        ) : level.type === 'game' ? (
          <>
            {[{ top: '14%', left: '60%' }, { top: '22%', left: '65%' }, { top: '8%', left: '80%' }, { top: '40%', left: '12%' }]
              .map((pos, i) => (
                <span key={i} className="absolute text-white font-bold pointer-events-none select-none"
                  style={{ ...pos, fontSize: i % 2 === 0 ? 10 : 7, opacity: 0.55 }}>+</span>
              ))}
            {level.scene.map((el, i) => {
              const style = {
                position: 'absolute', fontSize: el.size, top: el.top,
                opacity: el.opacity ?? 1,
                ...(el.left  ? { left:  el.left  } : {}),
                ...(el.right ? { right: el.right } : {}),
                userSelect: 'none', pointerEvents: 'none', lineHeight: 1,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
                ...(el.flip ? { transform: 'scaleX(-1)' } : {}),
              };
              return el.e === '✈️'
                ? <span key={i} className="absolute group-hover:translate-x-1 transition-transform duration-300" style={style}>{el.e}</span>
                : <span key={i} style={style}>{el.e}</span>;
            })}
            <GroundStrip grass={level.groundGrass} dirt={level.groundDirt} />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="select-none group-hover:scale-110 transition-transform duration-300"
              style={{ fontSize: level.charSize, lineHeight: 1, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }}>
              {level.character}
            </span>
          </div>
        )}

        {/* Level badge */}
        {level.badge !== null && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(6px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
            Level {level.badge}
          </div>
        )}

        {/* Reposition hint */}
        {repoMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.18)' }}>
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Move size={12} /> גרור להזזה
            </div>
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (repoMode ? (
          <button onClick={e => { e.stopPropagation(); setRepoMode(false); }}
            className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition hover:opacity-90"
            style={{ background: 'rgba(34,197,94,0.85)', backdropFilter: 'blur(6px)', color: 'white' }}>
            ✓ סיום
          </button>
        ) : (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); fileRef.current?.click(); }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition hover:opacity-90"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Camera size={12} />
              {customImg ? 'החלף' : 'הוסף תמונה'}
            </button>
            {customImg && (
              <>
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); setRepoMode(true); }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition hover:opacity-90"
                  style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Move size={12} /> הזז
                </button>
                <button onClick={removeImage}
                  className="flex items-center justify-center rounded-lg p-1.5 transition hover:bg-red-500/40"
                  style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <X size={12} style={{ color: 'rgba(255,255,255,0.8)' }} />
                </button>
              </>
            )}
          </div>
        ))}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* ── Text area ── */}
      <div className="relative flex-1"
        style={{ background: 'rgb(var(--bg-surface))', overflowY: editMode ? 'auto' : 'hidden' }}>

        {editMode ? (
          <div className="px-3 pt-2 pb-3 space-y-1.5" onClick={e => e.stopPropagation()}>
            <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit(e)}
              placeholder="שם השלב"
              className="w-full rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }} dir="rtl" />
            <input value={draftDesc} onChange={e => setDraftDesc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit(e)}
              placeholder="תת-כותרת / תיאור"
              className="w-full rounded-lg px-3 py-1.5 text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }} dir="rtl" />
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Link size={12} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
              <input value={draftUrl} onChange={e => setDraftUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEdit(e)}
                placeholder="https://skool.com/..."
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: 'rgba(255,255,255,0.7)', minWidth: 0 }} dir="ltr" />
            </div>
            <button onClick={saveEdit}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition hover:opacity-90 w-full justify-center"
              style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#86efac' }}>
              <Check size={13} /> שמור
            </button>
          </div>
        ) : (
          <>
            {displayUrl ? (
              <a href={displayUrl} target="_blank" rel="noopener noreferrer"
                className="block px-4 pt-3 pb-4 transition-colors hover:bg-white/[0.03]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {level.badge !== null && (
                        <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Level {level.badge} —</span>
                      )}
                      <span className="text-sm font-bold text-white">{displayName}</span>
                      <span className="text-sm leading-none">{level.dot}</span>
                    </div>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>{displayDesc}</p>
                  </div>
                  <ExternalLink size={13} className="flex-none mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity"
                    style={{ color: 'rgba(255,255,255,0.7)' }} />
                </div>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full w-0 rounded-full" />
                </div>
              </a>
            ) : (
              <div className="px-4 pt-3 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {level.badge !== null && (
                        <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Level {level.badge} —</span>
                      )}
                      <span className="text-sm font-bold text-white">{displayName}</span>
                      <span className="text-sm leading-none">{level.dot}</span>
                    </div>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>{displayDesc}</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full w-0 rounded-full" />
                </div>
              </div>
            )}

            {isAdmin && (
              <button onClick={startEdit}
                className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
                <Pencil size={11} /> ערוך
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function ContentLibrary() {
  const isAdmin = useIsAdmin();
  const [serverData, setServerData] = useState({});
  const [loading,    setLoading]    = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data, error } = await supabase.from('content_library').select('*');
    if (error) { console.error('content_library load error:', error); }
    if (data) {
      const map = {};
      data.forEach(row => { map[row.key] = row; });
      setServerData(map);
    }
    setLoading(false);
  }

  // ── Admin callbacks ────────────────────────────────────────
  async function saveText(key, { name, description, url }) {
    const { error } = await supabase.from('content_library').upsert(
      { key, name, description, url, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (!error) setServerData(prev => ({ ...prev, [key]: { ...prev[key], key, name, description, url } }));
  }

  async function uploadImage(key, file) {
    try {
      const blob = await compressImageToBlob(file);
      const path = `${key}.jpg`;

      const { error: upErr } = await supabase.storage
        .from('content-library')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

      if (upErr) {
        console.error('Storage upload error:', upErr);
        alert(`שגיאה בהעלאת תמונה:\n${upErr.message}\n\nוודא שהרצת את ה-SQL של הרשאות Storage ב-Supabase.`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('content-library').getPublicUrl(path);
      const imageUrl = `${publicUrl}?v=${Date.now()}`;

      const { error: dbErr } = await supabase.from('content_library').upsert(
        { key, image_url: imageUrl, image_pos_x: 50, image_pos_y: 50, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (dbErr) { console.error('DB upsert error:', dbErr); return; }

      setServerData(prev => ({ ...prev, [key]: { ...prev[key], key, image_url: imageUrl, image_pos_x: 50, image_pos_y: 50 } }));
    } catch (err) {
      console.error('uploadImage failed:', err);
      alert(`שגיאה לא צפויה: ${err.message}`);
    }
  }

  async function removeImage(key) {
    await supabase.storage.from('content-library').remove([`${key}.jpg`]);
    await supabase.from('content_library').upsert(
      { key, image_url: null, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setServerData(prev => ({ ...prev, [key]: { ...prev[key], image_url: null } }));
  }

  async function saveImagePos(key, { x, y }) {
    await supabase.from('content_library').upsert(
      { key, image_pos_x: x, image_pos_y: y, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setServerData(prev => ({ ...prev, [key]: { ...prev[key], image_pos_x: x, image_pos_y: y } }));
  }

  return (
    <div className="w-full space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-white">ספריית תכנים</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          לחץ על שלב כדי לפתוח אותו בסקול
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mx-auto" dir="ltr"
          style={{ maxWidth: 1080 }}>
          {LEVELS.map(level => (
            <LevelCard
              key={level.key}
              level={level}
              isAdmin={isAdmin}
              data={serverData[level.key]}
              onSaveText={saveText}
              onUploadImage={uploadImage}
              onRemoveImage={removeImage}
              onSaveImagePos={saveImagePos}
            />
          ))}
        </div>
      )}
    </div>
  );
}
