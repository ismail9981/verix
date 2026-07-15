"use client";

import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../landing/reveal";
import { ProfileToast, type ToastState } from "../business-profile/profile-toast";
import { LeadHeader } from "./lead-header";
import { LeadStatsGrid } from "./lead-stats";
import { LeadFiltersBar } from "./lead-filters";
import { LeadTable } from "./lead-table";
import { LeadDrawer } from "./lead-drawer";
import {
  convertLeadToCustomerAction,
  convertLeadToCustomerAndOpportunityAction,
  createOpportunityFromLeadAction,
  deleteLeadAction,
  updateLeadStatusAction,
} from "../../../src/server/actions/lead";
import type {
  LeadFilters,
  LeadFilterStatus,
  LeadListItem,
  LeadStats,
  LeadStatus,
} from "../../../src/server/validators/lead";

type OptimisticAction =
  | { type: "status"; id: string; status: LeadStatus }
  | { type: "delete"; id: string };

interface LeadManagerProps {
  initialLeads: LeadListItem[];
  stats: LeadStats;
  filters: LeadFilters;
  siteOptions: { value: string; label: string }[];
}

export function LeadManager({
  initialLeads,
  stats,
  filters,
  siteOptions,
}: LeadManagerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [leads, applyOptimistic] = useOptimistic(
    initialLeads,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "status":
          return state.map((l) =>
            l.id === action.id ? { ...l, status: action.status } : l,
          );
        case "delete":
          return state.filter((l) => l.id !== action.id);
      }
    },
  );

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState<LeadFilterStatus>(filters.status);
  const [siteId, setSiteId] = useState(filters.siteId ?? "");
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const navigate = useCallback(
    (next: {
      search: string;
      status: LeadFilterStatus;
      siteId: string;
      from: string;
      to: string;
    }) => {
      const params = new URLSearchParams();
      if (next.search.trim()) params.set("q", next.search.trim());
      if (next.status !== "all") params.set("status", next.status);
      if (next.siteId) params.set("siteId", next.siteId);
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = window.setTimeout(
      () => navigate({ search, status, siteId, from, to }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search, status, siteId, from, to, navigate]);

  const filtersActive =
    search.trim() !== "" || status !== "all" || siteId !== "" || from !== "" || to !== "";

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setSiteId("");
    setFrom("");
    setTo("");
  }

  function handleStatusChange(lead: LeadListItem, next: LeadStatus) {
    startTransition(async () => {
      applyOptimistic({ type: "status", id: lead.id, status: next });
      const formData = new FormData();
      formData.set("status", next);
      const result = await updateLeadStatusAction(lead.id, formData);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleConvert(lead: LeadListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "status", id: lead.id, status: "converted" });
      const result = await convertLeadToCustomerAction(lead.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleCreateOpportunity(lead: LeadListItem) {
    startTransition(async () => {
      const result = await createOpportunityFromLeadAction(lead.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleConvertWithOpportunity(lead: LeadListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "status", id: lead.id, status: "converted" });
      const result = await convertLeadToCustomerAndOpportunityAction(lead.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  function handleDelete(lead: LeadListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: lead.id });
      if (selectedId === lead.id) setSelectedId(null);
      const result = await deleteLeadAction(lead.id);
      setToast({
        tone: result.status === "success" ? "success" : "error",
        message: result.message,
      });
    });
  }

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <LeadHeader />
        </RevealItem>
        <RevealItem>
          <LeadStatsGrid stats={stats} />
        </RevealItem>
        <RevealItem>
          <LeadFiltersBar
            search={search}
            status={status}
            siteId={siteId}
            from={from}
            to={to}
            siteOptions={siteOptions}
            onSearch={setSearch}
            onStatus={setStatus}
            onSite={setSiteId}
            onFrom={setFrom}
            onTo={setTo}
          />
        </RevealItem>
        <RevealItem>
          <LeadTable
            leads={leads}
            loading={false}
            filtersActive={filtersActive}
            pending={isPending}
            onView={(lead) => setSelectedId(lead.id)}
            onConvert={handleConvert}
            onCreateOpportunity={handleCreateOpportunity}
            onConvertWithOpportunity={handleConvertWithOpportunity}
            onDelete={handleDelete}
            onClearFilters={clearFilters}
          />
        </RevealItem>
      </Reveal>

      <LeadDrawer
        lead={selected}
        pending={isPending}
        onClose={() => setSelectedId(null)}
        onStatusChange={handleStatusChange}
        onConvert={handleConvert}
        onCreateOpportunity={handleCreateOpportunity}
        onConvertWithOpportunity={handleConvertWithOpportunity}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
