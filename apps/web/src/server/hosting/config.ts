import { env } from "../env";
import { APP_DOMAIN } from "../validators/domain";
import type { HostRoutingConfig } from "./host";

/*
 * Bridges `env` to the pure `HostRoutingConfig` consumed by `host.ts`. The
 * only file in `hosting/` that imports env — keeps `host.ts` and
 * `site-resolver.ts` free of env/db so they stay trivially unit-testable.
 *
 * `publicRootDomain` reuses the existing `APP_DOMAIN` constant (the same one
 * `domain.service.ts` uses to compose `<label>.verix.app` subdomains at
 * creation time) rather than a second, independently-configured env var —
 * two sources of truth for the same domain could drift and silently break
 * routing for every subdomain.
 */

export interface ResolvedHostRoutingConfig extends HostRoutingConfig {
  enabled: boolean;
  trustForwardedHost: boolean;
}

function parseAppHosts(): ReadonlySet<string> {
  const defaults = ["localhost", APP_DOMAIN, `app.${APP_DOMAIN}`];
  const extra = (env.APP_HOST ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...defaults, ...extra]);
}

let cached: ResolvedHostRoutingConfig | undefined;

/** Memoized: env doesn't change at runtime, so this is computed once per process. */
export function getHostRoutingConfig(): ResolvedHostRoutingConfig {
  if (cached) return cached;
  cached = {
    enabled: env.ENABLE_HOST_ROUTING,
    trustForwardedHost: env.TRUST_X_FORWARDED_HOST,
    appHosts: parseAppHosts(),
    publicRootDomain: APP_DOMAIN,
    isProduction: env.NODE_ENV === "production",
  };
  return cached;
}
