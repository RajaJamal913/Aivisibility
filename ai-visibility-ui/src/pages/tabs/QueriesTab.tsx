import { useMemo, useState } from 'react';
import { useQueries } from '../../hooks/useQueries';
import { QueryFiltersBar } from '../../components/QueryTable/QueryFilters';
import { QueryTable } from '../../components/QueryTable/QueryTable';
import { OpportunityChart } from '../../components/OpportunityChart/OpportunityChart';
import { Skeleton, ErrorState, EmptyState } from '../../components/ui/Feedback';
import { SearchInput } from '../../components/ui/SearchInput';
import { Pagination } from '../../components/ui/Pagination';
import type { VisibilityStatus } from '../../types';

export function QueriesTab({
  profileUuid,
  onQueriesChanged,
}: {
  profileUuid: string;
  onQueriesChanged?: () => void;
}) {
  const [minScore, setMinScore] = useState(0);
  const [status, setStatus] = useState<VisibilityStatus | ''>('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { queries, pagination, isLoading, error, refetch, recheck, recheckingUuid, scoreHistory } = useQueries(profileUuid, {
    min_score: minScore || undefined,
    status: status || undefined,
    page,
    per_page: 10,
  });

  const handleRecheck = async (queryUuid: string) => {
    await recheck(queryUuid);
    onQueriesChanged?.();
  };

  // Search box narrows what's on the current page -- the API doesn't
  // expose a text-search param, only min_score/status/pagination.
  const visibleQueries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return queries;
    return queries.filter((q) => q.query_text.toLowerCase().includes(term));
  }, [queries, search]);

  return (
    <div className="flex flex-col gap-5">
      <QueryFiltersBar
        minScore={minScore}
        status={status}
        onMinScoreChange={(v) => {
          setMinScore(v);
          setPage(1);
        }}
        onStatusChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      {!isLoading && !error && queries.length > 0 && <OpportunityChart queries={queries} />}

      {isLoading && <Skeleton className="h-80" />}
      {!isLoading && error && <ErrorState message={error.message} onRetry={refetch} />}

      {!isLoading && !error && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display font-semibold text-ink dark:text-ink-dark">Discovered Queries</h3>
            <SearchInput value={search} onChange={setSearch} placeholder="Search queries..." />
          </div>

          {visibleQueries.length === 0 ? (
            <EmptyState title="No matches" description="No queries on this page match that search or filter." />
          ) : (
            <QueryTable
              queries={visibleQueries}
              onRecheck={handleRecheck}
              recheckingUuid={recheckingUuid}
              scoreHistory={scoreHistory}
            />
          )}

          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted dark:text-muted-dark">
              <span>
                Page {pagination.page} of {pagination.total_pages} · {pagination.total_items} total
              </span>
              <Pagination page={page} totalPages={pagination.total_pages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
