import matter from "gray-matter";
import { ChatFrontmatterSchema } from "../types.ts";
import type { ChatMessage, ChatFrontmatter, ParsedChat } from "../types.ts";
import { HEADING_PATTERN, FENCE_OPEN_PATTERN } from "./format.ts";

/**
 * Removes leading and trailing empty/whitespace-only lines from an array of lines.
 */
function trimEmptyLines(lines: string[]): string[] {
  let start = 0;
  while (start < lines.length && lines[start].trim() === "") {
    start++;
  }
  let end = lines.length - 1;
  while (end >= start && lines[end].trim() === "") {
    end--;
  }
  return lines.slice(start, end + 1);
}

/**
 * Parse message content (after frontmatter extraction) into ChatMessage[].
 *
 * Uses a state machine with two states:
 * - NORMAL: heading patterns create message boundaries, fence patterns enter code blocks
 * - IN_CODE_BLOCK: all content passes through until the matching closing fence
 */
export function parseMessages(content: string): ChatMessage[] {
  // Normalize CRLF to LF
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const messages: ChatMessage[] = [];
  let state: "NORMAL" | "IN_CODE_BLOCK" = "NORMAL";
  let fenceChar = "";
  let fenceCount = 0;
  let currentRole: "user" | "assistant" | null = null;
  let currentLines: string[] = [];

  function flushMessage(): void {
    if (currentRole !== null) {
      const trimmed = trimEmptyLines(currentLines);
      messages.push({
        role: currentRole,
        content: trimmed.join("\n"),
      });
    }
  }

  for (const line of lines) {
    if (state === "IN_CODE_BLOCK") {
      // Check if this line closes the code block
      // Closing fence: same char, >= same count, then only whitespace
      const closingPattern = new RegExp(
        `^${fenceChar === "`" ? "`" : "~"}{${fenceCount},}\\s*$`,
      );
      if (closingPattern.test(line)) {
        state = "NORMAL";
      }
      // Either way, content inside code block belongs to current message
      currentLines.push(line);
    } else {
      // NORMAL state
      const headingMatch = line.match(HEADING_PATTERN);
      if (headingMatch) {
        // Flush previous message
        flushMessage();
        // Start new message
        currentRole = headingMatch[1].toLowerCase() as "user" | "assistant";
        currentLines = [];
      } else {
        const fenceMatch = line.match(FENCE_OPEN_PATTERN);
        if (fenceMatch && currentRole !== null) {
          // Enter code block state
          state = "IN_CODE_BLOCK";
          fenceChar = fenceMatch[1][0]; // first character (` or ~)
          fenceCount = fenceMatch[1].length;
          currentLines.push(line);
        } else {
          // Regular content line
          if (currentRole !== null) {
            currentLines.push(line);
          }
          // If currentRole is null, content before first heading is ignored
        }
      }
    }
  }

  // Flush final message (handles unclosed code blocks gracefully)
  flushMessage();

  return messages;
}

/**
 * Parse a complete markdown chat file (with frontmatter) into ParsedChat.
 *
 * Extracts YAML frontmatter via gray-matter, validates with ChatFrontmatterSchema.
 * On invalid frontmatter, returns best-effort defaults.
 */
export function parseChat(fileContent: string): ParsedChat {
  // Normalize CRLF for gray-matter as well
  const normalized = fileContent.replace(/\r\n/g, "\n");
  const { data, content } = matter(normalized);

  // Validate frontmatter
  const parsed = ChatFrontmatterSchema.safeParse(data);
  let frontmatter: ChatFrontmatter;

  if (parsed.success) {
    frontmatter = parsed.data;
  } else {
    // Best-effort frontmatter with defaults
    console.warn(
      "Invalid chat frontmatter, using defaults:",
      parsed.error.message,
    );
    frontmatter = {
      title: (data.title as string) || "Untitled",
      project: (data.project as string) || "general",
      created: (data.created as string) || new Date().toISOString(),
      model: (data.model as string) || "unknown",
    };
  }

  const messages = parseMessages(content);

  return { frontmatter, messages };
}
