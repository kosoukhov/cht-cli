import matter from "gray-matter";
import { ChatFrontmatterSchema } from "../types.ts";
import type {
  ChatMessage,
  ChatFrontmatter,
  ParsedChat,
  CompactMarker,
} from "../types.ts";
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

/** Regex to parse the compact marker metadata line: *timestamp -- trigger* */
const COMPACT_META_PATTERN = /^\*(.+?)\s+--\s+(.+?)\*$/;

/**
 * Internal parse result including section ordering for round-trip fidelity.
 */
type ParseContentResult = {
  messages: ChatMessage[];
  compactMarkers: CompactMarker[];
  sectionOrder: Array<{ type: "message" | "compact"; index: number }>;
};

/**
 * Parse message content (after frontmatter extraction) into messages, compact markers,
 * and section ordering.
 *
 * Uses a state machine with two states:
 * - NORMAL: heading patterns create message/compact boundaries, fence patterns enter code blocks
 * - IN_CODE_BLOCK: all content passes through until the matching closing fence
 */
function parseContent(content: string): ParseContentResult {
  // Normalize CRLF to LF
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const messages: ChatMessage[] = [];
  const compactMarkers: CompactMarker[] = [];
  const sectionOrder: Array<{ type: "message" | "compact"; index: number }> =
    [];

  let state: "NORMAL" | "IN_CODE_BLOCK" = "NORMAL";
  let fenceChar = "";
  let fenceCount = 0;
  let currentRole: "user" | "assistant" | null = null;
  let currentLines: string[] = [];
  let currentSection: "message" | "compact" | null = null;
  let compactLines: string[] = [];

  function flushMessage(): void {
    if (currentSection === "message" && currentRole !== null) {
      const trimmed = trimEmptyLines(currentLines);
      messages.push({
        role: currentRole,
        content: trimmed.join("\n"),
      });
      sectionOrder.push({ type: "message", index: messages.length - 1 });
    } else if (currentSection === "compact") {
      flushCompact();
    }
  }

  function flushCompact(): void {
    // Parse compact marker metadata from collected lines
    const trimmed = trimEmptyLines(compactLines);
    let timestamp = "";
    let trigger: "auto" | "manual" = "auto";

    for (const line of trimmed) {
      const metaMatch = line.match(COMPACT_META_PATTERN);
      if (metaMatch) {
        timestamp = metaMatch[1];
        trigger = metaMatch[2] as "auto" | "manual";
        break;
      }
    }

    if (timestamp) {
      compactMarkers.push({ timestamp, trigger });
      sectionOrder.push({
        type: "compact",
        index: compactMarkers.length - 1,
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
      // Either way, content inside code block belongs to current section
      if (currentSection === "message") {
        currentLines.push(line);
      } else if (currentSection === "compact") {
        compactLines.push(line);
      }
    } else {
      // NORMAL state
      const headingMatch = line.match(HEADING_PATTERN);
      if (headingMatch) {
        // Flush previous section
        flushMessage();

        const headingType = headingMatch[1];
        if (headingType === "Compact") {
          // Start compact section
          currentSection = "compact";
          currentRole = null;
          currentLines = [];
          compactLines = [];
        } else {
          // Start message section
          currentSection = "message";
          currentRole = headingType.toLowerCase() as "user" | "assistant";
          currentLines = [];
          compactLines = [];
        }
      } else {
        const fenceMatch = line.match(FENCE_OPEN_PATTERN);
        if (fenceMatch && currentSection !== null) {
          // Enter code block state
          state = "IN_CODE_BLOCK";
          fenceChar = fenceMatch[1][0]; // first character (` or ~)
          fenceCount = fenceMatch[1].length;
          if (currentSection === "message") {
            currentLines.push(line);
          } else if (currentSection === "compact") {
            compactLines.push(line);
          }
        } else {
          // Regular content line
          if (currentSection === "message" && currentRole !== null) {
            currentLines.push(line);
          } else if (currentSection === "compact") {
            compactLines.push(line);
          }
          // If currentSection is null, content before first heading is ignored
        }
      }
    }
  }

  // Flush final section (handles unclosed code blocks gracefully)
  flushMessage();

  return { messages, compactMarkers, sectionOrder };
}

/**
 * Parse message content (after frontmatter extraction) into ChatMessage[].
 *
 * Uses a state machine with two states:
 * - NORMAL: heading patterns create message boundaries, fence patterns enter code blocks
 * - IN_CODE_BLOCK: all content passes through until the matching closing fence
 *
 * Note: This function returns only messages for backward compatibility.
 * Compact markers are filtered out (## Compact headings are skipped).
 */
export function parseMessages(content: string): ChatMessage[] {
  return parseContent(content).messages;
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

  const { messages, compactMarkers, sectionOrder } = parseContent(content);

  return { frontmatter, messages, compactMarkers, _sectionOrder: sectionOrder };
}
