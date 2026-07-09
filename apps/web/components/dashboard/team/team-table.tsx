"use client";

import { SectionCard } from "../home/section-card";
import { TeamIcon } from "../icons";
import { TableEmptyState, TableSkeleton } from "../ui/table-states";
import { MemberActions } from "./member-actions";
import { RoleBadge, StatusPill } from "./status-pill";
import type { Member } from "./types";

interface TeamTableProps {
  members: Member[];
  loading: boolean;
  onSelect: (member: Member) => void;
  onClearFilters: () => void;
}

const TH = "px-5 py-2.5 font-medium";

function MemberRow({
  member,
  onSelect,
}: {
  member: Member;
  onSelect: (member: Member) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(member)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: member.color }}
          >
            {member.initials}
          </span>
          <span className="min-w-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(member);
              }}
              className="block truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {member.name}
            </button>
            <span className="block truncate text-xs text-muted">{member.title}</span>
          </span>
        </div>
      </td>
      <td className="hidden px-5 py-3 sm:table-cell">
        <RoleBadge role={member.role} />
      </td>
      <td className="hidden px-5 py-3 text-muted lg:table-cell">
        <span className="block max-w-[15rem] truncate">{member.email}</span>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted xl:table-cell">
        {member.phone}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={member.status} />
      </td>
      <td className="hidden whitespace-nowrap px-5 py-3 text-muted md:table-cell">
        {member.schedule}
      </td>
      <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <MemberActions onView={() => onSelect(member)} />
        </div>
      </td>
    </tr>
  );
}

export function TeamTable({
  members,
  loading,
  onSelect,
  onClearFilters,
}: TeamTableProps) {
  return (
    <SectionCard
      id="team"
      title="Team members"
      bodyClassName="p-0"
      action={
        !loading ? (
          <span className="text-xs text-muted">{members.length} members</span>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : members.length === 0 ? (
        <TableEmptyState
          icon={TeamIcon}
          title="No members found"
          description="No team members match your current filters. Try adjusting or clearing them."
          onClear={onClearFilters}
        />
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Team members</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className={TH}>Member</th>
              <th scope="col" className={`hidden sm:table-cell ${TH}`}>Role</th>
              <th scope="col" className={`hidden lg:table-cell ${TH}`}>Email</th>
              <th scope="col" className={`hidden xl:table-cell ${TH}`}>Phone</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={`hidden md:table-cell ${TH}`}>Schedule</th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <MemberRow key={member.id} member={member} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
