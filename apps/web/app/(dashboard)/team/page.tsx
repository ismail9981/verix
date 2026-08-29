import type { Metadata } from "next";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";
import {
  getTeamStats,
  listTeamMembers,
} from "../../../src/server/services/team.service";
import { teamFiltersSchema } from "../../../src/server/validators/team";
import { TeamManager } from "../../../components/dashboard/team/team-manager";
import { hasCapability } from "../../../src/server/auth/capabilities";

export const metadata: Metadata = {
  title: "Team",
};

// Reads live team data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}

export default async function TeamPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = teamFiltersSchema.parse({
    search: params.q ?? "",
    role: params.role ?? "all",
    status: params.status ?? "all",
  });

  const workspace = await requirePageCapability("workspace.members.read");
  const { workspaceId } = workspace;
  const canManage = hasCapability(workspace, "workspace.members.update");

  const [members, stats] = await Promise.all([
    listTeamMembers(workspaceId, filters),
    getTeamStats(workspaceId),
  ]);

  return (
    <TeamManager
      initialMembers={members}
      stats={stats}
      filters={filters}
      canManage={canManage}
    />
  );
}
