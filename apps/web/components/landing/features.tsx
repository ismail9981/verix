import { FeatureCard, type FeatureCardProps } from "./feature-card";
import {
  AiIcon,
  AnalyticsIcon,
  BookingIcon,
  CrmIcon,
  PaymentsIcon,
  WebsiteIcon,
} from "./icons";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const FEATURES: FeatureCardProps[] = [
  {
    icon: WebsiteIcon,
    title: "Website Builder",
    description: "Create beautiful business websites without coding.",
  },
  {
    icon: BookingIcon,
    title: "Booking System",
    description: "Accept appointments online.",
  },
  {
    icon: CrmIcon,
    title: "CRM",
    description: "Manage customer relationships.",
  },
  {
    icon: AiIcon,
    title: "AI Assistant",
    description: "Generate content and automate repetitive work.",
  },
  {
    icon: AnalyticsIcon,
    title: "Analytics",
    description: "Track growth with real-time insights.",
  },
  {
    icon: PaymentsIcon,
    title: "Payments",
    description: "Accept payments securely.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="bg-canvas py-24 lg:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          headingId="features-heading"
          eyebrow="Features"
          title="Everything your business needs."
          subtitle="Manage your entire service business from one intelligent platform."
        />
        <Reveal
          as="ul"
          className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
