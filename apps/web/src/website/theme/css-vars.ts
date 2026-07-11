import type { ButtonSize, ThemeTokens } from "./tokens";

/*
 * Flattens theme tokens into the `--wb-*` CSS custom properties that sections
 * consume. Results are cached by token-object identity (WeakMap), so resolving
 * a registry theme's variables is constant time with no repeated cloning.
 */

const BUTTON_PADDING: Record<ButtonSize, string> = {
  sm: "6px 12px",
  md: "8px 16px",
  lg: "12px 22px",
};
const BUTTON_FONT_SIZE: Record<ButtonSize, string> = {
  sm: "13px",
  md: "14px",
  lg: "16px",
};

/** Pick a readable foreground (near-black/near-white) for a solid button. */
function readableTextOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#0a0a0a" : "#ffffff";
}

const cache = new WeakMap<ThemeTokens, Record<string, string>>();

export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  const cached = cache.get(tokens);
  if (cached) return cached;

  const { colors, typography, radius, shadows, layout, buttons } = tokens;

  const button =
    buttons.variant === "solid"
      ? {
          bg: colors.primary,
          fg: readableTextOn(colors.primary),
          border: "transparent",
        }
      : buttons.variant === "outline"
        ? { bg: "transparent", fg: colors.primary, border: colors.primary }
        : { bg: "transparent", fg: colors.primary, border: "transparent" };

  const vars: Record<string, string> = {
    "--wb-color-primary": colors.primary,
    "--wb-color-secondary": colors.secondary,
    "--wb-color-accent": colors.accent,
    "--wb-color-background": colors.background,
    "--wb-color-surface": colors.surface,
    "--wb-color-text": colors.text,
    "--wb-color-muted": colors.muted,
    "--wb-color-border": colors.border,
    "--wb-color-success": colors.success,
    "--wb-color-warning": colors.warning,
    "--wb-color-danger": colors.danger,
    "--wb-font-heading": typography.headingFont,
    "--wb-font-body": typography.bodyFont,
    "--wb-font-scale": String(typography.fontScale),
    "--wb-radius-xs": radius.xs,
    "--wb-radius-sm": radius.sm,
    "--wb-radius-md": radius.md,
    "--wb-radius-lg": radius.lg,
    "--wb-radius-xl": radius.xl,
    "--wb-shadow-sm": shadows.sm,
    "--wb-shadow-md": shadows.md,
    "--wb-shadow-lg": shadows.lg,
    "--wb-content-width": layout.contentWidth,
    "--wb-section-spacing": layout.sectionSpacing,
    "--wb-container-padding": layout.containerPadding,
    "--wb-button-radius": radius[buttons.radius],
    "--wb-button-bg": button.bg,
    "--wb-button-fg": button.fg,
    "--wb-button-border": button.border,
    "--wb-button-padding": BUTTON_PADDING[buttons.size],
    "--wb-button-font-size": BUTTON_FONT_SIZE[buttons.size],
  };

  cache.set(tokens, vars);
  return vars;
}
