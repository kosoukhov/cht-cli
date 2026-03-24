import fs from "node:fs/promises";
import path from "node:path";

/**
 * A detected file reference in user input.
 * `path` is the resolved absolute path on disk.
 * `raw` is the original text matched in the input.
 */
export type FileRef = {
  path: string;
  raw: string;
};

/**
 * Regex for @path syntax: @ followed by /, ./, or ~/ then non-whitespace chars.
 * Avoids false positives on @mention, email@example.com, etc.
 */
const AT_PATH_PATTERN = /@((?:\/|\.\/|~\/)[^\s]+)/g;

/**
 * Standalone absolute path: the entire trimmed line is a single absolute path (no spaces).
 * Used for drag-and-drop detection where the terminal pastes the full path.
 */
const STANDALONE_PATH_PATTERN = /^(\/[^\s]+)$/;

/**
 * Quoted absolute path: entire trimmed line is a quoted path (e.g., "/Users/me/my file.txt").
 * Handles drag-and-drop paths with spaces from Finder.
 */
const QUOTED_PATH_STANDALONE = /^"(\/[^"]+)"$/;

/**
 * Quoted absolute path: embedded in message text (e.g., check "/Users/me/my file.txt" please).
 */
const QUOTED_PATH_INLINE = /"(\/[^"]+)"/g;

/**
 * Escaped absolute path: contains backslash-space sequences (e.g., /Users/me/my\ file.txt).
 * Handles drag-and-drop paths with spaces escaped by terminal.
 */
const ESCAPED_PATH_STANDALONE = /^(\/(?:[^\s\\]|\\.)+)$/;

/**
 * Resolve a path candidate to an absolute path.
 * Handles ~/ (home directory) and ./ (relative) resolution.
 */
function resolvePath(candidate: string): string {
  if (candidate.startsWith("~/")) {
    const home = process.env.HOME || "/Users/default";
    return path.resolve(home, candidate.slice(2));
  }
  return path.resolve(candidate);
}

/**
 * Unescape backslash-space sequences in a path string.
 * Converts `/path/my\ file.txt` to `/path/my file.txt`.
 */
function unescapePath(raw: string): string {
  return raw.replace(/\\ /g, " ");
}

/**
 * Check if a file exists on disk.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to add a file ref candidate to the refs array if it exists and hasn't been seen.
 * Returns true if the ref was added.
 */
async function tryAddRef(
  resolved: string,
  raw: string,
  refs: FileRef[],
  seen: Set<string>,
): Promise<boolean> {
  if (!seen.has(resolved) && (await fileExists(resolved))) {
    refs.push({ path: resolved, raw });
    seen.add(resolved);
    return true;
  }
  return false;
}

/**
 * Detect file references in user input text.
 *
 * Detection modes (in priority order):
 * 1. @path syntax: @/absolute, @./relative, @~/home (inline within each line)
 * 2. Quoted absolute path standalone: entire trimmed line is "/path/..."
 * 3. Quoted absolute path inline: "/path/..." embedded within text
 * 4. Escaped absolute path standalone: entire trimmed line is /path/with\ spaces
 * 5. Plain standalone absolute path: entire trimmed line is /path/no-spaces
 *
 * Multi-line input is split by newlines and each line is processed independently.
 * Per Pitfall 4: Only paths that actually exist on disk are returned.
 * Non-existent paths are silently skipped.
 */
export async function detectFileRefs(input: string): Promise<FileRef[]> {
  const refs: FileRef[] = [];
  const seen = new Set<string>();

  const lines = input.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Priority 1: @path references (inline within line)
    const atMatches = trimmed.matchAll(AT_PATH_PATTERN);
    let hasAtMatch = false;
    for (const match of atMatches) {
      const rawPath = match[1]!;
      const raw = `@${rawPath}`;
      const resolved = resolvePath(rawPath);
      await tryAddRef(resolved, raw, refs, seen);
      hasAtMatch = true;
    }
    if (hasAtMatch) continue;

    // Priority 2: Quoted path standalone (entire trimmed line is "/<path>")
    const quotedStandaloneMatch = QUOTED_PATH_STANDALONE.exec(trimmed);
    if (quotedStandaloneMatch) {
      const innerPath = quotedStandaloneMatch[1]!;
      const resolved = resolvePath(innerPath);
      await tryAddRef(resolved, trimmed, refs, seen);
      continue;
    }

    // Priority 3: Quoted path inline (embedded "/<path>" within text)
    const quotedInlineMatches = trimmed.matchAll(QUOTED_PATH_INLINE);
    let hasQuotedInline = false;
    for (const match of quotedInlineMatches) {
      const innerPath = match[1]!;
      const raw = match[0]!; // includes outer quotes
      const resolved = resolvePath(innerPath);
      await tryAddRef(resolved, raw, refs, seen);
      hasQuotedInline = true;
    }
    if (hasQuotedInline) continue;

    // Priority 4: Escaped path standalone (line contains backslash-space)
    if (trimmed.includes("\\ ")) {
      const escapedMatch = ESCAPED_PATH_STANDALONE.exec(trimmed);
      if (escapedMatch) {
        const rawEscaped = escapedMatch[1]!;
        const resolved = resolvePath(unescapePath(rawEscaped));
        await tryAddRef(resolved, rawEscaped, refs, seen);
        continue;
      }
    }

    // Priority 5: Plain standalone path (entire trimmed line is a single no-space path)
    const standaloneMatch = STANDALONE_PATH_PATTERN.exec(trimmed);
    if (standaloneMatch) {
      const resolved = standaloneMatch[1]!;
      await tryAddRef(resolved, resolved, refs, seen);
    }
  }

  return refs;
}

/**
 * Remove detected file references from message text.
 * Returns the cleaned text with all ref.raw occurrences removed and trimmed.
 * If the entire input was a standalone file path, returns empty string.
 */
export function cleanMessageText(input: string, refs: FileRef[]): string {
  let result = input;
  for (const ref of refs) {
    result = result.split(ref.raw).join("");
  }
  return result.trim();
}
