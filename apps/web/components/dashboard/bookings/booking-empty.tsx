import { TableEmptyState } from "../ui/table-states";
import { CalendarIcon } from "./icons";

export function BookingEmpty({ onClear }: { onClear: () => void }) {
  return (
    <TableEmptyState
      icon={CalendarIcon}
      title="No bookings found"
      description="No bookings match your current filters. Try adjusting or clearing them."
      onClear={onClear}
    />
  );
}
