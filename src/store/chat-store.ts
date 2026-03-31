import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import lockfile from "proper-lockfile";
import { parseChat } from "../markdown/parser.ts";
import { serializeChat } from "../markdown/serializer.ts";
import { writeFileAtomic } from "./atomic-write.ts";
import { generateChatFilename } from "../utils/slug.ts";
import {
  resolveProjectDir,
  resolveChatPath,
  DEFAULT_PROJECT,
} from "../utils/paths.ts";
import { DEFAULT_MODEL } from "../markdown/format.ts";
import type {
  ChatFrontmatter,
  ParsedChat,
  ChatListEntry,
  ChatMessage,
  CompactMarker,
} from "../types.ts";

/**
 * Create a new chat file with frontmatter.
 * Auto-creates the project directory if it does not exist.
 * Handles filename collisions by appending -2, -3, etc.
 * Returns the full file path of the created chat.
 */
export async function createChat(
  storageRoot: string,
  project: string,
  title: string,
  options?: { model?: string; systemPrompt?: string },
): Promise<string> {
  const resolvedProject = project || DEFAULT_PROJECT;
  const projectDir = resolveProjectDir(storageRoot, resolvedProject);

  // Auto-create project directory
  await fs.mkdir(projectDir, { recursive: true });

  // Generate filename
  const now = new Date();
  const baseFilename = generateChatFilename(title, now.toISOString());
  const baseName = baseFilename.replace(/\.md$/, "");

  // Check for filename collision
  let filename = baseFilename;
  let filePath = resolveChatPath(storageRoot, resolvedProject, filename);
  let counter = 2;
  while (await fileExists(filePath)) {
    filename = `${baseName}-${counter}.md`;
    filePath = resolveChatPath(storageRoot, resolvedProject, filename);
    counter++;
  }

  // Build frontmatter
  const frontmatter: ChatFrontmatter = {
    title,
    project: resolvedProject,
    created: now.toISOString(),
    model: options?.model || DEFAULT_MODEL,
    ...(options?.systemPrompt
      ? { system_prompt: options.systemPrompt }
      : {}),
  };

  // Serialize as frontmatter-only (no messages)
  const content = serializeChat(frontmatter, []);

  // Write atomically
  await writeFileAtomic(filePath, content);

  return filePath;
}

/**
 * Read and parse a chat file, returning frontmatter and messages.
 */
export async function readChat(filePath: string): Promise<ParsedChat> {
  const content = await fs.readFile(filePath, "utf-8");
  return parseChat(content);
}

/**
 * List all chats in a project directory.
 * Returns entries sorted by lastModified descending (most recent first).
 * Excludes files starting with _ (e.g., _config.yaml).
 */
