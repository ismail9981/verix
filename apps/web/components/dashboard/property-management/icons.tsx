import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export { PropertyManagementIcon as PropertyIcon } from "../icons";

export function UnitIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M10 10v10" />
    </Line>
  );
}

export function ChevronUpIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="m6 15 6-6 6 6" />
    </Line>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="m6 9 6 6 6-6" />
    </Line>
  );
}

export function BuildingsIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="4" y="9" width="7" height="12" />
      <rect x="13" y="3" width="7" height="18" />
      <path d="M6 12h.01M6 15h.01M6 18h.01M15 6h.01M15 9h.01M15 12h.01M15 15h.01" />
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

export function CheckCircleIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" />
    </Line>
  );
}

export function SparklesIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.5 6.5 2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2" />
    </Line>
  );
}

export function WrenchIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2z" />
    </Line>
  );
}
