import { AiIcon } from "../../landing/icons";
import { PromptTemplates } from "./prompt-templates";
import { SuggestedPrompts } from "./suggested-prompts";

/* Shown when a chat has no messages: a greeting, quick suggested prompts, and
   the template gallery — all of which start a conversation. */
export function EmptyConversation({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <AiIcon className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-white">
            How can I help you today?
          </h3>
          <p className="mt-1 text-sm text-muted">
            Start with a suggestion or pick a template below.
          </p>
        </div>
        <SuggestedPrompts onSelect={onPrompt} />
      </div>

      <div className="w-full">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Templates
        </p>
        <PromptTemplates onSelect={onPrompt} />
      </div>
    </div>
  );
}
