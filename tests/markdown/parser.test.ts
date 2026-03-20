import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseChat, parseMessages } from "../../src/markdown/parser.ts";

const fixturesDir = resolve(import.meta.dirname, "../fixtures");

function readFixture(name: string): string {
  return readFileSync(resolve(fixturesDir, name), "utf-8");
}

describe("parseChat", () => {
  it("parses simple chat into 2 messages", () => {
    const content = readFixture("simple-chat.md");
    const result = parseChat(content);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("Hello, how are you?");
    expect(result.messages[1].role).toBe("assistant");
    expect(result.messages[1].content).toBe("I'm doing well, thank you!");
  });

  it("preserves code blocks in messages", () => {
    const content = readFixture("code-blocks.md");
    const result = parseChat(content);

    // Should have 2 messages: user + assistant
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].role).toBe("assistant");

    // Assistant message should contain the full fenced code block
    const assistantContent = result.messages[1].content;
    expect(assistantContent).toContain("```typescript");
    expect(assistantContent).toContain("// ## User");
    expect(assistantContent).toContain('const heading = "## Assistant"');
    expect(assistantContent).toContain("```");
  });

  it("does not split on headings inside code blocks", () => {
    const content = readFixture("adversarial.md");
    const result = parseChat(content);

    // Must be exactly 2 messages, NOT 4+
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].role).toBe("assistant");

    // Assistant message should contain the adversarial content intact
    const assistantContent = result.messages[1].content;
    expect(assistantContent).toContain("## User");
    expect(assistantContent).toContain("## Assistant");
    expect(assistantContent).toContain("That's the adversarial content.");
  });

  it("returns empty messages for frontmatter-only file", () => {
    const content = readFixture("empty-chat.md");
    const result = parseChat(content);

    expect(result.messages).toHaveLength(0);
    expect(result.frontmatter.title).toBe("Empty Chat");
    expect(result.frontmatter.project).toBe("general");
  });

  it("normalizes CRLF to LF", () => {
    const content = readFixture("simple-chat.md");
    const crlfContent = content.replace(/\n/g, "\r\n");
    const resultLF = parseChat(content);
    const resultCRLF = parseChat(crlfContent);

    expect(resultCRLF.messages).toHaveLength(2);
    expect(resultCRLF.messages[0].content).toBe(resultLF.messages[0].content);
    expect(resultCRLF.messages[1].content).toBe(resultLF.messages[1].content);
  });

  it("ignores content before first heading", () => {
    const content = readFixture("simple-chat.md");
    // Insert preamble after frontmatter but before first heading
    const modifiedContent = content.replace(
      "## User",
      "Some random preamble\n\nAnother line of preamble\n\n## User",
    );
    const result = parseChat(modifiedContent);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("Hello, how are you?");
  });
});

describe("parseMessages", () => {
  it("returns empty array for empty content", () => {
    const result = parseMessages("");
    expect(result).toHaveLength(0);
  });

  it("returns empty array for content with no headings", () => {
    const result = parseMessages("Just some text\nwith no headings\n");
    expect(result).toHaveLength(0);
  });
});
