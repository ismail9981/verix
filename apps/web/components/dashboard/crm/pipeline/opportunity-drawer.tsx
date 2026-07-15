"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../../landing/cta-styles";
import { DetailDrawer, DrawerField, DrawerSectionTitle } from "../../detail-drawer";
import { FieldInput } from "../../business-profile/field-input";
import { FieldSelect } from "../../business-profile/field-select";
import { Badge } from "../../ui/badge";
import { formatDateTime, formatMoney } from "./opportunity-format";
import {
  addActivityAction,
  completeActivityAction,
  deleteActivityAction,
  listOpportunityActivitiesAction,
} from "../../../../src/server/actions/crm-activity";
import { LOGGABLE_ACTIVITY_TYPES, type CreateActivityInput } from "../../../../src/server/validators/crm-activity";
import type { ActivityDto } from "../../../../src/server/services/crm-activity.service";
import type { OpportunityListItem } from "../../../../src/server/services/crm-opportunity.service";
import type { TeamMemberListItem } from "../../../../src/server/validators/team";

const ACTIVITY_TYPE_OPTIONS = LOGGABLE_ACTIVITY_TYPES.map((t) => ({
  value: t,
  label: t.charAt(0).toUpperCase() + t.slice(1),
}));

interface OpportunityDrawerProps {
  opportunity: OpportunityListItem | null;
  members: TeamMemberListItem[];
  pending: boolean;
  onClose: () => void;
  onUpdate: (opportunity: OpportunityListItem, formData: FormData) => void;
  onMarkWon: (opportunity: OpportunityListItem) => void;
  onMarkLost: (opportunity: OpportunityListItem) => void;
  onArchive: (opportunity: OpportunityListItem) => void;
}

/* Opportunity detail: edit form, activity timeline/follow-ups, and the same
   won/lost/archive actions the card exposes — reuses the shared DetailDrawer
   pattern (Customers, Leads). */
