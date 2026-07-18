import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorizedWorkspace } from "../../../../src/server/auth/workspace";
import { getHousekeepingTask } from "../../../../src/server/services/housekeeping.service";
import { listStaffOptions } from "../../../../src/server/services/reservation.service";
import { NotFoundError } from "../../../../src/server/services/errors";
import { AuthorizationError } from "../../../../src/server/auth/rbac";
import { HousekeepingDetail } from "../../../../components/dashboard/housekeeping/housekeeping-detail";

export const metadata: Metadata = {
  title: "Housekeeping task",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ taskId: string }>;
}

export default async function HousekeepingTaskPage({ params }: PageProps) {
  const { taskId } = await params;
  const { workspaceId, userId, role } = await getAuthorizedWorkspace();

  let task;
  try {
    task = await getHousekeepingTask(workspaceId, taskId, { userId, role });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AuthorizationError) notFound();
    throw error;
  }

  const teamMemberOptions = await listStaffOptions(workspaceId);

  return <HousekeepingDetail task={task} teamMemberOptions={teamMemberOptions} role={role} />;
}
