import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

interface SettingsJson {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

const CHT_HOOKS: Record<string, HookGroup> = {
  UserPromptSubmit: {
    hooks: [{ type: "command", command: "cht hook-save-user", timeout: 10 }],
  },
  Stop: {
    hooks: [{ type: "command", command: "cht hook-save-assistant", timeout: 10 }],
  },
  PostCompact: {
    hooks: [{ type: "command", command: "cht hook-save-compact", timeout: 10 }],
  },
  SessionEnd: {
    hooks: [{ type: "command", command: "cht hook-session-clear", timeout: 5 }],
  },
};

export async function registerHooks(
  settingsPath?: string,
): Promise<{ added: string[]; skipped: string[] }> {
  const targetPath =
    settingsPath ?? path.join(os.homedir(), ".claude", "settings.json");

  let settings: SettingsJson;
  try {
    const content = await fs.readFile(targetPath, "utf-8");
    settings = JSON.parse(content) as SettingsJson;
  } catch {
    settings = {};
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }

  const added: string[] = [];
  const skipped: string[] = [];

  for (const [event, hookGroup] of Object.entries(CHT_HOOKS)) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    const commandStr = hookGroup.hooks[0].command;
    const exists = settings.hooks[event].some((group: HookGroup) =>
      group.hooks.some((h: HookEntry) => h.command === commandStr),
    );

    if (exists) {
      skipped.push(event);
    } else {
      settings.hooks[event].push(hookGroup);
      added.push(event);
    }
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(settings, null, 2) + "\n");

  return { added, skipped };
}

const HOOK_FILES_TO_DELETE = [
  "save-user-message.ts",
  "save-assistant-message.ts",
  "save-compact-marker.ts",
];

const HOOK_EVENTS_TO_REMOVE = [
  "UserPromptSubmit",
  "Stop",
  "PostCompact",
  "SessionEnd",
];

export async function cleanProjectHooks(
  projectDir?: string,
): Promise<{ deleted: string[]; cleaned: string[] }> {
  const dir = projectDir ?? process.cwd();
  const deleted: string[] = [];
  const cleaned: string[] = [];

  // Delete hook script files
  for (const file of HOOK_FILES_TO_DELETE) {
    try {
      await fs.unlink(path.join(dir, ".claude", "hooks", file));
      deleted.push(file);
    } catch {
      // File doesn't exist -- skip silently
    }
  }

  // Clean project-local settings.json
  const settingsPath = path.join(dir, ".claude", "settings.json");
  try {
    const content = await fs.readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content) as SettingsJson;

    if (settings.hooks) {
      for (const event of HOOK_EVENTS_TO_REMOVE) {
        if (settings.hooks[event]) {
          delete settings.hooks[event];
          cleaned.push(event);
        }
      }
      await fs.writeFile(
        settingsPath,
        JSON.stringify(settings, null, 2) + "\n",
      );
    }
  } catch {
    // File doesn't exist -- skip silently
  }

  return { deleted, cleaned };
}

/**
 * Resolve the package root directory from the executing file's dirname.
 * In production (dist/cht.js): metaDirname = .../node_modules/@kosoukhov/cht-cli/dist
 * In dev (bin/cht.ts via vitest): metaDirname = .../project/bin
 * Both cases: parent directory is the package root.
 */
export function resolvePackageRoot(metaDirname: string): string {
  return path.resolve(metaDirname, "..");
}

/**
 * Copy all cht-* skill directories from the package's .claude/skills/ to the
 * target directory (default: ~/.claude/skills/). Overwrites existing files.
 * Per D-06: overwrite all on every run (like GSD). Simple, idempotent.
 * Per D-07: metaDirname passed from import.meta.dirname at the call site.
 */
export async function copySkills(
  metaDirname: string,
  targetRoot?: string,
): Promise<{ copied: string[]; errors: string[] }> {
  const pkgRoot = resolvePackageRoot(metaDirname);
  const skillsSource = path.join(pkgRoot, ".claude", "skills");
  const skillsTarget = targetRoot ?? path.join(os.homedir(), ".claude", "skills");

  const copied: string[] = [];
  const errors: string[] = [];

  let entries;
  try {
    entries = await fs.readdir(skillsSource, { withFileTypes: true });
  } catch {
    errors.push(`Skills source not found: ${skillsSource}`);
    return { copied, errors };
  }

  const chtSkills = entries.filter(e => e.isDirectory() && e.name.startsWith("cht-"));

  for (const skill of chtSkills) {
    try {
      const src = path.join(skillsSource, skill.name);
      const dst = path.join(skillsTarget, skill.name);
      await fs.mkdir(dst, { recursive: true });
      await fs.cp(src, dst, { recursive: true, force: true });
      copied.push(skill.name);
    } catch (err) {
      errors.push(`${skill.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { copied, errors };
}
