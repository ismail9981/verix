"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { MailIcon } from "../bookings/icons";
import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { RoleBadge, StatusPill } from "./status-pill";
import { avatarColor, formatDate, initials } from "./team-format";
import type { TeamMemberListItem } from "../../../src/server/validators/team";

interface MemberDrawerProps {
  member: TeamMemberListItem | null;
  onClose: () => void;
  onEdit: (member: TeamMemberListItem) => void;
}

export function MemberDrawer({ member, onClose, onEdit }: MemberDrawerProps) {
  return (
    <DetailDrawer
      open={member !== null}
      onClose={onClose}
      title="Member profile"
      subtitle={member?.title ?? undefined}
      ariaLabel={member ? `Member ${member.name}` : "Member profile"}
    >
      {member ? (
        <div className="flex flex-col gap-6">
          {/* Profile */}
          <section aria-label="Profile" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
              style={{ backgroundColor: avatarColor(member.userId) }}
            >
              {initials(member.name)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-white">
                  {member.name}
                </p>
                <RoleBadge role={member.role} />
              </div>
              <div className="mt-1">
                <StatusPill status={member.status} />
              </div>
            </div>
          </section>

          <Button
            type="button"
            fullWidth
            className={CTA_SECONDARY}
            onClick={() => onEdit(member)}
          >
            Edit member
          </Button>

          {/* Details */}
          <section aria-label="Details" className="flex flex-col gap-1">
            <DrawerSectionTitle>Details</DrawerSectionTitle>
            <dl className="divide-y divide-hairline">
              <DrawerField label="Email">
                <a
                  href={`mailto:${member.email}`}
                  className="inline-flex items-center gap-1.5 text-white transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <MailIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </a>
              </DrawerField>
              <DrawerField label="Role">
                <RoleBadge role={member.role} />
              </DrawerField>
              <DrawerField label="Status">
                <StatusPill status={member.status} />
              </DrawerField>
              <DrawerField label="Joined">
                {formatDate(member.createdAt)}
              </DrawerField>
            </dl>
          </section>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
