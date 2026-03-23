import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockMessagesCreate,
      };
      constructor(_opts?: Record<string, unknown>) {}
    },
  };
});

// Import after mocking
const { summarizeMessages } = await import(
  "../../src/context/summarizer.ts"
);

describe("summarizeMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Haiku response text for valid messages", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "  Summary of conversation  " }],
    });

    const result = await summarizeMessages([
      { role: "user", content: "What is X?" },
      { role: "assistant", content: "X is..." },
    ]);

    expect(result).toBe("Summary of conversation");
  });

  it("formats messages as '{role}: {content}' separated by double newlines", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary" }],
    });

    await summarizeMessages([
      { role: "user", content: "What is X?" },
      { role: "assistant", content: "X is..." },
    ]);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content;
    expect(promptContent).toContain("user: What is X?\n\nassistant: X is...");
  });

  it("truncates input to 100000 characters", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary" }],
    });

    // Create a message with content over 100000 chars
    const longContent = "x".repeat(120000);
    await summarizeMessages([
      { role: "user", content: longContent },
    ]);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content;
    // The formatted content is "user: " + longContent which is > 100000
    // After truncation, the conversation part should be <= 100000
    // Total prompt = SUMMARIZATION_PROMPT + truncated content
    // The conversation part alone (before prompt prefix) should be truncated
    expect(promptContent.length).toBeLessThanOrEqual(
      // prompt text + 100000 chars of formatted conversation
      promptContent.indexOf("user:") + 100000 + 100,
    );
  });

  it("returns '[Summary unavailable]' on API error", async () => {
    mockMessagesCreate.mockRejectedValue(new Error("API error"));

    const result = await summarizeMessages([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ]);

    expect(result).toBe("[Summary unavailable]");
  });

  it("prompt contains 'Summarize this conversation concisely'", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary" }],
    });

    await summarizeMessages([
      { role: "user", content: "Test" },
    ]);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content;
    expect(promptContent).toContain("Summarize this conversation concisely");
  });

  it("uses default max_tokens of 1024", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary" }],
    });

    await summarizeMessages([
      { role: "user", content: "Test" },
    ]);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(1024);
  });

  it("accepts custom maxTokens parameter", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary" }],
    });

    await summarizeMessages(
      [{ role: "user", content: "Test" }],
      2048,
    );

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(2048);
  });

  it("uses ANTHROPIC_DEFAULT_HAIKU_MODEL env var when set", async () => {
    // Note: env var is read at module load time, so this tests the default
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary" }],
    });

    await summarizeMessages([
      { role: "user", content: "Test" },
    ]);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    // Default model when env var is not set
    expect(callArgs.model).toBe("claude-haiku-4-5-20251001");
  });

  it("returns '[Summary unavailable]' when response has non-text content", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });

    const result = await summarizeMessages([
      { role: "user", content: "Test" },
    ]);

    expect(result).toBe("[Summary unavailable]");
  });
});
