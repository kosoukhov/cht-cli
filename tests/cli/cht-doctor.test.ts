import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runDoctor } from "../../src/hooks/doctor.ts";

describe("runDoctor", () => {
  let tmpDir: string;
  let skillsDir: string;
  let settingsPath: string;
  let storageDir: string;

  const EXPECTED_SKILLS = [
    "cht-archive", "cht-continue", "cht-delete", "cht-end",
    "cht-include", "cht-list", "cht-new", "cht-rename",
    "cht-restore", "cht-rollover", "cht-search", "cht-status", "cht-tag",
  ];

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-doctor-"));
    skillsDir = path.join(tmpDir, "skills");
    storageDir = path.join(tmpDir, "storage");
    settingsPath = path.join(tmpDir, "settings.json");

    // Create all 13 skill directories with SKILL.md
    for (const skill of EXPECTED_SKILLS) {
      await fs.mkdir(path.join(skillsDir, skill), { recursive: true });
      await fs.writeFile(path.join(skillsDir, skill, "SKILL.md"), `# ${skill}`);
    }

    // Create storage directory
    await fs.mkdir(storageDir, { recursive: true });

    // Create settings.json with all 4 hooks registered
    const settings = {
      hooks: {
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "cht hook-save-user" }] }],
        Stop: [{ hooks: [{ type: "command", command: "cht hook-save-assistant" }] }],
        PostCompact: [{ hooks: [{ type: "command", command: "cht hook-save-compact" }] }],
        SessionEnd: [{ hooks: [{ type: "command", command: "cht hook-session-clear" }] }],
      },
    };
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reports all checks as ok when everything is properly set up", async () => {
    const result = await runDoctor({
      skillsDir,
      settingsPath,
      storageRoot: storageDir,
      skipCliCheck: true,
    });

    expect(result.overall).toBe("ok");
    // 13 skills + 4 hooks + 1 storage = 18 checks
    expect(result.checks).toHaveLength(18);
    expect(result.checks.every(c => c.status === "ok")).toBe(true);
  });

  it("reports fail for missing skill directory", async () => {
    // Remove one skill
    await fs.rm(path.join(skillsDir, "cht-new"), { recursive: true });

    const result = await runDoctor({
      skillsDir,
      settingsPath,
      storageRoot: storageDir,
      skipCliCheck: true,
    });

    expect(result.overall).toBe("fail");
    const newSkillCheck = result.checks.find(c => c.name === "skill:cht-new");
    expect(newSkillCheck).toBeDefined();
    expect(newSkillCheck!.status).toBe("fail");
    expect(newSkillCheck!.detail).toContain("Missing");
  });

  it("reports fail when hooks not in settings.json", async () => {
    // Write empty settings
    await fs.writeFile(settingsPath, JSON.stringify({}, null, 2));

    const result = await runDoctor({
      skillsDir,
      settingsPath,
      storageRoot: storageDir,
      skipCliCheck: true,
    });

    expect(result.overall).toBe("fail");
    const hookChecks = result.checks.filter(c => c.name.startsWith("hook:"));
    expect(hookChecks).toHaveLength(4);
    expect(hookChecks.every(c => c.status === "fail")).toBe(true);
  });

  it("reports fail when storage dir not accessible", async () => {
    const result = await runDoctor({
      skillsDir,
      settingsPath,
      storageRoot: path.join(tmpDir, "nonexistent-storage"),
      skipCliCheck: true,
    });

    expect(result.overall).toBe("fail");
    const storageCheck = result.checks.find(c => c.name === "storage");
    expect(storageCheck).toBeDefined();
    expect(storageCheck!.status).toBe("fail");
    expect(storageCheck!.detail).toContain("Not accessible");
  });

  it("returns overall fail when any single check fails", async () => {
    // Remove just one skill to make exactly one check fail
    await fs.rm(path.join(skillsDir, "cht-tag"), { recursive: true });

    const result = await runDoctor({
      skillsDir,
      settingsPath,
      storageRoot: storageDir,
      skipCliCheck: true,
    });

    expect(result.overall).toBe("fail");
    // Only the one skill check should be fail
    const failedChecks = result.checks.filter(c => c.status === "fail");
    expect(failedChecks).toHaveLength(1);
    expect(failedChecks[0].name).toBe("skill:cht-tag");
  });
});
