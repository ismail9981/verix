"use client";

import { useState } from "react";
import { FaqItem, type FaqEntry } from "./faq-item";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const FAQS: FaqEntry[] = [
  {
    question: "How does the free trial work?",
    answer:
      "Start on any plan free for 14 days — no credit card required. You'll only add payment details if you decide to continue after the trial.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Plans are month-to-month, and you can cancel from your dashboard at any time with no cancellation fees.",
  },
  {
    question: "Do I need technical experience?",
    answer:
      "None at all. Verix is built for business owners — set up your website, bookings, and payments without writing a single line of code.",
  },
  {
    question: "Can I migrate my current website?",
    answer:
      "Absolutely. During onboarding we help you import your existing content and connect your custom domain in minutes.",
  },
  {
    question: "Is customer support included?",
    answer:
      "Every plan includes support. Pro and Business add priority and dedicated support with faster guaranteed response times.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="bg-canvas py-24 lg:py-32"
    >
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          headingId="faq-heading"
          eyebrow="FAQ"
          title="Frequently Asked Questions"
        />
        <Reveal as="ul" className="mt-16 border-t border-hairline">
          {FAQS.map((faq, i) => (
            <FaqItem
              key={faq.question}
              id={`faq-${i}`}
              {...faq}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
