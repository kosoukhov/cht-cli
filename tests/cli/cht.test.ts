import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);

const CHT_PATH = path.resolve("bin/cht.ts");

describe("cht CLI", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-cli-test-"));
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
      // CLI exits with code 1 for errors but still outputs JSON
      const execErr = err as { stdout?: string; stderr?: string };
      if (execErr.stdout) {
        return JSON.parse(execErr.stdout.trim());
      }
      throw err;
    }
  }

  it("create: creates a chat and returns path", async () => {
    const result = await runCht("create", "general", "Test Chat");
    expect(result.ok).toBe(true);
    expect(typeof result.chat_path).toBe("string");
    expect((result.chat_path as string).endsWith(".md")).toBe(true);
  });

  it("list: lists created chats", async () => {
    await runCht("create", "general", "Listed Chat");
    const result = await runCht("list", "general");
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.chats)).toBe(true);
    const chats = result.chats as Array<{ title: string }>;
    expect(chats.length).toBe(1);
    expect(chats[0].title).toBe("Listed Chat");
  });

  it("list --recent: limits results", async () => {
    await runCht("create", "general", "Chat A");
    await runCht("create", "general", "Chat B");
    await runCht("create", "general", "Chat C");
    const result = await runCht("list", "general", "--recent", "1");
    expect(result.ok).toBe(true);
    const chats = result.chats as Array<Record<string, unknown>>;
    expect(chats.length).toBe(1);
  });

  it("search: returns results array", async () => {
    await runCht("create", "general", "Searchable Topic");
    const result = await runCht("search", "general", "Searchable");
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.results)).toBe(true);
  });

  it("read: reads a chat", async () => {
    const createResult = await runCht("create", "general", "Readable Chat");
    const chatPath = createResult.chat_path as string;
    const result = await runCht("read", chatPath);
    expect(result.ok).toBe(true);
    const chat = result.chat as { frontmatter: { title: string } };
    expect(chat.frontmatter.title).toBe("Readable Chat");
  });

  it("delete: removes a chat", async () => {
    const createResult = await runCht("create", "general", "Deletable Chat");
    const chatPath = createResult.chat_path as string;
    const deleteResult = await runCht("delete", chatPath);
    expect(deleteResult.ok).toBe(true);
    expect(deleteResult.deleted).toBe(chatPath);
    // Verify it's gone from listing
    const listResult = await runCht("list", "general");
    const chats = listResult.chats as Array<Record<string, unknown>>;
    expect(chats.length).toBe(0);
  });

  it("archive and restore: round-trips a chat", async () => {
    const createResult = await runCht("create", "general", "Archivable Chat");
    const chatPath = createResult.chat_path as string;

    const archiveResult = await runCht("archive", chatPath, "general");
    expect(archiveResult.ok).toBe(true);
    expect(typeof archiveResult.archived).toBe("string");
    expect((archiveResult.archived as string).includes("_archive")).toBe(true);

    const restoreResult = await runCht(
      "restore",
      archiveResult.archived as string,
      "general",
    );
    expect(restoreResult.ok).toBe(true);
    expect(typeof restoreResult.restored).toBe("string");

    // Verify chat is back in list
    const listResult = await runCht("list", "general");
    const chats = listResult.chats as Array<Record<string, unknown>>;
    expect(chats.length).toBe(1);
  });

  it("session-set/get/clear: manages session state", async () => {
    // Set session
    const setResult = await runCht(
      "session-set",
      "/tmp/test-chat.md",
      "myproject",
    );
    expect(setResult.ok).toBe(true);

    // Get session
    const getResult = await runCht("session-get");
    expect(getResult.ok).toBe(true);
    const active = getResult.active as {
      chat_path: string;
      project: string;
    };
    expect(active.chat_path).toBe("/tmp/test-chat.md");
    expect(active.project).toBe("myproject");

    // Clear session
    const clearResult = await runCht("session-clear");
    expect(clearResult.ok).toBe(true);

    // Get again -- should be null
    const getResult2 = await runCht("session-get");
    expect(getResult2.ok).toBe(true);
    expect(getResult2.active).toBeNull();
  });

  it("unknown command: returns error JSON", async () => {
    const result = await runCht("INVALID");
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect((result.error as string).includes("Unknown command")).toBe(true);
  });

  it("projects: lists project directories", async () => {
    // Create a chat in a named project to ensure the directory exists
    await runCht("create", "testproject", "Project Chat");
    const result = await runCht("projects");
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.projects)).toBe(true);
    const projects = result.projects as string[];
    expect(projects.includes("testproject")).toBe(true);
  });
});
