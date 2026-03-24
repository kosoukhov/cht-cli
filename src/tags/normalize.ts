/**
 * Normalize a tag input to lowercase kebab-case [a-z0-9-].
 * Returns null if input normalizes to an empty string.
 *
 * Rules (per D-04):
 * - Trim whitespace
 * - Lowercase
 * - Spaces/underscores/tabs -> hyphens
 * - Strip characters not matching [a-z0-9-]
 * - Collapse consecutive hyphens
 * - Strip leading/trailing hyphens
 * - Return null if result is empty
 */
export function normalizeTag(input: string): string | null {
  let tag = input.trim().toLowerCase();
  tag = tag.replace(/[\s_]+/g, "-");
  tag = tag.replace(/[^a-z0-9-]/g, "");
  tag = tag.replace(/-{2,}/g, "-");
  tag = tag.replace(/^-+|-+$/g, "");
  return tag.length > 0 ? tag : null;
}
