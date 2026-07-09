import type { IconComponent } from "../types";

interface TableEmptyStateProps {
  icon: IconComponent;
  title: string;
  description: string;
  onClear: () => void;
}

/* Shared empty state for filtered tables (Bookings, CRM). */
export function TableEmptyState({
  icon: Icon,
  title,
  description,
  onClear,
}: TableEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-lg px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Clear filters
      </button>
    </div>
  );
}

/* Shared loading skeleton for table bodies (Bookings, CRM). Rows shimmer via
   animate-pulse; aria-hidden since they convey no content. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse divide-y divide-hairline">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-3.5">
          <span className="h-8 w-8 shrink-0 rounded-full bg-hairline" />
          <span className="h-3.5 w-32 rounded bg-hairline" />
          <span className="hidden h-3.5 w-28 rounded bg-hairline sm:block" />
          <span className="hidden h-3.5 w-24 rounded bg-hairline lg:block" />
          <span className="ml-auto h-5 w-16 rounded-full bg-hairline" />
        </div>
      ))}
    </div>
  );
}
