import { NavLink, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Briefcase,
  Filter,
  FileText,
  BarChart3,
  Bot,
  ShieldCheck,
  Calculator,
  Map as MapIcon,
  Mic2,
  Video,
  Library,
  Target,
  X,
} from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const NAV_ITEMS = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard, end: true },
  { to: '/analytics', label: 'נתונים עסקיים', icon: BarChart3 },
  { to: '/pipeline', label: 'לידים ומכירות', icon: Filter },
  { to: '/content', label: 'תוכן', icon: FileText },
  { to: '/clients', label: 'לקוחות ופרויקטים', icon: Briefcase },
  { to: '/recordings', label: 'הקלטות פגישות', icon: Video },
];

const ENGINE_ITEMS = [
  { to: '/roadmap',         label: 'מפת דרכים',    icon: MapIcon },
  { to: '/diagnosis',       label: 'אבחון עסקי',   icon: Target },
  { to: '/content-library', label: 'ספריית תכנים', icon: Library },
];

const TOOLS_ITEMS = [
  { to: '/agents',          label: 'AI ScaleKit',    icon: Bot },
  { to: '/calculator',      label: 'מחשבון תמחור',   icon: Calculator },
  { to: '/transcriptions',  label: 'תמלול',           icon: Mic2 },
];

const ADMIN_ITEMS = [
  {
    to: '/admin/students',
    label: 'תלמידים',
    icon: ShieldCheck,
    children: [
      { to: '/admin/students',           label: 'תלמידים',          end: true },
      { to: '/admin/students/monthly',   label: 'נתונים חודשיים' },
      { to: '/admin/students/wins',      label: 'נצחונות שבועיים' },
      { to: '/admin/students/deals',     label: 'עסקאות חדשות' },
      { to: '/admin/students/checklist', label: 'צ׳קליסט' },
    ],
  },
];


function NavItemExpandable({ item, collapsed, onCloseMobile }) {
  const location = useLocation();
  const isExpanded = location.pathname.startsWith(item.to);
  const Icon = item.icon;

  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onCloseMobile}
        className={({ isActive }) =>
          [
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isExpanded ? 'bg-accent text-accent-foreground' : 'hover:bg-white/10',
            collapsed ? 'md:justify-center md:px-2' : '',
          ].join(' ')
        }
        style={({ isActive }) => isExpanded ? {} : { color: 'rgba(255,255,255,0.75)' }}
      >
        <Icon size={18} className="flex-none" />
        <span className={collapsed ? 'md:hidden' : ''}>{item.label}</span>
      </NavLink>

      {/* Sub-items — shown when parent is active */}
      {isExpanded && !collapsed && item.children && (
        <ul className="mt-0.5 space-y-0.5 pr-4" style={{ borderRight: '1px solid rgba(255,255,255,0.08)', marginRight: '0.875rem' }}>
          {item.children.map(child => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end={child.end}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  [
                    'block rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'font-semibold' : 'hover:bg-white/10',
                  ].join(' ')
                }
                style={({ isActive }) => ({
                  color: isActive ? '#F5C118' : 'rgba(255,255,255,0.55)',
                  background: isActive ? 'rgba(245,193,24,0.08)' : 'transparent',
                })}
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function NavItem({ to, label, icon: Icon, end, collapsed, onCloseMobile }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onCloseMobile}
        className={({ isActive }) =>
          [
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-white/10',
            collapsed ? 'md:justify-center md:px-2' : '',
          ].join(' ')
        }
        style={({ isActive }) => isActive ? {} : { color: 'rgba(255,255,255,0.75)' }}
      >
        <Icon size={18} className="flex-none" />
        <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
      </NavLink>
    </li>
  );
}

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const { user } = useUser();
  const isAdmin = user?.id === ADMIN_ID;
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 right-0 z-40 flex flex-col transition-all duration-200',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
          'md:static md:translate-x-0',
          collapsed ? 'md:w-16' : 'md:w-64',
          'w-64',
        ].join(' ')}
        style={{ background: 'rgb(var(--bg-chrome))', borderRight: '1px solid rgba(255,255,255,0.08)' }}
        aria-label="Primary"
      >
        <div className="flex h-16 items-center justify-between px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 overflow-hidden">
            <img src="/icon.png" alt="Creative Expert" className="h-8 w-8 flex-none rounded-md object-cover" />
            {!collapsed && (
              <span className="truncate text-sm font-semibold tracking-tight text-white">
                Creative Expert 3.0
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-1 md:hidden"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">

          {/* ניווט ראשי */}
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
            ))}
          </ul>

          {/* המנוע */}
          <div>
            <div className="mb-2 px-3">
              {collapsed ? (
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  המנוע
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {ENGINE_ITEMS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
              ))}
            </ul>
          </div>

          {/* כלים */}
          <div>
            <div className="mb-2 px-3">
              {collapsed ? (
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  כלים
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {TOOLS_ITEMS.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
              ))}
            </ul>
          </div>

          {/* ניהול — רק למנהל */}
          {isAdmin && (
            <div>
              <div className="mb-2 px-3">
                {collapsed ? (
                  <div className="h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    ניהול
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {ADMIN_ITEMS.map((item) => (
                  item.children
                    ? <NavItemExpandable key={item.to} item={item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
                    : <NavItem key={item.to} {...item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
                ))}
              </ul>
            </div>
          )}

        </nav>

        <div className="p-3 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
          {!collapsed && <span>v0.1</span>}
        </div>
      </aside>
    </>
  );
}
