import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { ChatMessage, ParsedChat } from "../types.ts";
import { chatMessagesToApiMessages } from "../api/messages.ts";
import { summarizeMessages } from "./summarizer.ts";
import { SUMMARIZE_THRESHOLD } from "./context-window.ts";

// D-11: in-memory only, never write summaries to disk

/**
 * Format a parsed chat as readable text for system prompt inclusion.
 * Each message is formatted as "role: content" separated by blank lines.
 * Includes the chat title as a header.
 */
export function formatIncludedChat(chat: ParsedChat): string {
  const title = chat.frontmatter.title || "Untitled Chat";
  const lines: string[] = [`# ${title}`, ""];

  for (const msg of chat.messages) {
    lines.push(`${msg.role}: ${msg.content}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Build system prompt with included chat content wrapped in XML tags.
 * Per D-02: included chat goes in system prompt as background context.
 */
export function buildSystemPromptWithInclude(
  basePrompt: string | undefined,
  includedContent: string,
): string {
  const includeBlock = `<included_chat>
The following is a previous conversation included as background context.
Use this information to inform your responses, but do not confuse it with the current conversation.

${includedContent}
</included_chat>`;

  if (basePrompt) {
    return `${basePrompt}\n\n${includeBlock}`;
  }
  return includeBlock;
}

/**
 * Assemble context for an API call.
 *
 * Orchestrates: system prompt with included chat, message conversion,
 * and auto-summarization when context usage exceeds threshold.
 *
 * D-11: This function operates ONLY on in-memory message arrays.
 * It NEVER writes to disk. The allMessages parameter is NOT mutated.
 */
export async function assembleContext(params: {
  allMessages: ChatMessage[];
  includedChat: ParsedChat | null;
  includedSummary: string | null;
  systemPrompt: string | undefined;
  contextLimit: number;
  model: string;
  lastInputTokens: number;
}): Promise<{
  apiMessages: MessageParam[];
  systemWithInclude: string | undefined;
  summarized: boolean;
  summarizationInfo: { originalCount: number; keptCount: number } | null;
}> {
  const {
    allMessages,
    includedChat,
    includedSummary,
    systemPrompt,
    contextLimit,
    lastInputTokens,
  } = params;

  // D-11: Work on a copy, never mutate input
  const messagesCopy = [...allMessages];

  // Step 1: Build system prompt with included chat if present
  let systemWithInclude: string | undefined = systemPrompt;
  if (includedChat || includedSummary) {
    const content = includedSummary
      ? includedSummary
      : formatIncludedChat(includedChat!);
    systemWithInclude = buildSystemPromptWithInclude(systemPrompt, content);
  }

  // Step 2: Check if summarization is needed
  const usageRatio = lastInputTokens / contextLimit;
  let summarized = false;
  let summarizationInfo: { originalCount: number; keptCount: number } | null =
    null;

  if (usageRatio >= SUMMARIZE_THRESHOLD && messagesCopy.length > 2) {
    // Determine how many recent messages to keep
    // Keep messages that fit within ~40% of context limit
    // Approximate: start with last 10, but ensure at least 2
    const keepCount = Math.min(10, Math.max(2, messagesCopy.length - 1));
    const olderMessages = messagesCopy.slice(0, messagesCopy.length - keepCount);
    const keptMessages = messagesCopy.slice(messagesCopy.length - keepCount);

    if (olderMessages.length > 0) {
      const summary = await summarizeMessages(olderMessages);

      if (summary === "[Summary unavailable]") {
        // Fallback: truncation -- just keep recent messages without summary
        const apiMessages = chatMessagesToApiMessages(keptMessages);
        return {
          apiMessages,
          systemWithInclude,
          summarized: true,
          summarizationInfo: {
            originalCount: olderMessages.length,
            keptCount: keptMessages.length,
          },
        };
      }

      // Build new message array: synthetic summary + kept messages
      const summarizedMessages: ChatMessage[] = [
        {
          role: "user",
          content: `[Previous conversation summary]\n\n${summary}`,
        },
        {
          role: "assistant",
          content:
            "I understand the context from the previous conversation. Please continue.",
        },
        ...keptMessages,
      ];

      const apiMessages = chatMessagesToApiMessages(summarizedMessages);
      summarized = true;
      summarizationInfo = {
        originalCount: olderMessages.length,
        keptCount: keptMessages.length,
      };

      return {
        apiMessages,
        systemWithInclude,
        summarized,
        summarizationInfo,
      };
    }
  }

  // No summarization needed -- convert messages as-is
  const apiMessages = chatMessagesToApiMessages(messagesCopy);

  return {
    apiMessages,
    systemWithInclude,
    summarized,
    summarizationInfo,
  };
}
