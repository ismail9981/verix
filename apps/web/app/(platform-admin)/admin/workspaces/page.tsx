import type { Metadata } from "next";
import { requirePlatformPageCapability } from "../../../../src/server/auth/platform-page-authorization";

export const metadata: Metadata = { title: "Workspaces" };

export default async function PlatformAdminWorkspacesPlaceholder() {
  await requirePlatformPageCapability("platform.workspaces.read");
  return (
    <section aria-labelledby="platform-workspaces-title">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
        Platform administration
      </p>
      <h1
        id="platform-workspaces-title"
        className="mt-2 text-3xl font-semibold tracking-tight text-white"
      >
        Workspaces
      </h1>
      <div className="mt-6 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6">
        <p className="text-sm text-slate-300">
          Workspace management is not implemented in C2.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          This protected placeholder exists only to verify shell navigation and
          direct-route authorization.
        </p>
      </div>
    </section>
  );
}
