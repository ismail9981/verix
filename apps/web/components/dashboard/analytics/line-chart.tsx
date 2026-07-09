import type { ChartPoint } from "./types";

interface LineChartProps {
  points: ChartPoint[];
  ariaLabel: string;
}

/* Responsive area + line chart. The path stretches with the container
   (preserveAspectRatio none + non-scaling stroke); dots are overlaid as
   absolutely-positioned elements so they stay circular. */
export function LineChart({ points, ariaLabel }: LineChartProps) {
  const gradientId = "analytics-growth-gradient";
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const y = (value: number) => 100 - ((value - min) / span) * 100;
  const x = (index: number) => (index / (points.length - 1)) * 100;

  const line = points.map((p, i) => `${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
  const area = `0,100 ${line} 100,100`;

  return (
    <div role="img" aria-label={ariaLabel} className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 flex h-40 flex-col justify-between"
      >
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="h-px w-full bg-hairline/60" />
        ))}
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="relative h-40 w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Dots overlaid so they stay round regardless of aspect ratio. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40">
        {points.map((point, index) => (
          <span
            key={`${point.label}-${index}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-canvas"
            style={{ left: `${x(index)}%`, top: `${y(point.value)}%` }}
          />
        ))}
      </div>

      <div className="mt-3 flex">
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
