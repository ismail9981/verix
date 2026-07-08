import { TrendDownIcon, TrendUpIcon } from "./icons";

interface DeltaPillProps {
  delta: string;
  trend: "up" | "down";
}

/* Small up/down change badge, shared by stat cards. */
export function DeltaPill({ delta, trend }: DeltaPillProps) {
  const Icon = trend === "up" ? TrendUpIcon : TrendDownIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        trend === "up"
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {delta}
    </span>
  );
}
