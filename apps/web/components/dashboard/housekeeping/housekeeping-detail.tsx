"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { PageHeader } from "../ui/page-header";
import { SectionCard } from "../home/section-card";
import { ProfileToast, type ToastState } from "../business-profile/profile-toast";
import { HousekeepingFormDrawer } from "./housekeeping-form-drawer";
import { HousekeepingAssignDrawer } from "./housekeeping-assign-drawer";
import { HousekeepingCompleteDrawer } from "./housekeeping-complete-drawer";
import { TaskPriorityPill, TaskStatusPill } from "./status-pills";
import { formatDueDate, formatTimestamp, taskTypeLabel } from "./task-format";
import {
  assignHousekeepingTaskAction,
  cancelHousekeepingTaskAction,
  completeHousekeepingTaskAction,
  startHousekeepingTaskAction,
  updateHousekeepingTaskAction,
} from "../../../src/server/actions/housekeeping";
import type { FieldErrors, FormActionResult } from "../../../src/server/actions/action-result";
import {
  isEmployeeAllowedHousekeepingTransition,
  isValidHousekeepingStatusTransition,
  type HousekeepingTaskListItem,
} from "../../../src/server/validators/housekeeping";
import type { ReservationPersonOption } from "../../../src/server/validators/reservation";

interface HousekeepingDetailProps {
  task: HousekeepingTaskListItem;
  teamMemberOptions: ReservationPersonOption[];
  role: string;
}

export function HousekeepingDetail({ task, teamMemberOptions, role }: HousekeepingDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canManage = role === "owner" || role === "manager";
  const canStart =
    isValidHousekeepingStatusTransition(task.status, "in_progress") &&
    (canManage || isEmployeeAllowedHousekeepingTransition(task.status, "in_progress"));
  const canComplete =
    isValidHousekeepingStatusTransition(task.status, "completed") &&
    (canManage || isEmployeeAllowedHousekeepingTransition(task.status, "completed"));
  const canCancel = canManage && isValidHousekeepingStatusTransition(task.status, "cancelled");
  const canAssign = canManage && task.status !== "completed" && task.status !== "cancelled";

  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  function runAction(promise: Promise<{ status: string; message: string }>) {
    startTransition(async () => {
      const result = await promise;
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
      if (result.status === "success") router.refresh();
    });
  }

  /** Shared by every drawer's submit handler below: run the action, clear/report field errors, close the drawer and refresh on success, always toast the result. */
  function submitDrawerAction(actionCall: Promise<FormActionResult>, onSuccess: () => void) {
    startTransition(async () => {
      const result = await actionCall;
      if (result.status === "success") {
        setFieldErrors({});
        onSuccess();
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
      }
      setToast({ tone: result.status === "success" ? "success" : "error", message: result.message });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={task.title}
        subtitle={`${task.unitName} · ${task.buildingName} · ${task.propertyName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/housekeeping">
              <Button type="button" className={CTA_SECONDARY}>
                Back to list
              </Button>
            </Link>
            {canStart ? (
              <Button type="button" className={CTA_PRIMARY} loading={isPending} onClick={() => runAction(startHousekeepingTaskAction(task.id))}>
                Start task
              </Button>
            ) : null}
            {canComplete ? (
              <Button type="button" className={CTA_PRIMARY} onClick={() => setCompleting(true)}>
                Complete task
              </Button>
            ) : null}
            {canAssign ? (
              <Button type="button" className={CTA_SECONDARY} onClick={() => setAssigning(true)}>
                Assign
              </Button>
            ) : null}
            {canManage ? (
              <Button type="button" className={CTA_SECONDARY} onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                type="button"
                className={CTA_SECONDARY}
                loading={isPending}
                onClick={() => runAction(cancelHousekeepingTaskAction(task.id))}
              >
                Cancel task
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <SectionCard id="task-info" title="Task information">
            <dl className="divide-y divide-hairline">
              <Row label="Type">{taskTypeLabel(task.taskType)}</Row>
              <Row label="Priority"><TaskPriorityPill priority={task.priority} /></Row>
              <Row label="Status"><TaskStatusPill status={task.status} /></Row>
              <Row label="Due">{formatDueDate(task.dueDate)}{task.dueTime ? ` at ${task.dueTime}` : ""}</Row>
              <Row label="Assigned to">{task.assignedToName ?? "Unassigned"}</Row>
              <Row label="Linked reservation">{task.reservationId ?? "None"}</Row>
            </dl>
          </SectionCard>

          <SectionCard id="task-description" title="Description">
            <p className="text-sm leading-relaxed text-muted">
              {task.description?.trim() ? task.description : "No description."}
            </p>
          </SectionCard>

          <SectionCard id="task-notes" title="Notes">
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm leading-relaxed text-muted">
              {task.notes?.trim() ? task.notes : "No notes yet."}
            </p>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <SectionCard id="task-location" title="Location">
            <dl className="divide-y divide-hairline">
              <Row label="Property">{task.propertyName}</Row>
              <Row label="Building">{task.buildingName}</Row>
              <Row label="Unit">{task.unitName}</Row>
            </dl>
          </SectionCard>

          <SectionCard id="task-timeline" title="Timeline">
            <dl className="divide-y divide-hairline">
              <Row label="Created">{formatTimestamp(task.createdAt)}</Row>
              <Row label="Started">{formatTimestamp(task.startedAt)}</Row>
              <Row label="Completed">{formatTimestamp(task.completedAt)}</Row>
              <Row label="Completed by">{task.completedByName ?? "—"}</Row>
              <Row label="Last updated">{formatTimestamp(task.updatedAt)}</Row>
            </dl>
          </SectionCard>
        </div>
      </div>

      <HousekeepingFormDrawer
        open={editing}
        task={task}
        eligibleUnitOptions={[]}
        teamMemberOptions={teamMemberOptions}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={() => setEditing(false)}
        onSubmit={(formData) =>
          submitDrawerAction(updateHousekeepingTaskAction(task.id, formData), () => setEditing(false))
        }
      />

      <HousekeepingAssignDrawer
        open={assigning}
        task={task}
        teamMemberOptions={teamMemberOptions}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={() => setAssigning(false)}
        onSubmit={(formData) =>
          submitDrawerAction(assignHousekeepingTaskAction(task.id, formData), () => setAssigning(false))
        }
      />

      <HousekeepingCompleteDrawer
        open={completing}
        task={task}
        pending={isPending}
        fieldErrors={fieldErrors}
        onClose={() => setCompleting(false)}
        onSubmit={(formData) =>
          submitDrawerAction(completeHousekeepingTaskAction(task.id, formData), () => setCompleting(false))
        }
      />

      <ProfileToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-white">{children}</dd>
    </div>
  );
}
