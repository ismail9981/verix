export interface NavLink {
  label: string;
  href: string;
}

/* Single source of truth for primary navigation, shared by the desktop
   bar and the mobile menu so the two can never drift apart. */
export const NAV_LINKS: readonly NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
] as const;
