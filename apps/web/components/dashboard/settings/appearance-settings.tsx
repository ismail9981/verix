"use client";

import { useState } from "react";
import { FIELD_LABEL } from "../business-profile/field-styles";
import { ProfileSection } from "../business-profile/profile-section";
import { Toggle } from "../business-profile/toggle";
import { BRAND_COLORS, DEFAULT_APPEARANCE, THEMES } from "./mock-data";

export function AppearanceSettings() {
  const [theme, setTheme] = useState(DEFAULT_APPEARANCE.theme);
  const [accent, setAccent] = useState(DEFAULT_APPEARANCE.accent);
  const [compact, setCompact] = useState(DEFAULT_APPEARANCE.compact);

  return (
    <ProfileSection
      id="appearance"
      title="Appearance"
      description="Personalize how Verix looks for your workspace."
    >
      <div className="flex flex-col gap-6">
        {/* Theme */}
        <div>
          <p className={FIELD_LABEL}>Theme</p>
          <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-hairline p-1">
            {THEMES.map((option) => {
              const active = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(option.id)}
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

        {/* Accent color */}
        <div>
          <p className={FIELD_LABEL}>Accent color</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {BRAND_COLORS.map((color) => {
              const active = color === accent;
              return (
                <li key={color}>
                  <button
                    type="button"
                    aria-label={`Accent ${color}`}
                    aria-pressed={active}
                    onClick={() => setAccent(color)}
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

        {/* Compact mode */}
        <div className="flex items-center justify-between gap-4 border-t border-hairline pt-5">
          <div>
            <p className="text-sm font-medium text-white">Compact mode</p>
            <p className="mt-0.5 text-sm text-muted">
              Reduce spacing to fit more on screen.
            </p>
          </div>
          <Toggle checked={compact} onChange={setCompact} label="Compact mode" />
        </div>
      </div>
    </ProfileSection>
  );
}
