import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function InboxIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 4h16l3 8v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6l3-8Z" />
      <path d="M1 12h6l2 3h6l2-3h6" />
    </Line>
  );
}

export function FlagIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2.5 4L16 12H5" />
    </Line>
  );
}
