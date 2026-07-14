import { ImageResponse } from "next/og";
import { getPublishedSnapshot } from "../../../../../src/server/services/website-publish.service";
import { selectSnapshotPage } from "../../../../../src/website/render/snapshot";
import { composeTitle } from "../../../../../src/website/render/site-metadata";

/*
 * Branded Open Graph image fallback (Sprint 8) — used only when a page/site
 * has no explicit configured social image (see `resolveSocialImage` in
 * `site-metadata.ts`). Renders a simple, theme-aware card from already-frozen
 * snapshot fields only: no remote image fetch (no SSRF surface), no arbitrary
 * user HTML, deterministic per published version (a re-publish changes the
 * output, matching the new `publishedAt`).
 */

export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;

/** Bounds what untrusted-length text can do to the layout — this is display text only (Satori escapes it), not markup. */
function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface RouteParams {
  siteId: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { siteId } = await params;
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("p") ?? "";
  const locale = searchParams.get("l") ?? undefined;

  const snapshot = await getPublishedSnapshot(siteId);
  const page = snapshot ? selectSnapshotPage(snapshot, path, locale) : undefined;

  const siteName = snapshot ? truncate(snapshot.site.name, 60) : "Verix";
  const title = snapshot && page ? truncate(composeTitle(page, snapshot), 90) : siteName;
  const colors = snapshot?.theme.tokens.colors ?? {
    background: "#0B0B12",
    primary: "#6D5EF9",
    text: "#FFFFFF",
    muted: "#9CA3AF",
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: colors.background,
          backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${colors.primary}22 100%)`,
        }}
      >
        <div
          style={{
            width: "64px",
            height: "8px",
            borderRadius: "9999px",
            backgroundColor: colors.primary,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: colors.text, lineHeight: 1.15 }}>
            {title}
          </div>
          <div style={{ fontSize: 32, color: colors.muted }}>{siteName}</div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
