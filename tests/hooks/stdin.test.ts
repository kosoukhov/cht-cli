import { describe, it, expect } from "vitest";
import { UserPromptInput, StopInput, PostCompactInput, SessionEndInput } from "../../src/hooks/stdin.ts";

describe("stdin Zod schemas", () => {
  it("UserPromptInput validates correct input", () => {
    const result = UserPromptInput.safeParse({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      prompt: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("UserPromptInput rejects wrong event name", () => {
    const result = UserPromptInput.safeParse({
      session_id: "s1",
      hook_event_name: "Stop",
      prompt: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("UserPromptInput passes through extra fields", () => {
    const result = UserPromptInput.safeParse({
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      prompt: "hello",
      extra_field: "should not cause error",
    });
    expect(result.success).toBe(true);
  });

  it("StopInput validates correct input with nullable message", () => {
    const result = StopInput.safeParse({
      session_id: "s1",
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message: null,
    });
    expect(result.success).toBe(true);
  });

  it("StopInput validates with string message", () => {
    const result = StopInput.safeParse({
      session_id: "s1",
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message: "Hi there",
    });
    expect(result.success).toBe(true);
  });

  it("PostCompactInput validates auto trigger", () => {
    const result = PostCompactInput.safeParse({
      session_id: "s1",
      hook_event_name: "PostCompact",
      trigger: "auto",
    });
    expect(result.success).toBe(true);
  });

  it("PostCompactInput validates manual trigger", () => {
    const result = PostCompactInput.safeParse({
      session_id: "s1",
      hook_event_name: "PostCompact",
      trigger: "manual",
    });
    expect(result.success).toBe(true);
  });

  it("PostCompactInput rejects invalid trigger", () => {
    const result = PostCompactInput.safeParse({
      session_id: "s1",
      hook_event_name: "PostCompact",
      trigger: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("SessionEndInput validates correct input", () => {
    const result = SessionEndInput.safeParse({
      session_id: "s1",
      hook_event_name: "SessionEnd",
    });
    expect(result.success).toBe(true);
  });
});
