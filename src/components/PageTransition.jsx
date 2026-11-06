import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const variants = {
  initial:  { opacity: 0, y: 10 },
  animate:  { opacity: 1, y: 0,  transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] } },
  exit:     { opacity: 0, y: -6, transition: { duration: 0.14, ease: 'easeIn' } },
};

export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
