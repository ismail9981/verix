"use client";

import { ChevronDownIcon } from "../landing/icons";
import { PlusIcon } from "./icons";
import { Popover } from "./popover";
import type { Workspace } from "./types";

/* Placeholder workspaces. Real data arrives with the workspace API. */
const WORKSPACES: Workspace[] = [
  { id: "bloom", name: "Bloom Studio", plan: "Pro", initial: "B", color: "#6d5ef9" },
  { id: "peak", name: "Peak Fitness", plan: "Starter", initial: "P", color: "#2dd4bf" },
  { id: "lumen", name: "Lumen Clinic", plan: "Business", initial: "L", color: "#f59e0b" },
];

function WorkspaceAvatar({ workspace, size = "sm" }: { workspace: Workspace; size?: "sm" | "md" }) {
  const dimension = size === "md" ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-md font-semibold text-white ${dimension}`}
      style={{ backgroundColor: workspace.color }}
    >
      {workspace.initial}
    </span>
  );
}

export function WorkspaceSwitcher() {
  const active = WORKSPACES[0]!;

  return (
    <Popover
      label="Switch workspace"
      align="start"
      panelClassName="w-64"
      triggerClassName="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      trigger={
        <>
          <WorkspaceAvatar workspace={active} />
          <span className="hidden max-w-[8rem] truncate font-medium sm:block">
            {active.name}
          </span>
          <ChevronDownIcon className="h-4 w-4 text-muted" />
        </>
      }
    >
      {(close) => (
        <div className="p-1.5">
          <p className="px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            Workspaces
          </p>
          <ul>
            {WORKSPACES.map((workspace) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  onClick={close}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <WorkspaceAvatar workspace={workspace} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {workspace.name}
                    </span>
                    <span className="block text-xs text-muted">{workspace.plan}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1.5 h-px bg-hairline" />
          <button
            type="button"
            onClick={close}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-hairline">
              <PlusIcon className="h-4 w-4" />
            </span>
            Create workspace
          </button>
        </div>
      )}
    </Popover>
  );
}
