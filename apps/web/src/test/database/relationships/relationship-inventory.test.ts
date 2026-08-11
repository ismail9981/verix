import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PARENT_WORKSPACE_UNIQUE_CONSTRAINTS,
  WORKSPACE_RELATIONSHIPS,
} from "./relationship-inventory";

const APP_DIRECTORY = fileURLToPath(new URL("../../../..", import.meta.url));

describe("B3.2 relationship inventory", () => {
  it("preserves the independently verified 76-FK classification", () => {
    expect(WORKSPACE_RELATIONSHIPS).toHaveLength(40);
    expect(PARENT_WORKSPACE_UNIQUE_CONSTRAINTS).toHaveLength(17);
    expect(
      WORKSPACE_RELATIONSHIPS.filter((item) => item.confirmedByB3),
    ).toHaveLength(6);
    expect(
      WORKSPACE_RELATIONSHIPS.filter(
        (item) => !item.confirmedByB3 && !item.previouslyProtectedByTrigger,
      ),
    ).toHaveLength(31);
    expect(
      WORKSPACE_RELATIONSHIPS.filter(
        (item) => item.previouslyProtectedByTrigger,
      ),
    ).toHaveLength(3);
    expect(
      WORKSPACE_RELATIONSHIPS.filter((item) => item.drizzleManaged),
    ).toHaveLength(22);
  });

  it("keeps every target and generated constraint name unique", () => {
    expect(new Set(WORKSPACE_RELATIONSHIPS.map(({ key }) => key)).size).toBe(
      40,
    );
    expect(
      new Set(
        WORKSPACE_RELATIONSHIPS.map(
          ({ compositeForeignKeyName }) => compositeForeignKeyName,
        ),
      ).size,
    ).toBe(40);
  });

  it("contains a preflight, all constraints, validation, and safe SET NULL SQL", async () => {
    const migration = await readFile(
      resolve(
        APP_DIRECTORY,
        "drizzle/0003_workspace_relationship_hardening.sql",
      ),
      "utf8",
    );
    expect(migration.indexOf("DO $$")).toBeLessThan(
      migration.indexOf("ADD CONSTRAINT"),
    );
    for (const relationship of WORKSPACE_RELATIONSHIPS) {
      expect(migration).toContain(
        `ADD CONSTRAINT "${relationship.compositeForeignKeyName}"`,
      );
      expect(migration).toContain(
        `VALIDATE CONSTRAINT "${relationship.compositeForeignKeyName}"`,
      );
      if (relationship.onDelete === "set null") {
        expect(migration).toContain(
          `ON DELETE set null ("${relationship.childForeignColumn}")`,
        );
      }
    }
  });
});
