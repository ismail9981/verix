import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function GripIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={p.className}>
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

export function GlobeIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" />
    </Line>
  );
}

export function ExternalLinkIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </Line>
  );
}

export function EyeIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
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
