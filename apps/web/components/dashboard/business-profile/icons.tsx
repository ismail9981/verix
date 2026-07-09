import type { IconProps } from "../types";
import { GlyphBase as Glyph, IconBase as Line } from "../ui/icon-base";

export function UploadIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      <path d="M12 15V4M8 8l4-4 4 4" />
    </Line>
  );
}

export function ImageIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L20 21" />
    </Line>
  );
}

/* -- Social brand glyphs (LinkedIn + X reused from ../../landing/icons) -- */

export function FacebookIcon(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    </Glyph>
  );
}

export function InstagramIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </Line>
  );
}
