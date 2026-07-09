import type { ReactNode } from "react";
import { CARD } from "./card";

/* Shared filter toolbar wrapper (Bookings, CRM, Analytics). Keeps the surface
   and padding of every filter row identical. */
export function FilterBar({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={`${CARD} p-4`}>
      {children}
    </section>
  );
}
