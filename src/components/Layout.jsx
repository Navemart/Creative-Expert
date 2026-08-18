import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';

const FULL_HEIGHT_ROUTES = ['/nave-ai'];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isFullHeight = FULL_HEIGHT_ROUTES.includes(location.pathname);

  return (
    <div className="flex h-full w-full bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className={isFullHeight ? 'flex-1 overflow-hidden flex flex-col' : 'flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-8'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
