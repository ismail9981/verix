import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

/* Line icons for auth input adornments — same 24px grid and stroke weight
   as the shared landing icon set for visual consistency. */
function Line({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function MailIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Line>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
    </Line>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </Line>
  );
}

/* Google's multi-color mark — kept as an exception to the monochrome set
   because the brand glyph is instantly recognizable. */
export function GoogleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23 12.25c0-.78-.07-1.53-.2-2.25H12v4.51h6.19a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.39-4.96 3.39-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.67a7.2 7.2 0 0 1 0-4.6V7.1H1.7a12 12 0 0 0 0 10.55l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.2 15.1 0 12 0 7.7 0 3.99 2.47 1.7 6.05L5.55 9.9C6.46 7.19 9 4.75 12 4.75Z"
      />
    </svg>
  );
}
