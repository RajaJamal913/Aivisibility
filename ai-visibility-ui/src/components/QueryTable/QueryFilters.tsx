import type { VisibilityStatus } from '../../types';
import { Card } from '../ui/Feedback';

interface QueryFiltersProps {
  minScore: number;
  status: VisibilityStatus | '';
  onMinScoreChange: (value: number) => void;
  onStatusChange: (value: VisibilityStatus | '') => void;
}

export function QueryFiltersBar({ minScore, status, onMinScoreChange, onStatusChange }: QueryFiltersProps) {
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <label className="mb-1.5 block text-xs font-medium text-muted dark:text-muted-dark">
          Minimum opportunity score: <span className="font-mono text-ink dark:text-ink-dark">{minScore.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={minScore}
          onChange={(e) => onMinScoreChange(Number(e.target.value))}
          className="w-full accent-signal-500"
        />
      </div>
      <div className="sm:w-48">
        <label className="mb-1.5 block text-xs font-medium text-muted dark:text-muted-dark">
          Visibility status
        </label>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as VisibilityStatus | '')}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        >
          <option value="">All statuses</option>
          <option value="visible">Visible</option>
          <option value="not_visible">Not visible</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
    </Card>
  );
}
