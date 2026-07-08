import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import type { ContentRecommendation } from '../../types';
import { Card } from '../ui/Feedback';
import { Badge } from '../ui/Badge';

const CONTENT_TYPE_LABEL: Record<string, string> = {
  blog_post: 'Blog post',
  landing_page: 'Landing page',
  faq: 'FAQ',
  comparison_page: 'Comparison page',
  case_study: 'Case study',
};

export function RecommendationCard({ recommendation }: { recommendation: ContentRecommendation }) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
    <Card className="flex flex-col gap-2.5 p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover dark:hover:shadow-card-hover-dark">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted dark:text-muted-dark">
          <FileText size={14} />
          {CONTENT_TYPE_LABEL[recommendation.content_type] ?? recommendation.content_type}
        </div>
      </div>
      <h4 className="font-display font-semibold leading-snug text-ink dark:text-ink-dark">
        {recommendation.title}
      </h4>
      <p className="text-sm text-muted dark:text-muted-dark">{recommendation.rationale}</p>
      {recommendation.target_keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {recommendation.target_keywords.map((kw) => (
            <Badge key={kw} tone="signal">
              {kw}
            </Badge>
          ))}
        </div>
      )}
    </Card>
    </motion.div>
  );
}
