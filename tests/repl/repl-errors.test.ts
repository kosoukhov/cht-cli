import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { formatApiError } from "../../src/repl/repl.ts";

const headers = new Headers();

describe("formatApiError", () => {
  it("formats AuthenticationError", () => {
    const err = new Anthropic.AuthenticationError(401, {}, "auth failed", headers);
    expect(formatApiError(err)).toBe(
      "Error: Invalid API key. Set ANTHROPIC_API_KEY environment variable.",
    );
  });

  it("formats RateLimitError", () => {
    const err = new Anthropic.RateLimitError(429, {}, "rate limited", headers);
    expect(formatApiError(err)).toBe(
      "Error: Rate limited. Wait a moment and try again.",
    );
  });

  it("formats APIError with status 529 (overloaded)", () => {
    const err = new Anthropic.APIError(529, {}, "overloaded", headers);
    expect(formatApiError(err)).toBe(
      "Error: Claude is overloaded. Try again in a few seconds.",
    );
  });

  it("formats APIError with status 408 (timeout)", () => {
    const err = new Anthropic.APIError(408, {}, "timeout", headers);
    expect(formatApiError(err)).toBe(
      "Error: Request timed out. Check your connection and try again.",
    );
  });

  it("formats APIError with other status (e.g. 500)", () => {
    const err = new Anthropic.APIError(500, {}, "internal error", headers);
    expect(formatApiError(err)).toBe(
      "Error: API request failed (500). Try again or check https://status.anthropic.com",
    );
  });

  it("formats network error with fetch in message", () => {
    const err = new Error("fetch failed");
    expect(formatApiError(err)).toBe(
      "Error: Could not reach Claude API. Check your internet connection.",
    );
  });

  it("formats unknown error with fallback", () => {
    const err = new Error("something weird");
    expect(formatApiError(err)).toBe("Error: something weird");
  });
});
