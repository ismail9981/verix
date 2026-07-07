import type { Metadata } from "next";
import {
  Button,
  type ButtonProps,
  colors,
  Input,
  radius,
  shadows,
  spacing,
  typography,
} from "@repo/ui";

export const metadata: Metadata = {
  title: "Verix Design System",
  description: "Internal reference for Verix design tokens and UI components.",
};

const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "destructive",
] as const satisfies readonly NonNullable<ButtonProps["variant"]>[];

const BUTTON_SIZES = [
  "sm",
  "md",
  "lg",
] as const satisfies readonly NonNullable<ButtonProps["size"]>[];

/* The spacing scale runs 0–96px in 1px steps; a representative
   sample keeps the reference readable. */
const SPACING_SAMPLE = [1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96] as const;

const SECTIONS = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing" },
  { id: "radius", label: "Radius" },
  { id: "shadows", label: "Shadows" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs" },
] as const;

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13 13l4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
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

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2
        id={`${id}-heading`}
        className="text-2xl font-semibold tracking-tight"
      >
        {title}
      </h2>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* Components are designed for light surfaces, so demos sit on white. */
function DemoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-white p-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function TokenName({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-sm font-medium text-white">
      {children}
    </code>
  );
}

function TokenValue({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs text-zinc-500">{children}</code>;
}

export default function DesignSystemPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: colors.background }}
    >
      <header className="border-b border-zinc-800 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-medium" style={{ color: colors.accent }}>
            Internal reference
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Verix Design System
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            The single source of truth for Verix design tokens and shared UI
            components. Values on this page are rendered directly from{" "}
            <code className="font-mono text-base text-zinc-300">
              @repo/ui
            </code>{" "}
            and stay in sync automatically.
          </p>
          <nav aria-label="Design system sections" className="mt-8">
            <ul className="flex flex-wrap gap-2">
              {SECTIONS.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="inline-flex rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-20">
          <Section
            id="colors"
            title="Colors"
            description="Core palette. Background and surface anchor the dark theme; accent is the Verix brand color."
          >
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(colors).map(([name, value]) => (
                <li
                  key={name}
                  className="overflow-hidden rounded-xl border border-zinc-800"
                >
                  <div
                    className="h-20"
                    style={{ backgroundColor: value }}
                    role="img"
                    aria-label={`${name} color swatch, ${value}`}
                  />
                  <div className="flex items-baseline justify-between gap-2 border-t border-zinc-800 px-4 py-3">
                    <TokenName>{name}</TokenName>
                    <TokenValue>{value}</TokenValue>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="typography"
            title="Typography"
            description={`Type scale and weights. Font family: ${typography.fontFamily.sans}.`}
          >
            <div className="flex flex-col gap-10">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Font sizes
                </h3>
                <ul className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                  {Object.entries(typography.fontSize).map(([name, value]) => (
                    <li
                      key={name}
                      className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3"
                    >
                      <span className="w-16 shrink-0">
                        <TokenName>{name}</TokenName>
                      </span>
                      <span className="w-12 shrink-0">
                        <TokenValue>{value}</TokenValue>
                      </span>
                      <span
                        className="min-w-0 truncate leading-tight"
                        style={{ fontSize: value }}
                      >
                        Build with Verix
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Font weights
                </h3>
                <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(typography.fontWeight).map(
                    ([name, value]) => (
                      <li
                        key={name}
                        className="rounded-xl border border-zinc-800 px-4 py-3"
                      >
                        <p className="text-2xl" style={{ fontWeight: value }}>
                          Aa
                        </p>
                        <div className="mt-2 flex items-baseline justify-between gap-2">
                          <TokenName>{name}</TokenName>
                          <TokenValue>{value}</TokenValue>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </Section>

          <Section
            id="spacing"
            title="Spacing"
            description="The scale runs 0–96px in 1px steps; shown here is a representative sample."
          >
            <ul className="flex flex-col gap-2 rounded-xl border border-zinc-800 p-4">
              {SPACING_SAMPLE.map((step) => (
                <li key={step} className="flex items-center gap-4">
                  <span className="w-10 shrink-0 text-right">
                    <TokenName>{step}</TokenName>
                  </span>
                  <span className="w-12 shrink-0">
                    <TokenValue>{spacing[step]}</TokenValue>
                  </span>
                  <span
                    className="h-4 shrink-0 rounded-sm"
                    style={{
                      width: spacing[step],
                      backgroundColor: colors.accent,
                    }}
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="radius"
            title="Radius"
            description="Corner radii for surfaces, controls, and pills."
          >
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {Object.entries(radius).map(([name, value]) => (
                <li key={name} className="flex flex-col items-center gap-3">
                  <div
                    className="h-16 w-16 border-2"
                    style={{
                      borderRadius: value,
                      borderColor: colors.accent,
                      backgroundColor: colors.surface,
                    }}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col items-center">
                    <TokenName>{name}</TokenName>
                    <TokenValue>{value}</TokenValue>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="shadows"
            title="Shadows"
            description="Elevation levels. Shadows are tuned for light surfaces, so they are previewed on white."
          >
            <ul className="grid grid-cols-1 gap-4 rounded-xl bg-zinc-100 p-6 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(shadows).map(([name, value]) => (
                <li
                  key={name}
                  className="rounded-xl bg-white p-6"
                  style={{ boxShadow: value }}
                >
                  <code className="font-mono text-sm font-medium text-zinc-900">
                    {name}
                  </code>
                  <p className="mt-1 font-mono text-xs leading-relaxed text-zinc-500">
                    {value}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="buttons"
            title="Buttons"
            description="The shared Button component: variants, sizes, and states."
          >
            <div className="flex flex-col gap-4">
              <DemoCard title="Variants">
                {BUTTON_VARIANTS.map((variant) => (
                  <Button key={variant} variant={variant}>
                    {variant}
                  </Button>
                ))}
              </DemoCard>
              <DemoCard title="Sizes">
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} size={size}>
                    {size}
                  </Button>
                ))}
              </DemoCard>
              <DemoCard title="Loading">
                {BUTTON_VARIANTS.map((variant) => (
                  <Button key={variant} variant={variant} loading>
                    {variant}
                  </Button>
                ))}
              </DemoCard>
              <DemoCard title="Disabled">
                {BUTTON_VARIANTS.map((variant) => (
                  <Button key={variant} variant={variant} disabled>
                    {variant}
                  </Button>
                ))}
              </DemoCard>
              <DemoCard title="With icons">
                <Button leftIcon={<SearchIcon />}>Search</Button>
                <Button variant="secondary" rightIcon={<ArrowRightIcon />}>
                  Continue
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<SearchIcon />}
                  rightIcon={<ArrowRightIcon />}
                >
                  Both icons
                </Button>
              </DemoCard>
            </div>
          </Section>

          <Section
            id="inputs"
            title="Inputs"
            description="The shared Input component: labels, validation, icons, and states."
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <DemoCard title="Basics">
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  containerClassName="w-full"
                />
                <Input
                  label="Workspace name"
                  placeholder="acme-inc"
                  helperText="Lowercase letters and dashes only."
                  containerClassName="w-full"
                />
                <Input
                  label="Company"
                  placeholder="Acme Inc."
                  required
                  containerClassName="w-full"
                />
              </DemoCard>
              <DemoCard title="Validation & states">
                <Input
                  label="Email"
                  type="email"
                  defaultValue="not-an-email"
                  error="Enter a valid email address."
                  containerClassName="w-full"
                />
                <Input
                  label="API key"
                  placeholder="Checking availability…"
                  loading
                  containerClassName="w-full"
                />
                <Input
                  label="Plan"
                  defaultValue="Enterprise"
                  disabled
                  containerClassName="w-full"
                />
              </DemoCard>
              <DemoCard title="Icons & password">
                <Input
                  label="Search"
                  type="search"
                  placeholder="Search projects"
                  leftIcon={<SearchIcon />}
                  containerClassName="w-full"
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  helperText="Use the eye button to toggle visibility."
                  containerClassName="w-full"
                />
              </DemoCard>
              <DemoCard title="Sizes">
                <Input
                  label="Small"
                  inputSize="sm"
                  placeholder="sm"
                  containerClassName="w-full"
                />
                <Input
                  label="Medium"
                  inputSize="md"
                  placeholder="md"
                  containerClassName="w-full"
                />
                <Input
                  label="Large"
                  inputSize="lg"
                  placeholder="lg"
                  containerClassName="w-full"
                />
              </DemoCard>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
