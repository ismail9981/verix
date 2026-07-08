import type { ReactNode } from "react";
import { Reveal, RevealItem } from "./reveal";

/* Placeholder brands — intentionally not real logos. Each pairs a small
   geometric mark with a letter-spaced wordmark so the row reads as a
   premium, monochrome logo cloud. */
interface Placeholder {
  name: string;
  mark: ReactNode;
}

const markProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  "aria-hidden": true,
} as const;

const LOGOS: Placeholder[] = [
  { name: "TOUR CO", mark: <svg {...markProps}><circle cx="9" cy="9" r="7" /><path d="M9 2v14M2 9h14" /></svg> },
  { name: "CLINIC", mark: <svg {...markProps}><rect x="2.5" y="2.5" width="13" height="13" rx="3.5" /><path d="M9 6v6M6 9h6" /></svg> },
  { name: "REALTY", mark: <svg {...markProps}><path d="M3 8l6-5 6 5" /><path d="M5 7v8h8V7" /></svg> },
  { name: "SALON", mark: <svg {...markProps}><circle cx="9" cy="9" r="7" /><circle cx="9" cy="9" r="2.5" /></svg> },
  { name: "STUDIO", mark: <svg {...markProps}><path d="M9 2l7 4v6l-7 4-7-4V6l7-4Z" /></svg> },
  { name: "AGENCY", mark: <svg {...markProps}><path d="M9 2.5 15.5 15h-13L9 2.5Z" /></svg> },
];

export function TrustedBy() {
  return (
    <section
      aria-labelledby="trusted-heading"
      className="bg-canvas py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="flex flex-col items-center gap-10">
          <RevealItem>
            <h2
              id="trusted-heading"
              className="text-center text-sm font-medium uppercase tracking-widest text-muted"
            >
              Trusted by growing service businesses
            </h2>
          </RevealItem>
          <RevealItem as="div" className="w-full">
            <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
              {LOGOS.map((logo) => (
                <li key={logo.name}>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white opacity-50 transition-opacity duration-300 hover:opacity-90">
                    {logo.mark}
                    {logo.name}
                  </span>
                </li>
              ))}
            </ul>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
