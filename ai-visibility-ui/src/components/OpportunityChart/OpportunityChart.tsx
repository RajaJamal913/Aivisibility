import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { DiscoveredQuery } from '../../types';
import { Card } from '../ui/Feedback';

interface OpportunityChartProps {
  queries: DiscoveredQuery[];
}

/**
 * Volume (x) vs. difficulty (y) scatter, bubble size = opportunity score,
 * color = visibility status. Chosen over a simple bar chart because it
 * surfaces the actual tradeoff the opportunity formula is built on --
 * high volume + low difficulty + not-visible is exactly the top-right,
 * small-y quadrant a user should scan for.
 */
export function OpportunityChart({ queries }: OpportunityChartProps) {
  const scored = queries.filter((q) => q.estimated_search_volume != null && q.competitive_difficulty != null);

  if (scored.length === 0) {
    return (
      <Card className="flex h-72 items-center justify-center p-6 text-sm text-muted dark:text-muted-dark">
        No scored queries yet to visualize.
      </Card>
    );
  }

  const visible = scored.filter((q) => q.domain_visible === true);
  const notVisible = scored.filter((q) => q.domain_visible === false);
  const unknown = scored.filter((q) => q.domain_visible == null);

  return (
    <Card className="p-4">
      <div className="mb-3.5 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-ink dark:text-ink-dark">Opportunity Landscape</h3>
          <p className="text-sm text-muted dark:text-muted-dark">
            Search volume vs. competitive difficulty — bubble size is opportunity score
          </p>
        </div>
        <Legend />
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border dark:stroke-border-dark" />
          <XAxis
            type="number"
            dataKey="estimated_search_volume"
            name="Search volume"
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-muted dark:text-muted-dark"
          />
          <YAxis
            type="number"
            dataKey="competitive_difficulty"
            name="Difficulty"
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-muted dark:text-muted-dark"
          />
          <ZAxis type="number" dataKey="opportunity_score" range={[60, 400]} name="Opportunity" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={<ChartTooltip />}
          />
          <Scatter name="Not visible" data={notVisible} fill="#E5484D" fillOpacity={0.75} />
          <Scatter name="Visible" data={visible} fill="#16A394" fillOpacity={0.75} />
          <Scatter name="Unknown" data={unknown} fill="#8A93A6" fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted dark:text-muted-dark">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-danger-500" /> Not visible
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-positive-500" /> Visible
      </span>
    </div>
  );
}

interface TooltipPayloadItem {
  payload: DiscoveredQuery;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const q = payload[0].payload;
  return (
    <div className="max-w-xs rounded-lg border border-border bg-surface p-3 text-xs shadow-card dark:border-border-dark dark:bg-surface-dark">
      <p className="font-medium text-ink dark:text-ink-dark">{q.query_text}</p>
      <div className="mt-1.5 space-y-0.5 text-muted dark:text-muted-dark">
        <p>Volume: {q.estimated_search_volume?.toLocaleString()}</p>
        <p>Difficulty: {q.competitive_difficulty}</p>
        <p>Opportunity: {q.opportunity_score?.toFixed(2)}</p>
      </div>
    </div>
  );
}
