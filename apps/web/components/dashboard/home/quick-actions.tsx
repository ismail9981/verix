import Link from "next/link";
import { ArrowRightIcon } from "../../landing/icons";
import { Reveal, RevealItem } from "../../landing/reveal";
import { QUICK_ACTIONS } from "./mock-data";

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-title">
      <h2
        id="quick-actions-title"
        className="text-sm font-semibold text-white"
      >
        Quick actions
      </h2>
      <Reveal
        as="ul"
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {QUICK_ACTIONS.map(({ label, description, href, icon: Icon }) => (
          <RevealItem as="li" key={label}>
            <Link
              href={href}
              className="group flex h-full items-start gap-4 rounded-2xl border border-hairline bg-surface/40 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <ArrowRightIcon className="h-4 w-4 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">
                  {description}
                </span>
              </span>
            </Link>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}
