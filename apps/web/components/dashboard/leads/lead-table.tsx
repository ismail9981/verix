"use client";

import { SectionCard } from "../home/section-card";
import { TableEmptyState, TableSkeleton } from "../ui/table-states";
import { InboxIcon } from "./icons";
import { LeadActions } from "./lead-actions";
import { LeadStatusPill } from "./status-pill";
import { formatDate } from "./lead-format";
import type { LeadListItem } from "../../../src/server/validators/lead";

interface LeadTableProps {
  leads: LeadListItem[];
  loading: boolean;
  filtersActive: boolean;
  pending: boolean;
  onView: (lead: LeadListItem) => void;
  onConvert: (lead: LeadListItem) => void;
  onCreateOpportunity: (lead: LeadListItem) => void;
  onConvertWithOpportunity: (lead: LeadListItem) => void;
  onDelete: (lead: LeadListItem) => void;
  onClearFilters: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function contactSummary(lead: LeadListItem): string {
  return lead.email ?? lead.phone ?? "No contact info";
}

function LeadRow({
  lead,
  onView,
  onConvert,
  onCreateOpportunity,
  onConvertWithOpportunity,
  onDelete,
}: {
  lead: LeadListItem;
  onView: (lead: LeadListItem) => void;
  onConvert: (lead: LeadListItem) => void;
  onCreateOpportunity: (lead: LeadListItem) => void;
  onConvertWithOpportunity: (lead: LeadListItem) => void;
  onDelete: (lead: LeadListItem) => void;
}) {
  return (
    <tr
      onClick={() => onView(lead)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(lead);
          }}
          className="truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {lead.name ?? "Unnamed lead"}
        </button>
        <p className="truncate text-xs text-muted">{contactSummary(lead)}</p>
      </td>
      <td className="hidden px-5 py-3 text-muted lg:table-cell">
        <span className="block max-w-[16rem] truncate">
          {lead.subject ?? lead.message ?? "—"}
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        <span className="block max-w-[10rem] truncate">
          {lead.sourceDomain ?? lead.siteName}
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted sm:table-cell">
        {formatDate(lead.createdAt)}
      </td>
      <td className="px-5 py-3">
        <LeadStatusPill status={lead.status} />
      </td>
      <td
        className="px-3 py-3 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <LeadActions
            lead={lead}
            onView={() => onView(lead)}
            onConvert={() => onConvert(lead)}
            onCreateOpportunity={() => onCreateOpportunity(lead)}
            onConvertWithOpportunity={() => onConvertWithOpportunity(lead)}
            onDelete={() => onDelete(lead)}
          />
        </div>
      </td>
    </tr>
  );
}

export function LeadTable({
  leads,
  loading,
  filtersActive,
  pending,
  onView,
  onConvert,
  onCreateOpportunity,
  onConvertWithOpportunity,
  onDelete,
  onClearFilters,
}: LeadTableProps) {
  return (
    <SectionCard
      id="leads"
      title="All leads"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">
            {leads.length} {leads.length === 1 ? "result" : "results"}
          </span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : leads.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={InboxIcon}
            title="No leads found"
            description="No leads match your filters. Try adjusting or clearing them."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <InboxIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">No leads yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Submissions from your published site&apos;s contact forms will show up here.
            </p>
          </div>
        )
      ) : (
        <div
          aria-busy={pending}
          className={`transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Leads</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>
                  Lead
                </th>
                <th scope="col" className={`hidden lg:table-cell ${TH}`}>
                  Subject
                </th>
                <th scope="col" className={`hidden md:table-cell ${TH}`}>
                  Source
                </th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>
                  Submitted
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onView={onView}
                  onConvert={onConvert}
                  onCreateOpportunity={onCreateOpportunity}
                  onConvertWithOpportunity={onConvertWithOpportunity}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
