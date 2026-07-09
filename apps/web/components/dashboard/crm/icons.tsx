import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function StarIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.9 6.8 20.6l1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
    </Line>
  );
}

export function RepeatIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M17 3l3 3-3 3" />
      <path d="M20 6H8a4 4 0 0 0-4 4v1" />
      <path d="M7 21l-3-3 3-3" />
      <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
    </Line>
  );
}
