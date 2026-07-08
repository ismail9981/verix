import type { ReactNode } from "react";

export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-hairline" />
      <span className="text-xs uppercase tracking-wide text-muted">
        {children}
      </span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}
