"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { MailIcon, PhoneIcon } from "../bookings/icons";
import {
  DetailDrawer,
  DrawerField,
  DrawerSectionTitle,
} from "../detail-drawer";
import { TagChip } from "../crm/status-pill";
import { RoleBadge, StatusPill } from "./status-pill";
import type { Member } from "./types";

interface MemberDrawerProps {
  member: Member | null;
  onClose: () => void;
}

export function MemberDrawer({ member, onClose }: MemberDrawerProps) {
  return (
    <DetailDrawer
      open={member !== null}
      onClose={onClose}
      title="Member profile"
      subtitle={member?.title}
      ariaLabel={member ? `Member ${member.name}` : "Member profile"}
    >
      {member ? (
        <div className="flex flex-col gap-6">
          {/* Profile */}
          <section aria-label="Profile" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
              style={{ backgroundColor: member.color }}
            >
              {member.initials}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-white">
                  {member.name}
                </p>
                <RoleBadge role={member.role} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill status={member.status} />
                <span className="text-xs text-muted">{member.title}</span>
              </div>
            </div>
          </section>

          <Button type="button" fullWidth className={CTA_SECONDARY}>
            Edit member
          </Button>

          {/* Contact information */}
          <section aria-label="Contact information" className="flex flex-col gap-2">
            <DrawerSectionTitle>Contact information</DrawerSectionTitle>
            <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface/40 p-3">
              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MailIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{member.email}</span>
              </a>
              <a
                href={`tel:${member.phone}`}
                className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <PhoneIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{member.phone}</span>
              </a>
            </div>
          </section>

          {/* Assigned services */}
          <section aria-label="Assigned services" className="flex flex-col gap-2">
            <DrawerSectionTitle>Assigned services</DrawerSectionTitle>
            <ul className="flex flex-wrap gap-2">
              {member.services.map((service) => (
                <li key={service}>
                  <TagChip tag={service} />
                </li>
              ))}
            </ul>
          </section>

          {/* Weekly schedule */}
          <section aria-label="Weekly schedule" className="flex flex-col gap-1">
            <DrawerSectionTitle>Weekly schedule</DrawerSectionTitle>
            <dl className="divide-y divide-hairline">
              {member.weekly.map((entry) => (
                <DrawerField key={entry.day} label={entry.day}>
                  {entry.hours ?? <span className="text-muted">Off</span>}
                </DrawerField>
              ))}
            </dl>
          </section>

          {/* Performance */}
          <section aria-label="Performance" className="flex flex-col gap-2">
            <DrawerSectionTitle>Performance</DrawerSectionTitle>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Bookings", value: String(member.performance.bookings) },
                { label: "Revenue", value: member.performance.revenue },
                { label: "Rating", value: member.performance.rating },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-hairline bg-surface/40 p-3 text-center"
                >
                  <p className="text-base font-semibold text-white">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section aria-label="Notes" className="flex flex-col gap-2">
            <DrawerSectionTitle>Notes</DrawerSectionTitle>
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {member.notes}
            </p>
          </section>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
