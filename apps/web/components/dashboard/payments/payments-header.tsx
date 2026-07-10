"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { PageHeader } from "../ui/page-header";

export function PaymentsHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <PageHeader
      title="Payments"
      subtitle="Track invoices, revenue, refunds, and payment methods."
      actions={
        <Button
          type="button"
          className={CTA_PRIMARY}
          leftIcon={<PlusIcon className="h-4 w-4" />}
          onClick={onAdd}
        >
          Record payment
        </Button>
      }
    />
  );
}
