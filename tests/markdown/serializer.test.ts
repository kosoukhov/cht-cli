import { describe, it, expect } from "vitest";
import { serializeChat } from "../../src/markdown/serializer.ts";
import type { ChatFrontmatter, ChatMessage } from "../../src/types.ts";

const testFrontmatter: ChatFrontmatter = {
  title: "Test Chat",
  project: "general",
  created: "2026-03-20T10:00:00Z",
  model: "claude-sonnet-4-20250514",
};

describe("serializeChat", () => {
  it("produces ## User and ## Assistant headings", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const output = serializeChat(testFrontmatter, messages);
    expect(output).toContain("## User");
    expect(output).toContain("## Assistant");
  });

  it("includes YAML frontmatter between --- delimiters", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
    ];

    const output = serializeChat(testFrontmatter, messages);
    expect(output).toMatch(/^---\n/);
    expect(output).toContain("title: Test Chat");
    expect(output).toContain("project: general");
    expect(output).toContain("model: claude-sonnet-4-20250514");
  });

  it("ends with trailing newline", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
    ];

    const output = serializeChat(testFrontmatter, messages);
    expect(output.endsWith("\n")).toBe(true);
  });

  it("handles empty message array", () => {
    const output = serializeChat(testFrontmatter, []);

    // Should contain frontmatter
    expect(output).toContain("title: Test Chat");
    // Should NOT contain any ## headings
    expect(output).not.toContain("## User");
    expect(output).not.toContain("## Assistant");
  });
});
