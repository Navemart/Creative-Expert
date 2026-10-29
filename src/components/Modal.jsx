import { motion, AnimatePresence } from 'framer-motion';

const backdrop = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.18 } },
  exit:   { opacity: 0, transition: { duration: 0.16, delay: 0.05 } },
};

const panel = {
  hidden: { opacity: 0, scale: 0.93, y: 16 },
  show:   { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', stiffness: 380, damping: 28 } },
  exit:   { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15, ease: 'easeIn' } },
};

/**
 * Usage:
 * <Modal open={open} onClose={() => setOpen(false)}>
 *   <div>content</div>
 * </Modal>
 */
export default function Modal({ open, onClose, children, maxWidth = 420, style = {} }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          variants={backdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            key="modal-panel"
            variants={panel}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth,
              background: 'rgba(22,25,50,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 18,
              boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08) inset',
              padding: 28,
              ...style,
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
