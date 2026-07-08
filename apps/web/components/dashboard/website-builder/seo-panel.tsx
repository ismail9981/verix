"use client";

import { useId, useState } from "react";
import { FieldInput } from "../business-profile/field-input";
import { FIELD_CONTROL_BASE, FIELD_LABEL } from "../business-profile/field-styles";
import { SectionCard } from "../home/section-card";
import { SEO } from "./mock-data";
import { UploadPlaceholder } from "./upload-placeholder";

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

export function SeoPanel() {
  const [metaTitle, setMetaTitle] = useState(SEO.metaTitle);
  const [metaDescription, setMetaDescription] = useState(SEO.metaDescription);
  const descriptionId = useId();
  const descriptionHelpId = `${descriptionId}-help`;

  return (
    <SectionCard id="seo" title="SEO">
      <div className="flex flex-col gap-5">
        <FieldInput
          label="Meta title"
          name="metaTitle"
          value={metaTitle}
          onChange={(event) => setMetaTitle(event.target.value)}
          helperText={`${metaTitle.length} / ${TITLE_LIMIT} characters`}
        />

        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor={descriptionId} className={FIELD_LABEL}>
            Meta description
          </label>
          <textarea
            id={descriptionId}
            name="metaDescription"
            rows={3}
            value={metaDescription}
            onChange={(event) => setMetaDescription(event.target.value)}
            aria-describedby={descriptionHelpId}
            className={`${FIELD_CONTROL_BASE} resize-y p-3 leading-relaxed`}
          />
          <p id={descriptionHelpId} className="text-xs text-muted">
            {metaDescription.length} / {DESCRIPTION_LIMIT} characters
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-white">Open Graph image</p>
          <UploadPlaceholder label="Upload OG image" hint="1200 × 630px recommended" />
        </div>
      </div>
    </SectionCard>
  );
}
