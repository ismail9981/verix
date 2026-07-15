"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../../landing/cta-styles";
import { DetailDrawer } from "../../detail-drawer";
import { FieldInput } from "../../business-profile/field-input";
import { FieldSelect } from "../../business-profile/field-select";
import type { FieldErrors } from "../../../../src/server/actions/action-result";
import type { CustomerListItem } from "../../../../src/server/validators/customer";
import type { TeamMemberListItem } from "../../../../src/server/validators/team";

interface OpportunityFormDrawerProps {
  open: boolean;
  pending: boolean;
  fieldErrors: FieldErrors;
  customers: CustomerListItem[];
  members: TeamMemberListItem[];
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/* Manual opportunity creation. Lead-linked opportunities are created from the
   Leads module instead (`createOpportunityFromLeadAction`) — this drawer only
   covers the manual/customer-linked path. */
export function OpportunityFormDrawer({
  open,
  pending,
  fieldErrors,
  customers,
  members,
  onClose,
  onSubmit,
}: OpportunityFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  const customerOptions = [
    { value: "", label: "No linked customer" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];
  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...members.map((m) => ({ value: m.userId, label: m.name })),
  ];

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Add opportunity"
      subtitle="Create a manual deal in your pipeline."
      ariaLabel="Add opportunity"
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex flex-col gap-5">
          <FieldInput
            label="Title"
            name="title"
            required
            placeholder="e.g. Website redesign package"
            error={fieldErrors.title?.[0]}
          />
          <FieldInput
            label="Value (USD)"
            name="valueDollars"
            type="number"
            min={0}
            step="0.01"
            defaultValue="0"
            error={fieldErrors.valueCents?.[0]}
          />
          <FieldSelect label="Linked customer" name="customerId" options={customerOptions} defaultValue="" />
          <FieldSelect label="Assign to" name="assignedToUserId" options={assigneeOptions} defaultValue="" />
          <FieldInput
            label="Expected close date"
            name="expectedCloseDate"
            type="date"
            error={fieldErrors.expectedCloseDate?.[0]}
          />
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            Create opportunity
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
