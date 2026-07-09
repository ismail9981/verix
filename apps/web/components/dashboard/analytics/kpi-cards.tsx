import { DeltaPill } from "../home/delta-pill";
import { Sparkline } from "../home/sparkline";
import { KPIS } from "./mock-data";

export function KpiCards() {
  return (
    <section aria-label="Key metrics">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <li key={kpi.id}>
            <div className="rounded-2xl border border-hairline bg-surface/40 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted">{kpi.label}</p>
                <DeltaPill delta={kpi.delta} trend={kpi.trend} />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-white">
                {kpi.value}
              </p>
              <div className="mt-3">
                <Sparkline data={kpi.series} trend={kpi.trend} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
