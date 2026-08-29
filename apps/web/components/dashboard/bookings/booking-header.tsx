"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { PageHeader } from "../ui/page-header";

export function BookingHeader({
  onAdd,
  canManage,
}: {
  onAdd: () => void;
  canManage: boolean;
}) {
  return (
    <PageHeader
      title="Bookings"
      subtitle="Manage appointments, staff, and customer schedules."
      actions={
        canManage ? (
          <Button
            type="button"
            className={CTA_PRIMARY}
            leftIcon={<PlusIcon className="h-4 w-4" />}
            onClick={onAdd}
          >
            New booking
          </Button>
        ) : undefined
      }
    />
  );
}
