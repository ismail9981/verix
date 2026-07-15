import { describe, it, expect } from "vitest";
import {
  CONTACT_SUBMISSION_FIELD_LIMITS,
  MIN_FILL_TIME_MS,
  buildContactSubmissionSchema,
  findDuplicateCustomerMatch,
  isHoneypotTriggered,
  isSubmissionTooFast,
  isValidLeadStatusTransition,
  makeContactSnapshotSection,
  normalizeEmail,
  normalizePhone,
  resolveContactFormSection,
  stripSitePreviewPrefix,
} from "./lead-public";
import { CONTACT_FORM_DEFAULTS, type ContactFormFields } from "../../website/sections/contact/schema";
import { SNAPSHOT_FORMAT_VERSION, type SiteSnapshot, type SnapshotPage } from "../../website/render/snapshot";
import { modernTheme } from "../../website/theme/themes/modern";

function page(id: string, path: string, sections: SnapshotPage["sections"] = []): SnapshotPage {
  return {
    id,
    path,
    title: id,
    locale: "en-us",
    position: 0,
    seo: { title: null, description: null },
    sections,
  };
}

function snapshotWith(pages: SnapshotPage[]): SiteSnapshot {
  return {
    format: SNAPSHOT_FORMAT_VERSION,
    site: { id: "site-1", name: "Site", defaultLocale: "en-us", themeKey: "modern" },
    theme: { key: "modern", tokens: structuredClone(modernTheme.tokens) },
    pages,
    publishedAt: new Date().toISOString(),
  };
}

const ALL_ENABLED_REQUIRED: ContactFormFields = {
  name: { enabled: true, required: true },
  email: { enabled: true, required: true },
  phone: { enabled: true, required: false },
  subject: { enabled: false, required: false },
  message: { enabled: true, required: true },
};

describe("isHoneypotTriggered", () => {
  it("is false for empty/whitespace", () => {
    expect(isHoneypotTriggered("")).toBe(false);
    expect(isHoneypotTriggered("   ")).toBe(false);
    expect(isHoneypotTriggered(undefined)).toBe(false);
  });
  it("is true for any non-empty value", () => {
    expect(isHoneypotTriggered("http://spam.example")).toBe(true);
  });
});

describe("isSubmissionTooFast", () => {
  it("rejects below the minimum fill time", () => {
    expect(isSubmissionTooFast(MIN_FILL_TIME_MS - 1)).toBe(true);
    expect(isSubmissionTooFast(0)).toBe(true);
    expect(isSubmissionTooFast(-50)).toBe(true);
  });
  it("accepts at/above the minimum fill time", () => {
    expect(isSubmissionTooFast(MIN_FILL_TIME_MS)).toBe(false);
    expect(isSubmissionTooFast(MIN_FILL_TIME_MS + 5000)).toBe(false);
  });
  it("rejects non-finite elapsed values (clock/payload tampering)", () => {
    expect(isSubmissionTooFast(NaN)).toBe(true);
    expect(isSubmissionTooFast(Infinity)).toBe(true);
  });
});

describe("buildContactSubmissionSchema", () => {
  const schema = buildContactSubmissionSchema(ALL_ENABLED_REQUIRED);

  it("requires required-enabled fields", () => {
    const result = schema.safeParse({ name: "", email: "a@b.com", message: "hi" });
    expect(result.success).toBe(false);
  });

  it("accepts optional-enabled fields when empty", () => {
    const result = schema.safeParse({
      name: "Ann",
      email: "a@b.com",
      phone: "",
      message: "hi",
    });
    expect(result.success).toBe(true);
  });

  it("discards a disabled field regardless of what's sent", () => {
    const result = schema.parse({
      name: "Ann",
      email: "a@b.com",
      message: "hi",
      subject: "should be dropped",
    });
    expect(result.subject).toBeUndefined();
  });

  it("rejects an invalid email", () => {
    const result = schema.safeParse({ name: "Ann", email: "not-an-email", message: "hi" });
    expect(result.success).toBe(false);
  });

  it("enforces the field length limit", () => {
    const tooLong = "a".repeat(CONTACT_SUBMISSION_FIELD_LIMITS.message + 1);
    const result = schema.safeParse({ name: "Ann", email: "a@b.com", message: tooLong });
    expect(result.success).toBe(false);
  });
});

describe("stripSitePreviewPrefix", () => {
  it("strips the /site/{id} prefix", () => {
    expect(stripSitePreviewPrefix("/site/abc123/contact", "abc123")).toBe("/contact");
  });
  it("maps the bare prefix to the root path", () => {
    expect(stripSitePreviewPrefix("/site/abc123", "abc123")).toBe("/");
  });
  it("leaves a real custom-domain path untouched", () => {
    expect(stripSitePreviewPrefix("/contact", "abc123")).toBe("/contact");
  });
  it("does not strip a different site's prefix", () => {
    expect(stripSitePreviewPrefix("/site/other/contact", "abc123")).toBe("/site/other/contact");
  });
});

