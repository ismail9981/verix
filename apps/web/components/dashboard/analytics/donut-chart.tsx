import type { TrafficSource } from "./types";

/* Donut chart drawn with stroked circle segments (transparent center — no
   hole fill needed). The SVG is rotated so the first segment starts at top. */
export function DonutChart({
  segments,
  ariaLabel,
}: {
  segments: TrafficSource[];
  ariaLabel: string;
}) {
  const size = 120;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  let accumulated = 0;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
      className="h-40 w-40 -rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-hairline)"
        strokeWidth={stroke}
      />
      {segments.map((segment) => {
        const length = (segment.value / total) * circumference;
        const circle = (
          <circle
            key={segment.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={stroke}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={circumference - accumulated}
          />
        );
        accumulated += length;
        return circle;
      })}
    </svg>
  );
}
