"use client";

import { useState } from "react";
import { SectionCard } from "../home/section-card";
import { BarChart } from "./bar-chart";
import { REVENUE_RANGES } from "./mock-data";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function RevenueChart() {
  const [rangeKey, setRangeKey] = useState(REVENUE_RANGES[0]!.key);
  const range =
    REVENUE_RANGES.find((item) => item.key === rangeKey) ?? REVENUE_RANGES[0]!;

  return (
    <SectionCard
      id="revenue"
      title="Revenue"
      action={
        <div className="flex gap-1 rounded-lg border border-hairline p-0.5">
          {REVENUE_RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRangeKey(item.key)}
              aria-pressed={item.key === rangeKey}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                item.key === rangeKey
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
        <p className="text-2xl font-bold tracking-tight text-white">{range.total}</p>
        <p className="text-xs text-muted">Total revenue · last {range.label}</p>
      </div>
      <BarChart
        points={range.points}
        formatValue={(value) => currency.format(value)}
        ariaLabel={`Revenue over the last ${range.label}, totaling ${range.total}.`}
      />
    </SectionCard>
  );
}
