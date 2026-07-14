import { describe, it, expect } from "vitest";
import {
  buildSiteRewritePath,
  classifyHost,
  normalizeHost,
  resolveIncomingHost,
  shouldSkipHostRewrite,
  type HostRoutingConfig,
} from "./host";

describe("normalizeHost", () => {
  it("lowercases the host", () => {
    expect(normalizeHost("Example.COM")?.hostname).toBe("example.com");
  });

  it("strips a valid port", () => {
    const result = normalizeHost("example.com:3000");
    expect(result?.hostname).toBe("example.com");
    expect(result?.port).toBe("3000");
  });

  it("strips a trailing dot", () => {
    expect(normalizeHost("example.com.")?.hostname).toBe("example.com");
  });

  it("normalizes a unicode hostname to punycode ASCII", () => {
    expect(normalizeHost("xn--nxasmq6b.com")?.hostname).toBe("xn--nxasmq6b.com");
    // Raw unicode input is also punycode-normalized by the URL parser.
    const result = normalizeHost("café.com");
    expect(result?.hostname).toMatch(/^xn--/);
  });

  it("rejects empty or missing hosts", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost(undefined)).toBeNull();
    expect(normalizeHost("   ")).toBeNull();
  });

  it("rejects an overlong host", () => {
    expect(normalizeHost("a".repeat(300) + ".com")).toBeNull();
  });

  it("rejects control characters (header injection)", () => {
    expect(normalizeHost("evil.com\r\nSet-Cookie: x=1")).toBeNull();
    expect(normalizeHost("evil.com\n")).toBeNull();
    expect(normalizeHost("evil.com\0")).toBeNull();
  });

  it("rejects smuggled path/userinfo/scheme content", () => {
    expect(normalizeHost("evil.com/path")).toBeNull();
    expect(normalizeHost("user:pass@evil.com")).toBeNull();
    expect(normalizeHost("evil.com\\@internal")).toBeNull();
  });

  it("rejects malformed hosts", () => {
    expect(normalizeHost("not a domain")).toBeNull();
    expect(normalizeHost("::::")).toBeNull();
  });

  it("accepts a well-formed IPv4 literal and IPv6 literal (safety is a separate concern)", () => {
    expect(normalizeHost("127.0.0.1")?.hostname).toBe("127.0.0.1");
    expect(normalizeHost("[::1]")?.hostname).toBe("[::1]");
  });
});

function baseConfig(overrides: Partial<HostRoutingConfig> = {}): HostRoutingConfig {
  return {
    appHosts: new Set(["localhost", "verix.app", "app.verix.app"]),
    publicRootDomain: "verix.app",
    isProduction: false,
    ...overrides,
  };
}

describe("classifyHost", () => {
  it("classifies a malformed host as invalid", () => {
    expect(classifyHost("evil.com\r\n", baseConfig()).kind).toBe("invalid");
    expect(classifyHost("", baseConfig()).kind).toBe("invalid");
  });

  it("classifies configured app hosts as app", () => {
    expect(classifyHost("verix.app", baseConfig()).kind).toBe("app");
    expect(classifyHost("app.verix.app", baseConfig()).kind).toBe("app");
    expect(classifyHost("APP.VERIX.APP", baseConfig()).kind).toBe("app");
  });

  it("classifies a verix.app subdomain as public", () => {
    const result = classifyHost("business.verix.app", baseConfig());
    expect(result).toEqual({ kind: "public", hostname: "business.verix.app" });
  });

  it("classifies an arbitrary well-formed hostname as public (custom domain candidate)", () => {
    const result = classifyHost("custom-business.com", baseConfig());
    expect(result).toEqual({ kind: "public", hostname: "custom-business.com" });
  });

  it("treats localhost as app in development", () => {
    expect(classifyHost("localhost", baseConfig({ isProduction: false })).kind).toBe(
      "app",
    );
    expect(
      classifyHost("localhost:3000", baseConfig({ isProduction: false })).kind,
    ).toBe("app");
  });

  it("rejects localhost in production", () => {
    expect(classifyHost("localhost", baseConfig({ isProduction: true })).kind).toBe(
      "invalid",
    );
    expect(
      classifyHost("foo.localhost", baseConfig({ isProduction: true })).kind,
    ).toBe("invalid");
  });

  it("treats IP literals as app in development, invalid in production", () => {
    expect(classifyHost("127.0.0.1", baseConfig({ isProduction: false })).kind).toBe(
      "app",
    );
    expect(classifyHost("127.0.0.1", baseConfig({ isProduction: true })).kind).toBe(
      "invalid",
    );
  });

  it("is case-insensitive for app-host matching", () => {
    expect(classifyHost("Verix.App", baseConfig()).kind).toBe("app");
  });
});

describe("resolveIncomingHost", () => {
  function headersOf(map: Record<string, string>) {
    return { get: (name: string) => map[name.toLowerCase()] ?? null };
  }

  it("uses Host by default and ignores x-forwarded-host", () => {
    const headers = headersOf({
      host: "real.verix.app",
      "x-forwarded-host": "spoofed.com",
    });
    expect(resolveIncomingHost(headers, false)).toBe("real.verix.app");
  });

  it("uses x-forwarded-host only when explicitly trusted", () => {
    const headers = headersOf({
      host: "internal-lb",
      "x-forwarded-host": "real.verix.app, extra.com",
    });
    expect(resolveIncomingHost(headers, true)).toBe("real.verix.app");
  });

  it("falls back to Host when trusted but x-forwarded-host is absent", () => {
    const headers = headersOf({ host: "real.verix.app" });
    expect(resolveIncomingHost(headers, true)).toBe("real.verix.app");
  });
});

describe("shouldSkipHostRewrite", () => {
  it("skips Next internals, api, auth, favicon", () => {
    expect(shouldSkipHostRewrite("/_next/static/chunk.js")).toBe(true);
    expect(shouldSkipHostRewrite("/api/webhook")).toBe(true);
    expect(shouldSkipHostRewrite("/auth/confirm")).toBe(true);
    expect(shouldSkipHostRewrite("/favicon.ico")).toBe(true);
  });

  it("skips the internal renderer and not-found targets (rewrite-loop prevention)", () => {
    expect(shouldSkipHostRewrite("/site/abc123")).toBe(true);
    expect(shouldSkipHostRewrite("/site/abc123/about")).toBe(true);
    expect(shouldSkipHostRewrite("/domain-not-found")).toBe(true);
  });

  it("does not skip ordinary app or public paths", () => {
    expect(shouldSkipHostRewrite("/")).toBe(false);
    expect(shouldSkipHostRewrite("/about")).toBe(false);
    expect(shouldSkipHostRewrite("/login")).toBe(false);
    expect(shouldSkipHostRewrite("/sitemap-but-not-site")).toBe(false);
  });
});

describe("buildSiteRewritePath", () => {
  it("maps the root path to the bare siteId route", () => {
    expect(buildSiteRewritePath("site-1", "/")).toBe("/site/site-1");
  });

  it("preserves a single-segment path", () => {
    expect(buildSiteRewritePath("site-1", "/about")).toBe("/site/site-1/about");
  });

  it("preserves a nested path", () => {
    expect(buildSiteRewritePath("site-1", "/services/haircuts")).toBe(
      "/site/site-1/services/haircuts",
    );
  });

  it("always targets a path skipped by shouldSkipHostRewrite (loop prevention)", () => {
    for (const input of ["/", "/about", "/a/b/c"]) {
      expect(shouldSkipHostRewrite(buildSiteRewritePath("site-1", input))).toBe(true);
    }
  });
});
