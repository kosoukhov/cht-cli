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

describe("compact markers", () => {
  it("parseChat on file with ## Compact section returns compactMarkers array with 1 entry", () => {
    const content = readFixture("compact-marker.md");
    const result = parseChat(content);

    expect(result.compactMarkers).toHaveLength(1);
  });

  it("compactMarkers[0].timestamp equals '2026-03-31T14:30:00.000Z'", () => {
    const content = readFixture("compact-marker.md");
    const result = parseChat(content);

    expect(result.compactMarkers[0].timestamp).toBe("2026-03-31T14:30:00.000Z");
  });

  it("compactMarkers[0].trigger equals 'auto'", () => {
    const content = readFixture("compact-marker.md");
    const result = parseChat(content);

    expect(result.compactMarkers[0].trigger).toBe("auto");
  });

  it("messages array does NOT contain compact-related content", () => {
    const content = readFixture("compact-marker.md");
    const result = parseChat(content);

    // Should have 4 messages: User, Assistant (before compact), User, Assistant (after compact)
    expect(result.messages).toHaveLength(4);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("Hello, how are you?");
    expect(result.messages[1].role).toBe("assistant");
    expect(result.messages[1].content).toBe("I'm doing well! How can I help you today?");
    expect(result.messages[2].role).toBe("user");
    expect(result.messages[2].content).toBe("Let's continue our conversation.");
    expect(result.messages[3].role).toBe("assistant");
    expect(result.messages[3].content).toBe("Of course! What would you like to discuss?");

    // No message should contain compact-related content
    for (const msg of result.messages) {
      expect(msg.content).not.toContain("compacted");
      expect(msg.content).not.toContain("## Compact");
    }
  });

  it("parseChat on simple-chat.md (no compact markers) returns compactMarkers: []", () => {
    const content = readFixture("simple-chat.md");
    const result = parseChat(content);

    expect(result.compactMarkers).toEqual([]);
  });

  it("parseChat with multiple compact markers returns correct count and timestamps", () => {
    const content = `---
title: Multi Compact
project: general
created: "2026-03-31T10:00:00.000Z"
model: claude-sonnet-4-20250514
---

## User

First message

## Assistant

First reply

## Compact

*2026-03-31T12:00:00.000Z -- auto*

Context was compacted. Messages above this marker were summarized by Claude Code.

## User

Second message

## Compact

*2026-03-31T16:00:00.000Z -- manual*

Context was compacted. Messages above this marker were summarized by Claude Code.

## User

Third message

## Assistant

Third reply
`;
    const result = parseChat(content);

    expect(result.compactMarkers).toHaveLength(2);
    expect(result.compactMarkers[0].timestamp).toBe("2026-03-31T12:00:00.000Z");
    expect(result.compactMarkers[0].trigger).toBe("auto");
    expect(result.compactMarkers[1].timestamp).toBe("2026-03-31T16:00:00.000Z");
    expect(result.compactMarkers[1].trigger).toBe("manual");
    expect(result.messages).toHaveLength(5);
  });

  it("compact marker inside a code block is NOT treated as a section boundary", () => {
    const content = `---
title: Code Block Compact
project: general
created: "2026-03-31T10:00:00.000Z"
model: claude-sonnet-4-20250514
---

## User

Show me the format

## Assistant

Here is the format:

\`\`\`markdown
## Compact

*2026-03-31T14:30:00.000Z -- auto*

Context was compacted. Messages above this marker were summarized by Claude Code.
\`\`\`

That's the compact marker format.
`;
    const result = parseChat(content);

    // The ## Compact inside the code block must NOT be recognized as a compact marker
    expect(result.compactMarkers).toEqual([]);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].content).toContain("## Compact");
    expect(result.messages[1].content).toContain("That's the compact marker format.");
  });
});
