"use client";

import Link from "next/link";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { PageHeader } from "../ui/page-header";

export function ReservationHeader({
  canManageUnits,
  onManageUnits,
}: {
  canManageUnits: boolean;
  onManageUnits: () => void;
}) {
  return (
    <PageHeader
      title="Reservations"
      subtitle="Manage stays across your rooms, apartments, and villas."
      actions={
        <div className="flex items-center gap-3">
          {canManageUnits ? (
            <Button type="button" className={CTA_SECONDARY} onClick={onManageUnits}>
              Manage units
            </Button>
          ) : null}
          <Link href="/reservations/new">
            <Button className={CTA_PRIMARY} leftIcon={<PlusIcon className="h-4 w-4" />}>
              New reservation
            </Button>
          </Link>
        </div>
      }
    />
  );
}
