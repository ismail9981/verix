import { SectionCard } from "../home/section-card";
import { RECENT_ACTIVITY } from "./mock-data";

export function RecentActivity() {
  return (
    <SectionCard id="activity" title="Recent activity" bodyClassName="p-2">
      <ul>
        {RECENT_ACTIVITY.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-canvas"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white">
                <span className="font-medium">{item.member}</span>{" "}
                <span className="text-muted">{item.action}</span>
              </p>
              <p className="text-xs text-muted">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
