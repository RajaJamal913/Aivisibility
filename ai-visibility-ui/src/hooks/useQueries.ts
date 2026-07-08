import { useCallback, useEffect, useState } from 'react';
import { listQueries, recheckQuery, ApiError } from '../services/api';
import type { DiscoveredQuery, Pagination, QueryFilters } from '../types';

// Cap how many points the sparkline keeps per query -- this is a rolling
// window of real observations, not a fixed-size fake dataset.
const MAX_HISTORY_POINTS = 8;

export function useQueries(profileUuid: string | undefined, filters: QueryFilters) {
  const [queries, setQueries] = useState<DiscoveredQuery[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [recheckingUuid, setRecheckingUuid] = useState<string | null>(null);
  // Real opportunity-score observations per query_uuid, in the order the
  // API returned them (initial load, then each subsequent refetch/recheck).
  // Never fabricated -- a query only gets a second point once we've
  // actually seen its score change or be re-confirmed.
  const [scoreHistory, setScoreHistory] = useState<Record<string, number[]>>({});

  const refetch = useCallback(async () => {
    if (!profileUuid) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await listQueries(profileUuid, filters);
      setQueries(data.queries);
      setPagination(data.pagination);
      setScoreHistory((prev) => {
        const next = { ...prev };
        for (const q of data.queries) {
          if (q.opportunity_score == null) continue;
          const hist = next[q.query_uuid] ?? [];
          const last = hist[hist.length - 1];
          if (last === q.opportunity_score) continue;
          next[q.query_uuid] = [...hist, q.opportunity_score].slice(-MAX_HISTORY_POINTS);
        }
        return next;
      });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
    // filters is spread into primitives on the caller side to keep this
    // effect's dependency array stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUuid, filters.min_score, filters.status, filters.page, filters.per_page]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const recheck = useCallback(async (queryUuid: string) => {
    setRecheckingUuid(queryUuid);
    try {
      await recheckQuery(queryUuid);
      await refetch();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setRecheckingUuid(null);
    }
  }, [refetch]);

  return { queries, pagination, isLoading, error, refetch, recheck, recheckingUuid, scoreHistory };
}
