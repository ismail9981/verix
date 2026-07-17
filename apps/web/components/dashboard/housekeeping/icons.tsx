import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function SparkleIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6 6 2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </Line>
  );
}

export function WrenchIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 4.6L3 17.2V21h3.8l6.3-6.3a4 4 0 0 0 4.6-5.4l-2.8 2.8-2-2 2.8-2.8Z" />
    </Line>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Line>
  );
}

export function CheckCircleIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </Line>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4M12 17h.01" />
    </Line>
  );
}
