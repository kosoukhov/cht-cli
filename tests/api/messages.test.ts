import { describe, it, expect } from "vitest";
import type { ChatMessage } from "../../src/types.ts";
import {
  chatMessagesToApiMessages,
  repairAlternation,
} from "../../src/api/messages.ts";

describe("chatMessagesToApiMessages", () => {
  it("converts clean message array to API format", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];

    const result = chatMessagesToApiMessages(messages);

    expect(result).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("returns empty array for empty input", () => {
    const result = chatMessagesToApiMessages([]);
    expect(result).toEqual([]);
  });

  it("preserves multi-line content in messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "line 1\nline 2\nline 3" },
      { role: "assistant", content: "response\nwith\nnewlines" },
    ];

    const result = chatMessagesToApiMessages(messages);

    expect(result[0].content).toBe("line 1\nline 2\nline 3");
    expect(result[1].content).toBe("response\nwith\nnewlines");
  });
});

describe("repairAlternation", () => {
  it("repairs two consecutive user messages by inserting synthetic assistant", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "first question" },
      { role: "user", content: "second question" },
    ];

    const result = repairAlternation(messages);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: "user", content: "first question" });
    expect(result[1]).toEqual({
      role: "assistant",
      content: "[Response interrupted]",
    });
    expect(result[2]).toEqual({ role: "user", content: "second question" });
  });

  it("returns clean alternating messages unchanged", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "how are you?" },
      { role: "assistant", content: "good!" },
    ];

    const result = repairAlternation(messages);

    expect(result).toEqual(messages);
    expect(result).toHaveLength(4);
  });

  it("repairs messages starting with assistant role", () => {
    const messages: ChatMessage[] = [
      { role: "assistant", content: "I was saying..." },
      { role: "user", content: "go on" },
    ];

    const result = repairAlternation(messages);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      role: "user",
      content: "[Conversation start]",
    });
    expect(result[1]).toEqual({
      role: "assistant",
      content: "I was saying...",
    });
    expect(result[2]).toEqual({ role: "user", content: "go on" });
  });

  it("repairs two consecutive assistant messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "question" },
      { role: "assistant", content: "part 1" },
      { role: "assistant", content: "part 2" },
    ];

    const result = repairAlternation(messages);

    expect(result).toHaveLength(4);
    expect(result[1]).toEqual({ role: "assistant", content: "part 1" });
    expect(result[2]).toEqual({ role: "user", content: "[Continue]" });
    expect(result[3]).toEqual({ role: "assistant", content: "part 2" });
  });

  it("does not mutate the original array", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "first" },
      { role: "user", content: "second" },
    ];
    const originalLength = messages.length;

    repairAlternation(messages);

    expect(messages).toHaveLength(originalLength);
    expect(messages[0].content).toBe("first");
    expect(messages[1].content).toBe("second");
  });
});
