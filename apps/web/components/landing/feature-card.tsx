import type { ComponentType } from "react";
import type { IconProps } from "./icons";
import { RevealItem } from "./reveal";

export interface FeatureCardProps {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
}

/* Reusable feature tile. Hover: lift, accent border, soft accent shadow —
   all via CSS transitions to keep the effect subtle and cheap. */
export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <RevealItem as="li" className="h-full">
      <div className="flex h-full flex-col rounded-2xl border border-hairline bg-surface/40 p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </RevealItem>
  );
}
