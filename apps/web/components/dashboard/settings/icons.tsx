import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function KeyIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 8 8M16 16l2-2M18.5 18.5l1.5-1.5" />
    </Line>
  );
}

export function MonitorIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Line>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
      <path d="M10 11v6M14 11v6" />
    </Line>
  );
}

export function DatabaseIcon(p: IconProps) {
  return (
    <Line {...p}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </Line>
  );
}
