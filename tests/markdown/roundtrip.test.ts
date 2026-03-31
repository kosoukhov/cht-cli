import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseChat, parseMessages } from "../../src/markdown/parser.ts";
import { serializeChat } from "../../src/markdown/serializer.ts";
import type { ChatFrontmatter, ChatMessage, CompactMarker } from "../../src/types.ts";

const fixturesDir = resolve(import.meta.dirname, "../fixtures");
function readFixture(name: string): string {
  return readFileSync(resolve(fixturesDir, name), "utf-8");
}

const testFrontmatter: ChatFrontmatter = {
  title: "Round Trip Test",
  project: "general",
  created: "2026-03-20T10:00:00Z",
  model: "claude-sonnet-4-20250514",
};

describe("round-trip fidelity", () => {
  it("simple messages round-trip", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "I'm doing well, thank you!" },
    ];

    const serialized = serializeChat(testFrontmatter, messages);
    const parsed = parseChat(serialized);

    expect(parsed.messages).toEqual(messages);
  });

  it("messages with code blocks round-trip", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Show me TypeScript code" },
      {
        role: "assistant",
        content: `Here's an example:

\`\`\`typescript
function hello() {
  console.log("world");
}
\`\`\`

That's the code.`,
      },
    ];

    const serialized = serializeChat(testFrontmatter, messages);
    const parsed = parseChat(serialized);

    expect(parsed.messages).toEqual(messages);
  });

  it("adversarial content round-trips", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Here is some code:" },
      {
        role: "assistant",
        content: `Look at this:

\`\`\`
## User
## Assistant
Heading-like text inside code blocks
\`\`\`

~~~
## User
More fake headings
~~~

That's the adversarial content.`,
      },
    ];

    const serialized = serializeChat(testFrontmatter, messages);
    const parsed = parseChat(serialized);

    expect(parsed.messages).toEqual(messages);
  });

  it("empty message array round-trips", () => {
    const messages: ChatMessage[] = [];

    const serialized = serializeChat(testFrontmatter, messages);
    const parsed = parseChat(serialized);

    expect(parsed.messages).toEqual(messages);
  });
});

describe("compact marker round-trip", () => {
  it("serialize with compact markers -> parse preserves messages AND compact markers", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "I'm doing well! How can I help you today?" },
      { role: "user", content: "Let's continue our conversation." },
      { role: "assistant", content: "Of course! What would you like to discuss?" },
    ];
    const markers: CompactMarker[] = [
      { timestamp: "2026-03-31T14:30:00.000Z", trigger: "auto" },
    ];
    const sectionOrder = [
      { type: "message" as const, index: 0 },
      { type: "message" as const, index: 1 },
      { type: "compact" as const, index: 0 },
      { type: "message" as const, index: 2 },
      { type: "message" as const, index: 3 },
    ];

    const serialized = serializeChat(testFrontmatter, messages, markers, sectionOrder);
    const parsed = parseChat(serialized);

    expect(parsed.messages).toEqual(messages);
    expect(parsed.compactMarkers).toEqual(markers);
  });

  it("serialize -> parse -> serialize produces identical string", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "Continue" },
    ];
    const markers: CompactMarker[] = [
      { timestamp: "2026-03-31T14:30:00.000Z", trigger: "auto" },
    ];
    const sectionOrder = [
      { type: "message" as const, index: 0 },
      { type: "message" as const, index: 1 },
      { type: "compact" as const, index: 0 },
      { type: "message" as const, index: 2 },
    ];

    const serialized1 = serializeChat(testFrontmatter, messages, markers, sectionOrder);
    const parsed = parseChat(serialized1);
    const serialized2 = serializeChat(
      parsed.frontmatter,
      parsed.messages,
      parsed.compactMarkers,
      parsed._sectionOrder,
    );

    expect(serialized2).toBe(serialized1);
  });

  it("multiple compact markers in sequence preserve order", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "First" },
      { role: "assistant", content: "Reply 1" },
      { role: "user", content: "Second" },
      { role: "user", content: "Third" },
      { role: "assistant", content: "Reply 3" },
    ];
    const markers: CompactMarker[] = [
      { timestamp: "2026-03-31T12:00:00.000Z", trigger: "auto" },
      { timestamp: "2026-03-31T16:00:00.000Z", trigger: "manual" },
    ];
    const sectionOrder = [
      { type: "message" as const, index: 0 },
      { type: "message" as const, index: 1 },
      { type: "compact" as const, index: 0 },
      { type: "message" as const, index: 2 },
      { type: "compact" as const, index: 1 },
      { type: "message" as const, index: 3 },
      { type: "message" as const, index: 4 },
    ];

    const serialized = serializeChat(testFrontmatter, messages, markers, sectionOrder);
    const parsed = parseChat(serialized);

    expect(parsed.compactMarkers).toEqual(markers);
    expect(parsed.messages).toEqual(messages);
    expect(parsed._sectionOrder).toEqual(sectionOrder);
  });

  it("existing round-trip tests still pass (no compact markers = backward compat)", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "I'm doing well, thank you!" },
    ];

    const serialized = serializeChat(testFrontmatter, messages);
    const parsed = parseChat(serialized);

    expect(parsed.messages).toEqual(messages);
    expect(parsed.compactMarkers).toEqual([]);
  });

  it("fixture file compact-marker.md round-trips", () => {
    const content = readFixture("compact-marker.md");
    const parsed = parseChat(content);
    const serialized = serializeChat(
      parsed.frontmatter,
      parsed.messages,
      parsed.compactMarkers,
      parsed._sectionOrder,
    );
    const reparsed = parseChat(serialized);

    expect(reparsed.messages).toEqual(parsed.messages);
    expect(reparsed.compactMarkers).toEqual(parsed.compactMarkers);
    expect(reparsed._sectionOrder).toEqual(parsed._sectionOrder);
  });

  it("compact marker at end of file round-trips correctly", () => {
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

    const serialized = serializeChat(testFrontmatter, messages, markers, sectionOrder);
    const parsed = parseChat(serialized);

    expect(parsed.messages).toEqual(messages);
    expect(parsed.compactMarkers).toEqual(markers);
    expect(parsed._sectionOrder).toEqual(sectionOrder);
  });
});
