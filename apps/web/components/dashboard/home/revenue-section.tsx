"use client";

import { useState } from "react";
import { SectionCard } from "./section-card";
import { BarChart } from "../analytics/bar-chart";
import { formatMoney } from "../invoices/invoice-format";
import type { RevenueSummary } from "../../../src/server/validators/dashboard-analytics";

/*
 * Revenue trend for the dashboard (Sprint 18). Reuses the analytics
 * feature's `BarChart` primitive directly (a generic, domain-agnostic chart
 * component — see that file), but is its own wrapper rather than reusing
 * `components/dashboard/analytics/revenue-chart.tsx`: that component
 * hardcodes a USD `Intl.NumberFormat`, which would mislabel a workspace on
 * any other currency. This wrapper uses the workspace's actual currency
 * (from `RevenueSummary.currency`, already resolved server-side) via the
 * existing `formatMoney` helper from the invoices feature — the same
 * billing domain this figure is sourced from.
 */

const TABS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function RevenueSection({ revenue }: { revenue: RevenueSummary | null }) {
  const [tab, setTab] = useState<TabKey>("daily");

  if (!revenue) {
    return (
      <SectionCard id="dashboard-revenue" title="Revenue">
        <p className="py-12 text-center text-sm text-muted">
          You don&apos;t have permission to view revenue.
        </p>
      </SectionCard>
    );
  }

  const series = revenue[tab];
  // The authoritative total (an exact integer-cent DB sum, not reconstructed
  // from a bucketed series) is the same figure regardless of which tab is
  // selected — daily/weekly/monthly buckets all cover the identical date
  // range, just grouped differently.
  const totalCents = revenue.totalCents;
  const hasData = series.some((point) => point.value > 0);

  return (
    <SectionCard
      id="dashboard-revenue"
      title="Revenue"
      action={
        <div className="flex gap-1 rounded-lg border border-hairline p-0.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-pressed={item.key === tab}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                item.key === tab ? "bg-surface text-white" : "text-muted hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-6">
        <p className="text-2xl font-bold tracking-tight text-white">
          {formatMoney(totalCents, revenue.currency)}
        </p>
        <p className="text-xs text-muted">Revenue collected in this range</p>
      </div>
      {hasData ? (
        <BarChart
          points={series}
          formatValue={(value) => formatMoney(Math.round(value * 100), revenue.currency)}
          ariaLabel={`${tab} revenue, totaling ${formatMoney(totalCents, revenue.currency)}.`}
        />
      ) : (
        <p className="py-12 text-center text-sm text-muted">No revenue in this range.</p>
      )}
    </SectionCard>
  );
}
