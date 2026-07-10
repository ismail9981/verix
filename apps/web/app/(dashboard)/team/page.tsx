import type { Metadata } from "next";
import { getAuthorizedWorkspace } from "../../../src/server/auth/workspace";
import {
  getTeamStats,
  listTeamMembers,
} from "../../../src/server/services/team.service";
import { teamFiltersSchema } from "../../../src/server/validators/team";
import { TeamManager } from "../../../components/dashboard/team/team-manager";

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

  const { workspaceId } = await getAuthorizedWorkspace();

  const [members, stats] = await Promise.all([
    listTeamMembers(workspaceId, filters),
    getTeamStats(workspaceId),
  ]);

  return (
    <TeamManager initialMembers={members} stats={stats} filters={filters} />
  );
}
