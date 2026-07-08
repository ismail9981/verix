import type { ReactNode } from "react";

/* The form container: a rounded, hairline-bordered surface matching the
   landing cards. Width-capped so forms stay readable on large screens. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-hairline bg-surface/40 p-8 shadow-xl shadow-black/20 sm:p-10">
        {children}
      </div>
    </div>
  );
}
