"use client";

import { RowActionsMenu, type RowAction } from "../ui/row-actions";
import type { LeadListItem } from "../../../src/server/validators/lead";

interface LeadActionsProps {
  lead: LeadListItem;
  onView: () => void;
  onConvert: () => void;
  onDelete: () => void;
}

export function LeadActions({ lead, onView, onConvert, onDelete }: LeadActionsProps) {
  const actions: RowAction[] = [{ label: "View details", onSelect: onView }];
  if (lead.status !== "converted") {
    actions.push({ label: "Convert to customer", onSelect: onConvert });
  }
  actions.push({ label: "Delete", onSelect: onDelete, danger: true });

  return <RowActionsMenu label="Lead actions" actions={actions} />;
}
