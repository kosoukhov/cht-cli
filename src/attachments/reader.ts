import fs from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const MAX_TEXT_SIZE = 50 * 1024; // 50KB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Binary detection sample size -- check first 8KB for null bytes.
 */
const BINARY_CHECK_SIZE = 8192;

/**
 * A successfully read file attachment, classified by type.
 * - text: readable text file with content and detected language
 * - image: image file with base64-encoded data and media type
 * - error: file that could not be read (missing, binary, too large)
 */
export type FileAttachment =
  | { type: "text"; path: string; content: string; language: string }
  | { type: "image"; path: string; base64: string; mediaType: string }
  | { type: "error"; path: string; reason: string };

/**
 * Read a file from disk, classify it, and return the appropriate attachment type.
 *
 * - Text files: read as UTF-8, truncated at 50KB with a marker
 * - Images: read as buffer, base64-encoded, capped at 5MB
 * - Binary files (null bytes in first 8KB): rejected with error
 * - Missing files: returned as error
 */
export async function readAttachment(
  filePath: string,
): Promise<FileAttachment> {
  // Check existence
  try {
    await fs.access(filePath);
  } catch {
    return { type: "error", path: filePath, reason: "File not found" };
  }

  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Image files -- classified by extension
  if (IMAGE_EXTENSIONS.has(ext)) {
    if (stat.size > MAX_IMAGE_SIZE) {
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
      return {
        type: "error",
        path: filePath,
        reason: `Image too large (${sizeMB}MB, max 5MB)`,
      };
    }
    const buffer = await fs.readFile(filePath);
    return {
      type: "image",
      path: filePath,
      base64: buffer.toString("base64"),
      mediaType: IMAGE_MEDIA_TYPES[ext] || "image/png",
    };
  }

  // Potential text file -- read and check for binary content
  const buffer = await fs.readFile(filePath);
  const sample = buffer.subarray(0, BINARY_CHECK_SIZE);

  if (sample.includes(0x00)) {
    return {
      type: "error",
      path: filePath,
      reason: "Binary file format not supported",
    };
  }

  // Text file
  let content = buffer.toString("utf-8");
  if (stat.size > MAX_TEXT_SIZE) {
    content =
      content.slice(0, MAX_TEXT_SIZE) +
      "\n\n[... truncated, file too large ...]";
  }

  const language = extToLanguage(ext);
  return { type: "text", path: filePath, content, language };
}

/**
 * Map file extension to programming language name for syntax highlighting.
 * Returns empty string for unknown extensions.
 */
export function extToLanguage(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".js": "javascript",
    ".py": "python",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".css": "css",
    ".html": "html",
    ".xml": "xml",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".md": "markdown",
    ".sh": "bash",
    ".sql": "sql",
    ".txt": "",
  };
  return map[ext] || "";
}

/**
 * Format a byte count as a human-readable size string.
 * Examples: "500B", "2.0KB", "1.4MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
