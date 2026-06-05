import { createContext, useContext, useState, useCallback } from 'react';
import { X, AlertTriangle, Trash2, Info } from 'lucide-react';

// ── Context ────────────────────────────────────────────────────
const DialogContext = createContext(null);

// ── Provider ───────────────────────────────────────────────────
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  /**
   * confirm(message, options?) → Promise<boolean>
   * Options: { title, confirmText, cancelText, danger }
   */
  const confirm = useCallback((message, {
    title       = 'אישור',
    confirmText = 'מחיקה',
    cancelText  = 'ביטול',
    danger      = true,
  } = {}) => {
    return new Promise((resolve) => {
      setDialog({ type: 'confirm', message, title, confirmText, cancelText, danger, resolve });
    });
  }, []);

  /**
   * alert(message, options?) → Promise<void>
   * Options: { title, buttonText, variant: 'error' | 'info' }
   */
  const alert = useCallback((message, {
    title      = 'שגיאה',
    buttonText = 'סגור',
    variant    = 'error',
  } = {}) => {
    return new Promise((resolve) => {
      setDialog({ type: 'alert', message, title, buttonText, variant, resolve });
    });
  }, []);

  function handleClose(result) {
    dialog?.resolve(result);
    setDialog(null);
  }

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && <DialogModal dialog={dialog} onClose={handleClose} />}
    </DialogContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────
export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within <DialogProvider>');
  return ctx;
}

// ── Modal UI ────────────────────────────────────────────────────
function DialogModal({ dialog, onClose }) {
  const isConfirm = dialog.type === 'confirm';
  const isError   = dialog.variant === 'error';

  const Icon = isConfirm
    ? Trash2
    : isError
      ? AlertTriangle
      : Info;

  const iconBg = isConfirm || isError
    ? 'bg-red-500/15'
    : 'bg-blue-500/15';

  const iconColor = isConfirm || isError
    ? 'text-red-400'
    : 'text-blue-400';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={() => !isConfirm && onClose(false)}
    >
      {/* Card */}
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{
          background: '#1a1a2e',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          animation: 'dialogPop 0.18s ease-out',
        }}
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close ×  */}
        <button
          onClick={() => onClose(false)}
          className="absolute top-4 left-4 text-white/30 hover:text-white/60 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold text-base mb-1">
          {dialog.title}
        </h3>

        {/* Message */}
        <p className="text-white/55 text-sm leading-relaxed mb-6">
          {dialog.message}
        </p>

        {/* Buttons */}
        <div className="flex gap-2 flex-row-reverse">
          {isConfirm ? (
            <>
              {/* Destructive / confirm */}
              <button
                onClick={() => onClose(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all
                  ${dialog.danger
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-accent hover:opacity-90 text-white'
                  }`}
              >
                {dialog.confirmText}
              </button>
              {/* Cancel */}
              <button
                onClick={() => onClose(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-white/8 hover:bg-white/14 text-white/75 transition-all border border-white/8"
              >
                {dialog.cancelText}
              </button>
            </>
          ) : (
            <button
              onClick={() => onClose(true)}
              className="w-full py-2 rounded-xl text-sm font-medium bg-white/8 hover:bg-white/14 text-white/75 transition-all border border-white/8"
            >
              {dialog.buttonText}
            </button>
          )}
        </div>
      </div>

      {/* Keyframe */}
      <style>{`
        @keyframes dialogPop {
          from { opacity: 0; transform: scale(0.93) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </div>
  );
}
