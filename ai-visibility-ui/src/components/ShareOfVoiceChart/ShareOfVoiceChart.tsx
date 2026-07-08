import { BarChart2 } from 'lucide-react';
import type { ShareOfVoiceEntity } from '../../types';
import { Card } from '../ui/Feedback';

const AXIS_TICKS = [0, 20, 40, 60, 80, 100];

/**
 * Real "Share of Voice by Competitor" chart: each entity's bar is the real
 * percentage of discovered queries where Agent 2 judged that business
 * (this profile, or one of its listed competitors) visible -- see
 * `BusinessProfile.share_of_voice()` in the backend and
 * `DiscoveredQuery.competitor_visibility` for where the underlying
 * per-query judgment comes from. Nothing here is fabricated: if a
 * competitor's bar is at 0%, that's because Agent 2 never judged them
 * visible for any of this profile's discovered queries, not a placeholder.
 */
export function ShareOfVoiceChart({ entities }: { entities: ShareOfVoiceEntity[] }) {
  const sorted = [...entities].sort((a, b) => (b.share_pct ?? -1) - (a.share_pct ?? -1));
  const hasData = sorted.some((e) => e.total_queries > 0);

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-signal-50 text-signal-600 dark:bg-signal-500/10 dark:text-signal-400">
          <BarChart2 size={15} />
        </span>
        <h3 className="font-display font-semibold text-ink dark:text-ink-dark">Share of Voice by Competitor</h3>
      </div>
      <p className="mb-4 text-sm text-muted dark:text-muted-dark">
        % of discovered queries where each business was judged visible by Agent 2
      </p>

      {!hasData ? (
        <p className="text-sm text-muted dark:text-muted-dark">No scored queries yet to compare against.</p>
      ) : (
        <>
          <div className="mb-2 flex pl-28 text-xs text-muted dark:text-muted-dark">
            {AXIS_TICKS.map((tick) => (
              <span key={tick} className="flex-1 text-left first:flex-[0.5]">
                {tick}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {sorted.map((entity) => {
              const pct = entity.share_pct ?? 0;
              return (
                <div
                  key={entity.name}
                  className={`flex items-center gap-3 rounded-lg py-1 pr-1 ${
                    entity.is_you ? 'bg-signal-50/60 dark:bg-signal-500/10' : ''
                  }`}
                >
                  <span
                    className={`w-28 shrink-0 truncate text-sm ${
                      entity.is_you
                        ? 'font-semibold text-signal-700 dark:text-signal-300'
                        : 'text-muted dark:text-muted-dark'
                    }`}
                    title={entity.is_you ? `${entity.name} (you)` : entity.name}
                  >
                    {entity.is_you ? `${entity.name} (You)` : entity.name}
                  </span>
                  <div
  className={`relative h-10 flex-1 overflow-hidden rounded-sm ${
    entity.is_you ? 'bg-signal-100 dark:bg-signal-700/40' : 'bg-opportunity-50 dark:bg-opportunity-600/80'
  }`}
>
  <div
    className={`h-full rounded-r-md transition-all ${
      entity.is_you ? 'bg-signal-500' : 'bg-opportunity-400/80'
    }`}
    style={{ width: `${pct}%` }}
  />
  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs font-medium text-ink dark:text-ink-dark">
    {entity.share_pct != null ? `${entity.share_pct}%` : '—'}
  </span>
</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted dark:text-muted-dark">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-signal-500" /> Your Brand
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-opportunity-400" /> Competitors
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
