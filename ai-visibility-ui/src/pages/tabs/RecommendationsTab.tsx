import { useCallback, useEffect, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { listRecommendations, ApiError } from '../../services/api';
import type { ContentRecommendation, Priority } from '../../types';
import { RecommendationCard } from '../../components/RecommendationCard/RecommendationCard';
import { Skeleton, ErrorState, EmptyState } from '../../components/ui/Feedback';

const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' };

const gridVariants: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

export function RecommendationsTab({ profileUuid }: { profileUuid: string }) {
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listRecommendations(profileUuid);
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, [profileUuid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="No recommendations yet"
        description="Run the pipeline to generate content recommendations for high-opportunity visibility gaps."
      />
    );
  }

  const grouped = PRIORITY_ORDER.map((priority) => ({
    priority,
    items: recommendations.filter((r) => r.priority === priority),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {grouped.map(({ priority, items }) => (
        <div key={priority}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">
            {PRIORITY_LABEL[priority]} <span className="font-mono">({items.length})</span>
          </h3>
          <motion.div
            variants={gridVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((rec) => (
              <motion.div key={rec.recommendation_uuid} variants={itemVariants}>
                <RecommendationCard recommendation={rec} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
