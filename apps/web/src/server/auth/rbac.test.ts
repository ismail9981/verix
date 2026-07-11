import { describe, it, expect } from "vitest";
import {
  AuthorizationError,
  assertNotLastOwner,
  assertNotSelf,
  assertOwnerRole,
} from "./rbac";

describe("assertOwnerRole", () => {
  it("passes for an owner", () => {
    expect(() => assertOwnerRole("owner")).not.toThrow();
  });
  it("throws for non-owners", () => {
    expect(() => assertOwnerRole("manager")).toThrow(AuthorizationError);
    expect(() => assertOwnerRole("employee")).toThrow(AuthorizationError);
  });
});

describe("assertNotSelf (prevents self-promotion)", () => {
  it("throws when an actor targets their own membership", () => {
    expect(() => assertNotSelf("u1", "u1")).toThrow(AuthorizationError);
  });
  it("passes for a different target", () => {
    expect(() => assertNotSelf("u1", "u2")).not.toThrow();
  });
});

describe("assertNotLastOwner", () => {
  it("blocks demoting/removing the last active owner", () => {
    expect(() =>
      assertNotLastOwner({
        targetIsActiveOwner: true,
        remainsActiveOwner: false,
        activeOwnerCount: 1,
      }),
    ).toThrow(AuthorizationError);
  });
  it("allows the change when other owners remain", () => {
    expect(() =>
      assertNotLastOwner({
        targetIsActiveOwner: true,
        remainsActiveOwner: false,
        activeOwnerCount: 2,
      }),
    ).not.toThrow();
  });
  it("allows changes that keep the target an active owner", () => {
    expect(() =>
      assertNotLastOwner({
        targetIsActiveOwner: true,
        remainsActiveOwner: true,
        activeOwnerCount: 1,
      }),
    ).not.toThrow();
  });
  it("ignores non-owner targets", () => {
    expect(() =>
      assertNotLastOwner({
        targetIsActiveOwner: false,
        remainsActiveOwner: false,
        activeOwnerCount: 1,
      }),
    ).not.toThrow();
  });
});
