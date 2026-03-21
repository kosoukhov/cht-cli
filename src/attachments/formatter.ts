import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { FileAttachment } from "./reader.ts";
import { formatFileSize } from "./reader.ts";

/**
 * Format a file attachment for storage in the markdown chat file.
 *
 * Text files: blockquote header + fenced code block with language tag
 * Image files: blockquote header only (base64 is unreadable in markdown)
 * Error files: empty string (errors handled by REPL, not stored)
 */
export function formatAttachmentMarkdown(attachment: FileAttachment): string {
  switch (attachment.type) {
    case "text": {
      const label = attachment.language || "text";
      const langTag = attachment.language;
      const header = `> **Attached: ${attachment.path}** (${label})`;
      const codeBlock = langTag
        ? `\`\`\`${langTag}\n${attachment.content}\n\`\`\``
        : `\`\`\`\n${attachment.content}\n\`\`\``;
      return `${header}\n\n${codeBlock}`;
    }
    case "image": {
      return `> **Attached: ${attachment.path}** (image)`;
    }
    case "error": {
      return "";
    }
  }
}

/**
 * Format a file attachment as an Anthropic API content block.
 *
 * Text files: TextBlockParam with file path and content
 * Image files: ImageBlockParam with base64-encoded data
 * Error files: null (not sent to API)
 */
export function formatAttachmentApiContent(
  attachment: FileAttachment,
): Anthropic.Messages.ContentBlockParam | null {
  switch (attachment.type) {
    case "text": {
      return {
        type: "text" as const,
        text: `File: ${attachment.path}\n\n${attachment.content}`,
      };
    }
    case "image": {
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: attachment.mediaType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: attachment.base64,
        },
      };
    }
    case "error": {
      return null;
    }
  }
}

/**
 * Format the terminal confirmation line for a successfully attached file.
 *
 * Output: "Attached: {basename} ({type}, {size})"
 * Error attachments return empty string.
 */
export function formatAttachmentConfirmation(
  attachment: FileAttachment,
  fileSize: number,
): string {
  switch (attachment.type) {
    case "text": {
      const basename = path.basename(attachment.path);
      return `Attached: ${basename} (text, ${formatFileSize(fileSize)})`;
    }
    case "image": {
      const basename = path.basename(attachment.path);
      return `Attached: ${basename} (image, ${formatFileSize(fileSize)})`;
    }
    case "error": {
      return "";
    }
  }
}
