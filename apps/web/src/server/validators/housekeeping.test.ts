import { describe, it, expect } from "vitest";
import {
  HOUSEKEEPING_TASK_STATUSES,
  getValidHousekeepingTransitionsFrom,
  housekeepingTaskFiltersSchema,
  housekeepingTaskInputSchema,
  isEmployeeAllowedHousekeepingTransition,
  isValidHousekeepingStatusTransition,
  resolveHousekeepingScope,
  resolveUnitOverride,
  type HousekeepingTaskStatus,
} from "./housekeeping";

const ALL_TRANSITIONS: [HousekeepingTaskStatus, HousekeepingTaskStatus][] = HOUSEKEEPING_TASK_STATUSES.flatMap(
  (from) => HOUSEKEEPING_TASK_STATUSES.map((to): [HousekeepingTaskStatus, HousekeepingTaskStatus] => [from, to]),
);

describe("isValidHousekeepingStatusTransition", () => {
  it("allows the documented lifecycle transitions", () => {
    expect(isValidHousekeepingStatusTransition("pending", "assigned")).toBe(true);
    expect(isValidHousekeepingStatusTransition("pending", "cancelled")).toBe(true);
    expect(isValidHousekeepingStatusTransition("assigned", "in_progress")).toBe(true);
    expect(isValidHousekeepingStatusTransition("assigned", "cancelled")).toBe(true);
    expect(isValidHousekeepingStatusTransition("in_progress", "completed")).toBe(true);
    expect(isValidHousekeepingStatusTransition("in_progress", "cancelled")).toBe(true);
  });

  it("never allows starting directly from pending (must be assigned first)", () => {
    expect(isValidHousekeepingStatusTransition("pending", "in_progress")).toBe(false);
  });

  it("never allows completing a task that hasn't started (rule 7: only in-progress tasks may complete)", () => {
    expect(isValidHousekeepingStatusTransition("pending", "completed")).toBe(false);
    expect(isValidHousekeepingStatusTransition("assigned", "completed")).toBe(false);
  });

  it("treats completed and cancelled as terminal (rule 6: they can't be started or re-transitioned)", () => {
    for (const to of HOUSEKEEPING_TASK_STATUSES) {
      expect(isValidHousekeepingStatusTransition("completed", to)).toBe(false);
      expect(isValidHousekeepingStatusTransition("cancelled", to)).toBe(false);
    }
  });

  it("regression: no undocumented transition sneaks through — every pair is either an explicit edge or rejected", () => {
    const allowed = new Set([
      "pending->assigned",
      "pending->cancelled",
      "assigned->in_progress",
      "assigned->cancelled",
      "in_progress->completed",
      "in_progress->cancelled",
    ]);
    for (const [from, to] of ALL_TRANSITIONS) {
      expect(isValidHousekeepingStatusTransition(from, to)).toBe(allowed.has(`${from}->${to}`));
    }
  });
});

describe("getValidHousekeepingTransitionsFrom", () => {
  it("returns an empty array for terminal statuses", () => {
    expect(getValidHousekeepingTransitionsFrom("completed")).toEqual([]);
    expect(getValidHousekeepingTransitionsFrom("cancelled")).toEqual([]);
  });
});

describe("isEmployeeAllowedHousekeepingTransition", () => {
  it("allows only starting and completing an assigned/in-progress task", () => {
    expect(isEmployeeAllowedHousekeepingTransition("assigned", "in_progress")).toBe(true);
    expect(isEmployeeAllowedHousekeepingTransition("in_progress", "completed")).toBe(true);
  });

  it("never allows an employee to assign or cancel (owner/manager only)", () => {
    expect(isEmployeeAllowedHousekeepingTransition("pending", "assigned")).toBe(false);
    expect(isEmployeeAllowedHousekeepingTransition("pending", "cancelled")).toBe(false);
    expect(isEmployeeAllowedHousekeepingTransition("assigned", "cancelled")).toBe(false);
    expect(isEmployeeAllowedHousekeepingTransition("in_progress", "cancelled")).toBe(false);
  });
});

