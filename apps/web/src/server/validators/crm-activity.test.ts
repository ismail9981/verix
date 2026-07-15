import { describe, it, expect } from "vitest";
import { createActivitySchema, isActivityOverdue, isActivityUpcoming } from "./crm-activity";

const NOW = new Date("2026-07-15T12:00:00.000Z");
const past = new Date("2026-07-10T00:00:00.000Z");
const soon = new Date("2026-07-18T00:00:00.000Z");
const far = new Date("2026-08-15T00:00:00.000Z");

describe("isActivityOverdue", () => {
  it("is overdue when due in the past and not completed", () => {
    expect(isActivityOverdue({ dueAt: past, completedAt: null }, NOW)).toBe(true);
  });
  it("is not overdue once completed", () => {
    expect(isActivityOverdue({ dueAt: past, completedAt: NOW }, NOW)).toBe(false);
  });
  it("is not overdue with no due date", () => {
    expect(isActivityOverdue({ dueAt: null, completedAt: null }, NOW)).toBe(false);
  });
  it("is not overdue when due in the future", () => {
    expect(isActivityOverdue({ dueAt: far, completedAt: null }, NOW)).toBe(false);
  });
});

describe("isActivityUpcoming", () => {
  it("is upcoming within the default 7-day window", () => {
    expect(isActivityUpcoming({ dueAt: soon, completedAt: null }, NOW)).toBe(true);
  });
  it("is not upcoming beyond the window", () => {
    expect(isActivityUpcoming({ dueAt: far, completedAt: null }, NOW)).toBe(false);
  });
  it("is not upcoming once overdue (past due)", () => {
    expect(isActivityUpcoming({ dueAt: past, completedAt: null }, NOW)).toBe(false);
  });
  it("is not upcoming once completed", () => {
    expect(isActivityUpcoming({ dueAt: soon, completedAt: NOW }, NOW)).toBe(false);
  });
});

describe("createActivitySchema dueAt (regression)", () => {
  it("accepts the offset-less value a <input type=\"datetime-local\"> actually submits", () => {
    const parsed = createActivitySchema.safeParse({
      type: "call",
      title: "Follow up",
      dueAt: "2026-07-20T14:30",
    });
    expect(parsed.success).toBe(true);
  });
  it("still accepts a fully-qualified offset value", () => {
    const parsed = createActivitySchema.safeParse({
      type: "call",
      title: "Follow up",
      dueAt: "2026-07-20T14:30:00Z",
    });
    expect(parsed.success).toBe(true);
  });
});
