"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reveal, RevealItem } from "../../../landing/reveal";
import { ProfileToast, type ToastState } from "../../business-profile/profile-toast";
import { CrmNavTabs } from "../crm-nav-tabs";
import { PipelineHeader } from "./pipeline-header";
import { PipelineMetrics } from "./pipeline-metrics";
import { PipelineBoard } from "./pipeline-board";
import { OpportunityDrawer } from "./opportunity-drawer";
import { OpportunityFormDrawer } from "./opportunity-form-drawer";
import {
  archiveOpportunityAction,
  createOpportunityAction,
  markOpportunityLostAction,
  markOpportunityWonAction,
  moveOpportunityToStageAction,
  updateOpportunityAction,
} from "../../../../src/server/actions/crm-opportunity";
import type { FieldErrors } from "../../../../src/server/actions/action-result";
import type { CrmMetrics, OpportunityListItem } from "../../../../src/server/services/crm-opportunity.service";
import type { PipelineDto, StageDto } from "../../../../src/server/services/crm-pipeline.service";
import type { CustomerListItem } from "../../../../src/server/validators/customer";
import type { TeamMemberListItem } from "../../../../src/server/validators/team";

type OptimisticAction =
  | { type: "move"; id: string; stageId: string; stageIsWon: boolean; stageIsLost: boolean }
  | { type: "archive"; id: string };

interface PipelineManagerProps {
  pipelines: PipelineDto[];
  pipelineId: string;
  stages: StageDto[];
  initialOpportunities: OpportunityListItem[];
  metrics: CrmMetrics;
  customers: CustomerListItem[];
  members: TeamMemberListItem[];
}

/** valueDollars input (e.g. "12.5") -> cents, rewritten into a fresh FormData with valueCents for the server action's schema. */
function withValueCents(formData: FormData): FormData {
  const next = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key === "valueDollars") continue;
    next.set(key, value);
  }
  const dollars = Number(formData.get("valueDollars") ?? 0);
  const cents = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
  next.set("valueCents", String(Math.max(0, cents)));
  return next;
}

export function PipelineManager({
  pipelines,
  pipelineId,
  stages,
  initialOpportunities,
  metrics,
  customers,
  members,
}: PipelineManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [opportunities, applyOptimistic] = useOptimistic(
    initialOpportunities,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "move": {
          const stage = stages.find((s) => s.id === action.stageId);
          return state.map((o) =>
            o.id === action.id
              ? {
                  ...o,
                  stageId: action.stageId,
                  stageName: stage?.name ?? o.stageName,
                  stageIsWon: action.stageIsWon,
                  stageIsLost: action.stageIsLost,
                  status: action.stageIsWon ? "won" : action.stageIsLost ? "lost" : "open",
                }
              : o,
          );
        }
        case "archive":
          return state.filter((o) => o.id !== action.id);
      }
    },
  );

  const [selected, setSelected] = useState<OpportunityListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  function handlePipelineChange(nextPipelineId: string) {
    router.push(`/crm/pipeline?pipelineId=${nextPipelineId}`);
  }

  function handleMoveToStage(opportunity: OpportunityListItem, stageId: string) {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    startTransition(async () => {
      applyOptimistic({ type: "move", id: opportunity.id, stageId, stageIsWon: stage.isWon, stageIsLost: stage.isLost });
      const result = await moveOpportunityToStageAction(opportunity.id, stageId);
      if (result.status === "error") setToast({ tone: "error", message: result.message });
    });
  }

  function handleMarkWon(opportunity: OpportunityListItem) {
    startTransition(async () => {
      const wonStage = stages.find((s) => s.isWon);
      if (wonStage) {
        applyOptimistic({ type: "move", id: opportunity.id, stageId: wonStage.id, stageIsWon: true, stageIsLost: false });
      }
      const result = await markOpportunityWonAction(opportunity.id);
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  function handleMarkLost(opportunity: OpportunityListItem) {
    const lossReason = window.prompt("Reason (optional):") ?? "";
    startTransition(async () => {
      const lostStage = stages.find((s) => s.isLost);
      if (lostStage) {
        applyOptimistic({ type: "move", id: opportunity.id, stageId: lostStage.id, stageIsWon: false, stageIsLost: true });
      }
      const formData = new FormData();
      if (lossReason.trim()) formData.set("lossReason", lossReason.trim());
      const result = await markOpportunityLostAction(opportunity.id, formData);
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  function handleArchive(opportunity: OpportunityListItem) {
    startTransition(async () => {
      applyOptimistic({ type: "archive", id: opportunity.id });
      if (selected?.id === opportunity.id) setSelected(null);
      const result = await archiveOpportunityAction(opportunity.id);
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  function handleUpdate(opportunity: OpportunityListItem, formData: FormData) {
    startTransition(async () => {
      const result = await updateOpportunityAction(opportunity.id, withValueCents(formData));
      if (result.status === "success") {
        setFieldErrors({});
        setToast({ tone: "success", message: result.message });
        setSelected(null);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const payload = withValueCents(formData);
      payload.set("pipelineId", pipelineId);
      const result = await createOpportunityAction(payload);
      if (result.status === "success") {
        setFieldErrors({});
        setCreateOpen(false);
        setToast({ tone: "success", message: result.message });
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-6">
        <RevealItem>
          <CrmNavTabs />
        </RevealItem>
        <RevealItem>
          <PipelineHeader
            pipelines={pipelines}
            pipelineId={pipelineId}
            onPipelineChange={handlePipelineChange}
            onAdd={() => {
              setFieldErrors({});
              setCreateOpen(true);
            }}
          />
        </RevealItem>
        <RevealItem>
          <PipelineMetrics metrics={metrics} />
        </RevealItem>
        <RevealItem>
          <PipelineBoard
            stages={stages}
            opportunities={opportunities}
            pending={isPending}
            onOpen={setSelected}
            onMoveToStage={handleMoveToStage}
            onMarkWon={handleMarkWon}
            onMarkLost={handleMarkLost}
            onArchive={handleArchive}
          />
        </RevealItem>
      </Reveal>

      <OpportunityDrawer
        opportunity={selected}
        members={members}
        pending={isPending}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        onMarkWon={handleMarkWon}
        onMarkLost={handleMarkLost}
        onArchive={handleArchive}
      />

      <OpportunityFormDrawer
        open={createOpen}
        pending={isPending}
        fieldErrors={fieldErrors}
        customers={customers}
        members={members}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
