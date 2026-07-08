"use client";

import { useState } from "react";
import { SectionCard } from "./section-card";
import { REVENUE_RANGES } from "./mock-data";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function RevenueChart() {
  const [rangeKey, setRangeKey] = useState(REVENUE_RANGES[0]!.key);
  const [hovered, setHovered] = useState<number | null>(null);

  const range =
    REVENUE_RANGES.find((item) => item.key === rangeKey) ?? REVENUE_RANGES[0]!;
  const max = Math.max(...range.points.map((point) => point.value));

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

      <div
        role="img"
        aria-label={`Revenue chart over the last ${range.label}, totaling ${range.total}.`}
        className="relative"
      >
        {/* Gridlines */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 flex h-48 flex-col justify-between"
        >
          {[0, 1, 2, 3, 4].map((line) => (
            <span key={line} className="h-px w-full bg-hairline/60" />
          ))}
        </div>

        {/* Bars */}
        <div className="relative flex h-48 items-end gap-1.5 sm:gap-2">
          {range.points.map((point, index) => (
            <div
              key={point.label}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={`w-full rounded-t-md bg-gradient-to-t from-accent/30 to-accent transition-all duration-200 ${
                  hovered === index ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                }`}
                style={{ height: `${(point.value / max) * 100}%` }}
              />
              {hovered === index ? (
                <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-center shadow-lg">
                  <span className="block text-xs font-semibold text-white">
                    {currency.format(point.value)}
                  </span>
                  <span className="block text-[11px] text-muted">{point.label}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* X labels */}
        <div className="mt-3 flex gap-1.5 sm:gap-2">
          {range.points.map((point) => (
            <span
              key={point.label}
              className="flex-1 truncate text-center text-[11px] text-muted"
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
