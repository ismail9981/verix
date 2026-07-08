import Link from "next/link";

interface AuthAltActionProps {
  prompt: string;
  href: string;
  label: string;
}

/* The "Don't have an account? Sign up" style cross-link at the foot of a form. */
export function AuthAltAction({ prompt, href, label }: AuthAltActionProps) {
  return (
    <p className="text-center text-sm text-muted">
      {prompt}{" "}
      <Link
        href={href}
        className="font-medium text-accent underline-offset-4 hover:text-accent-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {label}
      </Link>
    </p>
  );
}
