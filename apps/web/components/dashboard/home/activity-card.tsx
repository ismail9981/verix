import { ACTIVITY, ACTIVITY_STYLES } from "./mock-data";
import { SectionCard } from "./section-card";

export function ActivityCard() {
  return (
    <SectionCard id="activity" title="Recent activity">
      <ol className="flex flex-col gap-1">
        {ACTIVITY.map((item, index) => {
          const { icon: Icon, className } = ACTIVITY_STYLES[item.type];
          const isLast = index === ACTIVITY.length - 1;
          return (
            <li key={item.id} className="flex gap-3">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${className}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {!isLast ? (
                  <span aria-hidden="true" className="my-1 w-px flex-1 bg-hairline" />
                ) : null}
              </div>
              <div className={isLast ? "pb-0" : "pb-4"}>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {item.description}
                </p>
                <p className="mt-1 text-[11px] text-muted">{item.time}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
