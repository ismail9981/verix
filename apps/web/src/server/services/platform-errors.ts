import "server-only";

export type PlatformServiceErrorCode =
  "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "INTERNAL";

/** Domain-safe service error. Database and identity details never cross it. */
export class PlatformServiceError extends Error {
  constructor(readonly code: PlatformServiceErrorCode) {
    super("Platform service operation failed.");
    this.name = "PlatformServiceError";
  }
}
