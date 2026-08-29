import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageCapability } from "../../../../../../src/server/auth/page-authorization";
import { compileSiteSnapshot } from "../../../../../../src/server/services/website-snapshot";
import {
  normalizePath,
  selectSnapshotPage,
  type SiteSnapshot,
} from "../../../../../../src/website/render/snapshot";
import { SnapshotPageView } from "../../../../../../src/website/render/snapshot-renderer";
import type { PublishIssue } from "../../../../../../src/server/validators/website";

/*
 * Draft preview. Compiles the live draft with the SAME compiler the publish
 * pipeline uses and renders it with the SAME snapshot renderer, so preview is
 * byte-for-byte what publishing would produce (preview ≡ published) — while
 * still reflecting unpublished edits. Auth-protected via the /website-builder
 * prefix; a shareable signed-token preview is future work.
 */

interface PageProps {
  params: Promise<{ siteId: string; path?: string[] }>;
  searchParams: Promise<{ locale?: string }>;
}

// Always reflect the latest draft, never a cached render.
export const dynamic = "force-dynamic";

function PreviewBanner({
  siteId,
  snapshot,
  issues,
}: {
  siteId: string;
  snapshot: SiteSnapshot;
  issues: PublishIssue[];
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline bg-canvas/95 px-4 py-2 text-xs text-muted backdrop-blur">
      <span className="font-medium text-white">Draft preview</span>
      <span>
        Theme: <span className="text-white">{snapshot.theme.key}</span>
      </span>
      {issues.length > 0 ? (
        <span className="text-warning">
          {issues.length} publish issue{issues.length === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="text-success">Ready to publish</span>
      )}
      <nav className="flex flex-wrap items-center gap-3">
        {snapshot.pages.map((p) => (
          <Link
            key={p.id}
            href={`/website-builder/preview/${siteId}${
              normalizePath(p.path) ? `/${normalizePath(p.path)}` : ""
            }`}
            className="underline-offset-2 hover:text-white hover:underline"
          >
            {p.title}
          </Link>
        ))}
      </nav>
      <Link
        href="/website-builder"
        className="ml-auto text-white underline-offset-2 hover:underline"
      >
        ← Back to builder
      </Link>
    </div>
  );
}

export default async function PreviewPage({ params, searchParams }: PageProps) {
  const { siteId, path } = await params;
  const { locale } = await searchParams;
  const { workspaceId } = await requirePageCapability("website.design.manage");

  const compiled = await compileSiteSnapshot(workspaceId, siteId).catch(
    () => null,
  );
  if (!compiled) notFound();

  const { snapshot, issues } = compiled;
  const page = selectSnapshotPage(snapshot, (path ?? []).join("/"), locale);

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline">
      <PreviewBanner siteId={siteId} snapshot={snapshot} issues={issues} />
      {page ? (
        <SnapshotPageView page={page} tokens={snapshot.theme.tokens} />
      ) : (
        <p className="px-6 py-16 text-center text-sm text-muted">
          {snapshot.pages.length === 0
            ? "This site has no pages yet. Add a page in the builder."
            : "No page matches this path. Pick a page above."}
        </p>
      )}
    </div>
  );
}
