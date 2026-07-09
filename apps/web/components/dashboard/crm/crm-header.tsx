import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { UserPlusIcon } from "../home/icons";

export function CrmHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">CRM</h1>
        <p className="mt-1 text-sm text-muted">
          Manage customer relationships, history, and loyalty.
        </p>
      </div>
      <Button
        type="button"
        className={CTA_PRIMARY}
        leftIcon={<UserPlusIcon className="h-4 w-4" />}
      >
        Add customer
      </Button>
    </div>
  );
}
