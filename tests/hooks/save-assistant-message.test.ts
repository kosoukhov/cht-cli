import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createChat, readChat, appendMessage } from "../../src/store/chat-store.ts";
import { setActiveChat, clearActiveChat } from "../../src/session/state.ts";

const HOOK_SCRIPT = path.resolve(".claude/hooks/save-assistant-message.ts");

async function runHook(
  hookScript: string,
  stdinJson: object,
  env: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      "node",
      ["--experimental-strip-types", hookScript],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({
          exitCode: (error as NodeJS.ErrnoException | null)?.code
            ? parseInt(String((error as any).code), 10) || 1
            : error
              ? 1
              : 0,
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
    transcript_path: "/tmp/transcript.jsonl",
    cwd: "/tmp",
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: lastAssistantMessage,
  };
}

describe("save-assistant-message hook", () => {
  let tmpDir: string;
  let origStorageDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-asst-test-"));
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

    const result = await runHook(
      HOOK_SCRIPT,
      makeStopInput("Here is my answer"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(1);
    expect(chat.messages[0].role).toBe("assistant");
    expect(chat.messages[0].content).toBe("Here is my answer");
  });

  it("exits 0 without modifying files when no active chat", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");

    const result = await runHook(
      HOOK_SCRIPT,
      makeStopInput("Here is my answer"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(0);
  });

  it("exits 0 when last_assistant_message is null (pure tool-call)", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHook(
      HOOK_SCRIPT,
      makeStopInput(null),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(0);
  });

  it("exits 0 when last_assistant_message is empty string", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHook(
      HOOK_SCRIPT,
      makeStopInput(""),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(0);
  });

  it("deduplicates when last message matches incoming content", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    // First append
    await runHook(
      HOOK_SCRIPT,
      makeStopInput("Here is my answer"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    // Second append with same content (should be skipped)
    const result = await runHook(
      HOOK_SCRIPT,
      makeStopInput("Here is my answer"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);

    const chat = await readChat(chatPath);
    expect(chat.messages.length).toBe(1); // Only one message, not two
  });

  it("logs error and exits 1 when chat file does not exist", async () => {
    await setActiveChat({
      chat_path: path.join(tmpDir, "general", "nonexistent.md"),
      project: "general",
    });

    const result = await runHook(
      HOOK_SCRIPT,
      makeStopInput("Here is my answer"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(1);

    // Verify error was logged
    const logPath = path.join(tmpDir, ".hook-errors.log");
    const logContent = await fs.readFile(logPath, "utf-8");
    expect(logContent).toContain("save-assistant-message");
  });
});
