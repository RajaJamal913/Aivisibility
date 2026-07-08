import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { BusinessProfile } from '../../types';
import { Card } from '../ui/Feedback';
import { Badge } from '../ui/Badge';

const STATUS_TONE: Record<string, 'neutral' | 'positive' | 'signal'> = {
  created: 'neutral',
  running: 'signal',
  completed: 'positive',
};

export function ProfileTable({ profiles }: { profiles: BusinessProfile[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted dark:border-border-dark dark:text-muted-dark">
            <th className="px-4 py-3 font-medium">Business</th>
            <th className="px-4 py-3 font-medium">Industry</th>
            <th className="px-4 py-3 font-medium">Queries</th>
            <th className="px-4 py-3 font-medium">Avg. Opportunity</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border-dark">
          {profiles.map((profile) => {
            const avgScore = profile.stats?.avg_opportunity_score;
            return (
              <tr key={profile.profile_uuid} className="group transition-colors hover:bg-bg dark:hover:bg-bg-dark">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink dark:text-ink-dark">{profile.name}</p>
                  <p className="text-xs text-muted dark:text-muted-dark">{profile.domain}</p>
                </td>
                <td className="px-4 py-3 text-muted dark:text-muted-dark">{profile.industry}</td>
                <td className="px-4 py-3 font-mono text-ink dark:text-ink-dark">
                  {profile.stats?.total_queries_discovered ?? 0}
                </td>
                <td className="px-4 py-3 font-mono text-ink dark:text-ink-dark">
                  {avgScore != null ? avgScore.toFixed(2) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[profile.status] ?? 'neutral'}>{profile.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/profiles/${profile.profile_uuid}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-signal-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-signal-400"
                  >
                    View <ArrowUpRight size={14} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
