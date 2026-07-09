import { TeamIcon } from "../icons";

export function CustomerEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
        <TeamIcon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-medium text-white">No customers found</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        No customers match your current filters. Try adjusting or clearing them.
      </p>
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
