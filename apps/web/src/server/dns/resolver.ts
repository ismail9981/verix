import "server-only";
import { promises as nodeDns } from "node:dns";
import {
  classifyDnsErrorCode,
  matchTxtRecords,
  type DnsResolver,
  type VerificationAttemptOutcome,
} from "./verification";

/*
 * Server-only DNS I/O. Everything that can be reasoned about without a socket
 * (normalization, matching, error classification) lives in the pure
 * `./verification` module; this file is only the timeout-protected transport
 * plus the thin orchestration that ties a live (or injected, for tests)
 * resolver to that pure logic.
 */

const LOOKUP_TIMEOUT_MS = 5000;

class DnsTimeoutError extends Error {
  constructor() {
    super("DNS lookup timed out");
    this.name = "DnsTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DnsTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** The real DNS resolver, backed by Node's `dns.promises` API. */
export const nodeDnsResolver: DnsResolver = {
  resolveTxtRecords: (hostname) =>
    withTimeout(nodeDns.resolveTxt(hostname), LOOKUP_TIMEOUT_MS),
  resolveCnameRecord: (hostname) =>
    withTimeout(nodeDns.resolveCname(hostname), LOOKUP_TIMEOUT_MS),
};

/**
 * Resolves TXT records at `recordName` and classifies the result against
 * `expectedValue`. This is the single entry point the verification service
 * calls — it never sees raw resolver errors, only a closed classification.
 */
export async function resolveTxtOutcome(
  resolver: DnsResolver,
  recordName: string,
  expectedValue: string,
): Promise<VerificationAttemptOutcome> {
  try {
    const records = await resolver.resolveTxtRecords(recordName);
    return matchTxtRecords(records, expectedValue);
  } catch (error) {
    if (error instanceof DnsTimeoutError) return "dns_error";
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return classifyDnsErrorCode(code) === "not_found" ? "not_found" : "dns_error";
  }
}
