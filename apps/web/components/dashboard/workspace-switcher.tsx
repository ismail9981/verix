"use client";

import { usePathname } from "next/navigation";
import { ChevronDownIcon } from "../landing/icons";
import { switchActiveWorkspaceAction } from "../../src/server/actions/active-workspace";
import type { WorkspaceOption } from "../../src/server/auth/active-workspace";
import { Popover } from "./popover";

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "W";
}
function WorkspaceAvatar({ workspace }: { workspace: WorkspaceOption }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white"
    >
      {initial(workspace.name)}
    </span>
  );
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: readonly WorkspaceOption[];
  activeWorkspaceId: string;
}) {
  const pathname = usePathname();
  const active =
    workspaces.find(({ workspaceId }) => workspaceId === activeWorkspaceId) ??
    workspaces[0]!;

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
      {() => (
        <div className="p-1.5">
          <p className="px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            Workspaces
          </p>
          <ul>
            {workspaces.map((workspace) => (
              <li key={workspace.workspaceId}>
                <form action={switchActiveWorkspaceAction}>
                  <input type="hidden" name="workspaceId" value={workspace.workspaceId} />
                  <input type="hidden" name="redirectTo" value={pathname} />
                  <button
                    type="submit"
                    aria-current={workspace.workspaceId === activeWorkspaceId ? "true" : undefined}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <WorkspaceAvatar workspace={workspace} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {workspace.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {workspace.plan} · {workspace.role}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  );
}
