import { describe, it, expect } from "vitest";
import {
  DEFAULT_STAGES,
  deriveStatusForStage,
  findOpenOpportunityForLead,
  isStageInPipeline,
  isValidStageReorder,
  resolveOpportunityScope,
  weightedValueCents,
} from "./crm-pipeline";

describe("DEFAULT_STAGES", () => {
  it("has exactly 7 stages in position order", () => {
    expect(DEFAULT_STAGES).toHaveLength(7);
    DEFAULT_STAGES.forEach((s, i) => expect(s.position).toBe(i));
  });
  it("has exactly one won stage and one lost stage", () => {
    expect(DEFAULT_STAGES.filter((s) => s.isWon)).toHaveLength(1);
    expect(DEFAULT_STAGES.filter((s) => s.isLost)).toHaveLength(1);
  });
  it("marks every default stage as protected", () => {
    expect(DEFAULT_STAGES.every((s) => s.isProtected)).toBe(true);
  });
});

describe("weightedValueCents", () => {
  it("scales value by probability", () => {
    expect(weightedValueCents(100_00, 50)).toBe(50_00);
    expect(weightedValueCents(100_00, 0)).toBe(0);
    expect(weightedValueCents(100_00, 100)).toBe(100_00);
  });
  it("rounds to the nearest cent", () => {
    expect(weightedValueCents(10, 33)).toBe(3); // 3.3 -> 3
  });
});

describe("deriveStatusForStage", () => {
  it("maps isWon/isLost stages to won/lost, everything else to open", () => {
    expect(deriveStatusForStage({ isWon: true, isLost: false })).toBe("won");
    expect(deriveStatusForStage({ isWon: false, isLost: true })).toBe("lost");
    expect(deriveStatusForStage({ isWon: false, isLost: false })).toBe("open");
  });
});

describe("isStageInPipeline", () => {
  it("checks the stage belongs to the given pipeline", () => {
    expect(isStageInPipeline({ pipelineId: "p1" }, "p1")).toBe(true);
    expect(isStageInPipeline({ pipelineId: "p2" }, "p1")).toBe(false);
  });
});

describe("isValidStageReorder", () => {
  it("accepts a permutation of the same ids", () => {
    expect(isValidStageReorder(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });
  it("rejects a different set of ids", () => {
    expect(isValidStageReorder(["a", "b", "c"], ["a", "b", "d"])).toBe(false);
  });
  it("rejects a different length", () => {
    expect(isValidStageReorder(["a", "b", "c"], ["a", "b"])).toBe(false);
  });
});

describe("findOpenOpportunityForLead", () => {
  const candidates = [
    { id: "1", leadId: "lead-1", status: "open" as const },
    { id: "2", leadId: "lead-1", status: "won" as const },
    { id: "3", leadId: "lead-2", status: "open" as const },
  ];
  it("finds an open opportunity for the lead", () => {
    expect(findOpenOpportunityForLead(candidates, "lead-1")?.id).toBe("1");
  });
  it("ignores closed opportunities for the same lead", () => {
    expect(findOpenOpportunityForLead(candidates, "lead-1")?.id).not.toBe("2");
  });
  it("returns null when there's no open opportunity for the lead", () => {
    expect(findOpenOpportunityForLead(candidates, "lead-3")).toBeNull();
  });
});

describe("resolveOpportunityScope", () => {
  it("gives owners and managers full-workspace scope", () => {
    expect(resolveOpportunityScope("owner", "u1")).toEqual({ kind: "all" });
    expect(resolveOpportunityScope("manager", "u1")).toEqual({ kind: "all" });
  });
  it("scopes employees to their own assigned opportunities", () => {
    expect(resolveOpportunityScope("employee", "u1")).toEqual({
      kind: "assigned",
      userId: "u1",
    });
  });
});
