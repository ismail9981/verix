import type { ComponentType } from "react";
import type { IconProps } from "./icons";
import { RevealItem } from "./reveal";

export interface IndustryCardProps {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
}

/* Reusable industry tile — more compact than a feature card, with the icon
   inline beside the copy. Subtle hover: accent border and a lifted surface. */
export function IndustryCard({
  icon: Icon,
  title,
  description,
}: IndustryCardProps) {
  return (
    <RevealItem as="li" className="group h-full">
      <div className="flex h-full items-start gap-4 rounded-2xl border border-hairline bg-surface/40 p-5 transition-colors duration-300 hover:border-accent/40 hover:bg-surface/70">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {description}
          </p>
        </div>
      </div>
    </RevealItem>
  );
}
