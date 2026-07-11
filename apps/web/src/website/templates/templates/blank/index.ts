import { defineTemplate } from "../../define";

/*
 * Blank starter — a single empty Home page. Nothing else is assumed, so it is
 * the clean starting point for building a site from scratch.
 */
export const blankTemplate = defineTemplate({
  key: "blank",
  version: 1,
  name: "Blank",
  description: "An empty site with a single Home page to build from scratch.",
  category: "starter",
  thumbnail: "◻",
  themeKey: "modern",
  pages: [{ path: "", title: "Home" }],
  metadata: { tags: ["starter", "empty"] },
});
