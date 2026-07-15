"use client";

import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../../landing/cta-styles";
import { UserPlusIcon } from "../../home/icons";
import { PageHeader } from "../../ui/page-header";
import type { PipelineDto } from "../../../../src/server/services/crm-pipeline.service";

interface PipelineHeaderProps {
  pipelines: PipelineDto[];
  pipelineId: string;
  onPipelineChange: (pipelineId: string) => void;
  onAdd: () => void;
}

export function PipelineHeader({
  pipelines,
  pipelineId,
  onPipelineChange,
  onAdd,
}: PipelineHeaderProps) {
  return (
    <PageHeader
      title="Pipeline"
      subtitle="Track opportunities from lead to close."
      actions={
        <div className="flex items-center gap-2">
          {pipelines.length > 1 ? (
            <>
              <label className="sr-only" htmlFor="pipeline-select">
                Pipeline
              </label>
              <select
                id="pipeline-select"
                value={pipelineId}
                onChange={(event) => onPipelineChange(event.target.value)}
                className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <Button
            type="button"
            className={CTA_PRIMARY}
            leftIcon={<UserPlusIcon className="h-4 w-4" />}
            onClick={onAdd}
          >
            Add opportunity
          </Button>
        </div>
      }
    />
  );
}
