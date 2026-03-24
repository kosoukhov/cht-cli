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
  formatBulkAttachmentConfirmation,
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
  // Clean text using all detected refs (even those beyond the cap)
  const cleanText = cleanMessageText(input, refs);

  // Enforce 10-file cap
  const MAX_FILES = 10;
  let cappedRefs = refs;
  if (refs.length > MAX_FILES) {
    console.error(`Warning: ${refs.length} files detected, attaching first 10 only.`);
    cappedRefs = refs.slice(0, MAX_FILES);
  }

  const attachments: FileAttachment[] = [];
  const fileSizes: number[] = [];
  const errors: string[] = [];

  // Read each file reference (only capped set)
  for (const ref of cappedRefs) {
    const attachment = await readAttachment(ref.path);

    if (attachment.type === "error") {
      // Format error message per UI-SPEC error states
      const errorMsg = formatAttachmentError(attachment.path, attachment.reason);
      errors.push(errorMsg);
    } else {
      attachments.push(attachment);
      // Collect file size for confirmation
      try {
        const stat = await fs.stat(attachment.path);
        fileSizes.push(stat.size);
      } catch {
        fileSizes.push(0);
      }
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
  if (attachments.length >= 2) {
    const confirmation = formatBulkAttachmentConfirmation(attachments, fileSizes);
    console.error(confirmation);
  } else if (attachments.length === 1) {
    const confirmation = formatAttachmentConfirmation(attachments[0]!, fileSizes[0]!);
    if (confirmation) {
      console.error(confirmation);
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
