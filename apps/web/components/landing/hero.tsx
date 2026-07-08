"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Button } from "@repo/ui";
import { DashboardMockup } from "./dashboard-mockup";

const CTA_PRIMARY = "bg-accent hover:bg-accent-strong focus-visible:ring-accent";
const CTA_SECONDARY =
  "border border-hairline bg-transparent text-white hover:bg-surface focus-visible:ring-accent";

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4 10h12M12 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export function Hero() {
  const reduceMotion = useReducedMotion();

  // With reduced motion, render final state and skip transforms entirely.
  const rootProps = reduceMotion
    ? { initial: "show" as const }
    : { initial: "hidden" as const, animate: "show" as const };

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-canvas"
      aria-labelledby="hero-heading"
    >
      {/* Soft accent glow — subtle, non-flashy backdrop. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[720px] max-w-full -translate-x-1/2 rounded-full bg-accent/20 blur-[130px]"
      />

      <motion.div
        variants={container}
        {...rootProps}
        className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 lg:grid-cols-2 lg:gap-12 lg:py-32"
      >
        {/* Copy */}
        <div className="text-center lg:text-left">
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/60 px-3 py-1 text-xs text-muted"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            AI-first platform for service businesses
          </motion.span>

          <motion.h1
            id="hero-heading"
            variants={item}
            className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            AI Platform for
            <br className="hidden sm:block" /> Service Businesses
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0"
          >
            Build your website, manage bookings, and grow your business with AI.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start"
          >
            <Button size="lg" className={CTA_PRIMARY} rightIcon={<ArrowRightIcon />}>
              Start Free
            </Button>
            <Button size="lg" className={CTA_SECONDARY}>
              Book Demo
            </Button>
          </motion.div>

          <motion.p variants={item} className="mt-5 text-sm text-muted">
            No credit card required · Free 14-day trial
          </motion.p>
        </div>

        {/* Visual */}
        <motion.div
          variants={item}
          className="relative w-full lg:pl-4"
          aria-hidden={false}
        >
          <DashboardMockup />
        </motion.div>
      </motion.div>
    </section>
  );
}
