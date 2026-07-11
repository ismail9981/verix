"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "framer-motion";
import { ThemeProvider } from "../../../../src/website/theme/theme-provider";
import { SectionView } from "../../../../src/website/render/snapshot-renderer";
import { getSection } from "../../../../src/website/sections/registry";
import { buildServicesData } from "../../../../src/website/sections/services/data";
import { SectionToolbar } from "./section-toolbar";
import { InlineFields } from "./inline-fields";
import type { EditorSection } from "../../../../src/website/builder/editor-state";
import type { ThemeTokens } from "../../../../src/website/theme/tokens";
import type { ServiceListItem } from "../../../../src/server/validators/service";

/*
 * Memoized live preview — renders through the SAME unified SectionView the
 * published site and draft preview use. Kept in its own memo so a drag (which
 * re-renders the sortable wrapper's transform) never re-renders the section's
 * rendered output; only a real prop change to THIS section does.
 */
const SectionPreviewBox = memo(function SectionPreviewBox({
  section,
  themeTokens,
  services,
}: {
  section: EditorSection;
  themeTokens: ThemeTokens;
  services: ServiceListItem[];
}) {
  const data =
    section.typeKey === "services"
      ? buildServicesData(
          services,
          Number((section.props.limit as number | undefined) ?? 6),
        )
      : null;
  return (
    <ThemeProvider tokens={themeTokens} className="p-4">
      <SectionView
        section={{
          id: section.id,
          typeKey: section.typeKey,
          typeVersion: section.typeVersion,
          props: section.props,
          data,
        }}
      />
    </ThemeProvider>
  );
});

interface SectionFrameProps {
  section: EditorSection;
  index: number;
  count: number;
  selected: boolean;
  themeTokens: ThemeTokens;
  services: ServiceListItem[];
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string, next: boolean) => void;
  onInlineChange: (id: string, props: Record<string, unknown>) => void;
  onMove: (from: number, dir: number) => void;
}

function SectionFrameImpl({
  section,
  index,
  count,
  selected,
  themeTokens,
  services,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleVisible,
  onInlineChange,
  onMove,
}: SectionFrameProps) {
  const reduceMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const def = getSection(section.typeKey);
  const label = def?.displayName ?? section.typeKey;
  const inlineFields = def?.inlineText;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: reduceMotion ? undefined : transition,
      }}
      className={`overflow-hidden rounded-xl border bg-surface/40 ${
        selected ? "border-accent" : "border-hairline"
      } ${isDragging ? "opacity-60 shadow-lg" : ""}`}
    >
      <SectionToolbar
        label={label}
        isVisible={section.isVisible}
        canMoveUp={index > 0}
        canMoveDown={index < count - 1}
        dragHandleProps={{ attributes, listeners }}
        onEdit={() => onEdit(section.id)}
        onDuplicate={() => onDuplicate(section.id)}
        onToggleVisible={() => onToggleVisible(section.id, !section.isVisible)}
        onDelete={() => onDelete(section.id)}
        onMoveUp={() => onMove(index, -1)}
        onMoveDown={() => onMove(index, 1)}
      />

      <button
        type="button"
        onClick={() => onSelect(section.id)}
        aria-pressed={selected}
        aria-label={`Select ${label}`}
        className={`block w-full text-left ${section.isVisible ? "" : "opacity-50"}`}
      >
        <SectionPreviewBox
          section={section}
          themeTokens={themeTokens}
          services={services}
        />
      </button>

      {selected && inlineFields && inlineFields.length > 0 ? (
        <InlineFields
          fields={inlineFields}
          props={section.props}
          onChange={(key, value) =>
            onInlineChange(section.id, { ...section.props, [key]: value })
          }
        />
      ) : null}
    </li>
  );
}

/* Only re-render a frame when its own inputs change — not when a sibling does. */
export const SectionFrame = memo(SectionFrameImpl);
