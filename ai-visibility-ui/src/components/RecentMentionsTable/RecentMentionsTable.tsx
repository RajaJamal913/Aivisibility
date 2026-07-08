import type { DiscoveredQuery } from '../../types';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/Feedback';
import { formatModelName } from '../../utils/modelDisplay';

function formatChecked(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Per-query Share of Voice: % of ALL tracked entities (this business +
 * every listed competitor) that Agent 2 judged visible for THIS specific
 * query. Distinct from the profile-level Share of Voice chart (which
 * aggregates across every discovered query) -- this is a real per-row
 * number derived from the same `domain_visible` / `competitor_visibility`
 * fields already returned per query, not a fabricated figure. Returns
 * null (rendered as "—") if no competitors are tracked yet, since a
 * "% visible out of 1 entity" number isn't a meaningful comparison.
 */
function computeRowSov(q: DiscoveredQuery): number | null {
  const competitorEntries = Object.values(q.competitor_visibility ?? {});
  const totalEntities = 1 + competitorEntries.length;
  if (competitorEntries.length === 0) return null;
  const visibleEntities = (q.domain_visible ? 1 : 0) + competitorEntries.filter(Boolean).length;
  return Math.round((100 * visibleEntities) / totalEntities);
}

// ---------------------------------------------------------------------
// MOCK DATA — Sources and Location have no backing field anywhere in the
// API (see models/query.py): there's no citation/source tracking and no
// per-query geo-targeting in this pipeline. These two helpers exist ONLY
// to visually match the reference design's column layout; the numbers
// are NOT derived from any real tracked signal. Deterministic (hashed
// off query_uuid, same query always renders the same fake value) rather
// than random-per-render, mirroring the pattern the backend itself uses
// for its DataForSEO mock fallback -- but unlike that backend fallback,
// there is no "real" mode this can silently upgrade into later without
// an actual source-tracking feature being built first. If/when that
// happens, delete these two functions and wire the real fields in.
// ---------------------------------------------------------------------
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function mockSourcesCount(queryUuid: string): string {
  const n = 1 + (hashString(queryUuid) % 30); // 1-30, matches reference's "08", "21" style
  return String(n).padStart(2, '0');
}

const MOCK_LOCATIONS = ['US/EN', 'UK/EN', 'DE/DE', 'CA/EN', 'FR/FR', 'AU/EN', 'IN/EN'];

function mockLocation(queryUuid: string): string {
  return MOCK_LOCATIONS[hashString(queryUuid + 'loc') % MOCK_LOCATIONS.length];
}

/**
 * Matches the reference design's "Recent Mentions" table column-for-column.
 * Mentioned, AI Search Vol, SOV, Snippet, Platform, and Last Checked are
 * all real (visibility_status, estimated_search_volume, per-query
 * domain_visible/competitor_visibility, confidence_reasoning,
 * scoring_llm_model, last_scored_at). Sources and Location are MOCK data
 * (see mockSourcesCount/mockLocation above) -- there's no citation or
 * geo-tracking anywhere in this API, so these two columns exist purely
 * for visual parity with the reference design and are not backed by any
 * real signal. Each carries a hover tooltip saying so.
 */
export function RecentMentionsTable({ queries }: { queries: DiscoveredQuery[] }) {
  if (queries.length === 0) {
    return <EmptyState title="No mentions yet" description="Run the pipeline on this profile to discover queries and mentions." />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border dark:border-border-dark">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-border bg-bg text-left text-[11px] uppercase tracking-wide text-muted dark:border-border-dark dark:bg-bg-dark dark:text-muted-dark">
            <th className="px-3.5 py-2.5 font-medium">Query / Prompt</th>
            <th className="px-3.5 py-2.5 font-medium">Platform</th>
            <th className="px-3.5 py-2.5 font-medium">Mentioned</th>
            <th className="px-3.5 py-2.5 font-medium">AI Search Vol</th>
            <th className="px-3.5 py-2.5 font-medium">Sources</th>
            <th className="px-3.5 py-2.5 font-medium">Snippet</th>
            <th className="px-3.5 py-2.5 font-medium">SOV</th>
            <th className="px-3.5 py-2.5 font-medium">Location</th>
            <th className="px-3.5 py-2.5 font-medium">Last Checked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border-dark">
          {queries.map((q) => (
            <tr key={q.query_uuid} className="bg-surface transition-colors hover:bg-bg dark:bg-surface-dark dark:hover:bg-bg-dark">
              <td className="max-w-[220px] px-3.5 py-2.5">
                <p className="truncate text-ink dark:text-ink-dark" title={q.query_text}>
                  {q.query_text}
                </p>
              </td>
              <td className="px-3.5 py-2.5">
                <Badge>{formatModelName(q.scoring_llm_model)}</Badge>
              </td>
              <td className="px-3.5 py-2.5">
                <Badge
                  tone={
                    q.visibility_status === 'visible'
                      ? 'positive'
                      : q.visibility_status === 'not_visible'
                        ? 'opportunity'
                        : 'neutral'
                  }
                >
                  {q.visibility_status === 'visible' ? 'Yes' : q.visibility_status === 'not_visible' ? 'No' : '—'}
                </Badge>
              </td>
              <td className="px-3.5 py-2.5 font-mono text-ink dark:text-ink-dark">
                {q.estimated_search_volume?.toLocaleString() ?? '—'}
              </td>
              <td className="px-3.5 py-2.5 font-mono text-muted dark:text-muted-dark" title="Sample data — source citations aren't tracked by this API yet">
                {mockSourcesCount(q.query_uuid)}
              </td>
              <td className="max-w-[220px] px-3.5 py-2.5">
                <p className="truncate text-ink dark:text-ink-dark" title={q.confidence_reasoning ?? undefined}>
                  {q.confidence_reasoning ?? '—'}
                </p>
              </td>
              <td className="px-3.5 py-2.5 font-mono text-positive-500 dark:text-positive-400">
                {computeRowSov(q) != null ? `${computeRowSov(q)}%` : '—'}
              </td>
              <td className="px-3.5 py-2.5 text-muted dark:text-muted-dark" title="Sample data — geo-targeting isn't tracked by this API yet">
                {mockLocation(q.query_uuid)}
              </td>
              <td className="px-3.5 py-2.5 text-muted dark:text-muted-dark">{formatChecked(q.last_scored_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}