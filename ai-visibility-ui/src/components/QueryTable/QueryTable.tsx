import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import type { DiscoveredQuery } from '../../types';
import { SignalBars } from '../SignalBars/SignalBars';
import { Sparkline } from '../Sparkline/Sparkline';
import { Spinner } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';

interface QueryTableProps {
  queries: DiscoveredQuery[];
  onRecheck: (queryUuid: string) => void;
  recheckingUuid: string | null;
  scoreHistory: Record<string, number[]>;
}

export function QueryTable({ queries, onRecheck, recheckingUuid, scoreHistory }: QueryTableProps) {
  if (queries.length === 0) {
    return (
      <EmptyState
        title="No queries match these filters"
        description="Try lowering the minimum opportunity score or clearing the status filter."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border dark:border-border-dark">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border bg-bg text-left text-[11px] uppercase tracking-wide text-muted dark:border-border-dark dark:bg-bg-dark dark:text-muted-dark">
            <th className="px-3.5 py-2.5 font-medium">Query</th>
            <th className="px-3.5 py-2.5 font-medium">Volume</th>
            <th className="px-3.5 py-2.5 font-medium">Difficulty</th>
            <th className="px-3.5 py-2.5 font-medium">Opportunity</th>
            <th className="px-3.5 py-2.5 font-medium">Visibility</th>
            <th className="px-3.5 py-2.5 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border-dark">
          {queries.map((q, i) => (
            <motion.tr
              key={q.query_uuid}
              className="bg-surface transition-colors hover:bg-bg dark:bg-surface-dark dark:hover:bg-bg-dark"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.02 }}
            >
              <td className="max-w-xs px-3.5 py-2.5">
                <p className="truncate text-ink dark:text-ink-dark" title={q.query_text}>
                  {q.query_text}
                </p>
                {q.query_intent && (
                  <p className="mt-0.5 text-xs capitalize text-muted dark:text-muted-dark">
                    {q.query_intent.replace('_', ' ')}
                  </p>
                )}
              </td>
              <td className="px-3.5 py-2.5 font-mono text-ink dark:text-ink-dark">
                {q.estimated_search_volume?.toLocaleString() ?? '—'}
              </td>
              <td className="px-3.5 py-2.5 font-mono text-ink dark:text-ink-dark">
                {q.competitive_difficulty ?? '—'}
              </td>
              <td className="px-3.5 py-2.5">
                <OpportunityBar score={q.opportunity_score} history={scoreHistory[q.query_uuid] ?? []} />
              </td>
              <td className="px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <SignalBars status={q.visibility_status} position={q.visibility_position} size="sm" />
                  <span className="text-xs capitalize text-muted dark:text-muted-dark">
                    {q.visibility_status.replace('_', ' ')}
                  </span>
                </div>
              </td>
              <td className="px-3.5 py-2.5 text-right">
                <button
                  onClick={() => onRecheck(q.query_uuid)}
                  disabled={recheckingUuid === q.query_uuid}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-bg disabled:opacity-60 dark:border-border-dark dark:text-muted-dark dark:hover:bg-bg-dark"
                >
                  {recheckingUuid === q.query_uuid ? (
                    <Spinner size={12} />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Recheck
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpportunityBar({ score, history }: { score: number | null; history: number[] }) {
  if (score == null) return <span className="text-muted dark:text-muted-dark">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? 'bg-opportunity-500' : score >= 0.4 ? 'bg-signal-500' : 'bg-muted dark:bg-muted-dark';
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border dark:bg-border-dark">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs text-ink dark:text-ink-dark">{score.toFixed(2)}</span>
      </div>
      <Sparkline values={history} />
    </div>
  );
}
