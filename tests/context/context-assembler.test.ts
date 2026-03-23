import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChatMessage, ParsedChat } from "../../src/types.ts";

// Mock the summarizer module
vi.mock("../../src/context/summarizer.ts", () => ({
  summarizeMessages: vi.fn().mockResolvedValue("Mocked summary of conversation"),
}));

// Mock the Anthropic SDK (needed by modules importing client)
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { stream: vi.fn(), create: vi.fn() };
  },
}));

const {
  formatIncludedChat,
  buildSystemPromptWithInclude,
  assembleContext,
} = await import("../../src/context/context-assembler.ts");

const { summarizeMessages } = await import("../../src/context/summarizer.ts");
const mockedSummarize = vi.mocked(summarizeMessages);

function makeParsedChat(
  title: string,
  messages: ChatMessage[],
): ParsedChat {
  return {
    frontmatter: {
      title,
      project: "test",
      created: "2026-01-01T00:00:00Z",
      model: "claude-sonnet-4-20250514",
    },
    messages,
  };
}

describe("formatIncludedChat", () => {
  it("formats messages as 'role: content' separated by blank lines", () => {
    const chat = makeParsedChat("Test Chat", [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);

    const result = formatIncludedChat(chat);
    expect(result).toContain("user: Hello");
    expect(result).toContain("assistant: Hi there");
  });

  it("includes chat title as header", () => {
    const chat = makeParsedChat("My Chat Title", [
      { role: "user", content: "Test" },
    ]);

    const result = formatIncludedChat(chat);
    expect(result).toContain("# My Chat Title");
  });

  it("uses 'Untitled Chat' when title is empty", () => {
    const chat = makeParsedChat("", [
      { role: "user", content: "Test" },
    ]);

    const result = formatIncludedChat(chat);
    expect(result).toContain("# Untitled Chat");
  });
});

describe("buildSystemPromptWithInclude", () => {
  it("appends include block after base prompt", () => {
    const result = buildSystemPromptWithInclude(
      "You are a helpful assistant.",
      "user: Hello\n\nassistant: Hi",
    );

    expect(result).toContain("You are a helpful assistant.");
    expect(result).toContain("<included_chat>");
    expect(result).toContain("</included_chat>");
    expect(result).toContain("user: Hello");
    // Base prompt should come before the include block
    const baseIdx = result.indexOf("You are a helpful assistant.");
    const includeIdx = result.indexOf("<included_chat>");
    expect(baseIdx).toBeLessThan(includeIdx);
  });

  it("returns just the include block when no base prompt", () => {
    const result = buildSystemPromptWithInclude(
      undefined,
      "user: Hello\n\nassistant: Hi",
    );

    expect(result).toContain("<included_chat>");
    expect(result).toContain("</included_chat>");
    expect(result).toContain("user: Hello");
    expect(result).not.toContain("undefined");
  });

  it("contains XML tags with context instructions", () => {
    const result = buildSystemPromptWithInclude(
      "Base prompt",
      "some content",
    );

    expect(result).toContain("<included_chat>");
    expect(result).toContain("</included_chat>");
    expect(result).toContain(
      "do not confuse it with the current conversation",
    );
  });
});

describe("assembleContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSummarize.mockResolvedValue("Mocked summary of conversation");
  });

  it("returns messages as-is with no included chat and low usage", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const result = await assembleContext({
      allMessages: messages,
      includedChat: null,
      includedSummary: null,
      systemPrompt: "Be helpful",
      contextLimit: 200_000,
      model: "claude-sonnet-4-20250514",
      lastInputTokens: 1000,
    });

    expect(result.summarized).toBe(false);
    expect(result.summarizationInfo).toBeNull();
    expect(result.systemWithInclude).toBe("Be helpful");
    expect(result.apiMessages).toHaveLength(2);
    expect(result.apiMessages[0]).toEqual({ role: "user", content: "Hello" });
  });

  it("injects included chat into system prompt", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
    ];
    const includedChat = makeParsedChat("Old Chat", [
      { role: "user", content: "Old question" },
      { role: "assistant", content: "Old answer" },
    ]);

    const result = await assembleContext({
      allMessages: messages,
      includedChat,
      includedSummary: null,
      systemPrompt: "Be helpful",
      contextLimit: 200_000,
      model: "claude-sonnet-4-20250514",
      lastInputTokens: 1000,
    });

    expect(result.systemWithInclude).toContain("<included_chat>");
    expect(result.systemWithInclude).toContain("Old question");
    expect(result.systemWithInclude).toContain("Old answer");
    expect(result.systemWithInclude).toContain("Be helpful");
  });

  it("uses pre-computed includedSummary when provided", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
    ];
    const includedChat = makeParsedChat("Old Chat", [
      { role: "user", content: "Old question" },
    ]);

    const result = await assembleContext({
      allMessages: messages,
      includedChat,
      includedSummary: "This is a pre-computed summary",
      systemPrompt: undefined,
      contextLimit: 200_000,
      model: "claude-sonnet-4-20250514",
      lastInputTokens: 1000,
    });

    // Should use the pre-computed summary, not the full chat content
    expect(result.systemWithInclude).toContain("This is a pre-computed summary");
    expect(result.systemWithInclude).toContain("<included_chat>");
  });

  it("triggers summarization when usage >= 85%", async () => {
    // Create enough messages that some can be summarized
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push({ role: "user", content: `Question ${i}` });
      messages.push({ role: "assistant", content: `Answer ${i}` });
    }

    const result = await assembleContext({
      allMessages: messages,
      includedChat: null,
      includedSummary: null,
      systemPrompt: undefined,
      contextLimit: 200_000,
      model: "claude-sonnet-4-20250514",
      lastInputTokens: 180_000, // 90% -- above 85% threshold
    });

    expect(result.summarized).toBe(true);
    expect(result.summarizationInfo).not.toBeNull();
    expect(result.summarizationInfo!.originalCount).toBeGreaterThan(0);
    expect(result.summarizationInfo!.keptCount).toBeGreaterThan(0);
    expect(mockedSummarize).toHaveBeenCalled();
  });

  it("does NOT mutate input allMessages array (D-11 verification)", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "How are you?" },
    ];

    const originalLength = messages.length;
    const originalMessages = messages.map((m) => ({ ...m }));

    await assembleContext({
      allMessages: messages,
      includedChat: null,
      includedSummary: null,
      systemPrompt: undefined,
      contextLimit: 200_000,
      model: "claude-sonnet-4-20250514",
      lastInputTokens: 1000,
    });

    expect(messages).toHaveLength(originalLength);
    expect(messages).toEqual(originalMessages);
  });

  it("does NOT mutate input when summarization is triggered", async () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push({ role: "user", content: `Question ${i}` });
      messages.push({ role: "assistant", content: `Answer ${i}` });
    }

    const originalLength = messages.length;
    const originalFirst = { ...messages[0] };

    await assembleContext({
      allMessages: messages,
      includedChat: null,
      includedSummary: null,
      systemPrompt: undefined,
      contextLimit: 200_000,
      model: "claude-sonnet-4-20250514",
      lastInputTokens: 180_000,
    });

    expect(messages).toHaveLength(originalLength);
    expect(messages[0]).toEqual(originalFirst);
  });

  it("falls back to truncation on summarization failure", async () => {
    mockedSummarize.mockResolvedValue("[Summary unavailable]");

    const messages: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push({ role: "user", content: `Question ${i}` });
      messages.push({ role: "assistant", content: `Answer ${i}` });
    }

    const result = await assembleContext({
      allMessages: messages,
      includedChat: null,
      includedSummary: null,
      systemPrompt: undefined,
      contextLimit: 200_000,
      model: "claude-sonnet-4-20250514",
      lastInputTokens: 180_000,
    });

    expect(result.summarized).toBe(true);
    expect(result.summarizationInfo).not.toBeNull();
    // On failure, the API messages should contain only the kept messages (no summary prefix)
    // The returned messages should be fewer than the original 40
    expect(result.apiMessages.length).toBeLessThan(messages.length);
  });

  it("does not summarize with only 2 messages even if over threshold", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const result = await assembleContext({
      allMessages: messages,
      includedChat: null,
      includedSummary: null,
      systemPrompt: undefined,
      contextLimit: 200_000,
      model: "claude-sonnet-4-20250514",
      lastInputTokens: 180_000,
    });

    // With only 2 messages, summarization should not trigger
    expect(result.summarized).toBe(false);
    expect(mockedSummarize).not.toHaveBeenCalled();
  });
});
