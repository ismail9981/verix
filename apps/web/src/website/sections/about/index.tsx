import { lazy } from "react";
import { z } from "zod";
import type { SectionPreviewProps } from "../../render/types";
import { defineSection } from "../define";
import { AboutIcon } from "../icons";

const AboutEditor = lazy(() =>
  import("./editor").then((m) => ({ default: m.AboutEditor })),
);

export const aboutSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required").max(120),
  body: z.string().trim().min(1, "Body is required").max(2000),
  imageUrl: z.string().trim().max(500).default(""),
});
export type AboutProps = z.infer<typeof aboutSchema>;

export const ABOUT_DEFAULTS: AboutProps = {
  heading: "About us",
  body: "Tell your story here — who you are, what you do, and why it matters.",
  imageUrl: "",
};

function AboutPreview({ props }: SectionPreviewProps<AboutProps, undefined>) {
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-center"
      style={{
        background: "var(--wb-color-surface)",
        border: "1px solid var(--wb-color-border)",
        borderRadius: "var(--wb-radius-lg)",
        padding: "var(--wb-container-padding)",
        boxShadow: "var(--wb-shadow-md)",
      }}
    >
      <div className="flex flex-col gap-3">
        <h2
          className="font-bold"
          style={{
            fontFamily: "var(--wb-font-heading)",
            fontSize: "calc(1.35rem * var(--wb-font-scale))",
            color: "var(--wb-color-text)",
          }}
        >
          {props.heading}
        </h2>
        <p
          className="whitespace-pre-line text-sm leading-relaxed"
          style={{ color: "var(--wb-color-muted)" }}
        >
          {props.body}
        </p>
      </div>
      <div
        className="aspect-[4/3] overflow-hidden"
        style={{
          border: "1px solid var(--wb-color-border)",
          borderRadius: "var(--wb-radius-md)",
          background: "var(--wb-color-background)",
        }}
      >
        {props.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-xs"
            style={{ color: "var(--wb-color-muted)" }}
          >
            No image
          </div>
        )}
      </div>
    </div>
  );
}

export const aboutSection = defineSection<AboutProps>({
  key: "about",
  version: 1,
  displayName: "About",
  description: "A story block with optional image.",
  icon: AboutIcon,
  category: "Content",
  schema: aboutSchema,
  defaultProps: ABOUT_DEFAULTS,
  Editor: AboutEditor,
  Preview: AboutPreview,
  inlineText: [{ key: "heading", label: "Title" }],
});
