import { describe, it, expect } from "vitest";
import {
  AuthorizationError,
  assertCanAccessHousekeepingTask,
  assertCanAccessOpportunity,
  assertCanAccessReservation,
  assertCanMutateStage,
  assertHousekeepingTransitionAllowed,
  assertManagerOrOwnerRole,
  assertNotLastOwner,
  assertNotSelf,
  assertOwnerRole,
  assertStatusTransitionAllowed,
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

describe("assertManagerOrOwnerRole", () => {
  it("passes for owners and managers", () => {
    expect(() => assertManagerOrOwnerRole("owner")).not.toThrow();
    expect(() => assertManagerOrOwnerRole("manager")).not.toThrow();
  });
  it("throws for employees", () => {
    expect(() => assertManagerOrOwnerRole("employee")).toThrow(AuthorizationError);
  });
});

describe("assertCanAccessOpportunity", () => {
  it("lets owners and managers act on any opportunity", () => {
    expect(() =>
      assertCanAccessOpportunity({
        role: "owner",
        actorUserId: "u1",
        assignedToUserId: "u2",
      }),
    ).not.toThrow();
    expect(() =>
      assertCanAccessOpportunity({
        role: "manager",
        actorUserId: "u1",
        assignedToUserId: null,
      }),
    ).not.toThrow();
  });
  it("lets an employee act on their own assigned opportunity", () => {
    expect(() =>
      assertCanAccessOpportunity({
        role: "employee",
        actorUserId: "u1",
        assignedToUserId: "u1",
      }),
    ).not.toThrow();
  });
  it("blocks an employee from an unassigned or someone-else's opportunity", () => {
    expect(() =>
      assertCanAccessOpportunity({
        role: "employee",
        actorUserId: "u1",
        assignedToUserId: null,
      }),
    ).toThrow(AuthorizationError);
    expect(() =>
      assertCanAccessOpportunity({
        role: "employee",
        actorUserId: "u1",
        assignedToUserId: "u2",
      }),
    ).toThrow(AuthorizationError);
  });
});

describe("assertCanMutateStage", () => {
  it("requires owner for a protected stage", () => {
    expect(() => assertCanMutateStage("manager", true)).toThrow(AuthorizationError);
    expect(() => assertCanMutateStage("employee", true)).toThrow(AuthorizationError);
    expect(() => assertCanMutateStage("owner", true)).not.toThrow();
  });
  it("allows manager or owner for a non-protected stage", () => {
    expect(() => assertCanMutateStage("manager", false)).not.toThrow();
    expect(() => assertCanMutateStage("owner", false)).not.toThrow();
    expect(() => assertCanMutateStage("employee", false)).toThrow(AuthorizationError);
  });
});

describe("assertCanAccessReservation", () => {
  it("lets owners and managers act on any reservation", () => {
    expect(() =>
      assertCanAccessReservation({
        role: "owner",
        actorTeamMemberId: "tm1",
        assignedStaffId: "tm2",
      }),
    ).not.toThrow();
    expect(() =>
      assertCanAccessReservation({
        role: "manager",
        actorTeamMemberId: "tm1",
        assignedStaffId: null,
      }),
    ).not.toThrow();
  });
  it("lets an employee act on their own staffed reservation", () => {
    expect(() =>
      assertCanAccessReservation({
        role: "employee",
        actorTeamMemberId: "tm1",
        assignedStaffId: "tm1",
      }),
    ).not.toThrow();
  });
  it("blocks an employee from an unassigned or someone-else's reservation", () => {
    expect(() =>
      assertCanAccessReservation({
        role: "employee",
        actorTeamMemberId: "tm1",
        assignedStaffId: null,
      }),
    ).toThrow(AuthorizationError);
    expect(() =>
      assertCanAccessReservation({
        role: "employee",
        actorTeamMemberId: "tm1",
        assignedStaffId: "tm2",
      }),
    ).toThrow(AuthorizationError);
  });
});

describe("assertStatusTransitionAllowed", () => {
  it("rejects an invalid transition regardless of role", () => {
    expect(() => assertStatusTransitionAllowed("owner", false, false)).toThrow(AuthorizationError);
    expect(() => assertStatusTransitionAllowed("employee", false, true)).toThrow(AuthorizationError);
  });
  it("lets owners and managers apply any valid transition", () => {
    expect(() => assertStatusTransitionAllowed("owner", true, false)).not.toThrow();
    expect(() => assertStatusTransitionAllowed("manager", true, false)).not.toThrow();
  });
  it("restricts employees to the narrower operational subset", () => {
    expect(() => assertStatusTransitionAllowed("employee", true, true)).not.toThrow();
    expect(() => assertStatusTransitionAllowed("employee", true, false)).toThrow(AuthorizationError);
  });
});

describe("assertCanAccessHousekeepingTask", () => {
  it("lets owners and managers act on any task", () => {
    expect(() =>
      assertCanAccessHousekeepingTask({
        role: "owner",
        actorTeamMemberId: "tm1",
        assignedTeamMemberId: "tm2",
      }),
    ).not.toThrow();
    expect(() =>
      assertCanAccessHousekeepingTask({
        role: "manager",
        actorTeamMemberId: "tm1",
        assignedTeamMemberId: null,
      }),
    ).not.toThrow();
  });
  it("lets an employee act on their own assigned task", () => {
    expect(() =>
      assertCanAccessHousekeepingTask({
        role: "employee",
        actorTeamMemberId: "tm1",
        assignedTeamMemberId: "tm1",
      }),
    ).not.toThrow();
  });
  it("blocks an employee from an unassigned or someone-else's task", () => {
    expect(() =>
      assertCanAccessHousekeepingTask({
        role: "employee",
        actorTeamMemberId: "tm1",
        assignedTeamMemberId: null,
      }),
    ).toThrow(AuthorizationError);
    expect(() =>
      assertCanAccessHousekeepingTask({
        role: "employee",
        actorTeamMemberId: "tm1",
        assignedTeamMemberId: "tm2",
      }),
    ).toThrow(AuthorizationError);
  });
});

describe("assertHousekeepingTransitionAllowed", () => {
  it("rejects an invalid transition regardless of role", () => {
    expect(() => assertHousekeepingTransitionAllowed("owner", false, false)).toThrow(AuthorizationError);
    expect(() => assertHousekeepingTransitionAllowed("employee", false, true)).toThrow(AuthorizationError);
  });
  it("lets owners and managers apply any valid transition", () => {
    expect(() => assertHousekeepingTransitionAllowed("owner", true, false)).not.toThrow();
    expect(() => assertHousekeepingTransitionAllowed("manager", true, false)).not.toThrow();
  });
  it("restricts employees to the narrower start/complete-own-task subset", () => {
    expect(() => assertHousekeepingTransitionAllowed("employee", true, true)).not.toThrow();
    expect(() => assertHousekeepingTransitionAllowed("employee", true, false)).toThrow(AuthorizationError);
  });
});
