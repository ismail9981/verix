"use client";

import { useEffect, useMemo, useState } from "react";
import { Reveal, RevealItem } from "../../landing/reveal";
import { PaymentDrawer } from "./payment-drawer";
import { PaymentsFiltersBar } from "./payments-filters";
import { PaymentsHeader } from "./payments-header";
import { PaymentsStats } from "./payments-stats";
import { PaymentsTable } from "./payments-table";
import { RecentTransactions } from "./recent-transactions";
import { RevenueSummary } from "./revenue-summary";
import { PAYMENTS } from "./mock-data";
import type { Payment, PaymentFilters } from "./types";

const INITIAL_FILTERS: PaymentFilters = {
  search: "",
  status: "all",
  method: "all",
  date: "all",
};

function matchesFilters(payment: Payment, filters: PaymentFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (
    search &&
    !`${payment.invoice} ${payment.customer.name}`.toLowerCase().includes(search)
  ) {
    return false;
  }
  if (filters.status !== "all" && payment.status !== filters.status) return false;
  if (filters.method !== "all" && payment.method !== filters.method) return false;
  if (filters.date !== "all" && payment.dateDays > Number(filters.date)) return false;
  return true;
}

export function PaymentsView() {
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PaymentFilters>(INITIAL_FILTERS);
  const [selected, setSelected] = useState<Payment | null>(null);

  // Simulate an initial fetch so the loading skeleton is exercised.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(
    () => PAYMENTS.filter((payment) => matchesFilters(payment, filters)),
    [filters],
  );

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <PaymentsHeader />
        </RevealItem>
        <RevealItem>
          <PaymentsStats />
        </RevealItem>
        <RevealItem>
          <PaymentsFiltersBar filters={filters} onChange={setFilters} />
        </RevealItem>
        <RevealItem>
          <PaymentsTable
            payments={filtered}
            loading={loading}
            onSelect={setSelected}
            onClearFilters={() => setFilters(INITIAL_FILTERS)}
          />
        </RevealItem>
        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RevenueSummary />
            <RecentTransactions />
          </div>
        </RevealItem>
      </Reveal>

      <PaymentDrawer payment={selected} onClose={() => setSelected(null)} />
    </>
  );
}
