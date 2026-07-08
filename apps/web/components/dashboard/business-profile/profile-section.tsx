import type { ReactNode } from "react";
import { RevealItem } from "../../landing/reveal";

interface ProfileSectionProps {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  /** When true the card body has no padding (for edge-to-edge tables). */
  flush?: boolean;
}

/* Two-column settings row (Stripe / Linear style): a title + description on
   the left, the field card on the right. Stacks on mobile. Animates in as a
   RevealItem (parent Reveal stagger). */
export function ProfileSection({
  id,
  title,
  description,
  children,
  flush = false,
}: ProfileSectionProps) {
  return (
    <RevealItem as="div">
      <section
        aria-labelledby={`${id}-heading`}
        className="grid gap-x-8 gap-y-4 lg:grid-cols-3"
      >
        <div className="lg:col-span-1">
          <h2 id={`${id}-heading`} className="text-sm font-semibold text-white">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        </div>
        <div className="lg:col-span-2">
          <div
            className={`rounded-2xl border border-hairline bg-surface/40 ${
              flush ? "" : "p-5 sm:p-6"
            }`}
          >
            {children}
          </div>
        </div>
      </section>
    </RevealItem>
  );
}
