import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Search, Target, History, FileText } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { usePipeline } from '../hooks/usePipeline';
import { useQueries } from '../hooks/useQueries';
import { useShareOfVoice } from '../hooks/useShareOfVoice';
import { Card, Skeleton, ErrorState } from '../components/ui/Feedback';
import { Badge } from '../components/ui/Badge';
import { MetricsBar } from '../components/ui/MetricsBar';
import { PipelineStatus } from '../components/PipelineStatus/PipelineStatus';
import { OpportunityOverview } from '../components/OpportunityOverview/OpportunityOverview';
import { ShareOfVoiceChart } from '../components/ShareOfVoiceChart/ShareOfVoiceChart';
import { QueriesTab } from './tabs/QueriesTab';
import { RecommendationsTab } from './tabs/RecommendationsTab';
import { PipelineRunsTab } from './tabs/PipelineRunsTab';

const TABS = [
  { key: 'queries', label: 'Queries' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'runs', label: 'Pipeline Runs' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// Only used to compute the overview cards (top queries + status
// breakdown) -- independent of whatever filters/pagination the Queries
// tab itself has applied.
const OVERVIEW_QUERY_FILTERS = { page: 1, per_page: 100 };

export function ProfileDetail() {
  const { profileUuid } = useParams<{ profileUuid: string }>();
  const location = useLocation();
  const { profile, isLoading, error, refetch } = useProfile(profileUuid);
  const pipeline = usePipeline(profileUuid);
  const overview = useQueries(profileUuid, OVERVIEW_QUERY_FILTERS);
  const shareOfVoice = useShareOfVoice(profileUuid);
  const [activeTab, setActiveTab] = useState<TabKey>(
    (new URLSearchParams(location.search).get('tab') as TabKey) || 'queries'
  );

  const topOpportunityQueries = useMemo(
    () =>
      [...overview.queries]
        .filter((q) => q.opportunity_score != null)
        .sort((a, b) => (b.opportunity_score as number) - (a.opportunity_score as number))
        .slice(0, 5),
    [overview.queries]
  );

  // When a run finishes, refresh profile stats and jump to Queries so the
  // person immediately sees what was discovered.
  useEffect(() => {
    if (pipeline.stage === 'done') {
      refetch();
      overview.refetch();
      setActiveTab('queries');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.result]);

  const handleRunPipeline = async () => {
    await pipeline.trigger();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !profile) {
    return <ErrorState message={error?.message ?? 'Profile not found.'} onRetry={refetch} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/"
        className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink dark:text-muted-dark dark:hover:text-ink-dark"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-semibold text-ink dark:text-ink-dark">{profile.name}</h1>
              <Badge tone="signal">{profile.industry}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted dark:text-muted-dark">{profile.domain}</p>
            {profile.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted dark:text-muted-dark">{profile.description}</p>
            )}
            {profile.competitors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.competitors.map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))}
              </div>
            )}
          </div>

          <MetricsBar
            items={[
              { icon: Search, label: 'Queries', value: profile.stats?.total_queries_discovered ?? 0 },
              {
                icon: Target,
                label: 'Avg. Opportunity',
                value: profile.stats?.avg_opportunity_score != null ? profile.stats.avg_opportunity_score.toFixed(2) : '—',
              },
              { icon: History, label: 'Pipeline Runs', value: profile.stats?.total_pipeline_runs ?? 0 },
              { icon: FileText, label: 'Recommendations', value: profile.stats?.total_recommendations ?? 0 },
            ]}
          />
        </div>

        <div className="mt-6 border-t border-border pt-5 dark:border-border-dark">
          <PipelineStatus
            stage={pipeline.stage}
            stageMessage={pipeline.stageMessage}
            elapsedSeconds={pipeline.elapsedSeconds}
            isRunning={pipeline.isRunning}
            onTrigger={handleRunPipeline}
            errorMessage={pipeline.error?.message}
          />
        </div>
      </Card>

      {!overview.isLoading && !overview.error && overview.queries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OpportunityOverview avgScore={profile.stats?.avg_opportunity_score} topQueries={topOpportunityQueries} />
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

      <div className="flex gap-1 border-b border-border dark:border-border-dark">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-signal-600 dark:text-signal-400'
                : 'text-muted hover:text-ink dark:text-muted-dark dark:hover:text-ink-dark'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.span
                layoutId="profile-tab-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-sweep"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {activeTab === 'queries' && (
            <QueriesTab profileUuid={profile.profile_uuid} onQueriesChanged={overview.refetch} />
          )}
          {activeTab === 'recommendations' && <RecommendationsTab profileUuid={profile.profile_uuid} />}
          {activeTab === 'runs' && (
            <PipelineRunsTab profileUuid={profile.profile_uuid} refreshKey={pipeline.result?.run_uuid} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
