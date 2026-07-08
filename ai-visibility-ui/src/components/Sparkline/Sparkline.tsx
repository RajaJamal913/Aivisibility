import { motion } from 'framer-motion';

interface SparklineProps {
  /** Opportunity scores (0-1) observed for this query during the session,
   *  in chronological order. Comes from real API responses (initial load
   *  + each recheck) -- never synthesized, so a fresh query with only one
   *  observation renders the "not enough history" state rather than a
   *  fabricated line. */
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 52, height = 18 }: SparklineProps) {
  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-border dark:text-border-dark"
        role="img"
        aria-label="Not enough history yet to show a trend"
      >
        <title>Recheck this query a few times to build a trend line</title>
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - 4) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = 2 + i * stepX;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const trend = values[values.length - 1] - values[0];
  const color = trend > 0.015 ? '#16A394' : trend < -0.015 ? '#E5484D' : '#8A93A6';
  const trendLabel = trend > 0.015 ? 'trending up' : trend < -0.015 ? 'trending down' : 'flat';
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label={`Opportunity score ${trendLabel} over the last ${values.length} observations`}
    >
      <title>{values.map((v) => v.toFixed(2)).join(' → ')}</title>
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={1.75}
        fill={color}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.2 }}
      />
    </svg>
  );
}
