import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Briefcase,
  Filter,
  Kanban,
  FileText,
  BarChart3,
  Bot,
  Sparkles,
  ShieldCheck,
  Calculator,
  Map as MapIcon,
  Mic2,
  Video,
  Library,
  Target,
  X,
  ListTodo,
  ScanSearch,
  ClipboardList,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  ClipboardCheck,
  TrafficCone,
  Newspaper,
  BookOpen,
  ChevronDown,
} from 'lucide-react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

const NAV_ITEMS = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard, end: true },
  { to: '/analytics', label: 'נתונים עסקיים', icon: BarChart3 },
  { to: '/pipeline', label: 'לידים ומכירות', icon: Filter },
  { to: '/content', label: 'תוכן', icon: FileText },
  { to: '/clients', label: 'לקוחות ופרויקטים', icon: Briefcase },
  { to: '/recordings', label: 'פגישות', icon: Video },
];

const ENGINE_ITEMS = [
  { to: '/roadmap',         label: 'מפת דרכים',    icon: MapIcon },
  { to: '/diagnosis',       label: 'אבחון עסקי',   icon: Target },
  { to: '/content-library', label: 'ספריית תכנים', icon: Library, soon: true },
];

const SELF_AUDIT_ITEMS = {
  to:       '/self-audit',
  label:    'כלי אבחון עצמי',
  icon:     ScanSearch,
  children: [
    { to: '/self-audit/quarterly',        label: 'אבחון רבעוני',       icon: ClipboardList },
    { to: '/self-audit/expertise-engine', label: 'מנוע המומחיות',       icon: Zap },
  ],
};

const TOOLS_ITEMS = [
  { to: '/nave-ai',        label: 'NaveAI',         icon: Sparkles, beta: true },
  { to: '/tasks',          label: 'מארגן משימות',  icon: ListTodo, soon: true },
  { to: '/agents',         label: 'AI ScaleKit',   icon: Bot },
  { to: '/skills',         label: 'סקילים',         icon: BookOpen },
  { to: '/calculator',     label: 'מחשבון תמחור',  icon: Calculator },
  { to: '/transcriptions', label: 'תמלול',          icon: Mic2 },
];

const ADMIN_ITEMS = [
  { to: '/admin/members',         label: 'תלמידים',        icon: ShieldCheck },
  { to: '/admin/checkins',        label: "Check-In's",     icon: ClipboardCheck },
  { to: '/admin/events',          label: 'אירועי משתמשים', icon: Activity },
  { to: '/admin/sales-pipeline',  label: 'צינור מכירות',   icon: Kanban },
  { to: '/admin/traffic-lights',  label: 'רמזור תנועה',    icon: TrafficCone },
  { to: '/admin/news',            label: 'חדשות ועדכונים', icon: Newspaper },
];

/* ─── shared style values ─── */
const S = {
  item:   'flex items-center gap-2 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors w-full text-right overflow-hidden leading-none',
  icon:   'flex-none shrink-0',
  label:  'flex-1 min-w-0 truncate',
  active: { background: 'rgba(255,255,255,0.09)', color: 'white' },
  hover:  'hover:bg-white/[0.055]',
  muted:  { color: 'rgba(255,255,255,0.55)' },
};

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div className="mx-2 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />;
  return (
    <div className="px-2.5 pb-1" style={{ paddingTop: 14 }}>
      <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>
        {children}
      </span>
    </div>
  );
}

