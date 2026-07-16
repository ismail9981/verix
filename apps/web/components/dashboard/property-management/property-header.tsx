"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { PageHeader } from "../ui/page-header";

export function PropertyHeader({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <PageHeader
      title="Property Management"
      subtitle="Organize properties, buildings, and rental units in one place."
      actions={
        canCreate ? (
          <Button className={CTA_PRIMARY} leftIcon={<PlusIcon className="h-4 w-4" />} onClick={onCreate}>
            Add property
          </Button>
        ) : undefined
      }
    />
  );
}
