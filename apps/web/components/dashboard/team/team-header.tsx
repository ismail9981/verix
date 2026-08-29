"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { UserPlusIcon } from "../home/icons";
import { PageHeader } from "../ui/page-header";

export function TeamHeader({
  onInvite,
  canManage,
}: {
  onInvite: () => void;
  canManage: boolean;
}) {
  return (
    <PageHeader
      title="Team"
      subtitle="Manage members, roles, and permissions."
      actions={
        canManage ? (
          <Button
            type="button"
            className={CTA_PRIMARY}
            leftIcon={<UserPlusIcon className="h-4 w-4" />}
            onClick={onInvite}
          >
            Invite member
          </Button>
        ) : undefined
      }
    />
  );
}
