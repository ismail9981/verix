import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./src/server/auth/middleware";
import { rateLimit } from "./src/server/observability/rate-limit";

/*
 * Root proxy (Next 16's renamed middleware). Per request it:
 *  1. assigns a request id (correlates logs across RSC/actions),
 *  2. rate-limits auth mutations (brute-force mitigation),
 *  3. refreshes the Supabase session + enforces route protection,
 *  4. echoes the request id on the response for client-side correlation.
 * The matcher skips static assets so it only runs where a session matters.
 */

// Auth pages whose POSTs (login/register/reset Server Actions) are rate-limited.
const AUTH_POST_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
const AUTH_RATE_LIMIT = 10; // requests
const AUTH_RATE_WINDOW_MS = 60_000; // per minute per IP

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const isAuthMutation =
    request.method === "POST" &&
    (AUTH_POST_PATHS.includes(pathname) || pathname.startsWith("/auth"));

  if (isAuthMutation) {
    const { limited, resetAt } = rateLimit(
      `auth:${clientIp(request)}`,
      AUTH_RATE_LIMIT,
      AUTH_RATE_WINDOW_MS,
    );
    if (limited) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again shortly." }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": String(retryAfter),
            "x-request-id": requestId,
          },
        },
      );
    }
  }

  const response = await updateSession(request, requestId);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
