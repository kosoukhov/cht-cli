import { describe, it, expect } from "vitest";
import {
  getContextWindowLimit,
  MODEL_CONTEXT_WINDOWS,
  DEFAULT_CONTEXT_WINDOW,
  WARN_THRESHOLD,
  SUMMARIZE_THRESHOLD,
} from "../../src/context/context-window.ts";

describe("constants", () => {
  it("DEFAULT_CONTEXT_WINDOW is 200000", () => {
    expect(DEFAULT_CONTEXT_WINDOW).toBe(200000);
  });

  it("WARN_THRESHOLD is 0.75", () => {
    expect(WARN_THRESHOLD).toBe(0.75);
  });

  it("SUMMARIZE_THRESHOLD is 0.85", () => {
    expect(SUMMARIZE_THRESHOLD).toBe(0.85);
  });
});

describe("MODEL_CONTEXT_WINDOWS", () => {
  it("contains known models", () => {
    expect(MODEL_CONTEXT_WINDOWS["claude-opus-4-6"]).toBe(1_000_000);
    expect(MODEL_CONTEXT_WINDOWS["claude-sonnet-4-6"]).toBe(1_000_000);
    expect(MODEL_CONTEXT_WINDOWS["claude-sonnet-4-20250514"]).toBe(200_000);
    expect(MODEL_CONTEXT_WINDOWS["claude-haiku-4-5-20251001"]).toBe(200_000);
  });
});

describe("getContextWindowLimit", () => {
  it("returns correct limit for claude-sonnet-4-20250514", () => {
    expect(getContextWindowLimit("claude-sonnet-4-20250514")).toBe(200000);
  });

  it("returns correct limit for claude-opus-4-6", () => {
    expect(getContextWindowLimit("claude-opus-4-6")).toBe(1000000);
  });

  it("returns correct limit for claude-sonnet-4-6", () => {
    expect(getContextWindowLimit("claude-sonnet-4-6")).toBe(1000000);
  });

  it("returns correct limit for claude-haiku-4-5-20251001", () => {
    expect(getContextWindowLimit("claude-haiku-4-5-20251001")).toBe(200000);
  });

  it("returns DEFAULT_CONTEXT_WINDOW for unknown model", () => {
    expect(getContextWindowLimit("unknown-model")).toBe(200000);
  });

  it("user override takes precedence over model lookup", () => {
    expect(getContextWindowLimit("claude-opus-4-6", 150000)).toBe(150000);
  });

  it("user override takes precedence even for unknown models", () => {
    expect(getContextWindowLimit("any-model", 150000)).toBe(150000);
  });

  it("handles claude-sonnet-4-5-20250929 from lookup table", () => {
    expect(getContextWindowLimit("claude-sonnet-4-5-20250929")).toBe(200000);
  });
});