describe("resolveUnitOverride (single reconciliation source of truth)", () => {
  it("out_of_service is never automatically changed, regardless of active tasks (regression)", () => {
    expect(
      resolveUnitOverride({ current: "out_of_service", hasActiveMaintenanceTask: true, hasActiveCleaningTask: true }),
    ).toBe("out_of_service");
    expect(
      resolveUnitOverride({ current: "out_of_service", hasActiveMaintenanceTask: false, hasActiveCleaningTask: false }),
    ).toBe("out_of_service");
  });

  it("maintenance takes precedence over cleaning when both are active (regression)", () => {
    expect(
      resolveUnitOverride({ current: "cleaning", hasActiveMaintenanceTask: true, hasActiveCleaningTask: true }),
    ).toBe("maintenance");
    expect(
      resolveUnitOverride({ current: null, hasActiveMaintenanceTask: true, hasActiveCleaningTask: true }),
    ).toBe("maintenance");
  });

  it("resolves to cleaning when only a cleaning task is active", () => {
    expect(
      resolveUnitOverride({ current: "cleaning", hasActiveMaintenanceTask: false, hasActiveCleaningTask: true }),
    ).toBe("cleaning");
  });

  it("resolves to null when no operational task is active", () => {
    expect(
      resolveUnitOverride({ current: "cleaning", hasActiveMaintenanceTask: false, hasActiveCleaningTask: false }),
    ).toBe(null);
    expect(
      resolveUnitOverride({ current: "maintenance", hasActiveMaintenanceTask: false, hasActiveCleaningTask: false }),
    ).toBe(null);
  });

  it("regression: re-resolves from the unit's full active-task set, not just the triggering transition — a still-active cleaning task survives an unrelated maintenance task completing first", () => {
    // Scenario: cleaning task active (override=cleaning) -> maintenance task starts (override=maintenance)
    // -> maintenance task completes first. Reconciliation is called with the CURRENT active-task set
    // (maintenance no longer active, cleaning still active), not "what the maintenance task's own
    // completion would clear" — so it correctly re-derives 'cleaning', never a stale 'null'.
    expect(
      resolveUnitOverride({ current: "maintenance", hasActiveMaintenanceTask: false, hasActiveCleaningTask: true }),
    ).toBe("cleaning");
  });
});

describe("resolveHousekeepingScope", () => {
  it("owners and managers see everything", () => {
    expect(resolveHousekeepingScope("owner", null)).toEqual({ kind: "all" });
    expect(resolveHousekeepingScope("manager", "tm1")).toEqual({ kind: "all" });
  });
  it("an employee is scoped to their own team-member id (regression: employees cannot see other employees' tasks)", () => {
    expect(resolveHousekeepingScope("employee", "tm1")).toEqual({ kind: "assigned", teamMemberId: "tm1" });
  });
  it("an employee with no resolvable team-member id sees nothing", () => {
    expect(resolveHousekeepingScope("employee", null)).toEqual({ kind: "none" });
  });
});

const BASE_INPUT = {
  unitId: "11111111-1111-1111-8111-111111111111",
  taskType: "cleaning",
  title: "Clean room 204",
};

describe("housekeepingTaskInputSchema", () => {
  it("accepts a minimal valid input and applies defaults", () => {
    const result = housekeepingTaskInputSchema.safeParse(BASE_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("normal");
      expect(result.data.reservationId).toBeUndefined();
      expect(result.data.assignedTo).toBeUndefined();
    }
  });

  it("rejects a missing title", () => {
    const result = housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid task type", () => {
    const result = housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, taskType: "on_fire" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed unit id", () => {
    const result = housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, unitId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("validates dueTime as HH:MM (24-hour)", () => {
    expect(housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, dueTime: "14:30" }).success).toBe(true);
    expect(housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, dueTime: "2:30pm" }).success).toBe(false);
    expect(housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, dueTime: "25:00" }).success).toBe(false);
  });

  it("rejects a title over 120 characters", () => {
    const result = housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, title: "x".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("rejects a description over 1000 characters", () => {
    const result = housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, description: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe("housekeepingTaskFiltersSchema", () => {
  it("defaults invalid/missing values to safe fallbacks (.catch)", () => {
    const result = housekeepingTaskFiltersSchema.parse({});
    expect(result.quickFilter).toBe("all");
    expect(result.propertyId).toBe("all");
    expect(result.buildingId).toBe("all");
    expect(result.unitId).toBe("all");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it("rejects an unknown quick filter by falling back to 'all'", () => {
    const result = housekeepingTaskFiltersSchema.parse({ quickFilter: "on_fire" });
    expect(result.quickFilter).toBe("all");
  });

  it("clamps pageSize and coerces numeric strings", () => {
    const result = housekeepingTaskFiltersSchema.parse({ page: "3", pageSize: "500" });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(25);
  });
});
