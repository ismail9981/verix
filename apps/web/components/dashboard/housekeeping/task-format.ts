import type {
  HousekeepingTaskPriority,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
} from "../../../src/server/validators/housekeeping";
import type { BadgeTone } from "../ui/badge";

const STATUS_LABELS: Record<HousekeepingTaskStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function taskStatusLabel(status: HousekeepingTaskStatus): string {
  return STATUS_LABELS[status];
}

export const STATUS_TONES: Record<HousekeepingTaskStatus, BadgeTone> = {
  pending: "neutral",
  assigned: "info",
  in_progress: "accent",
  completed: "success",
  cancelled: "danger",
};

const TASK_TYPE_LABELS: Record<HousekeepingTaskType, string> = {
  cleaning: "Cleaning",
  inspection: "Inspection",
  maintenance: "Maintenance",
  linen_change: "Linen change",
  restocking: "Restocking",
  other: "Other",
};

export function taskTypeLabel(taskType: HousekeepingTaskType): string {
  return TASK_TYPE_LABELS[taskType];
}

const PRIORITY_LABELS: Record<HousekeepingTaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function priorityLabel(priority: HousekeepingTaskPriority): string {
  return PRIORITY_LABELS[priority];
}

export const PRIORITY_TONES: Record<HousekeepingTaskPriority, BadgeTone> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

/** Parses a plain `YYYY-MM-DD` date string as a local calendar date (never shifts a day via UTC parsing). */
function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

export function formatDueDate(value: string | null): string {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    parseDateOnly(value),
  );
}

export function formatTimestamp(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
