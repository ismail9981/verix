import { SectionCard } from "../home/section-card";
import { DonutChart } from "./donut-chart";
import { TRAFFIC_SOURCES } from "./mock-data";

export function TrafficSources() {
  return (
    <SectionCard id="traffic" title="Traffic sources">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
        <DonutChart segments={TRAFFIC_SOURCES} ariaLabel="Traffic sources breakdown" />
        <ul className="flex flex-col gap-2.5">
          {TRAFFIC_SOURCES.map((source) => (
            <li key={source.label} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: source.color }}
              />
              <span className="text-sm text-white">{source.label}</span>
              <span className="ml-auto text-sm tabular-nums text-muted">
                {source.value}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}
