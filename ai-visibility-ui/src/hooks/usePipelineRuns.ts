import { useCallback, useEffect, useState } from 'react';
import { listPipelineRuns, ApiError } from '../services/api';
import type { PipelineRunSummary } from '../types';

export function usePipelineRuns(profileUuid: string | undefined, refreshKey?: unknown) {
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!profileUuid) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await listPipelineRuns(profileUuid);
      setRuns(data.runs);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, [profileUuid]);

  useEffect(() => {
    refetch();
    // refreshKey lets callers force a refetch (e.g. after a new run completes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, refreshKey]);

  return { runs, isLoading, error, refetch };
}
