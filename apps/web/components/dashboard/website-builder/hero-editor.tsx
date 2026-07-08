"use client";

import { useId, useState, type ChangeEvent } from "react";
import { FieldInput } from "../business-profile/field-input";
import { FIELD_CONTROL_BASE, FIELD_LABEL } from "../business-profile/field-styles";
import { UploadIcon } from "../business-profile/icons";
import { SectionCard } from "../home/section-card";
import { HERO } from "./mock-data";
import type { HeroContent } from "./types";

/* Live-editing hero: the fields drive the preview above them so edits are
   visible immediately (controlled inputs). */
export function HeroEditor() {
  const [hero, setHero] = useState<HeroContent>(HERO);
  const subtitleId = useId();

  const update =
    (key: keyof HeroContent) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setHero((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <SectionCard id="hero" title="Hero editor">
      <div className="flex flex-col gap-6">
        {/* Live preview */}
        <div className="overflow-hidden rounded-xl border border-hairline">
          <div className="relative flex min-h-[220px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-accent/25 via-canvas to-canvas px-6 py-10 text-center">
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas/70 px-2.5 py-1.5 text-xs text-muted backdrop-blur transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <UploadIcon className="h-3.5 w-3.5" />
              Background
            </button>
            <p className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {hero.title || "Your headline"}
            </p>
            <p className="max-w-md text-sm text-muted">
              {hero.subtitle || "Your supporting subtitle goes here."}
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white">
                {hero.primaryCta || "Primary"}
              </span>
              <span className="rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-white">
                {hero.secondaryCta || "Secondary"}
              </span>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 gap-5">
          <FieldInput
            label="Title"
            name="heroTitle"
            value={hero.title}
            onChange={update("title")}
          />
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor={subtitleId} className={FIELD_LABEL}>
              Subtitle
            </label>
            <textarea
              id={subtitleId}
              name="heroSubtitle"
              rows={2}
              value={hero.subtitle}
              onChange={update("subtitle")}
              className={`${FIELD_CONTROL_BASE} resize-y p-3 leading-relaxed`}
            />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldInput
              label="Primary button"
              name="heroPrimary"
              value={hero.primaryCta}
              onChange={update("primaryCta")}
            />
            <FieldInput
              label="Secondary button"
              name="heroSecondary"
              value={hero.secondaryCta}
              onChange={update("secondaryCta")}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
