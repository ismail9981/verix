import { SUGGESTED_PROMPTS } from "./mock-data";

export function SuggestedPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {SUGGESTED_PROMPTS.map((prompt) => (
        <li key={prompt}>
          <button
            type="button"
            onClick={() => onSelect(prompt)}
            className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {prompt}
          </button>
        </li>
      ))}
    </ul>
  );
}
