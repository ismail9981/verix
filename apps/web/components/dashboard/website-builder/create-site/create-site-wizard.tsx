"use client";

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../../landing/cta-styles";
import { DetailDrawer } from "../../detail-drawer";
import { FieldInput } from "../../business-profile/field-input";
import { TemplateGallery } from "./template-gallery";
import { listTemplates } from "../../../../src/website/templates/registry";
import { createSiteFromTemplateAction } from "../../../../src/server/actions/website";
import type { FieldErrors } from "../../../../src/server/actions/action-result";
import type { TemplateDefinition } from "../../../../src/website/templates/types";
import type { Notify } from "../types";

/*
 * Create Site Wizard: Choose Template → Enter Site Name → Create. Fully
 * controlled and self-contained (renders its own drawer), so it is reusable.
 * The preview is lazy-loaded and only mounted once a template is selected. All
 * persistence goes through createSiteFromTemplateAction — no installer logic is
 * duplicated. On success the parent selects the new site.
 */

// Code-split: the preview (snapshot renderer + theme) loads only when selected.
const TemplatePreview = lazy(() => import("./template-preview"));

interface CreateSiteWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (siteId: string) => void;
  onNotify: Notify;
}

export function CreateSiteWizard({
  open,
  onClose,
  onCreated,
  onNotify,
}: CreateSiteWizardProps) {
  const [templates, setTemplates] = useState<TemplateDefinition[]>(() =>
    listTemplates(),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("en-us");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isInstalling, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const selectedTemplate = selectedKey
    ? (templates.find((t) => t.key === selectedKey) ?? null)
    : null;

  // Reset when the wizard closes so it always reopens clean.
  useEffect(() => {
    if (!open) {
      setSelectedKey(null);
      setName("");
      setLocale("en-us");
      setFieldErrors({});
    }
  }, [open]);

  const focusName = useCallback(() => {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLInputElement>('input[name="siteName"]')
        ?.focus();
    });
  }, []);

  const handlePreview = useCallback((key: string) => setSelectedKey(key), []);
  const handleUse = useCallback(
    (key: string) => {
      setSelectedKey(key);
      focusName();
    },
    [focusName],
  );
  const handleRetry = useCallback(() => setTemplates(listTemplates()), []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedKey) {
      setFieldErrors({ template: ["Choose a template first."] });
      return;
    }
    const formData = new FormData();
    formData.set("templateKey", selectedKey);
    formData.set("siteName", name);
    formData.set("locale", locale);

    startTransition(async () => {
      const result = await createSiteFromTemplateAction(formData);
      if (result.status === "success" && result.siteId) {
        setFieldErrors({});
        onNotify("success", result.message);
        onCreated(result.siteId);
        onClose();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        onNotify("error", result.message);
      }
    });
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      size="lg"
      title="Create a site"
      subtitle="Start from a template"
      ariaLabel="Create a site from a template"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section aria-labelledby="wizard-templates-title">
          <h3
            id="wizard-templates-title"
            className="mb-3 text-xs font-medium uppercase tracking-wide text-muted"
          >
            Choose a template
          </h3>
          <TemplateGallery
            templates={templates}
            selectedKey={selectedKey}
            onPreview={handlePreview}
            onUse={handleUse}
            onRetry={handleRetry}
          />
          {fieldErrors.template ? (
            <p className="mt-2 text-xs text-danger">{fieldErrors.template[0]}</p>
          ) : null}
        </section>

        {selectedTemplate ? (
          <>
            <section aria-label="Template preview">
              <Suspense
                fallback={
                  <p className="text-sm text-muted" role="status">
                    Loading preview…
                  </p>
                }
              >
                <TemplatePreview template={selectedTemplate} />
              </Suspense>
            </section>

            <section
              aria-labelledby="wizard-info-title"
              className="flex flex-col gap-4"
            >
              <h3
                id="wizard-info-title"
                className="text-xs font-medium uppercase tracking-wide text-muted"
              >
                Site information
              </h3>
              <FieldInput
                label="Site name"
                name="siteName"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={fieldErrors.siteName?.[0]}
              />
              <FieldInput
                label="Locale"
                name="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                error={fieldErrors.locale?.[0]}
              />
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  className={CTA_SECONDARY}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={CTA_PRIMARY}
                  loading={isInstalling}
                >
                  Create site
                </Button>
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-muted">
            Select a template to preview it and name your site.
          </p>
        )}
      </form>
    </DetailDrawer>
  );
}
