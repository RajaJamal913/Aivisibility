import { Link } from 'react-router-dom';
import { Moon, PlusCircle, Radar, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';

export function Topbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border dark:border-border-dark bg-surface/90 dark:bg-surface-dark/90 backdrop-blur px-4 py-3 md:px-8">
      <div className="flex items-center gap-2 md:hidden">
        <Radar size={20} className="text-signal-500" />
        <span className="font-display font-semibold text-ink dark:text-ink-dark">Visibility</span>
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2">
        <Link to="/profiles/new">
          <Button size="sm" icon={<PlusCircle size={16} />}>
            New Profile
          </Button>
        </Link>
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="rounded-lg p-2 text-muted hover:bg-bg dark:text-muted-dark dark:hover:bg-bg-dark"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
