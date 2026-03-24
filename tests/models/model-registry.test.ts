import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MODEL_ALIASES,
  resolveModelAlias,
  getModelAlias,
  listAvailableModels,
  resolveDefaultModel,
  formatModelListEntry,
  type ModelEntry,
} from "../../src/models/model-registry.ts";

describe("MODEL_ALIASES", () => {
  it("maps 'sonnet' to claude-sonnet-4-6", () => {
    expect(MODEL_ALIASES.sonnet).toBe("claude-sonnet-4-6");
  });

  it("maps 'opus' to claude-opus-4-6", () => {
    expect(MODEL_ALIASES.opus).toBe("claude-opus-4-6");
  });

  it("maps 'haiku' to claude-haiku-4-5", () => {
    expect(MODEL_ALIASES.haiku).toBe("claude-haiku-4-5");
  });
});

describe("resolveModelAlias", () => {
  it("resolves 'sonnet' to claude-sonnet-4-6", () => {
    expect(resolveModelAlias("sonnet")).toBe("claude-sonnet-4-6");
  });

  it("resolves 'opus' to claude-opus-4-6", () => {
    expect(resolveModelAlias("opus")).toBe("claude-opus-4-6");
  });

  it("resolves 'haiku' to claude-haiku-4-5", () => {
    expect(resolveModelAlias("haiku")).toBe("claude-haiku-4-5");
  });

  it("is case-insensitive: 'Sonnet' -> claude-sonnet-4-6", () => {
    expect(resolveModelAlias("Sonnet")).toBe("claude-sonnet-4-6");
  });

  it("is case-insensitive: 'OPUS' -> claude-opus-4-6", () => {
    expect(resolveModelAlias("OPUS")).toBe("claude-opus-4-6");
  });

  it("passes through full model IDs unchanged", () => {
    expect(resolveModelAlias("claude-sonnet-4-20250514")).toBe(
      "claude-sonnet-4-20250514",
    );
  });

  it("passes through unknown model names unchanged", () => {
    expect(resolveModelAlias("unknown-model")).toBe("unknown-model");
  });
});

describe("getModelAlias", () => {
  it("returns 'sonnet' for claude-sonnet-4-6", () => {
    expect(getModelAlias("claude-sonnet-4-6")).toBe("sonnet");
  });

  it("returns 'opus' for claude-opus-4-6", () => {
    expect(getModelAlias("claude-opus-4-6")).toBe("opus");
  });

  it("returns 'haiku' for claude-haiku-4-5", () => {
    expect(getModelAlias("claude-haiku-4-5")).toBe("haiku");
  });

  it("returns undefined for models without an alias", () => {
    expect(getModelAlias("claude-sonnet-4-20250514")).toBeUndefined();
  });
});

