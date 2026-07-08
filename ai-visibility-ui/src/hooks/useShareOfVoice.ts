import { useCallback, useEffect, useState } from 'react';
import { getShareOfVoice } from '../services/api';
import type { ShareOfVoiceEntity } from '../types';
import { ApiError } from '../services/api';

export function useShareOfVoice(profileUuid: string | undefined) {
  const [entities, setEntities] = useState<ShareOfVoiceEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!profileUuid) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getShareOfVoice(profileUuid);
      setEntities(data.entities);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, [profileUuid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { entities, isLoading, error, refetch };
}
