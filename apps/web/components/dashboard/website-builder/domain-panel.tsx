import { Button } from "@repo/ui";
import { CheckIcon } from "../../landing/icons";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { GlobeIcon } from "./icons";
import { DOMAIN } from "./mock-data";

export function DomainPanel() {
  return (
    <SectionCard
      id="domain"
      title="Domain"
      action={
        <Button type="button" size="sm" className={CTA_SECONDARY}>
          Manage
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas/40 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <GlobeIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">Connected domain</p>
            <p className="truncate text-sm font-medium text-white">{DOMAIN.domain}</p>
          </div>
        </div>

        <dl className="flex flex-col divide-y divide-hairline">
          {DOMAIN.lines.map((line) => (
            <div
              key={line.label}
              className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
            >
              <dt className="text-sm text-muted">{line.label}</dt>
              <dd
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                  line.ok ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {line.ok ? <CheckIcon className="h-4 w-4" /> : null}
                {line.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </SectionCard>
  );
}
