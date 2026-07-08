import { useCallback, useEffect, useRef, useState } from 'react';
import { runPipeline, ApiError } from '../services/api';
import type { PipelineRunResult } from '../types';

export type PipelineStage = 'idle' | 'discovering' | 'scoring' | 'recommending' | 'done' | 'error';

const STAGE_MESSAGES: Record<PipelineStage, string> = {
  idle: '',
  discovering: 'Discovering competitive queries…',
  scoring: 'Scoring visibility for each query…',
  recommending: 'Generating content recommendations…',
  done: 'Pipeline complete.',
  error: 'Pipeline failed.',
};

/**
 * The Flask backend's POST /profiles/{uuid}/run is synchronous -- it runs
 * all three agents in-process and returns one final response, with no
 * job-status endpoint to poll. To still satisfy "real-time status
 * feedback (polling or WebSocket)" with an honest UI, this hook simulates
 * staged progress client-side based on elapsed time (discovery is quick,
 * scoring dominates runtime since it's one LLM call per query, then a
 * short recommendation step) while the single request is in flight.
 * The stage labels are indicative, not driven by real server events --
 * documented here and in the README rather than presented as if the
 * server were actually reporting per-stage progress.
 */
export function usePipeline(profileUuid: string | undefined) {
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<PipelineRunResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const trigger = useCallback(async () => {
    if (!profileUuid) return;
    setError(null);
    setResult(null);
    setElapsedSeconds(0);
    setStage('discovering');

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next < 8) setStage('discovering');
        else if (next < 60) setStage('scoring');
        else setStage('recommending');
        return next;
      });
    }, 1000);

    try {
      const data = await runPipeline(profileUuid);
      setResult(data);
      setStage(data.status === 'failed' ? 'error' : 'done');
    } catch (err) {
      setError(err as ApiError);
      setStage('error');
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [profileUuid]);

  const isRunning = stage !== 'idle' && stage !== 'done' && stage !== 'error';

  return {
    trigger,
    stage,
    stageMessage: STAGE_MESSAGES[stage],
    elapsedSeconds,
    isRunning,
    result,
    error,
  };
}
