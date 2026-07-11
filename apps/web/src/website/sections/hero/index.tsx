import { lazy } from "react";
import { z } from "zod";
import type { SectionPreviewProps } from "../../render/types";
import { defineSection } from "../define";
import { HeroIcon } from "../icons";

// Lazy so importing the registry doesn't eagerly pull client-only editor deps.
const HeroEditor = lazy(() =>
  import("./editor").then((m) => ({ default: m.HeroEditor })),
);

export const heroSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required").max(120),
  subheading: z.string().trim().max(240).default(""),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaHref: z.string().trim().max(200).default(""),
  align: z.enum(["left", "center"]).default("center"),
});
export type HeroProps = z.infer<typeof heroSchema>;

export const HERO_DEFAULTS: HeroProps = {
  heading: "Your headline here",
  subheading: "A short supporting sentence about your business.",
  ctaLabel: "Get started",
  ctaHref: "#",
  align: "center",
};

function HeroPreview({ props }: SectionPreviewProps<HeroProps, undefined>) {
  const align =
    props.align === "left" ? "items-start text-left" : "items-center text-center";
  return (
    <div
      className={`flex flex-col gap-4 ${align}`}
      style={{
        background: "var(--wb-color-surface)",
        color: "var(--wb-color-text)",
        border: "1px solid var(--wb-color-border)",
        borderRadius: "var(--wb-radius-lg)",
        padding: "var(--wb-container-padding)",
        boxShadow: "var(--wb-shadow-md)",
      }}
    >
      <h2
        className="font-bold"
        style={{
          fontFamily: "var(--wb-font-heading)",
          fontSize: "calc(1.75rem * var(--wb-font-scale))",
          letterSpacing: "-0.02em",
        }}
      >
        {props.heading}
      </h2>
      {props.subheading ? (
        <p
          className="max-w-xl text-sm leading-relaxed"
          style={{ color: "var(--wb-color-muted)" }}
        >
          {props.subheading}
        </p>
      ) : null}
      {props.ctaLabel ? (
        <span
          className="mt-2 inline-flex font-medium"
          style={{
            background: "var(--wb-button-bg)",
            color: "var(--wb-button-fg)",
            border: "1px solid var(--wb-button-border)",
            borderRadius: "var(--wb-button-radius)",
            padding: "var(--wb-button-padding)",
            fontSize: "var(--wb-button-font-size)",
          }}
        >
          {props.ctaLabel}
        </span>
      ) : null}
    </div>
  );
}

export const heroSection = defineSection<HeroProps>({
  key: "hero",
  version: 1,
  displayName: "Hero",
  description: "A large headline with a call to action.",
  icon: HeroIcon,
  category: "Header",
  schema: heroSchema,
  defaultProps: HERO_DEFAULTS,
  Editor: HeroEditor,
  Preview: HeroPreview,
  inlineText: [
    { key: "heading", label: "Heading" },
    { key: "subheading", label: "Subheading" },
    { key: "ctaLabel", label: "Button label" },
  ],
});
