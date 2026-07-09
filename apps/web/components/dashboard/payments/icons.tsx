import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function RefundIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </Line>
  );
}

export function ReceiptIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </Line>
  );
}

export function WalletIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M3 9h13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3" />
      <path d="M16.5 12h.01" />
    </Line>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </Line>
  );
}
