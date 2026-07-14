import { describe, it, expect } from "vitest";
import {
  classifyDnsErrorCode,
  decideVerificationOutcome,
  matchTxtRecords,
  normalizeHostname,
  normalizeTxtRecord,
} from "./verification";

describe("normalizeHostname", () => {
  it("lowercases and trims", () => {
    expect(normalizeHostname("  Example.COM  ")).toBe("example.com");
  });
  it("strips a single trailing root-label dot", () => {
    expect(normalizeHostname("example.com.")).toBe("example.com");
  });
  it("leaves a hostname with no trailing dot unchanged", () => {
    expect(normalizeHostname("example.com")).toBe("example.com");
  });
});

describe("normalizeTxtRecord", () => {
  it("joins multi-chunk TXT values", () => {
    expect(normalizeTxtRecord(["verix-domain-verification=", "abc123"])).toBe(
      "verix-domain-verification=abc123",
    );
  });
  it("trims incidental whitespace", () => {
    expect(normalizeTxtRecord([" value "])).toBe("value");
  });
});

describe("matchTxtRecords", () => {
  const expected = "verix-domain-verification=abc123";

  it("matches when a record's joined value equals the expected value", () => {
    expect(matchTxtRecords([["verix-domain-verification=abc123"]], expected)).toBe(
      "match",
    );
  });
  it("matches across chunked records", () => {
    expect(
      matchTxtRecords([["verix-domain-verification=", "abc123"]], expected),
    ).toBe("match");
  });
  it("reports not_found when there are no records at all", () => {
    expect(matchTxtRecords([], expected)).toBe("not_found");
  });
  it("reports mismatch when records exist but none match", () => {
    expect(
      matchTxtRecords(
        [["verix-domain-verification=wrong"], ["unrelated=value"]],
        expected,
      ),
    ).toBe("mismatch");
  });
  it("matches even if other unrelated TXT records are present", () => {
    expect(
      matchTxtRecords(
        [["unrelated=value"], ["verix-domain-verification=abc123"]],
        expected,
      ),
    ).toBe("match");
  });
});

describe("classifyDnsErrorCode", () => {
  it("treats ENOTFOUND and ENODATA as not_found", () => {
    expect(classifyDnsErrorCode("ENOTFOUND")).toBe("not_found");
    expect(classifyDnsErrorCode("ENODATA")).toBe("not_found");
  });
  it("treats everything else (including undefined) as transient", () => {
    expect(classifyDnsErrorCode("ETIMEOUT")).toBe("transient");
    expect(classifyDnsErrorCode("ECONNREFUSED")).toBe("transient");
    expect(classifyDnsErrorCode("SERVFAIL")).toBe("transient");
    expect(classifyDnsErrorCode(undefined)).toBe("transient");
  });
});

describe("decideVerificationOutcome", () => {
  it("marks verified on match, regardless of prior status", () => {
    const decision = decideVerificationOutcome("match", "pending");
    expect(decision).toEqual({
      status: "verified",
      verified: true,
      verificationError: null,
    });
  });

  it("marks failed with a safe message on not_found", () => {
    const decision = decideVerificationOutcome("not_found", "pending");
    expect(decision.status).toBe("failed");
    expect(decision.verified).toBe(false);
    expect(decision.verificationError).toMatch(/couldn't find/i);
  });

  it("marks failed with a safe message on mismatch", () => {
    const decision = decideVerificationOutcome("mismatch", "pending");
    expect(decision.status).toBe("failed");
    expect(decision.verified).toBe(false);
    expect(decision.verificationError).toMatch(/didn't match/i);
  });

  it("leaves status unchanged on a transient dns_error (never a false negative)", () => {
    const decision = decideVerificationOutcome("dns_error", "pending");
    expect(decision.status).toBe("pending");
    expect(decision.verified).toBe(false);
    expect(decision.verificationError).toMatch(/temporary|try again/i);
  });

  it("dns_error preserves whatever the current status already was", () => {
    expect(decideVerificationOutcome("dns_error", "failed").status).toBe("failed");
  });

  it("never leaks raw DNS/network error internals in any message", () => {
    for (const outcome of ["not_found", "mismatch", "dns_error"] as const) {
      const decision = decideVerificationOutcome(outcome, "pending");
      expect(decision.verificationError).not.toMatch(
        /ENOTFOUND|ENODATA|ETIMEOUT|ECONNREFUSED|SERVFAIL|errno|stack/i,
      );
    }
  });
});
