import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";

const execFileAsync = promisify(execFile);

const CHT_PATH = path.resolve("bin/cht.ts");

describe("cht rollover", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-rollover-test-"));
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

  it("no active chat returns error", async () => {
    const result = await runCht("rollover");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No active chat");
  });

  it("creates new chat and switches session", async () => {
    // Create a chat and set it as active
    const createResult = await runCht("create", "general", "Test Chat");
    const oldChatPath = createResult.chat_path as string;
    await runCht("session-set", oldChatPath, "general");

    // Rollover
    const rolloverResult = await runCht("rollover");
    expect(rolloverResult.ok).toBe(true);

    // Verify session switched to new chat
    const sessionResult = await runCht("session-get");
    const newActivePath = (sessionResult.active as { chat_path: string }).chat_path;
    expect(newActivePath).not.toBe(oldChatPath);
    expect(newActivePath).toBe(rolloverResult.new_chat_path);
  });

  it("old chat has continued_in in frontmatter", async () => {
    const createResult = await runCht("create", "general", "Old Chat");
    const oldChatPath = createResult.chat_path as string;
    await runCht("session-set", oldChatPath, "general");

    const rolloverResult = await runCht("rollover");
    const newChatPath = rolloverResult.new_chat_path as string;

    // Read old chat file and parse YAML frontmatter
    const oldContent = await fs.readFile(oldChatPath, "utf-8");
    const { data: oldFrontmatter } = matter(oldContent);
    expect(oldFrontmatter.continued_in).toBe(newChatPath);
  });

  it("new chat has continued_from in frontmatter", async () => {
    const createResult = await runCht("create", "general", "From Chat");
    const oldChatPath = createResult.chat_path as string;
    await runCht("session-set", oldChatPath, "general");

    const rolloverResult = await runCht("rollover");
    const newChatPath = rolloverResult.new_chat_path as string;

    // Read new chat file and parse YAML frontmatter
    const newContent = await fs.readFile(newChatPath, "utf-8");
    const { data: newFrontmatter } = matter(newContent);
    expect(newFrontmatter.continued_from).toBe(oldChatPath);
  });

  it("new chat inherits title from old chat", async () => {
    const createResult = await runCht("create", "general", "My Important Chat");
    const oldChatPath = createResult.chat_path as string;
    await runCht("session-set", oldChatPath, "general");

    const rolloverResult = await runCht("rollover");
    const newChatPath = rolloverResult.new_chat_path as string;

    // Read new chat frontmatter and verify title
    const newContent = await fs.readFile(newChatPath, "utf-8");
    const { data: newFrontmatter } = matter(newContent);
    expect(newFrontmatter.title).toBe("My Important Chat");

    // Also verify the rollover output contains the title
    expect(rolloverResult.title).toBe("My Important Chat");
  });

  it("new chat inherits tags from old chat", async () => {
    // Create chat and add tags
    const createResult = await runCht("create", "general", "Tagged Chat");
    const oldChatPath = createResult.chat_path as string;
    await runCht("tag-add", oldChatPath, "important");
    await runCht("tag-add", oldChatPath, "work");
    await runCht("session-set", oldChatPath, "general");

    const rolloverResult = await runCht("rollover");
    const newChatPath = rolloverResult.new_chat_path as string;

    // Read new chat frontmatter and verify tags
    const newContent = await fs.readFile(newChatPath, "utf-8");
    const { data: newFrontmatter } = matter(newContent);
    expect(newFrontmatter.tags).toEqual(
      expect.arrayContaining(["important", "work"]),
    );
    expect(newFrontmatter.tags).toHaveLength(2);
  });

  it("output contains old_chat_path and new_chat_path", async () => {
    const createResult = await runCht("create", "general", "Output Check");
    const oldChatPath = createResult.chat_path as string;
    await runCht("session-set", oldChatPath, "general");

    const rolloverResult = await runCht("rollover");
    expect(rolloverResult.ok).toBe(true);
    expect(rolloverResult.old_chat_path).toBe(oldChatPath);
    expect(typeof rolloverResult.new_chat_path).toBe("string");
    expect(rolloverResult.new_chat_path).not.toBe(oldChatPath);
    expect(rolloverResult.project).toBe("general");
  });

  it("schema accepts continued_from and continued_in", async () => {
    // Create a chat, rollover, then read both to verify parsing succeeds
    const createResult = await runCht("create", "general", "Schema Test");
    const oldChatPath = createResult.chat_path as string;
    await runCht("session-set", oldChatPath, "general");

    await runCht("rollover");

    // Read both chats via CLI -- if schema rejects the fields, readChat would fail
    const oldReadResult = await runCht("read", oldChatPath);
    expect(oldReadResult.ok).toBe(true);

    const sessionResult = await runCht("session-get");
    const newChatPath = (sessionResult.active as { chat_path: string }).chat_path;
    const newReadResult = await runCht("read", newChatPath);
    expect(newReadResult.ok).toBe(true);
  });
});
