import type { Metadata } from "next";
import { requirePageCapability } from "../../../../src/server/auth/page-authorization";
import {
  ensureDefaultPipeline,
  getPipelineWithStages,
  listPipelines,
} from "../../../../src/server/services/crm-pipeline.service";
import {
  getPipelineMetrics,
  listOpportunities,
} from "../../../../src/server/services/crm-opportunity.service";
import { listCustomers } from "../../../../src/server/services/customer.service";
import { listTeamMembers } from "../../../../src/server/services/team.service";
import { opportunityFiltersSchema } from "../../../../src/server/validators/crm-pipeline";
import { PipelineManager } from "../../../../components/dashboard/crm/pipeline/pipeline-manager";
import { hasCapability } from "../../../../src/server/auth/capabilities";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Pipeline",
};

// Reads live opportunity/activity data on every request — never prerendered/cached.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ pipelineId?: string }>;
}

export default async function CrmPipelinePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const workspace = await requirePageCapability("crm.pipeline.read");
  const { workspaceId, userId, role } = workspace;
  const canManage = hasCapability(workspace, "crm.pipeline.manage");

  const pipelines = await listPipelines(workspaceId);
  const defaultPipeline = canManage
    ? await ensureDefaultPipeline(workspaceId)
    : pipelines[0]
      ? await getPipelineWithStages(workspaceId, pipelines[0].id)
      : notFound();

  let pipeline = defaultPipeline;
  if (params.pipelineId && params.pipelineId !== defaultPipeline.id) {
    try {
      pipeline = await getPipelineWithStages(workspaceId, params.pipelineId);
    } catch {
      pipeline = defaultPipeline;
    }
  }

  const filters = opportunityFiltersSchema.parse({ pipelineId: pipeline.id });

  const [opportunities, metrics, customers, members] = await Promise.all([
    listOpportunities(workspaceId, { userId, role }, filters),
    getPipelineMetrics(workspaceId, pipeline.id, { userId, role }),
    canManage ? listCustomers(workspaceId, {}) : Promise.resolve([]),
    canManage
      ? listTeamMembers(workspaceId, { status: "active" })
      : Promise.resolve([]),
  ]);

  return (
    <PipelineManager
      pipelines={pipelines}
      pipelineId={pipeline.id}
      stages={pipeline.stages}
      initialOpportunities={opportunities}
      metrics={metrics}
      customers={customers}
      members={members}
    />
  );
}
