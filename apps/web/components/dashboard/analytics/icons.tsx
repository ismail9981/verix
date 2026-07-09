import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function DownloadIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 19h16" />
    </Line>
  );
}
