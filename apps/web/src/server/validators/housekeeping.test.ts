import { describe, it, expect } from "vitest";
import { zodFieldErrors } from "../actions/action-result";
import {
  HOUSEKEEPING_TASK_STATUSES,
  canChangeTaskType,
  getValidHousekeepingTransitionsFrom,
  housekeepingTaskFiltersSchema,
  housekeepingTaskInputSchema,
  housekeepingTaskNotesInputSchema,
  isEmployeeAllowedHousekeepingTransition,
  isTaskOverdue,
  isValidHousekeepingStatusTransition,
  resolveEligibleUnitParents,
  resolveHousekeepingScope,
  resolveUnitOverride,
  type HousekeepingTaskStatus,
  type UnitParentCandidate,
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

const WORKSPACE_ID = "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa";
const OTHER_WORKSPACE_ID = "bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb";

const BASE_CANDIDATE: UnitParentCandidate = {
  id: "cccccccc-cccc-1ccc-8ccc-cccccccccccc",
  workspaceId: WORKSPACE_ID,
  deletedAt: null,
  propertyId: "dddddddd-dddd-1ddd-8ddd-dddddddddddd",
  propertyArchivedAt: null,
  propertyDeletedAt: null,
  buildingId: "eeeeeeee-eeee-1eee-8eee-eeeeeeeeeeee",
  buildingArchivedAt: null,
  buildingDeletedAt: null,
};

describe("resolveEligibleUnitParents (single source of truth for task-creation unit validation)", () => {
  it("no units available: a null candidate (no matching unit row) is rejected", () => {
    expect(resolveEligibleUnitParents(null, WORKSPACE_ID)).toBe(null);
  });

  it("property/building derived correctly: a fully eligible unit returns its own ids, never a client-supplied value", () => {
    const result = resolveEligibleUnitParents(BASE_CANDIDATE, WORKSPACE_ID);
    expect(result).toEqual({
      propertyId: BASE_CANDIDATE.propertyId,
      buildingId: BASE_CANDIDATE.buildingId,
    });
  });

  it("foreign workspace unit rejected: a candidate belonging to a different workspace is never eligible, regardless of its own state", () => {
    expect(resolveEligibleUnitParents(BASE_CANDIDATE, OTHER_WORKSPACE_ID)).toBe(null);
  });

  it("archived unit excluded: a soft-deleted unit is rejected", () => {
    expect(resolveEligibleUnitParents({ ...BASE_CANDIDATE, deletedAt: new Date() }, WORKSPACE_ID)).toBe(null);
  });

  it("archived unit excluded: an archived property rejects the unit even though the unit itself is untouched", () => {
    expect(
      resolveEligibleUnitParents({ ...BASE_CANDIDATE, propertyArchivedAt: new Date() }, WORKSPACE_ID),
    ).toBe(null);
  });

  it("archived unit excluded: a soft-deleted property rejects the unit", () => {
    expect(
      resolveEligibleUnitParents({ ...BASE_CANDIDATE, propertyDeletedAt: new Date() }, WORKSPACE_ID),
    ).toBe(null);
  });

  it("archived unit excluded: an archived building rejects the unit even though the property is active", () => {
    expect(
      resolveEligibleUnitParents({ ...BASE_CANDIDATE, buildingArchivedAt: new Date() }, WORKSPACE_ID),
    ).toBe(null);
  });

  it("archived unit excluded: a soft-deleted building rejects the unit", () => {
    expect(
      resolveEligibleUnitParents({ ...BASE_CANDIDATE, buildingDeletedAt: new Date() }, WORKSPACE_ID),
    ).toBe(null);
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

  it(
    "REGRESSION: minimal valid task creation — the exact shape `FormData` produces for the Create Task " +
      "form (fields with no <input> at all, like reservationId, arrive as `null`; fields with an <input> " +
      "left blank, like assignedTo/description/dueDate/dueTime/notes, arrive as `\"\"`) parses successfully " +
      "and every empty optional field normalizes to `undefined`, not a validation error",
    () => {
      const formShaped = {
        unitId: BASE_INPUT.unitId,
        reservationId: null, // no <input name="reservationId"> exists in the Create Task form
        taskType: "cleaning",
        priority: "normal",
        assignedTo: "", // <select> exists, left on "Unassigned"
        title: "Clean room 204",
        description: "",
        dueDate: "",
        dueTime: "",
        notes: "",
      };
      const result = housekeepingTaskInputSchema.safeParse(formShaped);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reservationId).toBeUndefined();
        expect(result.data.assignedTo).toBeUndefined();
        expect(result.data.description).toBeUndefined();
        expect(result.data.dueDate).toBeUndefined();
        expect(result.data.dueTime).toBeUndefined();
        expect(result.data.notes).toBeUndefined();
      }
    },
  );

  it("empty optional fields: null and empty-string are both accepted for every optional field, not just some", () => {
    const allNull = {
      ...BASE_INPUT,
      reservationId: null,
      assignedTo: null,
      description: null,
      dueDate: null,
      dueTime: null,
      notes: null,
    };
    expect(housekeepingTaskInputSchema.safeParse(allNull).success).toBe(true);

    const allEmptyString = {
      ...BASE_INPUT,
      reservationId: "",
      assignedTo: "",
      description: "",
      dueDate: "",
      dueTime: "",
      notes: "",
    };
    expect(housekeepingTaskInputSchema.safeParse(allEmptyString).success).toBe(true);
  });

  it("missing unit: an empty, null, or absent unitId is rejected (unit is required)", () => {
    expect(housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, unitId: "" }).success).toBe(false);
    expect(housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, unitId: null }).success).toBe(false);
    expect(
      housekeepingTaskInputSchema.safeParse({ taskType: BASE_INPUT.taskType, title: BASE_INPUT.title }).success,
    ).toBe(false);
  });

  it("invalid due time is rejected with the error attributed to the dueTime field", () => {
    const result = housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, dueTime: "not-a-time" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "dueTime")).toBe(true);
    }
  });

  it("invalid select value: an unrecognized priority is rejected with the error attributed to the priority field", () => {
    const result = housekeepingTaskInputSchema.safeParse({ ...BASE_INPUT, priority: "asap" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "priority")).toBe(true);
    }
  });

  it("server validation errors mapped to the correct field: zodFieldErrors keys the message by the failing field's own name, not a generic bucket", () => {
    const result = housekeepingTaskInputSchema.safeParse({
      ...BASE_INPUT,
      unitId: "",
      taskType: "on_fire",
      dueTime: "bad-time",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = zodFieldErrors(result.error);
      expect(fieldErrors.unitId?.[0]).toBeTruthy();
      expect(fieldErrors.taskType?.[0]).toBeTruthy();
      expect(fieldErrors.dueTime?.[0]).toBeTruthy();
      // No stray "form"-bucketed catch-all for these known, named fields.
      expect(fieldErrors.form).toBeUndefined();
    }
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

describe("canChangeTaskType (Fix 3: taskType may only change while pending or assigned)", () => {
  it("allows changing taskType while pending or assigned", () => {
    expect(canChangeTaskType("pending")).toBe(true);
    expect(canChangeTaskType("assigned")).toBe(true);
  });

  it("REGRESSION: forbids changing taskType once a task is in_progress (would leave a stale unit override)", () => {
    expect(canChangeTaskType("in_progress")).toBe(false);
  });

  it("forbids changing taskType on a terminal task", () => {
    expect(canChangeTaskType("completed")).toBe(false);
    expect(canChangeTaskType("cancelled")).toBe(false);
  });
});

describe("isTaskOverdue (Fix 5: one server-side, workspace-timezone-based definition of overdue)", () => {
  it("a task due before today is overdue", () => {
    expect(isTaskOverdue({ dueDate: "2026-01-01", status: "pending", today: "2026-01-02" })).toBe(true);
  });

  it("a task due today is not yet overdue", () => {
    expect(isTaskOverdue({ dueDate: "2026-01-02", status: "pending", today: "2026-01-02" })).toBe(false);
  });

  it("a task due in the future is not overdue", () => {
    expect(isTaskOverdue({ dueDate: "2026-01-03", status: "pending", today: "2026-01-02" })).toBe(false);
  });

  it("a task with no due date is never overdue", () => {
    expect(isTaskOverdue({ dueDate: null, status: "pending", today: "2026-01-02" })).toBe(false);
  });

  it("REGRESSION: a completed or cancelled task is never overdue, regardless of due date", () => {
    expect(isTaskOverdue({ dueDate: "2026-01-01", status: "completed", today: "2026-01-02" })).toBe(false);
    expect(isTaskOverdue({ dueDate: "2026-01-01", status: "cancelled", today: "2026-01-02" })).toBe(false);
  });

  it("REGRESSION: is a pure function of its explicit `today` string, not the system/browser clock — a date that reads as 'overdue' in one timezone and 'not yet due' in another is decided consistently for every caller by whichever `today` (the workspace's own local date) is passed in, never by re-deriving it from `new Date()`", () => {
    // Same dueDate, two different `today` values (as if computed for two different
    // workspace timezones straddling a midnight boundary) — the function has no
    // hidden dependency on wall-clock time, so results differ only via the explicit input.
    expect(isTaskOverdue({ dueDate: "2026-01-02", status: "in_progress", today: "2026-01-02" })).toBe(false);
    expect(isTaskOverdue({ dueDate: "2026-01-02", status: "in_progress", today: "2026-01-03" })).toBe(true);
  });
});

describe("housekeepingTaskNotesInputSchema (Fix 6: distinguish absent notes from an explicit clear)", () => {
  it("REGRESSION: an absent field (null — no <textarea> in this request) leaves notes untouched (undefined), not cleared", () => {
    const result = housekeepingTaskNotesInputSchema.safeParse({ notes: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBeUndefined();
  });

  it("REGRESSION: an explicitly-submitted empty string is a real, distinct 'clear' signal — not collapsed to undefined", () => {
    const result = housekeepingTaskNotesInputSchema.safeParse({ notes: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe("");
  });

  it("a whitespace-only submission also counts as an explicit clear", () => {
    const result = housekeepingTaskNotesInputSchema.safeParse({ notes: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe("");
  });

  it("a real submitted value is preserved, trimmed", () => {
    const result = housekeepingTaskNotesInputSchema.safeParse({ notes: "  Extra towels needed  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe("Extra towels needed");
  });
});
