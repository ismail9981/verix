"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { TableEmptyState, TableSkeleton } from "../ui/table-states";
import { HousekeepingActions } from "./housekeeping-actions";
import { TaskPriorityPill, TaskStatusPill } from "./status-pills";
import { formatDueDate, isPastDue, taskTypeLabel } from "./task-format";
import { SparkleIcon } from "./icons";
import {
  isEmployeeAllowedHousekeepingTransition,
  isValidHousekeepingStatusTransition,
  type HousekeepingTaskListItem,
} from "../../../src/server/validators/housekeeping";

interface HousekeepingTableProps {
  tasks: HousekeepingTaskListItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  filtersActive: boolean;
  pending: boolean;
  role: string;
  onView: (task: HousekeepingTaskListItem) => void;
  onEdit: (task: HousekeepingTaskListItem) => void;
  onAssign: (task: HousekeepingTaskListItem) => void;
  onStart: (task: HousekeepingTaskListItem) => void;
  onComplete: (task: HousekeepingTaskListItem) => void;
  onCancel: (task: HousekeepingTaskListItem) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
}

const TH = "px-5 py-2.5 font-medium";

function TaskRow({
  task,
  role,
  onView,
  onEdit,
  onAssign,
  onStart,
  onComplete,
  onCancel,
}: {
  task: HousekeepingTaskListItem;
  role: string;
  onView: (task: HousekeepingTaskListItem) => void;
  onEdit: (task: HousekeepingTaskListItem) => void;
  onAssign: (task: HousekeepingTaskListItem) => void;
  onStart: (task: HousekeepingTaskListItem) => void;
  onComplete: (task: HousekeepingTaskListItem) => void;
  onCancel: (task: HousekeepingTaskListItem) => void;
}) {
  const canManage = role === "owner" || role === "manager";
  const canAssign = canManage && task.status !== "completed" && task.status !== "cancelled";
  const canStart =
    isValidHousekeepingStatusTransition(task.status, "in_progress") &&
    (canManage || isEmployeeAllowedHousekeepingTransition(task.status, "in_progress"));
  const canComplete =
    isValidHousekeepingStatusTransition(task.status, "completed") &&
    (canManage || isEmployeeAllowedHousekeepingTransition(task.status, "completed"));
  const canCancel = canManage && isValidHousekeepingStatusTransition(task.status, "cancelled");
  const overdue = isPastDue(task.dueDate) && task.status !== "completed" && task.status !== "cancelled";

  return (
    <tr
      onClick={() => onView(task)}
      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
    >
      <td className="px-5 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(task);
          }}
          className="truncate text-left text-sm font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {task.title}
        </button>
        <p className="mt-0.5 truncate text-xs text-muted">{taskTypeLabel(task.taskType)}</p>
      </td>
      <td className="hidden px-5 py-3 text-muted sm:table-cell">{task.unitName}</td>
      <td className="hidden px-5 py-3 text-muted md:table-cell">{task.assignedToName ?? "Unassigned"}</td>
      <td className={`hidden whitespace-nowrap px-5 py-3 lg:table-cell ${overdue ? "text-red-400" : "text-muted"}`}>
        {formatDueDate(task.dueDate)}
      </td>
      <td className="hidden px-5 py-3 xl:table-cell">
        <TaskPriorityPill priority={task.priority} />
      </td>
      <td className="px-5 py-3">
        <TaskStatusPill status={task.status} />
      </td>
      <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <HousekeepingActions
            task={task}
            canEdit={canManage}
            canAssign={canAssign}
            canStart={canStart}
            canComplete={canComplete}
            canCancel={canCancel}
            onView={() => onView(task)}
            onEdit={() => onEdit(task)}
            onAssign={() => onAssign(task)}
            onStart={() => onStart(task)}
            onComplete={() => onComplete(task)}
            onCancel={() => onCancel(task)}
          />
        </div>
      </td>
    </tr>
  );
}

export function HousekeepingTable({
  tasks,
  total,
  page,
  pageSize,
  loading,
  filtersActive,
  pending,
  role,
  onView,
  onEdit,
  onAssign,
  onStart,
  onComplete,
  onCancel,
  onClearFilters,
  onPageChange,
}: HousekeepingTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <SectionCard
      id="housekeeping-tasks"
      title="All tasks"
      bodyClassName="p-0"
      action={!loading ? <span className="text-xs text-muted">{total} {total === 1 ? "result" : "results"}</span> : null}
    >
      {loading ? (
        <TableSkeleton />
      ) : tasks.length === 0 ? (
        filtersActive ? (
          <TableEmptyState
            icon={SparkleIcon}
            title="No tasks found"
            description="No housekeeping tasks match your filters. Try adjusting or clearing them."
            onClear={onClearFilters}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
              <SparkleIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-white">No tasks yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Create your first housekeeping task to start tracking cleaning and maintenance work.
            </p>
          </div>
        )
      ) : (
        <>
          <div aria-busy={pending} className={`transition-opacity ${pending ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <caption className="sr-only">Housekeeping tasks</caption>
              <thead>
                <tr className="border-y border-hairline text-left text-xs text-muted">
                  <th scope="col" className={TH}>Task</th>
                  <th scope="col" className={`hidden sm:table-cell ${TH}`}>Unit</th>
                  <th scope="col" className={`hidden md:table-cell ${TH}`}>Assigned to</th>
                  <th scope="col" className={`hidden lg:table-cell ${TH}`}>Due</th>
                  <th scope="col" className={`hidden xl:table-cell ${TH}`}>Priority</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={TH}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    role={role}
                    onView={onView}
                    onEdit={onEdit}
                    onAssign={onAssign}
                    onStart={onStart}
                    onComplete={onComplete}
                    onCancel={onCancel}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-hairline px-5 py-3">
              <span className="text-xs text-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className={CTA_SECONDARY}
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={CTA_SECONDARY}
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}
