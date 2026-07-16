import { describe, it, expect } from "vitest";
import {
  UNIT_CONDITION_OVERRIDES,
  UNIT_DISPLAY_STATUSES,
  rentalUnitInputSchema,
  resolveUnitDisplayStatus,
} from "./rental-unit";
import { RESERVATION_STATUSES, isReservationBlockingStatus } from "./reservation";

describe("resolveUnitDisplayStatus", () => {
  it("an override always wins, regardless of reservation state", () => {
    expect(
      resolveUnitDisplayStatus({ override: "maintenance", coveringReservationStatus: "checked_in" }),
    ).toBe("maintenance");
    expect(
      resolveUnitDisplayStatus({ override: "cleaning", coveringReservationStatus: null }),
    ).toBe("cleaning");
    expect(
      resolveUnitDisplayStatus({ override: "out_of_service", coveringReservationStatus: "confirmed" }),
    ).toBe("out_of_service");
  });

  it("a checked_in covering reservation reads as occupied", () => {
    expect(
      resolveUnitDisplayStatus({ override: null, coveringReservationStatus: "checked_in" }),
    ).toBe("occupied");
  });

  it("a pending or confirmed covering reservation reads as reserved", () => {
    expect(resolveUnitDisplayStatus({ override: null, coveringReservationStatus: "pending" })).toBe(
      "reserved",
    );
    expect(resolveUnitDisplayStatus({ override: null, coveringReservationStatus: "confirmed" })).toBe(
      "reserved",
    );
  });

  it("an inquiry-only covering reservation still reads as reserved — inquiry is a blocking status, matching checkAvailability", () => {
    expect(resolveUnitDisplayStatus({ override: null, coveringReservationStatus: "inquiry" })).toBe(
      "reserved",
    );
  });

  it("no covering reservation and no override reads as available", () => {
    expect(resolveUnitDisplayStatus({ override: null, coveringReservationStatus: null })).toBe(
      "available",
    );
  });

  it("an early checked_out covering reservation reads as reserved, never available — the booking flow still rejects an overlapping reservation for that range, so the display must not claim the unit is available", () => {
    expect(resolveUnitDisplayStatus({ override: null, coveringReservationStatus: "checked_out" })).toBe(
      "reserved",
    );
  });

  it("a cancelled/no_show covering status (shouldn't normally reach here — getCoveringReservationStatuses already excludes them — but is handled defensively) reads as available", () => {
    expect(resolveUnitDisplayStatus({ override: null, coveringReservationStatus: "cancelled" })).toBe(
      "available",
    );
    expect(resolveUnitDisplayStatus({ override: null, coveringReservationStatus: "no_show" })).toBe(
      "available",
    );
  });

  it("regression guard: never reads 'available' for a status isReservationBlockingStatus calls blocking — display and booking availability must share one source of truth for every current and future reservation status", () => {
    for (const status of RESERVATION_STATUSES) {
      const displayStatus = resolveUnitDisplayStatus({ override: null, coveringReservationStatus: status });
      if (isReservationBlockingStatus(status)) {
        expect(displayStatus, `${status} is blocking but resolved to "available"`).not.toBe("available");
      } else {
        expect(displayStatus, `${status} is non-blocking but resolved to "${displayStatus}"`).toBe("available");
      }
    }
  });
});

describe("UNIT_DISPLAY_STATUSES / UNIT_CONDITION_OVERRIDES", () => {
  it("every condition override is also a display status", () => {
    for (const override of UNIT_CONDITION_OVERRIDES) {
      expect(UNIT_DISPLAY_STATUSES).toContain(override);
    }
  });
});

const BASE_INPUT = {
  name: "Ocean View Suite",
  capacity: "2",
  bedrooms: "1",
  bathrooms: "1",
  amount: "150.00",
};

describe("rentalUnitInputSchema", () => {
  it("accepts a minimal valid input and applies defaults", () => {
    const result = rentalUnitInputSchema.safeParse(BASE_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unitType).toBe("room");
      expect(result.data.bedrooms).toBe(1);
      expect(result.data.bathrooms).toBe(1);
      expect(result.data.amenities).toEqual([]);
      expect(result.data.statusOverride).toBeUndefined();
    }
  });

  it("splits a comma-separated amenities string into a trimmed, de-duplicated array", () => {
    const result = rentalUnitInputSchema.safeParse({
      ...BASE_INPUT,
      amenities: "Wifi, Parking,  Pool ,Wifi",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amenities).toEqual(["Wifi", "Parking", "Pool"]);
    }
  });

  it("treats an empty amenities string as no amenities", () => {
    const result = rentalUnitInputSchema.safeParse({ ...BASE_INPUT, amenities: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amenities).toEqual([]);
  });

  it("rejects an amount with more than 2 decimal places", () => {
    const result = rentalUnitInputSchema.safeParse({ ...BASE_INPUT, amount: "19.999" });
    expect(result.success).toBe(false);
  });

  it("coerces floor, including negative (basement) values", () => {
    const result = rentalUnitInputSchema.safeParse({ ...BASE_INPUT, floor: "-1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.floor).toBe(-1);
  });

  it("omitting floor/unitNumber/sizeSqFt leaves them undefined", () => {
    const result = rentalUnitInputSchema.safeParse(BASE_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.floor).toBeUndefined();
      expect(result.data.unitNumber).toBeUndefined();
      expect(result.data.sizeSqFt).toBeUndefined();
    }
  });

  it("accepts a valid statusOverride and rejects an invalid one", () => {
    const ok = rentalUnitInputSchema.safeParse({ ...BASE_INPUT, statusOverride: "maintenance" });
    expect(ok.success).toBe(true);

    const bad = rentalUnitInputSchema.safeParse({ ...BASE_INPUT, statusOverride: "on_fire" });
    expect(bad.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = rentalUnitInputSchema.safeParse({ ...BASE_INPUT, name: "" });
    expect(result.success).toBe(false);
  });
});
