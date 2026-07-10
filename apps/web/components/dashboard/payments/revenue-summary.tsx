import { SectionCard } from "../home/section-card";
import { CheckIcon } from "../../landing/icons";
import { ClockIcon } from "../home/icons";
import { RefundIcon } from "./icons";
import { formatMoney } from "./payment-format";
import type { IconComponent } from "../types";
import type { PaymentStats } from "../../../src/server/validators/payment";

interface RevenueSummaryProps {
  stats: PaymentStats;
}

export function RevenueSummary({ stats }: RevenueSummaryProps) {
  const rows: {
    label: string;
    value: string;
    icon: IconComponent;
    tone: string;
  }[] = [
    {
      label: "Total collected",
      value: formatMoney(stats.totalRevenueCents),
      icon: CheckIcon,
      tone: "bg-emerald-500/10 text-emerald-400",
    },
    {
      label: "Pending revenue",
      value: formatMoney(stats.pendingRevenueCents),
      icon: ClockIcon,
      tone: "bg-amber-500/10 text-amber-400",
    },
    {
      label: "Refunds",
      value: formatMoney(stats.refundedRevenueCents),
      icon: RefundIcon,
      tone: "bg-white/5 text-muted",
    },
  ];

  return (
    <SectionCard id="revenue-summary" title="Revenue summary">
      <ul className="flex flex-col gap-3">
        {rows.map(({ label, value, icon: Icon, tone }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas/40 p-3"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex-1 text-sm text-muted">{label}</span>
            <span className="text-sm font-semibold tabular-nums text-white">
              {value}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