export async function listChats(
  storageRoot: string,
  project: string,
): Promise<ChatListEntry[]> {
  const projectDir = resolveProjectDir(storageRoot, project);

  let files: string[];
  try {
    files = await fs.readdir(projectDir);
  } catch {
    return [];
  }

  // Filter to .md files, exclude _ prefixed
  const mdFiles = files.filter(
    (f) => f.endsWith(".md") && !f.startsWith("_"),
  );

  const entries: ChatListEntry[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(projectDir, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const stat = await fs.stat(filePath);

      // Parse frontmatter only (gray-matter is fast)
      const { data, content: body } = matter(content);

      // Extract preview: last message's first non-empty line, max 100 chars
      const preview = extractLastMessagePreview(body);

      // Extract tags defensively -- handle missing or non-array values
      const rawTags = data.tags;
      const tags: string[] = Array.isArray(rawTags)
        ? rawTags.filter((t: unknown): t is string => typeof t === "string")
        : [];

      entries.push({
        path: filePath,
        title: (data.title as string) || file,
        project: (data.project as string) || project,
        created: (data.created as string) || stat.birthtime.toISOString(),
        lastModified: stat.mtime,
        preview,
        tags,
      });
    } catch {
      // Skip files that can't be read/parsed
      continue;
    }
  }

  // Sort by lastModified descending (most recent first)
  entries.sort(
    (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
  );

  return entries;
}

/**
 * Append a message to an existing chat file.
 * Reads the existing file, adds the message, re-serializes, and writes atomically.
 * Never uses fs.appendFile -- always full atomic rewrite.
 */
export async function appendMessage(
  filePath: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const release = await lockfile.lock(filePath, {
    retries: { retries: 15, factor: 1.2, minTimeout: 50, maxTimeout: 500 },
    stale: 10000,
  });
  try {
    const existing = await readChat(filePath);
    const newMessage: ChatMessage = { role, content };
    const updatedMessages = [...existing.messages, newMessage];
    // Append new message to section order, preserving compact marker positions
    const updatedSectionOrder = [
      ...existing._sectionOrder,
      { type: "message" as const, index: updatedMessages.length - 1 },
    ];
    const serialized = serializeChat(
      existing.frontmatter,
      updatedMessages,
      existing.compactMarkers,
      updatedSectionOrder,
    );
    await writeFileAtomic(filePath, serialized);
  } finally {
    await release();
  }
}

/**
 * Append a compact event marker to an existing chat file.
 * Follows the same read-lock-rewrite-atomic pattern as appendMessage.
 * Used by the PostCompact hook to record compaction events.
 */
export async function appendCompactMarker(
  filePath: string,
  trigger: "auto" | "manual",
): Promise<void> {
  const release = await lockfile.lock(filePath, {
    retries: { retries: 15, factor: 1.2, minTimeout: 50, maxTimeout: 500 },
    stale: 10000,
  });
  try {
    const existing = await readChat(filePath);
    const marker: CompactMarker = {
      timestamp: new Date().toISOString(),
      trigger,
    };
    const updatedMarkers = [...existing.compactMarkers, marker];
    // Append new compact marker to section order, preserving message positions
    const updatedSectionOrder = [
      ...existing._sectionOrder,
      { type: "compact" as const, index: updatedMarkers.length - 1 },
    ];
    const serialized = serializeChat(
      existing.frontmatter,
      existing.messages,
      updatedMarkers,
      updatedSectionOrder,
    );
    await writeFileAtomic(filePath, serialized);
  } finally {
    await release();
  }
}

/**
 * Update frontmatter fields in an existing chat file.
 * Reads the file, merges updates into existing frontmatter,
 * re-serializes the entire file, and writes atomically.
 * Used by REPL to update the chat title after Haiku generates one.
 */
export async function updateFrontmatter(
  filePath: string,
  updates: Partial<ChatFrontmatter>,
): Promise<void> {
  const existing = await readChat(filePath);
  const updatedFrontmatter = { ...existing.frontmatter, ...updates };
  const serialized = serializeChat(
    updatedFrontmatter,
    existing.messages,
    existing.compactMarkers,
    existing._sectionOrder,
  );
  await writeFileAtomic(filePath, serialized);
}

/**
 * Delete a chat file permanently from disk.
 * Throws if the file does not exist (ENOENT propagates).
 */
export async function deleteChat(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

/**
 * Archive a chat by moving it to the _archive/ subdirectory.
 * Creates _archive/ if it does not exist.
 * Handles filename collision by appending -2, -3, etc.
 * Returns the new archive path.
 */
export async function archiveChat(
  filePath: string,
  storageRoot: string,
  project: string,
): Promise<string> {
  const projectDir = resolveProjectDir(storageRoot, project);
  const archiveDir = path.join(projectDir, "_archive");
  await fs.mkdir(archiveDir, { recursive: true });

  const basename = path.basename(filePath);
  let archivePath = path.join(archiveDir, basename);

  // Handle collision (same pattern as createChat)
  const baseName = basename.replace(/\.md$/, "");
  let counter = 2;
  while (await fileExists(archivePath)) {
    archivePath = path.join(archiveDir, `${baseName}-${counter}.md`);
    counter++;
  }

  await fs.rename(filePath, archivePath);
  return archivePath;
}

/**
 * Restore an archived chat by moving it back from _archive/ to project root.
 * Returns the new restored path.
 */
export async function restoreChat(
  archivedPath: string,
  storageRoot: string,
  project: string,
): Promise<string> {
  const projectDir = resolveProjectDir(storageRoot, project);
  const basename = path.basename(archivedPath);
  const restoredPath = path.join(projectDir, basename);
  await fs.rename(archivedPath, restoredPath);
  return restoredPath;
}

/**
 * List all archived chats in a project's _archive/ directory.
 * Returns entries sorted by lastModified descending (most recent first).
 * Returns empty array if _archive/ does not exist.
 */
export async function listArchivedChats(
  storageRoot: string,
  project: string,
): Promise<ChatListEntry[]> {
  const projectDir = resolveProjectDir(storageRoot, project);
  const archiveDir = path.join(projectDir, "_archive");

  let files: string[];
  try {
    files = await fs.readdir(archiveDir);
  } catch {
    return []; // No archive directory = no archived chats
  }

  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const entries: ChatListEntry[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(archiveDir, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const stat = await fs.stat(filePath);
      const { data, content: body } = matter(content);
      const preview = extractLastMessagePreview(body);

      // Extract tags defensively -- handle missing or non-array values
      const rawTags = data.tags;
      const tags: string[] = Array.isArray(rawTags)
        ? rawTags.filter((t: unknown): t is string => typeof t === "string")
        : [];

      entries.push({
        path: filePath,
        title: (data.title as string) || file,
        project: (data.project as string) || project,
        created: (data.created as string) || stat.birthtime.toISOString(),
        lastModified: stat.mtime,
        preview,
        tags,
      });
    } catch {
      continue;
    }
  }

  entries.sort(
    (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
  );
  return entries;
}

/**
 * Check if a file exists at the given path.
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
 * Extract a preview from the last message in the content.
 * Uses a simple regex to find the last ## User or ## Assistant heading,
 * then takes the first non-empty line after it, truncated to 100 chars.
 * This is intentionally simple -- full parse is not needed for listing.
 */
function extractLastMessagePreview(
  content: string,
  maxLen = 100,
): string {
  const headingPattern = /^## (?:User|Assistant)\s*$/gm;
  let lastIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(content)) !== null) {
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === -1) return "";

  const lastContent = content.slice(lastIndex).trim();
  const firstLine = lastContent.split("\n")[0].trim();
  return firstLine.length > maxLen
    ? firstLine.slice(0, maxLen) + "..."
    : firstLine;
}
