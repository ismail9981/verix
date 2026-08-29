import { notFound } from "next/navigation";
import { requireActiveWorkspaceCapability } from "./authorize";
import { AuthorizationError, type Capability } from "./capabilities";

/** Deny direct page navigation without revealing whether scoped resources exist. */
export async function requirePageCapability(capability: Capability) {
  try {
    return await requireActiveWorkspaceCapability(capability);
  } catch (error) {
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }
}
