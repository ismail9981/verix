import { TeamIcon } from "../icons";
import { TableEmptyState } from "../ui/table-states";

export function CustomerEmpty({ onClear }: { onClear: () => void }) {
  return (
    <TableEmptyState
      icon={TeamIcon}
      title="No customers found"
      description="No customers match your current filters. Try adjusting or clearing them."
      onClear={onClear}
    />
  );
}
