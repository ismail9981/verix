"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { UserPlusIcon } from "../home/icons";
import { PageHeader } from "../ui/page-header";

export function CrmHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <PageHeader
      title="CRM"
      subtitle="Manage customer relationships, history, and loyalty."
      actions={
        <Button
          type="button"
          className={CTA_PRIMARY}
          leftIcon={<UserPlusIcon className="h-4 w-4" />}
          onClick={onAdd}
        >
          Add customer
        </Button>
      }
    />
  );
}
