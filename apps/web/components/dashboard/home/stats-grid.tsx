import { Reveal, RevealItem } from "../../landing/reveal";
import { DeltaPill } from "./delta-pill";
import { STATS } from "./mock-data";
import { Sparkline } from "./sparkline";
import type { Stat } from "./types";

function StatCard({ stat }: { stat: Stat }) {
  const { icon: Icon, label, value, delta, trend, series } = stat;
  return (
    <RevealItem as="li" className="h-full">
      <div className="flex h-full flex-col rounded-2xl border border-hairline bg-surface/40 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40">
        <div className="flex items-center justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-5 w-5" />
          </span>
          <DeltaPill delta={delta} trend={trend} />
        </div>
        <p className="mt-4 text-2xl font-bold tracking-tight text-white">{value}</p>
        <p className="text-sm text-muted">{label}</p>
        <div className="mt-3">
          <Sparkline data={series} trend={trend} />
        </div>
      </div>
    </RevealItem>
  );
}

export function StatsGrid() {
  return (
    <section aria-label="Key metrics">
      <Reveal
        as="ul"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {STATS.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </Reveal>
    </section>
  );
}
