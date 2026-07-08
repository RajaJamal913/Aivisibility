import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutGrid, Building2, PlusCircle, Radar } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/profiles', label: 'All Profiles', icon: Building2, end: true },
  { to: '/profiles/new', label: 'New Profile', icon: PlusCircle, end: true },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border dark:border-border-dark bg-surface dark:bg-surface-dark md:flex">
      <div className="flex items-center gap-2 px-6 py-6">
        <Radar size={22} className="text-signal-500" />
        <span className="font-display text-lg font-semibold text-ink dark:text-ink-dark">Visibility</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-signal-600 dark:text-signal-400'
                  : 'text-muted hover:bg-bg dark:text-muted-dark dark:hover:bg-bg-dark'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-lg bg-sweep-soft"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon size={18} className="relative" />
              <span className="relative">{label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-border dark:border-border-dark px-6 py-4 text-xs text-muted dark:text-muted-dark">
        AI Visibility Intelligence
      </div>
    </aside>
  );
}
