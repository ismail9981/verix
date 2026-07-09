"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { PaperclipIcon, SendIcon } from "./icons";

interface PromptInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function PromptInput({ onSend, disabled = false }: PromptInputProps) {
  const [value, setValue] = useState("");
  const id = useId();
  const canSend = value.trim().length > 0 && !disabled;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        onSend(value.trim());
        setValue("");
      }
    }
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label htmlFor={id} className="sr-only">
        Message the assistant
      </label>
      <button
        type="button"
        aria-label="Attach file"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <PaperclipIcon className="h-5 w-5" />
      </button>
      <textarea
        id={id}
        rows={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask the AI anything…"
        className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-white placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send message"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <SendIcon className="h-5 w-5" />
      </button>
    </form>
  );
}
