import type { SettingsValues } from "../../../src/server/validators/settings";

export type {
  SettingsValues,
  SettingsSection,
} from "../../../src/server/validators/settings";

/* Props shared by every settings section: the current draft values, a typed
   setter, and a reset handler. */
export interface SectionProps {
  values: SettingsValues;
  set: <K extends keyof SettingsValues>(
    key: K,
    value: SettingsValues[K],
  ) => void;
  onReset: () => void;
}
