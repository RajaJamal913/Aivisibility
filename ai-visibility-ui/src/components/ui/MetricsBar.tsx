import type { LucideIcon } from 'lucide-react';

export interface MetricItem {
  icon: LucideIcon;
  label: string;
  value: string | number;
}

/**
 * Individually-bordered stat tiles -- matches the reference Figma design's
 * "Total Mentions / AI Search Volume / Total Impressions" row: a small
 * violet icon badge, a muted label, and a bold mono value, each in its own
 * card rather than a plain inline stat strip. Generic so it can render the
 * Dashboard's fleet-wide numbers and a single profile's stats with the same
 * component.
 */
export function MetricsBar({ items, className = '' }: { items: MetricItem[]; className?: string }) {
  return (
    <div className={`flex flex-1 flex-wrap gap-3 ${className}`}>
      {items.map((item, i) => (
        <div
          key={i}
          className="min-w-[140px] flex-1 rounded-xl border border-border bg-bg/60 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/40"
        >
          <div className="flex items-center gap-2 text-xs text-muted dark:text-muted-dark">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal-50 text-signal-600 dark:bg-signal-500/10 dark:text-signal-400">
              <item.icon size={13} />
            </span>
            {item.label}
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold leading-tight text-ink dark:text-ink-dark">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
