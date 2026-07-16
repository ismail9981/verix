import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function CalendarIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </Line>
  );
}

export function BedIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M3 19v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" />
      <path d="M3 19v2M21 19v2" />
      <path d="M3 12V7a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3" />
      <path d="M13 9h6a2 2 0 0 1 2 2v1" />
    </Line>
  );
}

export function ArrivalIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 3v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </Line>
  );
}

export function DepartureIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 14V3" />
      <path d="m7 7 5-5 5 5" />
      <path d="M4 20h16" />
    </Line>
  );
}

export function TrendingUpIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="m4 17 5-5 4 4 7-8" />
      <path d="M15 8h5v5" />
    </Line>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="m15 6-6 6 6 6" />
    </Line>
  );
}
