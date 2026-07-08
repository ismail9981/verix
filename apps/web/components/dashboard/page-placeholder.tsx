import type { ReactNode } from "react";

interface PagePlaceholderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

/* Shared scaffold for authenticated pages this sprint. It establishes the
   page heading + an empty-state panel; real modules replace the panel with
   their widgets while keeping this heading pattern. */
export function PagePlaceholder({
  title,
  description,
  children,
}: PagePlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>

      {children ?? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface/30 p-8 text-center">
          <p className="text-sm font-medium text-white">Nothing here yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            This module is part of an upcoming sprint. The application shell is
            ready for its widgets.
          </p>
        </div>
      )}
    </div>
  );
}
