"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { UserPlusIcon } from "../home/icons";
import { PageHeader } from "../ui/page-header";

export function TeamHeader({ onInvite }: { onInvite: () => void }) {
  return (
    <PageHeader
      title="Team"
      subtitle="Manage members, roles, and permissions."
      actions={
        <Button
          type="button"
          className={CTA_PRIMARY}
          leftIcon={<UserPlusIcon className="h-4 w-4" />}
          onClick={onInvite}
        >
          Invite member
        </Button>
      }
    />
  );
}
