"use client";

import { RowActionsMenu, type RowAction } from "../ui/row-actions";
import type { LeadListItem } from "../../../src/server/validators/lead";

interface LeadActionsProps {
  lead: LeadListItem;
  onView: () => void;
  onConvert: () => void;
  onCreateOpportunity: () => void;
  onConvertWithOpportunity: () => void;
  onDelete: () => void;
}

export function LeadActions({
  lead,
  onView,
  onConvert,
  onCreateOpportunity,
  onConvertWithOpportunity,
  onDelete,
}: LeadActionsProps) {
  const actions: RowAction[] = [{ label: "View details", onSelect: onView }];
  actions.push({ label: "Create opportunity", onSelect: onCreateOpportunity });
  if (lead.status !== "converted") {
    actions.push({ label: "Convert to customer", onSelect: onConvert });
    actions.push({
      label: "Convert & create opportunity",
      onSelect: onConvertWithOpportunity,
    });
  }
  actions.push({ label: "Delete", onSelect: onDelete, danger: true });

  return <RowActionsMenu label="Lead actions" actions={actions} />;
}
