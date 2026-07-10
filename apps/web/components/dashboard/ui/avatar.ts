/* Shared avatar helpers: deterministic initials and color from a name/id.
   Used by any list that shows a person avatar (CRM, Bookings). */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "#6d5ef9",
  "#f97316",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#e11d48",
  "#8b5cf6",
  "#14b8a6",
];

/** Deterministic color from a stable seed (e.g. row id), stable across renders. */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}
