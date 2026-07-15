"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { FieldSelect } from "../business-profile/field-select";
import { MailIcon, PhoneIcon } from "../bookings/icons";
import { LeadStatusPill } from "./status-pill";
import { formatDateTime, statusLabel } from "./lead-format";
import { LEAD_STATUSES, type LeadListItem, type LeadStatus } from "../../../src/server/validators/lead";

const STATUS_OPTIONS = LEAD_STATUSES.filter((s) => s !== "converted").map((s) => ({
  value: s,
  label: statusLabel(s),
}));

interface LeadDrawerProps {
  lead: LeadListItem | null;
  pending: boolean;
  onClose: () => void;
  onStatusChange: (lead: LeadListItem, status: LeadStatus) => void;
  onConvert: (lead: LeadListItem) => void;
}

export function LeadDrawer({
  lead,
  pending,
  onClose,
  onStatusChange,
  onConvert,
}: LeadDrawerProps) {
  return (
    <DetailDrawer
      open={lead !== null}
      onClose={onClose}
      title="Lead details"
      subtitle={lead ? `Submitted ${formatDateTime(lead.createdAt)}` : undefined}
      ariaLabel={lead ? `Lead from ${lead.name ?? lead.email ?? "unknown"}` : "Lead details"}
    >
      {lead ? (
        <div className="flex flex-col gap-6">
          <section aria-label="Overview" className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">
                {lead.name ?? "Unnamed lead"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Submitted {formatDateTime(lead.createdAt)}
              </p>
            </div>
            <LeadStatusPill status={lead.status} />
          </section>

          <section aria-label="Contact information" className="flex flex-col gap-2">
            <DrawerSectionTitle>Contact information</DrawerSectionTitle>
            <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface/40 p-3">
              <div className="flex items-center gap-2 text-sm text-muted">
                <MailIcon className="h-4 w-4 shrink-0" />
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="truncate transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {lead.email}
                  </a>
                ) : (
                  <span className="truncate">No email</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <PhoneIcon className="h-4 w-4 shrink-0" />
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="truncate transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="truncate">No phone</span>
                )}
              </div>
            </div>
          </section>

          <section aria-label="Message" className="flex flex-col gap-2">
            <DrawerSectionTitle>Message</DrawerSectionTitle>
            {lead.subject ? (
              <p className="text-sm font-medium text-white">{lead.subject}</p>
            ) : null}
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {lead.message?.trim() ? lead.message : "No message."}
            </p>
          </section>

          <section aria-label="Source" className="flex flex-col gap-2">
            <DrawerSectionTitle>Source</DrawerSectionTitle>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Site">{lead.siteName}</DrawerField>
              <DrawerField label="Domain">{lead.sourceDomain ?? "—"}</DrawerField>
              <DrawerField label="Page">{lead.pagePath || "/"}</DrawerField>
              <DrawerField label="Form">{lead.formKey}</DrawerField>
            </dl>
          </section>

          <section aria-label="Update status" className="flex flex-col gap-2">
            <DrawerSectionTitle>Status</DrawerSectionTitle>
            {lead.status === "converted" ? (
              <p className="text-sm text-muted">
                This lead has been converted to a customer.
              </p>
            ) : (
              <FieldSelect
                label="Status"
                options={STATUS_OPTIONS}
                value={lead.status}
                disabled={pending}
                onChange={(event) =>
                  onStatusChange(lead, event.target.value as LeadStatus)
                }
              />
            )}
          </section>

          {lead.status !== "converted" ? (
            <Button
              type="button"
              className={`${CTA_SECONDARY} w-full`}
              disabled={pending}
              onClick={() => onConvert(lead)}
            >
              Convert to customer
            </Button>
          ) : null}
        </div>
      ) : null}
    </DetailDrawer>
  );
}
