"use client";

import { useState } from "react";
import { SectionCard } from "../home/section-card";
import { BarChart } from "./bar-chart";
import type { AnalyticsPoint } from "./types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const TABS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface RevenueChartProps {
  daily: AnalyticsPoint[];
  weekly: AnalyticsPoint[];
  monthly: AnalyticsPoint[];
}

export function RevenueChart({ daily, weekly, monthly }: RevenueChartProps) {
  const [tab, setTab] = useState<TabKey>("daily");
  const series = tab === "daily" ? daily : tab === "weekly" ? weekly : monthly;
  const total = series.reduce((sum, point) => sum + point.value, 0);
  const hasData = series.some((point) => point.value > 0);

  return (
    <SectionCard
      id="revenue"
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
                item.key === tab
                  ? "bg-surface text-white"
                  : "text-muted hover:text-white"
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
          {currency.format(total)}
        </p>
        <p className="text-xs text-muted">Total revenue · {tab}</p>
      </div>
      {hasData ? (
        <BarChart
          points={series}
          formatValue={(value) => currency.format(value)}
          ariaLabel={`${tab} revenue, totaling ${currency.format(total)}.`}
        />
      ) : (
        <p className="py-12 text-center text-sm text-muted">
          No revenue in this range.
        </p>
      )}
    </SectionCard>
  );
}
