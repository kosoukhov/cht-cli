// Stub -- to be implemented in GREEN phase
import type { ProjectConfig, ChatFrontmatter } from "../types.ts";

export async function readProjectConfig(
  _storageRoot: string,
  _project: string,
): Promise<ProjectConfig> {
  throw new Error("Not implemented");
}

export async function writeProjectConfig(
  _storageRoot: string,
  _project: string,
  _config: ProjectConfig,
): Promise<void> {
  throw new Error("Not implemented");
}

export async function resolveSystemPrompt(
  _storageRoot: string,
  _project: string,
  _chatFrontmatter: ChatFrontmatter,
): Promise<string | undefined> {
  throw new Error("Not implemented");
}

export async function listProjects(
  _storageRoot: string,
): Promise<string[]> {
  throw new Error("Not implemented");
}
