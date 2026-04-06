import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { registerHooks, cleanProjectHooks, copySkills, resolvePackageRoot } from "../../src/hooks/setup.ts";

describe("registerHooks", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-setup-reg-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("adds 4 hook events to empty settings file", async () => {
    const settingsPath = path.join(tmpDir, "settings.json");

    const result = await registerHooks(settingsPath);

    expect(result.added).toHaveLength(4);
    expect(result.added).toContain("UserPromptSubmit");
    expect(result.added).toContain("Stop");
    expect(result.added).toContain("PostCompact");
    expect(result.added).toContain("SessionEnd");
    expect(result.skipped).toHaveLength(0);

    const settings = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toBe("cht hook-save-user");
    expect(settings.hooks.Stop[0].hooks[0].command).toBe("cht hook-save-assistant");
    expect(settings.hooks.PostCompact[0].hooks[0].command).toBe("cht hook-save-compact");
    expect(settings.hooks.SessionEnd[0].hooks[0].command).toBe("cht hook-session-clear");
  });

  it("preserves existing GSD hooks when adding cht hooks", async () => {
    const settingsPath = path.join(tmpDir, "settings.json");
    const initialSettings = {
      model: "opus",
      hooks: {
        SessionStart: [
          {
            hooks: [
              { type: "command", command: "node gsd-check-update.js" },
            ],
          },
        ],
      },
    };
    await fs.writeFile(settingsPath, JSON.stringify(initialSettings, null, 2) + "\n");

    const result = await registerHooks(settingsPath);

    expect(result.added).toHaveLength(4);
    expect(result.skipped).toHaveLength(0);

    const settings = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    // Non-hooks key preserved
    expect(settings.model).toBe("opus");
    // GSD hook untouched
    expect(settings.hooks.SessionStart[0].hooks[0].command).toBe("node gsd-check-update.js");
    // Cht hooks added
    expect(settings.hooks.UserPromptSubmit).toBeDefined();
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toBe("cht hook-save-user");
  });

  it("skips all 4 events on second run (idempotency)", async () => {
    const settingsPath = path.join(tmpDir, "settings.json");

    // First run
    await registerHooks(settingsPath);

    // Second run
    const result = await registerHooks(settingsPath);

    expect(result.added).toHaveLength(0);
    expect(result.skipped).toHaveLength(4);
    expect(result.skipped).toContain("UserPromptSubmit");
    expect(result.skipped).toContain("Stop");
    expect(result.skipped).toContain("PostCompact");
    expect(result.skipped).toContain("SessionEnd");

    // Verify arrays didn't grow
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(settings.hooks.PostCompact).toHaveLength(1);
    expect(settings.hooks.SessionEnd).toHaveLength(1);
  });

  it("creates parent directory if settings path doesn't exist", async () => {
    const settingsPath = path.join(tmpDir, "subdir", "settings.json");

    const result = await registerHooks(settingsPath);

    expect(result.added).toHaveLength(4);
    const content = await fs.readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content);
    expect(settings.hooks).toBeDefined();
    expect(Object.keys(settings.hooks)).toHaveLength(4);
  });
});

describe("cleanProjectHooks", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-setup-clean-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("deletes hook script files", async () => {
    const hooksDir = path.join(tmpDir, ".claude", "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    await fs.writeFile(path.join(hooksDir, "save-user-message.ts"), "// old hook");
    await fs.writeFile(path.join(hooksDir, "save-assistant-message.ts"), "// old hook");
    await fs.writeFile(path.join(hooksDir, "save-compact-marker.ts"), "// old hook");

    const result = await cleanProjectHooks(tmpDir);

    expect(result.deleted).toHaveLength(3);
    expect(result.deleted).toContain("save-user-message.ts");
    expect(result.deleted).toContain("save-assistant-message.ts");
    expect(result.deleted).toContain("save-compact-marker.ts");

    // Files no longer exist
    for (const file of ["save-user-message.ts", "save-assistant-message.ts", "save-compact-marker.ts"]) {
      await expect(fs.access(path.join(hooksDir, file))).rejects.toThrow();
    }
  });

  it("removes cht event keys from project-local settings", async () => {
    const claudeDir = path.join(tmpDir, ".claude");
    await fs.mkdir(claudeDir, { recursive: true });
    const settingsPath = path.join(claudeDir, "settings.json");
    const settings = {
      hooks: {
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "old-hook" }] }],
        Stop: [{ hooks: [{ type: "command", command: "old-hook" }] }],
        PostCompact: [{ hooks: [{ type: "command", command: "old-hook" }] }],
        SessionEnd: [{ hooks: [{ type: "command", command: "old-hook" }] }],
      },
    };
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");

    const result = await cleanProjectHooks(tmpDir);

    expect(result.cleaned).toHaveLength(4);

    // File still exists
    const content = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(content.hooks.UserPromptSubmit).toBeUndefined();
    expect(content.hooks.Stop).toBeUndefined();
    expect(content.hooks.PostCompact).toBeUndefined();
    expect(content.hooks.SessionEnd).toBeUndefined();
    // File was not deleted
    await expect(fs.access(settingsPath)).resolves.toBeUndefined();
  });

  it("handles already-cleaned state gracefully", async () => {
    // No .claude dir at all
    const result = await cleanProjectHooks(tmpDir);

    expect(result.deleted).toHaveLength(0);
    expect(result.cleaned).toHaveLength(0);
  });
});

