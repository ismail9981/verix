import type { PlatformServiceErrorCode } from "../services/platform-errors";

export type PlatformActionErrorCode =
  "UNAUTHENTICATED" | "UNAUTHORIZED" | PlatformServiceErrorCode;

export type PlatformActionResult<T> =
  | { readonly status: "success"; readonly data: T }
  | {
      readonly status: "error";
      readonly code: PlatformActionErrorCode;
      readonly message: string;
    };
