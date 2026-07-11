import { defineTheme } from "../define";

/** Elegant — a warm, serif theme with generous spacing and outline buttons. */
export const elegantTheme = defineTheme({
  key: "elegant",
  version: 1,
  displayName: "Elegant",
  description: "A warm, editorial theme with serif type.",
  category: "Editorial",
  tokens: {
    colors: {
      primary: "#7c5e3b",
      secondary: "#b08968",
      accent: "#a3512b",
      background: "#faf6f0",
      surface: "#ffffff",
      text: "#2b2118",
      muted: "#8a7a6a",
      border: "#e7ded2",
      success: "#4d7c0f",
      warning: "#b45309",
      danger: "#b91c1c",
    },
    typography: {
      headingFont: "Georgia, 'Times New Roman', serif",
      bodyFont: "Georgia, serif",
      fontScale: 1.05,
    },
    radius: { xs: "2px", sm: "4px", md: "8px", lg: "14px", xl: "20px" },
    shadows: {
      sm: "0 1px 3px rgba(43,33,24,0.08)",
      md: "0 4px 14px rgba(43,33,24,0.1)",
      lg: "0 12px 30px rgba(43,33,24,0.14)",
    },
    layout: {
      contentWidth: "60rem",
      sectionSpacing: "4.5rem",
      containerPadding: "2rem",
    },
    buttons: { variant: "outline", radius: "sm", size: "lg" },
  },
  preview: { swatches: ["#7c5e3b", "#a3512b", "#faf6f0"], sample: "Aa" },
  metadata: { tags: ["light", "elegant", "editorial"], mode: "light" },
});
