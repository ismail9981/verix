import { headers } from "next/headers";
import { logger, type LogFields } from "./logger";

/*
 * Request-scoped observability helpers (Node runtime: RSC, Server Actions,
 * Route Handlers). The request id is injected by the proxy as `x-request-id`
 * and read back here so every log line can be correlated to a single request.
 */

export async function getRequestId(): Promise<string> {
  try {
    const store = await headers();
    return store.get("x-request-id") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Log a caught error from a Server Action with its request id attached. */
export async function logActionError(
  action: string,
  error: unknown,
  fields?: LogFields,
): Promise<void> {
  logger.error(`action.${action} failed`, {
    requestId: await getRequestId(),
    err: error,
    ...fields,
  });
}
