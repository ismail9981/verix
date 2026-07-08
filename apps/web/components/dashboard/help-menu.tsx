"use client";

import { HelpIcon } from "./icons";
import { Popover } from "./popover";

const HELP_LINKS = [
  { label: "Documentation", href: "#" },
  { label: "Keyboard shortcuts", href: "#" },
  { label: "Contact support", href: "#" },
  { label: "What's new", href: "#" },
];

export function HelpMenu() {
  return (
    <Popover
      label="Help and resources"
      panelClassName="w-56"
      triggerClassName="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      trigger={<HelpIcon className="h-5 w-5" />}
    >
      {(close) => (
        <ul className="p-1.5">
          {HELP_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                onClick={close}
                className="block rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
