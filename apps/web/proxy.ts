import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./src/server/auth/middleware";
import { rateLimit } from "./src/server/observability/rate-limit";
import { getHostRoutingConfig } from "./src/server/hosting/config";
import {
  buildSiteRewritePath,
  classifyHost,
  resolveIncomingHost,
  shouldSkipHostRewrite,
} from "./src/server/hosting/host";
import { resolveSiteByHostname } from "./src/server/hosting/site-resolver.service";
import { logger } from "./src/server/observability/logger";
import { DISALLOW_ALL_ROBOTS_TXT, EMPTY_SITEMAP_XML } from "./src/website/render/seo-output";

/*
 * Root proxy (Next 16's renamed middleware — always runs on the Node.js
 * runtime, which is what lets host routing below do a real db read). Per
 * request it:
 *  1. assigns a request id (correlates logs across RSC/actions),
 *  2. classifies the Host header: a known public-site hostname is resolved to
 *     a site and internally rewritten to the existing `/site/{siteId}`
 *     renderer (Sprint 7.3); anything else (the app/dashboard host, or a host
 *     that fails to classify) falls through to the app flow below unchanged,
 *  3. rate-limits auth mutations (brute-force mitigation),
 *  4. refreshes the Supabase session + enforces route protection,
 *  5. echoes the request id on the response for client-side correlation.
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

/*
 * Forwards the request id as a *request* header (not just a response header)
 * so the internally-rewritten page's `getRequestId()` (reads `x-request-id`
 * from `headers()`) correlates with this proxy's log lines — the same
 * mechanism `updateSession` uses for the app flow.
 */
function withForwardedRequestId(request: NextRequest, requestId: string) {
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  return { request: { headers } };
}

/**
 * A safe, direct text/XML response for an unresolved host's `robots.txt`/
 * `sitemap.xml` — never the HTML `/domain-not-found` page. A crawler request
 * to either path must get a machine-readable, disallow-everything answer,
 * not an HTML 200 (which some crawlers would otherwise try to parse as the
 * file itself).
 */
function unresolvedHostSeoResponse(pathname: string, requestId: string): NextResponse | null {
  if (pathname === "/robots.txt") {
    const response = new NextResponse(DISALLOW_ALL_ROBOTS_TXT, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }
  if (pathname === "/sitemap.xml") {
    const response = new NextResponse(EMPTY_SITEMAP_XML, {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }
  return null;
}

/**
 * Public-host branch: resolve the hostname to a site and rewrite to the
 * existing renderer, or rewrite to the branded not-found route. The browser
 * keeps the customer hostname/path — this is a rewrite, never a redirect, so
 * the internal `/site/{siteId}` URL is never exposed to the visitor.
 */
async function handlePublicHost(
  request: NextRequest,
  requestId: string,
  hostname: string,
): Promise<NextResponse> {
  const route = await resolveSiteByHostname(hostname, requestId);
  const forward = withForwardedRequestId(request, requestId);
  const url = request.nextUrl.clone();

  if (!route) {
    logger.info("proxy.host.unresolved", { requestId, hostname });
    const seoResponse = unresolvedHostSeoResponse(url.pathname, requestId);
    if (seoResponse) return seoResponse;
    url.pathname = "/domain-not-found";
    url.search = "";
    const response = NextResponse.rewrite(url, forward);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  logger.info("proxy.host.rewrite", {
    requestId,
    hostname,
    siteId: route.siteId,
    domainId: route.domainId,
  });
  url.pathname = buildSiteRewritePath(route.siteId, url.pathname);
  const response = NextResponse.rewrite(url, forward);
  response.headers.set("x-request-id", requestId);
  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  if (!shouldSkipHostRewrite(pathname)) {
    const hostConfig = getHostRoutingConfig();
    if (hostConfig.enabled) {
      const rawHost = resolveIncomingHost(request.headers, hostConfig.trustForwardedHost);
      const classification = classifyHost(rawHost, hostConfig);

      if (classification.kind === "public") {
        return handlePublicHost(request, requestId, classification.hostname);
      }
      if (classification.kind === "invalid") {
        // Fails open to the normal app flow below — a malformed/unexpected
        // Host must never take down dashboard/auth traffic.
        logger.warn("proxy.host.invalid", {
          requestId,
          path: pathname,
          reason: classification.reason,
        });
      }
    }
  }

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
