import { Button, type ButtonProps } from "@repo/ui";

const VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "destructive",
] as const satisfies readonly NonNullable<ButtonProps["variant"]>[];

const SIZES = [
  "sm",
  "md",
  "lg",
] as const satisfies readonly NonNullable<ButtonProps["size"]>[];

const VARIANT_LABELS: Record<(typeof VARIANTS)[number], string> = {
  primary: "Primary",
  secondary: "Secondary",
  outline: "Outline",
  ghost: "Ghost",
  destructive: "Destructive",
};

const SIZE_LABELS: Record<(typeof SIZES)[number], string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="2"
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

function PlaygroundSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${title}-heading`}>
      <h2
        id={`${title}-heading`}
        className="text-sm font-medium uppercase tracking-wide text-zinc-400"
      >
        {title}
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-6">
        {children}
      </div>
    </section>
  );
}

export default function PlaygroundPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] px-6 py-16 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-12">
        <header>
          <h1 className="text-4xl font-bold tracking-tight">
            Verix UI Playground
          </h1>
          <p className="mt-2 text-base text-zinc-400">
            Internal reference for the shared Button component and its
            states.
          </p>
        </header>

        <PlaygroundSection title="Variants">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {VARIANT_LABELS[variant]}
            </Button>
          ))}
        </PlaygroundSection>

        <PlaygroundSection title="Sizes">
          {SIZES.map((size) => (
            <Button key={size} size={size}>
              {SIZE_LABELS[size]}
            </Button>
          ))}
        </PlaygroundSection>

        <PlaygroundSection title="Loading">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} loading>
              {VARIANT_LABELS[variant]}
            </Button>
          ))}
        </PlaygroundSection>

        <PlaygroundSection title="Disabled">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} disabled>
              {VARIANT_LABELS[variant]}
            </Button>
          ))}
        </PlaygroundSection>

        <PlaygroundSection title="Icon buttons">
          <Button leftIcon={<PlusIcon />}>Add item</Button>
          <Button rightIcon={<ArrowRightIcon />}>Continue</Button>
          <Button
            variant="outline"
            leftIcon={<PlusIcon />}
            rightIcon={<ArrowRightIcon />}
          >
            Both icons
          </Button>
        </PlaygroundSection>
      </div>
    </main>
  );
}
