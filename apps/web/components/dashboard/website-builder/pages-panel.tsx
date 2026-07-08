"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { PlusIcon } from "../icons";
import { PAGES } from "./mock-data";
import { StatusPill } from "./status-pill";

/* The site's pages. Selecting one is a UI affordance (the editor would load
   that page); "Add page" is a placeholder. */
export function PagesPanel() {
  const [selected, setSelected] = useState(PAGES[0]!.id);

  return (
    <SectionCard
      id="pages"
      title="Pages"
      bodyClassName="p-2"
      action={
        <Button
          type="button"
          size="sm"
          className={CTA_SECONDARY}
          leftIcon={<PlusIcon className="h-4 w-4" />}
        >
          Add page
        </Button>
      }
    >
      <ul>
        {PAGES.map((page) => {
          const active = page.id === selected;
          return (
            <li key={page.id}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setSelected(page.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active ? "bg-accent/10" : "hover:bg-canvas"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {page.name}
                    </span>
                    {page.home ? (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">
                        Home
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted">{page.path}</span>
                </span>
                <StatusPill status={page.status} />
              </button>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
