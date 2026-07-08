import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { TimelineStep, type TimelineStepProps } from "./timeline-step";

type Step = Omit<TimelineStepProps, "isLast">;

const STEPS: Step[] = [
  {
    index: 1,
    title: "Create Account",
    description: "Sign up free in seconds — no card required.",
  },
  {
    index: 2,
    title: "Configure Business",
    description: "Add your services, team, and branding.",
  },
  {
    index: 3,
    title: "Launch",
    description: "Go live and start taking bookings.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="bg-canvas py-24 lg:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          headingId="how-heading"
          eyebrow="How it works"
          title="Launch in minutes."
          subtitle="Three simple steps."
        />
        <Reveal
          as="ol"
          className="mx-auto mt-16 flex max-w-4xl flex-col lg:flex-row lg:items-start"
        >
          {STEPS.map((step, i) => (
            <TimelineStep
              key={step.index}
              {...step}
              isLast={i === STEPS.length - 1}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
