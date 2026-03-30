import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);

const CHT_PATH = path.resolve("bin/cht.ts");

describe("cht status", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-status-test-"));
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

  async function setActiveChat(chatPath: string, project: string) {
    await fs.writeFile(
      path.join(tmpDir, ".active-chat.json"),
      JSON.stringify({ chat_path: chatPath, project }),
    );
  }

  it("no active chat: returns error", async () => {
    const result = await runCht("status");
    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      "No active chat session. Start one with /cht:new or /cht:continue.",
    );
  });

  it("stats under threshold: returns stats with no warning", async () => {
    const createResult = await runCht("create", "general", "Small Chat");
    const chatPath = createResult.chat_path as string;
    await runCht("session-set", chatPath, "general");

    // Directly write 3 messages to avoid CLI overhead
    const existing = await fs.readFile(chatPath, "utf-8");
    const messages = "\n## User\n\nMessage 0\n\n## Assistant\n\nMessage 1\n\n## User\n\nMessage 2\n";
    await fs.writeFile(chatPath, existing + messages, "utf-8");

    const result = await runCht("status");
    expect(result.ok).toBe(true);
    expect(result.message_count).toBe(3);
    expect(typeof result.file_size_bytes).toBe("number");
    expect(typeof result.estimated_tokens).toBe("number");
    expect(result.warning).toBeNull();
  });

  it("message count threshold: warns with rollover suggestion", { timeout: 30000 }, async () => {
    const createResult = await runCht("create", "general", "Big Chat");
    const chatPath = createResult.chat_path as string;
    await runCht("session-set", chatPath, "general");

    // Directly write 51 messages to the file to avoid 51 CLI invocations
    const existing = await fs.readFile(chatPath, "utf-8");
    let messages = "";
    for (let i = 0; i < 51; i++) {
      const role = i % 2 === 0 ? "User" : "Assistant";
      messages += `\n## ${role}\n\nMessage ${i}\n`;
    }
    await fs.writeFile(chatPath, existing + messages, "utf-8");

    const result = await runCht("status");
    expect(result.ok).toBe(true);
    expect(result.message_count).toBe(51);
    expect(result.warning).not.toBeNull();
    expect(result.warning as string).toContain("/cht:rollover");
  });

  it("file size threshold: warns even with few messages", { timeout: 30000 }, async () => {
    const createResult = await runCht("create", "general", "Large File Chat");
    const chatPath = createResult.chat_path as string;
    await runCht("session-set", chatPath, "general");

    // Directly append a large message to the file to avoid CLI stdin timeout
    const existing = await fs.readFile(chatPath, "utf-8");
    const largeContent = existing + "\n## User\n\n" + "x".repeat(110000) + "\n";
    await fs.writeFile(chatPath, largeContent, "utf-8");

    const result = await runCht("status");
    expect(result.ok).toBe(true);
    expect((result.message_count as number)).toBeLessThan(50);
    expect(result.warning).not.toBeNull();
    expect(result.warning as string).toContain("/cht:rollover");
  });

  it("title and project in output", async () => {
    const createResult = await runCht("create", "myproject", "My Special Chat");
    const chatPath = createResult.chat_path as string;
    await runCht("session-set", chatPath, "myproject");

    const result = await runCht("status");
    expect(result.ok).toBe(true);
    expect(result.title).toBe("My Special Chat");
    expect(result.project).toBe("myproject");
  });

  it("token estimate equals Math.round(file_size_bytes / 4)", async () => {
    const createResult = await runCht("create", "general", "Token Test");
    const chatPath = createResult.chat_path as string;
    await runCht("session-set", chatPath, "general");

    const result = await runCht("status");
    expect(result.ok).toBe(true);
    const fileSize = result.file_size_bytes as number;
    const tokens = result.estimated_tokens as number;
    expect(tokens).toBe(Math.round(fileSize / 4));
  });
});
