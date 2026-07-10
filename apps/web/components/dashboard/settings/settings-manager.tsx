"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";
import { Reveal, RevealItem } from "../../landing/reveal";
import {
  ProfileToast,
  type ToastState,
} from "../business-profile/profile-toast";
import { SettingsHeader } from "./settings-header";
import { GeneralSettings } from "./general-settings";
import { AppearanceSettings } from "./appearance-settings";
import { NotificationSettings } from "./notification-settings";
import { SecuritySettings } from "./security-settings";
import { LocalizationSettings } from "./localization-settings";
import { BusinessPreferencesSettings } from "./business-preferences-settings";
import {
  resetSectionAction,
  saveSettingsAction,
} from "../../../src/server/actions/settings";
import {
  SECTION_FIELDS,
  SETTINGS_DEFAULTS,
  type SettingsSection,
  type SettingsValues,
} from "../../../src/server/validators/settings";
import type { SectionProps } from "./types";

const KEYS = Object.keys(SETTINGS_DEFAULTS).concat(
  "businessName",
) as (keyof SettingsValues)[];

export function SettingsManager({ initial }: { initial: SettingsValues }) {
  const [committed, setCommitted] = useState(initial);
  const [draft, setDraft] = useState(initial);
  // Optimistic snapshot of the last-committed values (same pattern as Business
  // Profile) — applied during save/reset transitions.
  const [, applyOptimistic] = useOptimistic(
    committed,
    (_current: SettingsValues, next: SettingsValues) => next,
  );
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const dirty = KEYS.some((key) => draft[key] !== committed[key]);

  const set = useCallback(
    <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  function handleSave() {
    if (!dirty || isPending) return;
    startTransition(async () => {
      applyOptimistic(draft);
      const result = await saveSettingsAction(draft);
      if (result.status === "success" && result.values) {
        setCommitted(result.values);
        setDraft(result.values);
        setToast({ tone: "success", message: result.message });
      } else {
        // Revert to the last committed state on failure.
        setDraft(committed);
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  function handleReset(section: SettingsSection) {
    startTransition(async () => {
      const next: SettingsValues = { ...draft };
      for (const field of SECTION_FIELDS[section]) {
        (next as Record<string, unknown>)[field] = (
          SETTINGS_DEFAULTS as Record<string, unknown>
        )[field];
      }
      setDraft(next);
      applyOptimistic(next);
      const result = await resetSectionAction(section);
      if (result.status === "success" && result.values) {
        setCommitted(result.values);
        setDraft(result.values);
        setToast({ tone: "success", message: result.message });
      } else {
        setDraft(committed);
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  const sectionProps = (section: SettingsSection): SectionProps => ({
    values: draft,
    set,
    onReset: () => handleReset(section),
  });

  return (
    <>
      <Reveal as="div" className="flex flex-col gap-10">
        <RevealItem>
          <SettingsHeader onSave={handleSave} saving={isPending} dirty={dirty} />
        </RevealItem>
        <GeneralSettings {...sectionProps("general")} />
        <AppearanceSettings {...sectionProps("appearance")} />
        <NotificationSettings {...sectionProps("notifications")} />
        <SecuritySettings {...sectionProps("security")} />
        <LocalizationSettings {...sectionProps("localization")} />
        <BusinessPreferencesSettings {...sectionProps("business")} />
      </Reveal>

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
