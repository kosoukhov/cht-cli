import fs from "node:fs/promises";
import { listChats } from "../store/chat-store.ts";
import { listProjects } from "../store/project-store.ts";

export type SearchMatch = {
  lineNumber: number;
  line: string;
};

export type SearchResult = {
  chatPath: string;
  chatTitle: string;
  project: string;
  lastModified: Date;
  matches: SearchMatch[];
};

const MAX_RESULTS = 20;
const MAX_MATCHES_PER_CHAT = 3;

/**
 * Search chat files for a query string.
 * Uses listChats for enumeration and fs.readFile for content scanning.
 * Results are sorted by lastModified descending (most recent first).
 *
 * @param storageRoot - Root directory for chat storage
 * @param query - Text to search for (case-insensitive)
 * @param project - Specific project to search (defaults to "general")
 * @param allProjects - If true, search all projects
 */
export async function searchChats(
  storageRoot: string,
  query: string,
  project?: string,
  allProjects?: boolean,
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) return [];

  const projects = allProjects
    ? await listProjects(storageRoot)
    : [project || "general"];

  const results: SearchResult[] = [];

  for (const proj of projects) {
    if (results.length >= MAX_RESULTS) break;
    const chats = await listChats(storageRoot, proj);
    for (const chat of chats) {
      if (results.length >= MAX_RESULTS) break;
      const content = await fs.readFile(chat.path, "utf-8");
      const matches = findMatchingLines(content, query);
      if (matches.length > 0) {
        results.push({
          chatPath: chat.path,
          chatTitle: chat.title,
          project: proj,
          lastModified: chat.lastModified,
          matches,
        });
      }
    }
  }

  // Sort by lastModified descending (most recent first)
  results.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return results;
}

/**
 * Find lines in content that match query (case-insensitive).
 * Skips the YAML frontmatter block (lines between --- delimiters at top).
 * Returns at most MAX_MATCHES_PER_CHAT matches.
 */
export function findMatchingLines(
  content: string,
  query: string,
): SearchMatch[] {
  const lines = content.split("\n");
  const lowerQuery = query.toLowerCase();
  const matches: SearchMatch[] = [];

  // Skip frontmatter
  let inFrontmatter = false;
  let frontmatterDone = false;
  let frontmatterDelimiterCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Track frontmatter boundaries
    if (!frontmatterDone) {
      if (line.trim() === "---") {
        frontmatterDelimiterCount++;
        if (frontmatterDelimiterCount === 1) {
          inFrontmatter = true;
          continue;
        }
        if (frontmatterDelimiterCount === 2) {
          inFrontmatter = false;
          frontmatterDone = true;
          continue;
        }
      }
      if (inFrontmatter) continue;
    }

    if (matches.length >= MAX_MATCHES_PER_CHAT) break;

    if (line.toLowerCase().includes(lowerQuery)) {
      matches.push({ lineNumber: i + 1, line: line.trim() });
    }
  }

  return matches;
}

/**
 * Trim a line to maxLen characters, adding "..." suffix if truncated.
 */
function trimLine(line: string, maxLen: number = 80): string {
  const trimmed = line.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen) + "...";
}

/**
 * Format search results for display per UI-SPEC exact strings.
 * Returns both formatted text and the raw results for REPL include flow.
 */
export function formatSearchResults(
  results: SearchResult[],
  query: string,
): { formatted: string; chats: SearchResult[] } {
  if (results.length === 0) {
    return { formatted: `No matches found for "${query}".`, chats: [] };
  }

  const lines: string[] = [`Found ${results.length} chat(s):\n`];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    lines.push(`  ${i + 1}. ${r.chatTitle}  [${r.project}]`);
    for (const match of r.matches.slice(0, MAX_MATCHES_PER_CHAT)) {
      lines.push(`     ...${trimLine(match.line)}...`);
    }
    lines.push("");
  }
  return { formatted: lines.join("\n"), chats: results };
}
