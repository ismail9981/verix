"use client";

import { useDraggable } from "@dnd-kit/core";
import { CARD } from "../../ui/card";
import { RowActionsMenu, type RowAction } from "../../ui/row-actions";
import { avatarColor, formatMoney, initials } from "./opportunity-format";
import type { OpportunityListItem } from "../../../../src/server/services/crm-opportunity.service";
import type { StageDto } from "../../../../src/server/services/crm-pipeline.service";

interface OpportunityCardProps {
  opportunity: OpportunityListItem;
  stages: StageDto[];
  pending: boolean;
  onOpen: (opportunity: OpportunityListItem) => void;
  onMoveToStage: (opportunity: OpportunityListItem, stageId: string) => void;
  onMarkWon: (opportunity: OpportunityListItem) => void;
  onMarkLost: (opportunity: OpportunityListItem) => void;
  onArchive: (opportunity: OpportunityListItem) => void;
}

/* One Kanban card. Draggable via dnd-kit (mouse/touch/pointer), and
   independently keyboard-operable via the native "Move to stage" <select> —
   the brief's two required interaction paths, not one gated behind the other. */
export function OpportunityCard({
  opportunity,
  stages,
  pending,
  onOpen,
  onMoveToStage,
  onMarkWon,
  onMarkLost,
  onArchive,
}: OpportunityCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    data: { opportunity },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const actions: RowAction[] = [];
  if (!opportunity.stageIsWon) actions.push({ label: "Mark won", onSelect: () => onMarkWon(opportunity) });
  if (!opportunity.stageIsLost) actions.push({ label: "Mark lost", onSelect: () => onMarkLost(opportunity) });
  actions.push({ label: "Archive", onSelect: () => onArchive(opportunity), danger: true });

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`${CARD} flex flex-col gap-2 p-3 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          onClick={() => onOpen(opportunity)}
          className="min-w-0 flex-1 cursor-grab text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
        >
          <span className="block truncate">{opportunity.title}</span>
        </button>
        <RowActionsMenu label={`Actions for ${opportunity.title}`} actions={actions} />
      </div>

      <p className="text-sm font-semibold text-white">{formatMoney(opportunity.valueCents)}</p>
      {opportunity.customerName ? (
        <p className="truncate text-xs text-muted">{opportunity.customerName}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {opportunity.assignedToName ? (
          <span
            aria-hidden="true"
            title={opportunity.assignedToName}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(opportunity.assignedToUserId ?? opportunity.id) }}
          >
            {initials(opportunity.assignedToName)}
          </span>
        ) : (
          <span className="text-xs text-muted">Unassigned</span>
        )}

        <label className="sr-only" htmlFor={`move-${opportunity.id}`}>
          Move {opportunity.title} to stage
        </label>
        <select
          id={`move-${opportunity.id}`}
          value={opportunity.stageId}
          disabled={pending}
          onChange={(event) => onMoveToStage(opportunity, event.target.value)}
          className="rounded-lg border border-hairline bg-canvas px-2 py-1 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}
