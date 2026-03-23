import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Anthropic SDK before importing modules that use it
const mockStream = {
  _handlers: {} as Record<string, Function>,
  on(event: string, cb: Function) {
    mockStream._handlers[event] = cb;
    return mockStream;
  },
  async finalMessage() {
    // Simulate streaming by firing stored text callbacks
    if (mockStream._handlers["text"]) {
      mockStream._handlers["text"]("Hello");
      mockStream._handlers["text"](" world");
    }
    return {
      content: [{ type: "text" as const, text: "Hello world" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    };
  },
};

const mockMessagesStream = vi.fn().mockReturnValue(mockStream);
const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        stream: mockMessagesStream,
        create: mockMessagesCreate,
      };
      constructor(_opts?: Record<string, unknown>) {}
    },
  };
});

// Import after mocking
const { sendAndStream } = await import("../../src/api/client.ts");
const { generateChatTitle } = await import(
  "../../src/api/title-generator.ts"
);
const { DEFAULT_MODEL } = await import("../../src/markdown/format.ts");

describe("sendAndStream", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    // Reset stream handlers between tests
    mockStream._handlers = {};
    mockMessagesStream.mockReturnValue(mockStream);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("returns StreamResult with text and usage", async () => {
    const result = await sendAndStream([
      { role: "user", content: "Hi" },
    ]);
    expect(result.text).toBe("Hello world");
    expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
  });

  it("streams tokens to stdout", async () => {
    await sendAndStream([{ role: "user", content: "Hi" }]);

    const calls = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain("Hello");
    expect(calls).toContain(" world");
  });

  it("passes system prompt when provided", async () => {
    await sendAndStream(
      [{ role: "user", content: "Hi" }],
      "You are helpful",
    );

    expect(mockMessagesStream).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "You are helpful",
      }),
    );
  });

  it("uses DEFAULT_MODEL when no model specified", async () => {
    await sendAndStream([{ role: "user", content: "Hi" }]);

    expect(mockMessagesStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_MODEL,
      }),
    );
  });
});

describe("generateChatTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns title from Haiku response", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "API Design Discussion" }],
    });

    const title = await generateChatTitle(
      "How do I design an API?",
      "Here are some best practices...",
    );
    expect(title).toBe("API Design Discussion");
  });

  it("returns Untitled Chat on error", async () => {
    mockMessagesCreate.mockRejectedValue(new Error("API error"));

    const title = await generateChatTitle("Hello", "Hi there");
    expect(title).toBe("Untitled Chat");
  });
});
