import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { readChat, appendMessage, updateFrontmatter, deleteChat, archiveChat } from "../store/chat-store.ts";
import { resolveSystemPrompt, readProjectConfig } from "../store/project-store.ts";
import { sendAndStream, getClient } from "../api/client.ts";
import { chatMessagesToApiMessages } from "../api/messages.ts";
import { generateChatTitle } from "../api/title-generator.ts";
import { parseUserInput } from "./input-parser.ts";
import { TokenTracker, formatTokenCount } from "../context/token-tracker.ts";
import { getContextWindowLimit } from "../context/context-window.ts";
import { assembleContext } from "../context/context-assembler.ts";
import { summarizeMessages } from "../context/summarizer.ts";
import { searchChats, formatSearchResults } from "../search/search.ts";
import { listChats, readChat as readChatFile } from "../store/chat-store.ts";
import { resolveModelAlias, listAvailableModels, formatModelListEntry } from "../models/model-registry.ts";
import type { ChatMessage, ParsedChat } from "../types.ts";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

/**
 * Format a date as a relative string per UI-SPEC:
 * - 0 days: "today"
 * - 1 day: "yesterday"
 * - 2-7 days: "{n} days ago"
 * - >7 days: YYYY-MM-DD
 */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return `${diffDays} days ago`;
  return date.toISOString().slice(0, 10);
}

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
 * - /include, /search, /tokens commands (Phase 3)
 * - Token usage display after every response (Phase 3)
 * - Context warnings and auto-summarization (Phase 3)
 */
