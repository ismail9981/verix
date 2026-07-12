"use client";

import { resolveTheme } from "../../../../src/website/theme/resolve";
import { SnapshotPageView } from "../../../../src/website/render/snapshot-renderer";
import { templatePreviewPages } from "../../../../src/website/templates/template-preview-model";
import type { TemplateDefinition } from "../../../../src/website/templates/types";

/*
 * Template preview panel. Default export so the wizard can lazy-load it (the
 * preview code — snapshot renderer + theme provider — is only fetched once a
 * template is selected). Renders the template's Home page through the EXISTING
 * SnapshotPageView under the template's theme, so the preview is exactly the
 * sections that will be installed. No renderer is duplicated.
 */
export default function TemplatePreview({
  template,
}: {
  template: TemplateDefinition;
}) {
  const pages = templatePreviewPages(template);
  const tokens = resolveTheme(template.themeKey).tokens;
  const home = pages[0];

  return (
    <div>
      <p className="mb-2 text-xs text-muted">
        Preview · {pages.length} page{pages.length === 1 ? "" : "s"}:{" "}
        {pages.map((p) => p.title).join(", ")}
      </p>
      <div className="overflow-hidden rounded-xl border border-hairline">
        {home && home.sections.length > 0 ? (
          <SnapshotPageView page={home} tokens={tokens} />
        ) : (
          <p className="px-6 py-12 text-center text-sm text-muted">
            This template starts with an empty {home?.title ?? "page"}.
          </p>
        )}
      </div>
    </div>
  );
}
