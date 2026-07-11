"use client";

import { Suspense, useMemo, useState } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { DetailDrawer } from "../detail-drawer";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import {
  getSection,
  listSections,
} from "../../../src/website/sections/registry";
import { ThemeProvider } from "../../../src/website/theme/theme-provider";
import { SectionView } from "../../../src/website/render/snapshot-renderer";
import { buildServicesData } from "../../../src/website/sections/services/data";
import type { ThemeTokens } from "../../../src/website/theme/tokens";
import type { PageSectionListItem } from "../../../src/server/validators/website";
import type { ServiceListItem } from "../../../src/server/validators/service";

const VISIBLE_OPTIONS = [
  { value: "true", label: "Visible" },
  { value: "false", label: "Hidden" },
];

type Props = Record<string, unknown>;

interface SectionEditorDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  section: PageSectionListItem | null;
  pageId: string;
  services: ServiceListItem[];
  themeTokens: ThemeTokens;
  pending: boolean;
  /** Builder edit: the type is fixed once a section exists. */
  lockType?: boolean;
  /** Builder edit: position/visibility/locale are managed on the canvas. */
  hideLayoutFields?: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

function firstKey(): string {
  return listSections()[0]?.key ?? "hero";
}

export function SectionEditorDrawer({
  open,
  mode,
  section,
  pageId,
  services,
  themeTokens,
  pending,
  lockType = false,
  hideLayoutFields = false,
  onClose,
  onSubmit,
}: SectionEditorDrawerProps) {
  const initialKey =
    section && getSection(section.typeKey) ? section.typeKey : firstKey();
  const [typeKey, setTypeKey] = useState(initialKey);
  const [sectionProps, setSectionProps] = useState<Props>(
    (section?.props as Props) ??
      ((getSection(initialKey)?.defaultProps as Props) ?? {}),
  );
  const [position, setPosition] = useState(String(section?.position ?? 0));
  const [isVisible, setIsVisible] = useState(String(section?.isVisible ?? true));
  const [locale, setLocale] = useState(section?.locale ?? "en-us");
  const [errors, setErrors] = useState<Partial<Record<string, string[]>>>({});

  const def = getSection(typeKey);
  const typeOptions = useMemo(
    () => listSections().map((s) => ({ value: s.key, label: s.displayName })),
    [],
  );

  function changeType(key: string) {
    setTypeKey(key);
    setSectionProps((getSection(key)?.defaultProps as Props) ?? {});
    setErrors({});
  }

  // Live preview data (client-side): only the Services section needs it. Uses
  // the same builder the server resolver does, so the shape can't drift.
  const previewData =
    typeKey === "services"
      ? buildServicesData(
          services,
          Number((sectionProps.limit as number | undefined) ?? 6),
        )
      : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!def) return;

    // Validate props against the section's own Zod schema before submitting.
    const parsed = def.schema.safeParse(sectionProps);
    if (!parsed.success) {
      const next: Partial<Record<string, string[]>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        (next[key] ??= []).push(issue.message);
      }
      setErrors(next);
      return;
    }
    setErrors({});

    const formData = new FormData();
    formData.set("pageId", pageId);
    formData.set("typeKey", typeKey);
    formData.set("typeVersion", String(def.version));
    formData.set("position", position);
    formData.set("isVisible", isVisible);
    formData.set("locale", locale);
    formData.set("props", JSON.stringify(parsed.data));
    onSubmit(formData);
  }

  const Editor = def?.Editor;

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New section" : "Edit section"}
      subtitle={def ? def.description : undefined}
      ariaLabel={mode === "create" ? "New section" : "Edit section"}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col gap-5">
        {lockType ? null : (
          <FieldSelect
            label="Section type"
            name="typeKey"
            options={typeOptions}
            value={typeKey}
            onChange={(e) => changeType(e.target.value)}
          />
        )}

        {Editor ? (
          <Suspense
            fallback={<p className="text-sm text-muted">Loading editor…</p>}
          >
            <Editor
              value={sectionProps}
              onChange={(next) => setSectionProps(next as Props)}
              errors={errors}
            />
          </Suspense>
        ) : null}

        {hideLayoutFields ? null : (
          <div className="grid grid-cols-3 gap-4">
            <FieldInput
              label="Position"
              name="position"
              type="number"
              min={0}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <FieldSelect
              label="Visibility"
              name="isVisible"
              options={VISIBLE_OPTIONS}
              value={isVisible}
              onChange={(e) => setIsVisible(e.target.value)}
            />
            <FieldInput
              label="Locale"
              name="locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            />
          </div>
        )}

        {/* Live preview: rendered through the SAME SectionView the published
            site and draft preview use, under the selected theme's CSS
            variables — one renderer, so editor preview ≡ published. */}
        {def ? (
          <div>
            <p className="mb-2 text-sm font-medium text-white">Preview</p>
            <div className="rounded-xl border border-hairline p-3">
              <ThemeProvider tokens={themeTokens} className="rounded-lg p-4">
                <SectionView
                  section={{
                    id: section?.id ?? "preview",
                    typeKey,
                    typeVersion: def.version,
                    props: sectionProps,
                    data: previewData,
                  }}
                />
              </ThemeProvider>
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-end gap-3 pt-2">
          <Button type="button" className={CTA_SECONDARY} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={pending}>
            {mode === "create" ? "Create section" : "Save changes"}
          </Button>
        </div>
      </form>
    </DetailDrawer>
  );
}