export function OpportunityDrawer({
  opportunity,
  members,
  pending,
  onClose,
  onUpdate,
  onMarkWon,
  onMarkLost,
  onArchive,
}: OpportunityDrawerProps) {
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [activitiesPending, startActivitiesTransition] = useTransition();

  useEffect(() => {
    if (!opportunity) {
      setActivities([]);
      return;
    }
    let cancelled = false;
    listOpportunityActivitiesAction(opportunity.id).then((rows) => {
      if (!cancelled) setActivities(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [opportunity]);

  function refetchActivities() {
    if (!opportunity) return;
    startActivitiesTransition(async () => {
      const rows = await listOpportunityActivitiesAction(opportunity.id);
      setActivities(rows);
    });
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opportunity) return;
    onUpdate(opportunity, new FormData(event.currentTarget));
  }

  function handleAddActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opportunity) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    startActivitiesTransition(async () => {
      await addActivityAction(opportunity.id, formData);
      form.reset();
      refetchActivities();
    });
  }

  function handleComplete(activity: ActivityDto) {
    startActivitiesTransition(async () => {
      await completeActivityAction(activity.id);
      refetchActivities();
    });
  }

  function handleDeleteActivity(activity: ActivityDto) {
    startActivitiesTransition(async () => {
      await deleteActivityAction(activity.id);
      refetchActivities();
    });
  }

  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...members.map((m) => ({ value: m.userId, label: m.name })),
  ];

  return (
    <DetailDrawer
      open={opportunity !== null}
      onClose={onClose}
      title="Opportunity"
      subtitle={opportunity ? formatMoney(opportunity.valueCents) : undefined}
      ariaLabel={opportunity ? `Opportunity ${opportunity.title}` : "Opportunity"}
      size="lg"
    >
      {opportunity ? (
        <div className="flex flex-col gap-6">
          <section aria-label="Overview" className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">{opportunity.title}</p>
              {opportunity.customerName ? (
                <p className="mt-0.5 truncate text-xs text-muted">{opportunity.customerName}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {opportunity.status === "won" ? <Badge tone="success">Won</Badge> : null}
              {opportunity.status === "lost" ? <Badge tone="danger">Lost</Badge> : null}
              {opportunity.status === "open" ? <Badge tone="info">{opportunity.stageName}</Badge> : null}
            </div>
          </section>

          {opportunity.lossReason ? (
            <p className="rounded-xl border border-hairline bg-surface/40 p-3 text-sm text-muted">
              Loss reason: {opportunity.lossReason}
            </p>
          ) : null}

          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <DrawerSectionTitle>Details</DrawerSectionTitle>
            <FieldInput label="Title" name="title" required defaultValue={opportunity.title} />
            <FieldInput
              label="Value (USD)"
              name="valueDollars"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(opportunity.valueCents / 100).toString()}
            />
            <FieldSelect
              label="Assign to"
              name="assignedToUserId"
              options={assigneeOptions}
              defaultValue={opportunity.assignedToUserId ?? ""}
            />
            <FieldInput
              label="Expected close date"
              name="expectedCloseDate"
              type="date"
              defaultValue={
                opportunity.expectedCloseDate
                  ? new Date(opportunity.expectedCloseDate).toISOString().slice(0, 10)
                  : ""
              }
            />
            <Button type="submit" className={CTA_SECONDARY} loading={pending}>
              Save changes
            </Button>
          </form>

          <dl className="divide-y divide-hairline">
            <DrawerField label="Created">{formatDateTime(opportunity.createdAt)}</DrawerField>
            {opportunity.closedAt ? (
              <DrawerField label="Closed">{formatDateTime(opportunity.closedAt)}</DrawerField>
            ) : null}
          </dl>

          <section aria-label="Lifecycle" className="flex flex-col gap-2">
            <DrawerSectionTitle>Lifecycle</DrawerSectionTitle>
            <div className="flex flex-wrap gap-2">
              {opportunity.status !== "won" ? (
                <Button
                  type="button"
                  className={CTA_SECONDARY}
                  disabled={pending}
                  onClick={() => onMarkWon(opportunity)}
                >
                  Mark won
                </Button>
              ) : null}
              {opportunity.status !== "lost" ? (
                <Button
                  type="button"
                  className={CTA_SECONDARY}
                  disabled={pending}
                  onClick={() => onMarkLost(opportunity)}
                >
                  Mark lost
                </Button>
              ) : null}
              <Button
                type="button"
                className={CTA_SECONDARY}
                disabled={pending}
                onClick={() => onArchive(opportunity)}
              >
                Archive
              </Button>
            </div>
          </section>

          <section aria-label="Activities and follow-ups" className="flex flex-col gap-3">
            <DrawerSectionTitle>Activities &amp; follow-ups</DrawerSectionTitle>

            <form onSubmit={handleAddActivity} className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface/40 p-3">
              <div className="grid grid-cols-2 gap-2">
                <FieldSelect
                  label="Type"
                  name="type"
                  options={ACTIVITY_TYPE_OPTIONS}
                  defaultValue={"note" satisfies CreateActivityInput["type"]}
                />
                <FieldInput label="Due (optional)" name="dueAt" type="datetime-local" />
              </div>
              <FieldInput label="Title" name="title" required placeholder="e.g. Follow up call" />
              <Button type="submit" className={`${CTA_SECONDARY} self-end`} loading={activitiesPending}>
                Add
              </Button>
            </form>

            <ul className="flex flex-col gap-2">
              {activities.length === 0 ? (
                <li className="py-4 text-center text-xs text-muted">No activity yet.</li>
              ) : (
                activities.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-hairline bg-surface/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{activity.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {activity.actorName ?? "System"} · {formatDateTime(activity.createdAt)}
                        {activity.dueAt ? ` · Due ${formatDateTime(activity.dueAt)}` : ""}
                        {activity.overdue ? " · Overdue" : ""}
                        {activity.completedAt ? " · Done" : ""}
                      </p>
                    </div>
                    {activity.type !== "status_change" ? (
                      <div className="flex shrink-0 gap-2">
                        {!activity.completedAt ? (
                          <button
                            type="button"
                            onClick={() => handleComplete(activity)}
                            className="text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            Complete
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(activity)}
                          className="text-xs text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
