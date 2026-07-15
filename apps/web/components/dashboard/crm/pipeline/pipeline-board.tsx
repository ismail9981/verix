"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { StageColumn } from "./stage-column";
import type { OpportunityListItem } from "../../../../src/server/services/crm-opportunity.service";
import type { StageDto } from "../../../../src/server/services/crm-pipeline.service";

interface PipelineBoardProps {
  stages: StageDto[];
  opportunities: OpportunityListItem[];
  pending: boolean;
  onOpen: (opportunity: OpportunityListItem) => void;
  onMoveToStage: (opportunity: OpportunityListItem, stageId: string) => void;
  onMarkWon: (opportunity: OpportunityListItem) => void;
  onMarkLost: (opportunity: OpportunityListItem) => void;
  onArchive: (opportunity: OpportunityListItem) => void;
}

/* Multi-column (cross-container) Kanban board. Deliberately its own
   dnd-kit wiring — not a reuse of the Website Builder's single-list
   `sections-builder.tsx` sortable, which only supports reordering within one
   list. CRM entities never touch website section-editor state. */
export function PipelineBoard({
  stages,
  opportunities,
  pending,
  onOpen,
  onMoveToStage,
  onMarkWon,
  onMarkLost,
  onArchive,
}: PipelineBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = new Map<string, OpportunityListItem[]>();
  for (const stage of stages) byStage.set(stage.id, []);
  for (const opportunity of opportunities) {
    byStage.get(opportunity.stageId)?.push(opportunity);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const opportunity = active.data.current?.opportunity as OpportunityListItem | undefined;
    const targetStageId = String(over.id);
    if (!opportunity || opportunity.stageId === targetStageId) return;
    onMoveToStage(opportunity, targetStageId);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            stages={stages}
            opportunities={byStage.get(stage.id) ?? []}
            pending={pending}
            onOpen={onOpen}
            onMoveToStage={onMoveToStage}
            onMarkWon={onMarkWon}
            onMarkLost={onMarkLost}
            onArchive={onArchive}
          />
        ))}
      </div>
    </DndContext>
  );
}
