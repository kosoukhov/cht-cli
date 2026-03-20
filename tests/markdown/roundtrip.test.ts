import { describe, it, expect } from "vitest";
import { parseChat, parseMessages } from "../../src/markdown/parser.ts";
import { serializeChat } from "../../src/markdown/serializer.ts";
import type { ChatFrontmatter, ChatMessage } from "../../src/types.ts";

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
