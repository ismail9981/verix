import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function ShieldIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Line>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </Line>
  );
}
