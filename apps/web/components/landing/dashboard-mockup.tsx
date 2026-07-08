/* A static, realistic dashboard preview for a service business (a salon).
   Pure presentation — no data fetching, no interactivity — so it renders
   on the server and stays cheap. All values are hand-authored, not lorem. */

interface Stat {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
}

const STATS: Stat[] = [
  { label: "Revenue", value: "$18,240", delta: "+12.5%", trend: "up" },
  { label: "Bookings", value: "312", delta: "+8.1%", trend: "up" },
  { label: "New clients", value: "48", delta: "+23%", trend: "up" },
  { label: "No-shows", value: "4", delta: "-1.2%", trend: "down" },
];

/* Weekly bookings, Mon–Sun, as a share of the tallest bar. */
const WEEK = [
  { day: "M", pct: 52 },
  { day: "T", pct: 68 },
  { day: "W", pct: 61 },
  { day: "T", pct: 84 },
  { day: "F", pct: 100 },
  { day: "S", pct: 92 },
  { day: "S", pct: 44 },
];

interface Booking {
  name: string;
  service: string;
  time: string;
  status: "Confirmed" | "Pending";
}

const BOOKINGS: Booking[] = [
  { name: "Amelia Chen", service: "Balayage & cut", time: "9:30", status: "Confirmed" },
  { name: "Marcus Reid", service: "Beard trim", time: "10:15", status: "Confirmed" },
  { name: "Sofia Marino", service: "Gel manicure", time: "11:00", status: "Pending" },
  { name: "Elena Novak", service: "Color touch-up", time: "13:45", status: "Confirmed" },
];

interface Customer {
  name: string;
  initials: string;
  meta: string;
  hue: string;
}

const CUSTOMERS: Customer[] = [
  { name: "Priya Anand", initials: "PA", meta: "VIP · 14 visits", hue: "#6d5ef9" },
  { name: "James Okafor", initials: "JO", meta: "New · 1 visit", hue: "#2dd4bf" },
  { name: "Lena Fischer", initials: "LF", meta: "Regular · 6 visits", hue: "#f59e0b" },
];

function TrendArrow({ trend }: { trend: Stat["trend"] }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d={trend === "up" ? "M6 9.5V2.5M6 2.5L2.5 6M6 2.5L9.5 6" : "M6 2.5v7M6 9.5L2.5 6M6 9.5L9.5 6"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-hairline bg-canvas/60 p-4 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-white">{title}</h4>
        {action ? <span className="text-[11px] text-muted">{action}</span> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function DashboardMockup() {
  return (
    <div
      role="img"
      aria-label="Verix dashboard preview showing revenue, weekly bookings, today's appointments, and recent clients for a salon."
      className="w-full overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-black/40"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
        <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
        <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
        <div className="ml-3 flex items-center gap-2">
          <span className="h-5 w-5 rounded-md bg-accent/20 text-center text-[11px] font-semibold leading-5 text-accent">
            B
          </span>
          <span className="text-xs font-medium text-white">Bloom Studio</span>
        </div>
        <span className="ml-auto text-[11px] text-muted">Today · Fri</span>
      </div>

      <div className="space-y-4 p-4">
        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-hairline bg-canvas/60 p-3"
            >
              <p className="text-[11px] text-muted">{s.label}</p>
              <p className="mt-1 text-base font-semibold text-white">{s.value}</p>
              <p
                className={`mt-1 inline-flex items-center gap-1 text-[11px] ${
                  s.trend === "up" ? "text-emerald-400" : "text-muted"
                }`}
              >
                <TrendArrow trend={s.trend} />
                {s.delta}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Chart */}
          <Panel title="Bookings this week" action="+8.1%" className="lg:col-span-3">
            <div className="flex h-28 items-end justify-between gap-2">
              {WEEK.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={`w-full rounded-md ${
                        d.pct === 100 ? "bg-accent" : "bg-accent/30"
                      }`}
                      style={{ height: `${d.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{d.day}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Recent customers */}
          <Panel title="Recent clients" action="View all" className="lg:col-span-2">
            <ul className="space-y-3">
              {CUSTOMERS.map((c) => (
                <li key={c.name} className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: c.hue }}
                  >
                    {c.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-white">
                      {c.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {c.meta}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Recent bookings */}
        <Panel title="Today's appointments" action="4 upcoming">
          <ul className="divide-y divide-hairline">
            {BOOKINGS.map((b) => (
              <li key={b.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted">
                  {b.time}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white">
                    {b.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {b.service}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    b.status === "Confirmed"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {b.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
