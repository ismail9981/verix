import { describe, it, expect } from "vitest";
import { isSafeToResolve } from "./hostname-safety";

describe("isSafeToResolve", () => {
  it("accepts a well-formed public hostname", () => {
    expect(isSafeToResolve("example.com").safe).toBe(true);
    expect(isSafeToResolve("shop.example.co.uk").safe).toBe(true);
  });

  it("rejects localhost and its subdomains", () => {
    expect(isSafeToResolve("localhost").safe).toBe(false);
    expect(isSafeToResolve("foo.localhost").safe).toBe(false);
  });

  it("rejects IPv4 literals", () => {
    expect(isSafeToResolve("127.0.0.1").safe).toBe(false);
    expect(isSafeToResolve("169.254.169.254").safe).toBe(false);
  });

  it("rejects IPv6 literals", () => {
    expect(isSafeToResolve("::1").safe).toBe(false);
    expect(isSafeToResolve("fe80::1").safe).toBe(false);
  });

  it("rejects reserved/internal TLDs", () => {
    for (const host of [
      "app.local",
      "db.internal",
      "site.lan",
      "example.test",
      "foo.invalid",
      "bar.example",
      "site.arpa",
    ]) {
      expect(isSafeToResolve(host).safe).toBe(false);
    }
  });

  it("rejects malformed hostnames", () => {
    expect(isSafeToResolve("").safe).toBe(false);
    expect(isSafeToResolve("not a domain").safe).toBe(false);
    expect(isSafeToResolve("no-tld").safe).toBe(false);
    expect(isSafeToResolve("bad_underscore.com").safe).toBe(false);
  });

  it("rejects an overlong hostname", () => {
    const label = "a".repeat(63);
    const long = Array(5).fill(label).join(".") + ".com";
    expect(isSafeToResolve(long).safe).toBe(false);
  });
});