describe("listAvailableModels", () => {
  function createMockClient(models: unknown[], shouldThrow = false) {
    return {
      models: {
        list: shouldThrow
          ? () => {
              throw new Error("API error");
            }
          : (_opts: unknown) => {
              // Return an async iterable
              return {
                async *[Symbol.asyncIterator]() {
                  for (const model of models) {
                    yield model;
                  }
                },
              };
            },
      },
    } as any;
  }

  it("returns ModelEntry[] from API filtered to claude-* models", async () => {
    const mockModels = [
      {
        id: "claude-sonnet-4-6",
        display_name: "Claude Sonnet 4.6",
        max_input_tokens: 1_000_000,
        type: "model",
      },
      {
        id: "claude-haiku-4-5",
        display_name: "Claude Haiku 4.5",
        max_input_tokens: 200_000,
        type: "model",
      },
      {
        id: "text-embedding-3-small",
        display_name: "Embedding Model",
        max_input_tokens: 8192,
        type: "model",
      },
    ];

    const client = createMockClient(mockModels);
    const result = await listAvailableModels(client);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      contextWindow: 1_000_000,
      alias: "sonnet",
    });
    expect(result[1]).toEqual({
      id: "claude-haiku-4-5",
      displayName: "Claude Haiku 4.5",
      contextWindow: 200_000,
      alias: "haiku",
    });
  });

  it("filters out models with null max_input_tokens", async () => {
    const mockModels = [
      {
        id: "claude-sonnet-4-6",
        display_name: "Claude Sonnet 4.6",
        max_input_tokens: 1_000_000,
        type: "model",
      },
      {
        id: "claude-old-model",
        display_name: "Claude Old",
        max_input_tokens: null,
        type: "model",
      },
    ];

    const client = createMockClient(mockModels);
    const result = await listAvailableModels(client);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("claude-sonnet-4-6");
  });

  it("filters out models with 0 max_input_tokens", async () => {
    const mockModels = [
      {
        id: "claude-sonnet-4-6",
        display_name: "Claude Sonnet 4.6",
        max_input_tokens: 1_000_000,
        type: "model",
      },
      {
        id: "claude-zero-model",
        display_name: "Claude Zero",
        max_input_tokens: 0,
        type: "model",
      },
    ];

    const client = createMockClient(mockModels);
    const result = await listAvailableModels(client);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("claude-sonnet-4-6");
  });

  it("falls back to hardcoded MODEL_CONTEXT_WINDOWS when API throws", async () => {
    const client = createMockClient([], true);
    const result = await listAvailableModels(client);

    // Should have entries from MODEL_CONTEXT_WINDOWS
    expect(result.length).toBeGreaterThan(0);
    // Check a known entry exists
    const sonnet = result.find((m) => m.id === "claude-sonnet-4-6");
    expect(sonnet).toBeDefined();
    expect(sonnet!.contextWindow).toBe(1_000_000);
    expect(sonnet!.alias).toBe("sonnet");
  });

  it("populates alias field via getModelAlias()", async () => {
    const mockModels = [
      {
        id: "claude-opus-4-6",
        display_name: "Claude Opus 4.6",
        max_input_tokens: 1_000_000,
        type: "model",
      },
      {
        id: "claude-sonnet-4-20250514",
        display_name: "Claude Sonnet 4 (May 2025)",
        max_input_tokens: 200_000,
        type: "model",
      },
    ];

    const client = createMockClient(mockModels);
    const result = await listAvailableModels(client);

    expect(result[0].alias).toBe("opus");
    expect(result[1].alias).toBeUndefined();
  });
});

describe("resolveDefaultModel", () => {
  const originalEnv = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = originalEnv;
    } else {
      delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
    }
  });

  it("returns resolved alias from flagModel when provided", () => {
    expect(resolveDefaultModel({ flagModel: "opus" })).toBe("claude-opus-4-6");
  });

  it("flag takes priority over config", () => {
    expect(
      resolveDefaultModel({
        flagModel: "sonnet",
        configModel: "claude-opus-4-6",
      }),
    ).toBe("claude-sonnet-4-6");
  });

  it("returns configModel when no flag", () => {
    expect(
      resolveDefaultModel({
        flagModel: undefined,
        configModel: "claude-opus-4-6",
      }),
    ).toBe("claude-opus-4-6");
  });

  it("resolves alias in configModel", () => {
    expect(
      resolveDefaultModel({
        flagModel: undefined,
        configModel: "haiku",
      }),
    ).toBe("claude-haiku-4-5");
  });

  it("returns env var when no flag and no config", () => {
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = "claude-custom-model";
    expect(
      resolveDefaultModel({
        flagModel: undefined,
        configModel: undefined,
      }),
    ).toBe("claude-custom-model");
  });

  it("returns hardcoded fallback as last resort", () => {
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
    expect(
      resolveDefaultModel({
        flagModel: undefined,
        configModel: undefined,
      }),
    ).toBe("claude-sonnet-4-20250514");
  });
});

describe("formatModelListEntry", () => {
  it("formats model with alias", () => {
    const entry: ModelEntry = {
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      contextWindow: 1_000_000,
      alias: "sonnet",
    };
    expect(formatModelListEntry(entry)).toBe(
      "claude-sonnet-4-6 (sonnet)  1.0M context",
    );
  });

  it("formats model without alias", () => {
    const entry: ModelEntry = {
      id: "claude-sonnet-4-20250514",
      displayName: "Claude Sonnet 4 (May 2025)",
      contextWindow: 200_000,
    };
    expect(formatModelListEntry(entry)).toBe(
      "claude-sonnet-4-20250514  200.0k context",
    );
  });
});
