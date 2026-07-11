import { defineTheme } from "../define";

/** Minimal — a clean, light theme with tight radii and subtle shadows. */
export const minimalTheme = defineTheme({
  key: "minimal",
  version: 1,
  displayName: "Minimal",
  description: "A clean, light theme with crisp edges.",
  category: "Light",
  tokens: {
    colors: {
      primary: "#111827",
      secondary: "#6b7280",
      accent: "#2563eb",
      background: "#ffffff",
      surface: "#f9fafb",
      text: "#111827",
      muted: "#6b7280",
      border: "#e5e7eb",
      success: "#059669",
      warning: "#d97706",
      danger: "#dc2626",
    },
    typography: {
      headingFont: "Inter, system-ui, sans-serif",
      bodyFont: "Inter, system-ui, sans-serif",
      fontScale: 1,
    },
    radius: { xs: "2px", sm: "4px", md: "6px", lg: "8px", xl: "12px" },
    shadows: {
      sm: "0 1px 2px rgba(0,0,0,0.06)",
      md: "0 2px 8px rgba(0,0,0,0.08)",
      lg: "0 8px 24px rgba(0,0,0,0.12)",
    },
    layout: {
      contentWidth: "64rem",
      sectionSpacing: "3.5rem",
      containerPadding: "1.5rem",
    },
    buttons: { variant: "solid", radius: "sm", size: "md" },
  },
  preview: { swatches: ["#111827", "#2563eb", "#f9fafb"], sample: "Aa" },
  metadata: { tags: ["light", "minimal", "clean"], mode: "light" },
});
