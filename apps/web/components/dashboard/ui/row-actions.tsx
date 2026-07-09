"use client";

import type { IconProps } from "../types";
import { Popover } from "../popover";
import { GlyphBase } from "./icon-base";

function MoreIcon({ className }: IconProps) {
  return (
    <GlyphBase className={className}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </GlyphBase>
  );
}

export interface RowAction {
  label: string;
  onSelect: () => void;
  /** Renders in the danger color and below a divider. */
  danger?: boolean;
}

/* Shared per-row "⋯" actions menu built on the Popover. Bookings and CRM both
   used a near-identical copy of this; now they just pass their action list. */
export function RowActionsMenu({
  label,
  actions,
}: {
  label: string;
  actions: RowAction[];
}) {
  const firstDangerIndex = actions.findIndex((action) => action.danger);

  return (
    <Popover
      label={label}
      align="end"
      panelClassName="w-44"
      triggerClassName="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      trigger={<MoreIcon className="h-5 w-5" />}
    >
      {(close) => (
        <ul className="p-1.5">
          {actions.map((action, index) => (
            <li key={action.label}>
              {action.danger && index === firstDangerIndex ? (
                <span className="my-1 block h-px bg-hairline" />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  action.onSelect();
                  close();
                }}
                className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  action.danger
                    ? "text-red-400 hover:bg-canvas"
                    : "text-muted hover:bg-canvas hover:text-white"
                }`}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