describe("resolvePackageRoot", () => {
  it("returns parent directory of given dirname", () => {
    expect(resolvePackageRoot("/foo/bar/dist")).toBe("/foo/bar");
    expect(resolvePackageRoot("/foo/bar/bin")).toBe("/foo/bar");
  });
});

describe("copySkills", () => {
  let tmpSource: string;
  let tmpTarget: string;

  beforeEach(async () => {
    tmpSource = await fs.mkdtemp(path.join(os.tmpdir(), "cht-copy-src-"));
    tmpTarget = await fs.mkdtemp(path.join(os.tmpdir(), "cht-copy-dst-"));

    // Create fake skill directories in tmpSource/.claude/skills/
    const skillsDir = path.join(tmpSource, ".claude", "skills");
    for (const name of ["cht-new", "cht-search", "cht-list"]) {
      await fs.mkdir(path.join(skillsDir, name), { recursive: true });
      await fs.writeFile(path.join(skillsDir, name, "SKILL.md"), `# ${name}`);
    }
    // Create a non-cht directory (should be ignored)
    await fs.mkdir(path.join(skillsDir, "gsd-something"), { recursive: true });
    await fs.writeFile(path.join(skillsDir, "gsd-something", "SKILL.md"), "# gsd");
  });

  afterEach(async () => {
    await fs.rm(tmpSource, { recursive: true, force: true });
    await fs.rm(tmpTarget, { recursive: true, force: true });
  });

  // metaDirname simulates dist/ or bin/ -- one level below package root
  function getMetaDirname() {
    return path.join(tmpSource, "dist");
  }

  it("copies all cht-* directories to target", async () => {
    const metaDirname = getMetaDirname();
    await fs.mkdir(metaDirname, { recursive: true });
    const result = await copySkills(metaDirname, tmpTarget);

    expect(result.copied).toHaveLength(3);
    expect(result.copied).toContain("cht-new");
    expect(result.copied).toContain("cht-search");
    expect(result.copied).toContain("cht-list");
    expect(result.errors).toHaveLength(0);

    // Verify files exist at target
    const content = await fs.readFile(path.join(tmpTarget, "cht-new", "SKILL.md"), "utf-8");
    expect(content).toBe("# cht-new");
  });

  it("does not copy non-cht directories", async () => {
    const metaDirname = getMetaDirname();
    await fs.mkdir(metaDirname, { recursive: true });
    const result = await copySkills(metaDirname, tmpTarget);

    expect(result.copied).not.toContain("gsd-something");
    await expect(fs.access(path.join(tmpTarget, "gsd-something"))).rejects.toThrow();
  });

  it("overwrites existing files on second run (idempotency)", async () => {
    const metaDirname = getMetaDirname();
    await fs.mkdir(metaDirname, { recursive: true });

    // First run
    await copySkills(metaDirname, tmpTarget);

    // Modify source
    await fs.writeFile(
      path.join(tmpSource, ".claude", "skills", "cht-new", "SKILL.md"),
      "# cht-new v2"
    );

    // Second run
    const result = await copySkills(metaDirname, tmpTarget);
    expect(result.copied).toHaveLength(3);
    expect(result.errors).toHaveLength(0);

    // Verify overwrite happened
    const content = await fs.readFile(path.join(tmpTarget, "cht-new", "SKILL.md"), "utf-8");
    expect(content).toBe("# cht-new v2");
  });

  it("returns error when source directory does not exist", async () => {
    // Use a separate temp dir that has NO .claude/skills/ at all
    const emptyRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cht-copy-empty-"));
    const metaDirname = path.join(emptyRoot, "dist");
    await fs.mkdir(metaDirname, { recursive: true });
    const result = await copySkills(metaDirname, tmpTarget);

    expect(result.copied).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Skills source not found");

    await fs.rm(emptyRoot, { recursive: true, force: true });
  });
});
