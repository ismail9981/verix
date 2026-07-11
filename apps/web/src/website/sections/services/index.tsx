import { lazy } from "react";
import { z } from "zod";
import type { SectionPreviewProps } from "../../render/types";
import { defineSection } from "../define";
import { ServicesIcon } from "../icons";

const ServicesEditor = lazy(() =>
  import("./editor").then((m) => ({ default: m.ServicesEditor })),
);

export const servicesSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required").max(120),
  columns: z.number().int().min(2).max(4),
  showPrices: z.boolean(),
  limit: z.number().int().min(1).max(24),
});
export type ServicesProps = z.infer<typeof servicesSchema>;

/** Live data resolved for this section (a lean view of the Services catalog). */
export interface ServicesItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
}
export interface ServicesData {
  services: ServicesItem[];
}

export const SERVICES_DEFAULTS: ServicesProps = {
  heading: "Our services",
  columns: 3,
  showPrices: true,
  limit: 6,
};

function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function ServicesPreview({
  props,
  data,
}: SectionPreviewProps<ServicesProps, ServicesData>) {
  const cols =
    props.columns === 2
      ? "sm:grid-cols-2"
      : props.columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div
      style={{
        background: "var(--wb-color-surface)",
        border: "1px solid var(--wb-color-border)",
        borderRadius: "var(--wb-radius-lg)",
        padding: "var(--wb-container-padding)",
        boxShadow: "var(--wb-shadow-md)",
      }}
    >
      <h2
        className="mb-5 font-bold"
        style={{
          fontFamily: "var(--wb-font-heading)",
          fontSize: "calc(1.35rem * var(--wb-font-scale))",
          color: "var(--wb-color-text)",
        }}
      >
        {props.heading}
      </h2>
      {data.services.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--wb-color-muted)" }}>
          No active services to show yet.
        </p>
      ) : (
        <ul className={`grid grid-cols-1 gap-4 ${cols}`}>
          {data.services.map((service) => (
            <li
              key={service.id}
              className="flex flex-col gap-1 p-4"
              style={{
                border: "1px solid var(--wb-color-border)",
                borderRadius: "var(--wb-radius-md)",
                background: "var(--wb-color-background)",
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--wb-color-text)" }}
                >
                  {service.name}
                </span>
                {props.showPrices ? (
                  <span
                    className="text-sm font-medium tabular-nums"
                    style={{ color: "var(--wb-color-primary)" }}
                  >
                    {formatPrice(service.priceCents)}
                  </span>
                ) : null}
              </div>
              {service.description ? (
                <p
                  className="line-clamp-2 text-xs"
                  style={{ color: "var(--wb-color-muted)" }}
                >
                  {service.description}
                </p>
              ) : null}
              <span
                className="mt-1 text-[11px]"
                style={{ color: "var(--wb-color-muted)" }}
              >
                {service.durationMinutes} min
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const servicesSection = defineSection<ServicesProps, ServicesData>({
  key: "services",
  version: 1,
  displayName: "Services",
  description: "A grid of your live services with optional pricing.",
  icon: ServicesIcon,
  category: "Commerce",
  schema: servicesSchema,
  defaultProps: SERVICES_DEFAULTS,
  Editor: ServicesEditor,
  Preview: ServicesPreview,
  inlineText: [{ key: "heading", label: "Heading" }],
});
