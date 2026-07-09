"use client";

import { useEffect, useMemo, useState } from "react";
import { Reveal, RevealItem } from "../../landing/reveal";
import { CrmFiltersBar } from "./crm-filters";
import { CrmHeader } from "./crm-header";
import { CrmStats } from "./crm-stats";
import { CustomerDrawer } from "./customer-drawer";
import { CustomerTable } from "./customer-table";
import { CUSTOMERS } from "./mock-data";
import type { CrmFilters, Customer } from "./types";

const INITIAL_FILTERS: CrmFilters = {
  search: "",
  status: "all",
  tag: "all",
  lastVisit: "all",
};

function matchesFilters(customer: Customer, filters: CrmFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (
    search &&
    !`${customer.name} ${customer.email} ${customer.phone}`
      .toLowerCase()
      .includes(search)
  ) {
    return false;
  }
  if (filters.status !== "all" && customer.status !== filters.status) return false;
  if (filters.tag !== "all" && !customer.tags.includes(filters.tag)) return false;
  if (filters.lastVisit !== "all") {
    const maxDays = Number(filters.lastVisit);
    if (customer.lastVisitDays > maxDays) return false;
  }
  return true;
}

export function CrmView() {
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CrmFilters>(INITIAL_FILTERS);
  const [selected, setSelected] = useState<Customer | null>(null);

  // Simulate an initial fetch so the loading skeletons are exercised.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(
    () => CUSTOMERS.filter((customer) => matchesFilters(customer, filters)),
    [filters],
  );

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <CrmHeader />
        </RevealItem>
        <RevealItem>
          <CrmStats />
        </RevealItem>
        <RevealItem>
          <CrmFiltersBar filters={filters} onChange={setFilters} />
        </RevealItem>
        <RevealItem>
          <CustomerTable
            customers={filtered}
            loading={loading}
            onSelect={setSelected}
            onClearFilters={() => setFilters(INITIAL_FILTERS)}
          />
        </RevealItem>
      </Reveal>

      <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
    </>
  );
}
