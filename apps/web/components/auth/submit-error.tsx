/* Submit-level error banner (e.g. a rejected auth request). Field-level
   validation is handled inline by the Input component; this covers the
   request itself. role="alert" so it is announced when it appears. */
export function SubmitError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0"
      >
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M10 6.5v4M10 13.4h.01"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}
