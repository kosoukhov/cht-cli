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
 * Standalone absolute path: the entire trimmed input is a single absolute path.
 * Used for drag-and-drop detection where the terminal pastes the full path.
 */
const STANDALONE_PATH_PATTERN = /^(\/[^\s]+)$/;

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
 * Detect file references in user input text.
 *
 * Two detection modes:
 * 1. @path syntax: @/absolute, @./relative, @~/home
 * 2. Standalone absolute path: entire trimmed input is a single path (drag-and-drop)
 *
 * Per Pitfall 4: Only paths that actually exist on disk are returned.
 * Non-existent paths are silently skipped.
 */
export async function detectFileRefs(input: string): Promise<FileRef[]> {
  const refs: FileRef[] = [];
  const seen = new Set<string>();

  // Mode 1: @path references
  const atMatches = input.matchAll(AT_PATH_PATTERN);
  for (const match of atMatches) {
    const rawPath = match[1]!;
    const raw = `@${rawPath}`;
    const resolved = resolvePath(rawPath);

    if (!seen.has(resolved) && (await fileExists(resolved))) {
      refs.push({ path: resolved, raw });
      seen.add(resolved);
    }
  }

  // Mode 2: Standalone absolute path (entire trimmed input is a single path)
  const trimmed = input.trim();
  const standaloneMatch = STANDALONE_PATH_PATTERN.exec(trimmed);
  if (standaloneMatch) {
    const resolved = standaloneMatch[1]!;
    if (!seen.has(resolved) && (await fileExists(resolved))) {
      refs.push({ path: resolved, raw: resolved });
      seen.add(resolved);
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
