import { AiIcon } from "../../landing/icons";
import { INSIGHTS } from "./mock-data";
import { SectionCard } from "./section-card";
import type { InsightKind } from "./types";

const KIND_LABELS: Record<InsightKind, { label: string; className: string }> = {
  suggestion: { label: "Suggestion", className: "bg-accent/10 text-accent" },
  marketing: { label: "Marketing", className: "bg-sky-500/10 text-sky-400" },
  alert: { label: "Alert", className: "bg-amber-500/10 text-amber-400" },
};

export function AiInsightsCard() {
  return (
    <SectionCard
      id="insights"
      title="AI insights"
      action={
        <span className="inline-flex items-center gap-1.5 text-xs text-accent">
          <AiIcon className="h-4 w-4" />
          Powered by Verix AI
        </span>
      }
    >
      <ul className="flex flex-col gap-3">
        {INSIGHTS.map((insight) => {
          const kind = KIND_LABELS[insight.kind];
          return (
            <li
              key={insight.id}
              className="rounded-xl border border-hairline bg-canvas/40 p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-white">{insight.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${kind.className}`}
                >
                  {kind.label}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {insight.description}
              </p>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
