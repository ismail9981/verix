import "server-only";

import { notFound } from "next/navigation";
import {
  PlatformAuthorizationError,
  requirePlatformCapability,
} from "./platform-authorize";
import type { PlatformCapability } from "./platform-capabilities";

/**
 * Canonical RSC route gate. Platform denials become a controlled 404 so the
 * route hierarchy is not disclosed to unauthenticated or tenant-only actors.
 */
export async function requirePlatformPageCapability(
  capability: PlatformCapability,
) {
  try {
    return await requirePlatformCapability(capability);
  } catch (error) {
    if (error instanceof PlatformAuthorizationError) notFound();
    throw error;
  }
}
