import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);

const CHT_PATH = path.resolve("bin/cht.ts");

describe("cht rename", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-rename-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function runCht(
    ...cliArgs: string[]
  ): Promise<{ ok: boolean; [key: string]: unknown }> {
    try {
      const { stdout } = await execFileAsync(
        "node",
        ["--experimental-strip-types", CHT_PATH, ...cliArgs],
        {
          env: { ...process.env, CHAT_STORAGE_DIR: tmpDir },
        },
      );
      return JSON.parse(stdout.trim());
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string };
      if (execErr.stdout) {
        return JSON.parse(execErr.stdout.trim());
      }
      throw err;
    }
  }

  it("rename: updates chat title in frontmatter", async () => {
    const createResult = await runCht("create", "general", "Old Title");
    const chatPath = createResult.chat_path as string;

    const result = await runCht("rename", chatPath, "New Title");
    expect(result.ok).toBe(true);
    expect(result.renamed).toBe(chatPath);
    expect(result.title).toBe("New Title");
  });

  it("rename: supports multi-word titles", async () => {
    const createResult = await runCht("create", "general", "Old");
    const chatPath = createResult.chat_path as string;

    const result = await runCht("rename", chatPath, "My", "Great", "Title");
    expect(result.ok).toBe(true);
    expect(result.title).toBe("My Great Title");
  });

  it("rename: missing args returns error", async () => {
    const result = await runCht("rename");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Usage: rename <path> <new-title>");
  });

  it("rename: missing title returns error", async () => {
    const result = await runCht("rename", "/tmp/some-chat.md");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Usage: rename <path> <new-title>");
  });

  it("rename: frontmatter actually updated on disk", async () => {
    const createResult = await runCht("create", "general", "Before Rename");
    const chatPath = createResult.chat_path as string;

    await runCht("rename", chatPath, "After", "Rename");

    const readResult = await runCht("read", chatPath);
    expect(readResult.ok).toBe(true);
    const chat = readResult.chat as { frontmatter: { title: string } };
    expect(chat.frontmatter.title).toBe("After Rename");
  });
});
