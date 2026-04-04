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
