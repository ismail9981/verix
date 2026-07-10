"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldInput } from "./field-input";
import { FieldSelect } from "./field-select";
import { FieldTextarea } from "./field-textarea";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { ServiceListItem } from "../../../src/server/validators/service";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "inactive", label: "Inactive" },
];

interface ServiceFormDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  service: ServiceListItem | null;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

/* Create/edit form in the shared right-side drawer. The form is uncontrolled
   (defaultValue from the edited service) and read via FormData on submit; the
   parent remounts it with a `key` to reset between open/create/edit. */
export function ServiceFormDrawer({
  open,
  mode,
  service,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: ServiceFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add service" : "Edit service"}
      subtitle="Bookable service with duration and price."
      ariaLabel={mode === "create" ? "Add service" : "Edit service"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex flex-col gap-5">
          <FieldInput
            label="Service name"
            name="name"
            required
            defaultValue={service?.name ?? ""}
            error={fieldErrors.name?.[0]}
          />
          <FieldTextarea
            label="Description"
            name="description"
            rows={3}
            defaultValue={service?.description ?? ""}
          />
          <div className="grid grid-cols-2 gap-4">
            <FieldInput
              label="Duration (min)"
              name="durationMinutes"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={service ? String(service.durationMinutes) : "30"}
              error={fieldErrors.durationMinutes?.[0]}
            />
            <FieldInput
              label="Price ($)"
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={service ? String(service.priceCents / 100) : "0"}
              error={fieldErrors.price?.[0]}
            />
          </div>
          <FieldSelect
            label="Status"
            name="status"
            options={STATUS_OPTIONS}
            defaultValue={service?.status ?? "active"}
          />
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {mode === "create" ? "Create service" : "Save changes"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
