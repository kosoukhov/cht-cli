import matter from "gray-matter";
import type { ChatFrontmatter, ChatMessage, CompactMarker } from "../types.ts";
import {
  USER_HEADING,
  ASSISTANT_HEADING,
  COMPACT_HEADING,
} from "./format.ts";

const COMPACT_EXPLANATION =
  "Context was compacted. Messages above this marker were summarized by Claude Code.";

/**
 * Serialize a single compact marker into its markdown representation.
 */
function serializeCompactMarker(marker: CompactMarker): string {
  return `${COMPACT_HEADING}\n\n*${marker.timestamp} -- ${marker.trigger}*\n\n${COMPACT_EXPLANATION}`;
}

/**
 * Serialize chat frontmatter, messages, and optional compact markers into a
 * complete markdown chat file.
 *
 * Produces:
 * ---
 * title: ...
 * project: ...
 * ---
 *
 * ## User
 *
 * message content
 *
 * ## Assistant
 *
 * message content
 *
 * ## Compact
 *
 * *timestamp -- trigger*
 *
 * Context was compacted. Messages above this marker were summarized by Claude Code.
 *
 * The optional `compactMarkers` and `sectionOrder` parameters control compact marker
 * output and interleaving. When omitted (backward compat), no compact markers appear.
 * When `sectionOrder` is provided, sections are emitted in that order for round-trip
 * fidelity. When only `compactMarkers` is provided without `sectionOrder`, markers
 * are appended after all messages.
 */
export function serializeChat(
  frontmatter: ChatFrontmatter,
  messages: ChatMessage[],
  compactMarkers?: CompactMarker[],
  sectionOrder?: Array<{ type: "message" | "compact"; index: number }>,
): string {
  const markers = compactMarkers ?? [];

  // Build sections in correct order
  const sections: string[] = [];

  if (
    sectionOrder &&
    sectionOrder.length > 0 &&
    sectionOrder.length === messages.length + markers.length
  ) {
    // Use explicit section ordering for round-trip fidelity
    for (const entry of sectionOrder) {
      if (entry.type === "message") {
        const msg = messages[entry.index];
        const heading =
          msg.role === "user" ? USER_HEADING : ASSISTANT_HEADING;
        sections.push(`${heading}\n\n${msg.content}`);
      } else {
        const marker = markers[entry.index];
        sections.push(serializeCompactMarker(marker));
      }
    }
  } else {
    // No section order: messages first, then compact markers at end
    for (const msg of messages) {
      const heading =
        msg.role === "user" ? USER_HEADING : ASSISTANT_HEADING;
      sections.push(`${heading}\n\n${msg.content}`);
    }
    for (const marker of markers) {
      sections.push(serializeCompactMarker(marker));
    }
  }

  const messageBody = sections.join("\n\n");

  // Use gray-matter's stringify to produce frontmatter + content
  // matter.stringify(content, data) produces: ---\ndata\n---\ncontent
  const contentPart =
    sections.length > 0 ? `\n${messageBody}\n` : "\n";

  const result = matter.stringify(contentPart, frontmatter);

  // Ensure exactly one trailing newline
  return result.endsWith("\n") ? result : result + "\n";
}
