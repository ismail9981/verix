"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/* Shared scroll-reveal primitives. The timing mirrors the Hero's entrance
   (stagger 0.09, 0.6s, the same easing curve) so every section on the page
   animates with one consistent motion language. Below-the-fold sections use
   whileInView instead of the Hero's on-mount trigger. */

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
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

const CONTAINERS = {
  div: motion.div,
  ul: motion.ul,
  ol: motion.ol,
} as const;

const ITEMS = {
  div: motion.div,
  li: motion.li,
} as const;

interface RevealProps {
  as?: keyof typeof CONTAINERS;
  className?: string;
  children: ReactNode;
}

/* Container that staggers its RevealItem descendants into view once. */
export function Reveal({ as = "div", className, children }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Comp = CONTAINERS[as];
  return (
    <Comp
      variants={container}
      initial={reduceMotion ? "show" : "hidden"}
      whileInView={reduceMotion ? undefined : "show"}
      viewport={{ once: true, margin: "-80px" }}
      className={className}
    >
      {children}
    </Comp>
  );
}

interface RevealItemProps {
  as?: keyof typeof ITEMS;
  className?: string;
  children: ReactNode;
  /* Self-animate on mount instead of inheriting the reveal state from a
     Reveal ancestor. Use for items rendered *after* the initial reveal
     (e.g. panels shown on user interaction): the ancestor's `whileInView`
     trigger is `once`, so it has already fired and would leave a
     later-mounted child stuck at the hidden variant (opacity: 0). */
  appear?: boolean;
}

/* A single staggered child. By default it inherits its animation state from a
   Reveal ancestor, so it needs no initial/animate props of its own. When
   `appear` is set it drives its own hidden→show transition on mount. */
export function RevealItem({
  as = "div",
  className,
  children,
  appear = false,
}: RevealItemProps) {
  const reduceMotion = useReducedMotion();
  const Comp = ITEMS[as];
  const selfAnimate = appear
    ? { initial: reduceMotion ? "show" : "hidden", animate: "show" }
    : {};
  return (
    <Comp variants={item} {...selfAnimate} className={className}>
      {children}
    </Comp>
  );
}
