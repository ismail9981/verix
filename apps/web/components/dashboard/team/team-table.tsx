"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { TeamIcon } from "../icons";
import { UserPlusIcon } from "../home/icons";
import { TableEmptyState } from "../ui/table-states";
import { MemberActions } from "./member-actions";
import { RoleBadge, StatusPill } from "./status-pill";
import { avatarColor, formatDate, initials } from "./team-format";
import type { TeamMemberListItem } from "../../../src/server/validators/team";

interface TeamTableProps {
  members: TeamMemberListItem[];
  filtersActive: boolean;
  pending: boolean;
  onView: (member: TeamMemberListItem) => void;
  onEdit: (member: TeamMemberListItem) => void;
  onRemove: (member: TeamMemberListItem) => void;
  onClearFilters: () => void;
  onInvite: () => void;
  canManage: boolean;
}

const TH = "px-5 py-2.5 font-medium";

function MemberRow({
  member,
  onView,
  onEdit,
  onRemove,
  canManage,
}: {
  member: TeamMemberListItem;
  onView: (member: TeamMemberListItem) => void;
  onEdit: (member: TeamMemberListItem) => void;
  onRemove: (member: TeamMemberListItem) => void;
  canManage: boolean;
}) {
  return (
    <tr
      onClick={() => onView(member)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColor(member.userId) }}
          >
            {initials(member.name)}
          </span>
          <span className="min-w-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onView(member);
              }}
              className="block truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {member.name}
            </button>
            {member.title ? (
              <span className="block truncate text-xs text-muted">
                {member.title}
              </span>
            ) : null}
          </span>
        </div>
      </td>
      <td className="hidden px-5 py-3 sm:table-cell">
        <RoleBadge role={member.role} />
      </td>
      <td className="hidden px-5 py-3 text-muted lg:table-cell">
        <span className="block max-w-[15rem] truncate">{member.email}</span>
      </td>
      <td className="px-5 py-3">
        <StatusPill status={member.status} />
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        {formatDate(member.createdAt)}
      </td>
      <td
        className="px-3 py-3 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <MemberActions
            onView={() => onView(member)}
            onEdit={() => onEdit(member)}
            onRemove={() => onRemove(member)}
            canManage={canManage}
          />
        </div>
      </td>
    </tr>
  );
}

export function TeamTable({
  members,
  filtersActive,
  pending,
  onView,
  onEdit,
  onRemove,
  onClearFilters,
  onInvite,
  canManage,
}: TeamTableProps) {
  return (
    <SectionCard
      id="team"
      title="Team members"
      bodyClassName="p-0"
      action={
        <span className="text-xs text-muted">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      }
    >
      {members.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={TeamIcon}
            title="No members found"
            description="No team members match your filters. Try adjusting or clearing them."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <TeamIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">
              No members yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Invite your first teammate to collaborate in this workspace.
            </p>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                className={`${CTA_SECONDARY} mt-4`}
                leftIcon={<UserPlusIcon className="h-4 w-4" />}
                onClick={onInvite}
              >
                Invite member
              </Button>
            ) : null}
          </div>
        )
      ) : (
        <div
          aria-busy={pending}
          className={`transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Team members</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>
                  Member
                </th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>
                  Role
                </th>
                <th scope="col" className={`hidden lg:table-cell ${TH}`}>
                  Email
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={`hidden md:table-cell ${TH}`}>
                  Joined
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onView={onView}
                  onEdit={onEdit}
                  onRemove={onRemove}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
