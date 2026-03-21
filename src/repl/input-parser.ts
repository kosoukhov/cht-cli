import fs from "node:fs/promises";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import {
  detectFileRefs,
  cleanMessageText,
} from "../attachments/detector.ts";
import {
  readAttachment,
  formatFileSize,
} from "../attachments/reader.ts";
import type { FileAttachment } from "../attachments/reader.ts";
import {
  formatAttachmentMarkdown,
  formatAttachmentApiContent,
  formatAttachmentConfirmation,
} from "../attachments/formatter.ts";

/**
 * Result of parsing user input for text and file references.
 */
export type ParsedInput = {
  /** Clean message text (file refs removed) */
  text: string;
  /** Successfully read attachments */
  attachments: FileAttachment[];
  /** Error messages for failed attachments */
  errors: string[];
  /** Full markdown content for storage (attachments + text) */
  markdownContent: string;
  /** Content blocks for API (may include images) */
  apiContent: Anthropic.Messages.ContentBlockParam[];
};

/**
 * Parse user input for text and file references.
 *
 * 1. Detects @path file references
 * 2. Reads each referenced file
 * 3. Separates successes from errors
 * 4. Builds markdown content for storage
 * 5. Builds API content blocks
 * 6. Prints attachment confirmations to stderr
 */
export async function parseUserInput(input: string): Promise<ParsedInput> {
  const refs = await detectFileRefs(input);
  const cleanText = cleanMessageText(input, refs);

  const attachments: FileAttachment[] = [];
  const errors: string[] = [];

  // Read each file reference
  for (const ref of refs) {
    const attachment = await readAttachment(ref.path);

    if (attachment.type === "error") {
      // Format error message per UI-SPEC error states
      const errorMsg = formatAttachmentError(attachment.path, attachment.reason);
      errors.push(errorMsg);
    } else {
      attachments.push(attachment);
    }
  }

  // Build markdownContent: attachment blocks + clean text
  const markdownParts: string[] = [];
  for (const att of attachments) {
    const md = formatAttachmentMarkdown(att);
    if (md) {
      markdownParts.push(md);
    }
  }
  if (cleanText) {
    markdownParts.push(cleanText);
  }
  const markdownContent = markdownParts.join("\n\n").trim();

  // Build apiContent: attachment content blocks + text block
  const apiContent: Anthropic.Messages.ContentBlockParam[] = [];
  for (const att of attachments) {
    const block = formatAttachmentApiContent(att);
    if (block) {
      apiContent.push(block);
    }
  }
  if (cleanText) {
    apiContent.push({ type: "text", text: cleanText });
  }

  // Print attachment confirmations to stderr
  for (const att of attachments) {
    try {
      const stat = await fs.stat(att.path);
      const confirmation = formatAttachmentConfirmation(att, stat.size);
      if (confirmation) {
        console.error(confirmation);
      }
    } catch {
      // Stat failed -- skip confirmation
    }
  }

  return {
    text: cleanText,
    attachments,
    errors,
    markdownContent,
    apiContent,
  };
}

/**
 * Format an attachment error message per UI-SPEC error states.
 */
function formatAttachmentError(filePath: string, reason: string): string {
  const basename = path.basename(filePath);

  if (reason === "File not found") {
    return `File not found: ${filePath}. Sending message without attachment.`;
  }

  if (reason === "Binary file format not supported") {
    return `Unsupported file type: ${filePath}. Only text and image files are supported.`;
  }

  if (reason.toLowerCase().includes("too large")) {
    return `File too large: ${basename} (${reason}). Sending message without attachment.`;
  }

  return `Attachment error: ${filePath} - ${reason}`;
}
