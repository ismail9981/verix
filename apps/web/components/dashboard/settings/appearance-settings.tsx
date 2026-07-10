"use client";

import { FieldInput } from "../business-profile/field-input";
import { FIELD_LABEL } from "../business-profile/field-styles";
import { BRAND_COLORS } from "../business-profile/mock-data";
import { THEME_OPTIONS } from "../../../src/server/validators/settings";
import { SettingsSection } from "./settings-section";
import type { SectionProps } from "./types";

function Swatches({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const colors = BRAND_COLORS.includes(value)
    ? BRAND_COLORS
    : [value, ...BRAND_COLORS];
  return (
    <div>
      <p className={FIELD_LABEL}>{label}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {colors.map((color) => {
          const active = color.toLowerCase() === value.toLowerCase();
          return (
            <li key={color}>
              <button
                type="button"
                aria-label={`${label} ${color}`}
                aria-pressed={active}
                onClick={() => onChange(color)}
                className={`h-8 w-8 rounded-lg border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active ? "border-white" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AppearanceSettings({ values, set, onReset }: SectionProps) {
  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="Personalize how Verix looks for your workspace."
      onReset={onReset}
    >
      <div className="flex flex-col gap-6">
        {/* Theme */}
        <div>
          <p className={FIELD_LABEL}>Theme</p>
          <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-hairline p-1">
            {THEME_OPTIONS.map((option) => {
              const active = option.value === values.theme;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    set("theme", option.value as typeof values.theme)
                  }
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    active ? "bg-surface text-white" : "text-muted hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <Swatches
          label="Primary color"
          value={values.primaryColor}
          onChange={(c) => set("primaryColor", c)}
        />
        <Swatches
          label="Accent color"
          value={values.accentColor}
          onChange={(c) => set("accentColor", c)}
        />

        <div className="grid grid-cols-1 gap-5 border-t border-hairline pt-5 sm:grid-cols-2">
          <FieldInput
            label="Logo URL"
            name="logoUrl"
            type="url"
            placeholder="https://…"
            value={values.logoUrl}
            onChange={(e) => set("logoUrl", e.target.value)}
          />
          <FieldInput
            label="Cover image URL"
            name="coverImageUrl"
            type="url"
            placeholder="https://…"
            value={values.coverImageUrl}
            onChange={(e) => set("coverImageUrl", e.target.value)}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
