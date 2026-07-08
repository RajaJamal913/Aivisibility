import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search here...', className = '' }: SearchInputProps) {
  return (
    <div className={`relative w-full sm:w-64 ${className}`}>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-muted-dark" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none transition-colors focus:ring-2 focus:ring-signal-500 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
      />
    </div>
  );
}
