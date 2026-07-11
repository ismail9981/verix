import type { CSSProperties, ReactNode } from "react";
import type { ThemeTokens } from "./tokens";
import { tokensToCssVars } from "./css-vars";

/*
 * ThemeProvider — exposes a theme's tokens as `--wb-*` CSS custom properties on
 * a wrapper element. Sections inside consume only these variables. Pure and
 * hook-free, so it renders identically on the server and the client; the
 * base color/typography come from the `.wb-theme-root` class in globals.css.
 */

export function ThemeProvider({
  tokens,
  className,
  children,
}: {
  tokens: ThemeTokens;
  className?: string;
  children: ReactNode;
}) {
  const style = tokensToCssVars(tokens) as CSSProperties;
  return (
    <div
      className={`wb-theme-root ${className ?? ""}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
