import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Building2, ListChecks, Target, FileText } from 'lucide-react';
import { useProfiles } from '../hooks/useProfiles';
import { ProfileTable } from '../components/ProfileTable/ProfileTable';
import { MetricsBar } from '../components/ui/MetricsBar';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { Card, Skeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';

export function Profiles() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { profiles, pagination, isLoading, error, refetch } = useProfiles(page, 12);

  // Client-side filter over the currently loaded page. The list endpoint
  // only supports page/per_page, not a text search param, so this narrows
  // what's already on screen rather than hitting the backend again.
  const visibleProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(term) || p.domain.toLowerCase().includes(term)
    );
  }, [profiles, search]);

  const metrics = useMemo(() => {
    const totalQueries = profiles.reduce((sum, p) => sum + (p.stats?.total_queries_discovered ?? 0), 0);
    const scored = profiles.filter((p) => p.stats?.avg_opportunity_score != null);
    const avgScore = scored.length
      ? scored.reduce((sum, p) => sum + (p.stats!.avg_opportunity_score as number), 0) / scored.length
      : null;
    const totalRecs = profiles.reduce((sum, p) => sum + (p.stats?.total_recommendations ?? 0), 0);
    return {
      totalProfiles: pagination?.total_items ?? profiles.length,
      totalQueries,
      avgScore,
      totalRecs,
    };
  }, [profiles, pagination]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink dark:text-ink-dark">All Profiles</h1>
          <p className="text-sm text-muted dark:text-muted-dark">
            Every business profile being tracked for AI visibility
          </p>
        </div>
        <Link to="/profiles/new">
          <Button icon={<PlusCircle size={16} />}>New profile</Button>
        </Link>
      </div>

      <Card className="p-5">
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : (
          <MetricsBar
            items={[
              { icon: Building2, label: 'Total Profiles', value: metrics.totalProfiles },
              { icon: ListChecks, label: 'Queries Discovered', value: metrics.totalQueries },
              {
                icon: Target,
                label: 'Avg. Opportunity',
                value: metrics.avgScore != null ? metrics.avgScore.toFixed(2) : '—',
              },
              { icon: FileText, label: 'Recommendations', value: metrics.totalRecs },
            ]}
          />
        )}
      </Card>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-72" />
        </div>
      )}

      {!isLoading && error && <ErrorState message={error.message} onRetry={refetch} />}

      {!isLoading && !error && profiles.length === 0 && (
        <EmptyState
          title="No profiles yet"
          description="Register a business profile to start discovering how it shows up in AI-generated answers."
          action={
            <Link to="/profiles/new">
              <Button icon={<PlusCircle size={16} />}>Create your first profile</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !error && profiles.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold text-ink dark:text-ink-dark">Profiles</h2>
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name or domain..." />
          </div>

          {visibleProfiles.length === 0 ? (
            <EmptyState title="No matches" description="No profiles match that search on this page." />
          ) : (
            <ProfileTable profiles={visibleProfiles} />
          )}

          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted dark:text-muted-dark">
              <span>
                Page {pagination.page} of {pagination.total_pages} · {pagination.total_items} total
              </span>
              <Pagination page={page} totalPages={pagination.total_pages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
