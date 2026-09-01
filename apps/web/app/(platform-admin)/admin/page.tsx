import type { Metadata } from "next";
import { requirePlatformPageCapability } from "../../../src/server/auth/platform-page-authorization";

export const metadata: Metadata = { title: "Overview" };

export default async function PlatformAdminOverviewPage() {
  await requirePlatformPageCapability("platform.workspaces.read");
  return (
    <section aria-labelledby="platform-overview-title">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
        Platform administration
      </p>
      <h1
        id="platform-overview-title"
        className="mt-2 text-3xl font-semibold tracking-tight text-white"
      >
        Overview
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
        This protected shell is the foundation for approved Sprint 2 platform
        operations. No tenant data or lifecycle controls are exposed in C2.
      </p>
    </section>
  );
}
