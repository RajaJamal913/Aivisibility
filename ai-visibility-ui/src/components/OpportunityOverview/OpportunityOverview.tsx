import { Gauge } from 'lucide-react';
import type { DiscoveredQuery } from '../../types';
import { Card } from '../ui/Feedback';

interface OpportunityOverviewProps {
  avgScore: number | null | undefined;
  topQueries: DiscoveredQuery[];
}

/**
 * Reference-design equivalent: the "AI Visibility Score" card (big score +
 * a query/score/volume mini-table). Titled to match the reference exactly,
 * per explicit product decision -- the score itself is still our real
 * average opportunity score, not an AI-generated visibility percentage
 * (we don't have one), and the mini-table's third column stays "Volume"
 * (real estimated_search_volume) rather than being relabeled "Source",
 * since we have no source-attribution data to put behind that column.
 */
export function OpportunityOverview({ avgScore, topQueries }: OpportunityOverviewProps) {
  const pct = avgScore != null ? Math.round(avgScore * 100) : null;

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-signal-50 text-signal-600 dark:bg-signal-500/10 dark:text-signal-400">
          <Gauge size={15} />
        </span>
        <h3 className="font-display font-semibold text-ink dark:text-ink-dark">AI Visibility Score</h3>
      </div>

      <div className="mb-4 rounded-xl bg-bg px-4 py-3.5 dark:bg-bg-dark">
        <p className="text-xs text-muted dark:text-muted-dark">Overall visibility score</p>
        <p className="mt-1 font-mono text-3xl font-bold text-signal-600 dark:text-signal-400">
          {pct != null ? `${pct}%` : '—'}
        </p>
      </div>

      {topQueries.length === 0 ? (
        <p className="text-sm text-muted dark:text-muted-dark">No scored queries yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted dark:text-muted-dark">
              <th className="pb-2 font-medium">Query</th>
              <th className="pb-2 pl-2 font-medium">Score</th>
              <th className="pb-2 pl-2 font-medium">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {topQueries.map((q) => (
              <tr key={q.query_uuid}>
                <td className="max-w-[180px] truncate py-2 pr-2 text-ink dark:text-ink-dark" title={q.query_text}>
                  {q.query_text}
                </td>
                <td className="py-2 pl-2 font-mono text-ink dark:text-ink-dark">
                  {q.opportunity_score != null ? q.opportunity_score.toFixed(2) : '—'}
                </td>
                <td className="py-2 pl-2 font-mono text-muted dark:text-muted-dark">
                  {q.estimated_search_volume != null ? q.estimated_search_volume.toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
