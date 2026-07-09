/* The canonical dashboard "surface card" style. Centralizing it keeps the
   border, radius, and background identical everywhere (stat cards, filter
   bars, panels) — change it once, change it everywhere. Callers add their
   own padding (e.g. `${CARD} p-5`). */
export const CARD = "rounded-2xl border border-hairline bg-surface/40";
