import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { readChat, appendMessage, updateFrontmatter } from "../store/chat-store.ts";
import { resolveSystemPrompt } from "../store/project-store.ts";
import { sendAndStream } from "../api/client.ts";
import { chatMessagesToApiMessages } from "../api/messages.ts";
import { generateChatTitle } from "../api/title-generator.ts";
import { parseUserInput } from "./input-parser.ts";
import type { ChatMessage } from "../types.ts";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

/**
 * Format an API error for display to the user.
 * Per UI-SPEC "Error States" -- exact strings required.
 */
export function formatApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Error: Invalid API key. Set ANTHROPIC_API_KEY environment variable.";
  }

  if (err instanceof Anthropic.RateLimitError) {
    return "Error: Rate limited. Wait a moment and try again.";
  }

  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) {
      return "Error: Claude is overloaded. Try again in a few seconds.";
    }
    if (err.status === 408) {
      return "Error: Request timed out. Check your connection and try again.";
    }
    return `Error: API request failed (${err.status}). Try again or check https://status.anthropic.com`;
  }

  if (err instanceof Error) {
    if (err.message.toLowerCase().includes("fetch")) {
      return "Error: Could not reach Claude API. Check your internet connection.";
    }
    return `Error: ${err.message}`;
  }

  return `Error: ${String(err)}`;
}

/**
 * Run the interactive REPL loop for a chat.
 *
 * Handles:
 * - User input with file attachment detection
 * - Streaming Claude responses to stdout
 * - Atomic message persistence (user immediate, assistant after completion)
 * - Ctrl+C during streaming (abort) vs during input (exit)
 * - Auto-title generation after first exchange
 * - Error formatting per UI-SPEC
 */
export async function runRepl(
  chatPath: string,
  storageRoot: string,
): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  // Load existing chat state
  const chat = await readChat(chatPath);
  const messages: ChatMessage[] = [...chat.messages];
  const systemPrompt = await resolveSystemPrompt(
    storageRoot,
    chat.frontmatter.project,
    chat.frontmatter,
  );

  let isFirstExchange = messages.length === 0;
  let isStreaming = false;
  let currentAbortController: AbortController | null = null;

  // Welcome banner (exact UI-SPEC strings)
  if (messages.length === 0) {
    console.log("Chat: (untitled)");
    console.log("Type your message. /exit or Ctrl+C to quit.");
  } else {
    console.log(`Chat: ${chat.frontmatter.title}`);
    console.log(
      `${messages.length} messages loaded. Type your message. /exit or Ctrl+C to quit.`,
    );
  }
  console.log();

  // Ctrl+C handling: SIGINT listener
  const sigintHandler = () => {
    if (isStreaming && currentAbortController) {
      currentAbortController.abort();
    } else {
      // At prompt -- exit gracefully
      rl.close();
      process.exit(0);
    }
  };
  process.on("SIGINT", sigintHandler);

  try {
    while (true) {
      let userInput: string;
      try {
        userInput = await rl.question("> ");
      } catch {
        // readline closed (Ctrl+C at prompt or EOF)
        break;
      }

      if (userInput.trim() === "/exit") break;
      if (userInput.trim() === "") continue;

      // Parse input for file references
      const parsed = await parseUserInput(userInput);

      // Print attachment errors to stderr
      for (const err of parsed.errors) {
        console.error(err);
      }

      // Determine content to store and send
      const userMarkdownContent = parsed.markdownContent || userInput;

      // Persist user message immediately (D-06)
      messages.push({ role: "user", content: userMarkdownContent });
      await appendMessage(chatPath, "user", userMarkdownContent);

      // Build API messages array
      const apiMessages: MessageParam[] = chatMessagesToApiMessages(messages);

      // If attachments had API content blocks (images, etc.), replace last message content
      if (parsed.apiContent.length > 0) {
        apiMessages[apiMessages.length - 1] = {
          role: "user",
          content: parsed.apiContent,
        };
      }

      // Stream Claude response
      isStreaming = true;
      currentAbortController = new AbortController();
      try {
        const responseText = await sendAndStream(
          apiMessages,
          systemPrompt,
          chat.frontmatter.model,
        );
        isStreaming = false;
        currentAbortController = null;

        // Persist assistant response after completion (D-06)
        messages.push({ role: "assistant", content: responseText });
        await appendMessage(chatPath, "assistant", responseText);

        // Auto-title after first exchange (D-02)
        if (isFirstExchange) {
          isFirstExchange = false;
          generateChatTitle(userInput, responseText)
            .then((title) => updateFrontmatter(chatPath, { title }))
            .catch(() => {
              // Silent per UI-SPEC
            });
        }
      } catch (err: unknown) {
        isStreaming = false;
        currentAbortController = null;

        // Check if abort error (Ctrl+C during streaming)
        if (isAbortError(err)) {
          console.log("[Response cancelled]");
          continue;
        }

        console.error(formatApiError(err));
      }
    }
  } finally {
    process.removeListener("SIGINT", sigintHandler);
    rl.close();
  }
}

/**
 * Check if an error is an abort/cancellation error.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    if (err.message.includes("aborted")) return true;
  }
  if (err instanceof Anthropic.APIUserAbortError) return true;
  return false;
}
