import { describe, it, expect } from "vitest";
import { CONTACT_FORM_DEFAULTS, contactSchema } from "./schema";

describe("contactSchema (Sprint 9 v1 backward compatibility)", () => {
  it("parses a pre-Sprint-9 (v1) props object, defaulting the new form config", () => {
    // Exactly what a v1 snapshot's frozen props looked like — no `form` key.
    const v1Props = {
      heading: "Contact us",
      email: "hi@example.com",
      phone: "555-1234",
      address: "123 Main St",
    };
    const parsed = contactSchema.parse(v1Props);
    expect(parsed.heading).toBe("Contact us");
    expect(parsed.form).toEqual(CONTACT_FORM_DEFAULTS);
  });

  it("cascades nested defaults all the way to individual field configs", () => {
    const parsed = contactSchema.parse({ heading: "Contact us" });
    expect(parsed.form.enabled).toBe(true);
    expect(parsed.form.fields.name).toEqual({ enabled: true, required: true });
    expect(parsed.form.fields.email).toEqual({ enabled: true, required: true });
    expect(parsed.form.fields.phone).toEqual({ enabled: true, required: false });
    expect(parsed.form.fields.subject).toEqual({ enabled: false, required: false });
    expect(parsed.form.fields.message).toEqual({ enabled: true, required: true });
    expect(parsed.form.formKey).toBe("");
  });

  it("still requires heading (unchanged v1 behavior)", () => {
    expect(contactSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a fully-specified v2 form config", () => {
    const parsed = contactSchema.parse({
      heading: "Contact us",
      form: {
        enabled: true,
        heading: "Get in touch",
        description: "We reply within a day.",
        fields: {
          name: { enabled: true, required: true },
          email: { enabled: true, required: true },
          phone: { enabled: false, required: false },
          subject: { enabled: true, required: false },
          message: { enabled: true, required: true },
        },
        submitLabel: "Submit",
        successMessage: "Sent!",
        formKey: "footer-contact",
      },
    });
    expect(parsed.form.formKey).toBe("footer-contact");
    expect(parsed.form.fields.subject.enabled).toBe(true);
  });

  it("rejects a formKey with disallowed characters", () => {
    const result = contactSchema.safeParse({
      heading: "Contact us",
      form: { formKey: "not valid!" },
    });
    expect(result.success).toBe(false);
  });
});
