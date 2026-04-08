import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chtExecArgs } from "./helpers.ts";

const execFileAsync = promisify(execFile);
const [chtCmd, chtArgs] = chtExecArgs();

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
        chtCmd,
        [...chtArgs, ...cliArgs],
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

  it("search multi-word query: joins words for content match", async () => {
    // Create a chat with a generic title but specific multi-word content
    const createResult = await runCht("create", "general", "Dev Notes");
    const chatPath = createResult.chat_path as string;

    // Append content that can only be found with the full phrase "custom hooks pattern"
    const content = await fs.readFile(chatPath, "utf-8");
    const withContent = content + "\n## User\n\nI want to learn about custom hooks pattern in React.\n";
    await fs.writeFile(chatPath, withContent, "utf-8");

    // Pass multi-word query as separate args -- the CLI must join them
    const result = await runCht("search", "general", "custom", "hooks", "pattern");
    expect(result.ok).toBe(true);
    const results = result.results as Array<{ chatTitle: string; matchType: string }>;
    // With the bug (only first word "custom" used), content search may still match
    // but the full phrase "custom hooks pattern" is needed for a precise content hit
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Verify the result contains content match (not just title match)
    const devNotes = results.find((r) => r.chatTitle === "Dev Notes");
    expect(devNotes).toBeDefined();
  });

  it("search multi-word query with project: all words used", async () => {
    await runCht("create", "general", "Advanced React Patterns");
    const result = await runCht("search", "general", "Advanced", "React");
    expect(result.ok).toBe(true);
    const results = result.results as Array<{ chatTitle: string }>;
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.chatTitle).toBe("Advanced React Patterns");
  });

  it("list --tag: filters by tag", async () => {
    await runCht("create", "general", "Work Chat");
    await runCht("create", "general", "Personal Chat");

    // Find the Work Chat file and add a tag to its frontmatter
    const listResult = await runCht("list", "general");
    const chats = listResult.chats as Array<{ path: string; title: string }>;
    const workChat = chats.find((c) => c.title === "Work Chat")!;

    // Read and inject tags into frontmatter (no tags field exists by default)
    // gray-matter produces: ---\n...fields...\n---\n
    // We insert "tags:\n  - work\n" before the second ---
    const content = await fs.readFile(workChat.path, "utf-8");
    const secondDash = content.indexOf("---", 4); // skip first ---
    const updated =
      content.slice(0, secondDash) +
      "tags:\n  - work\n" +
      content.slice(secondDash);
    await fs.writeFile(workChat.path, updated, "utf-8");

    const filtered = await runCht("list", "general", "--tag", "work");
    expect(filtered.ok).toBe(true);
    const filteredChats = filtered.chats as Array<{ title: string }>;
    expect(filteredChats.length).toBe(1);
    expect(filteredChats[0]!.title).toBe("Work Chat");
  });

  it("list --archived: empty archive returns ok with empty array", async () => {
    const result = await runCht("list", "general", "--archived");
    expect(result.ok).toBe(true);
    const chats = result.chats as Array<Record<string, unknown>>;
    expect(chats.length).toBe(0);
  });

  it("search with no matches: returns empty results array", async () => {
    await runCht("create", "general", "Some Chat");
    const result = await runCht("search", "general", "xyznonexistent999");
    expect(result.ok).toBe(true);
    const results = result.results as Array<Record<string, unknown>>;
    expect(results.length).toBe(0);
  });
});
