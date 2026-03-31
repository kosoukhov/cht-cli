import { describe, it, expect } from "vitest";
import { serializeChat } from "../../src/markdown/serializer.ts";
import type { ChatFrontmatter, ChatMessage, CompactMarker } from "../../src/types.ts";

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

describe("compact marker serialization", () => {
  it("backward compat: serializeChat with 2 args produces same output as before", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const output = serializeChat(testFrontmatter, messages);
    expect(output).toContain("## User");
    expect(output).toContain("## Assistant");
    expect(output).not.toContain("## Compact");
  });

  it("with empty compactMarkers array: same as 2-arg call", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const withEmpty = serializeChat(testFrontmatter, messages, [], []);
    const without = serializeChat(testFrontmatter, messages);
    expect(withEmpty).toBe(without);
  });

  it("with 1 compact marker between messages produces correct markdown", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "Continue" },
    ];
    const markers: CompactMarker[] = [
      { timestamp: "2026-03-31T14:30:00.000Z", trigger: "auto" },
    ];
    // Section order: msg0, msg1, compact0, msg2
    const sectionOrder = [
      { type: "message" as const, index: 0 },
      { type: "message" as const, index: 1 },
      { type: "compact" as const, index: 0 },
      { type: "message" as const, index: 2 },
    ];

    const output = serializeChat(testFrontmatter, messages, markers, sectionOrder);
    expect(output).toContain("## Compact");
    expect(output).toContain("*2026-03-31T14:30:00.000Z -- auto*");
    expect(output).toContain("Context was compacted. Messages above this marker were summarized by Claude Code.");
  });

  it("produces exact compact marker format", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];
    const markers: CompactMarker[] = [
      { timestamp: "2026-03-31T14:30:00.000Z", trigger: "auto" },
    ];
    // Section order: msg0, msg1, compact0
    const sectionOrder = [
      { type: "message" as const, index: 0 },
      { type: "message" as const, index: 1 },
      { type: "compact" as const, index: 0 },
    ];

    const output = serializeChat(testFrontmatter, messages, markers, sectionOrder);
    expect(output).toContain(
      "## Compact\n\n*2026-03-31T14:30:00.000Z -- auto*\n\nContext was compacted. Messages above this marker were summarized by Claude Code.",
    );
  });

  it("compact marker at end of file serializes correctly", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Goodbye" },
    ];
    const markers: CompactMarker[] = [
      { timestamp: "2026-03-31T18:00:00.000Z", trigger: "manual" },
    ];
    const sectionOrder = [
      { type: "message" as const, index: 0 },
      { type: "message" as const, index: 1 },
      { type: "compact" as const, index: 0 },
    ];

    const output = serializeChat(testFrontmatter, messages, markers, sectionOrder);
    expect(output).toContain("## Compact");
    expect(output).toContain("*2026-03-31T18:00:00.000Z -- manual*");
  });
});
