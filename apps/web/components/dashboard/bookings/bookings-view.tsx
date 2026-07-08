"use client";

import { useEffect, useMemo, useState } from "react";
import { Reveal, RevealItem } from "../../landing/reveal";
import { BookingDrawer } from "./booking-drawer";
import { BookingFiltersBar } from "./booking-filters";
import { BookingHeader } from "./booking-header";
import { BookingStats } from "./booking-stats";
import { BookingTable } from "./booking-table";
import { BOOKINGS } from "./mock-data";
import type { Booking, BookingFilters } from "./types";

const INITIAL_FILTERS: BookingFilters = {
  search: "",
  status: "all",
  service: "all",
  staff: "all",
  date: "",
};

function matchesFilters(booking: Booking, filters: BookingFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (
    search &&
    !`${booking.customer.name} ${booking.service}`.toLowerCase().includes(search)
  ) {
    return false;
  }
  if (filters.status !== "all" && booking.status !== filters.status) return false;
  if (filters.service !== "all" && booking.service !== filters.service) return false;
  if (filters.staff !== "all" && booking.staff !== filters.staff) return false;
  if (filters.date && booking.dateISO !== filters.date) return false;
  return true;
}

export function BookingsView() {
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BookingFilters>(INITIAL_FILTERS);
  const [selected, setSelected] = useState<Booking | null>(null);

  // Simulate an initial fetch so the loading skeletons are exercised.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(
    () => BOOKINGS.filter((booking) => matchesFilters(booking, filters)),
    [filters],
  );

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <BookingHeader />
        </RevealItem>
        <RevealItem>
          <BookingStats />
        </RevealItem>
        <RevealItem>
          <BookingFiltersBar filters={filters} onChange={setFilters} />
        </RevealItem>
        <RevealItem>
          <BookingTable
            bookings={filtered}
            loading={loading}
            onSelect={setSelected}
            onClearFilters={() => setFilters(INITIAL_FILTERS)}
          />
        </RevealItem>
      </Reveal>

      <BookingDrawer booking={selected} onClose={() => setSelected(null)} />
    </>
  );
}
