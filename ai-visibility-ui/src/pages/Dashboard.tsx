import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AtSign, ChevronDown, Globe, PlusCircle, Search, Tag, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useProfiles } from '../hooks/useProfiles';
import { useQueries } from '../hooks/useQueries';
import { useShareOfVoice } from '../hooks/useShareOfVoice';
import { MetricsBar } from '../components/ui/MetricsBar';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { Card, Skeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { RecentMentionsTable } from '../components/RecentMentionsTable/RecentMentionsTable';
import { OpportunityOverview } from '../components/OpportunityOverview/OpportunityOverview';
import { ShareOfVoiceChart } from '../components/ShareOfVoiceChart/ShareOfVoiceChart';
import { formatModelName } from '../utils/modelDisplay';
import type { BusinessProfile } from '../types';

// Used only to compute the header metrics + the two summary cards --
// independent of whatever page/filters the "Recent Mentions" table below
// has applied. Capped at 100 so a very active profile doesn't force us to
// pull its entire query history just to show a header number.
const OVERVIEW_FILTERS = { page: 1, per_page: 100 };

/**
 * Home. Laid out to match the reference Figma's single-business dashboard:
 * a metrics strip, a searchable/paginated "Recent Mentions" table, an
 * "AI Visibility Score" card, and a competitive breakdown chart. Since our
 * data model is multi-tenant (many business profiles, not one), business
 * selection gets its own "Business Profile" picker.
 *
 * "AI Engine" is a SEPARATE, real filter: DiscoveredQuery.scoring_llm_model
 * already records which LLM actually scored each query, so this isn't
 * fabricated -- it lists whichever engines have genuinely scored at least
 * one of this profile's queries (e.g. if you've run the pipeline under
 * different provider configs over time) and narrows the Recent Mentions
 * table to that engine, client-side, same as the search box does (the
 * queries API doesn't expose a server-side engine filter param).
 */
export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profiles, isLoading: profilesLoading, error: profilesError } = useProfiles(1, 100);

  const selectedUuid = searchParams.get('profile') || profiles[0]?.profile_uuid || '';
  const selectedProfile = profiles.find((p) => p.profile_uuid === selectedUuid);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [engineFilter, setEngineFilter] = useState<string>('all');

  const overview = useQueries(selectedUuid || undefined, OVERVIEW_FILTERS);
  const shareOfVoice = useShareOfVoice(selectedUuid || undefined);
  const {
    queries,
    pagination,
    isLoading: queriesLoading,
    error: queriesError,
    refetch: refetchQueries,
  } = useQueries(selectedUuid || undefined, { page, per_page: 4 });

  // Real engines that have actually scored at least one of this profile's
  // queries -- derived from scoring_llm_model, not a hardcoded list, so a
  // profile only ever run under one provider correctly shows just that one.
  const availableEngines = useMemo(() => {
    const models = new Set<string>();
    for (const q of overview.queries) {
      if (q.scoring_llm_model) models.add(q.scoring_llm_model);
    }
    return Array.from(models);
  }, [overview.queries]);

  // Search box narrows what's on the current page -- the API doesn't
  // expose a text-search param, only pagination. Engine filter works the
  // same way, over the same already-loaded page.
  const visibleQueries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return queries.filter((q) => {
      if (term && !q.query_text.toLowerCase().includes(term)) return false;
      if (engineFilter !== 'all' && q.scoring_llm_model !== engineFilter) return false;
      return true;
    });
  }, [queries, search, engineFilter]);

  const topOpportunityQueries = useMemo(
    () =>
      [...overview.queries]
        .filter((q) => q.opportunity_score != null)
        .sort((a, b) => (b.opportunity_score as number) - (a.opportunity_score as number))
        .slice(0, 5),
    [overview.queries]
  );

  // "Total Mentions" == queries where the profile actually showed up.
  // "AI Search Volume" == real search-volume estimates, summed.
  // Neither is fabricated; both come straight off DiscoveredQuery.
  const mentionedCount = overview.queries.filter((q) => q.visibility_status === 'visible').length;
  const totalVolume = overview.queries.reduce((sum, q) => sum + (q.estimated_search_volume ?? 0), 0);
  const totalDiscovered = selectedProfile?.stats?.total_queries_discovered ?? overview.queries.length;
  const overviewIsCapped = totalDiscovered > OVERVIEW_FILTERS.per_page;

  const handleSelectProfile = (uuid: string) => {
    setSearchParams(uuid ? { profile: uuid } : {});
    setPage(1);
    setSearch('');
    setEngineFilter('all');
  };

  if (profilesLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (profilesError) {
    return <ErrorState message={profilesError.message} />;
  }

  if (profiles.length === 0) {
    return (
      <EmptyState
        title="No profiles yet"
        description="Register a business profile to start tracking its presence in AI-generated answers."
        action={
          <Link to="/profiles/new">
            <Button icon={<PlusCircle size={16} />}>Create your first profile</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink dark:text-ink-dark">AI Search Visibility</h1>
          <p className="text-sm text-muted dark:text-muted-dark">Track your brand's presence in AI-generated answers</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <EngineSwitcher engines={availableEngines} value={engineFilter} onChange={setEngineFilter} />
          <ProfileSwitcher profiles={profiles} value={selectedUuid} onChange={handleSelectProfile} />
        </div>
      </div>

      <Card className="flex flex-col gap-6 p-5 lg:flex-row lg:items-start">
        {overview.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="lg:flex-[2]">
              <MetricsBar
                items={[
                  { icon: AtSign, label: 'Total Mentions', value: mentionedCount },
                  { icon: TrendingUp, label: 'AI Search Volume', value: totalVolume.toLocaleString() },
                  { icon: Search, label: 'Queries Discovered', value: totalDiscovered },
                ]}
              />
              {overviewIsCapped && (
                <p className="mt-2 text-xs text-muted dark:text-muted-dark">
                  Mentions and volume above are based on the {OVERVIEW_FILTERS.per_page} most recent queries.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-6 border-t border-border pt-5 lg:flex-[1] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 dark:border-border-dark">
              <div className="min-w-[160px] flex-1">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted dark:text-muted-dark">
                  <Globe size={13} /> Top Source Domains
                </p>
                <p className="text-xs text-muted dark:text-muted-dark">
                  Not tracked by this API — no per-query source/citation data is returned.
                </p>
              </div>
              <div className="min-w-[160px] flex-1">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted dark:text-muted-dark">
                  <Tag size={13} /> Top Brand Entities
                </p>
                {selectedProfile && selectedProfile.competitors.length > 0 ? (
                  <ol className="flex flex-col gap-1.5">
                    {selectedProfile.competitors.slice(0, 3).map((c, i) => (
                      <li key={c} className="flex items-center gap-2 text-xs">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-signal-50 font-mono text-[10px] font-semibold text-signal-600 dark:bg-signal-500/10 dark:text-signal-400">
                          {i + 1}
                        </span>
                        <span className="truncate text-ink dark:text-ink-dark" title={c}>
                          {c}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-muted dark:text-muted-dark">No competitors on file for this profile.</p>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-signal-50 text-signal-600 dark:bg-signal-500/10 dark:text-signal-400"><AtSign size={15} /></span>
            <h2 className="font-display font-semibold text-ink dark:text-ink-dark">Recent Mentions</h2>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search here..." />
        </div>

        {queriesLoading && <Skeleton className="h-64" />}
        {!queriesLoading && queriesError && <ErrorState message={queriesError.message} onRetry={refetchQueries} />}
        {!queriesLoading && !queriesError && visibleQueries.length === 0 && (
          <EmptyState
            title="No queries yet"
            description="Run the pipeline on this profile to discover queries and mentions."
          />
        )}
        {!queriesLoading && !queriesError && visibleQueries.length > 0 && (
          <>
            <RecentMentionsTable queries={visibleQueries} />

            {pagination && pagination.total_pages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted dark:text-muted-dark">
                <span>
                  Showing {(pagination.page - 1) * pagination.per_page + 1}-
                  {Math.min(pagination.page * pagination.per_page, pagination.total_items)} of {pagination.total_items}
                </span>
                <Pagination page={page} totalPages={pagination.total_pages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      {!overview.isLoading && !overview.error && overview.queries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OpportunityOverview
            avgScore={selectedProfile?.stats?.avg_opportunity_score}
            topQueries={topOpportunityQueries}
          />
          {shareOfVoice.isLoading ? (
            <Skeleton className="h-64" />
          ) : shareOfVoice.error ? (
            <ErrorState message={shareOfVoice.error.message} onRetry={shareOfVoice.refetch} />
          ) : (
            <ShareOfVoiceChart entities={shareOfVoice.entities} />
          )}
        </div>
      )}
      {overview.isLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}

      {selectedProfile && (
        <Link
          to={`/profiles/${selectedProfile.profile_uuid}`}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-signal-600 hover:underline dark:text-signal-400"
        >
          View full profile (recommendations, pipeline runs) <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  );
}

function ProfileSwitcher({
  profiles,
  value,
  onChange,
}: {
  profiles: BusinessProfile[];
  value: string;
  onChange: (uuid: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted dark:text-muted-dark">Business Profile</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-48 appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-signal-500 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        >
          {profiles.map((p) => (
            <option key={p.profile_uuid} value={p.profile_uuid}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted dark:text-muted-dark"
        />
      </div>
    </div>
  );
}

function EngineSwitcher({
  engines,
  value,
  onChange,
}: {
  engines: string[];
  value: string;
  onChange: (model: string) => void;
}) {
  // Real per-query data: DiscoveredQuery.scoring_llm_model records which
  // LLM actually scored each query (see agents/scoring.py + the Platform
  // column). Options here are whichever engines have genuinely scored at
  // least one query for the currently-selected profile -- not a static
  // "ChatGPT / Claude / Gemini" list shown regardless of what actually ran.
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted dark:text-muted-dark">AI Engine</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={engines.length === 0}
          className="w-48 appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-signal-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        >
          <option value="all">All Engines</option>
          {engines.map((model) => (
            <option key={model} value={model}>
              {formatModelName(model)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted dark:text-muted-dark"
        />
      </div>
    </div>
  );
}