describe("resolveContactFormSection", () => {
  it("returns page-not-found for an unknown path", () => {
    const snapshot = snapshotWith([page("home", "")]);
    const r = resolveContactFormSection(snapshot, "/nope", undefined, "form-1");
    expect(r.status).toBe("page-not-found");
  });

  it("returns form-not-found when no contact section matches the key", () => {
    const section = makeContactSnapshotSection("sec-1", { form: { ...CONTACT_FORM_DEFAULTS, enabled: true } });
    const snapshot = snapshotWith([page("home", "", [section])]);
    const r = resolveContactFormSection(snapshot, "", undefined, "wrong-key");
    expect(r.status).toBe("form-not-found");
  });

  it("returns form-not-found when the form is disabled", () => {
    const section = makeContactSnapshotSection("sec-1", { form: { ...CONTACT_FORM_DEFAULTS, enabled: false } });
    const snapshot = snapshotWith([page("home", "", [section])]);
    const r = resolveContactFormSection(snapshot, "", undefined, "sec-1");
    expect(r.status).toBe("form-not-found");
  });

  it("matches by the section's own id when no formKey is configured", () => {
    const section = makeContactSnapshotSection("sec-1", { form: { ...CONTACT_FORM_DEFAULTS, enabled: true } });
    const snapshot = snapshotWith([page("home", "", [section])]);
    const r = resolveContactFormSection(snapshot, "", undefined, "sec-1");
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.sectionId).toBe("sec-1");
  });

  it("matches by the merchant-configured formKey instead of the id", () => {
    const section = makeContactSnapshotSection("sec-1", {
      form: { ...CONTACT_FORM_DEFAULTS, enabled: true, formKey: "footer" },
    });
    const snapshot = snapshotWith([page("home", "", [section])]);
    expect(resolveContactFormSection(snapshot, "", undefined, "sec-1").status).toBe("form-not-found");
    expect(resolveContactFormSection(snapshot, "", undefined, "footer").status).toBe("ok");
  });

  it("treats a hidden/deleted section as absent (never in the snapshot to begin with)", () => {
    // The compiler already excludes non-visible/soft-deleted sections at
    // publish time, so an empty section list is exactly what "hidden" looks
    // like by the time a snapshot exists — there is nothing extra to check.
    const snapshot = snapshotWith([page("home", "", [])]);
    expect(resolveContactFormSection(snapshot, "", undefined, "sec-1").status).toBe("form-not-found");
  });
});

describe("normalizeEmail / normalizePhone", () => {
  it("lowercases and trims email", () => {
    expect(normalizeEmail("  Ann@Example.com  ")).toBe("ann@example.com");
  });
  it("returns null for empty email", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
  it("strips non-digits from phone and a leading US country code", () => {
    expect(normalizePhone("+1 (555) 123-4567")).toBe("5551234567");
    expect(normalizePhone("5551234567")).toBe("5551234567");
  });
});

describe("findDuplicateCustomerMatch", () => {
  const candidates = [
    { id: "c1", email: "ann@example.com", phone: "5551234567" },
    { id: "c2", email: null, phone: "5559876543" },
  ];

  it("matches by normalized email first", () => {
    const match = findDuplicateCustomerMatch(candidates, {
      email: "  ANN@example.com ",
      phone: null,
    });
    expect(match?.id).toBe("c1");
  });

  it("falls back to normalized phone when email doesn't match", () => {
    const match = findDuplicateCustomerMatch(candidates, {
      email: "nobody@example.com",
      phone: "+1 (555) 987-6543",
    });
    expect(match?.id).toBe("c2");
  });

  it("returns null when nothing matches", () => {
    const match = findDuplicateCustomerMatch(candidates, { email: "x@x.com", phone: "0000000000" });
    expect(match).toBeNull();
  });
});

describe("isValidLeadStatusTransition", () => {
  it("blocks a direct transition into converted", () => {
    expect(isValidLeadStatusTransition("new", "converted")).toBe(false);
    expect(isValidLeadStatusTransition("qualified", "converted")).toBe(false);
  });
  it("allows any other transition, including reopening", () => {
    expect(isValidLeadStatusTransition("new", "contacted")).toBe(true);
    expect(isValidLeadStatusTransition("spam", "new")).toBe(true);
    expect(isValidLeadStatusTransition("archived", "qualified")).toBe(true);
  });
});
