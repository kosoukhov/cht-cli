import { describe, it, expect } from "vitest";
import { generateSlug, generateChatFilename } from "../../src/utils/slug.ts";

describe("generateSlug", () => {
  it("transliterates Russian title containing 'nginx'", () => {
    const result = generateSlug("Настройка nginx");
    expect(result).toBeTruthy();
    expect(result).toContain("nginx");
  });

  it("transliterates Russian title containing 'API'", () => {
    const result = generateSlug("Дебаг API ошибки");
    expect(result).toContain("api");
  });

  it("transliterates mixed Russian/English title", () => {
    const result = generateSlug("TypeScript вопросы");
    expect(result).toContain("typescript");
  });

  it("returns empty string for empty input", () => {
    const result = generateSlug("");
    expect(result).toBe("");
  });

  it("produces lowercase output", () => {
    const result = generateSlug("My Chat Title");
    expect(result).toBe(result.toLowerCase());
  });

  it("replaces spaces with hyphens", () => {
    const result = generateSlug("hello world");
    expect(result).toBe("hello-world");
  });
});

describe("generateChatFilename", () => {
  it("produces date-slug.md format", () => {
    const result = generateChatFilename("My Chat", "2026-03-20T10:00:00Z");
    expect(result).toBe("2026-03-20-my-chat.md");
  });

  it("produces date-untitled.md for empty title", () => {
    const result = generateChatFilename("", "2026-03-20T10:00:00Z");
    expect(result).toBe("2026-03-20-untitled.md");
  });

  it("extracts date from full ISO string", () => {
    const result = generateChatFilename("Test", "2026-12-31T23:59:59Z");
    expect(result).toBe("2026-12-31-test.md");
  });
});
