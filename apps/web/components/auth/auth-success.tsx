import Link from "next/link";
import { CheckIcon } from "../landing/icons";

interface AuthSuccessProps {
  message: string;
  actionHref: string;
  actionLabel: string;
}

/* Shared success state shown in place of a form after a successful submit.
   Uses role="status" (not a heading) so it complements the card's existing
   <h1> rather than competing with it. */
export function AuthSuccess({
  message,
  actionHref,
  actionLabel,
}: AuthSuccessProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-5 py-2 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
        <CheckIcon className="h-6 w-6" />
      </span>
      <p className="text-sm leading-relaxed text-muted">{message}</p>
      <Link
        href={actionHref}
        className="text-sm font-medium text-accent underline-offset-4 hover:text-accent-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
