import { useCallback, useEffect, useState } from 'react';
import { listProfiles, ApiError } from '../services/api';
import type { BusinessProfile, Pagination } from '../types';

export function useProfiles(page = 1, perPage = 12) {
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listProfiles(page, perPage);
      setProfiles(data.profiles);
      setPagination(data.pagination);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profiles, pagination, isLoading, error, refetch };
}
