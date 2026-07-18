import { Badge } from "../ui/badge";
import type {
  HousekeepingTaskPriority,
  HousekeepingTaskStatus,
} from "../../../src/server/validators/housekeeping";
import { PRIORITY_TONES, STATUS_TONES, priorityLabel, taskStatusLabel } from "./task-format";

export function TaskStatusPill({ status }: { status: HousekeepingTaskStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{taskStatusLabel(status)}</Badge>;
}

export function TaskPriorityPill({ priority }: { priority: HousekeepingTaskPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{priorityLabel(priority)}</Badge>;
}
