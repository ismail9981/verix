import { defineTheme } from "../define";

/** Modern — the default dark theme (matches the Verix product aesthetic). */
export const modernTheme = defineTheme({
  key: "modern",
  version: 1,
  displayName: "Modern",
  description: "A sleek dark theme with a violet accent.",
  category: "Dark",
  tokens: {
    colors: {
      primary: "#6d5ef9",
      secondary: "#2dd4bf",
      accent: "#f59e0b",
      background: "#09090b",
      surface: "#18181b",
      text: "#fafafa",
      muted: "#a1a1aa",
      border: "#27272a",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
    },
    typography: {
      headingFont: "Inter, system-ui, sans-serif",
      bodyFont: "Inter, system-ui, sans-serif",
      fontScale: 1,
    },
    radius: { xs: "4px", sm: "6px", md: "10px", lg: "16px", xl: "24px" },
    shadows: {
      sm: "0 1px 2px rgba(0,0,0,0.3)",
      md: "0 4px 12px rgba(0,0,0,0.35)",
      lg: "0 12px 32px rgba(0,0,0,0.45)",
    },
    layout: {
      contentWidth: "72rem",
      sectionSpacing: "4rem",
      containerPadding: "1.5rem",
    },
    buttons: { variant: "solid", radius: "md", size: "md" },
  },
  preview: { swatches: ["#6d5ef9", "#f59e0b", "#18181b"], sample: "Aa" },
  metadata: { tags: ["dark", "modern", "saas"], mode: "dark" },
});
