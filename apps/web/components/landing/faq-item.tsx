"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDownIcon } from "./icons";
import { RevealItem } from "./reveal";

export interface FaqEntry {
  question: string;
  answer: string;
}

interface FaqItemProps extends FaqEntry {
  id: string;
  isOpen: boolean;
  onToggle: () => void;
}

/* A single accordion row. Open/close is controlled by the parent so only
   one item is expanded at a time. The panel height animates smoothly. */
export function FaqItem({ id, question, answer, isOpen, onToggle }: FaqItemProps) {
  const reduceMotion = useReducedMotion();
  const buttonId = `${id}-button`;
  const panelId = `${id}-panel`;

  return (
    <RevealItem as="li" className="border-b border-hairline">
      <h3>
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {question}
          <ChevronDownIcon
            className={`h-5 w-5 shrink-0 text-muted transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-8 text-sm leading-relaxed text-muted">
              {answer}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </RevealItem>
  );
}