function NavItemExpandable({ item, collapsed, onCloseMobile }) {
  const location  = useLocation();
  const anyActive = location.pathname.startsWith(item.to);
  const [open, setOpen] = useState(anyActive);
  const Icon = item.icon;

  useEffect(() => { if (anyActive) setOpen(true); }, [anyActive]);

  return (
    <li>
      <button
        onClick={() => setOpen(o => !o)}
        className={[S.item, S.hover].join(' ')}
        style={{ height: 34, fontSize: '13.5px', ...(anyActive ? S.active : S.muted) }}
      >
        <Icon size={15} className={S.icon} />
        {!collapsed && (
          <>
            <span className={S.label}>{item.label}</span>
            <ChevronDown
              size={12}
              className="flex-none transition-transform duration-200"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}
            />
          </>
        )}
      </button>

      {open && !collapsed && item.children && (
        <ul className="mt-0.5 space-y-0.5"
          style={{ paddingRight: 10, marginRight: 8, borderRight: '1px solid rgba(255,255,255,0.09)' }}>
          {item.children.map(child => (
            <li key={child.to}>
              {child.disabled || (child.soon && !import.meta.env.DEV) ? (
                <span className="flex items-center justify-between rounded-lg px-2.5 py-[6px] text-[12px] cursor-not-allowed select-none"
                  style={{ color: 'rgba(255,255,255,0.22)' }}>
                  <span className="truncate">{child.label}</span>
                  {child.soon && <Badge>בקרוב</Badge>}
                </span>
              ) : (
                <NavLink
                  to={child.to}
                  end={child.end}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    ['flex items-center justify-between rounded-lg px-2.5 py-[6px] text-[12px] transition-colors', isActive ? '' : S.hover].join(' ')
                  }
                  style={({ isActive }) => isActive
                    ? { color: 'rgb(var(--accent))', background: 'rgba(var(--accent),0.1)', fontWeight: 600 }
                    : { color: 'rgba(255,255,255,0.5)' }}
                >
                  {({ isActive }) => <span className="truncate">{child.label}</span>}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Badge({ children, accent }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, lineHeight: 1,
      padding: '2px 6px', borderRadius: 5,
      background: accent ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.08)',
      color:      accent ? 'rgb(165,168,255)'       : 'rgba(255,255,255,0.3)',
      letterSpacing: '0.03em', flexShrink: 0,
    }}>
      {children}
    </span>
  );
}

function NavItem({ to, label, icon: Icon, end, collapsed, onCloseMobile, soon, beta }) {
  if (soon && !import.meta.env.DEV) {
    return (
      <li>
        <div className={[S.item, collapsed ? 'md:justify-center' : ''].join(' ')}
          style={{ height: 34, fontSize: '13.5px', color: 'rgba(255,255,255,0.22)', cursor: 'not-allowed', userSelect: 'none' }}>
          <Icon size={15} className={S.icon} />
          {!collapsed && (
            <>
              <span className={S.label}>{label}</span>
              <Badge>בקרוב</Badge>
            </>
          )}
        </div>
      </li>
    );
  }
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onCloseMobile}
        className={({ isActive }) =>
          [S.item, isActive ? '' : S.hover, collapsed ? 'md:justify-center' : ''].join(' ')
        }
        style={({ isActive }) => ({ height: 34, ...(isActive ? S.active : S.muted) })}
      >
        {({ isActive }) => (
          <>
            <Icon size={15} className={S.icon} style={isActive ? {} : { opacity: 0.7 }} />
            {!collapsed && (
              <>
                <span className={S.label}>{label}</span>
                {beta && <Badge accent>בטא</Badge>}
              </>
            )}
            {collapsed && <span className="md:hidden">{label}</span>}
          </>
        )}
      </NavLink>
    </li>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { user } = useUser();
  const isAdmin = user?.id === ADMIN_ID;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        className={[
          'fixed inset-y-0 right-0 z-40 flex flex-col transition-all duration-200',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
          'md:static md:translate-x-0',
          collapsed ? 'md:w-[52px]' : 'md:w-[250px]',
          'w-[250px]',
        ].join(' ')}
        style={{ background: 'rgb(var(--bg-chrome))', borderLeft: '1px solid rgba(255,255,255,0.07)' }}
        aria-label="Primary"
      >
        {/* Logo row */}
        <div className="flex h-[52px] items-center justify-between px-3 flex-none"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {!collapsed && (
            <img src="/logo.png" alt="Creative Expert 3.0" className="h-6 w-auto flex-none object-contain" />
          )}
          <button type="button" onClick={onCloseMobile} className="rounded-lg p-1 md:hidden"
            style={{ color: 'rgba(255,255,255,0.5)' }} aria-label="Close navigation">
            <X size={16} />
          </button>
          <button type="button" onClick={onToggleCollapse}
            className="hidden md:inline-flex rounded-lg p-1 transition-colors hover:bg-white/[0.07]"
            style={{ color: 'rgba(255,255,255,0.35)' }} aria-label="Toggle sidebar">
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">

          {/* ניווט ראשי */}
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
            ))}
          </ul>

          {/* המנוע */}
          <SectionLabel collapsed={collapsed}>המנוע</SectionLabel>
          <ul className="space-y-0.5">
            <NavItemExpandable item={SELF_AUDIT_ITEMS} collapsed={collapsed} onCloseMobile={onCloseMobile} />
            {ENGINE_ITEMS.map(item => {
              if (item.to === '/diagnosis' && import.meta.env.PROD) return null;
              return <NavItem key={item.to} {...item} collapsed={collapsed} onCloseMobile={onCloseMobile} />;
            })}
          </ul>

          {/* כלים */}
          <SectionLabel collapsed={collapsed}>כלים</SectionLabel>
          <ul className="space-y-0.5">
            {TOOLS_ITEMS.map(item => (
              <NavItem key={item.to} {...item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
            ))}
          </ul>

          {/* ניהול */}
          {isAdmin && (
            <>
              <SectionLabel collapsed={collapsed}>ניהול</SectionLabel>
              <ul className="space-y-0.5">
                {ADMIN_ITEMS.map(item =>
                  item.children
                    ? <NavItemExpandable key={item.to} item={item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
                    : <NavItem key={item.to} {...item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
                )}
              </ul>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-2 flex-none" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {!collapsed && (
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>v0.1</span>
          )}
        </div>
      </aside>
    </>
  );
}
