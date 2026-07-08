interface LogoProps {
  className?: string;
  /** Set false to render just the mark (e.g. a collapsed sidebar). */
  showWordmark?: boolean;
}

/* Verix wordmark with a geometric mark. Kept presentational and
   dependency-free so it can sit in the navbar, footer, or a menu. */
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white ${className ?? ""}`}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="26" height="26" rx="7" fill="var(--color-accent)" />
        <path
          d="M7 8.5l4 9 4-9M15 8.5l2 4.5 2-4.5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark ? "Verix" : null}
    </span>
  );
}
