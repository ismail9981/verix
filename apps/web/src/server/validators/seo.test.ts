import { describe, it, expect } from "vitest";
import {
  optionalSafeUrlSchema,
  optionalSeoDescriptionSchema,
  optionalSeoTitleSchema,
  robotsBooleanSchema,
  safeUrlSchema,
} from "./seo";

describe("safeUrlSchema", () => {
  it("accepts well-formed http(s) URLs", () => {
    expect(safeUrlSchema.safeParse("https://example.com/og.png").success).toBe(true);
    expect(safeUrlSchema.safeParse("http://localhost:3000/x.png").success).toBe(true);
  });

  it("rejects javascript:, data:, file:, vbscript: schemes", () => {
    for (const url of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
    ]) {
      expect(safeUrlSchema.safeParse(url).success, url).toBe(false);
    }
  });

  it("rejects non-URL garbage and relative paths", () => {
    expect(safeUrlSchema.safeParse("not a url").success).toBe(false);
    expect(safeUrlSchema.safeParse("/relative/path.png").success).toBe(false);
  });

  it("rejects control characters (header/injection defense)", () => {
    expect(safeUrlSchema.safeParse("https://example.com/\r\nSet-Cookie:x").success).toBe(false);
  });

  it("rejects overly long URLs", () => {
    expect(safeUrlSchema.safeParse(`https://example.com/${"a".repeat(3000)}`).success).toBe(false);
  });
});

describe("optionalSafeUrlSchema", () => {
  it("treats blank/whitespace as undefined rather than an error", () => {
    expect(optionalSafeUrlSchema.parse("")).toBeUndefined();
    expect(optionalSafeUrlSchema.parse("   ")).toBeUndefined();
    expect(optionalSafeUrlSchema.parse(undefined)).toBeUndefined();
  });

  it("still rejects an unsafe non-blank value", () => {
    expect(optionalSafeUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });
});

describe("seo text schemas", () => {
  it("collapses newlines/tabs and repeated whitespace", () => {
    const schema = optionalSeoTitleSchema();
    expect(schema.parse("Hello\n\tworld   there")).toBe("Hello world there");
  });

  it("rejects control characters", () => {
    expect(optionalSeoTitleSchema().safeParse("bad\x00title").success).toBe(false);
  });

  it("enforces a max length", () => {
    expect(optionalSeoTitleSchema(10).safeParse("a".repeat(11)).success).toBe(false);
    expect(optionalSeoTitleSchema(10).safeParse("a".repeat(10)).success).toBe(true);
  });

  it("description schema has a larger default cap than title", () => {
    const longButUnderDescCap = "a".repeat(300);
    expect(optionalSeoDescriptionSchema().safeParse(longButUnderDescCap).success).toBe(true);
    expect(optionalSeoTitleSchema().safeParse(longButUnderDescCap).success).toBe(false);
  });

  it("blank input becomes undefined, not an empty-string value", () => {
    expect(optionalSeoTitleSchema().parse("   ")).toBeUndefined();
  });
});

describe("robotsBooleanSchema", () => {
  it("coerces common truthy form values", () => {
    expect(robotsBooleanSchema.parse("true")).toBe(true);
    expect(robotsBooleanSchema.parse("on")).toBe(true);
    expect(robotsBooleanSchema.parse(true)).toBe(true);
  });
  it("treats anything else as false", () => {
    expect(robotsBooleanSchema.parse("false")).toBe(false);
    expect(robotsBooleanSchema.parse(undefined)).toBe(false);
    expect(robotsBooleanSchema.parse(null)).toBe(false);
  });
});
