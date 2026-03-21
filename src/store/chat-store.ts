import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
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

      entries.push({
        path: filePath,
        title: (data.title as string) || file,
        project: (data.project as string) || project,
        created: (data.created as string) || stat.birthtime.toISOString(),
        lastModified: stat.mtime,
        preview,
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
  const existing = await readChat(filePath);

  const newMessage: ChatMessage = { role, content };
  const updatedMessages = [...existing.messages, newMessage];

  const serialized = serializeChat(existing.frontmatter, updatedMessages);
  await writeFileAtomic(filePath, serialized);
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
  const serialized = serializeChat(updatedFrontmatter, existing.messages);
  await writeFileAtomic(filePath, serialized);
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
