import { RevealItem } from "./reveal";

export interface TimelineStepProps {
  index: number;
  title: string;
  description: string;
  /** Hides the trailing connector on the final step. */
  isLast: boolean;
}

/* One timeline node. A single set of responsive utilities drives both
   layouts: a vertical connector below the badge on mobile, and a horizontal
   one beside it from `lg` up — so the component is reused, never duplicated. */
export function TimelineStep({
  index,
  title,
  description,
  isLast,
}: TimelineStepProps) {
  return (
    <RevealItem as="li" className="flex gap-5 lg:flex-1 lg:flex-col lg:gap-0">
      {/* Badge + connector track */}
      <div className="flex flex-col items-center lg:w-full lg:flex-row lg:items-center">
        <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-sm font-semibold text-white">
          {index}
        </span>
        {!isLast ? (
          <span
            aria-hidden="true"
            className="my-2 w-px flex-1 bg-hairline lg:my-0 lg:ml-3 lg:h-px lg:w-auto lg:flex-1"
          />
        ) : null}
      </div>
      <div className="pb-8 lg:pb-0 lg:mt-5 lg:pr-6">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {description}
        </p>
      </div>
    </RevealItem>
  );
}
