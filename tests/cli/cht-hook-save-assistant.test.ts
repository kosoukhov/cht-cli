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

function makeStopInput(lastAssistantMessage: string | null) {
  return {
    session_id: "test-session",
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: lastAssistantMessage,
  };
}

describe("cht hook-save-assistant subcommand", () => {
  let tmpDir: string;
  let origStorageDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-hook-asst-test-"));
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

  it("appends assistant message when active chat exists", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHookCommand(
      "hook-save-assistant",
      makeStopInput("Hi there"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(1);
    expect(chat.messages[0].role).toBe("assistant");
    expect(chat.messages[0].content).toBe("Hi there");
  });

  it("exits 0 without modification when no active chat", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");

    const result = await runHookCommand(
      "hook-save-assistant",
      makeStopInput("Hi there"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(0);
  });

  it("exits 0 when last_assistant_message is null", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHookCommand(
      "hook-save-assistant",
      makeStopInput(null),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(0);
  });

  it("exits 0 when last_assistant_message is empty", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHookCommand(
      "hook-save-assistant",
      makeStopInput(""),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(0);
  });

  it("deduplicates when last assistant message matches", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    // First append
    await runHookCommand(
      "hook-save-assistant",
      makeStopInput("Hi there"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    // Second append with same content (should be skipped)
    const result = await runHookCommand(
      "hook-save-assistant",
      makeStopInput("Hi there"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(1); // Only one message, not two
  });
});
