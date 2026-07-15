"use client";

import { useDroppable } from "@dnd-kit/core";
import { CARD } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { OpportunityCard } from "./opportunity-card";
import { formatMoney } from "./opportunity-format";
import type { OpportunityListItem } from "../../../../src/server/services/crm-opportunity.service";
import type { StageDto } from "../../../../src/server/services/crm-pipeline.service";

interface StageColumnProps {
  stage: StageDto;
  stages: StageDto[];
  opportunities: OpportunityListItem[];
  pending: boolean;
  onOpen: (opportunity: OpportunityListItem) => void;
  onMoveToStage: (opportunity: OpportunityListItem, stageId: string) => void;
  onMarkWon: (opportunity: OpportunityListItem) => void;
  onMarkLost: (opportunity: OpportunityListItem) => void;
  onArchive: (opportunity: OpportunityListItem) => void;
}

const TONE_TEXT: Record<StageDto["tone"], string> = {
  neutral: "text-muted",
  info: "text-sky-400",
  warning: "text-amber-400",
  success: "text-emerald-400",
  danger: "text-red-400",
  accent: "text-accent",
};

export function StageColumn({
  stage,
  stages,
  opportunities,
  pending,
  onOpen,
  onMoveToStage,
  onMarkWon,
  onMarkLost,
  onArchive,
}: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { stage } });

  const totalCents = opportunities.reduce((sum, o) => sum + o.valueCents, 0);

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${TONE_TEXT[stage.tone]}`}>{stage.name}</p>
          <p className="text-xs text-muted">
            {opportunities.length} · {formatMoney(totalCents)}
          </p>
        </div>
        {stage.isWon ? <Badge tone="success">Won</Badge> : null}
        {stage.isLost ? <Badge tone="danger">Lost</Badge> : null}
      </div>

      <ul
        ref={setNodeRef}
        aria-label={`${stage.name} opportunities`}
        className={`${CARD} flex min-h-[10rem] flex-1 flex-col gap-2 border-dashed p-2 transition-colors ${
          isOver ? "border-accent bg-accent/5" : ""
        }`}
      >
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            stages={stages}
            pending={pending}
            onOpen={onOpen}
            onMoveToStage={onMoveToStage}
            onMarkWon={onMarkWon}
            onMarkLost={onMarkLost}
            onArchive={onArchive}
          />
        ))}
        {opportunities.length === 0 ? (
          <li className="px-2 py-6 text-center text-xs text-muted">No opportunities</li>
        ) : null}
      </ul>
    </div>
  );
}
