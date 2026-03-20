import slug from "slug";

/**
 * Generate a filename slug from a chat title.
 * Handles Russian Cyrillic via transliteration (slug package default).
 * Returns lowercase, hyphen-separated string safe for filenames.
 */
export function generateSlug(title: string): string {
  return slug(title, { lower: true });
}

/**
 * Generate a full chat filename: {date}-{slug}.md
 * Date is extracted from an ISO datetime string.
 */
export function generateChatFilename(title: string, createdIso: string): string {
  const dateStr = createdIso.split("T")[0]; // "2026-03-20"
  const titleSlug = generateSlug(title);
  if (!titleSlug) {
    return `${dateStr}-untitled.md`;
  }
  return `${dateStr}-${titleSlug}.md`;
}
