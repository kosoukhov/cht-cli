import fs from "node:fs/promises";
import Fuse from "fuse.js";
import { listChats } from "../store/chat-store.ts";
import { listProjects } from "../store/project-store.ts";
import type { ChatListEntry } from "../types.ts";

export type SearchMatch = {
  lineNumber: number;
  line: string;
};

export type SearchResult = {
  chatPath: string;
  chatTitle: string;
  project: string;
  lastModified: Date;
  tags: string[];
  matches: SearchMatch[];
  matchType: "title" | "content" | "both";
  score: number;
};

const MAX_RESULTS = 20;
const MAX_MATCHES_PER_CHAT = 3;

/** Content-only matches get a fixed base relevance score */
const CONTENT_BASE_SCORE = 0.8;

/** Fuse.js search item built from ChatListEntry metadata */
type FuzzySearchItem = {
  title: string;
  tags: string[];
  path: string;
  project: string;
  lastModified: Date;
};

/** Fuse.js configuration per UI-SPEC contract */
const FUSE_OPTIONS = {
  keys: [
    { name: "title" as const, weight: 0.7 },
    { name: "tags" as const, weight: 0.3 },
  ],
  threshold: 0.4,
  includeScore: true,
  shouldSort: true,
  minMatchCharLength: 2,
};

/**
 * Search chat files using two-tier architecture:
 * 1. Fuzzy search on metadata (title + tags) via fuse.js
 * 2. Exact substring search on content body via findMatchingLines
 * Results are merged into a unified ranked list sorted by relevance score.
 *
 * @param storageRoot - Root directory for chat storage
 * @param query - Text to search for
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

  // Collect all chat entries and their content across projects
  const allChats: {
    entry: ChatListEntry;
    project: string;
    content: string;
  }[] = [];

  for (const proj of projects) {
    const chats = await listChats(storageRoot, proj);
    for (const chat of chats) {
      const content = await fs.readFile(chat.path, "utf-8");
      allChats.push({ entry: chat, project: proj, content });
    }
  }

  // Tier 1: Fuzzy search on metadata (title + tags) via fuse.js
  const fuzzyItems: FuzzySearchItem[] = allChats.map((c) => ({
    title: c.entry.title,
    tags: c.entry.tags,
    path: c.entry.path,
    project: c.project,
    lastModified: c.entry.lastModified,
  }));

  const fuse = new Fuse(fuzzyItems, FUSE_OPTIONS);
  const fuzzyHits = fuse.search(query);

  // Build a map of fuzzy hits by path for fast lookup
  const fuzzyMap = new Map<string, number>();
  for (const hit of fuzzyHits) {
    // Fuse score: 0 = perfect, 1 = mismatch; invert to 1 = perfect, 0 = mismatch
    const relevance = 1 - (hit.score ?? 1);
    fuzzyMap.set(hit.item.path, relevance);
  }

  // Tier 2: Exact content search + merge with fuzzy results
  const results: SearchResult[] = [];

  for (const chatData of allChats) {
    const { entry, project: proj, content } = chatData;
    const contentMatches = findMatchingLines(content, query);
    const fuzzyScore = fuzzyMap.get(entry.path);
    const hasFuzzyMatch = fuzzyScore !== undefined;
    const hasContentMatch = contentMatches.length > 0;

    if (!hasFuzzyMatch && !hasContentMatch) continue;

    let matchType: "title" | "content" | "both";
    let score: number;

    if (hasFuzzyMatch && hasContentMatch) {
      matchType = "both";
      score = Math.max(fuzzyScore, CONTENT_BASE_SCORE);
    } else if (hasFuzzyMatch) {
      matchType = "title";
      score = fuzzyScore;
    } else {
      matchType = "content";
      score = CONTENT_BASE_SCORE;
    }

    results.push({
      chatPath: entry.path,
      chatTitle: entry.title,
      project: proj,
      lastModified: entry.lastModified,
      tags: entry.tags,
      matches: contentMatches,
      matchType,
      score,
    });
  }

  // Sort by score descending (best match first), then by lastModified descending (tie-breaker)
  results.sort(
    (a, b) =>
      b.score - a.score ||
      b.lastModified.getTime() - a.lastModified.getTime(),
  );

  // Cap at MAX_RESULTS
  return results.slice(0, MAX_RESULTS);
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
 * Supports unified results with tags, matchType, and score fields.
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

    // Build tag display: sorted alphabetically, comma-space separated in brackets
    const tags = r.tags ?? [];
    const tagPart =
      tags.length > 0
        ? ` [${[...tags].sort().join(", ")}]`
        : "";

    lines.push(`  ${i + 1}. ${r.chatTitle}${tagPart}  [${r.project}]`);
    for (const match of r.matches.slice(0, MAX_MATCHES_PER_CHAT)) {
      lines.push(`     ...${trimLine(match.line)}...`);
    }
    lines.push("");
  }
  return { formatted: lines.join("\n"), chats: results };
}
