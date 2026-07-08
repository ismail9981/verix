import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  /** Anchors aria-labelledby for the section. */
  id: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/* Consistent panel used by the chart, appointments, activity, and insights
   sections — one card style, one header treatment. Renders a semantic
   <section> labelled by its heading. */
export function SectionCard({
  title,
  id,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`rounded-2xl border border-hairline bg-surface/40 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <h2 id={`${id}-title`} className="text-sm font-semibold text-white">
          {title}
        </h2>
        {action}
      </div>
      <div className={bodyClassName ?? "p-5"}>{children}</div>
    </section>
  );
}
