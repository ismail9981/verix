import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CatalogManifest } from "../catalog/catalog-manifest";
import {
  buildRlsCoverageInventory,
  summarizeRlsCoverage,
} from "./rls-inventory";

const canonical = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "src/test/database/catalog/manifests/canonical-pre-sprint-1.json",
    ),
    "utf8",
  ),
) as CatalogManifest;

describe("canonical RLS coverage inventory", () => {
  it("accounts for all 30 canonical policies and all four helper shapes", () => {
    const inventory = buildRlsCoverageInventory(canonical);
    expect(summarizeRlsCoverage(inventory)).toEqual({
      tables: 30,
      rlsEnabled: 30,
      forceRlsEnabled: 0,
      membershipOnlyPolicies: 30,
      helperPatterns: [
        "comember_user_id",
        "conversation_parent",
        "workspace_id",
        "workspace_primary_key",
      ],
      uncoveredCrudCommands: 0,
    });
    expect(inventory.every(({ roles }) => roles.includes("authenticated"))).toBe(
      true,
    );
  });

  it("records the specialized workspaces, users, and messages policy shapes", () => {
    const inventory = buildRlsCoverageInventory(canonical);
    expect(
      inventory
        .filter(({ helperPattern }) => helperPattern !== "workspace_id")
        .map(({ table, helperPattern }) => [table, helperPattern]),
    ).toEqual([
      ["ai_messages", "conversation_parent"],
      ["users", "comember_user_id"],
      ["workspaces", "workspace_primary_key"],
    ]);
  });
});
