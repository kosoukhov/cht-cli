import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { ChatMessage } from "../types.ts";

/**
 * Repairs message alternation violations required by the Claude API.
 * Ensures messages alternate between user and assistant roles.
 * Returns a new array -- does not mutate the input.
 */
export function repairAlternation(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return [];

  const repaired: ChatMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (i === 0 && msg.role === "assistant") {
      // First message is assistant -- prepend synthetic user message
      repaired.push({ role: "user", content: "[Conversation start]" });
    }

    if (i > 0) {
      const prev = repaired[repaired.length - 1];
      if (prev.role === msg.role) {
        // Two consecutive same-role messages -- insert synthetic opposite
        if (msg.role === "user") {
          repaired.push({
            role: "assistant",
            content: "[Response interrupted]",
          });
        } else {
          repaired.push({ role: "user", content: "[Continue]" });
        }
      }
    }

    repaired.push({ role: msg.role, content: msg.content });
  }

  return repaired;
}

/**
 * Converts ChatMessage[] (from readChat().messages) to MessageParam[]
 * for the Anthropic API. Applies alternation repair first.
 */
export function chatMessagesToApiMessages(
  messages: ChatMessage[],
): MessageParam[] {
  const repaired = repairAlternation(messages);
  return repaired.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
