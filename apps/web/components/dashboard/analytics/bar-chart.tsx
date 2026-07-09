"use client";

import { useState } from "react";
import type { ChartPoint } from "./types";

interface BarChartProps {
  points: ChartPoint[];
  formatValue?: (value: number) => string;
  ariaLabel: string;
}

/* Reusable responsive vertical bar chart with gridlines and hover tooltips. */
export function BarChart({ points, formatValue = String, ariaLabel }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...points.map((point) => point.value));

  return (
    <div role="img" aria-label={ariaLabel} className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 flex h-40 flex-col justify-between"
      >
        {[0, 1, 2, 3, 4].map((line) => (
          <span key={line} className="h-px w-full bg-hairline/60" />
        ))}
      </div>

      <div className="relative flex h-40 items-end gap-1.5 sm:gap-2">
        {points.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
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
                  {formatValue(point.value)}
                </span>
                <span className="block text-[11px] text-muted">{point.label}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5 sm:gap-2">
        {points.map((point, index) => (
          <span
            key={`${point.label}-${index}`}
            className="flex-1 truncate text-center text-[11px] text-muted"
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
