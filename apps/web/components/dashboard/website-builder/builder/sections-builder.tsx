"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SectionCard } from "../../home/section-card";
import { SectionEditorDrawer } from "../section-editor-drawer";
import { SectionFrame } from "./section-frame";
import { AutosaveIndicator } from "./autosave-indicator";
import { useSectionEditor } from "../../../../src/website/builder/use-section-editor";
import { listSections } from "../../../../src/website/sections/registry";
import { listThemes } from "../../../../src/website/theme/registry";
import { resolveTheme } from "../../../../src/website/theme/resolve";
import type { EditorSection } from "../../../../src/website/builder/editor-state";
import type { PageSectionListItem } from "../../../../src/server/validators/website";
import type { ServiceListItem } from "../../../../src/server/validators/service";

const THEME_OPTIONS = listThemes().map((t) => ({
  value: t.key,
  label: t.displayName,
}));
const SECTION_TYPES = listSections().map((s) => ({
  value: s.key,
  label: s.displayName,
}));

const selectClass =
  "rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:hover:bg-transparent";

interface SectionsBuilderProps {
  pageTitle: string;
  pageId: string;
  sections: PageSectionListItem[];
  services: ServiceListItem[];
}

const toEditor = (s: PageSectionListItem): EditorSection => ({
  id: s.id,
  typeKey: s.typeKey,
  typeVersion: s.typeVersion,
  props: s.props,
  isVisible: s.isVisible,
  locale: s.locale,
  position: s.position,
});

export function SectionsBuilder({
  pageTitle,
  pageId,
  sections,
  services,
}: SectionsBuilderProps) {
  const initial = useMemo(() => sections.map(toEditor), [sections]);
  const editor = useSectionEditor(pageId, initial);
  const { reorder, setProps, setVisible, duplicate, remove, undo, redo } = editor;

  const [themeKey, setThemeKey] = useState(THEME_OPTIONS[0]?.value ?? "modern");
  const themeTokens = resolveTheme(themeKey).tokens;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = editor.sections.map((s) => s.id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from >= 0 && to >= 0) reorder(from, to);
    },
    [ids, reorder],
  );

  // Stable per-section handlers (so only the changed frame re-renders).
  const onSelect = useCallback((id: string) => setSelectedId(id), []);
  const onEdit = useCallback((id: string) => setEditingId(id), []);
  const onMove = useCallback(
    (from: number, dir: number) => reorder(from, from + dir),
    [reorder],
  );
  const onDelete = useCallback(
    (id: string) => {
      remove(id);
      setSelectedId((s) => (s === id ? null : s));
    },
    [remove],
  );

  // Keyboard undo/redo (ignored while typing in a field).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const editingSection = editingId
    ? editor.sections.find((s) => s.id === editingId)
    : null;

  function handleEditSubmit(formData: FormData) {
    if (!editingId) return;
    try {
      setProps(editingId, JSON.parse(String(formData.get("props") ?? "{}")));
    } catch {
      /* keep current props on parse failure */
    }
    setEditingId(null);
  }

  return (
    <>
      <SectionCard
        id="sections"
        title={`Sections · ${pageTitle}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AutosaveIndicator status={editor.status} />
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={iconBtn}
                onClick={undo}
                disabled={!editor.canUndo}
                aria-label="Undo"
                title="Undo (⌘Z)"
              >
                ↶
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={redo}
                disabled={!editor.canRedo}
                aria-label="Redo"
                title="Redo (⇧⌘Z)"
              >
                ↷
              </button>
            </div>
            <label className="sr-only" htmlFor="wb-theme">
              Preview theme
            </label>
            <select
              id="wb-theme"
              value={themeKey}
              onChange={(e) => setThemeKey(e.target.value)}
              aria-label="Preview theme"
              className={selectClass}
            >
              {THEME_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} theme
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="wb-add-section">
              Add section
            </label>
            <select
              id="wb-add-section"
              value=""
              onChange={(e) => {
                if (e.target.value) editor.addSection(e.target.value);
                e.currentTarget.value = "";
              }}
              aria-label="Add section"
              className={selectClass}
            >
              <option value="" disabled>
                + Add section
              </option>
              {SECTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {editor.sections.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">
            No sections yet. Use “Add section” to place your first block.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-4">
                {editor.sections.map((section, index) => (
                  <SectionFrame
                    key={section.id}
                    section={section}
                    index={index}
                    count={editor.sections.length}
                    selected={selectedId === section.id}
                    themeTokens={themeTokens}
                    services={services}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onDuplicate={duplicate}
                    onDelete={onDelete}
                    onToggleVisible={setVisible}
                    onInlineChange={setProps}
                    onMove={onMove}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </SectionCard>

      <SectionEditorDrawer
        key={editingId ?? "none"}
        open={editingSection != null}
        mode="edit"
        lockType
        hideLayoutFields
        section={
          editingSection
            ? { ...editingSection, siteId: "", pageId, createdAt: new Date() }
            : null
        }
        pageId={pageId}
        services={services}
        themeTokens={themeTokens}
        pending={editor.status === "saving"}
        onClose={() => setEditingId(null)}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
