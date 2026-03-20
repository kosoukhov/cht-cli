import matter from "gray-matter";
import type { ChatFrontmatter, ChatMessage } from "../types.ts";
import { USER_HEADING, ASSISTANT_HEADING } from "./format.ts";

/**
 * Serialize chat frontmatter and messages into a complete markdown chat file.
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
 */
export function serializeChat(
  frontmatter: ChatFrontmatter,
  messages: ChatMessage[],
): string {
  // Build message body
  const messageSections = messages.map((msg) => {
    const heading =
      msg.role === "user" ? USER_HEADING : ASSISTANT_HEADING;
    return `${heading}\n\n${msg.content}`;
  });

  const messageBody = messageSections.join("\n\n");

  // Use gray-matter's stringify to produce frontmatter + content
  // matter.stringify(content, data) produces: ---\ndata\n---\ncontent
  const contentPart =
    messages.length > 0 ? `\n${messageBody}\n` : "\n";

  const result = matter.stringify(contentPart, frontmatter);

  // Ensure exactly one trailing newline
  return result.endsWith("\n") ? result : result + "\n";
}
