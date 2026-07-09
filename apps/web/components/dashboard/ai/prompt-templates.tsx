import { TEMPLATES } from "./mock-data";

interface PromptTemplatesProps {
  onSelect: (prompt: string) => void;
}

/* The template gallery (Marketing, Email, Website Copy, Social Media,
   Business Analysis). Selecting one starts a conversation with its prompt. */
export function PromptTemplates({ onSelect }: PromptTemplatesProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TEMPLATES.map(({ id, name, description, icon: Icon, prompt }) => (
        <li key={id}>
          <button
            type="button"
            onClick={() => onSelect(prompt)}
            className="group flex h-full w-full items-start gap-3 rounded-xl border border-hairline bg-canvas/40 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-white">{name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                {description}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
