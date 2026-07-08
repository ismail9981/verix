import { PricingCard, type PricingPlan } from "./pricing-card";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const PLANS: PricingPlan[] = [
  {
    name: "Starter",
    price: "$9",
    period: "month",
    description: "Perfect for small businesses.",
    features: ["Website", "Booking", "Basic AI", "Email support"],
    ctaLabel: "Start Free",
  },
  {
    name: "Pro",
    price: "$29",
    period: "month",
    description: "For growing teams ready to scale.",
    features: [
      "Everything in Starter",
      "CRM",
      "Analytics",
      "Advanced AI",
      "Priority support",
    ],
    ctaLabel: "Start Free",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$79",
    period: "month",
    description: "For growing companies.",
    features: [
      "Unlimited websites",
      "Team members",
      "Custom branding",
      "API access",
      "Dedicated support",
    ],
    ctaLabel: "Contact Sales",
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-canvas py-24 lg:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          headingId="pricing-heading"
          eyebrow="Pricing"
          title="Simple pricing."
          subtitle="Choose the plan that fits your business."
        />
        <Reveal
          as="ul"
          className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch"
        >
          {PLANS.map((plan) => (
            <PricingCard key={plan.name} {...plan} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
