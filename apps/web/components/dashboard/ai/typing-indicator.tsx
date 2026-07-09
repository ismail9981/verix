import { AiIcon } from "../../landing/icons";

/* Animated "assistant is typing" indicator. Dots bounce only when motion is
   allowed; screen readers get a polite status message. */
export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
      >
        <AiIcon className="h-4 w-4" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl border border-hairline bg-canvas/60 px-4 py-3">
        <span className="sr-only" role="status">
          Assistant is typing
        </span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-muted motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
