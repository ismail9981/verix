import "server-only";

import { hasPlatformCapability } from "./platform-authorize";
import type { PlatformCapability } from "./platform-capabilities";

export interface PlatformNavigationItem {
  readonly label: string;
  readonly href: string;
}

interface PlatformNavigationDefinition extends PlatformNavigationItem {
  readonly capability: PlatformCapability;
}

const PLATFORM_NAVIGATION = Object.freeze([
  {
    label: "Overview",
    href: "/admin",
    capability: "platform.workspaces.read",
  },
  {
    label: "Workspaces",
    href: "/admin/workspaces",
    capability: "platform.workspaces.read",
  },
] as const satisfies readonly PlatformNavigationDefinition[]);

/**
 * Produces a client-safe navigation DTO from a context minted by the trusted
 * C1 authorization boundary. Role strings never control item visibility.
 */
export function platformNavigationFor(
  context: unknown,
): readonly PlatformNavigationItem[] {
  return PLATFORM_NAVIGATION.filter((item) =>
    hasPlatformCapability(context, item.capability),
  ).map(({ label, href }) => Object.freeze({ label, href }));
}
