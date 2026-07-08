import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function TagInput({ values, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:ring-2 focus-within:ring-signal-500 dark:border-border-dark dark:bg-surface-dark">
      {values.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-signal-50 px-2.5 py-1 text-xs font-medium text-signal-600 dark:bg-signal-500/10 dark:text-signal-400"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(values.filter((v) => v !== tag))}
            aria-label={`Remove ${tag}`}
            className="hover:text-signal-700"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={values.length === 0 ? placeholder : ''}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted dark:text-ink-dark dark:placeholder:text-muted-dark"
      />
    </div>
  );
}
