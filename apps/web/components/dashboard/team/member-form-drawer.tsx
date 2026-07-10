"use client";

import type { FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { TeamMemberListItem } from "../../../src/server/validators/team";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
];

interface MemberFormDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  member: TeamMemberListItem | null;
  pending: boolean;
  fieldErrors: FieldErrors;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

export function MemberFormDrawer({
  open,
  mode,
  member,
  pending,
  fieldErrors,
  onClose,
  onSubmit,
}: MemberFormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Invite member" : "Edit member"}
      subtitle={
        mode === "create"
          ? "Add a teammate to this workspace."
          : (member?.name ?? undefined)
      }
      ariaLabel={mode === "create" ? "Invite member" : "Edit member"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex flex-col gap-5">
          {mode === "create" ? (
            <>
              <FieldInput
                label="Name"
                name="name"
                required
                defaultValue=""
                error={fieldErrors.name?.[0]}
              />
              <FieldInput
                label="Email"
                name="email"
                type="email"
                required
                defaultValue=""
                error={fieldErrors.email?.[0]}
              />
              <FieldSelect
                label="Role"
                name="role"
                options={ROLE_OPTIONS}
                defaultValue="employee"
              />
            </>
          ) : (
            <>
              {/* Read-only identity for context; role/status are editable. */}
              <div className="rounded-xl border border-hairline bg-surface/40 p-3">
                <p className="text-sm font-medium text-white">{member?.name}</p>
                <p className="truncate text-xs text-muted">{member?.email}</p>
              </div>
              <FieldSelect
                label="Role"
                name="role"
                options={ROLE_OPTIONS}
                defaultValue={member?.role ?? "employee"}
              />
              <FieldSelect
                label="Status"
                name="status"
                options={STATUS_OPTIONS}
                defaultValue={member?.status ?? "active"}
              />
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {mode === "create" ? "Send invite" : "Save changes"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
