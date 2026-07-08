import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { Button } from './Button';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-card dark:shadow-card-dark ${className}`}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-sweep animate-radar rounded-md ${className}`} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border dark:border-border-dark py-16 text-center">
      <Inbox size={28} className="text-muted dark:text-muted-dark" />
      <div>
        <p className="font-display font-semibold text-ink dark:text-ink-dark">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted dark:text-muted-dark">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 py-12 text-center">
      <AlertTriangle size={26} className="text-danger-500" />
      <div>
        <p className="font-medium text-danger-600 dark:text-danger-500">Something went wrong</p>
        <p className="mt-1 max-w-sm text-sm text-muted dark:text-muted-dark">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
