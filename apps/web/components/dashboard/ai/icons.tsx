import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function SendIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 12l16-8-6 16-3.5-6.5L4 12Z" />
    </Line>
  );
}

export function PaperclipIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9 16.4a1.6 1.6 0 0 1-2.3-2.3l7.6-7.6" />
    </Line>
  );
}

export function MessageIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </Line>
  );
}

export function BoltIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" />
    </Line>
  );
}

export function BookmarkIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1Z" />
    </Line>
  );
}

export function MegaphoneIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M18 8a4 4 0 0 1 0 8" />
    </Line>
  );
}

export function HashIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M9 3 7 21M17 3l-2 18M4 8h16M3 16h16" />
    </Line>
  );
}

export function TemplateIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </Line>
  );
}
