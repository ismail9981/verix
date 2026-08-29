import { describe, expect, it, vi } from "vitest";

vi.mock("../db/db", () => ({ db: {} }));

import { createProperty } from "./property.service";
import { listInvoices } from "./invoice.service";

describe("B6 direct service authorization", () => {
  it("denies an employee property mutation before database access", async () => {
    await expect(
      createProperty("workspace-a", {} as never, { role: "employee" }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });
  });

  it("denies an employee invoice read before database access", async () => {
    await expect(
      listInvoices("workspace-a", { userId: "user-a", role: "employee" }),
    ).rejects.toMatchObject({ name: "AuthorizationError" });
  });
});
