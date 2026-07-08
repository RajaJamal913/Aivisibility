import type { VisibilityStatus } from '../../types';

interface SignalBarsProps {
  status: VisibilityStatus;
  position?: number | null;
  size?: 'sm' | 'md';
}

/**
 * The product's visual signature: four bars styled like a signal-strength
 * indicator, encoding how strongly a business "shows up" in AI answers --
 * literally the thing this tool measures. Not decorative: bar count and
 * color map directly to visibility_status and position, the same way a
 * phone's signal bars map to real reception strength.
 */
export function SignalBars({ status, position, size = 'md' }: SignalBarsProps) {
  const activeBars = getActiveBars(status, position);
  const heights = size === 'sm' ? [4, 6, 8, 10] : [6, 9, 12, 15];
  const width = size === 'sm' ? 2.5 : 3;
  const gap = size === 'sm' ? 2 : 2.5;

  const colorClass =
    status === 'visible'
      ? 'bg-positive-500'
      : status === 'not_visible'
        ? 'bg-danger-500'
        : 'bg-muted dark:bg-muted-dark';

  const label =
    status === 'visible'
      ? `Visible${position ? ` (position ${position})` : ''}`
      : status === 'not_visible'
        ? 'Not visible'
        : 'Unknown';

  return (
    <span
      className="inline-flex items-end"
      style={{ gap: `${gap}px` }}
      role="img"
      aria-label={`AI visibility: ${label}`}
      title={label}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`rounded-sm transition-colors ${i < activeBars ? colorClass : 'bg-border dark:bg-border-dark'}`}
          style={{ width: `${width}px`, height: `${h}px` }}
        />
      ))}
    </span>
  );
}

function getActiveBars(status: VisibilityStatus, position?: number | null): number {
  if (status === 'unknown') return 0;
  if (status === 'not_visible') return 1;
  // visible: stronger position (lower number) = more bars
  if (!position) return 3;
  if (position <= 1) return 4;
  if (position <= 3) return 3;
  return 2;
}
