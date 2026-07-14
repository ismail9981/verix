import { describe, it, expect } from "vitest";
import {
  APP_DOMAIN,
  composeHostname,
  createDomainSchema,
  isReserved,
  isValidHostname,
  isValidLabel,
  slugifyLabel,
} from "./domain";

describe("hostname/label validation", () => {
  it("accepts valid labels and rejects malformed ones", () => {
    expect(isValidLabel("my-site")).toBe(true);
    expect(isValidLabel("site1")).toBe(true);
    expect(isValidLabel("-bad")).toBe(false);
    expect(isValidLabel("bad-")).toBe(false);
    expect(isValidLabel("UPPER")).toBe(false);
    expect(isValidLabel("has space")).toBe(false);
  });

  it("accepts valid full hostnames and rejects malformed ones", () => {
    expect(isValidHostname("example.com")).toBe(true);
    expect(isValidHostname("shop.example.co.uk")).toBe(true);
    expect(isValidHostname("nodot")).toBe(false);
    expect(isValidHostname("bad_underscore.com")).toBe(false);
    expect(isValidHostname("trailing.")).toBe(false);
  });

  it("flags reserved names", () => {
    for (const r of ["admin", "api", "app", "www", "mail", "support", "status", "cdn"]) {
      expect(isReserved(r)).toBe(true);
    }
    expect(isReserved("bloom")).toBe(false);
  });
});

describe("composeHostname", () => {
  it("appends the app domain for subdomains", () => {
    expect(composeHostname("subdomain", "bloom")).toBe(`bloom.${APP_DOMAIN}`);
  });
  it("passes custom hostnames through", () => {
    expect(composeHostname("custom", "example.com")).toBe("example.com");
  });
});

describe("slugifyLabel", () => {
  it("slugifies a site name", () => {
    expect(slugifyLabel("Bloom Studio")).toBe("bloom-studio");
    expect(slugifyLabel("Café & Co!")).toBe("caf-co");
  });
  it("avoids reserved and empty results", () => {
    expect(slugifyLabel("API")).toBe("api-site");
    expect(slugifyLabel("!!!")).toBe("site");
  });
});

describe("createDomainSchema", () => {
  const site = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a valid subdomain (lowercasing input)", () => {
    const r = createDomainSchema.safeParse({ siteId: site, type: "subdomain", value: "My-Site" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.value).toBe("my-site");
  });

  it("rejects a reserved subdomain", () => {
    expect(createDomainSchema.safeParse({ siteId: site, type: "subdomain", value: "admin" }).success).toBe(false);
  });

  it("rejects an invalid subdomain label", () => {
    expect(createDomainSchema.safeParse({ siteId: site, type: "subdomain", value: "-bad-" }).success).toBe(false);
  });

  it("accepts a valid custom domain", () => {
    expect(createDomainSchema.safeParse({ siteId: site, type: "custom", value: "example.com" }).success).toBe(true);
  });

  it("rejects a custom domain under the app domain (must be a subdomain)", () => {
    expect(createDomainSchema.safeParse({ siteId: site, type: "custom", value: `x.${APP_DOMAIN}` }).success).toBe(false);
  });

  it("rejects a malformed custom domain", () => {
    expect(createDomainSchema.safeParse({ siteId: site, type: "custom", value: "not a domain" }).success).toBe(false);
  });
});
