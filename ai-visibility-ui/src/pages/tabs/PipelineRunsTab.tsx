import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { usePipelineRuns } from '../../hooks/usePipelineRuns';
import type { PipelineRunSummary, PipelineStatus } from '../../types';
import { Card, Skeleton, ErrorState, EmptyState } from '../../components/ui/Feedback';
import { Badge } from '../../components/ui/Badge';

const STATUS_ICON: Record<PipelineStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  partial: CheckCircle2,
  failed: XCircle,
  running: Clock,
  created: Clock,
};

const STATUS_TONE: Record<PipelineStatus, 'positive' | 'danger' | 'opportunity' | 'signal' | 'neutral'> = {
  completed: 'positive',
  partial: 'opportunity',
  failed: 'danger',
  running: 'signal',
  created: 'neutral',
};

interface PipelineRunsTabProps {
  profileUuid: string;
  refreshKey?: unknown;
}

export function PipelineRunsTab({ profileUuid, refreshKey }: PipelineRunsTabProps) {
  const { runs, isLoading, error, refetch } = usePipelineRuns(profileUuid, refreshKey);

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (runs.length === 0) {
    return <EmptyState title="No pipeline runs yet" description="Trigger a run from above to see its history here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {runs.map((run) => (
        <RunRow key={run.run_uuid} run={run} />
      ))}
    </div>
  );
}

function RunRow({ run }: { run: PipelineRunSummary }) {
  const Icon = STATUS_ICON[run.status];
  const durationSeconds =
    run.completed_at && run.started_at
      ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
      : null;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Icon
          size={18}
          className={
            run.status === 'completed' || run.status === 'partial'
              ? 'text-positive-500'
              : run.status === 'failed'
                ? 'text-danger-500'
                : 'text-signal-500'
          }
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink dark:text-ink-dark">
              {new Date(run.started_at).toLocaleString()}
            </span>
            <Badge tone={STATUS_TONE[run.status]}>{run.status}</Badge>
          </div>
          {run.error_message && <p className="mt-0.5 text-xs text-danger-500">{run.error_message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted dark:text-muted-dark sm:grid-cols-4">
        <Metric label="Discovered" value={run.queries_discovered} />
        <Metric label="Scored" value={run.queries_scored} />
        <Metric label="Recs" value={run.recommendations_generated} />
        <Metric label="Tokens" value={run.tokens_used ?? '—'} />
        {durationSeconds != null && <Metric label="Duration" value={`${durationSeconds}s`} />}
        {run.data_provider_used && <Metric label="Data" value={run.data_provider_used} />}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p>{label}</p>
      <p className="font-mono text-ink dark:text-ink-dark">{value}</p>
    </div>
  );
}
