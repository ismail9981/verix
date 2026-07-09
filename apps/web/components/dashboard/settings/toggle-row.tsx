"use client";

import { useState } from "react";
import { Toggle } from "../business-profile/toggle";

interface ToggleRowProps {
  label: string;
  description: string;
  defaultChecked?: boolean;
}

/* A labelled setting with a switch. Manages its own state (mock only) and is
   reused across Notifications, Security, and Appearance. */
export function ToggleRow({
  label,
  description,
  defaultChecked = false,
}: ToggleRowProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <Toggle checked={checked} onChange={setChecked} label={label} />
    </div>
  );
}
