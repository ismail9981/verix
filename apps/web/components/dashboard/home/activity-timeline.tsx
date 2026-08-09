import Link from "next/link";
import { SectionCard } from "./section-card";
import { PaymentsIcon } from "../../landing/icons";
import { ReservationIcon } from "../icons";
import { RefundIcon, AlertIcon } from "../payments/icons";
import { formatMoney } from "../invoices/invoice-format";
import type { ActivityEvent, ActivityEventType } from "../../../src/server/validators/dashboard-analytics";
import type { IconComponent } from "../types";

/*
 * Activity Timeline (Sprint 18) — a single, chronologically-sorted feed of
 * business events, replacing the two-column Recent Payments / Recent
 * Reservations design. Renders `ActivityEvent[]` generically: this
 * component only switches on `type` for an icon/tone, and knows nothing
 * about how each event was computed — a future domain (housekeeping,
 * maintenance, staff, ...) contributing events requires no change here, only
 * an addition to the two maps below.
 */

const ICON_BY_TYPE: Record<ActivityEventType, IconComponent> = {
  "billing.payment_recorded": PaymentsIcon,
  "billing.refund_recorded": RefundIcon,
  "billing.payment_voided": AlertIcon,
  "reservations.created": ReservationIcon,
};

const TONE_BY_TYPE: Record<ActivityEventType, string> = {
  "billing.payment_recorded": "bg-emerald-500/10 text-emerald-400",
  "billing.refund_recorded": "bg-amber-500/10 text-amber-400",
  "billing.payment_voided": "bg-red-500/10 text-red-400",
  "reservations.created": "bg-accent/10 text-accent",
};

function relativeTime(value: Date): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const Icon = ICON_BY_TYPE[event.type];
  const tone = TONE_BY_TYPE[event.type];

  const row = (
    <div className="flex items-start gap-3 py-2.5">
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{event.title}</p>
        {event.description ? (
          <p className="truncate text-xs text-muted">{event.description}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        {event.amountCents !== undefined && event.currency ? (
          <p className="text-sm font-medium tabular-nums text-white">
            {formatMoney(event.amountCents, event.currency)}
          </p>
        ) : null}
        <p className="text-xs text-muted">{relativeTime(event.timestamp)}</p>
      </div>
    </div>
  );

  return (
    <li>
      {event.href ? (
        <Link href={event.href} className="block rounded-lg transition-colors hover:bg-canvas/50">
          {row}
        </Link>
      ) : (
        row
      )}
    </li>
  );
}

export function ActivityTimeline({ activity }: { activity: ActivityEvent[] | null }) {
  return (
    <SectionCard id="dashboard-activity" title="Activity">
      {activity === null ? (
        <p className="py-12 text-center text-sm text-muted">
          Activity is temporarily unavailable.
        </p>
      ) : activity.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">No recent activity.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {activity.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
