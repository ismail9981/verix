import type { CSSProperties } from "react";
import { getSection } from "../sections/registry";
import { ThemeProvider } from "../theme/theme-provider";
import { SectionErrorBoundary } from "./section-error-boundary";
import { SectionFallback } from "./section-fallback";
import { resolveSnapshotSection } from "./resolve-snapshot-section";
import { InteractiveProvider } from "./interactive-context";
import type { SnapshotPage, SnapshotSection } from "./snapshot";
import type { ThemeTokens } from "../theme/tokens";

/*
 * THE single Website Builder section renderer. Every surface renders through
 * `SectionView` — the published site, the draft preview, and the editor's live
 * section preview — so there is exactly one lookup→version-check→validate→render
 * path and preview ≡ published by construction. It consumes only the section's
 * frozen props + data (never the draft tables), and degrades unknown/version-
 * mismatched/invalid/throwing sections to a typed fallback rather than crashing.
 */

/** One section: version-aware registry resolution, then render or fallback. */
export function SectionView({ section }: { section: SnapshotSection }) {
  const resolved = resolveSnapshotSection(section, getSection);
  if (resolved.status !== "ok") {
    return <SectionFallback typeKey={section.typeKey} reason={resolved.status} />;
  }

  const Preview = resolved.def.Preview;
  return (
    <SectionErrorBoundary
      fallback={<SectionFallback typeKey={section.typeKey} reason="error" />}
    >
      <Preview id={section.id} props={resolved.props} data={section.data} />
    </SectionErrorBoundary>
  );
}

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--wb-section-spacing)",
  maxWidth: "var(--wb-content-width)",
  marginInline: "auto",
  padding: "var(--wb-container-padding)",
};

/**
 * A full page: theme tokens as CSS variables + the ordered section list.
 * `interactive` gates whether an embedded Contact form actually submits —
 * only the real public site route passes `true` (see `interactive-context`).
 */
export function SnapshotPageView({
  page,
  tokens,
  interactive = false,
}: {
  page: SnapshotPage;
  tokens: ThemeTokens;
  interactive?: boolean;
}) {
  return (
    <InteractiveProvider interactive={interactive}>
      <ThemeProvider tokens={tokens} className="min-h-screen">
        {/* A plain div (not <main>) so this is safe to nest inside the dashboard
            shell's <main> during preview without duplicating the landmark. */}
        <div style={listStyle}>
          {page.sections.map((section) => (
            <SectionView key={section.id} section={section} />
          ))}
        </div>
      </ThemeProvider>
    </InteractiveProvider>
  );
}
