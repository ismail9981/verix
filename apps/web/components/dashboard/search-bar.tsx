"use client";

import { useEffect, useRef } from "react";
import { Input } from "@repo/ui";
import { SearchIcon } from "./icons";

/* UI-only global search. Reuses the shared Input (dark-themed via className
   overrides) and wires the ⌘K / Ctrl+K shortcut to focus it. */
const INPUT_DARK =
  "h-9 border-hairline bg-canvas text-white placeholder:text-muted focus-visible:ring-accent focus-visible:ring-offset-canvas";

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="hidden w-full max-w-md md:block">
      <Input
        ref={inputRef}
        type="search"
        aria-label="Search"
        placeholder="Search anything..."
        leftIcon={<SearchIcon className="h-4 w-4" />}
        rightIcon={
          <kbd className="pointer-events-none hidden items-center gap-0.5 rounded border border-hairline bg-surface px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted lg:inline-flex">
            ⌘K
          </kbd>
        }
        className={INPUT_DARK}
        containerClassName="w-full"
      />
    </div>
  );
}
