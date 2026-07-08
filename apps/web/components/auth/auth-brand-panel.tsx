import Link from "next/link";
import { CheckIcon } from "../landing/icons";
import { Logo } from "../landing/logo";

/* Left-hand marketing panel, desktop only. Uses a <p> (not a heading) for the
   pitch so the form's <h1> remains the page's sole top-level heading. */
const HIGHLIGHTS = [
  "AI website builder",
  "Online booking & payments",
  "Smart CRM & analytics",
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden border-r border-hairline bg-canvas p-12 lg:flex lg:flex-col lg:justify-between">
      {/* Soft accent glow — the same non-flashy backdrop as the Hero. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-accent/20 blur-[130px]"
      />

      <Link
        href="/"
        aria-label="Verix home"
        className="relative w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Logo />
      </Link>

      <div className="relative">
        <p className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
          The all-in-one platform for service businesses.
        </p>
        <ul className="mt-8 space-y-4">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-center gap-3 text-muted">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent">
                <CheckIcon className="h-4 w-4" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-muted">
        Trusted by growing salons, clinics, gyms, and agencies.
      </p>
    </div>
  );
}
