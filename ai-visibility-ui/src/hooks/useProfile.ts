import { useCallback, useEffect, useState } from 'react';
import { getProfile } from '../services/api';
import type { BusinessProfile } from '../types';
import { ApiError } from '../services/api';

export function useProfile(profileUuid: string | undefined) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!profileUuid) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProfile(profileUuid);
      setProfile(data);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, [profileUuid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, isLoading, error, refetch };
}
