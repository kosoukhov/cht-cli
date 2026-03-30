import path from "node:path";

// Valid project name: alphanumeric, hyphens, underscores only
const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Resolve the storage root directory.
 * Priority: CHAT_STORAGE_DIR > CLAUDE_PROJECT_DIR/chats > cwd/chats
 *
 * CLAUDE_PROJECT_DIR is set by Claude Code in the hook process environment,
 * ensuring hooks find the correct storage root regardless of working directory.
 */
export function resolveStorageRoot(): string {
  if (process.env.CHAT_STORAGE_DIR) {
    return process.env.CHAT_STORAGE_DIR;
  }
  if (process.env.CLAUDE_PROJECT_DIR) {
    return path.join(process.env.CLAUDE_PROJECT_DIR, "chats");
  }
  return path.join(process.cwd(), "chats");
}

/**
 * Validate a project name. Rejects path traversal and special characters.
 * Returns true if valid, false otherwise.
 */
export function validateProjectName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 100) return false;
  if (!PROJECT_NAME_PATTERN.test(name)) return false;
  if (name === "." || name === "..") return false;
  return true;
}

/**
 * Resolve the directory path for a project.
 * Throws if project name is invalid.
 */
export function resolveProjectDir(storageRoot: string, project: string): string {
  if (!validateProjectName(project)) {
    throw new Error(`Invalid project name: "${project}". Use only letters, numbers, hyphens, and underscores.`);
  }
  const resolved = path.resolve(storageRoot, project);
  // Verify resolved path is still under storage root (prevents traversal)
  if (!resolved.startsWith(path.resolve(storageRoot))) {
    throw new Error(`Project path escapes storage root: "${project}"`);
  }
  return resolved;
}

/**
 * Resolve the full path for a chat file within a project.
 * Throws if project name is invalid.
 */
export function resolveChatPath(storageRoot: string, project: string, filename: string): string {
  const projectDir = resolveProjectDir(storageRoot, project);
  const resolved = path.resolve(projectDir, filename);
  // Verify resolved path is still under project directory
  if (!resolved.startsWith(projectDir)) {
    throw new Error(`Chat path escapes project directory: "${filename}"`);
  }
  return resolved;
}

/** Default project name for chats created without specifying a project */
export const DEFAULT_PROJECT = "general";
