import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "./cta-styles";
import { CheckIcon } from "./icons";
import { RevealItem } from "./reveal";

export interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
}

/* Reusable pricing tile. The highlighted plan gains an accent border, a
   "Most Popular" badge, and a filled accent CTA; the rest use the outline
   CTA. Hover: soft lift, accent border, subtle shadow (matches feature cards). */
export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  ctaLabel,
  highlighted = false,
}: PricingPlan) {
  return (
    <RevealItem as="li" className="h-full">
      <div
        className={`relative flex h-full flex-col rounded-2xl border p-8 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-accent/5 ${
          highlighted
            ? "border-accent bg-surface/60 ring-1 ring-accent/40"
            : "border-hairline bg-surface/40 hover:border-accent/40"
        }`}
      >
        {highlighted ? (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">
            Most Popular
          </span>
        ) : null}

        <h3 className="text-sm font-semibold text-white">{name}</h3>
        <p className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight text-white">
            {price}
          </span>
          <span className="text-sm text-muted">/{period}</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>

        <ul className="mt-8 flex-1 space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-white">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {feature}
            </li>
          ))}
        </ul>

        <Button
          fullWidth
          className={`mt-8 ${highlighted ? CTA_PRIMARY : CTA_SECONDARY}`}
        >
          {ctaLabel}
        </Button>
      </div>
    </RevealItem>
  );
}
