"use client";

import { useState } from "react";
import { FieldSelect } from "../business-profile/field-select";
import { FIELD_LABEL } from "../business-profile/field-styles";
import { SectionCard } from "../home/section-card";
import {
  ACCENT_COLORS,
  DEFAULT_ACCENT,
  DEFAULT_FONT,
  DEFAULT_RADIUS,
  DEFAULT_THEME,
  FONTS,
  RADII,
  THEMES,
} from "./mock-data";

export function ThemeSettings() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);

  return (
    <SectionCard id="theme" title="Theme settings">
      <div className="flex flex-col gap-6">
        {/* Theme selector */}
        <div>
          <p className={FIELD_LABEL}>Theme</p>
          <ul className="mt-2 grid grid-cols-2 gap-3">
            {THEMES.map((option) => {
              const active = option.id === theme;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTheme(option.id)}
                    className={`w-full overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active ? "border-accent" : "border-hairline hover:border-accent/40"
                    }`}
                  >
                    <span
                      className="block h-12 w-full"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${option.colors[0]}, ${option.colors[1]})`,
                      }}
                    />
                    <span className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-medium text-white">{option.name}</span>
                      {active ? (
                        <span className="h-2 w-2 rounded-full bg-accent" />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Accent color */}
        <div>
          <p className={FIELD_LABEL}>Accent color</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {ACCENT_COLORS.map((color) => {
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

        {/* Typography */}
        <FieldSelect
          label="Typography"
          name="font"
          options={FONTS}
          defaultValue={DEFAULT_FONT}
        />

        {/* Border radius */}
        <div>
          <p className={FIELD_LABEL}>Border radius</p>
          <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-hairline p-1">
            {RADII.map((option) => {
              const active = option.id === radius;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRadius(option.id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    active ? "bg-surface text-white" : "text-muted hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
