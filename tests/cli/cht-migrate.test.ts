import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runMigrate } from "../../src/hooks/migrate.ts";

describe("runMigrate", () => {
  let tmpHome: string;
  let tmpProject: string;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "cht-migrate-home-"));
    tmpProject = await fs.mkdtemp(path.join(os.tmpdir(), "cht-migrate-proj-"));
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
    await fs.rm(tmpProject, { recursive: true, force: true });
  });

  it("removes global .claude/commands/cht/ directory when it exists", async () => {
    const oldCmdDir = path.join(tmpHome, ".claude", "commands", "cht");
    await fs.mkdir(oldCmdDir, { recursive: true });
    await fs.writeFile(path.join(oldCmdDir, "cht-new.md"), "# old command");

    const result = await runMigrate({ homeDir: tmpHome, projectDir: tmpProject });

    expect(result.removed).toContain(oldCmdDir);
    await expect(fs.access(oldCmdDir)).rejects.toThrow();
  });

  it("removes project-local .claude/commands/cht/ directory when it exists", async () => {
    const oldCmdDir = path.join(tmpProject, ".claude", "commands", "cht");
    await fs.mkdir(oldCmdDir, { recursive: true });
    await fs.writeFile(path.join(oldCmdDir, "cht-list.md"), "# old command");

    const result = await runMigrate({ homeDir: tmpHome, projectDir: tmpProject });

    expect(result.removed).toContain(oldCmdDir);
    await expect(fs.access(oldCmdDir)).rejects.toThrow();
  });

  it("handles both locations missing (returns empty removed, has warning)", async () => {
    const result = await runMigrate({ homeDir: tmpHome, projectDir: tmpProject });

    expect(result.removed).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("nothing to migrate");
  });

  it("is idempotent -- second run returns empty removed", async () => {
    const oldCmdDir = path.join(tmpHome, ".claude", "commands", "cht");
    await fs.mkdir(oldCmdDir, { recursive: true });
    await fs.writeFile(path.join(oldCmdDir, "cht-new.md"), "# old command");

    // First run -- removes
    const first = await runMigrate({ homeDir: tmpHome, projectDir: tmpProject });
    expect(first.removed).toHaveLength(1);

    // Second run -- nothing to remove
    const second = await runMigrate({ homeDir: tmpHome, projectDir: tmpProject });
    expect(second.removed).toHaveLength(0);
    expect(second.warnings).toHaveLength(1);
  });
});
