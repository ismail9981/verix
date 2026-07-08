import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "./cta-styles";
import { ArrowRightIcon } from "./icons";
import { Reveal, RevealItem } from "./reveal";

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="bg-canvas px-6 py-24 lg:py-32"
    >
      <Reveal className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-hairline bg-surface/40 px-6 py-16 text-center sm:px-16 sm:py-20">
        {/* Soft accent glow — same non-flashy backdrop as the Hero. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-[36rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[120px]"
        />

        <RevealItem>
          <h2
            id="cta-heading"
            className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Ready to grow your business?
          </h2>
        </RevealItem>
        <RevealItem>
          <p className="relative mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">
            Start building your business platform today.
          </p>
        </RevealItem>
        <RevealItem>
          <div className="relative mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className={CTA_PRIMARY}
              rightIcon={<ArrowRightIcon className="h-4 w-4" />}
            >
              Start Free
            </Button>
            <Button size="lg" className={CTA_SECONDARY}>
              Book Demo
            </Button>
          </div>
        </RevealItem>
      </Reveal>
    </section>
  );
}
