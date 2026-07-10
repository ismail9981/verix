"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { FieldTextarea } from "../business-profile/field-textarea";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { CustomerListItem } from "../../../src/server/validators/customer";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "new", label: "New" },
  { value: "vip", label: "VIP" },
  { value: "inactive", label: "Inactive" },
];

interface CustomerFormDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  customer: CustomerListItem | null;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/* Create/edit form in the shared drawer. Uncontrolled (defaultValue from the
   edited customer), read via FormData on submit; the parent remounts it with a
   `key` to reset between create/edit. */
export function CustomerFormDrawer({
  open,
  mode,
  customer,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: CustomerFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add customer" : "Edit customer"}
      subtitle="Contact details and status."
      ariaLabel={mode === "create" ? "Add customer" : "Edit customer"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex flex-col gap-5">
          <FieldInput
            label="Full name"
            name="name"
            required
            defaultValue={customer?.name ?? ""}
            error={fieldErrors.name?.[0]}
          />
          <FieldInput
            label="Email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            error={fieldErrors.email?.[0]}
          />
          <FieldInput
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={customer?.phone ?? ""}
            error={fieldErrors.phone?.[0]}
          />
          <FieldSelect
            label="Status"
            name="status"
            options={STATUS_OPTIONS}
            defaultValue={customer?.status ?? "new"}
          />
          <FieldTextarea
            label="Notes"
            name="notes"
            rows={3}
            defaultValue={customer?.notes ?? ""}
          />
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {mode === "create" ? "Create customer" : "Save changes"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
