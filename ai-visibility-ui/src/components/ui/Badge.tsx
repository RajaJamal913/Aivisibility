import type { ReactNode } from 'react';

type Tone = 'neutral' | 'positive' | 'danger' | 'opportunity' | 'signal';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-border/60 dark:bg-border-dark text-muted dark:text-muted-dark',
  positive: 'bg-positive-50 dark:bg-positive-500/10 text-positive-600 dark:text-positive-400',
  danger: 'bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-500',
  opportunity: 'bg-opportunity-50 dark:bg-opportunity-500/10 text-opportunity-600 dark:text-opportunity-400',
  signal: 'bg-signal-50 dark:bg-signal-500/10 text-signal-600 dark:text-signal-400',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
