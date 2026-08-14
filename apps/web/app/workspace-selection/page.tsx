import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { switchActiveWorkspaceAction } from "../../src/server/actions/active-workspace";
import { getActiveWorkspaceResolution } from "../../src/server/auth/active-workspace";

export const metadata: Metadata = { title: "Select Workspace" };

export default async function WorkspaceSelectionPage() {
  const resolution = await getActiveWorkspaceResolution();
  if (resolution.state === "AUTO_SELECTED" || resolution.state === "SELECTED") {
    redirect("/dashboard");
  }

  const noAccess = resolution.state === "NONE";
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-hairline bg-surface p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Verix
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          {noAccess ? "No active workspace" : "Choose your workspace"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {noAccess
            ? "Your account has no active workspace membership. Contact your workspace owner or support."
            : "Your account belongs to multiple workspaces. Select one to continue."}
        </p>
        {!noAccess ? (
          <ul className="mt-6 space-y-2">
            {resolution.options.map((workspace) => (
              <li key={workspace.workspaceId}>
                <form action={switchActiveWorkspaceAction}>
                  <input type="hidden" name="workspaceId" value={workspace.workspaceId} />
                  <input type="hidden" name="redirectTo" value="/dashboard" />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3 text-left transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span>
                      <span className="block font-medium">{workspace.name}</span>
                      <span className="text-xs text-muted">{workspace.role}</span>
                    </span>
                    <span className="text-sm text-accent">Continue</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

