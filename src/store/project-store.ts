import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
const { load: yamlLoad, dump: yamlDump } = yaml;
import { writeFileAtomic } from "./atomic-write.ts";
import { ProjectConfigSchema } from "../types.ts";
import type { ProjectConfig, ChatFrontmatter } from "../types.ts";
import { resolveProjectDir } from "../utils/paths.ts";
import { PROJECT_CONFIG_FILENAME } from "../markdown/format.ts";

/**
 * Read project config from _config.yaml in the project directory.
 * Returns an empty object if the file does not exist or is invalid.
 * Validates with ProjectConfigSchema and strips unknown fields.
 */
export async function readProjectConfig(
  storageRoot: string,
  project: string,
): Promise<ProjectConfig> {
  const projectDir = resolveProjectDir(storageRoot, project);
  const configPath = path.join(projectDir, PROJECT_CONFIG_FILENAME);

  let content: string;
  try {
    content = await fs.readFile(configPath, "utf-8");
  } catch {
    // File does not exist -- return empty config
    return {};
  }

  try {
    const raw = yamlLoad(content);
    const parsed = ProjectConfigSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
    // Invalid schema -- return empty config (graceful degradation)
    return {};
  } catch {
    // Invalid YAML -- return empty config
    return {};
  }
}

/**
 * Write project config to _config.yaml in the project directory.
 * Auto-creates the project directory if it does not exist.
 * Uses atomic writes for crash safety.
 */
export async function writeProjectConfig(
  storageRoot: string,
  project: string,
  config: ProjectConfig,
): Promise<void> {
  const projectDir = resolveProjectDir(storageRoot, project);
  await fs.mkdir(projectDir, { recursive: true });

  const configPath = path.join(projectDir, PROJECT_CONFIG_FILENAME);
  const yamlContent = yamlDump(config);

  await writeFileAtomic(configPath, yamlContent);
}

/**
 * Resolve the effective system prompt for a chat.
 * Priority: chat frontmatter system_prompt > project _config.yaml system_prompt > undefined.
 */
export async function resolveSystemPrompt(
  storageRoot: string,
  project: string,
  chatFrontmatter: ChatFrontmatter,
): Promise<string | undefined> {
  // Chat-level prompt takes priority
  if (
    chatFrontmatter.system_prompt &&
    chatFrontmatter.system_prompt.length > 0
  ) {
    return chatFrontmatter.system_prompt;
  }

  // Fall back to project-level prompt
  const config = await readProjectConfig(storageRoot, project);
  if (config.system_prompt && config.system_prompt.length > 0) {
    return config.system_prompt;
  }

  return undefined;
}

/**
 * List all project directories in the storage root.
 * Excludes hidden directories (starting with .).
 * Returns a sorted array of project names.
 */
export async function listProjects(
  storageRoot: string,
): Promise<string[]> {
  const entries = await fs.readdir(storageRoot, { withFileTypes: true });

  const projects = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name);

  return projects.sort();
}
