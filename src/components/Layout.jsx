import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import TopLoadingBar from './TopLoadingBar.jsx';

const FULL_HEIGHT_ROUTES = ['/nave-ai'];

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.16, ease: 'easeIn' } },
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isFullHeight = FULL_HEIGHT_ROUTES.includes(location.pathname);

  return (
    <div className="flex h-full w-full bg-slate-50">
      <TopLoadingBar />
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className={isFullHeight ? 'flex-1 overflow-hidden flex flex-col' : 'flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-8'}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="page-root"
              style={isFullHeight ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