export async function runRepl(
  chatPath: string,
  storageRoot: string,
  options?: { initialInclude?: { chatPath: string; title: string } },
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

  // Read project config for context_window override (D-07)
  const projectConfig = await readProjectConfig(storageRoot, chat.frontmatter.project);
  let contextLimit = getContextWindowLimit(
    chat.frontmatter.model || "claude-sonnet-4-20250514",
    projectConfig.context_window,
  );
  const tracker = new TokenTracker(contextLimit);

  // Included chat state (D-01)
  let includedChat: ParsedChat | null = null;
  let includedSummary: string | null = null;
  let includedTitle: string | null = null;

  // Handle initial include from --include flag
  if (options?.initialInclude) {
    try {
      const loadedChat = await readChatFile(options.initialInclude.chatPath);
      const chatContent = loadedChat.messages.map((m) => m.content).join(" ");
      const estimatedTokens = Math.round(chatContent.length / 4);
      const includeBudget = contextLimit * 0.3;

      if (estimatedTokens > includeBudget) {
        // D-13: summarize included chat
        includedSummary = await summarizeMessages(loadedChat.messages);
        includedChat = loadedChat;
        includedTitle = options.initialInclude.title;
        const summaryTokens = Math.round(includedSummary.length / 4);
        console.log(
          `Included: ${options.initialInclude.title} (${loadedChat.messages.length} messages, summarized to ~${formatTokenCount(summaryTokens)} tokens)`,
        );
      } else {
        includedChat = loadedChat;
        includedSummary = null;
        includedTitle = options.initialInclude.title;
        console.log(
          `Included: ${options.initialInclude.title} (${loadedChat.messages.length} messages, ~${formatTokenCount(estimatedTokens)} tokens)`,
        );
      }
    } catch {
      console.error(
        `Error: Could not read chat "${options.initialInclude.title}". File may have been moved or deleted.`,
      );
    }
  }

  let isFirstExchange = messages.length === 0;
  let isStreaming = false;
  let currentAbortController: AbortController | null = null;

  // Welcome banner (exact UI-SPEC strings)
  if (messages.length === 0) {
    console.log("Chat: (untitled)");
  } else {
    console.log(`Chat: ${chat.frontmatter.title}`);
    console.log(
      `${messages.length} messages loaded. Type your message. /exit or Ctrl+C to quit.`,
    );
  }

  // Show included chat info in welcome banner
  if (includedTitle && messages.length === 0) {
    console.log("Type your message. /exit or Ctrl+C to quit.");
  } else if (messages.length === 0) {
    console.log("Type your message. /exit or Ctrl+C to quit.");
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

      // /delete command (D-01, D-02, D-03 per CONTEXT.md)
      if (userInput.trim() === "/delete") {
        const title = chat.frontmatter.title || "(untitled)";
        const count = messages.length;
        console.log(`Delete "${title}" (${count} messages)?`);
        const confirm = await rl.question("This cannot be undone. [y/N] ");
        if (confirm.trim().toLowerCase() === "y") {
          try {
            await deleteChat(chatPath);
            console.log(`Deleted: ${title}`);
            console.log("Session ended.");
          } catch {
            console.error("Error: Chat file not found. It may have already been deleted.");
          }
          break;
        }
        console.log("Delete cancelled.");
        continue;
      }

      // /archive command (D-07, D-08 per CONTEXT.md)
      if (userInput.trim() === "/archive") {
        const title = chat.frontmatter.title || "(untitled)";
        const count = messages.length;
        console.log(`Archive "${title}" (${count} messages)?`);
        const confirm = await rl.question("Chat will be hidden from listings but preserved on disk. [y/N] ");
        if (confirm.trim().toLowerCase() === "y") {
          try {
            await archiveChat(chatPath, storageRoot, chat.frontmatter.project);
            console.log(`Archived: ${title}`);
            console.log("Session ended.");
          } catch {
            console.error("Error: Could not archive chat. Check file permissions.");
          }
          break;
        }
        console.log("Archive cancelled.");
        continue;
      }

      // /rename command (D-09, D-10 per CONTEXT.md)
      if (userInput.trim().startsWith("/rename ") || userInput.trim() === "/rename") {
        if (userInput.trim() === "/rename") {
          console.log("Usage: /rename <new title>");
          continue;
        }
        const newTitle = userInput.trim().slice("/rename ".length).trim();
        if (!newTitle) {
          console.log("Usage: /rename <new title>");
          continue;
        }
        try {
          await updateFrontmatter(chatPath, { title: newTitle });
          chat.frontmatter.title = newTitle;
          console.log(`Renamed to: ${newTitle}`);
        } catch {
          console.error("Error: Chat file not found. It may have been moved or deleted.");
        }
        continue;
      }

      // /include command (D-01, D-03)
      if (userInput.trim() === "/include") {
        if (includedChat) {
          console.log(
            `Already including: ${includedTitle}. Only one chat can be included at a time.`,
          );
          continue;
        }
        // List chats in current project (exclude current chat)
        const projectChats = await listChats(storageRoot, chat.frontmatter.project);
        const otherChats = projectChats
          .filter((c) => c.path !== chatPath)
          .slice(0, 20);
        if (otherChats.length === 0) {
          console.log("No other chats found to include.");
          continue;
        }
        console.log("Select a chat to include as context:\n");
        for (let i = 0; i < otherChats.length; i++) {
          const c = otherChats[i]!;
          const relDate = formatRelativeDate(c.lastModified);
          console.log(`  ${i + 1}. ${c.title}  (${relDate})`);
        }
        console.log();
        const answer = await rl.question(
          "Enter number to include, or q to cancel: ",
        );
        if (answer.trim().toLowerCase() === "q" || answer.trim() === "")
          continue;
        const num = parseInt(answer.trim(), 10);
        if (isNaN(num) || num < 1 || num > otherChats.length) continue;
        const selected = otherChats[num - 1]!;
        // Load and include
        try {
          const loadedChat = await readChatFile(selected.path);
          const chatContent = loadedChat.messages
            .map((m) => m.content)
            .join(" ");
          const estimatedTokens = Math.round(chatContent.length / 4);
          const includeBudget = contextLimit * 0.3;
          if (estimatedTokens > includeBudget) {
            // D-13: summarize included chat
            includedSummary = await summarizeMessages(loadedChat.messages);
            includedChat = loadedChat;
            includedTitle = selected.title;
            const summaryTokens = Math.round(includedSummary.length / 4);
            console.log(
              `Included: ${selected.title} (${loadedChat.messages.length} messages, summarized to ~${formatTokenCount(summaryTokens)} tokens)`,
            );
          } else {
            includedChat = loadedChat;
            includedSummary = null;
            includedTitle = selected.title;
            console.log(
              `Included: ${selected.title} (${loadedChat.messages.length} messages, ~${formatTokenCount(estimatedTokens)} tokens)`,
            );
          }
        } catch {
          console.error(
            `Error: Could not read chat "${selected.title}". File may have been moved or deleted.`,
          );
        }
        continue;
      }

      // /search command (D-14, D-15, D-16, D-17)
      if (
        userInput.trim().startsWith("/search ") ||
        userInput.trim() === "/search"
      ) {
        if (userInput.trim() === "/search") {
          console.log("Usage: /search <query> [--all]");
          continue;
        }
        const searchInput = userInput.trim().slice("/search ".length);
        const allFlag = searchInput.includes("--all");
        const query = searchInput.replace("--all", "").trim();
        if (!query) {
          console.log("Usage: /search <query> [--all]");
          continue;
        }
        try {
          const results = await searchChats(
            storageRoot,
            query,
            allFlag ? undefined : chat.frontmatter.project,
            allFlag,
          );
          const { formatted, chats } = formatSearchResults(results, query);
          console.log(formatted);
          // D-17: offer to include from results
          if (chats.length > 0 && !includedChat) {
            const answer = await rl.question(
              "Include a result? Enter number, or press Enter to cancel: ",
            );
            if (answer.trim() !== "") {
              const num = parseInt(answer.trim(), 10);
              if (!isNaN(num) && num >= 1 && num <= chats.length) {
                const selected = chats[num - 1]!;
                try {
                  const loadedChat = await readChatFile(selected.chatPath);
                  const chatContent = loadedChat.messages
                    .map((m) => m.content)
                    .join(" ");
                  const estimatedTokens = Math.round(chatContent.length / 4);
                  const includeBudget = contextLimit * 0.3;
                  if (estimatedTokens > includeBudget) {
                    includedSummary = await summarizeMessages(
                      loadedChat.messages,
                    );
                    includedChat = loadedChat;
                    includedTitle = selected.chatTitle;
                    const summaryTokens = Math.round(
                      includedSummary.length / 4,
                    );
                    console.log(
                      `Included: ${selected.chatTitle} (${loadedChat.messages.length} messages, summarized to ~${formatTokenCount(summaryTokens)} tokens)`,
                    );
                  } else {
                    includedChat = loadedChat;
                    includedSummary = null;
                    includedTitle = selected.chatTitle;
                    console.log(
                      `Included: ${selected.chatTitle} (${loadedChat.messages.length} messages, ~${formatTokenCount(estimatedTokens)} tokens)`,
                    );
                  }
                } catch {
                  console.error(
                    `Error: Could not read chat "${selected.chatTitle}". File may have been moved or deleted.`,
                  );
                }
              }
            }
          }
        } catch {
          console.error(
            "Error: Search failed. Check that the storage directory is accessible.",
          );
        }
        continue;
      }

      // /tokens command (per UI-SPEC /tokens flow)
      if (userInput.trim() === "/tokens") {
        const model = chat.frontmatter.model || "claude-sonnet-4-20250514";
        console.log("Context usage:");
        console.log(`  Model: ${model}`);
        console.log(
          `  Context window: ${formatTokenCount(contextLimit)} tokens`,
        );
        console.log(
          `  Last input: ${formatTokenCount(tracker.lastInputTokens)} tokens`,
        );
        console.log(
          `  Last output: ${formatTokenCount(tracker.lastOutputTokens)} tokens`,
        );
        console.log(`  Estimated usage: ${tracker.usagePercent}%`);
        const includedTokenEstimate = includedChat
          ? Math.round(
              (
                includedChat.messages.map((m) => m.content).join(" ").length || 0
              ) / 4,
            )
          : 0;
        console.log(
          `  Included chat: ${includedTitle ? `${includedTitle} (~${formatTokenCount(includedTokenEstimate)} tokens)` : "none"}`,
        );
        continue;
      }

      // /model command (D-07, D-08, D-09, D-10)
      if (userInput.trim() === "/model" || userInput.trim().startsWith("/model ")) {
        const arg = userInput.trim().slice("/model".length).trim();

        let newModel: string;

        if (!arg) {
          // D-07: Interactive picker (numbered list)
          try {
            const models = await listAvailableModels(getClient());
            if (models.length === 0) {
              console.log("No models available.");
              continue;
            }
            const currentModel = chat.frontmatter.model;
            console.log("Available models:\n");
            for (let i = 0; i < models.length; i++) {
              const m = models[i]!;
              const marker = m.id === currentModel ? "  <-- current" : "";
              console.log(`  ${i + 1}. ${formatModelListEntry(m)}${marker}`);
            }
            console.log();
            const answer = await rl.question("Enter number to switch, or q to cancel: ");
            if (answer.trim().toLowerCase() === "q" || answer.trim() === "") {
              continue;
            }
            const num = parseInt(answer.trim(), 10);
            if (isNaN(num) || num < 1 || num > models.length) {
              console.log("Invalid selection.");
              continue;
            }
            newModel = models[num - 1]!.id;
          } catch {
            console.error("Error: Could not fetch model list. Check your API key and connection.");
            continue;
          }
        } else {
          // D-07: Direct switch with alias resolution (D-03)
          newModel = resolveModelAlias(arg);
        }

        // D-08: Update frontmatter model field
        try {
          await updateFrontmatter(chatPath, { model: newModel });
          chat.frontmatter.model = newModel;
        } catch {
          console.error("Error: Could not update chat file.");
          continue;
        }

        // D-08: Recalculate context window limit (Pitfall 2 fix -- contextLimit is let, not const)
        const newLimit = getContextWindowLimit(newModel, projectConfig.context_window);
        contextLimit = newLimit;
        tracker.updateLimit(newLimit);

        // D-09: Feedback message
        console.log(`Switched to ${newModel} (${formatTokenCount(newLimit)} context)`);

        // D-10: Context overflow warning on downgrade
        if (tracker.lastInputTokens > newLimit) {
          const usage = formatTokenCount(tracker.lastInputTokens);
          console.log(`Warning: Current usage (~${usage}) exceeds new limit. Next message may trigger auto-summarization.`);
        }

        continue;
      }

      // Unknown command handler (per UI-SPEC)
      if (userInput.trim().startsWith("/")) {
        console.log(
          `Unknown command: ${userInput.trim().split(" ")[0]}. Available: /include, /search, /tokens, /model, /delete, /archive, /rename, /exit`,
        );
        continue;
      }

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

      // Run context assembly (D-02, D-08, D-09, D-11, D-13)
      const assembled = await assembleContext({
        allMessages: messages,
        includedChat,
        includedSummary,
        systemPrompt,
        contextLimit,
        model: chat.frontmatter.model || "claude-sonnet-4-20250514",
        lastInputTokens: tracker.lastInputTokens,
      });
      const summarizationOccurred = assembled.summarized;
      const summarizationInfo = assembled.summarizationInfo;

      let apiMessages = assembled.apiMessages;
      const effectiveSystemPrompt = assembled.systemWithInclude ?? systemPrompt;

      // If attachments had API content blocks (images, etc.), replace last message content
      if (parsed.apiContent.length > 0) {
        apiMessages[apiMessages.length - 1] = {
          role: "user",
          content: parsed.apiContent,
        };
      }

      // Print summarization notice BEFORE the API call (per UI-SPEC output sequence)
      if (summarizationOccurred && summarizationInfo) {
        console.log(
          `[summarized: ${summarizationInfo.originalCount} older messages -> summary + ${summarizationInfo.keptCount} recent]`,
        );
      }

      // Stream Claude response
      isStreaming = true;
      currentAbortController = new AbortController();
      try {
        const result = await sendAndStream(
          apiMessages,
          effectiveSystemPrompt,
          chat.frontmatter.model,
        );
        isStreaming = false;
        currentAbortController = null;

        // Update token tracker
        tracker.update(result.usage.input_tokens, result.usage.output_tokens);

        // Print token usage line (D-06, per UI-SPEC -- immediately after response)
        console.log(tracker.formatUsageLine());

        // Print warning if applicable (D-08)
        const warningLine = tracker.formatWarningLine();
        if (warningLine) console.log(warningLine);

        // Persist assistant response after completion (D-06)
        // D-11: File is the complete archive -- no summarized content written
        messages.push({ role: "assistant", content: result.text });
        await appendMessage(chatPath, "assistant", result.text);

        // Auto-title after first exchange (D-02)
        if (isFirstExchange) {
          isFirstExchange = false;
          generateChatTitle(userInput, result.text)
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
