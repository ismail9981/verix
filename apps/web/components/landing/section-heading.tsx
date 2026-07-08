import { Reveal, RevealItem } from "./reveal";

interface SectionHeadingProps {
  /** Anchors the section's aria-labelledby. */
  headingId: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

/* Centered eyebrow / title / subtitle block shared across sections so the
   type scale and spacing stay identical everywhere. Self-animating. */
export function SectionHeading({
  headingId,
  eyebrow,
  title,
  subtitle,
}: SectionHeadingProps) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      {eyebrow ? (
        <RevealItem>
          <p className="text-sm font-medium tracking-wide text-accent">
            {eyebrow}
          </p>
        </RevealItem>
      ) : null}
      <RevealItem>
        <h2
          id={headingId}
          className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          {title}
        </h2>
      </RevealItem>
      {subtitle ? (
        <RevealItem>
          <p className="mt-4 text-lg leading-relaxed text-muted">{subtitle}</p>
        </RevealItem>
      ) : null}
    </Reveal>
  );
}
