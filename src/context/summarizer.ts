import { getClient } from "../api/client.ts";
import type { ChatMessage } from "../types.ts";

const SUMMARIZATION_MODEL =
  process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || "claude-haiku-4-5-20251001";

const SUMMARIZATION_PROMPT = `Summarize this conversation concisely. Preserve:
- Key decisions and conclusions
- Code snippets and technical details
- Action items and next steps
- Important context that would be needed to continue the discussion

Be thorough but concise. Format as bullet points grouped by topic.

Conversation:
`;

/**
 * Summarize a conversation using Haiku.
 * Returns a concise summary string, or "[Summary unavailable]" on any error.
 *
 * D-11: This is in-memory only -- never writes summaries to disk.
 * Pitfall 5: Returns fallback, does NOT throw -- but caller is responsible
 * for warning the user that summarization failed.
 */
export async function summarizeMessages(
  messages: ChatMessage[],
  maxTokens: number = 1024,
): Promise<string> {
  try {
    const client = getClient();
    const formatted = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");
    const truncated = formatted.slice(0, 100_000);

    const response = await client.messages.create({
      model: SUMMARIZATION_MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: SUMMARIZATION_PROMPT + truncated,
        },
      ],
    });

    const text = response.content[0];
    if (text.type === "text") return text.text.trim();
    return "[Summary unavailable]";
  } catch {
    // D-11/Pitfall 5: return fallback, caller handles user warning
    return "[Summary unavailable]";
  }
}
