"use client";

import { TemplateCard } from "./template-card";
import type { TemplateDefinition } from "../../../../src/website/templates/types";

/*
 * The gallery reads its templates straight from the registry (passed in by the
 * wizard) — nothing is hardcoded. Renders the empty state with a retry when the
 * registry yields nothing.
 */
interface TemplateGalleryProps {
  templates: TemplateDefinition[];
  selectedKey: string | null;
  onPreview: (key: string) => void;
  onUse: (key: string) => void;
  onRetry: () => void;
}

export function TemplateGallery({
  templates,
  selectedKey,
  onPreview,
  onUse,
  onRetry,
}: TemplateGalleryProps) {
  if (templates.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline px-6 py-12 text-center"
      >
        <p className="text-sm font-medium text-white">No templates available</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-hairline px-3 py-1.5 text-xs text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Choose a template"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {templates.map((template) => (
        <TemplateCard
          key={template.key}
          template={template}
          selected={selectedKey === template.key}
          onPreview={onPreview}
          onUse={onUse}
        />
      ))}
    </div>
  );
}
