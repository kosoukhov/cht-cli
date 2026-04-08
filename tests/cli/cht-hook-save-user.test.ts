import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createChat, readChat } from "../../src/store/chat-store.ts";
import { setActiveChat, clearActiveChat } from "../../src/session/state.ts";

import { chtExecArgs } from "./helpers.ts";
const [chtCmd, chtArgs] = chtExecArgs();

async function runHookCommand(
  command: string,
  stdinJson: object,
  env: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      chtCmd,
      [...chtArgs, command],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({
          exitCode: error ? 1 : 0,
          stdout: stdout || "",
          stderr: stderr || "",
        });
      },
    );
    child.stdin!.write(JSON.stringify(stdinJson));
    child.stdin!.end();
  });
}

function makeUserPromptInput(prompt: string) {
  return {
    session_id: "test-session",
    hook_event_name: "UserPromptSubmit",
    prompt,
  };
}

describe("cht hook-save-user subcommand", () => {
  let tmpDir: string;
  let origStorageDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-hook-user-test-"));
    origStorageDir = process.env.CHAT_STORAGE_DIR;
    process.env.CHAT_STORAGE_DIR = tmpDir;
  });

  afterEach(async () => {
    await clearActiveChat();
    if (origStorageDir === undefined) {
      delete process.env.CHAT_STORAGE_DIR;
    } else {
      process.env.CHAT_STORAGE_DIR = origStorageDir;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("appends user message when active chat exists", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHookCommand(
      "hook-save-user",
      makeUserPromptInput("Hello Claude"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(1);
    expect(chat.messages[0].role).toBe("user");
    expect(chat.messages[0].content).toBe("Hello Claude");
  });

  it("exits 0 without modification when no active chat", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");

    const result = await runHookCommand(
      "hook-save-user",
      makeUserPromptInput("Hello Claude"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(0);
  });

  it("deduplicates when last message matches incoming prompt", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    // First append
    await runHookCommand(
      "hook-save-user",
      makeUserPromptInput("Hello Claude"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    // Second append with same content (should be skipped)
    const result = await runHookCommand(
      "hook-save-user",
      makeUserPromptInput("Hello Claude"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(1); // Only one message, not two
  });

  it("exits 0 when prompt is empty", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHookCommand(
      "hook-save-user",
      makeUserPromptInput(""),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(0);
  });

  it("logs error and exits 1 when chat file does not exist", async () => {
    await setActiveChat({
      chat_path: path.join(tmpDir, "general", "nonexistent.md"),
      project: "general",
    });

    const result = await runHookCommand(
      "hook-save-user",
      makeUserPromptInput("Hello Claude"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");

    // Verify error was logged
    const logPath = path.join(tmpDir, ".hook-errors.log");
    const logContent = await fs.readFile(logPath, "utf-8");
    expect(logContent).toContain("hook-save-user");
  });
});
