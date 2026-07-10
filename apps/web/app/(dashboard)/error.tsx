"use client";

import { useEffect } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../components/landing/cta-styles";

/* Route-level error boundary for the dashboard. Contains a thrown server/client
   error to this segment (shell stays intact) and lets the user retry. The
   error's `digest` correlates to the structured server log. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("dashboard route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-2xl border border-hairline bg-surface/40 px-6 py-14 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-6 w-6">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M10 6.5v4M10 13.4h.01"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <div>
        <h2 className="text-base font-semibold text-white">
          Something went wrong
        </h2>
        <p className="mt-1 text-sm text-muted">
          This section failed to load. You can retry, or head back to your
          dashboard.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted/70">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" className={CTA_PRIMARY} onClick={reset}>
          Try again
        </Button>
        <Button
          type="button"
          className={CTA_SECONDARY}
          onClick={() => {
            window.location.href = "/dashboard";
          }}
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
