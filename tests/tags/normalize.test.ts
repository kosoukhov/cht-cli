import { describe, it, expect } from "vitest";
import { normalizeTag } from "../../src/tags/normalize.ts";

describe("normalizeTag", () => {
  it("converts to lowercase", () => {
    expect(normalizeTag("Work")).toBe("work");
  });

  it("trims whitespace", () => {
    expect(normalizeTag("  work  ")).toBe("work");
  });

  it("converts spaces to hyphens", () => {
    expect(normalizeTag("Work Items")).toBe("work-items");
  });

  it("converts underscores to hyphens", () => {
    expect(normalizeTag("work_items")).toBe("work-items");
  });

  it("strips invalid characters", () => {
    expect(normalizeTag("work@items!")).toBe("workitems");
  });

  it("collapses consecutive hyphens", () => {
    expect(normalizeTag("work--items")).toBe("work-items");
  });

  it("strips leading and trailing hyphens", () => {
    expect(normalizeTag("-work-")).toBe("work");
  });

  it("returns null for input that normalizes to empty (only hyphens)", () => {
    expect(normalizeTag("---")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeTag("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(normalizeTag("   ")).toBeNull();
  });

  it("preserves numbers", () => {
    expect(normalizeTag("work123")).toBe("work123");
  });

  it("converts full uppercase to lowercase", () => {
    expect(normalizeTag("UPPER-CASE")).toBe("upper-case");
  });

  it("handles mixed special characters", () => {
    expect(normalizeTag("Hello, World! #2024")).toBe("hello-world-2024");
  });

  it("handles tabs and multiple spaces as hyphens", () => {
    expect(normalizeTag("work\titems")).toBe("work-items");
  });
});
