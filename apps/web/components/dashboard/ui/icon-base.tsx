import type { ReactNode } from "react";
import type { IconProps } from "../types";

/* Shared icon bases so every module's icon set stops re-declaring the same
   <svg> boilerplate. IconBase is a 24px stroked line icon; GlyphBase is a
   filled glyph (brand marks, dot menus, etc.). */

export function IconBase({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function GlyphBase({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}
