import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { chtExecArgs } from "./helpers.ts";
const execFileAsync = promisify(execFile);

const [chtCmd, chtArgs] = chtExecArgs();

describe("cht tag-add / tag-remove", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-tag-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function runCht(
    ...cliArgs: string[]
  ): Promise<{ ok: boolean; [key: string]: unknown }> {
    try {
      const { stdout } = await execFileAsync(
        chtCmd,
        [...chtArgs, ...cliArgs],
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

  // --- tag-add ---

  it("tag-add: adds a tag to a chat", async () => {
    const createResult = await runCht("create", "general", "Tag Test");
    const chatPath = createResult.chat_path as string;

    const result = await runCht("tag-add", chatPath, "work");
    expect(result.ok).toBe(true);
    expect(result.tag).toBe("work");
    expect(result.tags).toEqual(["work"]);
  });

  it("tag-add: duplicate tag is idempotent (no duplication)", async () => {
    const createResult = await runCht("create", "general", "Dup Tag");
    const chatPath = createResult.chat_path as string;

    await runCht("tag-add", chatPath, "work");
    const result = await runCht("tag-add", chatPath, "work");
    expect(result.ok).toBe(true);
    expect(result.tag).toBe("work");
    expect(result.tags).toEqual(["work"]);
  });

  it("tag-add: normalizes tag to kebab-case", async () => {
    const createResult = await runCht("create", "general", "Normalize Test");
    const chatPath = createResult.chat_path as string;

    const result = await runCht("tag-add", chatPath, "My Tag");
    expect(result.ok).toBe(true);
    expect(result.tag).toBe("my-tag");
    expect(result.tags).toEqual(["my-tag"]);
  });

  it("tag-add: invalid tag returns error", async () => {
    const createResult = await runCht("create", "general", "Invalid Tag");
    const chatPath = createResult.chat_path as string;

    const result = await runCht("tag-add", chatPath, "!!!");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("normalizes to empty");
  });

  it("tag-add: missing args returns error", async () => {
    const result = await runCht("tag-add");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Usage: tag-add <path> <tag>");
  });

  // --- tag-remove ---

  it("tag-remove: removes an existing tag", async () => {
    const createResult = await runCht("create", "general", "Remove Test");
    const chatPath = createResult.chat_path as string;

    await runCht("tag-add", chatPath, "work");
    const result = await runCht("tag-remove", chatPath, "work");
    expect(result.ok).toBe(true);
    expect(result.tag).toBe("work");
    expect(result.tags).toEqual([]);
  });

  it("tag-remove: removing nonexistent tag is idempotent", async () => {
    const createResult = await runCht("create", "general", "Idempotent Remove");
    const chatPath = createResult.chat_path as string;

    await runCht("tag-add", chatPath, "existing");
    const result = await runCht("tag-remove", chatPath, "work");
    expect(result.ok).toBe(true);
    expect(result.tag).toBe("work");
    expect(result.tags).toEqual(["existing"]);
  });

  it("tag-remove: invalid tag returns error", async () => {
    const createResult = await runCht("create", "general", "Invalid Remove");
    const chatPath = createResult.chat_path as string;

    const result = await runCht("tag-remove", chatPath, "!!!");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("normalizes to empty");
  });

  it("tag-remove: missing args returns error", async () => {
    const result = await runCht("tag-remove");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Usage: tag-remove <path> <tag>");
  });
});
