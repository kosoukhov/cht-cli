import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { checkLatestVersion } from "./version-check.ts";

export interface DoctorCheck {
  name: string;
  status: "ok" | "fail";
  detail: string;
}

const EXPECTED_SKILLS = [
  "cht-archive", "cht-continue", "cht-delete", "cht-end",
  "cht-include", "cht-list", "cht-new", "cht-rename",
  "cht-restore", "cht-rollover", "cht-search", "cht-status", "cht-tag",
];

export async function runDoctor(options?: {
  skillsDir?: string;
  settingsPath?: string;
  storageRoot?: string;
  skipCliCheck?: boolean;
  checkVersion?: boolean;
}): Promise<{ checks: DoctorCheck[]; overall: "ok" | "fail" }> {
  const checks: DoctorCheck[] = [];
  const skillsDir = options?.skillsDir ?? path.join(os.homedir(), ".claude", "skills");
  const settingsPath = options?.settingsPath ?? path.join(os.homedir(), ".claude", "settings.json");

  // 1. Skills presence: check each of the 13 expected skills
  for (const skill of EXPECTED_SKILLS) {
    const skillPath = path.join(skillsDir, skill, "SKILL.md");
    try {
      await fs.access(skillPath);
      checks.push({ name: `skill:${skill}`, status: "ok", detail: skillPath });
    } catch {
      checks.push({ name: `skill:${skill}`, status: "fail", detail: `Missing: ${skillPath}` });
    }
  }

  // 2. Hooks registered: parse settings.json for cht hook commands
  const expectedHooks = ["cht hook-save-user", "cht hook-save-assistant", "cht hook-save-compact", "cht hook-session-clear"];
  try {
    const content = await fs.readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content);
    const allCommands: string[] = [];
    if (settings.hooks) {
      for (const groups of Object.values(settings.hooks)) {
        for (const group of groups as Array<{ hooks: Array<{ command: string }> }>) {
          for (const h of group.hooks) {
            allCommands.push(h.command);
          }
        }
      }
    }
    for (const hookCmd of expectedHooks) {
      if (allCommands.includes(hookCmd)) {
        checks.push({ name: `hook:${hookCmd}`, status: "ok", detail: "Registered" });
      } else {
        checks.push({ name: `hook:${hookCmd}`, status: "fail", detail: `Not found in ${settingsPath}` });
      }
    }
  } catch {
    for (const hookCmd of expectedHooks) {
      checks.push({ name: `hook:${hookCmd}`, status: "fail", detail: `Cannot read ${settingsPath}` });
    }
  }

  // 3. CLI on PATH (skip in tests via option)
  if (!options?.skipCliCheck) {
    try {
      const result = execFileSync("which", ["cht"], { encoding: "utf-8" }).trim();
      checks.push({ name: "cli-on-path", status: "ok", detail: result });
    } catch {
      checks.push({ name: "cli-on-path", status: "fail", detail: "cht not found on PATH. Run: npm install -g @kosoukhov/cht-cli" });
    }
  }

  // 4. Storage accessible
  if (options?.storageRoot) {
    try {
      await fs.access(options.storageRoot);
      checks.push({ name: "storage", status: "ok", detail: options.storageRoot });
    } catch {
      checks.push({ name: "storage", status: "fail", detail: `Not accessible: ${options.storageRoot}` });
    }
  }

  // 5. Version check (opt-in via --check-version flag) [D-01, D-09, D-14, D-15]
  if (options?.checkVersion) {
    try {
      const info = await checkLatestVersion();
      if (info.upToDate) {
        // D-02: up-to-date format
        checks.push({
          name: "version",
          status: "ok",
          detail: `${info.current} is the latest version`,
        });
      } else {
        // D-03: update-available format (status ok -- the check succeeded)
        checks.push({
          name: "version",
          status: "ok",
          detail: `${info.current} \u2192 ${info.latest} available`,
        });
      }
    } catch (err) {
      // D-05, D-06, D-07: network failure = fail status, no retry
      const msg = err instanceof Error
        ? (err.name === "TimeoutError" ? `timeout ${5000 / 1000}s` : err.message)
        : "unknown error";
      checks.push({
        name: "version",
        status: "fail",
        detail: `Could not reach npm registry (${msg})`,
      });
    }
  }

  const overall = checks.every(c => c.status === "ok") ? "ok" : "fail";
  return { checks, overall };
}
