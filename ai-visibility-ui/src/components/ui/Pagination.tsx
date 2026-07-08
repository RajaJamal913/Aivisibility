import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Numbered pager with ellipses for long ranges -- e.g. "< 1 2 3 ... 10 >" --
 * matching the reference design's pagination control. Falls back to nothing
 * when there's only one page.
 */
export function Pagination({ page, totalPages, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = getPageList(page, totalPages);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <PageButton disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeft size={14} />
      </PageButton>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted dark:text-muted-dark">
            …
          </span>
        ) : (
          <PageButton key={p} active={p === page} onClick={() => onPageChange(p)}>
            {p}
          </PageButton>
        )
      )}
      <PageButton disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
        <ChevronRight size={14} />
      </PageButton>
    </div>
  );
}

function getPageList(page: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (page > 3) pages.push('ellipsis');
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) pages.push(p);
  if (page < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

function PageButton({
  active,
  children,
  ...rest
}: { active?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-signal-500 bg-signal-500 text-white'
          : 'border-border bg-surface text-muted hover:bg-bg dark:border-border-dark dark:bg-surface-dark dark:text-muted-dark dark:hover:bg-bg-dark'
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
