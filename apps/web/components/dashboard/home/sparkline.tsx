interface SparklineProps {
  data: number[];
  trend: "up" | "down";
  className?: string;
}

/* Tiny inline trend line for the stat cards. Purely decorative — the numeric
   value and delta carry the meaning — so it is aria-hidden. */
export function Sparkline({ data, trend, className }: SparklineProps) {
  const width = 100;
  const height = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`h-8 w-full ${
        trend === "up" ? "text-emerald-400" : "text-red-400"
      } ${className ?? ""}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
