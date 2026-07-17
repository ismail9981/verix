"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { PageHeader } from "../ui/page-header";

export function HousekeepingHeader({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <PageHeader
      title="Housekeeping"
      subtitle="Track cleaning, maintenance, and inspection tasks across your units."
      actions={
        canCreate ? (
          <Button className={CTA_PRIMARY} leftIcon={<PlusIcon className="h-4 w-4" />} onClick={onCreate}>
            New task
          </Button>
        ) : null
      }
    />
  );
}
