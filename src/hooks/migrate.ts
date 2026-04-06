import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Detect and remove old .claude/commands/cht/ format.
 * Checks both user-global (~/.claude/commands/cht/) and
 * project-local (.claude/commands/cht/) locations.
 * Per D-09: detects old format and removes it.
 * Per D-11: idempotent -- safe to rerun.
 */
export async function runMigrate(options?: {
  homeDir?: string;
  projectDir?: string;
}): Promise<{ removed: string[]; warnings: string[] }> {
  const removed: string[] = [];
  const warnings: string[] = [];

  const home = options?.homeDir ?? os.homedir();
  const project = options?.projectDir ?? process.cwd();

  // Check user-global old commands location
  const globalOldPath = path.join(home, ".claude", "commands", "cht");
  try {
    const stat = await fs.stat(globalOldPath);
    if (stat.isDirectory()) {
      await fs.rm(globalOldPath, { recursive: true, force: true });
      removed.push(globalOldPath);
    }
  } catch {
    // Does not exist -- nothing to migrate
  }

  // Check project-local old commands location
  const localOldPath = path.join(project, ".claude", "commands", "cht");
  try {
    const stat = await fs.stat(localOldPath);
    if (stat.isDirectory()) {
      await fs.rm(localOldPath, { recursive: true, force: true });
      removed.push(localOldPath);
    }
  } catch {
    // Does not exist -- nothing to migrate
  }

  if (removed.length === 0) {
    warnings.push("No old .claude/commands/cht/ format found -- nothing to migrate");
  }

  return { removed, warnings };
}
