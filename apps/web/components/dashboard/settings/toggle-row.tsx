"use client";

import { Toggle } from "../business-profile/toggle";

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/* A labelled setting with a switch. Controlled by the parent manager; reused
   across Notifications, Security, and Business Preferences. */
export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
