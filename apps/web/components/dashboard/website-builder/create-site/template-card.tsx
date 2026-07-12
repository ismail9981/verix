"use client";

import { memo } from "react";
import { Badge } from "../../ui/badge";
import { getTheme } from "../../../../src/website/theme/registry";
import type { TemplateDefinition } from "../../../../src/website/templates/types";

/*
 * One template in the gallery. A labelled group (not a nested-button) with the
 * template's thumbnail, name, description, category and theme badge, plus the
 * two required actions. Both actions select the template (single selection);
 * "Use template" also advances to the details form. Memoized so a selection
 * change re-renders only the two affected cards.
 */

interface TemplateCardProps {
  template: TemplateDefinition;
  selected: boolean;
  onPreview: (key: string) => void;
  onUse: (key: string) => void;
}

const actionBtn =
  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function TemplateCardImpl({
  template,
  selected,
  onPreview,
  onUse,
}: TemplateCardProps) {
  const themeName = getTheme(template.themeKey)?.displayName ?? template.themeKey;
  const titleId = `tpl-${template.key}-title`;

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-current={selected ? "true" : undefined}
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${
        selected ? "border-accent bg-canvas/60" : "border-hairline bg-surface/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-hairline bg-canvas text-lg"
        >
          {template.thumbnail || "▦"}
        </span>
        <div className="min-w-0">
          <h4 id={titleId} className="truncate text-sm font-semibold text-white">
            {template.name}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{template.category}</Badge>
            <Badge tone="accent">{themeName} theme</Badge>
          </div>
        </div>
      </div>

      <p className="line-clamp-2 text-xs text-muted">{template.description}</p>

      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPreview(template.key)}
          aria-pressed={selected}
          aria-label={`Preview the ${template.name} template`}
          className={`${actionBtn} border border-hairline text-muted hover:bg-canvas hover:text-white`}
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => onUse(template.key)}
          aria-label={`Use the ${template.name} template`}
          className={`${actionBtn} ${
            selected
              ? "bg-accent text-white"
              : "border border-hairline text-white hover:bg-canvas"
          }`}
        >
          Use template
        </button>
      </div>
    </div>
  );
}

export const TemplateCard = memo(TemplateCardImpl);
