"use client";

import { useEffect, useMemo, useState } from "react";
import { Reveal, RevealItem } from "../../landing/reveal";
import { MemberDrawer } from "./member-drawer";
import { RecentActivity } from "./recent-activity";
import { TeamFiltersBar } from "./team-filters";
import { TeamHeader } from "./team-header";
import { TeamSchedule } from "./team-schedule";
import { TeamStats } from "./team-stats";
import { TeamTable } from "./team-table";
import { MEMBERS } from "./mock-data";
import type { Member, TeamFilters } from "./types";

const INITIAL_FILTERS: TeamFilters = {
  search: "",
  role: "all",
  status: "all",
};

function matchesFilters(member: Member, filters: TeamFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (
    search &&
    !`${member.name} ${member.email}`.toLowerCase().includes(search)
  ) {
    return false;
  }
  if (filters.role !== "all" && member.role !== filters.role) return false;
  if (filters.status !== "all" && member.status !== filters.status) return false;
  return true;
}

export function TeamView() {
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TeamFilters>(INITIAL_FILTERS);
  const [selected, setSelected] = useState<Member | null>(null);

  // Simulate an initial fetch so the loading skeleton is exercised.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(
    () => MEMBERS.filter((member) => matchesFilters(member, filters)),
    [filters],
  );

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <TeamHeader />
        </RevealItem>
        <RevealItem>
          <TeamStats />
        </RevealItem>
        <RevealItem>
          <TeamFiltersBar filters={filters} onChange={setFilters} />
        </RevealItem>
        <RevealItem>
          <TeamTable
            members={filtered}
            loading={loading}
            onSelect={setSelected}
            onClearFilters={() => setFilters(INITIAL_FILTERS)}
          />
        </RevealItem>
        <RevealItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TeamSchedule />
            <RecentActivity />
          </div>
        </RevealItem>
      </Reveal>

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </>
  );
}
